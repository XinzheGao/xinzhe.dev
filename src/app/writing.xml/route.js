import { SITE } from '@/lib/site'
import { Feed } from 'feed'

import { getAllPosts } from '@/lib/content'
import { getSortedPosts } from '@/lib/utils'

export async function GET() {
  const allPosts = await getAllPosts(false)
  const sortedPosts = getSortedPosts(allPosts)
  const date = new Date()
  const siteURL = SITE.url
  const author = {
    name: SITE.name,
    link: SITE.url
  }

  const feed = new Feed({
    title: `${SITE.shortName} 的文章订阅`,
    description: '订阅最新文章与学习记录。',
    id: siteURL,
    link: `${siteURL}/writing`,
    language: 'zh-CN',
    copyright: `版权所有 ${date.getFullYear()}，${author.name}`,
    author,
    feedLinks: {
      rss2: `${siteURL}/writing.xml`
    }
  })

  sortedPosts.forEach((post) => {
    feed.addItem({
      id: post.slug,
      guid: post.slug,
      title: post.title,
      link: `${siteURL}/writing/${post.slug}`,
      date: new Date(post.date || post.sys.firstPublishedAt),
      updated: new Date(post.sys.publishedAt),
      author: [author],
      contributor: [author]
    })
  })

  return new Response(feed.rss2(), {
    headers: {
      'Content-Type': 'application/rss+xml; charset=utf-8',
      'Cache-Control': 'public, max-age=60, s-maxage=60'
    }
  })
}
