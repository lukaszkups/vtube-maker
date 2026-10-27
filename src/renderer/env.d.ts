/// <reference types="vite/client" />

import type { ElectronApi } from '../preload/index'

declare global {
  interface Window {
    api: ElectronApi
  }
}

declare module '*.vue' {
  import type { DefineComponent } from 'vue'
  const component: DefineComponent<object, object, unknown>
  export default component
}
