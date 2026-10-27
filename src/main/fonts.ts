import { getFonts } from 'font-list'

export async function listSystemFonts(): Promise<string[]> {
  try {
    const fonts = await getFonts({ disableQuoting: true })
    const unique = Array.from(new Set(fonts.map((f) => f.trim()).filter(Boolean)))
    unique.sort((a, b) => a.localeCompare(b))
    return unique
  } catch {
    return [
      'sans-serif',
      'serif',
      'monospace',
      'Arial',
      'Helvetica',
      'Times New Roman',
      'Courier New',
      'Georgia',
      'Verdana'
    ]
  }
}
