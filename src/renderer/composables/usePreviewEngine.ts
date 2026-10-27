import { onBeforeUnmount, ref, watch, type Ref } from 'vue'
import { storeToRefs } from 'pinia'
import { useProjectStore } from '../stores/project'
import { evaluateTransform } from '@shared/keyframes'
import type { Asset, Clip, TrackId } from '@shared/types'
import { drawTextCentered } from '@shared/textRender'
import { drawGifFrame } from './useGifDecoder'

const VIDEO_ORDER: TrackId[] = ['V1', 'V2', 'V3']

export function usePreviewEngine(canvasRef: Ref<HTMLCanvasElement | null>) {
  const store = useProjectStore()
  const { project, playheadMs, isPlaying, mediaUrls, durationMs } = storeToRefs(store)

  const videoEls = new Map<string, HTMLVideoElement>()
  const audioEls = new Map<string, HTMLAudioElement>()
  const imageEls = new Map<string, HTMLImageElement>()
  let raf = 0
  let lastTs = 0
  const ready = ref(false)

  function getMediaUrl(asset: Asset): string | undefined {
    return mediaUrls.value[asset.id]
  }

  function ensureVideo(asset: Asset): HTMLVideoElement | null {
    const url = getMediaUrl(asset)
    if (!url) return null
    let el = videoEls.get(asset.id)
    if (!el) {
      el = document.createElement('video')
      el.src = url
      el.playsInline = true
      el.preload = 'metadata'
      videoEls.set(asset.id, el)
    }
    return el
  }

  function ensureAudio(asset: Asset): HTMLAudioElement | null {
    const url = getMediaUrl(asset)
    if (!url) return null
    let el = audioEls.get(asset.id)
    if (!el) {
      el = document.createElement('audio')
      el.src = url
      el.preload = 'metadata'
      audioEls.set(asset.id, el)
    }
    return el
  }

  function ensureImage(asset: Asset): HTMLImageElement | null {
    const url = getMediaUrl(asset)
    if (!url) return null
    let el = imageEls.get(asset.id)
    if (!el) {
      el = new Image()
      el.src = url
      imageEls.set(asset.id, el)
    }
    return el
  }

  function activeClips(t: number): Clip[] {
    return VIDEO_ORDER.flatMap((tid) =>
      project.value.clips.filter(
        (c) => c.trackId === tid && t >= c.startMs && t < c.startMs + c.durationMs
      )
    )
  }

  async function drawClip(
    ctx: CanvasRenderingContext2D,
    clip: Clip,
    t: number
  ): Promise<void> {
    const asset = store.getAsset(clip.assetId)
    if (!asset || asset.type === 'audio') return
    const transform = evaluateTransform(clip, t)
    const local = t - clip.startMs + clip.offsetMs

    ctx.save()
    ctx.globalAlpha = Math.max(0, Math.min(1, transform.opacity))
    ctx.translate(transform.x, transform.y)
    ctx.rotate((transform.rotation * Math.PI) / 180)

    if (asset.type === 'text' && asset.text) {
      drawTextCentered(ctx, asset.text, transform.scaleX, transform.scaleY)
      ctx.restore()
      return
    }

    const url = getMediaUrl(asset)
    if (!url) {
      ctx.restore()
      return
    }

    let sw = asset.width || 100
    let sh = asset.height || 100
    const dw = sw * transform.scaleX
    const dh = sh * transform.scaleY

    if (asset.type === 'gif') {
      await drawGifFrame(ctx, url, local, -dw / 2, -dh / 2, dw, dh)
    } else if (asset.type === 'image') {
      const img = ensureImage(asset)
      if (img && img.complete) {
        sw = img.naturalWidth || sw
        sh = img.naturalHeight || sh
        ctx.drawImage(img, -dw / 2, -dh / 2, dw, dh)
      }
    } else if (asset.type === 'video') {
      const video = ensureVideo(asset)
      if (video) {
        const target = local / 1000
        if (Math.abs((video.currentTime || 0) - target) > 0.08) {
          try {
            video.currentTime = Math.min(target, (video.duration || target) - 0.001)
          } catch {
            /* seek may fail while loading */
          }
        }
        if (video.readyState >= 2) {
          sw = video.videoWidth || sw
          sh = video.videoHeight || sh
          const w = sw * transform.scaleX
          const h = sh * transform.scaleY
          ctx.drawImage(video, -w / 2, -h / 2, w, h)
        }
      }
    }
    ctx.restore()
  }

  async function renderFrame(t: number): Promise<void> {
    const canvas = canvasRef.value
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const { width, height } = project.value
    if (canvas.width !== width) canvas.width = width
    if (canvas.height !== height) canvas.height = height

    ctx.fillStyle = '#000'
    ctx.fillRect(0, 0, width, height)

    for (const clip of activeClips(t)) {
      await drawClip(ctx, clip, t)
    }
  }

  function syncAudio(t: number, playing: boolean): void {
    const audioClips = project.value.clips.filter((c) => {
      const a = store.getAsset(c.assetId)
      return (
        a &&
        (a.type === 'audio' || a.type === 'video') &&
        t >= c.startMs &&
        t < c.startMs + c.durationMs
      )
    })

    const activeAssetIds = new Set<string>()
    for (const clip of audioClips) {
      const asset = store.getAsset(clip.assetId)!
      activeAssetIds.add(asset.id)
      const el = asset.type === 'audio' ? ensureAudio(asset) : ensureVideo(asset)
      if (!el) continue
      el.muted = false
      const local = (t - clip.startMs + clip.offsetMs) / 1000
      if (Math.abs((el.currentTime || 0) - local) > 0.12) {
        try {
          el.currentTime = Math.max(0, local)
        } catch {
          /* ignore */
        }
      }
      if (playing) {
        if (el.paused) void el.play().catch(() => undefined)
      } else if (!el.paused) {
        el.pause()
      }
    }

    audioEls.forEach((el, id) => {
      if (!activeAssetIds.has(id) && !el.paused) el.pause()
    })
    videoEls.forEach((el, id) => {
      if (!activeAssetIds.has(id)) {
        el.muted = true
        if (!el.paused) el.pause()
      }
    })
  }

  function tick(ts: number): void {
    if (!lastTs) lastTs = ts
    const dt = ts - lastTs
    lastTs = ts
    if (isPlaying.value) {
      const next = playheadMs.value + dt
      if (next >= durationMs.value) {
        store.setPlayhead(durationMs.value)
        store.isPlaying = false
      } else {
        store.setPlayhead(next)
      }
    }
    void renderFrame(playheadMs.value)
    syncAudio(playheadMs.value, isPlaying.value)
    raf = requestAnimationFrame(tick)
  }

  function startLoop(): void {
    cancelAnimationFrame(raf)
    lastTs = 0
    raf = requestAnimationFrame(tick)
    ready.value = true
  }

  function stopLoop(): void {
    cancelAnimationFrame(raf)
    audioEls.forEach((el) => el.pause())
    videoEls.forEach((el) => el.pause())
  }

  function togglePlay(): void {
    store.isPlaying = !store.isPlaying
    lastTs = 0
  }

  watch(playheadMs, (t) => {
    if (!isPlaying.value) {
      void renderFrame(t)
      syncAudio(t, false)
    }
  })

  watch(
    () => project.value.clips,
    () => {
      void renderFrame(playheadMs.value)
    },
    { deep: true }
  )

  onBeforeUnmount(() => stopLoop())

  return { startLoop, stopLoop, togglePlay, renderFrame, ready }
}
