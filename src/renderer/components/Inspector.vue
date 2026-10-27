<script setup lang="ts">
import { computed, ref } from 'vue'
import { useProjectStore } from '../stores/project'
import { evaluateTransform } from '@shared/keyframes'
import type { Keyframe, TextStyle, TransformProp } from '@shared/types'
import TextLabelModal from './TextLabelModal.vue'

const store = useProjectStore()
const textOpen = ref(false)

const selectedTextAsset = computed(() => {
  const clip = store.selectedClip
  if (!clip) return null
  const asset = store.getAsset(clip.assetId)
  return asset?.type === 'text' ? asset : null
})

const propsList: { key: TransformProp; label: string; step: number }[] = [
  { key: 'x', label: 'X', step: 1 },
  { key: 'y', label: 'Y', step: 1 },
  { key: 'scaleX', label: 'Scale X', step: 0.01 },
  { key: 'scaleY', label: 'Scale Y', step: 0.01 },
  { key: 'rotation', label: 'Rotation', step: 1 },
  { key: 'opacity', label: 'Opacity', step: 0.01 }
]

const live = computed(() => {
  const clip = store.selectedClip
  if (!clip) return null
  return evaluateTransform(clip, store.playheadMs)
})

const sortedKeyframes = computed(() => {
  const clip = store.selectedClip
  if (!clip) return [] as Keyframe[]
  return [...clip.keyframes].sort((a, b) => a.timeMs - b.timeMs || a.prop.localeCompare(b.prop))
})

const drag = ref<{
  kfId: string
  originX: number
  originTime: number
  moved: boolean
} | null>(null)

function hasKeyframe(prop: TransformProp): boolean {
  return !!store.selectedClip?.keyframes.some((k) => k.prop === prop)
}

function setProp(key: TransformProp, raw: string): void {
  const clip = store.selectedClip
  if (!clip) return
  const value = Number(raw)
  if (!Number.isFinite(value)) return
  store.setPropAtPlayhead(clip.id, key, value)
}

function addKf(key: TransformProp): void {
  const t = live.value
  if (!t) return
  store.addKeyframe(key, t[key])
}

function onKfPointerDown(e: PointerEvent, kf: Keyframe): void {
  if ((e.target as HTMLElement).closest('button')) return
  e.preventDefault()
  store.isPlaying = false
  store.seekToKeyframe(kf.id)
  store.beginGesture()
  drag.value = {
    kfId: kf.id,
    originX: e.clientX,
    originTime: kf.timeMs,
    moved: false
  }
  ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
}

function onKfPointerMove(e: PointerEvent): void {
  if (!drag.value) return
  const dx = e.clientX - drag.value.originX
  if (Math.abs(dx) > 3) drag.value.moved = true
  // Same scale as timeline: pixelsPerSecond
  const dMs = (dx / store.pixelsPerSecond) * 1000
  store.moveKeyframeTime(drag.value.kfId, drag.value.originTime + dMs, {
    seek: true,
    persist: false
  })
}

function onKfPointerUp(): void {
  if (!drag.value) return
  store.endGesture()
  drag.value = null
}

function onSaveText(style: TextStyle): void {
  const asset = selectedTextAsset.value
  if (!asset) return
  store.updateTextAsset(asset.id, style)
  textOpen.value = false
}
</script>

<template>
  <aside class="inspector">
    <h2 class="panel-title">Clip</h2>
    <template v-if="store.selectedClip && live">
      <div class="row-actions">
        <button type="button" @click="store.copyClipSettings()">Copy</button>
        <button type="button" :disabled="!store.clipboard" @click="store.pasteClipSettings()">
          Paste
        </button>
        <button type="button" class="danger" @click="store.removeClip(store.selectedClip.id)">
          Delete
        </button>
      </div>
      <div v-if="selectedTextAsset?.text" class="text-box">
        <p class="text-preview">{{ selectedTextAsset.text.content }}</p>
        <button type="button" @click="textOpen = true">Edit text</button>
      </div>
      <p class="hint">Copy/paste applies transform + keyframes between clips (Ctrl/Cmd+C/V).</p>

      <div v-for="p in propsList" :key="p.key" class="field">
        <label>
          {{ p.label }}
          <span v-if="hasKeyframe(p.key)" class="keyed" title="Property has keyframes">◆</span>
        </label>
        <div class="controls">
          <input
            type="number"
            :step="p.step"
            :value="live[p.key]"
            @change="setProp(p.key, ($event.target as HTMLInputElement).value)"
          />
          <button type="button" title="Add / update keyframe at playhead" @click="addKf(p.key)">
            ◆
          </button>
        </div>
      </div>

      <h3 class="sub">Keyframes</h3>
      <p v-if="sortedKeyframes.length" class="hint drag-hint">
        Drag left/right on a keyframe to move it earlier/later on the timeline.
      </p>
      <ul v-if="sortedKeyframes.length" class="kfs">
        <li
          v-for="kf in sortedKeyframes"
          :key="kf.id"
          class="kf-row"
          :class="{ dragging: drag?.kfId === kf.id }"
          @pointerdown="onKfPointerDown($event, kf)"
          @pointermove="onKfPointerMove"
          @pointerup="onKfPointerUp"
          @pointercancel="onKfPointerUp"
        >
          <span>{{ kf.prop }} @ {{ kf.timeMs }}ms = {{ kf.value }}</span>
          <button
            type="button"
            title="Remove keyframe"
            @pointerdown.stop
            @click.stop="store.removeKeyframe(kf.id)"
          >
            ×
          </button>
        </li>
      </ul>
      <p v-else class="hint">No keyframes. Move playhead, change a value, click ◆.</p>
    </template>
    <p v-else class="hint">Select a clip on the timeline to edit position, scale, and keyframes.</p>

    <TextLabelModal
      :open="textOpen"
      :initial="selectedTextAsset?.text || null"
      title="Edit text / label"
      @close="textOpen = false"
      @save="onSaveText"
    />
  </aside>
</template>

<style scoped>
.inspector {
  background: var(--bg-panel);
  padding: 12px;
  overflow: auto;
  min-height: 0;
}

.row-actions {
  display: flex;
  gap: 6px;
  margin-bottom: 8px;
}

.text-box {
  margin-bottom: 10px;
  padding: 8px;
  background: var(--bg-elevated);
  border-radius: 6px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.text-preview {
  margin: 0;
  white-space: pre-wrap;
  word-break: break-word;
  font-size: 12px;
}

.field {
  margin-bottom: 8px;
}

.field label {
  display: flex;
  align-items: center;
  gap: 4px;
  color: var(--muted);
  font-size: 11px;
  margin-bottom: 2px;
}

.keyed {
  color: var(--playhead);
  font-size: 9px;
}

.controls {
  display: grid;
  grid-template-columns: 1fr 32px;
  gap: 4px;
}

.sub {
  margin: 14px 0 6px;
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--muted);
}

.drag-hint {
  margin: 0 0 6px;
  font-size: 11px;
}

.kfs {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.kf-row {
  display: flex;
  justify-content: space-between;
  gap: 6px;
  background: var(--bg-elevated);
  padding: 4px 6px;
  border-radius: 4px;
  font-family: var(--mono);
  font-size: 11px;
  cursor: ew-resize;
  border: 1px solid transparent;
  touch-action: none;
}

.kf-row:hover,
.kf-row.dragging {
  border-color: var(--accent);
}

.kf-row.dragging {
  background: color-mix(in srgb, var(--accent) 22%, var(--bg-elevated));
}

.hint {
  color: var(--muted);
  line-height: 1.4;
}
</style>
