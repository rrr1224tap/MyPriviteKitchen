import type { ApiResponse } from '../types/api'
import { clearSession } from '../stores/session'
import type { AdminRole } from '../stores/session'

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

export interface MerchantAdminLoginData {
  session: {
    token: string
    role: 'merchant_admin'
    merchant_id: string
    expires_at: string
  }
  merchant: {
    merchant_id: string
    merchant_slug: string
    name: string
    short_name: string
    status: string
  }
}

const WEB_ADMIN_AUTH_ENDPOINT =
  'https://cloud1-d1gg2kq762389ea4-1443234267.ap-shanghai.app.tcloudbase.com/webAdminAuth'
const API_BASE_NOT_CONFIGURED_MESSAGE = '未配置 Web 工作台入口，请检查 VITE_WEB_ADMIN_API_BASE_URL'

function getAdminApiBaseUrl() {
  return String(import.meta.env.VITE_WEB_ADMIN_API_BASE_URL || '').trim().replace(/\/+$/, '')
}

function endpointNotConfigured<T>(message: string): ApiResponse<T> {
  return {
    success: false,
    error: {
      code: 'ENDPOINT_NOT_CONFIGURED',
      message
    }
  }
}

function normalizeApiResponse<T>(value: unknown): ApiResponse<T> {
  const result = value as ApiResponse<T>
  if (!result || typeof result !== 'object' || typeof result.success !== 'boolean') {
    return {
      success: false,
      error: {
        code: 'INVALID_RESPONSE',
        message: '接口返回格式异常'
      }
    }
  }

  if (!result.success && !result.error && result.code) {
    return {
      ...result,
      error: {
        code: result.code,
        message: result.message || '登录失败，请稍后重试'
      }
    }
  }

  return result
}

async function postAuth<T>(payload: Record<string, string>): Promise<ApiResponse<T>> {
  try {
    const response = await fetch(WEB_ADMIN_AUTH_ENDPOINT, {
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

    return normalizeApiResponse<T>(await response.json())
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

async function postAdminApi<T>(functionName: string, payload: Record<string, string>): Promise<ApiResponse<T>> {
  const baseUrl = getAdminApiBaseUrl()
  if (!baseUrl) {
    return endpointNotConfigured<T>(API_BASE_NOT_CONFIGURED_MESSAGE)
  }

  try {
    const response = await fetch(`${baseUrl}/${functionName}`, {
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
          message: '工作台暂时不可用，请稍后重试'
        }
      }
    }

    return normalizeApiResponse<T>(await response.json())
  } catch (error) {
    return {
      success: false,
      error: {
        code: 'NETWORK_ERROR',
        message: '网络连接失败，请稍后重试'
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

export function loginMerchantAdmin(params: {
  merchant_slug: string
  login_name: string
  password: string
}) {
  return postAdminApi<MerchantAdminLoginData>('merchantSelfService', {
    action: 'merchantAdminLogin',
    merchant_slug: params.merchant_slug,
    login_name: params.login_name,
    password: params.password
  })
}

export function roleText(role?: AdminRole) {
  return role === 'merchant_admin' ? '小厨' : '总控小厨'
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
