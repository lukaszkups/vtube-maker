<script setup lang="ts">
import { computed } from 'vue'
import { useProjectStore } from '../stores/project'

const store = useProjectStore()

const timeLabel = computed(() => formatTime(store.playheadMs))
const durLabel = computed(() => formatTime(store.durationMs))
const fileLabel = computed(() => {
  const p = store.projectFilePath
  if (!p) return 'Unsaved'
  const parts = p.split(/[/\\]/)
  return parts[parts.length - 1] || p
})

function formatTime(ms: number): string {
  const s = Math.floor(ms / 1000)
  const m = Math.floor(s / 60)
  const r = s % 60
  const f = Math.floor((ms % 1000) / 10)
  return `${String(m).padStart(2, '0')}:${String(r).padStart(2, '0')}.${String(f).padStart(2, '0')}`
}

function togglePlay(): void {
  store.isPlaying = !store.isPlaying
}
</script>

<template>
  <header class="toolbar">
    <div class="brand">
      <span class="logo">VTube Maker</span>
      <span class="res" :title="store.projectFilePath || ''">
        1920×1080 · {{ store.project.fps }}fps · {{ fileLabel }}
      </span>
    </div>
    <div class="transport">
      <button type="button" @click="store.setPlayhead(0)" title="Go to start">Start</button>
      <button type="button" class="primary" @click="togglePlay">
        {{ store.isPlaying ? 'Pause' : 'Play' }}
      </button>
      <span class="time">{{ timeLabel }} / {{ durLabel }}</span>
    </div>
    <div class="actions">
      <button type="button" :disabled="!store.canUndo" title="Undo (Ctrl/Cmd+Z)" @click="store.undo()">
        Undo
      </button>
      <button type="button" @click="store.openFromFile()">Open</button>
      <button type="button" @click="store.save()">Save</button>
      <button type="button" @click="store.saveAs()">Save As</button>
      <button type="button" class="primary" @click="store.runExport()">Export</button>
    </div>
  </header>
</template>

<style scoped>
.toolbar {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 0 14px;
  background: var(--bg-panel);
  position: relative;
}

.brand {
  display: flex;
  flex-direction: column;
  min-width: 160px;
  max-width: 260px;
}

.logo {
  font-weight: 700;
  letter-spacing: 0.02em;
  font-size: 15px;
}

.res {
  color: var(--muted);
  font-size: 11px;
  font-family: var(--mono);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.transport,
.actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.transport {
  flex: 1;
  justify-content: center;
}

.time {
  font-family: var(--mono);
  color: var(--muted);
  margin-left: 8px;
}
</style>
