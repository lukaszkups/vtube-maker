import { app, BrowserWindow, ipcMain, protocol, net } from 'electron'
import { join } from 'path'
import { pathToFileURL } from 'url'
import { writeFile, readFile } from 'fs/promises'
import { existsSync } from 'fs'
import {
  ensureProjectDirs,
  importFiles,
  pickExportPath,
  pickOpenProjectPath,
  pickProjectDir,
  pickSaveProjectPath,
  saveRecording
} from './assets'
import { exportProject } from './export'
import { listSystemFonts } from './fonts'
import { setupApplicationMenu } from './menu'
import type { Project } from '../shared/types'
import { createEmptyProject } from '../shared/types'
import { dirname } from 'path'

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
let projectFilePath: string = ''

function defaultProjectDir(): string {
  return join(app.getPath('userData'), 'projects', 'default')
}

function defaultProjectFile(): string {
  return join(defaultProjectDir(), 'project.json')
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
  projectFilePath = defaultProjectFile()
  await ensureProjectDirs(projectDir)
  setupApplicationMenu()

  ipcMain.handle('project:getDir', () => projectDir)
  ipcMain.handle('project:getFile', () => projectFilePath)

  ipcMain.handle('project:setDir', async (_e, dir?: string) => {
    if (dir) {
      projectDir = dir
    } else {
      const picked = await pickProjectDir()
      if (!picked) return projectDir
      projectDir = picked
    }
    await ensureProjectDirs(projectDir)
    projectFilePath = join(projectDir, 'project.json')
    return projectDir
  })

  ipcMain.handle('project:save', async (_e, project: Project) => {
    await ensureProjectDirs(projectDir)
    const path = projectFilePath || join(projectDir, 'project.json')
    await writeFile(path, JSON.stringify(project, null, 2), 'utf-8')
    projectFilePath = path
    return path
  })

  ipcMain.handle('project:saveAs', async (_e, project: Project) => {
    const picked = await pickSaveProjectPath(`${project.name || 'project'}.json`)
    if (!picked) return { canceled: true as const }
    await writeFile(picked, JSON.stringify(project, null, 2), 'utf-8')
    projectFilePath = picked
    projectDir = dirname(picked)
    await ensureProjectDirs(projectDir)
    return { canceled: false as const, path: picked }
  })

  ipcMain.handle('project:open', async () => {
    const picked = await pickOpenProjectPath()
    if (!picked) return { canceled: true as const }
    const raw = await readFile(picked, 'utf-8')
    const project = JSON.parse(raw) as Project
    projectFilePath = picked
    projectDir = dirname(picked)
    await ensureProjectDirs(projectDir)
    return { canceled: false as const, path: picked, project }
  })

  ipcMain.handle('project:load', async () => {
    const path = projectFilePath || join(projectDir, 'project.json')
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

  ipcMain.handle('fonts:list', async () => listSystemFonts())

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
