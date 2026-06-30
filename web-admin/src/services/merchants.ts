import { callAdminFunction } from './cloud'

export type MerchantStatus = 'active' | 'disabled'

export interface MerchantListItem {
  _id: string
  merchant_id: string
  name: string
  short_name: string
  status: MerchantStatus
  owner_openid: string
  masked_owner_openid: string
  members_count: number
  notice: string
  created_at: string | null
  updated_at: string | null
}

export interface CreateMerchantPayload {
  merchant_id: string
  name: string
  short_name?: string
  owner_openid?: string
  notice?: string
}

export interface UpdateMerchantPayload {
  merchant_id: string
  name: string
  short_name?: string
  owner_openid?: string
  notice?: string
}

interface RawMerchantListItem {
  _id?: unknown
  merchant_id?: unknown
  name?: unknown
  short_name?: unknown
  status?: unknown
  owner_openid?: unknown
  masked_owner_openid?: unknown
  members_count?: unknown
  notice?: unknown
  created_at?: unknown
  updated_at?: unknown
}

interface MerchantListResponse {
  list?: RawMerchantListItem[]
  total?: number
}

interface MerchantMutationResponse {
  merchant?: RawMerchantListItem
}

function toText(value: unknown) {
  return typeof value === 'string' ? value : ''
}

function toStatus(value: unknown): MerchantStatus {
  return value === 'disabled' ? 'disabled' : 'active'
}

function toNumber(value: unknown) {
  const numberValue = Number(value)
  return Number.isFinite(numberValue) && numberValue >= 0 ? numberValue : 0
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
    const maybeDate = value as { $date?: unknown; toString?: () => string }
    if (typeof maybeDate.$date === 'string') {
      return maybeDate.$date
    }
  }

  return null
}

function normalizeMerchant(raw: RawMerchantListItem): MerchantListItem {
  const name = toText(raw.name)
  const shortName = toText(raw.short_name) || name

  return {
    _id: toText(raw._id),
    merchant_id: toText(raw.merchant_id),
    name,
    short_name: shortName,
    status: toStatus(raw.status),
    owner_openid: toText(raw.owner_openid),
    masked_owner_openid: toText(raw.masked_owner_openid),
    members_count: toNumber(raw.members_count),
    notice: toText(raw.notice),
    created_at: toDateText(raw.created_at),
    updated_at: toDateText(raw.updated_at)
  }
}

export async function fetchMerchants() {
  const data = await callAdminFunction<MerchantListResponse>('manageMerchant', {
    action: 'list'
  })

  return {
    list: Array.isArray(data.list) ? data.list.map(normalizeMerchant) : [],
    total: Number.isFinite(Number(data.total)) ? Number(data.total) : 0
  }
}

export async function createMerchant(payload: CreateMerchantPayload) {
  const data = await callAdminFunction<MerchantMutationResponse>('manageMerchant', {
    action: 'create',
    payload
  })

  return data.merchant ? normalizeMerchant(data.merchant) : null
}

export async function updateMerchant(payload: UpdateMerchantPayload) {
  const data = await callAdminFunction<MerchantMutationResponse>('manageMerchant', {
    action: 'update',
    payload
  })

  return data.merchant ? normalizeMerchant(data.merchant) : null
}
