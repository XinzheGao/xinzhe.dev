import { notFound } from 'next/navigation'
import { SITE } from '@/lib/site'
import { ImageResponse } from 'next/og'

import { OpenGraphImage } from '@/components/og-image'
import { getProjectSeo } from '@/lib/content'
import { getMediumFont, getBoldFont } from '@/lib/og-fonts'
import { sharedImage } from '@/app/shared-metadata'

export const runtime = 'nodejs'
export const alt = '作品'
export const size = {
  width: sharedImage.width,
  height: sharedImage.height
}
export const contentType = sharedImage.type

export default async function Image({ params }) {
  const { slug } = await params
  const seoData = await getProjectSeo(slug)
  if (!seoData) notFound()

  const {
    seo: { title, ogImageTitle, ogImageSubtitle }
  } = seoData

  return new ImageResponse(
    <OpenGraphImage
      title={ogImageTitle || title}
      description={ogImageSubtitle || `作者：${SITE.shortName}`}
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
