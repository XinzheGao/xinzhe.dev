// Match the public navigation while retaining the existing pages storage keys.
export const ADMIN_CATEGORIES = [
  { id: 'home', label: '首页', kind: 'pages', slug: 'home' },
  { id: 'posts', label: '文章', kind: 'posts' },
  { id: 'projects', label: '作品', kind: 'projects' },
  { id: 'thoughts', label: '随想', kind: 'thoughts' },
  { id: 'journey', label: '旅程', kind: 'journey' },
  { id: 'about', label: '关于', kind: 'pages', slug: 'about' }
]
export const getAdminCategory = (id) => ADMIN_CATEGORIES.find((category) => category.id === id)
export const categorySources = (category, sources) =>
  category?.slug ? sources.filter((source) => source.slug === category.slug) : sources
export function translationPreviewPath(kind, slug, locale) {
  if (kind === 'journey') return `/${locale}/journey`
  if (kind === 'pages') return `/${locale}${slug === 'home' ? '' : `/${slug}`}`
  return `/${locale}/${kind === 'posts' ? 'writing' : kind}/${slug}`
}
export const taskCategoryLabel = (task) =>
  task.scanAll
    ? '检查全部已发布内容'
    : ADMIN_CATEGORIES.find(
        (category) => category.kind === task.kind && (!category.slug || category.slug === task.slug)
      )?.label || '页面'
