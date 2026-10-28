import { onMounted, onUnmounted, ref } from 'vue'

const STORAGE_KEY = 'vtube-panel-layout'

type Layout = {
  left: number
  right: number
  timeline: number
}

const DEFAULTS: Layout = { left: 240, right: 280, timeline: 280 }

function load(): Layout {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return { ...DEFAULTS }
    const parsed = JSON.parse(raw) as Partial<Layout>
    return {
      left: clamp(parsed.left ?? DEFAULTS.left, 180, 640),
      right: clamp(parsed.right ?? DEFAULTS.right, 200, 560),
      timeline: clamp(parsed.timeline ?? DEFAULTS.timeline, 160, 560)
    }
  } catch {
    return { ...DEFAULTS }
  }
}

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n))
}

export function usePanelLayout() {
  const initial = load()
  const leftWidth = ref(initial.left)
  const rightWidth = ref(initial.right)
  const timelineHeight = ref(initial.timeline)

  type Axis = 'left' | 'right' | 'timeline'
  const drag = ref<{
    axis: Axis
    startPos: number
    startSize: number
  } | null>(null)

  function persist(): void {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        left: leftWidth.value,
        right: rightWidth.value,
        timeline: timelineHeight.value
      })
    )
  }

  function startResize(axis: Axis, e: PointerEvent): void {
    e.preventDefault()
    const startPos = axis === 'timeline' ? e.clientY : e.clientX
    const startSize =
      axis === 'left' ? leftWidth.value : axis === 'right' ? rightWidth.value : timelineHeight.value
    drag.value = { axis, startPos, startSize }
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
    document.body.style.cursor = axis === 'timeline' ? 'row-resize' : 'col-resize'
    document.body.style.userSelect = 'none'
  }

  function onResizeMove(e: PointerEvent): void {
    if (!drag.value) return
    const { axis, startPos, startSize } = drag.value
    if (axis === 'left') {
      leftWidth.value = clamp(startSize + (e.clientX - startPos), 180, 640)
    } else if (axis === 'right') {
      // Dragging the left edge of the inspector: moving mouse left grows the panel
      rightWidth.value = clamp(startSize - (e.clientX - startPos), 200, 560)
    } else {
      timelineHeight.value = clamp(startSize - (e.clientY - startPos), 160, 560)
    }
  }

  function endResize(): void {
    if (!drag.value) return
    drag.value = null
    document.body.style.cursor = ''
    document.body.style.userSelect = ''
    persist()
  }

  function onWindowPointerMove(e: PointerEvent): void {
    onResizeMove(e)
  }

  function onWindowPointerUp(): void {
    endResize()
  }

  onMounted(() => {
    window.addEventListener('pointermove', onWindowPointerMove)
    window.addEventListener('pointerup', onWindowPointerUp)
    window.addEventListener('pointercancel', onWindowPointerUp)
  })

  onUnmounted(() => {
    window.removeEventListener('pointermove', onWindowPointerMove)
    window.removeEventListener('pointerup', onWindowPointerUp)
    window.removeEventListener('pointercancel', onWindowPointerUp)
  })

  return {
    leftWidth,
    rightWidth,
    timelineHeight,
    startResize,
    endResize,
    onResizeMove
  }
}
