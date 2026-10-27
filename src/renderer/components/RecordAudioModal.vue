<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useAudioRecorder } from '../composables/useAudioRecorder'

const props = defineProps<{ open: boolean }>()
const emit = defineEmits<{
  close: []
  saved: []
}>()

const { isRecording, error, start, stop, saveBuffer } = useAudioRecorder()
const elapsedMs = ref(0)
const saving = ref(false)
let tickTimer: ReturnType<typeof setInterval> | null = null
let pendingBuffer: ArrayBuffer | null = null

const elapsedLabel = computed(() => {
  const s = Math.floor(elapsedMs.value / 1000)
  const m = Math.floor(s / 60)
  const r = s % 60
  return `${String(m).padStart(2, '0')}:${String(r).padStart(2, '0')}`
})

const hasTake = computed(() => !!pendingBuffer)

watch(
  () => props.open,
  (open) => {
    if (!open) {
      void discardSession()
    } else {
      elapsedMs.value = 0
      pendingBuffer = null
      error.value = null
    }
  }
)

function startTick(): void {
  stopTick()
  const started = Date.now() - elapsedMs.value
  tickTimer = setInterval(() => {
    elapsedMs.value = Date.now() - started
  }, 200)
}

function stopTick(): void {
  if (tickTimer) {
    clearInterval(tickTimer)
    tickTimer = null
  }
}

async function onStart(): Promise<void> {
  pendingBuffer = null
  elapsedMs.value = 0
  await start({
    autoSave: false,
    onStop: (buffer) => {
      pendingBuffer = buffer
      stopTick()
    }
  })
  if (isRecording.value) startTick()
}

function onStop(): void {
  stop()
  stopTick()
}

async function onSave(): Promise<void> {
  if (!pendingBuffer) return
  saving.value = true
  try {
    await saveBuffer(pendingBuffer)
    pendingBuffer = null
    emit('saved')
    emit('close')
  } finally {
    saving.value = false
  }
}

async function discardSession(): Promise<void> {
  stopTick()
  if (isRecording.value) stop({ discard: true })
  pendingBuffer = null
  elapsedMs.value = 0
}

async function onClose(): Promise<void> {
  await discardSession()
  emit('close')
}
</script>

<template>
  <div v-if="open" class="backdrop" @click.self="onClose">
    <div class="modal" role="dialog" aria-modal="true">
      <header>
        <h3>Record audio</h3>
        <button type="button" @click="onClose">×</button>
      </header>

      <div class="body">
        <p class="hint">
          Recording starts only when you press Start. Stop when finished, then add the take to the
          media library as MP3.
        </p>
        <div class="timer" :class="{ live: isRecording }">{{ elapsedLabel }}</div>
        <p v-if="error" class="err">{{ error }}</p>
        <p v-else-if="isRecording" class="status live">Recording…</p>
        <p v-else-if="hasTake" class="status">Take ready - add it to the library or record again.</p>
        <p v-else class="status">Idle</p>
      </div>

      <footer>
        <button v-if="!isRecording" type="button" class="primary" @click="onStart">
          {{ hasTake ? 'Re-record' : 'Start' }}
        </button>
        <button v-else type="button" class="danger" @click="onStop">Stop</button>
        <button
          type="button"
          class="primary"
          :disabled="!hasTake || saving || isRecording"
          @click="onSave"
        >
          {{ saving ? 'Saving…' : 'Add to library' }}
        </button>
        <button type="button" @click="onClose">Cancel</button>
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
  width: min(420px, 94vw);
  background: var(--bg-panel);
  border: 1px solid var(--border);
  border-radius: 8px;
  overflow: hidden;
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
}

.body {
  padding: 16px 14px;
  text-align: center;
}

.hint {
  color: var(--muted);
  font-size: 12px;
  line-height: 1.4;
  margin: 0 0 14px;
  text-align: left;
}

.timer {
  font-family: var(--mono);
  font-size: 36px;
  letter-spacing: 0.04em;
  margin-bottom: 8px;
}

.timer.live {
  color: var(--danger);
}

.status {
  margin: 0;
  color: var(--muted);
  font-size: 12px;
}

.status.live {
  color: var(--danger);
}

.err {
  color: var(--danger);
  font-size: 12px;
}

footer {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 8px;
  padding: 12px 14px;
  border-top: 1px solid var(--border);
}
</style>
