import { Text as UIMessage, CompletionCheckbox } from '@/components/preferences'
import { Fragment } from 'react'
import { Link } from '@/components/link'
import { CodeBlock } from '@/components/code-block'

// Only web/mail links may come from author-controlled rich text or embeds.
function safeUrl(value) {
  if (typeof value !== 'string') return undefined
  if (value.startsWith('/') && !value.startsWith('//')) return value
  try {
    const url = new URL(value)
    return ['https:', 'http:', 'mailto:'].includes(url.protocol) ? value : undefined
  } catch {
    return undefined
  }
}

function Text({ items = [] }) {
  return items.map((item, index) => {
    let content = item.plain_text ?? item.text?.content ?? item.equation?.expression ?? ''
    const marks = item.annotations || {}
    if (marks.code || item.type === 'equation') content = <code className="inline-code">{content}</code>
    if (marks.bold) content = <strong>{content}</strong>
    if (marks.italic) content = <em>{content}</em>
    if (marks.strikethrough) content = <s>{content}</s>
    if (marks.underline) content = <u>{content}</u>
    const href = safeUrl(item.href || item.text?.link?.url)
    if (href) content = <Link href={href}>{content}</Link>
    return <Fragment key={index}>{content}</Fragment>
  })
}

function Block({ block }) {
  const value = block[block.type] || {}
  const body = <Text items={value.rich_text} />
  const children = <Blocks blocks={block.children} />
  switch (block.type) {
    case 'paragraph':
      return <div className="notion-paragraph mb-4 whitespace-pre-wrap leading-slacker">{body}{children}</div>
    case 'heading_1':
    case 'heading_2':
    case 'heading_3': {
      const Heading = { heading_1: 'h2', heading_2: 'h2', heading_3: 'h3' }[block.type]
      return <Fragment><Heading id={`notion-${block.id}`} className="mb-2 mt-6"><a href={`#notion-${block.id}`}>{body}</a></Heading>{children}</Fragment>
    }
    case 'bulleted_list_item':
    case 'numbered_list_item':
      return <li className="whitespace-pre-wrap">{body}{children}</li>
    case 'quote':
      return <blockquote className="mb-4 border-l-2 border-gray-200 px-4 dark:border-zinc-800">{body}{children}</blockquote>
    case 'callout':
      return <aside className="mb-4 rounded-lg bg-gray-100 p-4 dark:bg-zinc-900">{value.icon?.emoji && <span className="mr-2">{value.icon.emoji}</span>}{body}{children}</aside>
    case 'code':
      return <div className="mb-6"><CodeBlock title={value.language} code={(value.rich_text || []).map((item) => item.plain_text ?? item.text?.content ?? '').join('')} />{value.caption?.length > 0 && <div className="mt-2 text-sm text-gray-500"><Text items={value.caption} /></div>}</div>
    case 'divider':
      return <hr className="my-8" />
    case 'image': {
      const src = safeUrl(value.file?.url || value.external?.url)
      const caption = (value.caption || []).map((item) => item.plain_text ?? item.text?.content ?? '').join('')
      return src ? <figure className="mb-6"><img src={src} alt={caption} loading="lazy" className="h-auto w-full rounded-xl" />{caption && <figcaption className="mt-2 text-center text-xs text-gray-500">{caption}</figcaption>}</figure> : null
    }
    case 'to_do':
      return <div className="mb-2 flex items-start gap-2"><CompletionCheckbox checked={Boolean(value.checked)} /><div>{body}{children}</div></div>
    case 'toggle':
      return <details className="mb-4"><summary className="cursor-pointer">{body}</summary>{children}</details>
    case 'table':
      return <div className="mb-6 overflow-x-auto"><table className="w-full border-collapse"><tbody>{(block.children || []).map((row, index) => <tr key={row.id}>{(row.table_row?.cells || []).map((cell, column) => {
        const Cell = (value.has_column_header && index === 0) || (value.has_row_header && column === 0) ? 'th' : 'td'
        return <Cell key={column} className="border border-gray-200 px-3 py-2 text-left dark:border-zinc-800"><Text items={cell} /></Cell>
      })}</tr>)}</tbody></table></div>
    case 'column_list':
      return <div className="mb-4 grid gap-4 md:grid-flow-col md:auto-cols-fr">{children}</div>
    case 'column':
    case 'synced_block':
      return <div>{children}</div>
    case 'equation':
      return <pre className="mb-4 overflow-x-auto whitespace-pre-wrap">{value.expression}</pre>
    case 'bookmark':
    case 'link_preview':
    case 'embed':
    case 'video':
    case 'audio':
    case 'pdf':
    case 'file': {
      const href = safeUrl(value.url || value.file?.url || value.external?.url)
      return href ? <p className="mb-4"><Link href={href}>{value.name || (value.caption?.length ? <Text items={value.caption} /> : href)}</Link></p> : null
    }
    case 'table_of_contents':
      return null
    default:
      return <aside className="mb-4 rounded-sm border border-dashed p-3 text-sm text-gray-500"><UIMessage id="unsupported" values={{ type: block.type }} />{children}</aside>
  }
}

function Blocks({ blocks = [] }) {
  const result = []
  for (let index = 0; index < blocks.length; index++) {
    const block = blocks[index]
    if (['bulleted_list_item', 'numbered_list_item'].includes(block.type)) {
      const group = [block]
      while (blocks[index + 1]?.type === block.type) group.push(blocks[++index])
      const List = block.type === 'bulleted_list_item' ? 'ul' : 'ol'
      result.push(<List key={block.id} className={`mb-4 space-y-1 pl-6 ${List === 'ul' ? 'list-disc' : 'list-decimal'}`}>{group.map((item) => <Block key={item.id} block={item} />)}</List>)
    } else {
      result.push(<Block key={block.id} block={block} />)
    }
  }
  return result
}

export function NotionContent({ content }) {
  return <Blocks blocks={content?.blocks} />
}
