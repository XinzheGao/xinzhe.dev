import { normalizeTheme } from './i18n.mjs'

export const THEME_COLORS = { light: '#ffffff', dark: '#09090b' }

export function getBrowserTheme(preference) {
  const theme = normalizeTheme(preference)
  return {
    themeColor: ['light', 'dark'].map((systemTheme) => ({
      media: `(prefers-color-scheme: ${systemTheme})`,
      color: THEME_COLORS[theme === 'system' ? systemTheme : theme]
    })),
    colorScheme: theme === 'system' ? 'light dark' : theme
  }
}

// iPad can identify itself as a desktop Mac; touch support distinguishes it.
export function requiresThemeReload({ userAgent = '', platform = '', maxTouchPoints = 0 }) {
  return /iPad|iPhone|iPod/.test(userAgent) || (platform === 'MacIntel' && maxTouchPoints > 1)
}
