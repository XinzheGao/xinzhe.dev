import { Text } from '@/components/preferences'
import { Suspense } from 'react'

import { SideMenu } from '@/components/side-menu'
import { LoadingSpinner } from '@/components/loading-spinner'
import { WritingListLayout } from '@/components/writing/writing-list-layout'
import { getAllProjects } from '@/lib/content'
import { getSortedPosts } from '@/lib/utils'

async function fetchData() {
  const allPosts = await getAllProjects()
  return { allPosts }
}

export default async function ProjectsLayout({ children }) {
  const { allPosts } = await fetchData()
  const sortedPosts = getSortedPosts(allPosts)

  return (
    <>
      <SideMenu title={<Text id="projects" />} href="/projects" isInner>
        <Suspense fallback={<LoadingSpinner />}>
          <WritingListLayout basePath="/projects" list={sortedPosts} />
        </Suspense>
      </SideMenu>
      <div className="flex-1 lg:bg-grid">{children}</div>
    </>
  )
}
