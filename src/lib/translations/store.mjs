import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'

export async function readJSON(path, fallback) {
  try {
    return JSON.parse(await readFile(path, 'utf8'))
  } catch (error) {
    if (error.code === 'ENOENT' && fallback !== undefined) return fallback
    throw error
  }
}

export async function writeJSON(path, value) {
  const temporary = `${path}.${process.pid}.tmp`
  await writeFile(temporary, JSON.stringify(value, null, 2) + '\n', { mode: 0o600 })
  await rename(temporary, path)
}

// Global lock also serializes local workers; Actions concurrency serializes repository workers.
// A killed local process leaves a lock intentionally: operators inspect it before removal.
export async function withStoreLock(directory, action) {
  await mkdir(directory, { recursive: true })
  const lock = join(directory, '.worker-lock')
  try {
    await mkdir(lock)
  } catch (error) {
    if (error.code === 'EEXIST')
      throw new Error(
        'Translation worker already locked; inspect translations/.worker-lock before removing a stale lock'
      )
    throw error
  }
  try {
    await writeJSON(join(lock, 'owner.json'), { pid: process.pid, startedAt: new Date().toISOString() })
    return await action()
  } finally {
    await rm(lock, { recursive: true, force: true })
  }
}

export function stripMediaURLs(document) {
  const result = structuredClone(document)
  if (result.image?.source === 'notion-file') delete result.image.url
  const walk = (blocks) => {
    for (const block of blocks || []) {
      const body = block[block.type]
      if (body?.file) body.file = {}
      walk(block.children)
    }
  }
  walk(result.content?.blocks)
  return result
}
