// Website navigation and supported Notion page slugs share this registry.
export const NAVIGATION = [
  { slug: 'home', href: '/', label: '首页', body: true },
  { slug: 'writing', href: '/writing', label: '文章' },
  { slug: 'projects', href: '/projects', label: '作品' },
  { slug: 'thoughts', href: '/thoughts', label: '随想' },
  { slug: 'journey', href: '/journey', label: '旅程' },
  { slug: 'about', href: '/about', label: '关于', body: true }
]

export const getNavigationPage = (slug) => NAVIGATION.find((page) => page.slug === slug)
