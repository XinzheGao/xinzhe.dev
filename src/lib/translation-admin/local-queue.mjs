import { mkdir, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { randomUUID } from 'node:crypto'
import { readJSON, writeJSON } from '../translations/store.mjs'
import { AdminError, validateTarget } from './model.mjs'

export async function queueLock(directory, action) {
  await mkdir(directory, { recursive: true })
  const path = join(directory, '.queue-lock')
  for (let attempt = 0; ; attempt++) {
    try {
      await mkdir(path)
      break
    } catch (error) {
      if (error.code !== 'EEXIST') throw error
      if (attempt >= 30) throw new AdminError(423, '队列正在更新，请稍后重试。')
      await new Promise((resolve) => setTimeout(resolve, 50))
    }
  }
  try {
    await writeFile(join(path, 'owner'), String(process.pid))
    return await action()
  } finally {
    await rm(path, { recursive: true, force: true })
  }
}
export async function workerState(directory) {
  const state = await readJSON(join(directory, '.admin-worker.json'), {})
  return { online: state.heartbeat && Date.now() - Date.parse(state.heartbeat) < 15000, ...state }
}
export async function enqueueLocal(directory, input) {
  const target = validateTarget(input)
  if (!(await workerState(directory)).online)
    throw new AdminError(503, '翻译 worker 未运行，请先执行 npm run translate:worker。')
  return queueLock(directory, async () => {
    const path = join(directory, '.admin-queue.json')
    const tasks = await readJSON(path, [])
    const duplicate = tasks.find(
      (task) =>
        ['queued', 'running'].includes(task.state) &&
        task.kind === target.kind &&
        task.slug === target.slug &&
        task.locale === target.locale
    )
    if (duplicate) return { task: duplicate, duplicate: true }
    const task = { ...target, id: randomUUID(), state: 'queued', createdAt: new Date().toISOString() }
    await writeJSON(path, [
      ...tasks.filter((item) => ['queued', 'running'].includes(item.state)),
      ...tasks.filter((item) => !['queued', 'running'].includes(item.state)).slice(-99),
      task
    ])
    return { task, duplicate: false }
  })
}
export async function claimLocal(directory) {
  return queueLock(directory, async () => {
    const path = join(directory, '.admin-queue.json')
    const tasks = await readJSON(path, [])
    const task = tasks.find((item) => item.state === 'queued')
    if (!task) return null
    task.state = 'running'
    task.startedAt = new Date().toISOString()
    await writeJSON(path, tasks)
    return task
  })
}
export async function finishLocal(directory, id, success) {
  await queueLock(directory, async () => {
    const path = join(directory, '.admin-queue.json')
    const tasks = await readJSON(path, [])
    const task = tasks.find((item) => item.id === id)
    if (task) {
      task.state = success ? 'succeeded' : 'failed'
      task.finishedAt = new Date().toISOString()
      task.error = success ? null : '执行失败，请查看下方任务日志；成功译文仍保留。'
    }
    await writeJSON(path, tasks)
  })
}
