// Generates the PWA app icons from the Andiko logo mark (the rect-based "A"
// glyph used in src/components/layout/AndikoLogo.tsx) onto the brand
// background. Run once and commit the PNGs; re-run if the logo changes:
//
//   node scripts/generate-pwa-icons.mjs
//
import { mkdir } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const BRAND = '#0C647A'
const OUT_DIR = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'icons')

// Logo mark rectangles in a 12×12 unit box (mirrors AndikoLogo.tsx).
const MARK = [
  [0, 1, 3, 10],
  [0, 1, 12, 3],
  [9, 1, 3, 10],
  [2, 5, 8, 2.5],
]

function buildSvg(size, { logoScale, rounded }) {
  const markSize = size * logoScale
  const offset = (size - markSize) / 2
  const unit = markSize / 12
  const rects = MARK.map(
    ([x, y, w, h]) =>
      `<rect x="${offset + x * unit}" y="${offset + y * unit}" width="${w * unit}" height="${h * unit}" fill="#ffffff"/>`,
  ).join('')
  const radius = rounded ? size * 0.2 : 0
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <rect width="${size}" height="${size}" rx="${radius}" fill="${BRAND}"/>
  ${rects}
</svg>`
}

const ICONS = [
  { file: 'icon-192.png', size: 192, logoScale: 0.6, rounded: true },
  { file: 'icon-512.png', size: 512, logoScale: 0.6, rounded: true },
  // Maskable: logo inside the ~80% safe zone, full-bleed background.
  { file: 'icon-maskable-512.png', size: 512, logoScale: 0.46, rounded: false },
  // Apple touch icon: opaque, square (iOS rounds it automatically).
  { file: 'apple-touch-icon.png', size: 180, logoScale: 0.6, rounded: false },
]

await mkdir(OUT_DIR, { recursive: true })

for (const { file, size, logoScale, rounded } of ICONS) {
  const svg = buildSvg(size, { logoScale, rounded })
  await sharp(Buffer.from(svg)).png().toFile(resolve(OUT_DIR, file))
  console.log(`generated public/icons/${file} (${size}×${size})`)
}
