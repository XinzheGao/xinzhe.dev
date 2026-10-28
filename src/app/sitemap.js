import { languageAlternates, localePath } from '@/lib/locale-routing.mjs'
import { availableLocales } from '@/lib/translations/reader'
import { SITE } from '@/lib/site'
import { getAllPosts, getAllPageSlugs, getAllProjects, getAllThoughts } from '@/lib/content'
import { getSortedPosts } from '@/lib/utils'

export default async function sitemap() {
  const [allPosts, allPages, allProjects, allThoughts] = await Promise.all([
    getAllPosts(false),
    getAllPageSlugs(),
    getAllProjects(false),
    getAllThoughts(false)
  ])

  const sortedWritings = getSortedPosts(allPosts)
  const writings = sortedWritings.map((post) => {
    return {
      url: `${SITE.url}/writing/${post.slug}`,
      lastModified: post.sys.publishedAt,
      changeFrequency: 'yearly',
      priority: 0.5
    }
  })

  const pages = allPages.map((page) => {
    let changeFrequency = 'yearly'
    if (['writing', 'projects', 'thoughts', 'journey'].includes(page.slug)) changeFrequency = 'monthly'

    let lastModified = page.sys.publishedAt
    if (['writing', 'projects', 'thoughts', 'journey'].includes(page.slug)) lastModified = new Date()

    let priority = 0.5
    if (['writing', 'projects', 'thoughts', 'journey'].includes(page.slug)) priority = 0.8

    return {
      url: `${SITE.url}/${page.slug}`,
      lastModified,
      changeFrequency,
      priority
    }
  })

  const entries = [
    {
      url: SITE.url,
      lastModified: new Date(),
      changeFrequency: 'yearly',
      priority: 1
    },
    ...pages,
    ...writings,
    ...allProjects.map((project) => ({
      url: `${SITE.url}/projects/${project.slug}`,
      lastModified: project.sys.publishedAt,
      changeFrequency: 'yearly',
      priority: 0.5
    })),
    ...allThoughts.map((thought) => ({
      url: `${SITE.url}/thoughts/${thought.slug}`,
      lastModified: thought.sys.publishedAt,
      changeFrequency: 'yearly',
      priority: 0.5
    }))
  ]
  return entries.flatMap((entry) => {
    const path = entry.url.slice(SITE.url.length) || '/'
    const match = path.match(/^\/(writing|projects|thoughts)\/([^/]+)$/)
    const locales = match
      ? availableLocales(match[1] === 'writing' ? 'posts' : match[1], match[2])
      : ['zh-CN', 'en', 'ja']
    const languages = Object.fromEntries(
      Object.entries(languageAlternates(path, 'zh-CN', locales).languages).map(([locale, href]) => [
        locale,
        `${SITE.url}${href}`
      ])
    )
    return locales.map((locale) => ({
      ...entry,
      url: `${SITE.url}${localePath(path, locale)}`,
      alternates: { languages }
    }))
  })
}
