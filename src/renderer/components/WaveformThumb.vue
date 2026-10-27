<script setup lang="ts">
import { onMounted, ref, watch } from 'vue'
import { getWaveformPeaks } from '../composables/useWaveformPeaks'

const props = defineProps<{ url: string }>()
const canvasRef = ref<HTMLCanvasElement | null>(null)

async function draw(): Promise<void> {
  const canvas = canvasRef.value
  if (!canvas || !props.url) return
  const ctx = canvas.getContext('2d')
  if (!ctx) return
  const w = canvas.width
  const h = canvas.height
  ctx.clearRect(0, 0, w, h)
  ctx.fillStyle = '#12151c'
  ctx.fillRect(0, 0, w, h)
  try {
    const peaks = await getWaveformPeaks(props.url, Math.floor(w / 2))
    const mid = h / 2
    const barW = w / peaks.length
    ctx.fillStyle = '#3a9b6a'
    for (let i = 0; i < peaks.length; i++) {
      const amp = Math.max(1, peaks[i] * (h * 0.45))
      ctx.fillRect(i * barW, mid - amp, Math.max(1, barW * 0.7), amp * 2)
    }
  } catch {
    ctx.fillStyle = '#3a9b6a'
    ctx.font = '10px sans-serif'
    ctx.fillText('audio', 8, h / 2 + 3)
  }
}

onMounted(() => void draw())
watch(() => props.url, () => void draw())
</script>

<template>
  <canvas ref="canvasRef" class="wave" width="112" height="40" />
</template>

<style scoped>
.wave {
  width: 100%;
  height: 100%;
  display: block;
}
</style>
