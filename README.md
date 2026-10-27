# VTube Maker

Memory-efficient Electron + Vue 3 video editor with a media library, 3 video / 3 audio tracks, GIF looping on the timeline, mic recording, keyframed clip transforms, and FFmpeg Full HD export.

## Requirements

- Node.js 20+
- npm 10+

FFmpeg / ffprobe binaries are pulled via `ffmpeg-static` and `ffprobe-static`.

## Scripts

```bash
npm install
npm run dev      # Electron + Vite (hot reload)
npm run build    # production build
npm start        # run production build
```

On some Linux setups Electron needs `--no-sandbox` (already included in the npm scripts).

## Features

- Import images, GIFs, video, and audio (stored on disk under the project folder)
- Drag assets onto 3 video + 3 audio tracks; resize GIF/image clips to extend looping
- Canvas preview at locked 1920×1080
- Clip transform (position, scale, rotation, opacity) with copy/paste between clips
- Property keyframes with linear / easeInOut interpolation
- Record microphone audio into an audio track
- Export MP4 via a low-memory frame pipe into FFmpeg

## Memory notes

Assets stay on disk as paths. Preview seeks media elements and keeps at most two decoded GIF caches. Export composites one Full HD frame at a time and streams raw frames into FFmpeg.
