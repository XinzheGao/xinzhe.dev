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
