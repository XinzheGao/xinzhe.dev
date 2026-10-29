import test from 'node:test'
import assert from 'node:assert/strict'
import { getBrowserTheme, requiresThemeReload } from '../src/lib/browser-theme.mjs'

test('manual themes give the same browser color even when the OS has the opposite appearance', () => {
  for (const [theme, color] of [
    ['light', '#ffffff'],
    ['dark', '#09090b']
  ]) {
    const viewport = getBrowserTheme(theme)
    assert.equal(viewport.colorScheme, theme)
    assert.ok(viewport.themeColor.every((entry) => entry.color === color))
  }
  assert.deepEqual(
    getBrowserTheme('system').themeColor.map((entry) => entry.color),
    ['#ffffff', '#09090b']
  )
})

test('theme reload covers iPhone and desktop-mode iPad without refreshing Mac or Android browsers', () => {
  assert.equal(
    requiresThemeReload({
      userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X) AppleWebKit/605.1.15 Safari/604.1'
    }),
    true
  )
  assert.equal(
    requiresThemeReload({
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15) AppleWebKit/605.1.15',
      platform: 'MacIntel',
      maxTouchPoints: 5
    }),
    true
  )
  assert.equal(requiresThemeReload({ platform: 'MacIntel', maxTouchPoints: 0 }), false)
  assert.equal(
    requiresThemeReload({
      userAgent: 'Mozilla/5.0 (Linux; Android 15) AppleWebKit/537.36 Chrome/130.0 Mobile Safari/537.36',
      maxTouchPoints: 5
    }),
    false
  )
})
