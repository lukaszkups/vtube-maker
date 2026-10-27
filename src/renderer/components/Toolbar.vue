<script setup lang="ts">
import { computed } from 'vue'
import { useProjectStore } from '../stores/project'
import { useAudioRecorder } from '../composables/useAudioRecorder'

const store = useProjectStore()
const recorder = useAudioRecorder()

const timeLabel = computed(() => formatTime(store.playheadMs))
const durLabel = computed(() => formatTime(store.durationMs))

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
      <span class="res">1920×1080 · {{ store.project.fps }}fps</span>
    </div>
    <div class="transport">
      <button type="button" @click="store.setPlayhead(0)" title="Go to start">Start</button>
      <button type="button" class="primary" @click="togglePlay">
        {{ store.isPlaying ? 'Pause' : 'Play' }}
      </button>
      <span class="time">{{ timeLabel }} / {{ durLabel }}</span>
    </div>
    <div class="actions">
      <button
        type="button"
        :class="{ danger: recorder.isRecording }"
        @click="recorder.toggle()"
      >
        {{ recorder.isRecording ? 'Stop Rec' : 'Record Audio' }}
      </button>
      <button type="button" @click="store.save()">Save</button>
      <button type="button" class="primary" @click="store.runExport()">Export</button>
    </div>
    <p v-if="recorder.error" class="err">{{ recorder.error }}</p>
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

.err {
  position: absolute;
  right: 14px;
  bottom: -2px;
  margin: 0;
  color: var(--danger);
  font-size: 11px;
}
</style>
