/**
 * Renders a PNG as a character grid, so a screenshot can be read without eyes.
 *
 *   node scripts/look.mjs scripts/shots/1-solved.png [columns]
 *
 * Legend: W white  R red  O orange  Y yellow  G green  B blue  C cyan  P purple  · dark
 */
import { PNG } from 'pngjs'
import { readFileSync } from 'node:fs'

const path = process.argv[2]
const columns = Number(process.argv[3] ?? 78)
const png = PNG.sync.read(readFileSync(path))
const cellWidth = png.width / columns
const rows = Math.max(1, Math.round((png.height / png.width) * columns * 0.5))
const cellHeight = png.height / rows

function classify(r, g, b) {
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const lightness = (max + min) / 510
  const delta = max - min
  const saturation = delta === 0 ? 0 : delta / (255 - Math.abs(max + min - 255))
  if (lightness < 0.1) return '·'
  if (saturation < 0.22) return lightness > 0.55 ? 'W' : '·'
  let hue
  if (max === r) hue = ((g - b) / delta) % 6
  else if (max === g) hue = (b - r) / delta + 2
  else hue = (r - g) / delta + 4
  hue = (hue * 60 + 360) % 360
  if (hue < 16 || hue >= 345) return 'R'
  if (hue < 42) return 'O'
  if (hue < 72) return 'Y'
  if (hue < 165) return 'G'
  if (hue < 200) return 'C'
  if (hue < 265) return 'B'
  if (hue < 300) return 'P'
  return 'R'
}

console.log(`\n${path}  (${png.width}x${png.height})\n`)
const lines = []
for (let row = 0; row < rows; row++) {
  let line = ''
  for (let column = 0; column < columns; column++) {
    const tallies = new Map()
    const x0 = Math.floor(column * cellWidth)
    const x1 = Math.max(x0 + 1, Math.floor((column + 1) * cellWidth))
    const y0 = Math.floor(row * cellHeight)
    const y1 = Math.max(y0 + 1, Math.floor((row + 1) * cellHeight))
    for (let y = y0; y < y1; y += 2) {
      for (let x = x0; x < x1; x += 2) {
        const i = (png.width * y + x) << 2
        const key = classify(png.data[i], png.data[i + 1], png.data[i + 2])
        tallies.set(key, (tallies.get(key) ?? 0) + 1)
      }
    }
    let best = '·'
    let bestCount = 0
    for (const [key, count] of tallies) {
      if (count > bestCount) {
        best = key
        bestCount = count
      }
    }
    line += best
  }
  lines.push(line)
}
console.log(lines.join('\n'))
console.log('\nlegend: W white · R red · O orange · Y yellow · G green · C cyan · B blue · P purple · · dark\n')
