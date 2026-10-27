<script setup lang="ts">
import { computed, ref } from 'vue'
import { useProjectStore } from '../stores/project'
import type { TrackId } from '@shared/types'

const store = useProjectStore()
const rulerRef = ref<HTMLElement | null>(null)

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
  const scrollLeft = rulerRef.value?.scrollLeft || 0
  const x = e.clientX - rect.left + scrollLeft
  store.addClipFromAsset(assetId, trackId, xToMs(x))
}

function seekFromEvent(e: MouseEvent): void {
  const el = e.currentTarget as HTMLElement
  const rect = el.getBoundingClientRect()
  const x = e.clientX - rect.left + el.scrollLeft
  store.setPlayhead(xToMs(x))
}

type DragKind = 'move' | 'resize-start' | 'resize-end'
const drag = ref<{
  kind: DragKind
  clipId: string
  originX: number
  originStart: number
  originDuration: number
} | null>(null)

function startClipDrag(e: PointerEvent, clipId: string, kind: DragKind): void {
  e.stopPropagation()
  e.preventDefault()
  const clip = store.project.clips.find((c) => c.id === clipId)
  if (!clip) return
  store.selectClip(clipId)
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
  if (drag.value.kind === 'move') {
    store.moveClip(drag.value.clipId, drag.value.originStart + dMs)
  } else if (drag.value.kind === 'resize-end') {
    const end = drag.value.originStart + drag.value.originDuration + dMs
    store.resizeClip(drag.value.clipId, 'end', end)
  } else {
    store.resizeClip(drag.value.clipId, 'start', drag.value.originStart + dMs)
  }
}

function endClipDrag(): void {
  drag.value = null
}

function onLanePointerDown(e: PointerEvent, trackId: TrackId): void {
  if ((e.target as HTMLElement).closest('.clip')) return
  const lane = e.currentTarget as HTMLElement
  const rect = lane.getBoundingClientRect()
  const x = e.clientX - rect.left
  store.setPlayhead(xToMs(x))
  store.selectClip(null)
  void trackId
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
    <div class="timeline-scroll" ref="rulerRef">
      <div class="ruler" :style="{ width: timelineWidth + 'px' }" @click="seekFromEvent">
        <div
          v-for="s in Math.ceil(timelineWidth / store.pixelsPerSecond)"
          :key="s"
          class="tick"
          :style="{ left: s * store.pixelsPerSecond + 'px' }"
        >
          {{ s }}s
        </div>
        <div class="playhead" :style="{ left: msToX(store.playheadMs) + 'px' }" />
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
          <div class="playhead" :style="{ left: msToX(store.playheadMs) + 'px' }" />
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
}

.tick {
  position: absolute;
  top: 0;
  transform: translateX(-50%);
  font-size: 10px;
  color: var(--muted);
  font-family: var(--mono);
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
  width: 2px;
  background: var(--playhead);
  pointer-events: none;
  z-index: 5;
  transform: translateX(-1px);
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
