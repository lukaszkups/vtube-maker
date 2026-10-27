/** Lightweight peak extraction via Web Audio (no extra waveform library). */

const peakCache = new Map<string, number[]>()

export async function getWaveformPeaks(url: string, bars = 48): Promise<number[]> {
  const cached = peakCache.get(url)
  if (cached) return cached

  const res = await fetch(url)
  const buf = await res.arrayBuffer()
  const ctx = new AudioContext()
  let audio: AudioBuffer
  try {
    audio = await ctx.decodeAudioData(buf.slice(0))
  } finally {
    void ctx.close()
  }
  const channel = audio.getChannelData(0)
  const block = Math.max(1, Math.floor(channel.length / bars))
  const peaks: number[] = []
  for (let i = 0; i < bars; i++) {
    const start = i * block
    const end = Math.min(channel.length, start + block)
    let max = 0
    for (let j = start; j < end; j++) {
      const v = Math.abs(channel[j])
      if (v > max) max = v
    }
    peaks.push(max)
  }
  const peakMax = Math.max(...peaks, 0.001)
  const normalized = peaks.map((p) => p / peakMax)
  if (peakCache.size > 24) {
    const first = peakCache.keys().next().value
    if (first) peakCache.delete(first)
  }
  peakCache.set(url, normalized)
  return normalized
}
