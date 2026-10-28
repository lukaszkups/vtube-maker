import { ref } from 'vue'
import { useProjectStore } from '../stores/project'

export type AudioInputDevice = {
  deviceId: string
  label: string
}

type StartOpts = {
  autoSave?: boolean
  deviceId?: string
  onStop?: (buffer: ArrayBuffer) => void
}

type StopOpts = {
  discard?: boolean
}

export async function listAudioInputDevices(): Promise<AudioInputDevice[]> {
  if (!navigator.mediaDevices?.enumerateDevices) return []

  // Labels are often empty until permission has been granted once
  let devices = await navigator.mediaDevices.enumerateDevices()
  const hasLabels = devices.some((d) => d.kind === 'audioinput' && d.label)
  if (!hasLabels) {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      stream.getTracks().forEach((t) => t.stop())
      devices = await navigator.mediaDevices.enumerateDevices()
    } catch {
      /* keep unlabeled list */
    }
  }

  return devices
    .filter((d) => d.kind === 'audioinput')
    .map((d, i) => ({
      deviceId: d.deviceId,
      label: d.label || `Microphone ${i + 1}`
    }))
}

export function useAudioRecorder() {
  const store = useProjectStore()
  const isRecording = ref(false)
  const error = ref<string | null>(null)
  let mediaRecorder: MediaRecorder | null = null
  let chunks: BlobPart[] = []
  let stream: MediaStream | null = null
  let startOpts: StartOpts = {}
  let discardOnStop = false

  function cleanupStream(): void {
    stream?.getTracks().forEach((t) => t.stop())
    stream = null
    mediaRecorder = null
    chunks = []
  }

  async function start(opts: StartOpts = {}): Promise<void> {
    error.value = null
    startOpts = opts
    discardOnStop = false
    try {
      const audioConstraint: boolean | MediaTrackConstraints = opts.deviceId
        ? { deviceId: { exact: opts.deviceId } }
        : true
      stream = await navigator.mediaDevices.getUserMedia({ audio: audioConstraint })
      chunks = []
      const mime = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : 'audio/webm'
      mediaRecorder = new MediaRecorder(stream, { mimeType: mime })
      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data)
      }
      mediaRecorder.onstop = async () => {
        const blob = new Blob(chunks, { type: 'audio/webm' })
        const buffer = await blob.arrayBuffer()
        cleanupStream()
        if (discardOnStop) return
        if (startOpts.autoSave) {
          await store.addRecordingAsset(buffer)
        }
        startOpts.onStop?.(buffer)
      }
      mediaRecorder.start(200)
      isRecording.value = true
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Microphone access failed'
      isRecording.value = false
      cleanupStream()
    }
  }

  function stop(opts: StopOpts = {}): void {
    discardOnStop = !!opts.discard
    if (mediaRecorder && mediaRecorder.state !== 'inactive') {
      mediaRecorder.stop()
    }
    isRecording.value = false
  }

  async function saveBuffer(buffer: ArrayBuffer, name?: string): Promise<void> {
    await store.addRecordingAsset(buffer, name)
  }

  return { isRecording, error, start, stop, saveBuffer }
}
