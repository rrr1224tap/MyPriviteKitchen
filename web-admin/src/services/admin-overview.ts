import { callAdminFunction } from './cloud'

export interface AdminOverviewMerchants {
  total: number
  active: number
  disabled: number
}

export interface AdminOverviewStaff {
  total: number
  active: number
  disabled: number
  owner: number
  staff: number
}

export interface AdminOverviewWarning {
  type: string
  level: 'warning' | 'notice' | 'error' | 'info'
  title: string
  count?: number
}

export interface AdminOverviewRecentOrder {
  order_id: string
  order_no: string
  status: string
  status_text: string
  total_amount_cent: number
  created_at: string | null
  item_count: number
}

export interface AdminOverviewOrders {
  today_total: number
  today_not_cancelled: number
  today_cancelled: number
  today_finished: number
  recent: AdminOverviewRecentOrder[]
}

export interface AdminOverviewData {
  generated_at: string
  merchants: AdminOverviewMerchants
  staff: AdminOverviewStaff
  orders: AdminOverviewOrders
  warnings: AdminOverviewWarning[]
}

export function fetchAdminOverview() {
  return callAdminFunction<AdminOverviewData>('getAdminOverview')
}
