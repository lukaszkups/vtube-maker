import { dialog, BrowserWindow } from 'electron'
import { copyFile, mkdir, writeFile, readFile, unlink } from 'fs/promises'
import { basename, extname, join } from 'path'
import { existsSync } from 'fs'
import { spawn } from 'child_process'
import ffprobePath from 'ffprobe-static'
import ffmpegPath from 'ffmpeg-static'
import sharp from 'sharp'
import type { Asset, AssetType } from '../shared/types'
import { uid } from '../shared/types'

function ffmpegBin(): string {
  const p = ffmpegPath as unknown as string | null
  if (!p) throw new Error('ffmpeg-static binary missing')
  return p
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
      else reject(new Error(err.slice(-400) || `ffmpeg exit ${code}`))
    })
    proc.on('error', reject)
  })
}

function probeBinary(): string {
  const p = ffprobePath as unknown as string | { path: string }
  return typeof p === 'string' ? p : p.path
}

export function ensureProjectDirs(projectDir: string): Promise<void> {
  return mkdir(join(projectDir, 'assets'), { recursive: true }).then(() => undefined)
}

function detectType(filePath: string): AssetType {
  const ext = extname(filePath).toLowerCase()
  if (ext === '.gif') return 'gif'
  if (['.png', '.jpg', '.jpeg', '.webp', '.bmp'].includes(ext)) return 'image'
  if (['.mp3', '.wav', '.ogg', '.m4a', '.flac', '.aac'].includes(ext)) return 'audio'
  if (['.mp4', '.mov', '.mkv', '.avi', '.webm'].includes(ext)) return 'video'
  return 'video'
}

function probeMedia(filePath: string): Promise<{ durationMs?: number; width?: number; height?: number }> {
  return new Promise((resolve) => {
    const bin = probeBinary()
    if (!bin || !existsSync(bin)) {
      resolve({})
      return
    }
    const proc = spawn(bin, [
      '-v',
      'quiet',
      '-print_format',
      'json',
      '-show_format',
      '-show_streams',
      filePath
    ])
    let out = ''
    proc.stdout.on('data', (d) => {
      out += d.toString()
    })
    proc.on('close', () => {
      try {
        const data = JSON.parse(out)
        const format = data.format || {}
        const streams: Array<Record<string, unknown>> = data.streams || []
        const video = streams.find((s) => s.codec_type === 'video')
        const durationSec = parseFloat(String(format.duration || video?.duration || 0))
        resolve({
          durationMs: Number.isFinite(durationSec) && durationSec > 0 ? Math.round(durationSec * 1000) : undefined,
          width: video?.width ? Number(video.width) : undefined,
          height: video?.height ? Number(video.height) : undefined
        })
      } catch {
        resolve({})
      }
    })
    proc.on('error', () => resolve({}))
  })
}

export async function importFiles(
  projectDir: string,
  filePaths?: string[]
): Promise<Asset[]> {
  await ensureProjectDirs(projectDir)
  let paths = filePaths
  if (!paths || paths.length === 0) {
    const opts = {
      properties: ['openFile', 'multiSelections'] as Array<'openFile' | 'multiSelections'>,
      filters: [
        {
          name: 'Media',
          extensions: [
            'png',
            'jpg',
            'jpeg',
            'webp',
            'gif',
            'bmp',
            'mp4',
            'mov',
            'webm',
            'mkv',
            'mp3',
            'wav',
            'ogg',
            'm4a',
            'flac'
          ]
        }
      ]
    }
    const win = dialogParent()
    const result = win ? await dialog.showOpenDialog(win, opts) : await dialog.showOpenDialog(opts)
    if (result.canceled || result.filePaths.length === 0) return []
    paths = result.filePaths
  }

  const assets: Asset[] = []
  for (const src of paths) {
    const id = uid('asset')
    const ext = extname(src)
    const destName = `${id}${ext}`
    const dest = join(projectDir, 'assets', destName)
    await copyFile(src, dest)
    const type = detectType(src)
    const meta = await probeMedia(dest)
    if ((type === 'image' || type === 'gif') && (!meta.width || !meta.height)) {
      try {
        const img = await sharp(dest, { animated: type === 'gif' }).metadata()
        meta.width = img.width
        meta.height = img.height
        if (type === 'gif' && !meta.durationMs) {
          const pages = img.pages || 1
          const delays = img.delay || []
          const total =
            delays.length > 0 ? delays.reduce((a: number, b: number) => a + b, 0) : pages * 100
          meta.durationMs = total || 2000
        }
      } catch {
        /* ignore */
      }
    }
    if (type === 'gif' && !meta.durationMs) {
      meta.durationMs = await probeGifDuration(dest)
    }
    assets.push({
      id,
      name: basename(src),
      type,
      path: dest,
      durationMs: meta.durationMs,
      width: meta.width,
      height: meta.height
    })
  }
  return assets
}

async function probeGifDuration(filePath: string): Promise<number | undefined> {
  try {
    // Prefer ffprobe; fallback estimate
    const meta = await probeMedia(filePath)
    if (meta.durationMs) return meta.durationMs
    const buf = await readFile(filePath)
    // crude: count frame delay blocks is complex; default 2s loop unit
    void buf
    return 2000
  } catch {
    return 2000
  }
}

export async function saveRecording(
  projectDir: string,
  buffer: ArrayBuffer,
  suggestedName?: string
): Promise<Asset> {
  await ensureProjectDirs(projectDir)
  const id = uid('asset')
  const tmpWebm = join(projectDir, 'assets', `${id}.webm`)
  const dest = join(projectDir, 'assets', `${id}.mp3`)
  await writeFile(tmpWebm, Buffer.from(buffer))
  try {
    await runFfmpeg([
      '-y',
      '-i',
      tmpWebm,
      '-vn',
      '-acodec',
      'libmp3lame',
      '-q:a',
      '2',
      dest
    ])
  } finally {
    try {
      if (existsSync(tmpWebm)) await unlink(tmpWebm)
    } catch {
      /* ignore */
    }
  }
  const meta = await probeMedia(dest)
  const stamp = new Date().toLocaleTimeString()
  return {
    id,
    name: suggestedName || `Recording ${stamp}.mp3`,
    type: 'audio',
    path: dest,
    durationMs: meta.durationMs || 1000
  }
}

function dialogParent(): BrowserWindow | undefined {
  return BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0] ?? undefined
}

export async function pickExportPath(defaultName = 'export.mp4'): Promise<string | null> {
  const opts = {
    defaultPath: defaultName,
    filters: [{ name: 'MP4 Video', extensions: ['mp4'] }]
  }
  const win = dialogParent()
  const result = win ? await dialog.showSaveDialog(win, opts) : await dialog.showSaveDialog(opts)
  if (result.canceled || !result.filePath) return null
  return result.filePath
}

export async function pickProjectDir(): Promise<string | null> {
  const opts = {
    properties: ['openDirectory', 'createDirectory'] as Array<'openDirectory' | 'createDirectory'>
  }
  const win = dialogParent()
  const result = win ? await dialog.showOpenDialog(win, opts) : await dialog.showOpenDialog(opts)
  if (result.canceled || result.filePaths.length === 0) return null
  return result.filePaths[0]
}

export async function pickSaveProjectPath(defaultName = 'project.json'): Promise<string | null> {
  const opts = {
    title: 'Save project',
    defaultPath: defaultName,
    filters: [{ name: 'VTube Maker Project', extensions: ['json'] }]
  }
  const win = dialogParent()
  const result = win ? await dialog.showSaveDialog(win, opts) : await dialog.showSaveDialog(opts)
  if (result.canceled || !result.filePath) return null
  return result.filePath.endsWith('.json') ? result.filePath : `${result.filePath}.json`
}

export async function pickOpenProjectPath(): Promise<string | null> {
  const opts = {
    title: 'Open project',
    properties: ['openFile'] as Array<'openFile'>,
    filters: [{ name: 'VTube Maker Project', extensions: ['json'] }]
  }
  const win = dialogParent()
  const result = win ? await dialog.showOpenDialog(win, opts) : await dialog.showOpenDialog(opts)
  if (result.canceled || result.filePaths.length === 0) return null
  return result.filePaths[0]
}
