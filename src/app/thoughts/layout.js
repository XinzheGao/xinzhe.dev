import { Text } from '@/components/preferences'
import { Suspense } from 'react'

import { SideMenu } from '@/components/side-menu'
import { LoadingSpinner } from '@/components/loading-spinner'
import { WritingListLayout } from '@/components/writing/writing-list-layout'
import { getAllThoughts } from '@/lib/content'
import { getSortedPosts } from '@/lib/utils'

async function fetchData() {
  const allPosts = await getAllThoughts()
  return { allPosts }
}

export default async function ThoughtsLayout({ children }) {
  const { allPosts } = await fetchData()
  const sortedPosts = getSortedPosts(allPosts)

  return (
    <>
      <SideMenu title={<Text id="thoughts" />} href="/thoughts" isInner>
        <Suspense fallback={<LoadingSpinner />}>
          <WritingListLayout basePath="/thoughts" list={sortedPosts} />
        </Suspense>
      </SideMenu>
      <div className="flex-1 lg:bg-ruled">{children}</div>
    </>
  )
}
