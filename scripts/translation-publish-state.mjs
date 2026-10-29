import { execFileSync } from 'node:child_process'
import { readJSON } from '../src/lib/translations/store.mjs'
import { publishedState } from '../src/lib/translations/published-state.mjs'

const previous = JSON.parse(execFileSync('git', ['show', 'HEAD:translations/catalog.json'], { encoding: 'utf8' }))
const current = await readJSON('translations/catalog.json')
console.log(`published_changed=${publishedState(previous) !== publishedState(current)}`)
