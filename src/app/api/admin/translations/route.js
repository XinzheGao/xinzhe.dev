import { failure, json, jsonBody, protect } from '@/lib/translation-admin/http'
import { createAdminBackend } from '@/lib/translation-admin/backend.mjs'
import { documentKey, segmentsOf, sourceHash } from '@/lib/translations/core.mjs'
import { AdminError, recordRevision, translationState, validateTarget } from '@/lib/translation-admin/model.mjs'
import { listSources, readSource } from '@/lib/translation-admin/source'

import { activeTask, nextCheckAt } from '@/lib/translation-admin/automation.mjs'

import { getAdminCategory, categorySources } from '@/lib/translation-admin/categories.mjs'

export const runtime = 'nodejs'
export async function GET(request) {
  try {
    await protect(request)
    const params = new URL(request.url).searchParams
    const category = params.has('category') ? getAdminCategory(params.get('category')) : undefined
    if (params.has('category') && !category) throw new AdminError(400, '分类无效。')
    const kind = category?.kind || params.get('kind') || 'posts'
    const slug = params.get('slug')
    const locale = params.get('locale') || 'en'
    const backend = createAdminBackend()
    if (!backend.config.configured)
      return json({ setupRequired: true, config: backend.config, documents: [], tasks: [] })
    const state = await backend.state()
    if (slug) {
      validateTarget({ kind, slug, locale })
      const source = await readSource(kind, slug)
      const record = state.catalog.documents[documentKey(kind, slug)]?.[locale]
      const translated = record?.published?.document
      const originalSegments = segmentsOf(source)
      const translatedSegments = translated ? segmentsOf(translated) : []
      const definitions = new Map(originalSegments.map((item) => [item.key, item]))
      const publishedKeys = new Set(translatedSegments.map((item) => item.key))
      return json({
        source: { title: source.title, sourceHash: sourceHash(source) },
        title: translated?.title,
        revision: recordRevision(record),
        locked: Boolean(record?.locked),
        sourceChanged: Boolean(record?.published && record.published.sourceHash !== sourceHash(source)),
        published: Boolean(translated),
        segments: [
          ...translatedSegments.map((segment) => ({
            key: segment.key,
            original: definitions.get(segment.key)?.texts || [],
            texts: segment.texts,
            locked: Boolean(record.segments[segment.key]?.locked)
          })),
          ...originalSegments
            .filter((segment) => !publishedKeys.has(segment.key))
            .map((segment) => ({ key: segment.key, original: segment.texts, texts: [], locked: false }))
        ]
      })
    }
    const sources = categorySources(category, await listSources(kind))
    const documents = sources.map((source) => ({
      slug: source.slug,
      date: source.date,
      title: source.title,
      updatedAt: source.sys.publishedAt,
      locales: Object.fromEntries(
        ['en', 'ja'].map((language) => {
          const record = state.catalog.documents[documentKey(kind, source.slug)]?.[language]
          const queued =
            state.config.mode === 'local'
              ? [...state.tasks]
                  .reverse()
                  .find((task) => task.kind === kind && task.slug === source.slug && task.locale === language)
              : null
          const job = queued ? queued : state.jobs[`${kind}:${source.slug}:${language}`]
          return [
            language,
            {
              state: translationState(source, record, job),
              locked: Boolean(record?.locked),
              segmentLocks: Object.values(record?.segments || {}).filter((segment) => segment.locked).length,
              published: Boolean(record?.published),
              generatedAt: record?.published?.generatedAt,
              error: job?.error || null,
              revision: recordRevision(record)
            }
          ]
        })
      )
    }))
    return json({
      config: state.config,
      automation: state.automation,
      lastCheck: state.lastCheck,
      nextCheckAt: nextCheckAt(state.automation, state.lastCheck),
      active: state.tasks.some(activeTask),
      worker: { online: Boolean(state.worker.online) },
      documents,
      tasks: [...state.tasks].sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || '')).slice(0, 15),
      errors: Object.entries(state.jobs)
        .flatMap(([key, job]) => (job.errors || []).map((error) => ({ key, ...error })))
        .sort((a, b) => b.at.localeCompare(a.at))
        .slice(0, 15)
    })
  } catch (error) {
    return failure(error)
  }
}
export async function POST(request) {
  try {
    await protect(request, true)
    const body = await jsonBody(request)
    const backend = createAdminBackend()
    if (body.action === 'check-all') return json(await backend.checkAll(), 202)
    if (body.action === 'automation') return json(await backend.saveAutomation(body))
    const input = { ...body, ...validateTarget(body) }
    // Never accept arbitrary IDs, commands or unpublished source documents from a client.
    const source = await readSource(input.kind, input.slug)
    if (input.action === 'edit' && input.sourceHash !== sourceHash(source))
      throw new AdminError(409, '中文原文刚刚发生变化，请重新加载对照后再保存。')
    if (input.action === 'translate') return json(await backend.enqueue(input), 202)
    const result = await backend.review(input)
    return json({ ...result, sourceHash: sourceHash(source) })
  } catch (error) {
    return failure(error)
  }
}
