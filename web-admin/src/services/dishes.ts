import { callAdminFunction } from './cloud'

export type DishStatus = 'on_sale' | 'off_sale' | 'sold_out'
export type DishTutorialPlatform = 'douyin' | 'xiaohongshu' | 'bilibili' | 'other'

export interface DishTutorial {
  title: string
  platform: DishTutorialPlatform
  url: string
  note: string
  enabled: boolean
  sort_order: number
}

export interface DishIngredient {
  name: string
  amount: number
  unit: string
  category: string
  note: string
  enabled: boolean
  sort_order: number
}

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
  tutorials: DishTutorial[]
  ingredients: DishIngredient[]
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

export interface CreateDishPayload {
  name: string
  category_id: string
  price: number
  description?: string
  image_url?: string
}

export interface UpdateDishPayload {
  name: string
  category_id: string
  price: number
  description?: string
  image_url?: string
}

export type UpdateDishStatusValue = 'on_sale' | 'off_sale'

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

function toTutorialPlatform(value: unknown): DishTutorialPlatform {
  if (value === 'douyin' || value === 'xiaohongshu' || value === 'bilibili') {
    return value
  }

  return 'other'
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

function normalizeTutorial(item: unknown, index: number): DishTutorial | null {
  if (!item || typeof item !== 'object' || Array.isArray(item)) {
    return null
  }

  const source = item as Record<string, unknown>
  const title = toText(source.title).trim()
  const url = toText(source.url).trim()
  const note = toText(source.note).trim()

  if (!title && !url && !note) {
    return null
  }

  return {
    title: title || `做法参考 ${index + 1}`,
    platform: toTutorialPlatform(source.platform),
    url,
    note,
    enabled: typeof source.enabled === 'boolean' ? source.enabled : true,
    sort_order: toNumber(source.sort_order, index + 1)
  }
}

function normalizeTutorials(value: unknown): DishTutorial[] {
  return toArray(value)
    .map((item, index) => normalizeTutorial(item, index))
    .filter((item): item is DishTutorial => Boolean(item))
    .slice(0, 3)
}

function normalizeIngredient(item: unknown, index: number): DishIngredient | null {
  if (!item || typeof item !== 'object' || Array.isArray(item)) {
    return null
  }

  const source = item as Record<string, unknown>
  const name = toText(source.name).trim()
  if (!name) {
    return null
  }

  return {
    name,
    amount: toNumber(source.amount),
    unit: toText(source.unit).trim(),
    category: toText(source.category, '其他').trim() || '其他',
    note: toText(source.note).trim(),
    enabled: typeof source.enabled === 'boolean' ? source.enabled : true,
    sort_order: toNumber(source.sort_order, index + 1)
  }
}

function normalizeIngredients(value: unknown): DishIngredient[] {
  return toArray(value)
    .map((item, index) => normalizeIngredient(item, index))
    .filter((item): item is DishIngredient => Boolean(item))
    .map((item, index) => ({
      ...item,
      sort_order: index + 1
    }))
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
    tutorials: normalizeTutorials(item.tutorials),
    ingredients: normalizeIngredients(item.ingredients),
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

export async function createDish(merchantId: string, payload: CreateDishPayload) {
  const result = await callAdminFunction<{ dish?: RawDishItem }>('manageDish', {
    action: 'createDish',
    merchant_id: merchantId,
    ...payload
  })

  return result.dish ? normalizeDish(result.dish) : null
}

export async function updateDish(merchantId: string, dishId: string, payload: UpdateDishPayload) {
  const result = await callAdminFunction<{ dish?: RawDishItem }>('manageDish', {
    action: 'updateDish',
    merchant_id: merchantId,
    dish_id: dishId,
    ...payload
  })

  return result.dish ? normalizeDish(result.dish) : null
}

export async function updateDishStatus(
  merchantId: string,
  dishId: string,
  status: UpdateDishStatusValue
) {
  const result = await callAdminFunction<{ dish?: RawDishItem }>('manageDish', {
    action: 'updateDishStatus',
    merchant_id: merchantId,
    dish_id: dishId,
    status
  })

  return result.dish ? normalizeDish(result.dish) : null
}

export async function updateDishTutorials(
  merchantId: string,
  dishId: string,
  tutorials: DishTutorial[]
) {
  const result = await callAdminFunction<{ dish?: RawDishItem }>('manageDish', {
    action: 'updateDishTutorials',
    merchant_id: merchantId,
    dish_id: dishId,
    tutorials
  })

  return result.dish ? normalizeDish(result.dish) : null
}

export async function updateDishIngredients(
  merchantId: string,
  dishId: string,
  ingredients: DishIngredient[]
) {
  const result = await callAdminFunction<{ dish?: RawDishItem }>('manageDish', {
    action: 'updateDishIngredients',
    merchant_id: merchantId,
    dish_id: dishId,
    ingredients
  })

  return result.dish ? normalizeDish(result.dish) : null
}
