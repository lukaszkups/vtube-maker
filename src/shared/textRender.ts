import type { TextStyle } from './types'

export function escapeXml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/** Approximate text block size for layout / export SVG. */
export function measureTextBlock(
  style: TextStyle,
  scaleX = 1,
  scaleY = 1
): { width: number; height: number; lines: string[] } {
  const lines = style.content.split('\n')
  const fontSize = style.fontSize * Math.max(scaleX, scaleY)
  const avgChar = fontSize * 0.55
  const width = Math.max(
    32,
    ...lines.map((line) => Math.ceil(Math.max(1, line.length) * avgChar))
  )
  const height = Math.max(32, Math.ceil(lines.length * fontSize * style.lineHeight))
  return { width: Math.ceil(width + style.strokeWidth * 2 + 8), height: Math.ceil(height + style.strokeWidth * 2 + 8), lines }
}

export function textStyleToSvg(style: TextStyle, width: number, height: number): string {
  const lines = style.content.split('\n')
  const fontSize = style.fontSize
  const anchor =
    style.align === 'left' ? 'start' : style.align === 'right' ? 'end' : 'middle'
  const x =
    style.align === 'left' ? 4 + style.strokeWidth : style.align === 'right' ? width - 4 - style.strokeWidth : width / 2
  const blockH = lines.length * fontSize * style.lineHeight
  const startY = (height - blockH) / 2 + fontSize * 0.8

  const tspans = lines
    .map((line, i) => {
      const y = startY + i * fontSize * style.lineHeight
      return `<tspan x="${x}" y="${y}">${escapeXml(line || ' ')}</tspan>`
    })
    .join('')

  const stroke =
    style.strokeWidth > 0
      ? `stroke="${escapeXml(style.strokeColor)}" stroke-width="${style.strokeWidth}" paint-order="stroke"`
      : ''

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
  <text
    font-family="${escapeXml(style.fontFamily)}"
    font-size="${fontSize}"
    font-weight="${escapeXml(style.fontWeight)}"
    font-style="${style.fontStyle}"
    fill="${escapeXml(style.color)}"
    text-anchor="${anchor}"
    ${stroke}
  >${tspans}</text>
</svg>`
}

export function drawTextCentered(
  ctx: CanvasRenderingContext2D,
  style: TextStyle,
  scaleX: number,
  scaleY: number
): { width: number; height: number } {
  const fontSize = style.fontSize * ((Math.abs(scaleX) + Math.abs(scaleY)) / 2)
  ctx.font = `${style.fontStyle} ${style.fontWeight} ${fontSize}px "${style.fontFamily}"`
  ctx.textAlign = style.align
  ctx.textBaseline = 'middle'
  const lines = style.content.split('\n')
  const widths = lines.map((l) => ctx.measureText(l || ' ').width)
  const blockW = Math.max(1, ...widths)
  const blockH = lines.length * fontSize * style.lineHeight
  const startY = -blockH / 2 + fontSize * style.lineHeight * 0.5

  if (style.strokeWidth > 0) {
    ctx.strokeStyle = style.strokeColor
    ctx.lineWidth = style.strokeWidth * Math.max(scaleX, 1)
    ctx.lineJoin = 'round'
  }
  ctx.fillStyle = style.color

  for (let i = 0; i < lines.length; i++) {
    const y = startY + i * fontSize * style.lineHeight
    if (style.strokeWidth > 0) ctx.strokeText(lines[i], 0, y)
    ctx.fillText(lines[i], 0, y)
  }
  return { width: blockW, height: blockH }
}
