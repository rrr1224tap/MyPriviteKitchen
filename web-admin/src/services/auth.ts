import type { ApiResponse } from '../types/api'
import { clearSession } from '../stores/session'

export interface WebAdminLoginData {
  token: string
  expires_at: string
  role: 'super_admin'
}

export interface WebAdminVerifyData {
  valid: boolean
  role: 'super_admin'
  expires_at: string
}

const ENDPOINT_NOT_CONFIGURED_MESSAGE = '未配置 Web 登录接口，请检查 VITE_WEB_ADMIN_AUTH_ENDPOINT'

function getAuthEndpoint() {
  return String(import.meta.env.VITE_WEB_ADMIN_AUTH_ENDPOINT || '').trim()
}

function endpointNotConfigured<T>(): ApiResponse<T> {
  return {
    success: false,
    error: {
      code: 'ENDPOINT_NOT_CONFIGURED',
      message: ENDPOINT_NOT_CONFIGURED_MESSAGE
    }
  }
}

async function postAuth<T>(payload: Record<string, string>): Promise<ApiResponse<T>> {
  const endpoint = getAuthEndpoint()
  if (!endpoint) {
    return endpointNotConfigured<T>()
  }

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    })

    if (!response.ok) {
      return {
        success: false,
        error: {
          code: 'NETWORK_ERROR',
          message: '登录服务暂时不可用，请稍后重试'
        }
      }
    }

    return await response.json() as ApiResponse<T>
  } catch (error) {
    return {
      success: false,
      error: {
        code: 'NETWORK_ERROR',
        message: '登录服务暂时不可用，请稍后重试'
      }
    }
  }
}

export function loginWebAdmin(passcode: string) {
  return postAuth<WebAdminLoginData>({
    action: 'login',
    passcode
  })
}

export function verifyWebAdminToken(token: string) {
  return postAuth<WebAdminVerifyData>({
    action: 'verify',
    token
  })
}

export function logoutWebAdmin() {
  clearSession()
}
