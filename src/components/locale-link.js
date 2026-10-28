'use client'

import Link from 'next/link'
import { usePreferences } from './preferences'
import { localePath } from '@/lib/locale-routing.mjs'

export default function LocaleLink({ href, ...props }) {
  const { locale } = usePreferences()
  return <Link href={localePath(href, locale)} {...props} />
}
