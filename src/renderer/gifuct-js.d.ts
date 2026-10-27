declare module 'gifuct-js' {
  export interface ParsedFrame {
    dims: { top: number; left: number; width: number; height: number }
    delay: number
    disposalType: number
    patch: Uint8ClampedArray
  }

  export interface ParsedGif {
    lsd: { width: number; height: number }
  }

  export function parseGIF(buffer: ArrayBuffer | Buffer): ParsedGif
  export function decompressFrames(gif: ParsedGif, buildPatch: boolean): ParsedFrame[]
}
