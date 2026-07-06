import { callAdminFunction } from './cloud'

export type CategoryStatus = 'active' | 'disabled' | 'inactive' | 'deleted'
export type EditableCategoryStatus = 'active' | 'disabled'

export interface CategoryListItem {
  id: string
  category_id: string
  merchant_id: string
  name: string
  sort_order: number
  status: CategoryStatus
  status_text: string
  enabled: boolean
  created_at: string | null
  updated_at: string | null
}

interface RawCategoryItem {
  _id?: unknown
  id?: unknown
  category_id?: unknown
  merchant_id?: unknown
  name?: unknown
  sort_order?: unknown
  status?: unknown
  enabled?: unknown
  created_at?: unknown
  updated_at?: unknown
}

interface CategoryListResponse {
  list?: RawCategoryItem[]
  total?: unknown
}

function toText(value: unknown) {
  return typeof value === 'string' ? value : ''
}

function toDateText(value: unknown) {
  if (!value) {
    return null
  }

  if (typeof value === 'string') {
    return value
  }

  if (value instanceof Date) {
    return value.toISOString()
  }

  if (typeof value === 'object' && value !== null) {
    const maybeDate = value as { $date?: unknown }
    if (typeof maybeDate.$date === 'string') {
      return maybeDate.$date
    }
  }

  return null
}

function toNumber(value: unknown) {
  const numberValue = Number(value)
  return Number.isFinite(numberValue) && numberValue >= 0 ? numberValue : 0
}

function withMerchantId<T extends Record<string, unknown>>(merchantId: string | undefined, payload: T) {
  if (!merchantId) {
    return payload
  }

  return {
    merchant_id: merchantId,
    ...payload
  }
}

function toStatus(value: unknown, enabled: unknown): CategoryStatus {
  if (value === 'disabled' || value === 'inactive' || value === 'deleted') {
    return value
  }

  if (enabled === false) {
    return 'inactive'
  }

  return 'active'
}

function getStatusText(status: CategoryStatus) {
  if (status === 'deleted') {
    return '已删除'
  }

  return status === 'inactive' || status === 'disabled' ? '停用' : '启用'
}

function normalizeCategory(raw: RawCategoryItem): CategoryListItem {
  const status = toStatus(raw.status, raw.enabled)
  const categoryId = toText(raw.category_id)

  return {
    id: toText(raw.id) || toText(raw._id) || categoryId,
    category_id: categoryId,
    merchant_id: toText(raw.merchant_id),
    name: toText(raw.name),
    sort_order: toNumber(raw.sort_order),
    status,
    status_text: getStatusText(status),
    enabled: status === 'active',
    created_at: toDateText(raw.created_at),
    updated_at: toDateText(raw.updated_at)
  }
}

export async function fetchCategories(merchantId?: string) {
  const data = await callAdminFunction<CategoryListResponse>('manageCategory', withMerchantId(merchantId, {
    action: 'listCategories',
  }))

  const list = Array.isArray(data.list) ? data.list.map(normalizeCategory) : []

  return {
    list,
    total: Number.isFinite(Number(data.total)) ? Number(data.total) : list.length
  }
}

export interface CategoryMutationPayload {
  name?: string
  sort_order?: number
  status?: EditableCategoryStatus
}

export async function createCategory(merchantId: string | undefined, payload: CategoryMutationPayload) {
  const data = await callAdminFunction<{ category?: RawCategoryItem }>('manageCategory', withMerchantId(merchantId, {
    action: 'createCategory',
    ...payload
  }))

  return data.category ? normalizeCategory(data.category) : null
}

export async function updateCategory(merchantId: string | undefined, categoryId: string, payload: CategoryMutationPayload) {
  const data = await callAdminFunction<{ category?: RawCategoryItem }>('manageCategory', withMerchantId(merchantId, {
    action: 'updateCategory',
    category_id: categoryId,
    ...payload
  }))

  return data.category ? normalizeCategory(data.category) : null
}

export async function deleteCategory(merchantId: string | undefined, categoryId: string) {
  const data = await callAdminFunction<{ category?: RawCategoryItem }>('manageCategory', withMerchantId(merchantId, {
    action: 'deleteCategory',
    category_id: categoryId
  }))

  return data.category ? normalizeCategory(data.category) : null
}
