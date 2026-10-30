import 'server-only'
import { MarkdownRenderer } from '@/components/markdown-renderer'
import { journeyImageSource } from '@/lib/notion-images.mjs'

export const JourneyCard = ({ id, title, description, image, index, contentLocale }) => {
  const imageSrc = journeyImageSource({ id, image }, process.env.NOTION_API_TOKEN) || image?.url
  return (
    <div lang={contentLocale || 'zh-CN'} className="word-break-word flex min-w-0 flex-col">
      <span className="leading-6 font-semibold tracking-tight">{title}</span>
      {description && (
        <MarkdownRenderer className="mt-1 text-sm text-gray-600 dark:text-zinc-400">{description}</MarkdownRenderer>
      )}
      {image?.url && (
        <div className="mt-3 w-fit max-w-full overflow-hidden rounded-xl">
          <img
            src={imageSrc}
            alt={image.title || image.description || title}
            width={image.width}
            height={image.height}
            loading={index < 1 ? 'eager' : 'lazy'}
            className="max-h-[26rem] w-auto max-w-full animate-reveal object-contain"
          />
        </div>
      )}
    </div>
  )
}
