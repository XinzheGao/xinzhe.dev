import { NAVIGATION } from './navigation.mjs'

// 个人资料与导航结构；正文和描述由 Notion 管理。
export const SITE = {
  name: 'Xinzhe',
  shortName: 'Xinzhe',
  title: 'Xinzhe',
  role: '学生 · 开发者',
  url: (process.env.NEXT_PUBLIC_SITE_URL || 'https://xinzhe.dev').replace(/\/$/, ''),
  avatar: '/assets/avatar.png',
  github: 'https://github.com/XinzheGao'
}

export const PAGE_INFO = Object.fromEntries(NAVIGATION.map(({ slug, label }) => [slug, { title: label }]))
