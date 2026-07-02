import { callAdminFunction } from './cloud'

export type MerchantStaffRole = 'owner' | 'staff'
export type MerchantStaffStatus = 'active' | 'disabled'
export type MerchantInviteStatus = 'unused' | 'used' | 'disabled' | 'expired'

export interface MerchantStaffMerchant {
  merchant_id: string
  name: string
  short_name: string
  status: string
}

export interface MerchantStaffItem {
  id: string
  merchant_id: string
  openid: string
  masked_openid: string
  role: MerchantStaffRole
  role_text: string
  status: MerchantStaffStatus
  status_text: string
  nickname: string
  remark: string
  created_at: string
  updated_at: string
}

export interface MerchantStaffListResult {
  merchant: MerchantStaffMerchant
  list: MerchantStaffItem[]
  total: number
}

export interface MerchantInviteItem {
  id: string
  code: string
  merchant_id: string
  role: MerchantStaffRole
  role_text: string
  status: MerchantInviteStatus
  status_text: string
  created_by_openid: string
  used_by_openid: string
  masked_used_by_openid: string
  expires_at: string
  created_at: string
  used_at: string
  updated_at: string
}

export interface MerchantInviteListResult {
  merchant: MerchantStaffMerchant
  list: MerchantInviteItem[]
  total: number
}

interface RawMerchant {
  merchant_id?: unknown
  name?: unknown
  short_name?: unknown
  status?: unknown
}

interface RawStaffItem {
  _id?: unknown
  id?: unknown
  merchant_id?: unknown
  openid?: unknown
  masked_openid?: unknown
  role?: unknown
  status?: unknown
  nickname?: unknown
  remark?: unknown
  created_at?: unknown
  updated_at?: unknown
}

interface RawStaffListResponse {
  merchant?: RawMerchant
  list?: RawStaffItem[]
  total?: unknown
}

interface RawInviteItem {
  _id?: unknown
  id?: unknown
  code?: unknown
  merchant_id?: unknown
  role?: unknown
  status?: unknown
  created_by_openid?: unknown
  used_by_openid?: unknown
  masked_used_by_openid?: unknown
  expires_at?: unknown
  created_at?: unknown
  used_at?: unknown
  updated_at?: unknown
}

interface RawInviteListResponse {
  merchant?: RawMerchant
  list?: RawInviteItem[]
  total?: unknown
}

interface RawInviteCreateResponse {
  invite?: RawInviteItem
}

interface RawInviteDisableResponse {
  invite?: RawInviteItem
}

function toText(value: unknown, fallback = '') {
  return typeof value === 'string' && value.trim() ? value.trim() : fallback
}

function toDateText(value: unknown) {
  const text = toText(value)
  if (!text) return '-'

  const date = new Date(text)
  if (Number.isNaN(date.getTime())) return text

  return date.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  })
}

function toRole(value: unknown): MerchantStaffRole {
  return value === 'owner' ? 'owner' : 'staff'
}

function toStatus(value: unknown): MerchantStaffStatus {
  return value === 'disabled' ? 'disabled' : 'active'
}

function toInviteStatus(value: unknown, expiresAt: unknown): MerchantInviteStatus {
  if (value === 'used' || value === 'disabled' || value === 'expired') {
    return value
  }

  const expiresAtText = toText(expiresAt)
  const expiresAtDate = expiresAtText ? new Date(expiresAtText) : null
  if (expiresAtDate && !Number.isNaN(expiresAtDate.getTime()) && expiresAtDate.getTime() < Date.now()) {
    return 'expired'
  }

  return 'unused'
}

function roleText(role: MerchantStaffRole) {
  return role === 'owner' ? '负责人' : '成员'
}

function statusText(status: MerchantStaffStatus) {
  return status === 'active' ? '启用' : '禁用'
}

function inviteStatusText(status: MerchantInviteStatus) {
  const textMap: Record<MerchantInviteStatus, string> = {
    unused: '待使用',
    used: '已使用',
    disabled: '已禁用',
    expired: '已过期'
  }

  return textMap[status]
}

function maskOpenid(openid: string) {
  if (!openid) return '-'
  if (openid.length <= 8) return openid
  return `${openid.slice(0, 4)}****${openid.slice(-4)}`
}

function normalizeMerchant(raw: RawMerchant | undefined, fallbackMerchantId: string): MerchantStaffMerchant {
  const merchantId = toText(raw?.merchant_id, fallbackMerchantId)

  return {
    merchant_id: merchantId,
    name: toText(raw?.name, merchantId),
    short_name: toText(raw?.short_name),
    status: toText(raw?.status, 'active')
  }
}

function normalizeStaffItem(raw: RawStaffItem): MerchantStaffItem {
  const role = toRole(raw.role)
  const status = toStatus(raw.status)
  const openid = toText(raw.openid)

  return {
    id: toText(raw._id || raw.id, openid || '-'),
    merchant_id: toText(raw.merchant_id),
    openid,
    masked_openid: toText(raw.masked_openid, maskOpenid(openid)),
    role,
    role_text: roleText(role),
    status,
    status_text: statusText(status),
    nickname: toText(raw.nickname, '-'),
    remark: toText(raw.remark, '-'),
    created_at: toDateText(raw.created_at),
    updated_at: toDateText(raw.updated_at)
  }
}

function normalizeInviteItem(raw: RawInviteItem): MerchantInviteItem {
  const role = toRole(raw.role)
  const status = toInviteStatus(raw.status, raw.expires_at)
  const usedByOpenid = toText(raw.used_by_openid)

  return {
    id: toText(raw._id || raw.id, toText(raw.code, '-')),
    code: toText(raw.code, '-'),
    merchant_id: toText(raw.merchant_id),
    role,
    role_text: roleText(role),
    status,
    status_text: inviteStatusText(status),
    created_by_openid: toText(raw.created_by_openid, '-'),
    used_by_openid: usedByOpenid,
    masked_used_by_openid: toText(raw.masked_used_by_openid, maskOpenid(usedByOpenid)),
    expires_at: toDateText(raw.expires_at),
    created_at: toDateText(raw.created_at),
    used_at: toDateText(raw.used_at),
    updated_at: toDateText(raw.updated_at)
  }
}

export async function fetchMerchantStaff(merchantId: string): Promise<MerchantStaffListResult> {
  const data = await callAdminFunction<RawStaffListResponse>('manageMerchantStaff', {
    action: 'listStaff',
    merchant_id: merchantId
  })

  const list = Array.isArray(data.list) ? data.list.map(normalizeStaffItem) : []

  return {
    merchant: normalizeMerchant(data.merchant, merchantId),
    list,
    total: Number(data.total) || list.length
  }
}

export async function fetchMerchantInvites(merchantId: string): Promise<MerchantInviteListResult> {
  const data = await callAdminFunction<RawInviteListResponse>('manageMerchantStaff', {
    action: 'listInvites',
    merchant_id: merchantId
  })

  const list = Array.isArray(data.list) ? data.list.map(normalizeInviteItem) : []

  return {
    merchant: normalizeMerchant(data.merchant, merchantId),
    list,
    total: Number(data.total) || list.length
  }
}

export async function createMerchantInvite(
  merchantId: string,
  role: MerchantStaffRole
): Promise<MerchantInviteItem> {
  const data = await callAdminFunction<RawInviteCreateResponse>('manageMerchantStaff', {
    action: 'createInvite',
    merchant_id: merchantId,
    role
  })

  return normalizeInviteItem(data.invite || {})
}

export async function disableMerchantInvite(merchantId: string, code: string): Promise<MerchantInviteItem> {
  const data = await callAdminFunction<RawInviteDisableResponse>('manageMerchantStaff', {
    action: 'disableInvite',
    merchant_id: merchantId,
    code
  })

  return normalizeInviteItem(data.invite || {})
}
