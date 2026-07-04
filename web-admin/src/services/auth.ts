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

const ENDPOINT_NOT_CONFIGURED_MESSAGE = '未配置 Web 登录接口，请检查 VITE_WEB_ADMIN_AUTH_ENDPOINT'
const API_BASE_NOT_CONFIGURED_MESSAGE = '未配置 Web 后台接口，请检查 VITE_WEB_ADMIN_API_BASE_URL'

function getAuthEndpoint() {
  return String(import.meta.env.VITE_WEB_ADMIN_AUTH_ENDPOINT || '').trim()
}

function getAdminApiBaseUrl() {
  return String(import.meta.env.VITE_WEB_ADMIN_API_BASE_URL || '').trim().replace(/\/+$/, '')
}

function endpointNotConfigured<T>(message = ENDPOINT_NOT_CONFIGURED_MESSAGE): ApiResponse<T> {
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
          message: '后台服务暂时不可用，请稍后重试'
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
  return role === 'merchant_admin' ? '商户管理员' : '超级管理员'
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
