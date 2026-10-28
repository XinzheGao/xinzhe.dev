import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { createSession, passwordMatches, verifySession, sameOrigin } from '../src/lib/translation-admin/security.mjs'
import { backendConfig, createAdminBackend } from '../src/lib/translation-admin/backend.mjs'
import { recordRevision, reviewRecord, translationState, validateTarget } from '../src/lib/translation-admin/model.mjs'
import { enqueueLocal, claimLocal, finishLocal } from '../src/lib/translation-admin/local-queue.mjs'
import { readJSON, writeJSON } from '../src/lib/translations/store.mjs'

const secret = 'test-only-strong-random-admin-secret-123456'
const makeCatalog = () => ({
  version: 1,
  documents: {
    'posts:sample': {
      en: {
        status: 'succeeded',
        locked: false,
        segments: {
          title: { hash: 'source-hash', texts: ['Original English title'], locked: false },
          description: { hash: 'pending-hash', texts: ['Unpublished checkpoint'], locked: false }
        },
        published: {
          sourceHash: 'hash',
          document: {
            title: 'Original English title',
            seo: { title: 'SEO', description: 'Published summary' },
            sys: { publishedAt: 'old' },
            content: { blocks: [] }
          }
        }
      }
    }
  }
})

test('admin session rejects wrong secrets, tampering, expiry, oversized input and rotation', () => {
  const now = Date.now()
  const session = createSession(secret, now)
  assert.ok(verifySession(session, secret, now))
  assert.equal(verifySession(session + 'x', secret, now), false)
  assert.equal(verifySession(session, secret + 'rotated', now), false)
  assert.equal(verifySession(session, secret, now + 8 * 60 * 60 * 1000), false)
  assert.equal(verifySession('a'.repeat(2000), secret, now), false)
  assert.equal(passwordMatches(secret, secret), true)
  assert.equal(passwordMatches('wrong', secret), false)
  assert.equal(passwordMatches('short', 'short'), false)
  assert.throws(() => createSession('short'))
})

test('mutations require an exact same-origin browser request', () => {
  const request = (origin) =>
    new Request('http://127.0.0.1:3000/api/admin/translations', {
      headers: { host: '127.0.0.1:3000', ...(origin && { origin }) }
    })
  assert.ok(sameOrigin(request('http://127.0.0.1:3000')))
  assert.equal(sameOrigin(request('https://evil.example')), false)
  assert.equal(sameOrigin(request()), false)
  assert.equal(sameOrigin(request('null')), false)
})

test('only supported content and language targets are accepted', () => {
  assert.deepEqual(validateTarget({ slug: 'sample', locale: 'ja' }), { kind: 'posts', slug: 'sample', locale: 'ja' })
  for (const input of [
    { kind: 'posts', slug: '../secret', locale: 'en' },
    { kind: 'files', slug: 'sample', locale: 'en' },
    { kind: 'posts', slug: 'sample', locale: 'zh-CN' }
  ])
    assert.throws(
      () => validateTarget(input),
      (error) => error.status === 400
    )
})

test('manual review locks edited text and never promotes unrelated unpublished checkpoints', () => {
  const catalog = makeCatalog()
  const record = catalog.documents['posts:sample'].en
  reviewRecord(catalog, {
    kind: 'posts',
    slug: 'sample',
    locale: 'en',
    revision: recordRevision(record),
    action: 'edit',
    segment: 'title',
    texts: ['Human edited title']
  })
  assert.equal(record.published.document.title, 'Human edited title')
  assert.equal(record.segments.title.locked, true)
  assert.equal(record.published.document.seo.description, 'Published summary')
  assert.throws(
    () =>
      reviewRecord(catalog, {
        kind: 'posts',
        slug: 'sample',
        locale: 'en',
        revision: 'stale',
        action: 'lock',
        locked: true
      }),
    (error) => error.status === 409
  )
  assert.throws(
    () =>
      reviewRecord(catalog, {
        kind: 'posts',
        slug: 'sample',
        locale: 'en',
        revision: recordRevision(record),
        action: 'edit',
        segment: 'title',
        texts: ['']
      }),
    (error) => error.status === 400
  )
  reviewRecord(catalog, {
    kind: 'posts',
    slug: 'sample',
    locale: 'en',
    revision: recordRevision(record),
    action: 'lock',
    locked: true
  })
  assert.ok(record.locked)
})

test('status distinguishes active, failed, missing, outdated and locked translations', () => {
  const source = { sys: { publishedAt: 'new' } }
  const record = makeCatalog().documents['posts:sample'].en
  assert.equal(translationState(source, record, { state: 'queued' }), 'queued')
  assert.equal(translationState(source, record, { state: 'failed' }), 'failed')
  assert.equal(translationState(source), 'missing')
  assert.equal(translationState(source, record), 'outdated')
  assert.equal(translationState(source, { ...record, locked: true }), 'locked')
})

test('local queue deduplicates concurrent submissions and persists completion', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'translation-admin-'))
  try {
    await assert.rejects(
      enqueueLocal(directory, { kind: 'posts', slug: 'sample', locale: 'en' }),
      (error) => error.status === 503
    )
    await writeJSON(join(directory, '.admin-worker.json'), { heartbeat: new Date().toISOString() })
    const input = { kind: 'posts', slug: 'sample', locale: 'en' }
    const results = await Promise.all([enqueueLocal(directory, input), enqueueLocal(directory, input)])
    assert.equal(results[0].task.id, results[1].task.id)
    assert.equal((await readJSON(join(directory, '.admin-queue.json'))).length, 1)
    const task = await claimLocal(directory)
    assert.equal(task.state, 'running')
    assert.equal(await claimLocal(directory), null)
    await finishLocal(directory, task.id, true)
    assert.equal((await readJSON(join(directory, '.admin-queue.json')))[0].state, 'succeeded')
  } finally {
    await rm(directory, { recursive: true, force: true })
  }
})

test('local storage is forbidden on Vercel and production defaults to GitHub', () => {
  assert.throws(
    () => backendConfig({ TRANSLATION_ADMIN_BACKEND: 'local', VERCEL: '1' }),
    (error) => error.status === 503
  )
  assert.deepEqual(backendConfig({ NODE_ENV: 'production' }), { mode: 'github', configured: false })
})

test('GitHub dispatch is awaited, carries only validated target fields and blocks an active run', async () => {
  const env = {
    TRANSLATION_ADMIN_BACKEND: 'github',
    TRANSLATION_GITHUB_TOKEN: 'test-token',
    TRANSLATION_GITHUB_REPOSITORY: 'owner/repo',
    TRANSLATION_GITHUB_BRANCH: 'main'
  }
  const calls = []
  const backend = createAdminBackend({
    env,
    fetcher: async (url, options) => {
      calls.push([url, options])
      return url.includes('/runs?') ? Response.json({ workflow_runs: [] }) : new Response(null, { status: 204 })
    }
  })
  assert.ok((await backend.enqueue({ kind: 'posts', slug: 'sample', locale: 'en' })).submitted)
  assert.deepEqual(JSON.parse(calls[1][1].body), {
    ref: 'main',
    inputs: { kind: 'posts', slug: 'sample', locale: 'en' }
  })
  const busy = createAdminBackend({
    env,
    fetcher: async () =>
      Response.json({
        workflow_runs: [{ id: 1, status: 'in_progress', html_url: 'https://github.com/owner/repo/actions/runs/1' }]
      })
  })
  await assert.rejects(busy.enqueue({ kind: 'posts', slug: 'sample', locale: 'en' }), (error) => error.status === 409)
})

test('remote review writes with the current GitHub SHA and surfaces conflicts without overwriting', async () => {
  const env = {
    TRANSLATION_ADMIN_BACKEND: 'github',
    TRANSLATION_GITHUB_TOKEN: 'test-token',
    TRANSLATION_GITHUB_REPOSITORY: 'owner/repo',
    TRANSLATION_GITHUB_BRANCH: 'main'
  }
  const catalog = makeCatalog()
  let write
  const backend = createAdminBackend({
    env,
    fetcher: async (url, options) => {
      if (url.includes('/runs?')) return Response.json({ workflow_runs: [] })
      if (options.method === 'PUT') {
        write = JSON.parse(options.body)
        return Response.json({ commit: { sha: 'new-sha' } })
      }
      return Response.json({
        sha: 'old-sha',
        encoding: 'base64',
        content: Buffer.from(JSON.stringify(catalog)).toString('base64')
      })
    }
  })
  const result = await backend.review({
    kind: 'posts',
    slug: 'sample',
    locale: 'en',
    revision: recordRevision(catalog.documents['posts:sample'].en),
    action: 'lock',
    locked: true
  })
  assert.equal(result.saved, true)
  assert.equal(result.deployment, 'pending')
  assert.equal(write.sha, 'old-sha')
  assert.equal(JSON.parse(Buffer.from(write.content, 'base64')).documents['posts:sample'].en.locked, true)
  const conflict = createAdminBackend({
    env,
    fetcher: async (url, options) =>
      options.method === 'PUT'
        ? new Response('', { status: 409 })
        : url.includes('/runs?')
          ? Response.json({ workflow_runs: [] })
          : Response.json({
              sha: 'old-sha',
              encoding: 'base64',
              content: Buffer.from(JSON.stringify(catalog)).toString('base64')
            })
  })
  await assert.rejects(
    conflict.review({
      kind: 'posts',
      slug: 'sample',
      locale: 'en',
      revision: recordRevision(catalog.documents['posts:sample'].en),
      action: 'lock',
      locked: true
    }),
    (error) => error.status === 409
  )
})
