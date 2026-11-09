/**
 * End-to-end check against the running dev server.
 *
 * The 3D output is verified without eyes on it: screenshot the WebGL canvas, classify
 * every pixel by hue, and assert that what is on screen matches what the cube state
 * should be — solved, scrambled, solved again.
 *
 * Two notes on the environment:
 *   - The container has no GPU, so Chromium rasterises WebGL on the CPU (SwiftShader)
 *     and is entirely fill-rate bound. Hence the small viewport, and hence
 *     post-processing is checked first and then switched off for the rest of the run.
 *   - Waits poll the store rather than sleeping, so a slow machine slows the test down
 *     rather than making it flaky.
 *
 *   node scripts/runtime-check.mjs [url]
 */
import { chromium } from 'playwright'
import { PNG } from 'pngjs'
import { writeFileSync } from 'node:fs'

const URL = process.argv[2] ?? 'http://localhost:5173/'
const SHOTS = 'scripts/shots'

let failures = 0
function check(name, ok, detail = '') {
  console.log(`  ${ok ? 'ok  ' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`)
  if (!ok) failures++
}

/* ---- colour classification ------------------------------------------------ */

function classify(r, g, b) {
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const lightness = (max + min) / 510
  const delta = max - min
  const saturation = delta === 0 ? 0 : delta / (255 - Math.abs(max + min - 255))
  if (saturation < 0.2 && lightness > 0.62) return 'white'
  if (lightness < 0.12 || saturation < 0.22) return 'dark'
  let hue
  if (max === r) hue = ((g - b) / delta) % 6
  else if (max === g) hue = (b - r) / delta + 2
  else hue = (r - g) / delta + 4
  hue = (hue * 60 + 360) % 360
  if (hue < 16 || hue >= 345) return 'red'
  if (hue < 42) return 'orange'
  if (hue < 72) return 'yellow'
  if (hue < 175) return 'green'
  if (hue < 265) return 'blue'
  return 'other'
}

const CHANNELS = ['white', 'red', 'orange', 'yellow', 'green', 'blue', 'dark']

function analyse(buffer) {
  const png = PNG.sync.read(buffer)
  const counts = Object.fromEntries([...CHANNELS, 'other'].map((k) => [k, 0]))
  let sampled = 0
  for (let y = 0; y < png.height; y += 2) {
    for (let x = 0; x < png.width; x += 2) {
      const i = (png.width * y + x) << 2
      counts[classify(png.data[i], png.data[i + 1], png.data[i + 2])]++
      sampled++
    }
  }
  const share = (key) => counts[key] / sampled
  return { share, signature: CHANNELS.map((k) => +share(k).toFixed(4)) }
}

const distance = (a, b) => a.reduce((sum, value, i) => sum + Math.abs(value - b[i]), 0)

/* ---- run ------------------------------------------------------------------ */

const browser = await chromium.launch({
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
})
const context = await browser.newContext({ viewport: { width: 900, height: 680 }, deviceScaleFactor: 1 })
await context.addInitScript(() => {
  // Quick turns, a fixed camera, no stored history.
  localStorage.setItem(
    'cubelab',
    JSON.stringify({ state: { turnSpeed: 70, autoRotate: false, effects: true, records: [] }, version: 0 }),
  )
  let frames = 0
  const tick = () => {
    frames++
    window.__frames = frames
    requestAnimationFrame(tick)
  }
  requestAnimationFrame(tick)
})

const page = await context.newPage()
page.setDefaultTimeout(120000)
const problems = []
page.on('console', (m) => {
  if (m.type() === 'error') problems.push(`console: ${m.text()}`)
})
page.on('pageerror', (e) => problems.push(`pageerror: ${e.message}`))

const store = () => page.evaluate(() => window.__cubelab.getState())
const waitForQueueToDrain = (label) =>
  page.waitForFunction(
    () => {
      const s = window.__cubelab.getState()
      return s.queue.length === 0 && s.phase !== 'scrambling'
    },
    { timeout: 180000, polling: 250 },
  ).then(() => page.waitForTimeout(300))

let viewport = { width: 900, height: 680 }

/**
 * Screenshots just the canvas. Software rasterising makes compositing racy, so this
 * waits for fresh frames, clamps the clip to the viewport, and retries if it catches
 * an empty or un-composited frame.
 */
async function shot(name) {
  await page.evaluate(
    () =>
      new Promise((resolve) => {
        let seen = 0
        const tick = () => (++seen >= 3 ? resolve() : requestAnimationFrame(tick))
        requestAnimationFrame(tick)
      }),
  )
  for (let attempt = 0; attempt < 4; attempt++) {
    const rect = await page.locator('canvas').boundingBox()
    const x = rect ? Math.max(0, Math.round(rect.x)) : 0
    const y = rect ? Math.max(0, Math.round(rect.y)) : 0
    const width = rect ? Math.min(Math.round(rect.width), viewport.width - x) : 0
    const height = rect ? Math.min(Math.round(rect.height), viewport.height - y) : 0
    if (width > 10 && height > 10) {
      const buffer = await page.screenshot({
        path: `${SHOTS}/${name}.png`,
        clip: { x, y, width, height },
        animations: 'disabled',
      })
      const result = analyse(buffer)
      if (result.share('dark') < 0.995) return buffer
    }
    await page.waitForTimeout(2000)
  }
  throw new Error(`could not capture a rendered frame for "${name}"`)
}

console.log(`\nLoading ${URL}`)
await page.goto(URL, { waitUntil: 'load' })
await page.waitForSelector('canvas')
// The overlays sit on top of the canvas; hide them so screenshots are pure 3D output.
await page.addStyleTag({ content: '[data-stage-overlay]{display:none !important}' })
await page.waitForFunction(() => (window.__frames ?? 0) > 20, { timeout: 60000 })
await page.waitForTimeout(1500)

/* -- 1. The scene renders, with post-processing on -------------------------- */

console.log(`\n1. WebGL scene (bloom + environment on)`)
const box = await page.locator('canvas').boundingBox()
check('canvas has a real size', box.width > 300 && box.height > 250, `${Math.round(box.width)}x${Math.round(box.height)}`)

const gpu = await page.evaluate(() => {
  const gl = document.querySelector('canvas').getContext('webgl2')
  if (!gl) return null
  const info = gl.getExtension('WEBGL_debug_renderer_info')
  return info ? gl.getParameter(info.UNMASKED_RENDERER_WEBGL) : 'unknown'
})
check('WebGL context is live', gpu !== null, gpu ?? 'no context')

const solved = analyse(await shot('1-solved'))
console.log(`   solved canvas: ${JSON.stringify(solved.signature)} (${CHANNELS.join('/')})`)
check('the cube is drawn, the canvas is not empty', solved.share('dark') < 0.97, `${(solved.share('dark') * 100).toFixed(1)}% background`)
check('white face visible', solved.share('white') > 0.02, `${(solved.share('white') * 100).toFixed(1)}%`)
check('green face visible', solved.share('green') > 0.02, `${(solved.share('green') * 100).toFixed(1)}%`)
check('red face visible', solved.share('red') > 0.01, `${(solved.share('red') * 100).toFixed(1)}%`)

const framesBefore = await page.evaluate(() => window.__frames)
await page.waitForTimeout(3000)
const fps = ((await page.evaluate(() => window.__frames)) - framesBefore) / 3
console.log(`   ${fps.toFixed(1)} fps on a software rasteriser (a real GPU is orders of magnitude faster)`)

/* -- 2. Dragging turns a layer --------------------------------------------- */

await page.evaluate(() => window.__cubelab.getState().setEffects(false))
await page.waitForTimeout(2500)

console.log(`\n2. Drag to turn`)
const rect = await page.locator('canvas').boundingBox()
const cx = rect.x + rect.width / 2
const cy = rect.y + rect.height / 2
await page.mouse.move(cx, cy)
await page.mouse.down()
for (let i = 1; i <= 8; i++) await page.mouse.move(cx + i * 12, cy)
await page.mouse.up()
await page.waitForTimeout(2500)

const turns = Number(await page.getByTestId('turns').innerText())
check('a drag on the cube turned a layer', turns >= 1, `turn counter = ${turns}`)
const dragged = analyse(await shot('2-dragged'))
check('the cube looks different after the drag', distance(dragged.signature, solved.signature) > 0.01, `Δ = ${distance(dragged.signature, solved.signature).toFixed(4)}`)
check('still rendering with post-processing off', dragged.share('dark') < 0.97, `${(dragged.share('dark') * 100).toFixed(1)}% background`)

/* -- 3. Scramble ----------------------------------------------------------- */

console.log(`\n3. Random-state scramble`)
await page.getByRole('button', { name: 'New scramble' }).click()
await page.waitForFunction(
  () => /^([URFDLB]['2]?\s+){14,}[URFDLB]['2]?$/.test(
    (document.querySelector('[data-testid="scramble-text"]')?.textContent ?? '').trim(),
  ),
  { timeout: 60000 },
)
const scrambleMoves = (await page.getByTestId('scramble-text').innerText()).trim().split(/\s+/)
check('a scramble was generated', scrambleMoves.length >= 15, `${scrambleMoves.length} moves`)
check('scramble is valid notation', scrambleMoves.every((m) => /^[URFDLB]['2]?$/.test(m)), scrambleMoves.slice(0, 6).join(' '))

await waitForQueueToDrain('scramble')
const afterScramble = await store()
check('the whole scramble was applied', afterScramble.history.length === 0 && afterScramble.scramble.length > 0, `${afterScramble.scramble.length} moves applied`)
check('the cube is no longer solved', afterScramble.solved === false)
check('the clock is armed for the first turn', afterScramble.timerArmed === true)
check('status reads Scrambled', (await page.getByTestId('status').innerText()).includes('Scrambled'))

const scrambled = analyse(await shot('3-scrambled'))
console.log(`   scrambled canvas: ${JSON.stringify(scrambled.signature)}`)
check('the scrambled cube looks scrambled', distance(scrambled.signature, solved.signature) > 0.03, `Δ = ${distance(scrambled.signature, solved.signature).toFixed(4)}`)
check('no single colour dominates any more', scrambled.share('green') < solved.share('green') * 0.8, `green ${(scrambled.share('green') * 100).toFixed(1)}% vs ${(solved.share('green') * 100).toFixed(1)}%`)

/* -- 4. Solve -------------------------------------------------------------- */

console.log(`\n4. Kociemba solve`)
await page.getByRole('button', { name: /Solve this cube/ }).click()
await page.waitForFunction(
  () => (document.querySelector('[data-testid="solution-text"]')?.textContent ?? '').trim().length > 2,
  { timeout: 60000 },
)
const solutionMoves = (await page.getByTestId('solution-text').innerText()).trim().split(/\s+/)
check('a solution came back', solutionMoves.length > 0, `${solutionMoves.length} moves`)
check('solution is valid notation', solutionMoves.every((m) => /^[URFDLB]['2]?$/.test(m)), solutionMoves.slice(0, 8).join(' '))
check('solution is Kociemba-short', solutionMoves.length <= 24, `${solutionMoves.length} moves`)

await page.getByRole('button', { name: 'Play solution' }).click()
await waitForQueueToDrain('solution')
const afterSolve = await store()
check('playing the solution solves the cube', afterSolve.solved === true, `solved=${afterSolve.solved}`)
check('the timer recorded the solve', afterSolve.timerElapsed > 0 && afterSolve.records.length === 1, `${(afterSolve.timerElapsed / 1000).toFixed(2)}s, ${afterSolve.records.length} record(s)`)
check('status reads Solved', (await page.getByTestId('status').innerText()).includes('Solved'))

const resolved = analyse(await shot('4-resolved'))
console.log(`   resolved canvas: ${JSON.stringify(resolved.signature)}`)
check('the cube looks solved again', distance(resolved.signature, solved.signature) < 0.03, `Δ from solved = ${distance(resolved.signature, solved.signature).toFixed(4)}`)

/* -- 5. Enter-a-cube mode -------------------------------------------------- */

console.log(`\n5. Colour entry`)
await page.getByRole('button', { name: 'Enter', exact: true }).click()
await page.waitForSelector('[data-testid="cube-net"]')
check('the unfolded net renders all 54 stickers', (await page.locator('[data-testid="cube-net"] button').count()) === 54)

// Painting a sticker must change the cube's state and invalidate it.
const before = (await store()).facelets.join('')
await page.locator('[data-testid="cube-net"] button').first().click()
const after = (await store()).facelets
check('clicking a sticker repaints it', after.join('') !== before, `${before.slice(0, 9)} -> ${after.slice(0, 9)}`)
check('repainting makes the cube unsolvable (one colour over count)', (await store()).solved === false)

await page.getByRole('button', { name: /Solve this cube/ }).click()
await page.waitForTimeout(2500)
const notice = await page.locator('[data-testid="notice"]').count()
check('the solver explains why it cannot solve it', notice > 0, notice ? (await page.locator('[data-testid="notice"]').innerText()).trim().slice(0, 80) : 'no notice shown')

/* -- 6. Desktop layout ----------------------------------------------------- */

console.log(`\n6. Desktop layout`)
viewport = { width: 1440, height: 900 }
await page.setViewportSize(viewport)
await page.waitForTimeout(6000)
const canvasBox = await page.locator('canvas').boundingBox()
const panelBox = await page.locator('aside').boundingBox()
check('cube and panel sit side by side on wide screens', panelBox.x >= canvasBox.x + canvasBox.width - 2, `canvas ends ${Math.round(canvasBox.x + canvasBox.width)}, panel starts ${Math.round(panelBox.x)}`)
check('the panel is a sensible width', panelBox.width > 300 && panelBox.width < 460, `${Math.round(panelBox.width)}px`)
const desktop = analyse(await shot('5-desktop'))
check('the cube still renders at desktop size', desktop.share('dark') < 0.99 && desktop.share('green') > 0.005, JSON.stringify(desktop.signature))

/* -- 7. No runtime errors -------------------------------------------------- */

console.log(`\n7. Console`)
const noise = problems.filter((p) => !/favicon|React DevTools|Download the React/i.test(p))
check('no console errors or exceptions', noise.length === 0, noise.slice(0, 3).join(' | '))

writeFileSync(
  `${SHOTS}/report.json`,
  JSON.stringify({ solved: solved.signature, scrambled: scrambled.signature, resolved: resolved.signature, problems: noise }, null, 2),
)

await browser.close()
console.log(`\n${failures === 0 ? 'PASS' : 'FAIL'} — runtime check complete\n`)
process.exit(failures === 0 ? 0 : 1)
