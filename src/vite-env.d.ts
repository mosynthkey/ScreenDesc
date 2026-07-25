/// <reference types="vite/client" />

declare const __APP_VERSION__: string

interface ImportMetaEnv {
  readonly VITE_CF_BEACON_TOKEN?: string
  /** `desktop` when building for Deno Desktop; otherwise web. */
  readonly VITE_APP_RUNTIME?: 'web' | 'desktop'
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
