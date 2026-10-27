<script setup lang="ts">
import { useProjectStore } from '../stores/project'

const store = useProjectStore()

function onDragStart(e: DragEvent, assetId: string): void {
  e.dataTransfer?.setData('application/x-vtube-asset', assetId)
  e.dataTransfer!.effectAllowed = 'copy'
}
</script>

<template>
  <aside class="library">
    <div class="head">
      <h2 class="panel-title">Media</h2>
      <button type="button" class="primary" @click="store.importAssets()">Import</button>
    </div>
    <ul v-if="store.project.assets.length" class="list">
      <li
        v-for="asset in store.project.assets"
        :key="asset.id"
        class="item"
        draggable="true"
        @dragstart="onDragStart($event, asset.id)"
      >
        <div class="thumb" :data-type="asset.type">
          <img
            v-if="(asset.type === 'image' || asset.type === 'gif') && store.mediaUrls[asset.id]"
            :src="store.mediaUrls[asset.id]"
            alt=""
          />
          <span v-else class="badge">{{ asset.type }}</span>
        </div>
        <div class="meta">
          <div class="name" :title="asset.name">{{ asset.name }}</div>
          <div class="sub">
            {{ asset.type }}
            <template v-if="asset.durationMs"> · {{ Math.round(asset.durationMs / 100) / 10 }}s</template>
          </div>
        </div>
      </li>
    </ul>
    <p v-else class="empty">Import images, GIFs, video, or audio. Drag onto the timeline.</p>
  </aside>
</template>

<style scoped>
.library {
  background: var(--bg-panel);
  padding: 12px;
  overflow: auto;
  min-height: 0;
}

.head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 10px;
}

.list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.item {
  display: grid;
  grid-template-columns: 56px 1fr;
  gap: 8px;
  padding: 6px;
  border-radius: 6px;
  background: var(--bg-elevated);
  border: 1px solid transparent;
  cursor: grab;
}

.item:hover {
  border-color: var(--accent);
}

.thumb {
  width: 56px;
  height: 40px;
  border-radius: 4px;
  overflow: hidden;
  background: #0d0f14;
  display: grid;
  place-items: center;
}

.thumb img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.badge {
  font-size: 10px;
  text-transform: uppercase;
  color: var(--muted);
}

.name {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  font-weight: 600;
}

.sub {
  color: var(--muted);
  font-size: 11px;
}

.empty {
  color: var(--muted);
  line-height: 1.4;
}
</style>
