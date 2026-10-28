import test from 'node:test'
import assert from 'node:assert/strict'
import { calculateReadingTime, getNotionText } from '../src/lib/reading-time.mjs'

const rich = (text) => [{ plain_text: text }]

test('estimates Chinese, English and mixed text with rounding up', () => {
  assert.equal(calculateReadingTime('中'.repeat(300)), 1)
  assert.equal(calculateReadingTime('中'.repeat(301)), 2)
  assert.equal(calculateReadingTime('word '.repeat(200)), 1)
  assert.equal(calculateReadingTime('word '.repeat(201)), 2)
  assert.equal(calculateReadingTime('中'.repeat(150) + 'word '.repeat(100)), 1)
  assert.equal(calculateReadingTime('中'.repeat(150) + 'word '.repeat(101)), 2)
})

test('empty and punctuation-only content does not invent a reading time', () => {
  for (const content of ['', ' \n，。！？…', [], undefined]) {
    assert.equal(calculateReadingTime(content), 0)
  }
  assert.equal(calculateReadingTime('短文'), 1)
})

test('counts Japanese and Korean characters and separates adjacent Latin words', () => {
  assert.equal(calculateReadingTime('あア한'.repeat(100)), 1)
  assert.equal(calculateReadingTime('中文hello世界world', { charactersPerMinute: 4, wordsPerMinute: 2 }), 2)
})

test('extracts nested prose, table cells, code, equations and captions once without metadata', () => {
  const blocks = [
    {
      type: 'paragraph',
      paragraph: { rich_text: rich('Intro') },
      children: [{ type: 'bulleted_list_item', bulleted_list_item: { rich_text: [{ text: { content: 'Nested' } }] } }]
    },
    {
      type: 'table',
      table: {},
      children: [{ type: 'table_row', table_row: { cells: [rich('Cell one'), rich('Cell two')] } }]
    },
    { type: 'code', code: { rich_text: rich('print hello'), caption: rich('Example') } },
    { type: 'equation', equation: { expression: 'x + y' } },
    { type: 'image', image: { external: { url: 'https://excluded.example' }, caption: rich('Photo') } },
    { type: 'paragraph', archived: true, paragraph: { rich_text: rich('Archived') } },
    { type: 'paragraph', in_trash: true, paragraph: { rich_text: rich('Trash') } }
  ]
  assert.equal(getNotionText(blocks), 'Intro\nNested\nCell one\nCell two\nprint hello\nExample\nx + y\nPhoto')
  assert.equal(calculateReadingTime(blocks, { wordsPerMinute: 5 }), 3)
})

test('supports custom speeds and rejects invalid rates', () => {
  assert.equal(calculateReadingTime('中'.repeat(300), { charactersPerMinute: 150 }), 2)
  for (const rate of [0, -1, Infinity, NaN]) {
    assert.throws(() => calculateReadingTime('test', { wordsPerMinute: rate }), RangeError)
  }
})
