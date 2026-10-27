<script setup lang="ts">
import { computed } from 'vue'
import { useProjectStore } from '../stores/project'
import { evaluateTransform } from '@shared/keyframes'
import type { TransformProp } from '@shared/types'

const store = useProjectStore()

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

function setProp(key: TransformProp, raw: string): void {
  const clip = store.selectedClip
  if (!clip) return
  const value = Number(raw)
  if (!Number.isFinite(value)) return
  store.setTransform(clip.id, { [key]: value })
}

function addKf(key: TransformProp): void {
  const t = live.value
  if (!t) return
  store.addKeyframe(key, t[key])
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
      <p class="hint">Copy/paste applies transform + keyframes between clips (Ctrl/Cmd+C/V).</p>

      <div v-for="p in propsList" :key="p.key" class="field">
        <label>{{ p.label }}</label>
        <div class="controls">
          <input
            type="number"
            :step="p.step"
            :value="live[p.key]"
            @change="setProp(p.key, ($event.target as HTMLInputElement).value)"
          />
          <button type="button" title="Add keyframe" @click="addKf(p.key)">◆</button>
        </div>
      </div>

      <h3 class="sub">Keyframes</h3>
      <ul v-if="store.selectedClip.keyframes.length" class="kfs">
        <li v-for="kf in store.selectedClip.keyframes" :key="kf.id">
          <span>{{ kf.prop }} @ {{ kf.timeMs }}ms = {{ kf.value }}</span>
          <button type="button" @click="store.removeKeyframe(kf.id)">×</button>
        </li>
      </ul>
      <p v-else class="hint">No keyframes. Move playhead, change a value, click ◆.</p>
    </template>
    <p v-else class="hint">Select a clip on the timeline to edit position, scale, and keyframes.</p>
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

.field {
  margin-bottom: 8px;
}

.field label {
  display: block;
  color: var(--muted);
  font-size: 11px;
  margin-bottom: 2px;
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

.kfs {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.kfs li {
  display: flex;
  justify-content: space-between;
  gap: 6px;
  background: var(--bg-elevated);
  padding: 4px 6px;
  border-radius: 4px;
  font-family: var(--mono);
  font-size: 11px;
}

.hint {
  color: var(--muted);
  line-height: 1.4;
}
</style>
