import { callAdminFunction } from './cloud'

export type DishStatus = 'on_sale' | 'off_sale' | 'sold_out'

export interface DishListItem {
  id: string
  dish_id: string
  merchant_id: string
  category_id: string
  name: string
  description: string
  image_url: string
  price_cent: number
  price_text: string
  status: DishStatus
  status_text: string
  sort_order: number
  sales_count: number
  tutorials: unknown[]
  ingredients: unknown[]
  created_at: string
  updated_at: string
}

interface RawDishItem {
  _id?: unknown
  id?: unknown
  dish_id?: unknown
  merchant_id?: unknown
  category_id?: unknown
  name?: unknown
  description?: unknown
  image_url?: unknown
  image?: unknown
  price_cent?: unknown
  price?: unknown
  status?: unknown
  sort_order?: unknown
  sales_count?: unknown
  tutorials?: unknown
  ingredients?: unknown
  created_at?: unknown
  updated_at?: unknown
}

interface DishListResponse {
  list?: RawDishItem[]
  total?: unknown
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

function toMoneyText(priceCent: number) {
  return `¥${(priceCent / 100).toFixed(2)}`
}

function toArray(value: unknown) {
  return Array.isArray(value) ? value : []
}

function toStatus(value: unknown): DishStatus {
  if (value === 'on_sale' || value === 'sold_out') {
    return value
  }

  return 'off_sale'
}

function toStatusText(status: DishStatus) {
  if (status === 'on_sale') {
    return '上架中'
  }

  if (status === 'sold_out') {
    return '已售罄'
  }

  return '已下架'
}

function normalizeDish(item: RawDishItem): DishListItem {
  const priceCent = toNumber(item.price_cent ?? item.price)
  const status = toStatus(item.status)
  const dishId = toText(item.dish_id ?? item.id ?? item._id)

  return {
    id: toText(item._id ?? item.id ?? dishId),
    dish_id: dishId,
    merchant_id: toText(item.merchant_id),
    category_id: toText(item.category_id),
    name: toText(item.name, '未命名餐品'),
    description: toText(item.description),
    image_url: toText(item.image_url ?? item.image),
    price_cent: priceCent,
    price_text: toMoneyText(priceCent),
    status,
    status_text: toStatusText(status),
    sort_order: toNumber(item.sort_order),
    sales_count: toNumber(item.sales_count),
    tutorials: toArray(item.tutorials),
    ingredients: toArray(item.ingredients),
    created_at: toText(item.created_at),
    updated_at: toText(item.updated_at)
  }
}

export async function fetchDishes(merchantId: string) {
  const result = await callAdminFunction<DishListResponse>('manageDish', {
    action: 'listDishes',
    merchant_id: merchantId
  })

  const list = Array.isArray(result?.list) ? result.list.map(normalizeDish) : []

  return {
    list,
    total: toNumber(result?.total, list.length)
  }
}
