import { spawn } from 'child_process'
import { createWriteStream, existsSync } from 'fs'
import { mkdir, unlink } from 'fs/promises'
import { join } from 'path'
import { tmpdir } from 'os'
import ffmpegPath from 'ffmpeg-static'
import sharp from 'sharp'
import type { BrowserWindow } from 'electron'
import type { Asset, Clip, ExportProgress, Project, TrackId } from '../shared/types'
import { evaluateTransform, projectDurationMs } from '../shared/keyframes'
import { measureTextBlock, textStyleToSvg } from '../shared/textRender'

function ffmpegBin(): string {
  const p = ffmpegPath as unknown as string | null
  if (!p) throw new Error('ffmpeg-static binary missing')
  return p
}

function assetMap(project: Project): Map<string, Asset> {
  return new Map(project.assets.map((a) => [a.id, a]))
}

function activeClipsAt(clips: Clip[], trackOrder: TrackId[], tMs: number): Clip[] {
  return trackOrder
    .flatMap((tid) => clips.filter((c) => c.trackId === tid))
    .filter((c) => tMs >= c.startMs && tMs < c.startMs + c.durationMs)
}

/** Draw one Full HD RGBA frame. Peak memory: one frame + decoded sources for active clips. */
async function renderFrame(
  project: Project,
  assets: Map<string, Asset>,
  tMs: number,
  imageCache: Map<string, Buffer>
): Promise<Buffer> {
  const { width, height } = project
  // Bottom to top: V1 then V2 then V3
  const order: TrackId[] = ['V1', 'V2', 'V3']
  const clips = activeClipsAt(project.clips, order, tMs)

  let base = sharp({
    create: {
      width,
      height,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 1 }
    }
  }).ensureAlpha()

  const composites: sharp.OverlayOptions[] = []

  for (const clip of clips) {
    const asset = assets.get(clip.assetId)
    if (!asset || asset.type === 'audio') continue

    const transform = evaluateTransform(clip, tMs)
    const localMs = tMs - clip.startMs + clip.offsetMs

    let layerBuf: Buffer
    let lw: number
    let lh: number
    try {
      if (asset.type === 'text' && asset.text) {
        const scaled = {
          ...asset.text,
          fontSize: asset.text.fontSize * ((Math.abs(transform.scaleX) + Math.abs(transform.scaleY)) / 2)
        }
        const measured = measureTextBlock(scaled)
        const svg = textStyleToSvg(scaled, measured.width, measured.height)
        layerBuf = await sharp(Buffer.from(svg)).ensureAlpha().png().toBuffer()
        const meta = await sharp(layerBuf).metadata()
        lw = meta.width || measured.width
        lh = meta.height || measured.height
      } else {
        let srcBuf: Buffer
        if (asset.type === 'image') {
          if (!imageCache.has(asset.id)) {
            imageCache.set(asset.id, await sharp(asset.path).ensureAlpha().png().toBuffer())
          }
          srcBuf = imageCache.get(asset.id)!
        } else if (asset.type === 'gif') {
          const meta = await sharp(asset.path, { animated: true }).metadata()
          const pages = meta.pages || 1
          const delays = meta.delay || []
          const totalDelay =
            delays.length > 0 ? delays.reduce((a: number, b: number) => a + b, 0) : pages * 100
          const loopMs = totalDelay || 1000
          const cursor = ((localMs % loopMs) + loopMs) % loopMs
          let page = 0
          if (delays.length === pages) {
            let acc = 0
            for (let i = 0; i < pages; i++) {
              acc += delays[i] || 100
              if (cursor < acc) {
                page = i
                break
              }
              page = i
            }
          } else {
            page = Math.floor((cursor / loopMs) * pages) % pages
          }
          srcBuf = await sharp(asset.path, { page, animated: false }).ensureAlpha().png().toBuffer()
        } else {
          srcBuf = await extractVideoFrame(
            asset.path,
            (localMs % (asset.durationMs || localMs + 1)) / 1000
          )
        }

        const meta = await sharp(srcBuf).metadata()
        const sw = meta.width || 1
        const sh = meta.height || 1
        const dw = Math.max(1, Math.round(sw * transform.scaleX))
        const dh = Math.max(1, Math.round(sh * transform.scaleY))
        layerBuf = await sharp(srcBuf).resize(dw, dh, { fit: 'fill' }).ensureAlpha().png().toBuffer()
        const layerMeta = await sharp(layerBuf).metadata()
        lw = layerMeta.width || dw
        lh = layerMeta.height || dh
      }

      if (transform.opacity < 1) {
        const { data, info } = await sharp(layerBuf).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
        for (let i = 3; i < data.length; i += 4) {
          data[i] = Math.round(data[i] * transform.opacity)
        }
        layerBuf = await sharp(data, {
          raw: { width: info.width, height: info.height, channels: 4 }
        })
          .png()
          .toBuffer()
      }

      if (transform.rotation !== 0) {
        layerBuf = await sharp(layerBuf)
          .rotate(transform.rotation, {
            background: { r: 0, g: 0, b: 0, alpha: 0 }
          })
          .png()
          .toBuffer()
        const rotated = await sharp(layerBuf).metadata()
        lw = rotated.width || lw
        lh = rotated.height || lh
      }

      const left = Math.round(transform.x - lw / 2)
      const top = Math.round(transform.y - lh / 2)
      composites.push({
        input: layerBuf,
        left: Math.min(Math.max(left, -lw), width),
        top: Math.min(Math.max(top, -lh), height)
      })
    } catch {
      continue
    }
  }

  if (composites.length > 0) {
    // sharp fails if overlay is completely outside; filter roughly in-bounds
    const safe = composites.filter((c) => {
      const l = c.left ?? 0
      const t = c.top ?? 0
      return l < width && t < height && l > -width && t > -height
    })
    if (safe.length) {
      base = sharp(await base.png().toBuffer()).composite(safe)
    }
  }

  return base.raw().toBuffer()
}

function extractVideoFrame(path: string, timeSec: number): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = []
    const proc = spawn(ffmpegBin(), [
      '-ss',
      String(Math.max(0, timeSec)),
      '-i',
      path,
      '-frames:v',
      '1',
      '-f',
      'image2pipe',
      '-vcodec',
      'png',
      'pipe:1'
    ])
    proc.stdout.on('data', (c) => chunks.push(c))
    proc.on('close', (code) => {
      if (code === 0 && chunks.length) resolve(Buffer.concat(chunks))
      else reject(new Error('frame extract failed'))
    })
    proc.on('error', reject)
  })
}

function sendProgress(win: BrowserWindow | null, progress: ExportProgress): void {
  win?.webContents.send('export:progress', progress)
}

export async function exportProject(
  project: Project,
  outputPath: string,
  win: BrowserWindow | null
): Promise<void> {
  const durationMs = projectDurationMs(project.clips)
  const fps = project.fps || 30
  const totalFrames = Math.max(1, Math.ceil((durationMs / 1000) * fps))
  const assets = assetMap(project)
  const imageCache = new Map<string, Buffer>()
  const workDir = join(tmpdir(), `vtube-export-${Date.now()}`)
  await mkdir(workDir, { recursive: true })
  const rawPath = join(workDir, 'video.raw')
  const silentMp4 = join(workDir, 'video.mp4')
  const audioPath = join(workDir, 'audio.wav')

  try {
    sendProgress(win, { phase: 'video', currentFrame: 0, totalFrames })

    const out = createWriteStream(rawPath)
    for (let i = 0; i < totalFrames; i++) {
      const tMs = (i / fps) * 1000
      const frame = await renderFrame(project, assets, tMs, imageCache)
      await new Promise<void>((resolve, reject) => {
        out.write(frame, (err) => (err ? reject(err) : resolve()))
      })
      if (i % 5 === 0 || i === totalFrames - 1) {
        sendProgress(win, { phase: 'video', currentFrame: i + 1, totalFrames })
      }
      // keep cache small
      if (imageCache.size > 8) {
        const first = imageCache.keys().next().value
        if (first) imageCache.delete(first)
      }
    }
    await new Promise<void>((resolve, reject) => out.end(() => resolve()))

    await runFfmpeg([
      '-y',
      '-f',
      'rawvideo',
      '-pix_fmt',
      'rgba',
      '-s',
      `${project.width}x${project.height}`,
      '-r',
      String(fps),
      '-i',
      rawPath,
      '-c:v',
      'libx264',
      '-pix_fmt',
      'yuv420p',
      silentMp4
    ])

    sendProgress(win, { phase: 'audio', currentFrame: totalFrames, totalFrames })
    const hasAudio = await mixAudio(project, assets, durationMs, audioPath)

    sendProgress(win, { phase: 'mux', currentFrame: totalFrames, totalFrames })
    if (hasAudio) {
      await runFfmpeg([
        '-y',
        '-i',
        silentMp4,
        '-i',
        audioPath,
        '-c:v',
        'copy',
        '-c:a',
        'aac',
        '-shortest',
        outputPath
      ])
    } else {
      await runFfmpeg(['-y', '-i', silentMp4, '-c', 'copy', outputPath])
    }

    sendProgress(win, { phase: 'done', currentFrame: totalFrames, totalFrames, message: outputPath })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    sendProgress(win, { phase: 'error', currentFrame: 0, totalFrames, message })
    throw err
  } finally {
    imageCache.clear()
    for (const f of [rawPath, silentMp4, audioPath]) {
      try {
        if (existsSync(f)) await unlink(f)
      } catch {
        /* ignore */
      }
    }
  }
}

function runFfmpeg(args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const proc = spawn(ffmpegBin(), args)
    let err = ''
    proc.stderr.on('data', (d) => {
      err += d.toString()
    })
    proc.on('close', (code) => {
      if (code === 0) resolve()
      else reject(new Error(err.slice(-500) || `ffmpeg exit ${code}`))
    })
    proc.on('error', reject)
  })
}

async function mixAudio(
  project: Project,
  assets: Map<string, Asset>,
  durationMs: number,
  outputWav: string
): Promise<boolean> {
  const audioClips = project.clips.filter((c) => {
    const a = assets.get(c.assetId)
    return a && (a.type === 'audio' || a.type === 'video')
  })
  if (audioClips.length === 0) return false

  // Build filter: for each clip adelay + atrim, then amix
  const inputs: string[] = []
  const filterParts: string[] = []
  let idx = 0
  for (const clip of audioClips) {
    const asset = assets.get(clip.assetId)!
    if (asset.type === 'image' || asset.type === 'gif') continue
    inputs.push('-i', asset.path)
    const delay = Math.max(0, Math.round(clip.startMs))
    const durSec = clip.durationMs / 1000
    const offsetSec = clip.offsetMs / 1000
    filterParts.push(
      `[${idx}:a]atrim=start=${offsetSec}:duration=${durSec},asetpts=PTS-STARTPTS,adelay=${delay}|${delay}[a${idx}]`
    )
    idx++
  }
  if (idx === 0) return false

  const mixInputs = Array.from({ length: idx }, (_, i) => `[a${i}]`).join('')
  const filter =
    filterParts.join(';') +
    `;${mixInputs}amix=inputs=${idx}:duration=longest:dropout_transition=0,apad,atrim=0:${durationMs / 1000}[out]`

  await runFfmpeg([
    '-y',
    ...inputs,
    '-filter_complex',
    filter,
    '-map',
    '[out]',
    '-ar',
    '48000',
    '-ac',
    '2',
    outputWav
  ])
  return true
}
