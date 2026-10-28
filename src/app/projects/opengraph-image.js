import { ImageResponse } from 'next/og'

import { OpenGraphImage } from '@/components/og-image'
import { getPageSeo } from '@/lib/content'
import { getMediumFont, getBoldFont } from '@/lib/og-fonts'
import { sharedImage } from '@/app/shared-metadata'

export const runtime = 'nodejs'
export const alt = '作品'
export const size = {
  width: sharedImage.width,
  height: sharedImage.height
}
export const contentType = sharedImage.type

export default async function Image() {
  const { seo: { title, description, ogImageTitle, ogImageSubtitle } = {} } = (await getPageSeo('projects')) ?? {}

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
          <path d="M12 20h9" />
          <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
        </svg>
      }
      url="projects"
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
