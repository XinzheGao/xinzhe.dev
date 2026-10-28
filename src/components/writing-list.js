'use client'

import { usePreferences } from '@/components/preferences'

import Link from '@/components/locale-link'

import { cn } from '@/lib/utils'

export const WritingList = ({ items }) => {
  const { t, locale } = usePreferences()
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
    <div className="text-sm">
      <div className="grid grid-cols-6 py-2 font-medium text-gray-500 dark:text-zinc-400">
        <span className="col-span-1 hidden text-left md:grid">{t('year')}</span>
        <span className="col-span-6 md:col-span-5">
          <span className="grid grid-cols-4 items-center md:grid-cols-8">
            <span className="col-span-1 text-left">{t('date')}</span>
            <span className="col-span-2 md:col-span-6">{t('title')}</span>
            <span className="col-span-1 text-right whitespace-nowrap">{t('readingTime')}</span>
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
                  readingTime,
                  sys: { firstPublishedAt }
                } = item
                const dateObj = new Date(date || firstPublishedAt)
                const dateWithDayAndMonth = new Intl.DateTimeFormat(locale, {
                  month: 'short',
                  day: 'numeric',
                  timeZone: 'Asia/Shanghai'
                }).format(dateObj)
                const dateWithMonthAndYear = new Intl.DateTimeFormat(locale, {
                  month: 'short',
                  year: 'numeric',
                  timeZone: 'Asia/Shanghai'
                }).format(dateObj)

                return (
                  <li key={slug} className="grid grid-cols-6 p-0">
                    <span
                      className={cn(
                        'pointer-events-none col-span-1 hidden items-center tabular-nums md:grid',
                        itemIndex === 0 && 'border-t border-gray-200 dark:border-zinc-800'
                      )}
                    >
                      {itemIndex === 0 ? year : ''}
                    </span>
                    <Link
                      href={`/writing/${slug}`}
                      className="col-span-6 -mx-2 rounded-md px-2 transition-colors duration-150 hover:bg-[#F3F4F6] focus-visible:bg-[#F3F4F6] motion-reduce:transition-none md:col-span-5 dark:hover:bg-zinc-800/60 dark:focus-visible:bg-zinc-800/60"
                    >
                      <span className="grid grid-cols-4 items-center gap-2 border-t border-gray-200 py-4 md:grid-cols-8 dark:border-zinc-800">
                        <span className="col-span-1 text-left tabular-nums">
                          <time dateTime={date} className="hidden md:block">
                            {dateWithDayAndMonth}
                          </time>
                          <time dateTime={date} className="md:hidden">
                            {dateWithMonthAndYear}
                          </time>
                        </span>
                        <span className="col-span-2 min-w-0 md:col-span-6">
                          <span className="line-clamp-4">{title}</span>
                        </span>
                        <span
                          className="col-span-1 text-right text-xs whitespace-nowrap text-gray-500 tabular-nums dark:text-zinc-400"
                          aria-label={readingTime > 0 ? t('readingMinutes', { count: readingTime }) : undefined}
                        >
                          {readingTime > 0 ? `${readingTime} min` : null}
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
