import { parseGIF, decompressFrames, type ParsedFrame } from 'gifuct-js'

interface GifCacheEntry {
  frames: ParsedFrame[]
  /** Per-frame delay in milliseconds (gifuct-js already converts from GIF centiseconds). */
  delaysMs: number[]
  totalMs: number
  width: number
  height: number
  /** Fully composited frame bitmaps (disposal handled), ready to draw */
  composed: (ImageBitmap | null)[]
}

const cache = new Map<string, GifCacheEntry>()
const MAX_CACHED = 2

function frameDelayMs(frame: ParsedFrame): number {
  // gifuct-js: delay is already ms (`(gce.delay || 10) * 10`)
  const d = frame.delay
  if (!d || d < 0) return 100
  // Browsers treat very small delays as ~100ms
  return d < 20 ? 100 : d
}

async function loadGif(url: string): Promise<GifCacheEntry> {
  const existing = cache.get(url)
  if (existing) return existing

  const res = await fetch(url)
  const buf = await res.arrayBuffer()
  const gif = parseGIF(buf)
  const frames = decompressFrames(gif, true)
  const delaysMs = frames.map(frameDelayMs)
  const totalMs = delaysMs.reduce((s, d) => s + d, 0) || 1000
  const entry: GifCacheEntry = {
    frames,
    delaysMs,
    totalMs,
    width: gif.lsd.width,
    height: gif.lsd.height,
    composed: frames.map(() => null)
  }

  if (cache.size >= MAX_CACHED) {
    const first = cache.keys().next().value
    if (first) {
      const old = cache.get(first)
      old?.composed.forEach((b) => b?.close())
      cache.delete(first)
    }
  }
  cache.set(url, entry)
  return entry
}

/** Build composited full-frame bitmaps once (handles partial dirty-rect GIFs). */
async function ensureComposed(entry: GifCacheEntry): Promise<void> {
  if (entry.composed[0]) return

  const canvas = document.createElement('canvas')
  canvas.width = entry.width
  canvas.height = entry.height
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  if (!ctx) return

  let prevDisposal = 0
  let prevDims = { left: 0, top: 0, width: 0, height: 0 }
  let beforeDraw: ImageData | null = null

  for (let i = 0; i < entry.frames.length; i++) {
    const frame = entry.frames[i]
    const { left, top, width, height } = frame.dims

    if (i > 0) {
      if (prevDisposal === 2) {
        ctx.clearRect(prevDims.left, prevDims.top, prevDims.width, prevDims.height)
      } else if (prevDisposal === 3 && beforeDraw) {
        ctx.putImageData(beforeDraw, 0, 0)
      }
    } else {
      ctx.clearRect(0, 0, entry.width, entry.height)
    }

    beforeDraw = ctx.getImageData(0, 0, entry.width, entry.height)

    const imageData = new ImageData(new Uint8ClampedArray(frame.patch), width, height)
    ctx.putImageData(imageData, left, top)
    entry.composed[i] = await createImageBitmap(canvas)

    prevDisposal = frame.disposalType ?? 0
    prevDims = { left, top, width, height }
  }
}

function frameIndexAt(entry: GifCacheEntry, localMs: number): number {
  const t = ((localMs % entry.totalMs) + entry.totalMs) % entry.totalMs
  let acc = 0
  for (let i = 0; i < entry.frames.length; i++) {
    acc += entry.delaysMs[i]
    if (t < acc) return i
  }
  return entry.frames.length - 1
}

export async function drawGifFrame(
  ctx: CanvasRenderingContext2D,
  url: string,
  localMs: number,
  dx: number,
  dy: number,
  dw: number,
  dh: number
): Promise<void> {
  const entry = await loadGif(url)
  await ensureComposed(entry)
  const index = frameIndexAt(entry, localMs)
  const bmp = entry.composed[index]
  if (!bmp) return
  ctx.drawImage(bmp, 0, 0, entry.width, entry.height, dx, dy, dw, dh)
}

export function clearGifCache(): void {
  cache.forEach((entry) => {
    entry.composed.forEach((b: ImageBitmap | null) => b?.close())
  })
  cache.clear()
}
