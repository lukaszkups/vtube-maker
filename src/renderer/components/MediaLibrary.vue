<script setup lang="ts">
import { computed, ref } from 'vue'
import { useProjectStore } from '../stores/project'
import WaveformThumb from './WaveformThumb.vue'
import TextLabelModal from './TextLabelModal.vue'
import RecordAudioModal from './RecordAudioModal.vue'
import ConfirmModal from './ConfirmModal.vue'
import type { Asset, AssetType, TextStyle } from '@shared/types'

type LibraryFilter = 'all' | 'audio' | 'video' | 'images' | 'labels'

const store = useProjectStore()
const textOpen = ref(false)
const recordOpen = ref(false)
const editingAssetId = ref<string | null>(null)
const editInitial = ref<TextStyle | null>(null)
const pendingDeleteId = ref<string | null>(null)
const pendingDeleteName = ref('')
const filter = ref<LibraryFilter>('all')

const filters: { id: LibraryFilter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'audio', label: 'Audio' },
  { id: 'video', label: 'Video' },
  { id: 'images', label: 'Images' },
  { id: 'labels', label: 'Labels' }
]

const deleteMessage = computed(
  () =>
    `Remove "${pendingDeleteName.value}" from the library? Clips using it will also be removed.`
)

function matchesFilter(asset: Asset, f: LibraryFilter): boolean {
  if (f === 'all') return true
  if (f === 'audio') return asset.type === 'audio'
  if (f === 'video') return asset.type === 'video'
  if (f === 'images') return asset.type === 'image' || asset.type === 'gif'
  if (f === 'labels') return asset.type === 'text'
  return true
}

const filteredAssets = computed(() =>
  store.project.assets.filter((a) => matchesFilter(a, filter.value))
)

function displayTitle(asset: Asset): string {
  if (asset.type === 'text' && asset.text?.content) return asset.text.content
  return asset.name
}

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

function closeRecordModal(): void {
  recordOpen.value = false
}

function onRecordingSaved(): void {
  recordOpen.value = false
  filter.value = 'audio'
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

function typeLabel(type: AssetType): string {
  if (type === 'text') return 'label'
  if (type === 'gif') return 'image'
  return type
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

    <div class="filters" role="tablist" aria-label="Library filters">
      <button
        v-for="f in filters"
        :key="f.id"
        type="button"
        role="tab"
        :aria-selected="filter === f.id"
        :class="{ active: filter === f.id }"
        @click="filter = f.id"
      >
        {{ f.label }}
      </button>
    </div>

    <ul v-if="filteredAssets.length" class="list">
      <li
        v-for="asset in filteredAssets"
        :key="asset.id"
        class="item"
        draggable="true"
        @dragstart="onDragStart($event, asset.id)"
        @dblclick="asset.type === 'text' ? openEditText(asset.id) : undefined"
      >
        <button
          type="button"
          class="del"
          title="Remove from library"
          @click.stop="requestDelete(asset.id)"
          @pointerdown.stop
        >
          ×
        </button>
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
          <div class="name" :title="displayTitle(asset)">{{ displayTitle(asset) }}</div>
          <div class="sub">
            {{ typeLabel(asset.type) }}
            <template v-if="asset.durationMs"> · {{ Math.round(asset.durationMs / 100) / 10 }}s</template>
          </div>
        </div>
      </li>
    </ul>
    <p v-else-if="store.project.assets.length" class="empty">
      No items in this filter. Try another filter or import more media.
    </p>
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
    <RecordAudioModal
      :open="recordOpen"
      @close="closeRecordModal"
      @saved="onRecordingSaved"
    />
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
  min-width: 0;
}

.head {
  margin-bottom: 8px;
}

.actions {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-bottom: 8px;
}

.actions button {
  flex: 1 1 auto;
  min-width: 0;
  padding: 6px 8px;
  font-size: 12px;
}

.filters {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  margin-bottom: 10px;
}

.filters button {
  padding: 3px 8px;
  font-size: 11px;
  border-radius: 4px;
  background: transparent;
  border-color: var(--border);
  color: var(--muted);
}

.filters button.active {
  background: var(--bg-elevated);
  border-color: var(--accent);
  color: var(--text);
}

.list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(128px, 1fr));
  gap: 8px;
}

.item {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 8px;
  border-radius: 6px;
  background: var(--bg-elevated);
  border: 1px solid transparent;
  cursor: grab;
  min-width: 0;
}

.item:hover {
  border-color: var(--accent);
}

.thumb {
  width: 100%;
  aspect-ratio: 16 / 10;
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
  font-size: 22px;
  font-weight: 700;
  text-transform: none;
  color: var(--playhead);
}

.meta {
  min-width: 0;
}

.name {
  font-weight: 600;
  font-size: 12px;
  line-height: 1.35;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
  word-break: break-word;
  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 4;
  line-clamp: 4;
  overflow: hidden;
  max-height: calc(1.35em * 4);
}

.sub {
  color: var(--muted);
  font-size: 11px;
  margin-top: 2px;
}

.del {
  position: absolute;
  top: 4px;
  right: 4px;
  width: 22px;
  height: 22px;
  padding: 0;
  line-height: 1;
  color: var(--muted);
  border-color: transparent;
  background: rgba(18, 20, 26, 0.75);
  z-index: 1;
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
