<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useProjectStore } from '../stores/project'

const store = useProjectStore()
const fileMenuOpen = ref(false)
const fileMenuRef = ref<HTMLElement | null>(null)

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

function toggleFileMenu(): void {
  fileMenuOpen.value = !fileMenuOpen.value
}

function closeFileMenu(): void {
  fileMenuOpen.value = false
}

async function onOpen(): Promise<void> {
  closeFileMenu()
  await store.openFromFile()
}

async function onSave(): Promise<void> {
  closeFileMenu()
  await store.save()
}

async function onSaveAs(): Promise<void> {
  closeFileMenu()
  await store.saveAs()
}

function onDocPointerDown(e: PointerEvent): void {
  if (!fileMenuOpen.value) return
  const el = fileMenuRef.value
  if (el && !el.contains(e.target as Node)) closeFileMenu()
}

onMounted(() => {
  document.addEventListener('pointerdown', onDocPointerDown)
})

onUnmounted(() => {
  document.removeEventListener('pointerdown', onDocPointerDown)
})
</script>

<template>
  <header class="toolbar">
    <div class="brand">
      <span class="logo">VTube Maker</span>
      <span class="res" :title="store.projectFilePath || ''">
        1920×1080 · {{ store.project.fps }}fps · {{ fileLabel }}
      </span>
    </div>

    <div class="menubar">
      <div class="menu" ref="fileMenuRef">
        <button
          type="button"
          class="menu-trigger"
          :aria-expanded="fileMenuOpen"
          @click="toggleFileMenu"
        >
          File
        </button>
        <div v-if="fileMenuOpen" class="menu-dropdown" role="menu">
          <button type="button" role="menuitem" @click="onOpen">
            Open…
            <span class="kbd">Ctrl+O</span>
          </button>
          <button type="button" role="menuitem" @click="onSave">
            Save
            <span class="kbd">Ctrl+S</span>
          </button>
          <button type="button" role="menuitem" @click="onSaveAs">
            Save As…
            <span class="kbd">Ctrl+Shift+S</span>
          </button>
        </div>
      </div>
    </div>

    <div class="transport">
      <button type="button" @click="store.setPlayhead(0)" title="Go to start">Start</button>
      <button type="button" class="primary" @click="togglePlay">
        {{ store.isPlaying ? 'Pause' : 'Play' }}
      </button>
      <span class="time">{{ timeLabel }} / {{ durLabel }}</span>
    </div>
    <div class="actions">
      <span v-if="store.saveStatus" class="status">{{ store.saveStatus }}</span>
      <button type="button" :disabled="!store.canUndo" title="Undo (Ctrl/Cmd+Z)" @click="store.undo()">
        Undo
      </button>
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
  min-width: 140px;
  max-width: 220px;
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

.menubar {
  display: flex;
  align-items: center;
}

.menu {
  position: relative;
}

.menu-trigger {
  background: transparent;
  border-color: transparent;
  padding: 6px 10px;
}

.menu-trigger:hover,
.menu-trigger[aria-expanded='true'] {
  background: var(--bg-elevated);
  border-color: var(--border);
}

.menu-dropdown {
  position: absolute;
  top: calc(100% + 4px);
  left: 0;
  min-width: 200px;
  background: var(--bg-elevated);
  border: 1px solid var(--border);
  border-radius: 6px;
  padding: 4px;
  z-index: 40;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.35);
}

.menu-dropdown button {
  width: 100%;
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 16px;
  background: transparent;
  border-color: transparent;
  text-align: left;
  padding: 7px 10px;
  border-radius: 4px;
}

.menu-dropdown button:hover {
  background: var(--bg);
  border-color: transparent;
}

.kbd {
  color: var(--muted);
  font-size: 10px;
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

.status {
  color: var(--accent-2);
  font-size: 11px;
  max-width: 180px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
</style>
