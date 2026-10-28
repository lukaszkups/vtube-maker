<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import {
  listAudioInputDevices,
  useAudioRecorder,
  type AudioInputDevice
} from '../composables/useAudioRecorder'

const props = defineProps<{ open: boolean }>()
const emit = defineEmits<{
  close: []
  saved: []
}>()

const { isRecording, error, start, stop, saveBuffer } = useAudioRecorder()
const elapsedMs = ref(0)
const saving = ref(false)
const pendingBuffer = ref<ArrayBuffer | null>(null)
const devices = ref<AudioInputDevice[]>([])
const selectedDeviceId = ref('')
const loadingDevices = ref(false)
let tickTimer: ReturnType<typeof setInterval> | null = null

const elapsedLabel = computed(() => {
  const s = Math.floor(elapsedMs.value / 1000)
  const m = Math.floor(s / 60)
  const r = s % 60
  return `${String(m).padStart(2, '0')}:${String(r).padStart(2, '0')}`
})

const hasTake = computed(() => !!pendingBuffer.value)

async function refreshDevices(): Promise<void> {
  loadingDevices.value = true
  try {
    const list = await listAudioInputDevices()
    devices.value = list
    if (!list.length) {
      selectedDeviceId.value = ''
      return
    }
    const stillThere = list.some((d) => d.deviceId === selectedDeviceId.value)
    if (!stillThere) {
      selectedDeviceId.value = list[0].deviceId
    }
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Could not list microphones'
  } finally {
    loadingDevices.value = false
  }
}

watch(
  () => props.open,
  (open) => {
    if (!open) {
      void discardSession()
    } else {
      elapsedMs.value = 0
      pendingBuffer.value = null
      error.value = null
      void refreshDevices()
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
  pendingBuffer.value = null
  elapsedMs.value = 0
  await start({
    autoSave: false,
    deviceId: selectedDeviceId.value || undefined,
    onStop: (buffer) => {
      pendingBuffer.value = buffer
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
  if (!pendingBuffer.value || saving.value) return
  saving.value = true
  const buffer = pendingBuffer.value
  try {
    await saveBuffer(buffer)
    pendingBuffer.value = null
    saving.value = false
    emit('saved')
    emit('close')
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Failed to save recording'
    saving.value = false
  }
}

async function discardSession(): Promise<void> {
  stopTick()
  if (isRecording.value) stop({ discard: true })
  pendingBuffer.value = null
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
          Choose an input device, then press Start. Stop when finished and add the take to the
          media library as MP3.
        </p>

        <label class="device-field">
          <span>Microphone</span>
          <div class="device-row">
            <select
              v-model="selectedDeviceId"
              :disabled="isRecording || loadingDevices || !devices.length"
            >
              <option v-if="!devices.length" value="">
                {{ loadingDevices ? 'Loading devices…' : 'No microphones found' }}
              </option>
              <option v-for="d in devices" :key="d.deviceId" :value="d.deviceId">
                {{ d.label }}
              </option>
            </select>
            <button
              type="button"
              class="refresh"
              :disabled="isRecording || loadingDevices"
              title="Refresh device list"
              @click="refreshDevices"
            >
              Refresh
            </button>
          </div>
        </label>

        <div class="timer" :class="{ live: isRecording }">{{ elapsedLabel }}</div>
        <p v-if="error" class="err">{{ error }}</p>
        <p v-else-if="isRecording" class="status live">Recording…</p>
        <p v-else-if="hasTake" class="status">Take ready - add it to the library or record again.</p>
        <p v-else class="status">Idle</p>
      </div>

      <footer>
        <button
          v-if="!isRecording"
          type="button"
          class="primary"
          :disabled="!selectedDeviceId && devices.length > 0"
          @click="onStart"
        >
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
  width: min(440px, 94vw);
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

.device-field {
  display: flex;
  flex-direction: column;
  gap: 4px;
  text-align: left;
  margin-bottom: 14px;
  font-size: 11px;
  color: var(--muted);
}

.device-row {
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 6px;
}

.device-field select {
  background: var(--bg);
  border: 1px solid var(--border);
  border-radius: 4px;
  padding: 6px 8px;
  color: var(--text);
  font: inherit;
  width: 100%;
}

.refresh {
  white-space: nowrap;
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
