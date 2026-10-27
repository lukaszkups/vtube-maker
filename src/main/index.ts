import { app, BrowserWindow, ipcMain, protocol, net } from 'electron'
import { join } from 'path'
import { pathToFileURL } from 'url'
import { writeFile, readFile } from 'fs/promises'
import { existsSync } from 'fs'
import {
  ensureProjectDirs,
  importFiles,
  pickExportPath,
  pickProjectDir,
  saveRecording
} from './assets'
import { exportProject } from './export'
import type { Project } from '../shared/types'
import { createEmptyProject } from '../shared/types'

protocol.registerSchemesAsPrivileged([
  {
    scheme: 'media',
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      stream: true,
      bypassCSP: true,
      corsEnabled: true
    }
  }
])

// Helpful on restricted Linux environments / containers
app.disableHardwareAcceleration()
app.commandLine.appendSwitch('no-sandbox')
app.commandLine.appendSwitch('disable-gpu')
app.commandLine.appendSwitch('in-process-gpu')
app.commandLine.appendSwitch('disable-software-rasterizer')

let mainWindow: BrowserWindow | null = null
let projectDir: string = ''

function defaultProjectDir(): string {
  return join(app.getPath('userData'), 'projects', 'default')
}

async function createWindow(): Promise<void> {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1100,
    minHeight: 700,
    title: 'VTube Maker',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      webSecurity: true
    }
  })

  if (process.env.ELECTRON_RENDERER_URL) {
    await mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL)
  } else {
    await mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

app.whenReady().then(async () => {
  protocol.handle('media', (request) => {
    const u = new URL(request.url)
    const filePath = decodeURIComponent(u.searchParams.get('path') || '')
    if (!filePath) return new Response('missing path', { status: 400 })
    return net.fetch(pathToFileURL(filePath).toString())
  })

  projectDir = defaultProjectDir()
  await ensureProjectDirs(projectDir)

  ipcMain.handle('project:getDir', () => projectDir)

  ipcMain.handle('project:setDir', async (_e, dir?: string) => {
    if (dir) {
      projectDir = dir
    } else {
      const picked = await pickProjectDir()
      if (!picked) return projectDir
      projectDir = picked
    }
    await ensureProjectDirs(projectDir)
    return projectDir
  })

  ipcMain.handle('project:save', async (_e, project: Project) => {
    await ensureProjectDirs(projectDir)
    const path = join(projectDir, 'project.json')
    await writeFile(path, JSON.stringify(project, null, 2), 'utf-8')
    return path
  })

  ipcMain.handle('project:load', async () => {
    const path = join(projectDir, 'project.json')
    if (!existsSync(path)) return createEmptyProject()
    const raw = await readFile(path, 'utf-8')
    return JSON.parse(raw) as Project
  })

  ipcMain.handle('assets:import', async (_e, paths?: string[]) => {
    return importFiles(projectDir, paths)
  })

  ipcMain.handle('assets:saveRecording', async (_e, buffer: ArrayBuffer, name?: string) => {
    return saveRecording(projectDir, buffer, name)
  })

  ipcMain.handle('export:run', async (_e, project: Project) => {
    const out = await pickExportPath(`${project.name || 'export'}.mp4`)
    if (!out) return { canceled: true }
    await exportProject(project, out, mainWindow)
    return { canceled: false, path: out }
  })

  ipcMain.handle('path:toMediaUrl', (_e, filePath: string) => {
    return `media://local/?path=${encodeURIComponent(filePath)}`
  })

  await createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) void createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
