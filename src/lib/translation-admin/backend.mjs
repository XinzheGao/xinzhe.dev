import { resolve, join } from 'node:path'
import { readJSON, writeJSON, withStoreLock } from '../translations/store.mjs'
import { enqueueLocal, workerState } from './local-queue.mjs'
import { AdminError, reviewRecord, validateTarget } from './model.mjs'

export function backendConfig(env = process.env) {
  const mode = env.TRANSLATION_ADMIN_BACKEND || (env.NODE_ENV === 'development' ? 'local' : 'github')
  if (!['local', 'github'].includes(mode)) throw new AdminError(503, '管理后台存储模式无效。')
  if (mode === 'local' && env.VERCEL) throw new AdminError(503, 'Vercel 必须使用 GitHub 后端，不能写入临时文件。')
  return {
    mode,
    configured:
      mode === 'local' ||
      Boolean(env.TRANSLATION_GITHUB_TOKEN && env.TRANSLATION_GITHUB_REPOSITORY && env.TRANSLATION_GITHUB_BRANCH)
  }
}

export function createAdminBackend({ env = process.env, directory = resolve('translations'), fetcher = fetch } = {}) {
  const config = backendConfig(env)
  const requireConfig = () => {
    if (!config.configured) throw new AdminError(503, '请先配置 GitHub 仓库、分支和后台专用 Token。')
  }
  async function github(path, options = {}) {
    requireConfig()
    if (!/^[\w.-]+\/[\w.-]+$/.test(env.TRANSLATION_GITHUB_REPOSITORY))
      throw new AdminError(503, 'GitHub 仓库配置无效。')
    const response = await fetcher(`https://api.github.com/repos/${env.TRANSLATION_GITHUB_REPOSITORY}/${path}`, {
      ...options,
      cache: 'no-store',
      signal: AbortSignal.timeout(20000),
      headers: {
        Accept: 'application/vnd.github+json',
        Authorization: `Bearer ${env.TRANSLATION_GITHUB_TOKEN}`,
        'X-GitHub-Api-Version': '2026-03-10',
        'Content-Type': 'application/json',
        ...options.headers
      }
    })
    if (!response.ok)
      throw new AdminError(
        response.status === 409 || response.status === 422 ? 409 : 502,
        response.status === 409 || response.status === 422
          ? '远端文件或任务发生冲突，请刷新后重试。'
          : `GitHub 请求失败（HTTP ${response.status}），请检查仓库、分支与权限。`
      )
    return response.status === 204 ? null : response.json()
  }
  async function readRemote(name, fallback) {
    try {
      const file = await github(
        `contents/translations/${name}?ref=${encodeURIComponent(env.TRANSLATION_GITHUB_BRANCH)}`
      )
      if (file.encoding !== 'base64' || !file.content)
        throw new AdminError(503, '译文文件过大或格式不受支持，请拆分存储后再管理。')
      return { value: JSON.parse(Buffer.from(file.content, 'base64').toString('utf8')), sha: file.sha }
    } catch (error) {
      // Optional jobs files do not exist before the first run. Do not mask auth failures.
      if (fallback !== undefined && error.message?.includes('HTTP 404')) return { value: fallback }
      throw error
    }
  }
  async function runs() {
    if (config.mode === 'local') return []
    const result = await github(
      `actions/workflows/translations.yml/runs?branch=${encodeURIComponent(env.TRANSLATION_GITHUB_BRANCH)}&per_page=15`
    )
    return result.workflow_runs.map((run) => ({
      id: run.id,
      title: run.display_title,
      state: run.status === 'completed' ? run.conclusion : run.status,
      url: run.html_url,
      createdAt: run.created_at
    }))
  }
  async function state() {
    if (config.mode === 'local') {
      const [catalog, jobs, tasks, worker] = await Promise.all([
        readJSON(join(directory, 'catalog.json'), { version: 1, documents: {} }),
        readJSON(join(directory, 'jobs.json'), {}),
        readJSON(join(directory, '.admin-queue.json'), []),
        workerState(directory)
      ])
      return { config, catalog, jobs, tasks, worker }
    }
    requireConfig()
    const [catalog, jobs, tasks] = await Promise.all([readRemote('catalog.json'), readRemote('jobs.json', {}), runs()])
    return { config, catalog: catalog.value, jobs: jobs.value, tasks, worker: { online: true } }
  }
  async function enqueue(input) {
    input = validateTarget(input)
    if (config.mode === 'local') return enqueueLocal(directory, input)
    const active = (await runs()).find((run) =>
      ['queued', 'in_progress', 'waiting', 'pending', 'requested'].includes(run.state)
    )
    if (active) throw new AdminError(409, '已有后台任务执行或等待中，请完成后再提交。')
    await github('actions/workflows/translations.yml/dispatches', {
      method: 'POST',
      body: JSON.stringify({
        ref: env.TRANSLATION_GITHUB_BRANCH,
        inputs: { slug: input.slug, kind: input.kind, locale: input.locale }
      })
    })
    return {
      submitted: true,
      url: `https://github.com/${env.TRANSLATION_GITHUB_REPOSITORY}/actions/workflows/translations.yml`
    }
  }
  async function review(input) {
    if (config.mode === 'local') {
      try {
        return await withStoreLock(directory, async () => {
          const path = join(directory, 'catalog.json')
          const catalog = reviewRecord(await readJSON(path), input)
          await writeJSON(path, catalog)
          return { saved: true, deployment: 'local' }
        })
      } catch (error) {
        if (error.message?.startsWith('Translation worker already locked'))
          throw new AdminError(423, '翻译任务正在执行，请完成后再修订或锁定。')
        throw error
      }
    }
    const active = (await runs()).find((run) =>
      ['queued', 'in_progress', 'waiting', 'pending', 'requested'].includes(run.state)
    )
    if (active) throw new AdminError(423, '后台任务正在执行，请完成后再修订。')
    const { value, sha } = await readRemote('catalog.json')
    const catalog = reviewRecord(value, input)
    await github('contents/translations/catalog.json', {
      method: 'PUT',
      body: JSON.stringify({
        message: `Review translation ${input.kind}:${input.slug}:${input.locale}`,
        branch: env.TRANSLATION_GITHUB_BRANCH,
        sha,
        content: Buffer.from(JSON.stringify(catalog, null, 2) + '\n').toString('base64')
      })
    })
    let deployment = 'pending'
    if (env.VERCEL_DEPLOY_HOOK) {
      try {
        const url = new URL(env.VERCEL_DEPLOY_HOOK)
        if (url.protocol !== 'https:' || url.hostname !== 'api.vercel.com') throw new Error('Invalid deploy hook')
        const response = await fetcher(url, { method: 'POST', signal: AbortSignal.timeout(15000) })
        deployment = response.ok ? 'requested' : 'failed'
      } catch {
        deployment = 'failed'
      }
    }
    return { saved: true, deployment }
  }
  return { config, state, enqueue, review }
}
