import { join } from 'node:path'
import { readJSON, writeJSON, withStoreLock } from './store.mjs'
import { translateKind } from './runner.mjs'

export const SCAN_KINDS = ['posts', 'pages', 'projects', 'thoughts', 'journey']
export async function scanAll({
  directory,
  client,
  configured = true,
  runKind = translateKind,
  now = () => new Date().toISOString()
}) {
  return withStoreLock(directory, async () => {
    const path = join(directory, '.admin-check.json')
    const check = { status: 'running', startedAt: now(), error: null }
    await writeJSON(path, check)
    let success = true
    for (const kind of SCAN_KINDS) {
      try {
        if (!configured) throw new Error('Notion token not configured')
        if (!(await runKind({ directory, client, values: { kind, all: true } }))) success = false
      } catch {
        // Never persist raw source/provider errors or credentials.
        success = false
        console.error(`${kind}: scan failed; check Notion connectivity and translation configuration`)
      }
    }
    const jobs = await readJSON(join(directory, 'jobs.json'), {})
    check.status = success
      ? 'succeeded'
      : Object.values(jobs).some((job) => job.state === 'needs-review')
        ? 'needs-review'
        : 'failed'
    check.finishedAt = now()
    check.error = success ? null : '部分内容未完成，请查看最近错误或执行日志；已有译文已保留。'
    await writeJSON(path, check)
    return check
  })
}
