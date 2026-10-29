import 'server-only'
import { localize } from './translations/reader'
import { getLocale } from './locale-server'
import { translate } from './i18n.mjs'
import { cache } from 'react'
import { draftMode } from 'next/headers'
import { unstable_cache } from 'next/cache'
import { createNotionClient } from './notion-client.mjs'
import { calculateReadingTime } from './reading-time.mjs'
import { NAVIGATION, getNavigationPage } from './navigation.mjs'
import { SITE } from '@/lib/site'

const client = createNotionClient({
  token: process.env.NOTION_API_TOKEN
})
const previewEnabled = async () => (await draftMode()).isEnabled
const readPosts = cache((preview, slug) => client.posts(preview, slug))
const readThoughts = cache((preview, slug) => client.thoughts(preview, slug))
const readProjects = cache((preview, slug) => client.projects(preview, slug))
const readPages = cache((preview, slug) => client.pages(preview, slug))
const readBlocks = cache((id, preview) => client.blocks(id, preview))

async function loadArticleContent(id) {
  // Read fresh blocks on a cache miss: an older fetch cache must not populate a new revision's cache.
  const blocks = await readBlocks(id, true)
  return { content: { blocks }, readingTime: calculateReadingTime(blocks) }
}

const readArticleContent = cache((id, revision, preview) =>
  preview
    ? loadArticleContent(id)
    : unstable_cache(() => loadArticleContent(id), ['article-content-v1', id, revision], {
        tags: ['notion-content'],
        revalidate: false
      })()
)

// Share the cached home query with page/metadata reads, including draft preview rules.
export async function getSiteDescription(preview) {
  const locale = await getLocale()
  preview ??= await previewEnabled()
  const [home] = await readPages(preview, 'home')
  return (await localize(home, 'pages', { preview, locale }))?.defaultDescription || ''
}

export async function getAllPosts(preview, locale) {
  locale ??= preview === false ? 'zh-CN' : await getLocale()
  preview ??= await previewEnabled()
  return Promise.all((await readPosts(preview)).map((item) => localize(item, 'posts', { preview, locale })))
}

export async function getAllPostsWithReadingTime(preview) {
  preview ??= await previewEnabled()
  const posts = await readPosts(preview)
  const result = []
  // Fill cold caches sequentially to avoid a burst of recursive Notion requests.
  for (const post of posts) {
    const { readingTime } = await readArticleContent(post.id, post.sys.publishedAt, preview)
    result.push({ ...(await localize(post, 'posts', { preview })), readingTime })
  }
  return result
}

export async function getAllPostSlugs() {
  return readPosts(false)
}

export async function getWritingSeo(slug, preview) {
  preview ??= await previewEnabled()
  const [post] = await readPosts(preview, slug)
  return post
    ? localize(
        { ...post, seo: { ...post.seo, description: post.seo.description || (await getSiteDescription(preview)) } },
        'posts',
        { preview }
      )
    : undefined
}

export async function getPost(slug, preview) {
  preview ??= await previewEnabled()
  const post = await getWritingSeo(slug, preview)
  if (!post) return undefined
  return localize({ ...post, ...(await readArticleContent(post.id, post.sys.publishedAt, preview)) }, 'posts', {
    preview
  })
}

export async function getPage(slug, preview) {
  preview ??= await previewEnabled()
  if (!getNavigationPage(slug)) return undefined
  const [page] = await readPages(preview, slug)
  if (!page) return undefined
  return localize({ ...page, content: { blocks: await readBlocks(page.id, preview) } }, 'pages', { preview })
}

export async function getPageSeo(slug, preview) {
  preview ??= await previewEnabled()
  const route = getNavigationPage(slug)
  const [page] = route ? await readPages(preview, slug) : []
  const description = page?.seo.description || (await getSiteDescription(preview))
  const localized = await localize(page, 'pages', { preview })
  const locale = await getLocale()
  return {
    ...localized,
    seo: {
      title:
        locale === 'zh-CN'
          ? page?.seo.title || route?.label || SITE.title
          : localized?.contentLocale === locale && localized?.seo?.title
            ? localized.seo.title
            : translate(locale, slug),
      description: localized?.seo.description || description
    }
  }
}

export async function getAllPageSlugs() {
  const pages = await readPages(false)
  return NAVIGATION.filter((page) => page.slug !== 'home').map(
    (route) =>
      pages.find((page) => page.slug === route.slug) || {
        slug: route.slug,
        sys: {}
      }
  )
}

export async function getAllLogbook(preview) {
  preview ??= await previewEnabled()
  return Promise.all((await client.journey(preview)).map((entry) => localize(entry, 'journey', { preview })))
}

export async function getAllProjects(preview, locale) {
  locale ??= preview === false ? 'zh-CN' : await getLocale()
  preview ??= await previewEnabled()
  return Promise.all((await readProjects(preview)).map((item) => localize(item, 'projects', { preview, locale })))
}

export async function getProjectSeo(slug, preview) {
  preview ??= await previewEnabled()
  const [project] = await readProjects(preview, slug)
  return project
    ? localize(
        {
          ...project,
          seo: { ...project.seo, description: project.seo.description || (await getSiteDescription(preview)) }
        },
        'projects',
        { preview }
      )
    : undefined
}

export async function getProject(slug, preview) {
  preview ??= await previewEnabled()
  const project = await getProjectSeo(slug, preview)
  if (!project) return undefined
  return localize({ ...project, content: { blocks: await readBlocks(project.id, preview) } }, 'projects', { preview })
}

export async function getAllThoughts(preview, locale) {
  locale ??= preview === false ? 'zh-CN' : await getLocale()
  preview ??= await previewEnabled()
  return Promise.all((await readThoughts(preview)).map((item) => localize(item, 'thoughts', { preview, locale })))
}

export async function getThoughtSeo(slug, preview) {
  preview ??= await previewEnabled()
  const [thought] = await readThoughts(preview, slug)
  return thought
    ? localize(
        {
          ...thought,
          seo: { ...thought.seo, description: thought.seo.description || (await getSiteDescription(preview)) }
        },
        'thoughts',
        { preview }
      )
    : undefined
}

export async function getThought(slug, preview) {
  preview ??= await previewEnabled()
  const thought = await getThoughtSeo(slug, preview)
  if (!thought) return undefined
  return localize({ ...thought, content: { blocks: await readBlocks(thought.id, preview) } }, 'thoughts', { preview })
}
