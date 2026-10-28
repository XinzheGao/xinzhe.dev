import { hash, documentKey, materialize, segmentsOf, validateTexts } from '../translations/core.mjs'

export class AdminError extends Error {
  constructor(status, message) {
    super(message)
    this.status = status
  }
}
export function validateTarget({ kind = 'posts', slug, locale }) {
  try {
    documentKey(kind, slug)
  } catch {
    throw new AdminError(400, '文章类型或链接名无效。')
  }
  if (!['en', 'ja'].includes(locale)) throw new AdminError(400, '请选择英文或日文。')
  return { kind, slug, locale }
}
export const recordRevision = (record) => hash(record || null)
export function translationState(source, record, job) {
  if (['queued', 'running'].includes(job?.state)) return job.state
  if (record?.status === 'needs-review') return 'needs-review'
  if (job?.state === 'failed') return 'failed'
  if (!record?.published) return 'missing'
  if (record.locked) return 'locked'
  return source.sys.publishedAt !== record.published.document.sys.publishedAt ? 'outdated' : 'succeeded'
}
export function reviewRecord(catalog, input) {
  const { kind, slug, locale } = validateTarget(input)
  const record = catalog.documents[documentKey(kind, slug)]?.[locale]
  if (!record?.published) throw new AdminError(409, '请先生成完整译文。')
  if (recordRevision(record) !== input.revision)
    throw new AdminError(409, '译文已被其他任务或窗口更新，请刷新后再保存。')
  if (input.action === 'lock') {
    if (typeof input.locked !== 'boolean') throw new AdminError(400, '锁定状态无效。')
    record.locked = input.locked
  } else if (input.action === 'edit') {
    const definition = segmentsOf(record.published.document).find((item) => item.key === input.segment)
    const segment = record.segments[input.segment]
    if (!definition || !segment) throw new AdminError(400, '这个段落不在已发布译文中。')
    try {
      validateTexts(input.texts, definition.texts)
    } catch {
      throw new AdminError(400, '译文不能为空，且必须保留代码与链接地址。')
    }
    segment.texts = input.texts
    // A revision is locked by default; unlocking is an explicit operation.
    segment.locked = true
    record.published.document = materialize(record.published.document, { [input.segment]: segment })
  } else if (input.action === 'segment-lock') {
    const segment = record.segments[input.segment]
    if (!segment || typeof input.locked !== 'boolean') throw new AdminError(400, '段落或锁定状态无效。')
    segment.locked = input.locked
  } else throw new AdminError(400, '未知操作。')
  record.reviewedAt = new Date().toISOString()
  return catalog
}
