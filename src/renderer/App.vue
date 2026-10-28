<script setup lang="ts">
import { onMounted, onUnmounted } from 'vue'
import { useProjectStore } from './stores/project'
import { usePanelLayout } from './composables/usePanelLayout'
import Toolbar from './components/Toolbar.vue'
import MediaLibrary from './components/MediaLibrary.vue'
import PreviewPanel from './components/PreviewPanel.vue'
import Inspector from './components/Inspector.vue'
import Timeline from './components/Timeline.vue'
import ExportOverlay from './components/ExportOverlay.vue'

const store = useProjectStore()
const { leftWidth, rightWidth, timelineHeight, startResize } = usePanelLayout()

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
    <div
      class="workspace"
      :style="{
        gridTemplateRows: `minmax(0, 1fr) 5px ${timelineHeight}px`
      }"
    >
      <div
        class="main-row"
        :style="{
          gridTemplateColumns: `${leftWidth}px 5px minmax(0, 1fr) 5px ${rightWidth}px`
        }"
      >
        <MediaLibrary />
        <div
          class="splitter col"
          title="Drag to resize"
          @pointerdown="startResize('left', $event)"
        />
        <PreviewPanel />
        <div
          class="splitter col"
          title="Drag to resize"
          @pointerdown="startResize('right', $event)"
        />
        <Inspector />
      </div>
      <div
        class="splitter row"
        title="Drag to resize timeline"
        @pointerdown="startResize('timeline', $event)"
      />
      <Timeline />
    </div>
    <ExportOverlay />
  </div>
</template>

<style scoped>
.app-shell {
  display: grid;
  grid-template-rows: 48px minmax(0, 1fr);
  height: 100%;
  background:
    radial-gradient(1200px 600px at 10% -10%, #1c2436 0%, transparent 55%),
    radial-gradient(900px 500px at 90% 0%, #1a2822 0%, transparent 50%),
    var(--bg);
}

.workspace {
  display: grid;
  min-height: 0;
}

.main-row {
  display: grid;
  min-height: 0;
  background: var(--border);
  border-top: 1px solid var(--border);
}

.splitter {
  background: var(--border);
  position: relative;
  z-index: 3;
  transition: background 0.12s ease;
}

.splitter:hover,
.splitter:active {
  background: var(--accent);
}

.splitter.col {
  cursor: col-resize;
  touch-action: none;
}

.splitter.row {
  cursor: row-resize;
  touch-action: none;
}
</style>
