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
import { WritingViews } from '@/components/writing-views'
import { getPost, getWritingSeo } from '@/lib/content'

async function fetchData(slug) {
  const { isEnabled } = await draftMode()
  const data = await getPost(slug, isEnabled)
  if (!data) notFound()

  return {
    data
  }
}

export default async function WritingSlug({ params }) {
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
    '@type': 'BlogPosting',
    headline: seoTitle,
    description: seoDescription,
    datePublished,
    dateModified,
    author: {
      '@type': 'Person',
      name: SITE.name
    },
    url: `${SITE.url}${localePath(`/writing/${slug}`, await getLocale())}`,
    inLanguage: data.contentLocale || 'zh-CN'
  }

  return (
    <>
      <ScrollArea className="flex flex-col bg-white dark:bg-zinc-950" hasScrollTitle>
        <FloatingHeader scrollTitle={title} goBackLink="/writing" />
        <div className="content-wrapper">
          <article className="content" lang={data.contentLocale}>
            <PageTitle
              title={title}
              subtitle={
                <div className="flex flex-wrap items-center gap-3 text-gray-400 dark:text-zinc-400">
                  <time dateTime={postDate}>
                    <LocalizedDate date={postDate} />
                  </time>
                  <div className="lg:hidden">
                    <WritingViews slug={slug} />
                  </div>
                </div>
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
  const seoData = await getWritingSeo(slug)
  if (!seoData) return null

  const {
    date,
    seo: { title, description },
    sys: { firstPublishedAt, publishedAt: updatedAt }
  } = seoData

  const siteUrl = `/writing/${slug}`
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
    alternates: await localizedMetadata(siteUrl, availableLocales('posts', slug)),
    ...(seoData.translationMissing && { robots: { index: false, follow: true } })
  }
}
