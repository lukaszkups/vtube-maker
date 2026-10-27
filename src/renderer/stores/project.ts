import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import type {
  Asset,
  Clip,
  ClipClipboard,
  Keyframe,
  Project,
  TrackId,
  Transform,
  TransformProp
} from '@shared/types'
import {
  createEmptyProject,
  defaultTransform,
  isAudioTrack,
  isVideoTrack,
  uid
} from '@shared/types'
import { projectDurationMs } from '@shared/keyframes'

const DEFAULT_STILL_MS = 3000

export const useProjectStore = defineStore('project', () => {
  const project = ref<Project>(createEmptyProject('Untitled'))
  const selectedClipId = ref<string | null>(null)
  const playheadMs = ref(0)
  const isPlaying = ref(false)
  const pixelsPerSecond = ref(80)
  const clipboard = ref<ClipClipboard | null>(null)
  const mediaUrls = ref<Record<string, string>>({})
  const exportProgress = ref<{
    phase: string
    currentFrame: number
    totalFrames: number
    message?: string
  } | null>(null)

  const selectedClip = computed(() =>
    project.value.clips.find((c) => c.id === selectedClipId.value) ?? null
  )

  const durationMs = computed(() => projectDurationMs(project.value.clips))

  const clipsByTrack = computed(() => {
    const map: Record<TrackId, Clip[]> = {
      V1: [],
      V2: [],
      V3: [],
      A1: [],
      A2: [],
      A3: []
    }
    for (const c of project.value.clips) {
      map[c.trackId].push(c)
    }
    for (const id of Object.keys(map) as TrackId[]) {
      map[id].sort((a, b) => a.startMs - b.startMs)
    }
    return map
  })

  function getAsset(id: string): Asset | undefined {
    return project.value.assets.find((a) => a.id === id)
  }

  async function refreshMediaUrl(asset: Asset): Promise<string> {
    if (mediaUrls.value[asset.id]) return mediaUrls.value[asset.id]
    const url = await window.api.toMediaUrl(asset.path)
    mediaUrls.value = { ...mediaUrls.value, [asset.id]: url }
    return url
  }

  async function ensureMediaUrls(): Promise<void> {
    for (const a of project.value.assets) {
      await refreshMediaUrl(a)
    }
  }

  async function load(): Promise<void> {
    project.value = await window.api.loadProject()
    selectedClipId.value = null
    playheadMs.value = 0
    mediaUrls.value = {}
    await ensureMediaUrls()
  }

  async function save(): Promise<void> {
    await window.api.saveProject(project.value)
  }

  async function importAssets(): Promise<void> {
    const assets = await window.api.importAssets()
    if (!assets.length) return
    project.value.assets.push(...assets)
    for (const a of assets) await refreshMediaUrl(a)
    await save()
  }

  function defaultClipDuration(asset: Asset): number {
    if (asset.type === 'gif' || asset.type === 'image') {
      return asset.durationMs || DEFAULT_STILL_MS
    }
    return asset.durationMs || DEFAULT_STILL_MS
  }

  function canPlaceOnTrack(asset: Asset, trackId: TrackId): boolean {
    if (isAudioTrack(trackId)) return asset.type === 'audio' || asset.type === 'video'
    if (isVideoTrack(trackId)) return asset.type !== 'audio'
    return false
  }

  function addClipFromAsset(assetId: string, trackId: TrackId, startMs: number): Clip | null {
    const asset = getAsset(assetId)
    if (!asset || !canPlaceOnTrack(asset, trackId)) return null
    const clip: Clip = {
      id: uid('clip'),
      assetId,
      trackId,
      startMs: Math.max(0, Math.round(startMs)),
      durationMs: defaultClipDuration(asset),
      offsetMs: 0,
      transform: defaultTransform(),
      keyframes: []
    }
    project.value.clips.push(clip)
    selectedClipId.value = clip.id
    void save()
    return clip
  }

  function selectClip(id: string | null): void {
    selectedClipId.value = id
  }

  function updateClip(id: string, patch: Partial<Clip>): void {
    const clip = project.value.clips.find((c) => c.id === id)
    if (!clip) return
    Object.assign(clip, patch)
    void save()
  }

  function moveClip(id: string, startMs: number, trackId?: TrackId): void {
    const clip = project.value.clips.find((c) => c.id === id)
    if (!clip) return
    const asset = getAsset(clip.assetId)
    if (trackId && asset && !canPlaceOnTrack(asset, trackId)) return
    clip.startMs = Math.max(0, Math.round(startMs))
    if (trackId) clip.trackId = trackId
    void save()
  }

  function resizeClip(id: string, edge: 'start' | 'end', timeMs: number): void {
    const clip = project.value.clips.find((c) => c.id === id)
    if (!clip) return
    const asset = getAsset(clip.assetId)
    if (edge === 'end') {
      const newDur = Math.max(100, Math.round(timeMs - clip.startMs))
      // For video/audio with finite source, cap by remaining media
      if (asset && (asset.type === 'video' || asset.type === 'audio') && asset.durationMs) {
        const maxDur = asset.durationMs - clip.offsetMs
        clip.durationMs = Math.min(newDur, maxDur)
      } else {
        // GIF / image: extend = more loops
        clip.durationMs = newDur
      }
    } else {
      const end = clip.startMs + clip.durationMs
      const newStart = Math.max(0, Math.min(Math.round(timeMs), end - 100))
      const delta = newStart - clip.startMs
      clip.startMs = newStart
      clip.durationMs = end - newStart
      if (asset && (asset.type === 'video' || asset.type === 'audio')) {
        clip.offsetMs = Math.max(0, clip.offsetMs + delta)
      }
    }
    void save()
  }

  function removeClip(id: string): void {
    project.value.clips = project.value.clips.filter((c) => c.id !== id)
    if (selectedClipId.value === id) selectedClipId.value = null
    void save()
  }

  function setTransform(id: string, transform: Partial<Transform>): void {
    const clip = project.value.clips.find((c) => c.id === id)
    if (!clip) return
    clip.transform = { ...clip.transform, ...transform }
    void save()
  }

  function copyClipSettings(id?: string): void {
    const clip = project.value.clips.find((c) => c.id === (id || selectedClipId.value))
    if (!clip) return
    clipboard.value = {
      transform: { ...clip.transform },
      keyframes: clip.keyframes.map((k) => ({ ...k }))
    }
  }

  function pasteClipSettings(id?: string): void {
    const clip = project.value.clips.find((c) => c.id === (id || selectedClipId.value))
    if (!clip || !clipboard.value) return
    clip.transform = { ...clipboard.value.transform }
    clip.keyframes = clipboard.value.keyframes.map((k) => ({
      ...k,
      id: uid('kf')
    }))
    void save()
  }

  function addKeyframe(prop: TransformProp, value?: number): void {
    const clip = selectedClip.value
    if (!clip) return
    const local = Math.max(0, playheadMs.value - clip.startMs)
    const existing = clip.keyframes.find((k) => k.prop === prop && Math.abs(k.timeMs - local) < 40)
    const v = value ?? clip.transform[prop]
    if (existing) {
      existing.value = v
    } else {
      const kf: Keyframe = {
        id: uid('kf'),
        timeMs: Math.round(local),
        prop,
        value: v,
        easing: 'easeInOut'
      }
      clip.keyframes.push(kf)
    }
    // also update base if at start
    if (local < 40) clip.transform[prop] = v
    void save()
  }

  function removeKeyframe(kfId: string): void {
    const clip = selectedClip.value
    if (!clip) return
    clip.keyframes = clip.keyframes.filter((k) => k.id !== kfId)
    void save()
  }

  function setPlayhead(ms: number): void {
    playheadMs.value = Math.max(0, Math.min(ms, durationMs.value))
  }

  async function addRecordingAsset(buffer: ArrayBuffer, name?: string): Promise<Asset> {
    const asset = await window.api.saveRecording(buffer, name)
    project.value.assets.push(asset)
    await refreshMediaUrl(asset)
    const track: TrackId = 'A1'
    addClipFromAsset(asset.id, track, playheadMs.value)
    await save()
    return asset
  }

  async function runExport(): Promise<void> {
    exportProgress.value = { phase: 'video', currentFrame: 0, totalFrames: 1 }
    const off = window.api.onExportProgress((p) => {
      exportProgress.value = p
    })
    try {
      await save()
      const result = await window.api.exportProject(JSON.parse(JSON.stringify(project.value)))
      if (result.canceled) exportProgress.value = null
    } finally {
      off()
    }
  }

  return {
    project,
    selectedClipId,
    selectedClip,
    playheadMs,
    isPlaying,
    pixelsPerSecond,
    clipboard,
    mediaUrls,
    exportProgress,
    durationMs,
    clipsByTrack,
    getAsset,
    refreshMediaUrl,
    load,
    save,
    importAssets,
    addClipFromAsset,
    selectClip,
    updateClip,
    moveClip,
    resizeClip,
    removeClip,
    setTransform,
    copyClipSettings,
    pasteClipSettings,
    addKeyframe,
    removeKeyframe,
    setPlayhead,
    addRecordingAsset,
    runExport,
    canPlaceOnTrack,
    defaultClipDuration
  }
})
