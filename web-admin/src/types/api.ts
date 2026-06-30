export interface ApiError {
  code: string
  message: string
}

export interface ApiResponse<T> {
  success: boolean
  data?: T
  code?: string
  message?: string
  error?: ApiError
}

export type AdminApiErrorCode =
  | 'UNAUTHORIZED'
  | 'TOKEN_EXPIRED'
  | 'FORBIDDEN'
  | 'SERVER_CONFIG_ERROR'
  | 'NETWORK_ERROR'
  | 'INVALID_RESPONSE'
  | 'ENDPOINT_NOT_CONFIGURED'

export class AdminApiError extends Error {
  code: string

  constructor(error: ApiError) {
    super(error.message)
    this.name = 'AdminApiError'
    this.code = error.code
  }
}
