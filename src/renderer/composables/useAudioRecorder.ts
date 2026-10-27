import { ref } from 'vue'
import { useProjectStore } from '../stores/project'

export function useAudioRecorder() {
  const store = useProjectStore()
  const isRecording = ref(false)
  const error = ref<string | null>(null)
  let mediaRecorder: MediaRecorder | null = null
  let chunks: BlobPart[] = []
  let stream: MediaStream | null = null

  async function start(): Promise<void> {
    error.value = null
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true })
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
        await store.addRecordingAsset(buffer)
        stream?.getTracks().forEach((t) => t.stop())
        stream = null
        mediaRecorder = null
        chunks = []
      }
      mediaRecorder.start(200)
      isRecording.value = true
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Microphone access failed'
      isRecording.value = false
    }
  }

  function stop(): void {
    if (mediaRecorder && mediaRecorder.state !== 'inactive') {
      mediaRecorder.stop()
    }
    isRecording.value = false
  }

  function toggle(): void {
    if (isRecording.value) stop()
    else void start()
  }

  return { isRecording, error, start, stop, toggle }
}
