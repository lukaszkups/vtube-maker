<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import type { TextStyle } from '@shared/types'
import { defaultTextStyle } from '@shared/types'

const props = defineProps<{
  open: boolean
  initial?: TextStyle | null
  title?: string
}>()

const emit = defineEmits<{
  close: []
  save: [style: TextStyle]
}>()

const fonts = ref<string[]>(['sans-serif', 'serif', 'monospace'])
const draft = ref<TextStyle>(defaultTextStyle())
const previewRef = ref<HTMLCanvasElement | null>(null)

const weights = ['100', '200', '300', '400', '500', '600', '700', '800', '900']

watch(
  () => props.open,
  (open) => {
    if (open) {
      draft.value = props.initial ? { ...props.initial } : defaultTextStyle()
      void paintPreview()
    }
  }
)

watch(draft, () => void paintPreview(), { deep: true })

onMounted(async () => {
  try {
    const list = await window.api.listFonts()
    if (list.length) fonts.value = list
  } catch {
    /* keep fallbacks */
  }
})

function paintPreview(): void {
  const canvas = previewRef.value
  if (!canvas) return
  const ctx = canvas.getContext('2d')
  if (!ctx) return
  const w = canvas.width
  const h = canvas.height
  ctx.fillStyle = '#0e1016'
  ctx.fillRect(0, 0, w, h)
  // checker
  const s = 12
  for (let y = 0; y < h; y += s) {
    for (let x = 0; x < w; x += s) {
      if ((x / s + y / s) % 2 === 0) {
        ctx.fillStyle = '#161922'
        ctx.fillRect(x, y, s, s)
      }
    }
  }
  const style = draft.value
  const scale = Math.min(1, 280 / Math.max(style.fontSize, 1))
  ctx.save()
  ctx.translate(w / 2, h / 2)
  ctx.font = `${style.fontStyle} ${style.fontWeight} ${style.fontSize * scale}px "${style.fontFamily}"`
  ctx.textAlign = style.align
  ctx.textBaseline = 'middle'
  const lines = style.content.split('\n')
  const fs = style.fontSize * scale
  const blockH = lines.length * fs * style.lineHeight
  const startY = -blockH / 2 + fs * style.lineHeight * 0.5
  if (style.strokeWidth > 0) {
    ctx.strokeStyle = style.strokeColor
    ctx.lineWidth = style.strokeWidth * scale
    ctx.lineJoin = 'round'
  }
  ctx.fillStyle = style.color
  for (let i = 0; i < lines.length; i++) {
    const y = startY + i * fs * style.lineHeight
    if (style.strokeWidth > 0) ctx.strokeText(lines[i], 0, y)
    ctx.fillText(lines[i], 0, y)
  }
  ctx.restore()
}

function onSave(): void {
  if (!draft.value.content.trim()) return
  emit('save', { ...draft.value })
}

const canSave = computed(() => draft.value.content.trim().length > 0)
</script>

<template>
  <div v-if="open" class="backdrop" @click.self="emit('close')">
    <div class="modal" role="dialog" aria-modal="true">
      <header>
        <h3>{{ title || 'Text / Label' }}</h3>
        <button type="button" @click="emit('close')">×</button>
      </header>

      <div class="body">
        <label class="full">
          Text
          <textarea v-model="draft.content" rows="3" placeholder="Enter label text" />
        </label>

        <label>
          Font
          <select v-model="draft.fontFamily">
            <option v-for="f in fonts" :key="f" :value="f" :style="{ fontFamily: f }">
              {{ f }}
            </option>
          </select>
        </label>

        <label>
          Size
          <input v-model.number="draft.fontSize" type="number" min="8" max="400" step="1" />
        </label>

        <label>
          Weight
          <select v-model="draft.fontWeight">
            <option v-for="w in weights" :key="w" :value="w">{{ w }}</option>
          </select>
        </label>

        <label>
          Style
          <select v-model="draft.fontStyle">
            <option value="normal">Normal</option>
            <option value="italic">Italic</option>
          </select>
        </label>

        <label>
          Align
          <select v-model="draft.align">
            <option value="left">Left</option>
            <option value="center">Center</option>
            <option value="right">Right</option>
          </select>
        </label>

        <label>
          Color
          <input v-model="draft.color" type="color" />
        </label>

        <label>
          Stroke
          <input v-model="draft.strokeColor" type="color" />
        </label>

        <label>
          Stroke width
          <input v-model.number="draft.strokeWidth" type="number" min="0" max="40" step="1" />
        </label>

        <label>
          Line height
          <input v-model.number="draft.lineHeight" type="number" min="0.8" max="3" step="0.05" />
        </label>

        <div class="preview-wrap full">
          <span class="lbl">Preview</span>
          <canvas ref="previewRef" width="420" height="160" />
        </div>
      </div>

      <footer>
        <button type="button" @click="emit('close')">Cancel</button>
        <button type="button" class="primary" :disabled="!canSave" @click="onSave">Save</button>
      </footer>
    </div>
  </div>
</template>

<style scoped>
.backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.6);
  display: grid;
  place-items: center;
  z-index: 60;
}

.modal {
  width: min(520px, 94vw);
  max-height: 90vh;
  overflow: auto;
  background: var(--bg-panel);
  border: 1px solid var(--border);
  border-radius: 8px;
  display: flex;
  flex-direction: column;
}

header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 14px;
  border-bottom: 1px solid var(--border);
}

header h3 {
  margin: 0;
  font-size: 15px;
}

.body {
  padding: 12px 14px;
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
}

label {
  display: flex;
  flex-direction: column;
  gap: 4px;
  font-size: 11px;
  color: var(--muted);
}

label.full {
  grid-column: 1 / -1;
}

textarea,
select,
input[type='number'],
input[type='color'] {
  background: var(--bg);
  border: 1px solid var(--border);
  border-radius: 4px;
  padding: 6px 8px;
  color: var(--text);
  font: inherit;
}

input[type='color'] {
  height: 34px;
  padding: 2px;
}

.preview-wrap {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.preview-wrap .lbl {
  font-size: 11px;
  color: var(--muted);
}

.preview-wrap canvas {
  width: 100%;
  border-radius: 6px;
  border: 1px solid var(--border);
  background: #0e1016;
}

footer {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  padding: 12px 14px;
  border-top: 1px solid var(--border);
}
</style>
