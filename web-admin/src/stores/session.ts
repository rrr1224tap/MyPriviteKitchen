export type AdminRole = 'super_admin' | 'merchant_admin'

export interface AdminSession {
  token: string
  role: AdminRole
  expires_at: string
  merchant_id?: string
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
      clearSession()
      return null
    }

    if (parsed.role !== 'super_admin' && parsed.role !== 'merchant_admin') {
      clearSession()
      return null
    }

    if (parsed.role === 'merchant_admin' && !parsed.merchant_id) {
      clearSession()
      return null
    }

    return {
      token: parsed.token,
      role: parsed.role,
      expires_at: parsed.expires_at,
      merchant_id: parsed.merchant_id
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
    clearSession()
    return false
  }

  if (expiresAt <= Date.now()) {
    clearSession()
    return false
  }

  return true
}
