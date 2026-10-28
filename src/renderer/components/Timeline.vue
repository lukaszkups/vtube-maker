<script setup lang="ts">
import { computed, ref } from 'vue'
import { useProjectStore } from '../stores/project'
import type { TrackId } from '@shared/types'

const store = useProjectStore()
const scrollRef = ref<HTMLElement | null>(null)

const tracks = computed(() => store.project.tracks)

const timelineWidth = computed(() => {
  const secs = Math.max(store.durationMs / 1000 + 5, 20)
  return secs * store.pixelsPerSecond
})

function msToX(ms: number): number {
  return (ms / 1000) * store.pixelsPerSecond
}

function xToMs(x: number): number {
  return (x / store.pixelsPerSecond) * 1000
}

function clipStyle(startMs: number, durationMs: number): Record<string, string> {
  return {
    left: `${msToX(startMs)}px`,
    width: `${Math.max(8, msToX(durationMs))}px`
  }
}

function clipClass(assetType: string | undefined): string {
  if (assetType === 'gif') return 'clip gif'
  if (assetType === 'audio') return 'clip audio'
  if (assetType === 'text') return 'clip text'
  return 'clip video'
}

function onDragOver(e: DragEvent): void {
  e.preventDefault()
  if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy'
}

function onDrop(e: DragEvent, trackId: TrackId): void {
  e.preventDefault()
  const assetId = e.dataTransfer?.getData('application/x-vtube-asset')
  if (!assetId) return
  const lane = (e.currentTarget as HTMLElement).querySelector('.lane-body') as HTMLElement
  if (!lane) return
  const rect = lane.getBoundingClientRect()
  const scrollLeft = scrollRef.value?.scrollLeft || 0
  const x = e.clientX - rect.left + scrollLeft
  store.addClipFromAsset(assetId, trackId, xToMs(x))
}

type DragKind = 'move' | 'resize-start' | 'resize-end'
const drag = ref<{
  kind: DragKind
  clipId: string
  originX: number
  originStart: number
  originDuration: number
} | null>(null)

const scrubbing = ref(false)

function clientXToTimelineMs(clientX: number, bodyEl: HTMLElement): number {
  const rect = bodyEl.getBoundingClientRect()
  // bodyEl is the scrolled content; getBoundingClientRect already accounts for scroll
  const x = clientX - rect.left
  return Math.max(0, xToMs(x))
}

function seekFromClientX(clientX: number, bodyEl: HTMLElement): void {
  store.setPlayhead(clientXToTimelineMs(clientX, bodyEl))
}

function startScrub(e: PointerEvent, bodyEl: HTMLElement): void {
  e.preventDefault()
  e.stopPropagation()
  store.isPlaying = false
  scrubbing.value = true
  seekFromClientX(e.clientX, bodyEl)
  ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
}

function onScrubMove(e: PointerEvent, bodyEl: HTMLElement): void {
  if (!scrubbing.value) return
  seekFromClientX(e.clientX, bodyEl)
}

function endScrub(): void {
  scrubbing.value = false
}

function onRulerPointerDown(e: PointerEvent): void {
  const ruler = e.currentTarget as HTMLElement
  startScrub(e, ruler)
}

function onRulerPointerMove(e: PointerEvent): void {
  onScrubMove(e, e.currentTarget as HTMLElement)
}

function onPlayheadPointerDown(e: PointerEvent): void {
  // Scrub relative to the tracks content width using the scroll area's ruler/lanes
  const content = (e.currentTarget as HTMLElement).parentElement
  if (!content) return
  startScrub(e, content)
}

function onPlayheadPointerMove(e: PointerEvent): void {
  const content = (e.currentTarget as HTMLElement).parentElement
  if (!content) return
  onScrubMove(e, content)
}

function startClipDrag(e: PointerEvent, clipId: string, kind: DragKind): void {
  e.stopPropagation()
  e.preventDefault()
  const clip = store.project.clips.find((c) => c.id === clipId)
  if (!clip) return
  store.selectClip(clipId)
  store.beginGesture()
  drag.value = {
    kind,
    clipId,
    originX: e.clientX,
    originStart: clip.startMs,
    originDuration: clip.durationMs
  }
  ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
}

function onClipPointerMove(e: PointerEvent): void {
  if (!drag.value) return
  const dx = e.clientX - drag.value.originX
  const dMs = xToMs(dx)
  const opts = { persist: false }
  if (drag.value.kind === 'move') {
    store.moveClip(drag.value.clipId, drag.value.originStart + dMs, undefined, opts)
  } else if (drag.value.kind === 'resize-end') {
    const end = drag.value.originStart + drag.value.originDuration + dMs
    store.resizeClip(drag.value.clipId, 'end', end, opts)
  } else {
    store.resizeClip(drag.value.clipId, 'start', drag.value.originStart + dMs, opts)
  }
}

function endClipDrag(): void {
  if (drag.value) store.endGesture()
  drag.value = null
}

function onLanePointerDown(e: PointerEvent, trackId: TrackId): void {
  if ((e.target as HTMLElement).closest('.clip')) return
  if ((e.target as HTMLElement).closest('.playhead')) return
  const lane = e.currentTarget as HTMLElement
  store.selectClip(null)
  startScrub(e, lane)
  void trackId
}

function onLanePointerMove(e: PointerEvent): void {
  if (!scrubbing.value || drag.value) return
  onScrubMove(e, e.currentTarget as HTMLElement)
}

function zoom(delta: number): void {
  store.pixelsPerSecond = Math.max(20, Math.min(300, store.pixelsPerSecond + delta))
}
</script>

<template>
  <footer class="timeline">
    <div class="timeline-tools">
      <button type="button" @click="zoom(-10)">−</button>
      <button type="button" @click="zoom(10)">+</button>
      <span class="muted">{{ store.pixelsPerSecond }} px/s</span>
    </div>
    <div class="timeline-scroll" ref="scrollRef">
      <div
        class="ruler"
        :style="{ width: timelineWidth + 'px' }"
        @pointerdown="onRulerPointerDown"
        @pointermove="onRulerPointerMove"
        @pointerup="endScrub"
        @pointercancel="endScrub"
      >
        <div
          v-for="s in Math.ceil(timelineWidth / store.pixelsPerSecond)"
          :key="s"
          class="tick"
          :style="{ left: s * store.pixelsPerSecond + 'px' }"
        >
          {{ s }}s
        </div>
        <div
          class="playhead"
          :class="{ scrubbing }"
          :style="{ left: msToX(store.playheadMs) + 'px' }"
          title="Drag to scrub"
          @pointerdown="onPlayheadPointerDown"
          @pointermove="onPlayheadPointerMove"
          @pointerup="endScrub"
          @pointercancel="endScrub"
        >
          <span class="playhead-head" />
        </div>
      </div>

      <div
        v-for="track in tracks"
        :key="track.id"
        class="lane"
        :data-kind="track.kind"
        @dragover="onDragOver"
        @drop="onDrop($event, track.id)"
      >
        <div class="lane-label">{{ track.id }}</div>
        <div
          class="lane-body"
          :style="{ width: timelineWidth + 'px' }"
          @pointerdown="onLanePointerDown($event, track.id)"
          @pointermove="onLanePointerMove"
          @pointerup="endScrub"
          @pointercancel="endScrub"
        >
          <div
            v-for="clip in store.clipsByTrack[track.id]"
            :key="clip.id"
            :class="[
              clipClass(store.getAsset(clip.assetId)?.type),
              { selected: store.selectedClipId === clip.id }
            ]"
            :style="clipStyle(clip.startMs, clip.durationMs)"
            @pointerdown="startClipDrag($event, clip.id, 'move')"
            @pointermove="onClipPointerMove"
            @pointerup="endClipDrag"
            @pointercancel="endClipDrag"
          >
            <span
              class="handle left"
              @pointerdown="startClipDrag($event, clip.id, 'resize-start')"
            />
            <span class="label">{{ store.getAsset(clip.assetId)?.name || 'clip' }}</span>
            <span
              class="handle right"
              @pointerdown="startClipDrag($event, clip.id, 'resize-end')"
            />
            <template v-if="store.selectedClipId === clip.id">
              <i
                v-for="kf in clip.keyframes"
                :key="kf.id"
                class="kf"
                :style="{ left: msToX(kf.timeMs) + 'px' }"
                :title="`${kf.prop}`"
              />
            </template>
          </div>
          <div
            class="playhead lane-playhead"
            :class="{ scrubbing }"
            :style="{ left: msToX(store.playheadMs) + 'px' }"
            @pointerdown="onPlayheadPointerDown"
            @pointermove="onPlayheadPointerMove"
            @pointerup="endScrub"
            @pointercancel="endScrub"
          />
        </div>
      </div>
    </div>
  </footer>
</template>

<style scoped>
.timeline {
  background: var(--bg-panel);
  border-top: 1px solid var(--border);
  display: flex;
  flex-direction: column;
  min-height: 0;
}

.timeline-tools {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 10px;
  border-bottom: 1px solid var(--border);
}

.muted {
  color: var(--muted);
  font-family: var(--mono);
  font-size: 11px;
}

.timeline-scroll {
  overflow: auto;
  flex: 1;
  min-height: 0;
}

.ruler {
  position: relative;
  height: 22px;
  border-bottom: 1px solid var(--border);
  margin-left: 56px;
  cursor: ew-resize;
  touch-action: none;
}

.tick {
  position: absolute;
  top: 0;
  transform: translateX(-50%);
  font-size: 10px;
  color: var(--muted);
  font-family: var(--mono);
  pointer-events: none;
}

.lane {
  display: grid;
  grid-template-columns: 56px 1fr;
  height: 36px;
  border-bottom: 1px solid var(--border);
}

.lane[data-kind='video'] .lane-body {
  background: color-mix(in srgb, var(--track-video) 55%, transparent);
}

.lane[data-kind='audio'] .lane-body {
  background: color-mix(in srgb, var(--track-audio) 55%, transparent);
}

.lane-label {
  display: grid;
  place-items: center;
  font-family: var(--mono);
  font-size: 11px;
  color: var(--muted);
  border-right: 1px solid var(--border);
  background: var(--bg-elevated);
}

.lane-body {
  position: relative;
  height: 100%;
  touch-action: none;
  cursor: text;
}

.clip {
  position: absolute;
  top: 4px;
  bottom: 4px;
  border-radius: 4px;
  display: flex;
  align-items: center;
  overflow: hidden;
  cursor: grab;
  border: 1px solid rgba(255, 255, 255, 0.15);
  z-index: 1;
}

.clip.video {
  background: var(--clip-video);
}

.clip.audio {
  background: var(--clip-audio);
}

.clip.gif {
  background: var(--clip-gif);
}

.clip.text {
  background: #8a5a2b;
}

.clip.selected {
  outline: 2px solid var(--playhead);
  z-index: 2;
}

.clip .label {
  flex: 1;
  padding: 0 8px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  font-size: 11px;
  pointer-events: none;
}

.handle {
  width: 6px;
  height: 100%;
  background: rgba(0, 0, 0, 0.25);
  cursor: ew-resize;
  flex: 0 0 6px;
}

.playhead {
  position: absolute;
  top: 0;
  bottom: 0;
  width: 12px;
  margin-left: -6px;
  background: transparent;
  pointer-events: auto;
  z-index: 5;
  cursor: ew-resize;
  touch-action: none;
}

.playhead::after {
  content: '';
  position: absolute;
  top: 0;
  bottom: 0;
  left: 5px;
  width: 2px;
  background: var(--playhead);
}

.playhead.scrubbing::after,
.playhead:hover::after {
  width: 3px;
  left: 4.5px;
  box-shadow: 0 0 0 1px rgba(0, 0, 0, 0.35);
}

.playhead-head {
  position: absolute;
  top: 0;
  left: 50%;
  width: 10px;
  height: 10px;
  margin-left: -5px;
  background: var(--playhead);
  clip-path: polygon(50% 100%, 0 0, 100% 0);
  pointer-events: none;
}

.lane-playhead .playhead-head {
  display: none;
}

.kf {
  position: absolute;
  top: 2px;
  width: 0;
  height: 0;
  border-left: 4px solid transparent;
  border-right: 4px solid transparent;
  border-bottom: 7px solid #fff;
  transform: translateX(-4px);
  pointer-events: none;
}
</style>
