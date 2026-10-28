const cjkCharacter = /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}]/gu
const word = /[\p{L}\p{N}]+(?:['’_-][\p{L}\p{N}]+)*/gu

const richText = (items = []) =>
  items.map((item) => item.plain_text ?? item.text?.content ?? item.equation?.expression ?? '').join('')

/** Extract authored text from recursively loaded Notion blocks, excluding URLs and metadata. */
export function getNotionText(blocks = []) {
  return blocks
    .filter((block) => !block.archived && !block.in_trash)
    .map((block) => {
      const value = block[block.type] || {}
      return [
        richText(value.rich_text),
        richText(value.caption),
        ...(value.cells || []).map(richText),
        block.type === 'equation' ? value.expression || '' : '',
        getNotionText(block.children)
      ]
        .filter(Boolean)
        .join('\n')
    })
    .join('\n')
}

/** Estimated whole minutes: 300 CJK characters/minute plus 200 other words/minute by default. */
export function calculateReadingTime(content, { charactersPerMinute = 300, wordsPerMinute = 200 } = {}) {
  if (![charactersPerMinute, wordsPerMinute].every((rate) => Number.isFinite(rate) && rate > 0)) {
    throw new RangeError('Reading speeds must be positive finite numbers')
  }
  const text = typeof content === 'string' ? content : getNotionText(content)
  const characters = (text.match(cjkCharacter) || []).length
  // Separate CJK text before counting other words so mixed text does not merge into one token.
  const words = (text.replace(cjkCharacter, ' ').match(word) || []).length
  return Math.ceil(characters / charactersPerMinute + words / wordsPerMinute)
}
