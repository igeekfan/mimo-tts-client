/**
 * Optional token auth for web mode.
 *
 * When the server is started with TTS_WEB_TOKEN set, GET /api/config reports
 * { authRequired: true } and every other /api/* route requires the token via
 * an Authorization: Bearer header (or a ?token= query param for EventSource,
 * which cannot set headers). The token is kept in sessionStorage.
 */

const TOKEN_KEY = 'mimo_tts_token'

export function getToken(): string | null {
  return sessionStorage.getItem(TOKEN_KEY)
}

export function setToken(token: string | null) {
  if (token) sessionStorage.setItem(TOKEN_KEY, token)
  else sessionStorage.removeItem(TOKEN_KEY)
}

/** Merge the Authorization header (if a token is stored) into existing headers. */
export function authHeaders(base?: Record<string, string>): Record<string, string> {
  const headers = {...(base || {})}
  const token = getToken()
  if (token) headers['Authorization'] = `Bearer ${token}`
  return headers
}

async function validateToken(token: string): Promise<boolean> {
  try {
    const res = await fetch('/api/version', {headers: {Authorization: `Bearer ${token}`}})
    return res.ok
  } catch {
    return false
  }
}

/**
 * Ensure a valid token is available for web mode before the app makes API
 * calls. No-op on desktop or when the server does not require auth. Prompts the
 * user for the token when needed.
 */
export async function initWebAuth(): Promise<void> {
  if (typeof (window as any).go?.desktop?.App !== 'undefined') return

  let authRequired = false
  try {
    const res = await fetch('/api/config')
    if (res.ok) {
      const cfg = await res.json()
      authRequired = !!cfg.authRequired
    }
  } catch {
    return
  }
  if (!authRequired) return

  for (let attempt = 0; attempt < 5; attempt++) {
    let token = getToken()
    if (!token) {
      token = window.prompt('This server requires an access token:') || ''
      if (!token) continue
      setToken(token)
    }
    if (await validateToken(token)) return
    setToken(null)
  }
}
