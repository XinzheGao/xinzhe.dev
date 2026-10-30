'use client'

import { usePreferences } from '@/components/preferences'

import Link from '@/components/locale-link'

import { cn } from '@/lib/utils'

export const WritingList = ({ items }) => {
  const { t, locale } = usePreferences()
  if (items.length === 0) {
    return <p className="py-6 text-sm text-gray-500 dark:text-zinc-400">{t('emptyWriting')}</p>
  }
  const itemsByYear = items.reduce((acc, item) => {
    const year = new Date(item.date || item.sys.firstPublishedAt).getFullYear()
    const yearArr = acc.find((item) => item[0] === year)
    if (!yearArr) {
      acc.push([year, [item]])
    } else {
      yearArr[1].push(item)
    }

    return acc
  }, [])

  return (
    <div className="home-writing-table text-sm">
      <div className="grid grid-cols-6 py-2 font-medium text-gray-500 lg:grid-cols-[64px_minmax(0,1fr)] lg:gap-x-4 lg:text-sm dark:text-zinc-400">
        <span className="col-span-1 hidden text-left lg:grid">{t('year')}</span>
        <span className="col-span-6 lg:col-span-1">
          <span className="grid grid-cols-[68px_minmax(0,1fr)] items-center gap-3 lg:grid-cols-[80px_minmax(0,1fr)] lg:gap-4">
            <span className="col-span-1 text-left">{t('date')}</span>
            <span className="col-span-1">{t('title')}</span>
          </span>
        </span>
      </div>

      <div>
        {itemsByYear.map((item) => {
          const [year, itemsArr] = item

          return (
            <ul className="list-none" key={year}>
              {itemsArr.map((item, itemIndex) => {
                const {
                  title,
                  slug,
                  date,
                  sys: { firstPublishedAt }
                } = item
                const dateObj = new Date(date || firstPublishedAt)
                const dateWithDayAndMonth = new Intl.DateTimeFormat(locale, {
                  month: 'short',
                  day: 'numeric',
                  timeZone: 'Asia/Shanghai'
                }).format(dateObj)
                const mobileDateParts = new Intl.DateTimeFormat('en', {
                  year: 'numeric',
                  month: '2-digit',
                  timeZone: 'Asia/Shanghai'
                }).formatToParts(dateObj)
                const mobileYear = mobileDateParts.find(({ type }) => type === 'year').value
                const mobileMonth = mobileDateParts.find(({ type }) => type === 'month').value

                return (
                  <li key={slug} className="grid grid-cols-6 p-0 lg:grid-cols-[64px_minmax(0,1fr)] lg:gap-x-4">
                    <span
                      className={cn(
                        'pointer-events-none col-span-1 hidden items-center tabular-nums lg:grid lg:text-sm lg:text-gray-500 lg:dark:text-zinc-400',
                        itemIndex === 0 && 'border-t border-gray-200 lg:-mr-4 dark:border-zinc-800'
                      )}
                    >
                      {itemIndex === 0 ? year : ''}
                    </span>
                    <Link
                      href={`/writing/${slug}`}
                      className="col-span-6 -mx-2 rounded-md px-2 transition-colors duration-150 hover:bg-[#F3F4F6] focus-visible:bg-[#F3F4F6] motion-reduce:transition-none lg:col-span-1 lg:hover:bg-gray-50 lg:focus-visible:bg-gray-50 dark:hover:bg-zinc-800/60 dark:focus-visible:bg-zinc-800/60 lg:dark:hover:bg-zinc-800/30 lg:dark:focus-visible:bg-zinc-800/30"
                    >
                      <span className="grid grid-cols-[68px_minmax(0,1fr)] items-center gap-3 border-t border-gray-200 py-4 lg:grid-cols-[80px_minmax(0,1fr)] lg:gap-4 lg:border-gray-200 lg:py-4 dark:border-zinc-900 lg:dark:border-zinc-800">
                        <span className="col-span-1 text-left text-xs text-gray-500 tabular-nums lg:text-sm lg:dark:text-zinc-400">
                          <time dateTime={date || firstPublishedAt} className="hidden lg:block">
                            {dateWithDayAndMonth}
                          </time>
                          <time
                            dateTime={date || firstPublishedAt}
                            className="inline-grid grid-cols-[4ch_1ch_2ch] lg:hidden"
                          >
                            <span className={itemIndex === 0 ? undefined : 'invisible'}>{mobileYear}</span>
                            <span className={itemIndex === 0 ? undefined : 'invisible'}>/</span>
                            <span>{mobileMonth}</span>
                          </time>
                        </span>
                        <span className="col-span-1 min-w-0 text-sm leading-relaxed font-normal lg:row-auto lg:text-sm lg:leading-5 lg:font-normal">
                          <span className="line-clamp-4">{title}</span>
                        </span>
                      </span>
                    </Link>
                  </li>
                )
              })}
            </ul>
          )
        })}
      </div>
    </div>
  )
}
