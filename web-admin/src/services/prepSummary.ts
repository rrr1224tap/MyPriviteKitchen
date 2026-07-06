import { callAdminFunction } from './cloud'

export interface PrepSummarySource {
  dish_id: string
  dish_name: string
  quantity: number
  amount: number
  unit: string
  display_amount: string
}

export interface PrepSummaryItem {
  name: string
  amount: number
  unit: string
  category: string
  note: string
  display_amount: string
  sources: PrepSummarySource[]
}

export interface PrepSummaryGroup {
  category: string
  items: PrepSummaryItem[]
}

export interface PrepSummary {
  date: string
  order_count: number
  item_count: number
  dish_count: number
  ingredient_count: number
  groups: PrepSummaryGroup[]
  copy_text: string
}

interface RawPrepSummarySource {
  dish_id?: unknown
  dish_name?: unknown
  quantity?: unknown
  amount?: unknown
  unit?: unknown
  display_amount?: unknown
}

interface RawPrepSummaryItem {
  name?: unknown
  amount?: unknown
  unit?: unknown
  category?: unknown
  note?: unknown
  display_amount?: unknown
  sources?: unknown
}

interface RawPrepSummaryGroup {
  category?: unknown
  items?: unknown
}

interface RawPrepSummary {
  date?: unknown
  order_count?: unknown
  item_count?: unknown
  dish_count?: unknown
  ingredient_count?: unknown
  groups?: unknown
  copy_text?: unknown
}

export interface GetPrepSummaryParams {
  date?: string
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

function normalizeSource(raw: RawPrepSummarySource): PrepSummarySource {
  const amount = toNumber(raw.amount)
  const unit = toText(raw.unit)

  return {
    dish_id: toText(raw.dish_id),
    dish_name: toText(raw.dish_name, '菜品'),
    quantity: toNumber(raw.quantity),
    amount,
    unit,
    display_amount: toText(raw.display_amount, `${amount}${unit}`)
  }
}

function normalizeItem(raw: RawPrepSummaryItem): PrepSummaryItem {
  const amount = toNumber(raw.amount)
  const unit = toText(raw.unit)
  const sources = Array.isArray(raw.sources)
    ? raw.sources
      .filter((item): item is RawPrepSummarySource =>
        Boolean(item) && typeof item === 'object' && !Array.isArray(item)
      )
      .map(normalizeSource)
    : []

  return {
    name: toText(raw.name, '未命名食材'),
    amount,
    unit,
    category: toText(raw.category, '其他'),
    note: toText(raw.note),
    display_amount: toText(raw.display_amount, `${amount}${unit}`),
    sources
  }
}

function normalizeGroup(raw: RawPrepSummaryGroup): PrepSummaryGroup {
  return {
    category: toText(raw.category, '其他'),
    items: Array.isArray(raw.items)
      ? raw.items
        .filter((item): item is RawPrepSummaryItem =>
          Boolean(item) && typeof item === 'object' && !Array.isArray(item)
        )
        .map(normalizeItem)
      : []
  }
}

export async function getPrepSummary(
  merchantId: string | undefined,
  params: GetPrepSummaryParams = {}
): Promise<PrepSummary> {
  const result = await callAdminFunction<RawPrepSummary>('getPrepSummary', withMerchantId(merchantId, {
    action: 'getPrepSummary',
    ...params
  }))

  return {
    date: toText(result.date),
    order_count: toNumber(result.order_count),
    item_count: toNumber(result.item_count),
    dish_count: toNumber(result.dish_count),
    ingredient_count: toNumber(result.ingredient_count),
    groups: Array.isArray(result.groups)
      ? result.groups
        .filter((item): item is RawPrepSummaryGroup =>
          Boolean(item) && typeof item === 'object' && !Array.isArray(item)
        )
        .map(normalizeGroup)
      : [],
    copy_text: toText(result.copy_text)
  }
}
