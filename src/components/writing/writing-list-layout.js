'use client'

import { usePreferences } from '@/components/preferences'

import { WritingLink } from '@/components/writing-link'
import { useViewData } from '@/hooks/useViewData'
import { cn } from '@/lib/utils'

export const WritingListLayout = ({ list, isMobile, basePath = '/writing' }) => {
  const { t } = usePreferences()
  const emptyKey =
    { '/writing': 'emptyWriting', '/thoughts': 'emptyThoughts', '/projects': 'emptyProjects' }[basePath] ||
    'emptyWriting'
  const viewData = useViewData(undefined, basePath === '/writing')

  if (list.length === 0) {
    return (
      <p className={cn('text-sm text-gray-500 dark:text-zinc-400', isMobile ? 'px-6 py-8' : 'p-3')}>{t(emptyKey)}</p>
    )
  }

  return (
    <div className={cn(!isMobile && 'flex flex-col gap-1 text-sm')}>
      {list.map((post) => {
        const viewCount = viewData?.find((item) => item.slug === post.slug)?.view_count
        return <WritingLink key={post.slug} post={post} viewCount={viewCount} isMobile={isMobile} basePath={basePath} />
      })}
    </div>
  )
}
