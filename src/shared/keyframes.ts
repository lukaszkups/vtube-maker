import type { Clip, Easing, Keyframe, Transform, TransformProp } from './types'

function ease(t: number, easing: Easing): number {
  if (easing === 'easeInOut') {
    return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2
  }
  return t
}

export function evaluateProp(
  base: number,
  keyframes: Keyframe[],
  prop: TransformProp,
  localTimeMs: number
): number {
  const kfs = keyframes
    .filter((k) => k.prop === prop)
    .sort((a, b) => a.timeMs - b.timeMs)

  if (kfs.length === 0) return base

  if (localTimeMs <= kfs[0].timeMs) return kfs[0].value
  if (localTimeMs >= kfs[kfs.length - 1].timeMs) return kfs[kfs.length - 1].value

  for (let i = 0; i < kfs.length - 1; i++) {
    const a = kfs[i]
    const b = kfs[i + 1]
    if (localTimeMs >= a.timeMs && localTimeMs <= b.timeMs) {
      const span = b.timeMs - a.timeMs || 1
      const t = ease((localTimeMs - a.timeMs) / span, a.easing)
      return a.value + (b.value - a.value) * t
    }
  }
  return base
}

export function evaluateTransform(clip: Clip, timelineMs: number): Transform {
  const local = timelineMs - clip.startMs
  const t = clip.transform
  return {
    x: evaluateProp(t.x, clip.keyframes, 'x', local),
    y: evaluateProp(t.y, clip.keyframes, 'y', local),
    scaleX: evaluateProp(t.scaleX, clip.keyframes, 'scaleX', local),
    scaleY: evaluateProp(t.scaleY, clip.keyframes, 'scaleY', local),
    rotation: evaluateProp(t.rotation, clip.keyframes, 'rotation', local),
    opacity: evaluateProp(t.opacity, clip.keyframes, 'opacity', local)
  }
}

export function projectDurationMs(clips: { startMs: number; durationMs: number }[]): number {
  if (clips.length === 0) return 5000
  return Math.max(...clips.map((c) => c.startMs + c.durationMs), 1000)
}
