import { callAdminFunction } from './cloud'

export type OrderStatus = 'pending' | 'accepted' | 'cooking' | 'finished' | 'cancelled' | string

export interface OrderListItem {
  id: string
  order_id: string
  order_no: string
  merchant_id: string
  status: OrderStatus
  status_text: string
  payment_status: string
  pickup_type: string
  remark: string
  item_count: number
  total_amount_cent: number
  total_amount_text: string
  contact_name: string
  contact_phone: string
  user_openid: string
  created_at: string | null
  updated_at: string | null
}

export interface ListOrdersParams {
  page?: number
  page_size?: number
  status?: string
}

export interface OrderPagination {
  page: number
  page_size: number
  total: number
  has_more: boolean
}

interface RawOrderItem {
  _id?: unknown
  id?: unknown
  order_id?: unknown
  order_no?: unknown
  display_order_no?: unknown
  merchant_id?: unknown
  status?: unknown
  payment_status?: unknown
  pickup_type?: unknown
  remark?: unknown
  item_count?: unknown
  items_count?: unknown
  total_amount_cent?: unknown
  total_price_cent?: unknown
  total_amount?: unknown
  contact_name?: unknown
  receiver_name?: unknown
  user_nickname?: unknown
  contact_phone?: unknown
  phone?: unknown
  user_openid?: unknown
  openid?: unknown
  created_at?: unknown
  updated_at?: unknown
}

interface OrderListResponse {
  list?: RawOrderItem[]
  pagination?: Partial<OrderPagination>
}

function toText(value: unknown, fallback = '') {
  if (value === null || value === undefined) {
    return fallback
  }

  return String(value)
}

function toNumber(value: unknown, fallback = 0) {
  const numberValue = Number(value)
  return Number.isFinite(numberValue) ? numberValue : fallback
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

function toMoneyText(value: number) {
  return `¥${(value / 100).toFixed(2)}`
}

export function getOrderStatusText(status: OrderStatus) {
  const map: Record<string, string> = {
    pending: '待接单',
    accepted: '已接单',
    cooking: '制作中',
    finished: '已完成',
    cancelled: '已取消'
  }

  return map[String(status)] || '未知状态'
}

function normalizeOrder(raw: RawOrderItem): OrderListItem {
  const orderId = toText(raw.order_id ?? raw.id ?? raw._id)
  const totalAmountCent = toNumber(raw.total_amount_cent ?? raw.total_price_cent ?? raw.total_amount)
  const status = toText(raw.status, 'pending')

  return {
    id: toText(raw._id ?? raw.id ?? orderId),
    order_id: orderId,
    order_no: toText(raw.order_no ?? raw.display_order_no ?? orderId),
    merchant_id: toText(raw.merchant_id),
    status,
    status_text: getOrderStatusText(status),
    payment_status: toText(raw.payment_status),
    pickup_type: toText(raw.pickup_type),
    remark: toText(raw.remark),
    item_count: toNumber(raw.item_count ?? raw.items_count),
    total_amount_cent: totalAmountCent,
    total_amount_text: toMoneyText(totalAmountCent),
    contact_name: toText(raw.contact_name ?? raw.receiver_name ?? raw.user_nickname),
    contact_phone: toText(raw.contact_phone ?? raw.phone),
    user_openid: toText(raw.user_openid ?? raw.openid),
    created_at: toDateText(raw.created_at),
    updated_at: toDateText(raw.updated_at)
  }
}

function normalizePagination(value: Partial<OrderPagination> | undefined, fallbackTotal: number): OrderPagination {
  return {
    page: toNumber(value?.page, 1),
    page_size: toNumber(value?.page_size, 20),
    total: toNumber(value?.total, fallbackTotal),
    has_more: Boolean(value?.has_more)
  }
}

export async function listOrders(merchantId: string, params: ListOrdersParams = {}) {
  const result = await callAdminFunction<OrderListResponse>('getMerchantOrders', {
    action: 'listOrders',
    merchant_id: merchantId,
    ...params
  })

  const list = Array.isArray(result.list) ? result.list.map(normalizeOrder) : []

  return {
    list,
    pagination: normalizePagination(result.pagination, list.length)
  }
}
