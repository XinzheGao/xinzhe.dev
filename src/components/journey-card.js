import { MarkdownRenderer } from '@/components/markdown-renderer'

export const JourneyCard = ({ title, description, image, index, contentLocale }) => {
  return (
    <div lang={contentLocale || 'zh-CN'} className="word-break-word flex min-w-0 flex-col">
      <span className="leading-6 font-semibold tracking-tight">{title}</span>
      {description && (
        <MarkdownRenderer className="mt-1 text-sm text-gray-600 dark:text-zinc-400">{description}</MarkdownRenderer>
      )}
      {image?.url && (
        <div className="mt-3 w-fit max-w-full overflow-hidden rounded-xl">
          <img
            src={image.url}
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
