import { clearSession, getSession, hasValidLocalSession } from '../stores/session'
import { AdminApiError, type ApiError, type ApiResponse } from '../types/api'

const TOKEN_ERROR_CODES = new Set(['UNAUTHORIZED', 'TOKEN_EXPIRED'])

function getAdminApiBaseUrl() {
  return String(import.meta.env.VITE_WEB_ADMIN_API_BASE_URL || '').trim().replace(/\/+$/, '')
}

function createError(code: string, message: string): AdminApiError {
  return new AdminApiError({ code, message })
}

function normalizeError(error?: ApiError): AdminApiError {
  return new AdminApiError({
    code: error?.code || 'INVALID_RESPONSE',
    message: error?.message || '接口返回格式异常'
  })
}

function assertValidResponse<T>(value: unknown): ApiResponse<T> {
  if (!value || typeof value !== 'object' || typeof (value as ApiResponse<T>).success !== 'boolean') {
    throw createError('INVALID_RESPONSE', '接口返回格式异常')
  }

  return value as ApiResponse<T>
}

function handleTokenError(error: AdminApiError) {
  if (TOKEN_ERROR_CODES.has(error.code)) {
    clearSession()
  }
}

export async function callAdminFunction<T>(
  functionName: string,
  payload: Record<string, unknown> = {}
): Promise<T> {
  const baseUrl = getAdminApiBaseUrl()
  if (!baseUrl) {
    throw createError('ENDPOINT_NOT_CONFIGURED', '未配置 Web 后台接口，请检查 VITE_WEB_ADMIN_API_BASE_URL')
  }

  if (!hasValidLocalSession()) {
    throw createError('UNAUTHORIZED', '登录状态已失效，请重新登录')
  }

  const session = getSession()
  if (!session?.token) {
    throw createError('UNAUTHORIZED', '登录状态已失效，请重新登录')
  }

  try {
    const response = await fetch(`${baseUrl}/${functionName}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        admin_token: session.token,
        ...payload
      })
    })

    if (!response.ok) {
      throw createError('NETWORK_ERROR', '后台服务暂时不可用，请稍后重试')
    }

    const result = assertValidResponse<T>(await response.json())
    if (!result.success) {
      const error = normalizeError(result.error)
      handleTokenError(error)
      throw error
    }

    return result.data as T
  } catch (error) {
    if (error instanceof AdminApiError) {
      handleTokenError(error)
      throw error
    }

    throw createError('NETWORK_ERROR', '网络连接失败，请稍后重试')
  }
}
