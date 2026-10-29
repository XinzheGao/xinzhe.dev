import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, rm, readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import {
  DEFAULT_AUTOMATION,
  checkDue,
  latestCheckArtifact,
  nextCheckAt,
  scheduleSlot,
  updateAutomation,
  validateAutomation
} from '../src/lib/translation-admin/automation.mjs'
import { createAdminBackend } from '../src/lib/translation-admin/backend.mjs'
import { claimLocal, finishLocal, enqueueLocal } from '../src/lib/translation-admin/local-queue.mjs'
import { readJSON, writeJSON } from '../src/lib/translations/store.mjs'
import { translateKind } from '../src/lib/translations/runner.mjs'
import { scanAll, SCAN_KINDS } from '../src/lib/translations/scan.mjs'
import { publishedState } from '../src/lib/translations/published-state.mjs'

const time = (value) => Date.parse(value)
const env = {
  TRANSLATION_ADMIN_BACKEND: 'github',
  TRANSLATION_GITHUB_TOKEN: 'test',
  TRANSLATION_GITHUB_REPOSITORY: 'owner/repo',
  TRANSLATION_GITHUB_BRANCH: 'main'
}
const encoded = (value) =>
  Response.json({
    sha: 'current-sha',
    encoding: 'base64',
    content: Buffer.from(JSON.stringify(value)).toString('base64')
  })

test('Shanghai hourly/daily/weekly slots survive midnight, Monday and delayed execution', () => {
  assert.equal(
    new Date(scheduleSlot('daily', time('2026-10-29T02:59:00+08:00'))).toISOString(),
    '2026-10-27T19:00:00.000Z'
  )
  assert.equal(
    new Date(scheduleSlot('daily', time('2026-10-29T04:15:00+08:00'))).toISOString(),
    '2026-10-28T19:00:00.000Z'
  )
  assert.equal(
    new Date(scheduleSlot('weekly', time('2026-11-02T02:59:00+08:00'))).toISOString(),
    '2026-10-25T19:00:00.000Z'
  )
  assert.equal(
    new Date(scheduleSlot('weekly', time('2026-11-02T03:15:00+08:00'))).toISOString(),
    '2026-11-01T19:00:00.000Z'
  )
  const settings = updateAutomation(DEFAULT_AUTOMATION, { enabled: true, frequency: 'daily' }, '2026-10-28T12:00:00Z')
  assert.ok(checkDue(settings, null, time('2026-10-28T12:01:00Z')))
  const check = { startedAt: '2026-10-28T12:01:00Z' }
  assert.equal(checkDue(settings, check, time('2026-10-28T18:59:00Z')), false)
  assert.ok(checkDue(settings, check, time('2026-10-28T20:20:00Z')))
  assert.equal(nextCheckAt(settings, check, time('2026-10-28T13:00:00Z')), '2026-10-28T19:00:00.000Z')
  assert.equal(checkDue(DEFAULT_AUTOMATION, null), false)
  assert.equal(nextCheckAt(DEFAULT_AUTOMATION, null), null)
  const hourly = { enabled: true, frequency: 'hourly' }
  assert.equal(checkDue(hourly, { startedAt: '2026-10-28T12:05:00Z' }, time('2026-10-28T12:59:00Z')), false)
  assert.ok(checkDue(hourly, { startedAt: '2026-10-28T12:05:00Z' }, time('2026-10-28T13:00:00Z')))
  assert.throws(() => validateAutomation({ enabled: 'true', frequency: 'daily' }))
  assert.throws(() => validateAutomation({ enabled: true, frequency: '../bad' }))
  assert.equal(updateAutomation(settings, { enabled: true, frequency: 'weekly' }).enabledAt, settings.enabledAt)
})

test('enabling locally queues an immediate full scan once; manual scan also works while disabled', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'translation-settings-'))
  try {
    await writeJSON(join(directory, '.admin-worker.json'), { heartbeat: new Date().toISOString() })
    const backend = createAdminBackend({ directory, env: { TRANSLATION_ADMIN_BACKEND: 'local' } })
    assert.equal((await backend.saveAutomation({ enabled: true, frequency: 'daily' })).immediate, true)
    assert.equal((await backend.saveAutomation({ enabled: true, frequency: 'weekly' })).immediate, false)
    const tasks = await readJSON(join(directory, '.admin-queue.json'))
    assert.equal(tasks.length, 1)
    assert.ok(tasks[0].scanAll)
    const duplicate = await backend.checkAll()
    assert.ok(duplicate.duplicate)
    await assert.rejects(
      enqueueLocal(directory, { kind: 'posts', slug: 'sample', locale: 'en' }),
      (error) => error.status === 409
    )
    const claimed = await claimLocal(directory)
    await finishLocal(directory, claimed.id, true)
    await backend.saveAutomation({ enabled: false, frequency: 'weekly' })
    assert.ok((await backend.checkAll()).task.scanAll)
    const state = await backend.state()
    assert.equal(state.automation.enabled, false)
    assert.equal(state.tasks.filter((task) => task.state === 'queued').length, 1)
  } finally {
    await rm(directory, { recursive: true, force: true })
  }
})

test('remote settings use SHA and enabling dispatches scan_all without changing model keys', async () => {
  const calls = []
  const backend = createAdminBackend({
    env,
    fetcher: async (url, options) => {
      calls.push([url, options])
      if (url.includes('/runs?')) return Response.json({ workflow_runs: [] })
      if (options.method === 'PUT') return Response.json({ commit: { sha: 'new' } })
      if (options.method === 'POST') return new Response(null, { status: 204 })
      return encoded(DEFAULT_AUTOMATION)
    }
  })
  assert.ok((await backend.saveAutomation({ enabled: true, frequency: 'daily', token: 'ignored' })).immediate)
  const put = JSON.parse(calls.find(([, options]) => options.method === 'PUT')[1].body)
  assert.equal(put.sha, 'current-sha')
  assert.equal(JSON.parse(Buffer.from(put.content, 'base64')).token, undefined)
  const dispatch = JSON.parse(calls.find(([, options]) => options.method === 'POST')[1].body)
  assert.deepEqual(dispatch, { ref: 'main', inputs: { scan_all: 'true' } })
  const busy = createAdminBackend({
    env,
    fetcher: async () => Response.json({ workflow_runs: [{ status: 'in_progress' }] })
  })
  await assert.rejects(busy.checkAll(), (error) => error.status === 409)
  const brokenDispatch = createAdminBackend({
    env,
    fetcher: async (url, options) => {
      if (url.includes('/runs?')) return Response.json({ workflow_runs: [] })
      if (options.method === 'PUT') return Response.json({})
      if (options.method === 'POST') return new Response('', { status: 403 })
      return encoded(DEFAULT_AUTOMATION)
    }
  })
  const partial = await brokenDispatch.saveAutomation({ enabled: true, frequency: 'daily' })
  assert.ok(partial.saved)
  assert.equal(partial.immediate, false)
  assert.ok(partial.warning)
})

test('check status comes from branch-scoped artifacts, including a failed check, with no timestamp commits', () => {
  const artifact = (status, startedAt, branch = 'main') => ({
    name: `translation-check-${status}-${time(startedAt)}`,
    created_at: startedAt,
    workflow_run: { id: 12, head_branch: branch }
  })
  const latest = latestCheckArtifact(
    [
      artifact('succeeded', '2026-10-28T12:00:00Z'),
      artifact('failed', '2026-10-29T12:00:00Z'),
      artifact('succeeded', '2026-10-30T12:00:00Z', 'preview'),
      { name: 'translation-checkpoints-123', workflow_run: { head_branch: 'main' } }
    ],
    'main',
    'owner/repo'
  )
  assert.equal(latest.status, 'failed')
  assert.equal(latest.startedAt, '2026-10-29T12:00:00.000Z')
  assert.match(latest.url, /runs\/12$/)
  assert.ok(latest.error)
})

test('whole scan translates missing content, makes zero model calls or file changes on repeat, and only retranslates changed slots', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'translation-scan-'))
  const rich = (text) => ({ type: 'text', text: { content: text }, plain_text: text, annotations: {} })
  let title = '中文标题'
  const blocks = [{ id: 'a', type: 'paragraph', paragraph: { rich_text: [rich('正文')] } }]
  const sources = () => [
    { id: '1', slug: 'sample', title, sys: { publishedAt: '2026-10-29' } },
    { id: '2', slug: 'another', title: '另一篇', sys: { publishedAt: '2026-10-29' } }
  ]
  const client = Object.fromEntries(
    SCAN_KINDS.map((kind) => [
      kind,
      async (_, slug) => (kind === 'posts' ? sources().filter((item) => !slug || item.slug === slug) : [])
    ])
  )
  client.blocks = async () => blocks
  let calls = []
  const runKind = (options) =>
    translateKind({
      ...options,
      translatorFactory:
        () =>
        async (texts, { locale, key }) => {
          calls.push([locale, key])
          return texts.map((text) => `${locale}:${text}`)
        }
    })
  try {
    assert.equal((await scanAll({ directory, client, runKind })).status, 'succeeded')
    assert.equal(calls.length, 8)
    const paths = ['catalog.json', 'jobs.json', 'verification.json']
    const before = await Promise.all(paths.map((path) => readFile(join(directory, path), 'utf8')))
    calls = []
    assert.equal((await scanAll({ directory, client, runKind })).status, 'succeeded')
    assert.deepEqual(calls, [])
    assert.deepEqual(await Promise.all(paths.map((path) => readFile(join(directory, path), 'utf8'))), before)
    title = '改过的标题'
    assert.equal((await scanAll({ directory, client, runKind })).status, 'succeeded')
    assert.deepEqual(calls, [
      ['en', 'title'],
      ['ja', 'title']
    ])
    const catalog = await readJSON(join(directory, 'catalog.json'))
    const published = publishedState(catalog)
    catalog.documents['posts:sample'].en.segments.title.texts = ['unfinished checkpoint']
    assert.equal(publishedState(catalog), published)
    catalog.documents['posts:sample'].en.published.document.title = 'new published text'
    assert.notEqual(publishedState(catalog), published)
    const locked = await readJSON(join(directory, 'catalog.json'))
    locked.documents['posts:sample'].en.locked = true
    await writeJSON(join(directory, 'catalog.json'), locked)
    title = '再次改变的标题'
    assert.equal((await scanAll({ directory, client, runKind })).status, 'needs-review')
    const needsReviewFiles = await Promise.all(paths.map((path) => readFile(join(directory, path), 'utf8')))
    calls = []
    assert.equal((await scanAll({ directory, client, runKind })).status, 'needs-review')
    assert.deepEqual(calls, [])
    assert.deepEqual(await Promise.all(paths.map((path) => readFile(join(directory, path), 'utf8'))), needsReviewFiles)
    const unlocked = await readJSON(join(directory, 'catalog.json'))
    unlocked.documents['posts:sample'].en.locked = false
    unlocked.documents['posts:sample'].en.reviewedAt = new Date().toISOString()
    await writeJSON(join(directory, 'catalog.json'), unlocked)
    assert.equal((await scanAll({ directory, client, runKind })).status, 'succeeded')
    assert.deepEqual(calls, [['en', 'title']])
  } finally {
    await rm(directory, { recursive: true, force: true })
  }
})

test('failed classification does not stop other kinds and preserves old published content', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'translation-scan-failure-'))
  const catalog = { documents: { 'posts:sample': { en: { published: { document: { title: 'Old' } } } } } }
  try {
    await writeJSON(join(directory, 'catalog.json'), catalog)
    const kinds = []
    const check = await scanAll({
      directory,
      client: {},
      runKind: async ({ values }) => {
        kinds.push(values.kind)
        if (values.kind === 'posts') throw new Error('sensitive error must not be persisted')
        return true
      }
    })
    assert.deepEqual(kinds, SCAN_KINDS)
    assert.equal(check.status, 'failed')
    assert.doesNotMatch(JSON.stringify(check), /sensitive/)
    assert.deepEqual(await readJSON(join(directory, 'catalog.json')), catalog)
    assert.equal((await scanAll({ directory, client: {}, configured: false })).status, 'failed')
  } finally {
    await rm(directory, { recursive: true, force: true })
  }
})
