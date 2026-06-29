import { callAdminFunction } from './cloud'

export interface AdminOverviewSummary {
  today_orders: number
  active_merchants: number
  merchant_staff: number
  pending_warnings: number
}

export interface AdminOverviewWarning {
  level: 'error' | 'warning' | 'info'
  title: string
  description: string
}

export interface AdminOverviewRecentOrder {
  order_id: string
  merchant_name: string
  status: string
  total_amount_cent: number
  created_at: string
}

export interface AdminOverviewData {
  summary: AdminOverviewSummary
  warnings: AdminOverviewWarning[]
  recent_orders: AdminOverviewRecentOrder[]
}

export function fetchAdminOverview() {
  return callAdminFunction<AdminOverviewData>('getAdminOverview')
}
