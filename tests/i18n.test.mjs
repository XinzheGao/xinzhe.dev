import test from 'node:test'
import assert from 'node:assert/strict'
import { LOCALES, messages, normalizeLocale, normalizeTheme, translate } from '../src/lib/i18n.mjs'

test('every supported language covers the same UI keys and interpolation values', () => {
  const keys = Object.keys(messages['zh-CN']).sort()
  for (const locale of Object.keys(LOCALES)) {
    assert.deepEqual(Object.keys(messages[locale]).sort(), keys)
    for (const key of keys) {
      assert.ok(messages[locale][key].trim())
      assert.deepEqual(messages[locale][key].match(/\{\w+\}/g), messages['zh-CN'][key].match(/\{\w+\}/g))
    }
  }
})

test('untrusted preference cookies use defaults and interpolation preserves supplied text', () => {
  assert.equal(normalizeLocale('fr'), 'zh-CN')
  assert.equal(normalizeLocale('constructor'), 'zh-CN')
  assert.equal(normalizeTheme('auto'), 'system')
  assert.equal(translate('ja', 'avatar', { name: 'Xinzhe' }), 'Xinzheのアバター')
  assert.equal(translate('en', 'views', { count: 42 }), '42 views')
})
