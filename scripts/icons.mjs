// Genera le icone PNG della PWA a partire dagli SVG in assets/ (eseguito prima della build).
import sharp from 'sharp'
import { copyFile } from 'node:fs/promises'

const jobs = [
  ['assets/icon.svg', 'public/icon-192.png', 192],
  ['assets/icon.svg', 'public/icon-512.png', 512],
  ['assets/icon-maskable.svg', 'public/icon-512-maskable.png', 512],
  ['assets/icon-full.svg', 'public/apple-touch-icon.png', 180],
]

for (const [src, dst, size] of jobs) {
  await sharp(src, { density: 300 }).resize(size, size).png().toFile(dst)
}
await copyFile('assets/icon.svg', 'public/favicon.svg')
console.log('Icone generate')
