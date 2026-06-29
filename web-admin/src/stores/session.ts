export interface AdminSession {
  token: string
  role: string
  expires_at: string
}

const SESSION_KEY = 'xiaochu_web_admin_session'

function canUseSessionStorage() {
  return typeof window !== 'undefined' && Boolean(window.sessionStorage)
}

export function saveSession(session: AdminSession) {
  if (!canUseSessionStorage()) {
    return
  }

  window.sessionStorage.setItem(SESSION_KEY, JSON.stringify(session))
}

export function getSession(): AdminSession | null {
  if (!canUseSessionStorage()) {
    return null
  }

  const rawSession = window.sessionStorage.getItem(SESSION_KEY)
  if (!rawSession) {
    return null
  }

  try {
    const parsed = JSON.parse(rawSession) as Partial<AdminSession>
    if (!parsed.token || !parsed.role || !parsed.expires_at) {
      return null
    }

    return {
      token: parsed.token,
      role: parsed.role,
      expires_at: parsed.expires_at
    }
  } catch (error) {
    clearSession()
    return null
  }
}

export function clearSession() {
  if (!canUseSessionStorage()) {
    return
  }

  window.sessionStorage.removeItem(SESSION_KEY)
}

export function hasValidLocalSession() {
  const session = getSession()
  if (!session) {
    return false
  }

  const expiresAt = new Date(session.expires_at).getTime()
  if (!Number.isFinite(expiresAt)) {
    return false
  }

  return expiresAt > Date.now()
}
