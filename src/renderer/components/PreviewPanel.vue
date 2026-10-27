<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useProjectStore } from '../stores/project'
import { usePreviewEngine } from '../composables/usePreviewEngine'
import { evaluateTransform } from '@shared/keyframes'

const store = useProjectStore()
const canvasRef = ref<HTMLCanvasElement | null>(null)
const stageRef = ref<HTMLDivElement | null>(null)
const { startLoop } = usePreviewEngine(canvasRef)

const dragging = ref(false)
const dragMode = ref<'move' | 'scale' | null>(null)
const last = ref({ x: 0, y: 0 })

const scale = computed(() => {
  // CSS size vs canvas internal 1920x1080 - updated via resize observer conceptually; fixed fit
  return 1
})

onMounted(() => {
  startLoop()
})

const handleTransform = computed(() => {
  const clip = store.selectedClip
  if (!clip) return null
  if (clip.trackId.startsWith('A')) return null
  return evaluateTransform(clip, store.playheadMs)
})

function canvasPoint(e: PointerEvent): { x: number; y: number } | null {
  const canvas = canvasRef.value
  if (!canvas) return null
  const rect = canvas.getBoundingClientRect()
  const x = ((e.clientX - rect.left) / rect.width) * store.project.width
  const y = ((e.clientY - rect.top) / rect.height) * store.project.height
  return { x, y }
}

function onPointerDown(e: PointerEvent): void {
  const clip = store.selectedClip
  const t = handleTransform.value
  if (!clip || !t) return
  const p = canvasPoint(e)
  if (!p) return
  const asset = store.getAsset(clip.assetId)
  const sw = (asset?.width || 200) * t.scaleX
  const sh = (asset?.height || 200) * t.scaleY
  const hx = t.x + sw / 2
  const hy = t.y + sh / 2
  const nearHandle = Math.hypot(p.x - hx, p.y - hy) < 24
  dragMode.value = nearHandle ? 'scale' : 'move'
  dragging.value = true
  last.value = p
  ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
}

function onPointerMove(e: PointerEvent): void {
  if (!dragging.value || !store.selectedClip) return
  const p = canvasPoint(e)
  if (!p) return
  const dx = p.x - last.value.x
  const dy = p.y - last.value.y
  last.value = p
  const clip = store.selectedClip
  const t = evaluateTransform(clip, store.playheadMs)
  if (dragMode.value === 'move') {
    store.setTransform(clip.id, { x: t.x + dx, y: t.y + dy })
  } else if (dragMode.value === 'scale') {
    const factor = 1 + dx / 400
    store.setTransform(clip.id, {
      scaleX: Math.max(0.05, t.scaleX * factor),
      scaleY: Math.max(0.05, t.scaleY * factor)
    })
  }
}

function onPointerUp(): void {
  dragging.value = false
  dragMode.value = null
}

watch(
  () => store.mediaUrls,
  () => {
    /* engine picks up via store */
  },
  { deep: true }
)

void scale
</script>

<template>
  <section class="preview" ref="stageRef">
    <h2 class="panel-title">Preview</h2>
    <div class="stage">
      <canvas
        ref="canvasRef"
        class="canvas"
        @pointerdown="onPointerDown"
        @pointermove="onPointerMove"
        @pointerup="onPointerUp"
        @pointercancel="onPointerUp"
      />
      <div
        v-if="handleTransform"
        class="handles"
        :style="{
          left: (handleTransform.x / store.project.width) * 100 + '%',
          top: (handleTransform.y / store.project.height) * 100 + '%'
        }"
      >
        <span class="center-mark" />
      </div>
    </div>
  </section>
</template>

<style scoped>
.preview {
  background: var(--bg);
  padding: 12px;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

.stage {
  position: relative;
  flex: 1;
  min-height: 0;
  display: grid;
  place-items: center;
  background:
    linear-gradient(45deg, #161922 25%, transparent 25%),
    linear-gradient(-45deg, #161922 25%, transparent 25%),
    linear-gradient(45deg, transparent 75%, #161922 75%),
    linear-gradient(-45deg, transparent 75%, #161922 75%);
  background-size: 24px 24px;
  background-position: 0 0, 0 12px, 12px -12px, -12px 0;
  background-color: #0e1016;
  border-radius: 6px;
  overflow: hidden;
  border: 1px solid var(--border);
}

.canvas {
  max-width: 100%;
  max-height: 100%;
  width: auto;
  height: auto;
  aspect-ratio: 16 / 9;
  background: #000;
  cursor: move;
}

.handles {
  position: absolute;
  width: 0;
  height: 0;
  pointer-events: none;
}

.center-mark {
  position: absolute;
  width: 10px;
  height: 10px;
  margin: -5px 0 0 -5px;
  border: 2px solid var(--playhead);
  border-radius: 50%;
  box-shadow: 0 0 0 1px #000;
}
</style>
