<script setup lang="ts">
import { onMounted, onUnmounted } from 'vue'
import { useProjectStore } from './stores/project'
import Toolbar from './components/Toolbar.vue'
import MediaLibrary from './components/MediaLibrary.vue'
import PreviewPanel from './components/PreviewPanel.vue'
import Inspector from './components/Inspector.vue'
import Timeline from './components/Timeline.vue'
import ExportOverlay from './components/ExportOverlay.vue'

const store = useProjectStore()

function onKey(e: KeyboardEvent): void {
  const meta = e.metaKey || e.ctrlKey
  const tag = (e.target as HTMLElement)?.tagName
  const typing = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT'

  if (meta && e.key.toLowerCase() === 'z' && !e.shiftKey) {
    if (!typing) {
      store.undo()
      e.preventDefault()
    }
    return
  }
  if (meta && e.key.toLowerCase() === 's') {
    if (e.shiftKey) void store.saveAs()
    else void store.save()
    e.preventDefault()
    return
  }
  if (meta && e.key.toLowerCase() === 'o') {
    void store.openFromFile()
    e.preventDefault()
    return
  }
  if (meta && e.key.toLowerCase() === 'c') {
    if (!typing) {
      store.copyClipSettings()
      e.preventDefault()
    }
  }
  if (meta && e.key.toLowerCase() === 'v') {
    if (!typing) {
      store.pasteClipSettings()
      e.preventDefault()
    }
  }
  if (e.key === 'Delete' || e.key === 'Backspace') {
    if (typing) return
    if (store.selectedClipId) {
      store.removeClip(store.selectedClipId)
      e.preventDefault()
    }
  }
  if (e.key === ' ') {
    if (typing) return
    store.isPlaying = !store.isPlaying
    e.preventDefault()
  }
}

let offMenu: (() => void) | null = null

function onMenuCommand(command: 'open' | 'save' | 'saveAs'): void {
  if (command === 'open') void store.openFromFile()
  else if (command === 'save') void store.save()
  else if (command === 'saveAs') void store.saveAs()
}

onMounted(async () => {
  await store.load()
  window.addEventListener('keydown', onKey)
  offMenu = window.api.onMenuCommand(onMenuCommand)
})

onUnmounted(() => {
  window.removeEventListener('keydown', onKey)
  offMenu?.()
})
</script>

<template>
  <div class="app-shell">
    <Toolbar />
    <div class="main-row">
      <MediaLibrary />
      <PreviewPanel />
      <Inspector />
    </div>
    <Timeline />
    <ExportOverlay />
  </div>
</template>

<style scoped>
.app-shell {
  display: grid;
  grid-template-rows: 48px minmax(0, 1fr) 280px;
  height: 100%;
  background:
    radial-gradient(1200px 600px at 10% -10%, #1c2436 0%, transparent 55%),
    radial-gradient(900px 500px at 90% 0%, #1a2822 0%, transparent 50%),
    var(--bg);
}

.main-row {
  display: grid;
  grid-template-columns: 240px minmax(0, 1fr) 280px;
  gap: 1px;
  min-height: 0;
  background: var(--border);
  border-top: 1px solid var(--border);
  border-bottom: 1px solid var(--border);
}
</style>
