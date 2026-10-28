import { Menu, BrowserWindow, app } from 'electron'

export type MenuCommand = 'open' | 'save' | 'saveAs'

function send(command: MenuCommand): void {
  const win = BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0]
  win?.webContents.send('menu:command', command)
}

export function setupApplicationMenu(): void {
  const isMac = process.platform === 'darwin'

  const fileSubmenu: Electron.MenuItemConstructorOptions[] = [
    {
      label: 'Open',
      accelerator: 'CmdOrCtrl+O',
      click: () => send('open')
    },
    {
      label: 'Save',
      accelerator: 'CmdOrCtrl+S',
      click: () => send('save')
    },
    {
      label: 'Save as',
      accelerator: 'CmdOrCtrl+Shift+S',
      click: () => send('saveAs')
    }
  ]

  if (!isMac) {
    fileSubmenu.push({ type: 'separator' }, { role: 'quit', label: 'Quit' })
  }

  const template: Electron.MenuItemConstructorOptions[] = [
    ...(isMac
      ? [
          {
            label: app.name,
            submenu: [
              { role: 'about' as const },
              { type: 'separator' as const },
              { role: 'services' as const },
              { type: 'separator' as const },
              { role: 'hide' as const },
              { role: 'hideOthers' as const },
              { role: 'unhide' as const },
              { type: 'separator' as const },
              { role: 'quit' as const }
            ]
          }
        ]
      : []),
    {
      label: 'File',
      submenu: fileSubmenu
    },
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { role: 'selectAll' }
      ]
    },
    {
      label: 'View',
      submenu: [
        { role: 'reload' },
        { role: 'toggleDevTools' },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' }
      ]
    }
  ]

  Menu.setApplicationMenu(Menu.buildFromTemplate(template))
}
