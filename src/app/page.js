import { TranslationNotice } from '@/components/preferences'
import { localizedMetadata } from '@/lib/locale-server'
import { Text } from '@/components/preferences'
import { Suspense } from 'react'
import Link from '@/components/locale-link'

import { ScrollArea } from '@/components/scroll-area'
import { LoadingSpinner } from '@/components/loading-spinner'
import { WritingList } from '@/components/writing-list'
import { FloatingHeader } from '@/components/floating-header'
import { PageTitle } from '@/components/page-title'
import { Button } from '@/components/ui/button.jsx'
import { getAllPostsWithReadingTime, getPage, getPageSeo } from '@/lib/content'
import { getSortedPosts } from '@/lib/utils'
import { SITE } from '@/lib/site'
import { NotionContent } from '@/components/notion-content'

async function fetchData() {
  const [allPosts, home] = await Promise.all([getAllPostsWithReadingTime(), getPage('home')])
  return { allPosts, home }
}

export default async function Home() {
  const { allPosts, home } = await fetchData()
  const sortedPosts = getSortedPosts(allPosts)

  return (
    <ScrollArea className="flex flex-col" hasScrollTitle>
      <FloatingHeader scrollTitle={SITE.shortName} />
      <div className="content-wrapper">
        <div className="content">
          <PageTitle title={<Text id="home" />} className="lg:hidden" />
          <TranslationNotice missing={home?.translationMissing} />
          <div lang={home?.contentLocale}>
            <NotionContent content={home?.content} />
          </div>
          <Button asChild variant="link" className="inline px-0">
            <Link href="/writing">
              <h2 className="mt-8 mb-4">
                <Text id="writing" />
              </h2>
            </Link>
          </Button>
          <Suspense fallback={<LoadingSpinner />}>
            <WritingList items={sortedPosts} />
          </Suspense>
        </div>
      </div>
    </ScrollArea>
  )
}

export async function generateMetadata() {
  const { seo } = await getPageSeo('home')
  return { title: seo.title, description: seo.description, alternates: await localizedMetadata('/') }
}
