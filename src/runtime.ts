export type AppRuntime = 'web' | 'desktop'

/** Set at build time via `vite build --mode desktop` (see `.env.desktop`). */
export const appRuntime: AppRuntime =
  import.meta.env.VITE_APP_RUNTIME === 'desktop' ? 'desktop' : 'web'

export const isDesktopApp = appRuntime === 'desktop'
