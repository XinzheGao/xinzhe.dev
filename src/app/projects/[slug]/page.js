import { TranslationNotice } from '@/components/preferences'
import { availableLocales } from '@/lib/translations/reader'
import { localizedMetadata, getLocale } from '@/lib/locale-server'
import { localePath } from '@/lib/locale-routing.mjs'
import { LocalizedDate } from '@/components/preferences'
import { SITE } from '@/lib/site'
import { draftMode } from 'next/headers'
import { notFound } from 'next/navigation'

import { ScrollArea } from '@/components/scroll-area'
import { NotionContent } from '@/components/notion-content'
import { PageTitle } from '@/components/page-title'
import { FloatingHeader } from '@/components/floating-header'
import { getProject, getProjectSeo, getAllProjects } from '@/lib/content'

export async function generateStaticParams() {
  const allPosts = await getAllProjects(false)
  return allPosts.map((post) => ({ slug: post.slug }))
}

async function fetchData(slug) {
  const { isEnabled } = await draftMode()
  const data = await getProject(slug, isEnabled)
  if (!data) notFound()

  return {
    data
  }
}

export default async function ProjectSlug({ params }) {
  const { slug } = await params
  const { data } = await fetchData(slug)

  const {
    title,
    date,
    seo: { title: seoTitle, description: seoDescription },
    content,
    sys: { firstPublishedAt, publishedAt: updatedAt }
  } = data

  const postDate = date || firstPublishedAt

  const datePublished = new Date(postDate).toISOString()
  const dateModified = new Date(updatedAt).toISOString()

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'CreativeWork',
    headline: seoTitle,
    description: seoDescription,
    datePublished,
    dateModified,
    author: {
      '@type': 'Person',
      name: SITE.name
    },
    url: `${SITE.url}${localePath(`/projects/${slug}`, await getLocale())}`,
    inLanguage: data.contentLocale || 'zh-CN'
  }

  return (
    <>
      <ScrollArea className="flex flex-col bg-white dark:bg-zinc-950" hasScrollTitle>
        <FloatingHeader scrollTitle={title} goBackLink="/projects" />
        <div className="content-wrapper">
          <article className="content" lang={data.contentLocale}>
            <PageTitle
              title={title}
              subtitle={
                <time dateTime={postDate} className="text-gray-400 dark:text-zinc-400">
                  <LocalizedDate date={postDate} />
                </time>
              }
              className="mb-6 flex flex-col gap-3"
            />
            <TranslationNotice missing={data?.translationMissing} />
            <NotionContent content={content} />
          </article>
        </div>
      </ScrollArea>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd, null, 2).replace(/</g, '\\u003c') }}
      />
    </>
  )
}

export async function generateMetadata({ params }) {
  const { slug } = await params
  const seoData = await getProjectSeo(slug)
  if (!seoData) return null

  const {
    date,
    seo: { title, description },
    sys: { firstPublishedAt, publishedAt: updatedAt }
  } = seoData

  const siteUrl = `/projects/${slug}`
  const postDate = date || firstPublishedAt
  const publishedTime = new Date(postDate).toISOString()
  const modifiedTime = new Date(updatedAt).toISOString()

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: 'article',
      publishedTime,
      ...(updatedAt && {
        modifiedTime
      }),
      url: localePath(siteUrl, await getLocale())
    },
    alternates: await localizedMetadata(siteUrl, availableLocales('projects', slug)),
    ...(seoData.translationMissing && { robots: { index: false, follow: true } })
  }
}
