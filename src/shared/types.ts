export const CANVAS_WIDTH = 1920
export const CANVAS_HEIGHT = 1080
export const DEFAULT_FPS = 30

export type AssetType = 'image' | 'video' | 'audio' | 'gif' | 'text'
export type TrackId = 'V1' | 'V2' | 'V3' | 'A1' | 'A2' | 'A3'
export type TransformProp = 'x' | 'y' | 'scaleX' | 'scaleY' | 'rotation' | 'opacity'
export type Easing = 'linear' | 'easeInOut'
export type TextAlign = 'left' | 'center' | 'right'

export interface TextStyle {
  content: string
  fontFamily: string
  fontSize: number
  fontWeight: string
  fontStyle: 'normal' | 'italic'
  color: string
  align: TextAlign
  strokeColor: string
  strokeWidth: number
  lineHeight: number
}

export function defaultTextStyle(content = 'Label'): TextStyle {
  return {
    content,
    fontFamily: 'sans-serif',
    fontSize: 72,
    fontWeight: '700',
    fontStyle: 'normal',
    color: '#ffffff',
    align: 'center',
    strokeColor: '#000000',
    strokeWidth: 0,
    lineHeight: 1.2
  }
}

export const VIDEO_TRACKS: TrackId[] = ['V1', 'V2', 'V3']
export const AUDIO_TRACKS: TrackId[] = ['A1', 'A2', 'A3']
export const ALL_TRACKS: TrackId[] = [...VIDEO_TRACKS, ...AUDIO_TRACKS]

export interface Transform {
  x: number
  y: number
  scaleX: number
  scaleY: number
  rotation: number
  opacity: number
}

export interface Keyframe {
  id: string
  timeMs: number
  prop: TransformProp
  value: number
  easing: Easing
}

export interface Asset {
  id: string
  name: string
  type: AssetType
  /** Empty for text assets */
  path: string
  durationMs?: number
  width?: number
  height?: number
  /** Present when type === 'text' */
  text?: TextStyle
}

export interface Clip {
  id: string
  assetId: string
  trackId: TrackId
  startMs: number
  durationMs: number
  /** Source media offset (trim start) for video/audio */
  offsetMs: number
  transform: Transform
  keyframes: Keyframe[]
}

export interface Track {
  id: TrackId
  kind: 'video' | 'audio'
  label: string
}

export interface Project {
  name: string
  width: number
  height: number
  fps: number
  assets: Asset[]
  tracks: Track[]
  clips: Clip[]
}

export interface ClipClipboard {
  transform: Transform
  keyframes: Keyframe[]
}

export interface ExportProgress {
  phase: 'video' | 'audio' | 'mux' | 'done' | 'error'
  currentFrame: number
  totalFrames: number
  message?: string
}

export function defaultTransform(): Transform {
  return {
    x: CANVAS_WIDTH / 2,
    y: CANVAS_HEIGHT / 2,
    scaleX: 1,
    scaleY: 1,
    rotation: 0,
    opacity: 1
  }
}

export function createDefaultTracks(): Track[] {
  return [
    { id: 'V3', kind: 'video', label: 'Video 3 (top)' },
    { id: 'V2', kind: 'video', label: 'Video 2' },
    { id: 'V1', kind: 'video', label: 'Video 1 (bottom)' },
    { id: 'A1', kind: 'audio', label: 'Audio 1' },
    { id: 'A2', kind: 'audio', label: 'Audio 2' },
    { id: 'A3', kind: 'audio', label: 'Audio 3' }
  ]
}

export function createEmptyProject(name = 'Untitled'): Project {
  return {
    name,
    width: CANVAS_WIDTH,
    height: CANVAS_HEIGHT,
    fps: DEFAULT_FPS,
    assets: [],
    tracks: createDefaultTracks(),
    clips: []
  }
}

export function isVideoTrack(id: TrackId): boolean {
  return VIDEO_TRACKS.includes(id)
}

export function isAudioTrack(id: TrackId): boolean {
  return AUDIO_TRACKS.includes(id)
}

export function uid(prefix = 'id'): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}_${Date.now().toString(36)}`
}
