import { ImageResponse } from 'next/og'

import { OpenGraphImage } from '@/components/og-image'
import { getPageSeo } from '@/lib/content'
import { getMediumFont, getBoldFont } from '@/lib/og-fonts'
import { sharedImage } from '@/app/shared-metadata'

export const runtime = 'nodejs'
export const alt = '关于'
export const size = {
  width: sharedImage.width,
  height: sharedImage.height
}
export const contentType = sharedImage.type

export default async function Image() {
  const { seo: { title, description, ogImageTitle, ogImageSubtitle } = {} } = (await getPageSeo('about')) ?? {}

  return new ImageResponse(
    <OpenGraphImage
      title={ogImageTitle || title}
      description={ogImageSubtitle || description}
      icon={
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="64"
          height="64"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <circle cx="12" cy="12" r="10" />
          <circle cx="12" cy="8" r="3" />
          <path d="M6 20v-2a6 6 0 0 1 12 0v2" />
        </svg>
      }
      url="about"
    />,
    {
      ...size,
      fonts: [
        {
          name: 'SF Pro',
          data: await getMediumFont(),
          style: 'normal',
          weight: 500
        },
        {
          name: 'SF Pro',
          data: await getBoldFont(),
          style: 'normal',
          weight: 600
        }
      ]
    }
  )
}
