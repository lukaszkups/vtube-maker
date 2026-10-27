<script setup lang="ts">
import { computed } from 'vue'
import { useProjectStore } from '../stores/project'

const store = useProjectStore()

const visible = computed(() => !!store.exportProgress && store.exportProgress.phase !== 'done')
const done = computed(() => store.exportProgress?.phase === 'done')
const errored = computed(() => store.exportProgress?.phase === 'error')

const percent = computed(() => {
  const p = store.exportProgress
  if (!p || !p.totalFrames) return 0
  return Math.round((p.currentFrame / p.totalFrames) * 100)
})

function dismiss(): void {
  store.exportProgress = null
}
</script>

<template>
  <div v-if="store.exportProgress" class="overlay">
    <div class="card">
      <h3 v-if="errored">Export failed</h3>
      <h3 v-else-if="done">Export complete</h3>
      <h3 v-else>Exporting…</h3>
      <p class="msg">
        <template v-if="errored || done">{{ store.exportProgress.message }}</template>
        <template v-else>
          {{ store.exportProgress.phase }} · {{ store.exportProgress.currentFrame }} /
          {{ store.exportProgress.totalFrames }} frames ({{ percent }}%)
        </template>
      </p>
      <div v-if="visible" class="bar">
        <i :style="{ width: percent + '%' }" />
      </div>
      <button v-if="done || errored" type="button" class="primary" @click="dismiss">Close</button>
    </div>
  </div>
</template>

<style scoped>
.overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.55);
  display: grid;
  place-items: center;
  z-index: 50;
}

.card {
  background: var(--bg-panel);
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 20px 24px;
  width: min(420px, 90vw);
}

h3 {
  margin: 0 0 8px;
}

.msg {
  color: var(--muted);
  word-break: break-all;
}

.bar {
  height: 8px;
  background: var(--bg);
  border-radius: 4px;
  overflow: hidden;
  margin: 12px 0 0;
}

.bar i {
  display: block;
  height: 100%;
  background: var(--accent);
}
</style>
