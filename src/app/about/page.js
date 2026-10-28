import { TranslationNotice } from '@/components/preferences'
import { localePath } from '@/lib/locale-routing.mjs'
import { localizedMetadata, getLocale } from '@/lib/locale-server'
import { Text } from '@/components/preferences'
import { ScrollArea } from '@/components/scroll-area'
import { FloatingHeader } from '@/components/floating-header'
import { PageTitle } from '@/components/page-title'
import { NotionContent } from '@/components/notion-content'
import { getPage, getPageSeo } from '@/lib/content'

export default async function About() {
  const page = await getPage('about')

  return (
    <ScrollArea className="flex flex-col" hasScrollTitle>
      <FloatingHeader scrollTitle={<Text id="about" />} />
      <div className="content-wrapper">
        <div className="content">
          <PageTitle title={<Text id="about" />} />
          <TranslationNotice missing={page?.translationMissing} />
          <div lang={page?.contentLocale}>
            <NotionContent content={page?.content} />
          </div>
        </div>
      </div>
    </ScrollArea>
  )
}

export async function generateMetadata() {
  const { seo } = await getPageSeo('about')
  return {
    title: seo.title,
    description: seo.description,
    openGraph: { title: seo.title, description: seo.description, url: localePath('/about', await getLocale()) },
    alternates: await localizedMetadata('/about')
  }
}
