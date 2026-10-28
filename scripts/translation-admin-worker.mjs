import { spawn } from 'node:child_process'
import { mkdir, rm } from 'node:fs/promises'
import { resolve, join } from 'node:path'
import { readJSON, writeJSON } from '../src/lib/translations/store.mjs'
import { claimLocal, finishLocal, queueLock } from '../src/lib/translation-admin/local-queue.mjs'

const directory = resolve('translations')
const lock = join(directory, '.admin-runner-lock')
await mkdir(directory, { recursive: true })
try {
  await mkdir(lock)
} catch {
  throw new Error('Admin worker already locked; inspect translations/.admin-runner-lock before removing a stale lock')
}
let stopping = false
process.on('SIGTERM', () => {
  stopping = true
})
process.on('SIGINT', () => {
  stopping = true
})
const heartbeat = () =>
  writeJSON(join(directory, '.admin-worker.json'), { pid: process.pid, heartbeat: new Date().toISOString() })
await writeJSON(join(lock, 'owner.json'), { pid: process.pid })
let beating = false
const timer = setInterval(async () => {
  if (beating) return
  beating = true
  try {
    await heartbeat()
  } catch {
    stopping = true
  } finally {
    beating = false
  }
}, 4000)
try {
  await queueLock(directory, async () => {
    const path = join(directory, '.admin-queue.json')
    const tasks = await readJSON(path, [])
    for (const task of tasks)
      if (task.state === 'running') {
        task.state = 'queued'
        task.recovered = true
      }
    await writeJSON(path, tasks)
  })
  await heartbeat()
  console.log('Translation admin worker ready; waiting for persisted tasks.')
  while (!stopping) {
    const task = await claimLocal(directory)
    if (!task) {
      await new Promise((resolve) => setTimeout(resolve, 800))
      continue
    }
    console.log(`${task.id}: ${task.kind}:${task.slug}:${task.locale} running`)
    // Independent long-lived worker waits for the CLI; no detached work in an HTTP handler.
    const exitCode = await new Promise((resolve, reject) => {
      const child = spawn(
        process.execPath,
        ['scripts/translate.mjs', '--kind', task.kind, '--slug', task.slug, '--locale', task.locale],
        { cwd: process.cwd(), env: process.env, stdio: ['ignore', 'inherit', 'inherit'] }
      )
      child.once('error', reject)
      child.once('exit', (code) => resolve(code))
    }).catch(() => 1)
    await finishLocal(directory, task.id, exitCode === 0)
    console.log(`${task.id}: ${exitCode === 0 ? 'succeeded' : 'failed'}`)
  }
} finally {
  clearInterval(timer)
  await rm(join(directory, '.admin-worker.json'), { force: true })
  await rm(lock, { recursive: true, force: true })
}
