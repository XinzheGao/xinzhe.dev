import { Text } from '@/components/preferences'
import { Suspense } from 'react'

import { SideMenu } from '@/components/side-menu'
import { LoadingSpinner } from '@/components/loading-spinner'
import { WritingListLayout } from '@/components/writing/writing-list-layout'
import { getAllPosts } from '@/lib/content'
import { getSortedPosts } from '@/lib/utils'

async function fetchData() {
  const allPosts = await getAllPosts()
  return { allPosts }
}

export default async function WritingLayout({ children }) {
  const { allPosts } = await fetchData()
  const sortedPosts = getSortedPosts(allPosts)

  return (
    <>
      <SideMenu title={<Text id="writing" />} href="/writing" isInner>
        <Suspense fallback={<LoadingSpinner />}>
          <WritingListLayout list={sortedPosts} />
        </Suspense>
      </SideMenu>
      <div className="flex-1 lg:bg-dots-sparse">{children}</div>
    </>
  )
}
