const GTAG_SRC = 'https://www.googletagmanager.com/gtag/js'

/** Load Google Analytics (gtag.js) when `VITE_GA_MEASUREMENT_ID` is set (production builds). */
export function initGoogleAnalytics(): void {
  const measurementId = import.meta.env.VITE_GA_MEASUREMENT_ID?.trim()
  if (!measurementId) return
  if (typeof document === 'undefined') return
  if (document.querySelector(`script[data-ga-measurement-id="${measurementId}"]`)) return

  const script = document.createElement('script')
  script.async = true
  script.src = `${GTAG_SRC}?id=${encodeURIComponent(measurementId)}`
  script.dataset.gaMeasurementId = measurementId
  document.head.appendChild(script)

  const dataLayer = ((window as unknown as { dataLayer?: unknown[] }).dataLayer ??= [])
  function gtag(...args: unknown[]): void {
    dataLayer.push(args)
  }
  gtag('js', new Date())
  gtag('config', measurementId)
}
