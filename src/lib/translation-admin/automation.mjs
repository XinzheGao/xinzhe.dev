import { AdminError } from './model.mjs'

export const DEFAULT_AUTOMATION = { enabled: false, frequency: 'daily', enabledAt: null }
const hour = 3600000
const day = 24 * hour
const offset = 8 * hour

export function validateAutomation(input) {
  if (typeof input.enabled !== 'boolean' || !['hourly', 'daily', 'weekly'].includes(input.frequency))
    throw new AdminError(400, '请选择自动翻译开关及有效的检查频率。')
  return { enabled: input.enabled, frequency: input.frequency }
}
export function updateAutomation(previous, input, now = new Date().toISOString()) {
  const settings = validateAutomation(input)
  return {
    ...settings,
    enabledAt: settings.enabled && !previous.enabled ? now : previous.enabledAt || null,
    updatedAt: now
  }
}
// Slots use Shanghai wall-clock time. A delayed runner catches the latest missed slot once.
export function scheduleSlot(frequency, now = Date.now()) {
  if (frequency === 'hourly') return Math.floor(now / hour) * hour
  const local = new Date(now + offset)
  let slot = Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate(), 3) - offset
  if (frequency === 'weekly') slot -= ((local.getUTCDay() + 6) % 7) * day
  if (slot > now) slot -= frequency === 'weekly' ? 7 * day : day
  return slot
}
export function checkDue(settings, lastCheck, now = Date.now()) {
  if (!settings.enabled) return false
  const last = Date.parse(lastCheck?.startedAt || '')
  return (
    !Number.isFinite(last) ||
    last < Math.max(Date.parse(settings.enabledAt || '') || 0, scheduleSlot(settings.frequency, now))
  )
}
export function nextCheckAt(settings, lastCheck, now = Date.now()) {
  if (!settings.enabled) return null
  if (checkDue(settings, lastCheck, now)) return new Date(now).toISOString()
  const period = settings.frequency === 'weekly' ? 7 * day : settings.frequency === 'daily' ? day : hour
  return new Date(scheduleSlot(settings.frequency, now) + period).toISOString()
}
// Artifact metadata is enough to retain check history without a timestamp-only Git commit.
export function latestCheckArtifact(artifacts, branch, repository) {
  return (
    artifacts
      .filter(
        (item) =>
          item.workflow_run?.head_branch === branch &&
          /^translation-check-(succeeded|failed|needs-review)-\d+$/.test(item.name)
      )
      .map((item) => {
        const [, status, timestamp] = item.name.match(/^translation-check-(succeeded|failed|needs-review)-(\d+)$/)
        return {
          status,
          startedAt: new Date(Number(timestamp)).toISOString(),
          finishedAt: item.created_at,
          url: `https://github.com/${repository}/actions/runs/${item.workflow_run.id}`,
          error: status === 'succeeded' ? null : '部分内容未完成，请查看最近错误或执行日志；已有译文已保留。'
        }
      })
      .sort((a, b) => b.startedAt.localeCompare(a.startedAt))[0] || null
  )
}
export const activeTask = (task) =>
  ['queued', 'running', 'in_progress', 'waiting', 'pending', 'requested'].includes(task.state)
