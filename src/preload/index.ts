import { contextBridge, ipcRenderer } from 'electron'
import type { Asset, ExportProgress, Project } from '../shared/types'

const api = {
  getProjectDir: (): Promise<string> => ipcRenderer.invoke('project:getDir'),
  getProjectFile: (): Promise<string> => ipcRenderer.invoke('project:getFile'),
  setProjectDir: (dir?: string): Promise<string> => ipcRenderer.invoke('project:setDir', dir),
  saveProject: (project: Project): Promise<string> => ipcRenderer.invoke('project:save', project),
  saveProjectAs: (
    project: Project
  ): Promise<{ canceled: true } | { canceled: false; path: string }> =>
    ipcRenderer.invoke('project:saveAs', project),
  openProject: (): Promise<
    { canceled: true } | { canceled: false; path: string; project: Project }
  > => ipcRenderer.invoke('project:open'),
  loadProject: (): Promise<Project> => ipcRenderer.invoke('project:load'),
  importAssets: (paths?: string[]): Promise<Asset[]> => ipcRenderer.invoke('assets:import', paths),
  saveRecording: (buffer: ArrayBuffer, name?: string): Promise<Asset> =>
    ipcRenderer.invoke('assets:saveRecording', buffer, name),
  listFonts: (): Promise<string[]> => ipcRenderer.invoke('fonts:list'),
  exportProject: (project: Project): Promise<{ canceled: boolean; path?: string }> =>
    ipcRenderer.invoke('export:run', project),
  toMediaUrl: (filePath: string): Promise<string> => ipcRenderer.invoke('path:toMediaUrl', filePath),
  onExportProgress: (cb: (p: ExportProgress) => void): (() => void) => {
    const listener = (_: Electron.IpcRendererEvent, p: ExportProgress): void => cb(p)
    ipcRenderer.on('export:progress', listener)
    return () => ipcRenderer.removeListener('export:progress', listener)
  }
}

contextBridge.exposeInMainWorld('api', api)

export type ElectronApi = typeof api
