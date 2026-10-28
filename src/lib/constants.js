import { SITE } from '@/lib/site'
import { NAVIGATION } from './navigation.mjs'
import { GithubIcon } from '@/components/github-icon'

import { HomeIcon, BookOpenIcon, LayoutGridIcon, FeatherIcon, CompassIcon, UserCircle2Icon } from 'lucide-react'

export const PROFILES = {
  github: {
    title: 'GitHub',
    url: SITE.github,
    icon: <GithubIcon size={16} />
  }
}

const NAVIGATION_ICONS = {
  home: HomeIcon,
  writing: BookOpenIcon,
  projects: LayoutGridIcon,
  thoughts: FeatherIcon,
  journey: CompassIcon,
  about: UserCircle2Icon
}

export const LINKS = NAVIGATION.map(({ href, label, slug }) => {
  const Icon = NAVIGATION_ICONS[slug]
  return { href, label, slug, icon: <Icon size={16} /> }
})

export const SCROLL_AREA_ID = 'scroll-area'
export const MOBILE_SCROLL_THRESHOLD = 20
export const SUPABASE_TABLE_NAME = 'pages'
