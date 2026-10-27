<script setup lang="ts">
import { computed, ref } from 'vue'
import { useProjectStore } from '../stores/project'
import WaveformThumb from './WaveformThumb.vue'
import TextLabelModal from './TextLabelModal.vue'
import RecordAudioModal from './RecordAudioModal.vue'
import ConfirmModal from './ConfirmModal.vue'
import type { TextStyle } from '@shared/types'

const store = useProjectStore()
const textOpen = ref(false)
const recordOpen = ref(false)
const editingAssetId = ref<string | null>(null)
const editInitial = ref<TextStyle | null>(null)
const pendingDeleteId = ref<string | null>(null)
const pendingDeleteName = ref('')

const deleteMessage = computed(
  () =>
    `Remove "${pendingDeleteName.value}" from the library? Clips using it will also be removed.`
)

function onDragStart(e: DragEvent, assetId: string): void {
  e.dataTransfer?.setData('application/x-vtube-asset', assetId)
  e.dataTransfer!.effectAllowed = 'copy'
}

function openNewText(): void {
  editingAssetId.value = null
  editInitial.value = null
  textOpen.value = true
}

function openEditText(assetId: string): void {
  const asset = store.getAsset(assetId)
  if (!asset?.text) return
  editingAssetId.value = assetId
  editInitial.value = { ...asset.text }
  textOpen.value = true
}

function onSaveText(style: TextStyle): void {
  if (editingAssetId.value) {
    store.updateTextAsset(editingAssetId.value, style)
  } else {
    store.addTextAsset(style)
  }
  textOpen.value = false
}

function requestDelete(assetId: string): void {
  const asset = store.getAsset(assetId)
  if (!asset) return
  pendingDeleteId.value = assetId
  pendingDeleteName.value = asset.name
}

function confirmDelete(): void {
  if (pendingDeleteId.value) {
    store.removeAsset(pendingDeleteId.value)
  }
  pendingDeleteId.value = null
  pendingDeleteName.value = ''
}

function cancelDelete(): void {
  pendingDeleteId.value = null
  pendingDeleteName.value = ''
}
</script>

<template>
  <aside class="library">
    <div class="head">
      <h2 class="panel-title">Media</h2>
    </div>
    <div class="actions">
      <button type="button" class="primary" @click="store.importAssets()">Import</button>
      <button type="button" @click="recordOpen = true">Record</button>
      <button type="button" @click="openNewText()">Text</button>
    </div>

    <ul v-if="store.project.assets.length" class="list">
      <li
        v-for="asset in store.project.assets"
        :key="asset.id"
        class="item"
        draggable="true"
        @dragstart="onDragStart($event, asset.id)"
        @dblclick="asset.type === 'text' ? openEditText(asset.id) : undefined"
      >
        <div class="thumb" :data-type="asset.type">
          <WaveformThumb
            v-if="asset.type === 'audio' && store.mediaUrls[asset.id]"
            :url="store.mediaUrls[asset.id]"
          />
          <img
            v-else-if="(asset.type === 'image' || asset.type === 'gif') && store.mediaUrls[asset.id]"
            :src="store.mediaUrls[asset.id]"
            alt=""
          />
          <span v-else-if="asset.type === 'text'" class="badge text">Aa</span>
          <span v-else class="badge">{{ asset.type }}</span>
        </div>
        <div class="meta">
          <div class="name" :title="asset.name">{{ asset.name }}</div>
          <div class="sub">
            {{ asset.type }}
            <template v-if="asset.durationMs"> · {{ Math.round(asset.durationMs / 100) / 10 }}s</template>
          </div>
        </div>
        <button
          type="button"
          class="del"
          title="Remove from library"
          @click.stop="requestDelete(asset.id)"
          @pointerdown.stop
        >
          ×
        </button>
      </li>
    </ul>
    <p v-else class="empty">
      Import media, record audio (MP3), or create a text label. Drag items onto the timeline.
    </p>

    <TextLabelModal
      :open="textOpen"
      :initial="editInitial"
      :title="editingAssetId ? 'Edit text / label' : 'New text / label'"
      @close="textOpen = false"
      @save="onSaveText"
    />
    <RecordAudioModal :open="recordOpen" @close="recordOpen = false" />
    <ConfirmModal
      :open="!!pendingDeleteId"
      title="Remove library item"
      :message="deleteMessage"
      confirm-label="Remove"
      danger
      @confirm="confirmDelete"
      @cancel="cancelDelete"
    />
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
  margin-bottom: 8px;
}

.actions {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-bottom: 10px;
}

.actions button {
  flex: 1 1 auto;
  min-width: 0;
  padding: 6px 8px;
  font-size: 12px;
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
  grid-template-columns: 56px 1fr 24px;
  gap: 8px;
  padding: 6px;
  border-radius: 6px;
  background: var(--bg-elevated);
  border: 1px solid transparent;
  cursor: grab;
  align-items: center;
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

.badge.text {
  font-size: 16px;
  font-weight: 700;
  text-transform: none;
  color: var(--playhead);
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

.del {
  width: 24px;
  height: 24px;
  padding: 0;
  line-height: 1;
  color: var(--muted);
  border-color: transparent;
  background: transparent;
}

.del:hover {
  color: var(--danger);
  border-color: var(--danger);
}

.empty {
  color: var(--muted);
  line-height: 1.4;
}
</style>
