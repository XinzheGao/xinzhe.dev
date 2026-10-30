import { localizedMetadata, getLocale } from '@/lib/locale-server'
import { localePath } from '@/lib/locale-routing.mjs'
import { Text, LocalizedDate, TranslationNotice } from '@/components/preferences'
import { ScrollArea } from '@/components/scroll-area'
import { JourneyCard } from '@/components/journey-card'
import { FloatingHeader } from '@/components/floating-header'
import { PageTitle } from '@/components/page-title'
import { getAllLogbook, getPageSeo } from '@/lib/content'

async function fetchData() {
  const allLogbook = await getAllLogbook()

  const mappedLogbook = []
  allLogbook.map((log) => {
    const year = new Date(log.date).getFullYear()
    const existingYear = mappedLogbook.find((item) => item?.year === year)
    if (!existingYear) mappedLogbook.push({ year, logs: [log] })
    else existingYear.logs.push(log)
  })

  return { allLogbook: mappedLogbook }
}

export default async function Journey() {
  const { allLogbook } = await fetchData()

  return (
    <ScrollArea className="flex flex-col lg:bg-paper" hasScrollTitle>
      <FloatingHeader backHref="/" scrollTitle={<Text id="journey" />} />
      <div className="content-wrapper">
        <div className="content">
          <PageTitle title={<Text id="journey" />} />
          <TranslationNotice missing={allLogbook.some((group) => group.logs.some((log) => log.translationMissing))} />
          {allLogbook.length === 0 && (
            <p className="text-gray-500 dark:text-zinc-400">
              <Text id="emptyJourney" />
            </p>
          )}
          <div className="flex flex-col items-stretch gap-10 md:gap-12">
            {allLogbook.map((item, itemIndex) => (
              <section
                key={`data_${itemIndex}`}
                aria-labelledby={`journey-year-${item.year}`}
                className="grid min-w-0 gap-5 md:grid-cols-[4rem_minmax(0,1fr)] md:gap-8"
              >
                <h2 id={`journey-year-${item.year}`} className="leading-6 tabular-nums">
                  {item.year}
                </h2>
                <div className="min-w-0">
                  {item.logs.map((log, logIndex) => (
                    <div
                      key={`data_${itemIndex}_log_${logIndex}`}
                      className="relative min-w-0 pb-8 pl-7 last:pb-0 md:pl-8"
                    >
                      {logIndex !== item.logs.length - 1 && (
                        <div
                          aria-hidden="true"
                          className="pointer-events-none absolute top-4 bottom-0 left-[5px] w-px bg-gray-200 dark:bg-zinc-800"
                        />
                      )}
                      <span
                        aria-hidden="true"
                        className={`absolute top-1.5 left-0 h-[11px] w-[11px] rounded-full border-2 ${itemIndex === 0 && logIndex === 0 ? 'border-gray-900 bg-gray-900 ring-4 ring-gray-900/5 dark:border-zinc-100 dark:bg-zinc-100 dark:ring-white/10' : 'border-gray-300 bg-white dark:border-zinc-600 dark:bg-zinc-950'}`}
                      />
                      <div className="min-w-0">
                        <time
                          dateTime={log.date}
                          className="mb-1.5 block text-xs leading-6 text-gray-500 tabular-nums dark:text-zinc-400"
                        >
                          <LocalizedDate date={log.date} options={{ month: 'long', timeZone: 'UTC' }} />
                        </time>
                        <JourneyCard {...log} index={logIndex} />
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            ))}
          </div>
        </div>
      </div>
    </ScrollArea>
  )
}

export async function generateMetadata() {
  const seoData = await getPageSeo('journey')
  if (!seoData) return null

  const {
    seo: { title, description }
  } = seoData
  const siteUrl = '/journey'

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      url: localePath(siteUrl, await getLocale())
    },
    alternates: await localizedMetadata(siteUrl)
  }
}
