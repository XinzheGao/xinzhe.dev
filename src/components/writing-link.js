'use client'

import { usePreferences } from '@/components/preferences'

import Link from '@/components/locale-link'
import { usePathname } from 'next/navigation'
import { LazyMotion, domAnimation, m } from 'framer-motion'

import { splitLocale } from '@/lib/locale-routing.mjs'
import { cn, getDateTimeFormat, viewCountFormatter } from '@/lib/utils'

export const WritingLink = ({ post, viewCount, isMobile, basePath = '/writing' }) => {
  const { t, locale } = usePreferences()
  const pathname = usePathname()
  const isActive = splitLocale(pathname).pathname === `${basePath}/${post.slug}`
  const date = post.date || post.sys.firstPublishedAt
  const formattedDate = getDateTimeFormat(date, locale)
  const formattedViewCount = viewCount ? viewCountFormatter.format(viewCount) : null

  return (
    <LazyMotion features={domAnimation}>
      <Link
        key={post.slug}
        href={`${basePath}/${post.slug}`}
        aria-current={isActive ? 'page' : undefined}
        className={cn(
          'flex flex-col gap-1 transition-colors duration-300',
          isActive
            ? 'bg-[#ECEEF1] text-gray-900 dark:bg-zinc-800 dark:text-zinc-100'
            : 'hover:bg-[#F3F4F6] dark:hover:bg-zinc-800/60',
          isMobile
            ? 'magazine-entry mx-6 border-b border-gray-100 py-6 text-[17px] leading-relaxed dark:border-zinc-900'
            : 'rounded-lg p-2'
        )}
      >
        <span className={isActive ? 'font-semibold' : 'font-medium'}>{post.title}</span>
        <span
          className={cn(
            'text-slate-500 transition-colors duration-300 dark:text-zinc-400',
            isMobile && 'mt-1 text-xs tracking-wide'
          )}
        >
          <span>{formattedDate}</span>{' '}
          <span>
            {formattedViewCount ? (
              <m.span
                key={`${post.slug}-views-loaded`}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.3 }}
              >
                &middot; {t('views', { count: formattedViewCount })}
              </m.span>
            ) : (
              <m.span key={`${post.slug}-views-loading`} />
            )}
          </span>
        </span>
      </Link>
    </LazyMotion>
  )
}
