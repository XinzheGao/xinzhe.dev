import 'server-only'
import { readFile } from 'node:fs/promises'
import path from 'node:path'

// Node's fetch does not read file: URLs. These local assets are traced into server builds.
const readFont = async (filename) => {
  const font = await readFile(path.join(process.cwd(), 'src/assets/fonts', filename))
  return font.buffer.slice(font.byteOffset, font.byteOffset + font.byteLength)
}

export const getMediumFont = () => readFont('SpaceGrotesk-Medium.ttf')
export const getBoldFont = () => readFont('SpaceGrotesk-SemiBold.ttf')
