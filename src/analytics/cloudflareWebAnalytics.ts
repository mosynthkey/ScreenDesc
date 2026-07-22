const BEACON_SRC = 'https://static.cloudflareinsights.com/beacon.min.js'

/** Load Cloudflare Web Analytics when `VITE_CF_BEACON_TOKEN` is set (production builds). */
export function initCloudflareWebAnalytics(): void {
  const token = import.meta.env.VITE_CF_BEACON_TOKEN?.trim()
  if (!token) return
  if (typeof document === 'undefined') return
  if (document.querySelector(`script[src="${BEACON_SRC}"]`)) return

  const script = document.createElement('script')
  script.defer = true
  script.src = BEACON_SRC
  // spa:true helps if History API navigation is added later; harmless without a router.
  script.setAttribute('data-cf-beacon', JSON.stringify({ token, spa: true }))
  document.body.appendChild(script)
}
