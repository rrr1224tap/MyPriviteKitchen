<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import ActionButton from '../components/ActionButton.vue'
import EmptyState from '../components/EmptyState.vue'
import GlassCard from '../components/GlassCard.vue'
import PageHeader from '../components/PageHeader.vue'
import StatCard from '../components/StatCard.vue'
import StatusBadge from '../components/StatusBadge.vue'
import {
  getOrderDetail,
  getOrderStatusText,
  listOrders,
  updateOrderStatus,
  type OrderDetail,
  type OrderDetailItem,
  type OrderListItem,
  type OrderPagination,
  type OrderStatus
} from '../services/orders'
import { clearSession, getSession } from '../stores/session'
import type { AdminApiError } from '../types/api'

const MERCHANT_CONTEXT_KEY = 'xiaochu_current_merchant_id'
const SUPER_ADMIN_PREVIEW_MERCHANT_ID = 'xiaochu'
const PAGE_SIZE = 20

interface OrderStatusAction {
  from: 'pending' | 'accepted' | 'cooking'
  to: 'accepted' | 'cooking' | 'finished'
  label: string
  confirmText: string
}

const statusOptions = [
  { value: '', label: '全部' },
  { value: 'pending', label: '待接单' },
  { value: 'accepted', label: '已接单' },
  { value: 'cooking', label: '制作中' },
  { value: 'finished', label: '已完成' },
  { value: 'cancelled', label: '已取消' }
]

const statusActions: Record<string, OrderStatusAction> = {
  pending: {
    from: 'pending',
    to: 'accepted',
    label: '确认接单',
    confirmText: '确认接下这份点菜单吗？确认后会进入已接单状态。'
  },
  accepted: {
    from: 'accepted',
    to: 'cooking',
    label: '开始备餐',
    confirmText: '确认开始备餐吗？确认后点菜单会进入制作中状态。'
  },
  cooking: {
    from: 'cooking',
    to: 'finished',
    label: '标记完成',
    confirmText: '确认将这份点菜单标记为已完成吗？确认后会进入已完成状态。'
  }
}

const router = useRouter()
const session = computed(() => getSession())
const isMerchantAdmin = computed(() => session.value?.role === 'merchant_admin')
const orders = ref<OrderListItem[]>([])
const pagination = ref<OrderPagination>({
  page: 1,
  page_size: PAGE_SIZE,
  total: 0,
  has_more: false
})
const selectedStatus = ref('')
const isLoading = ref(false)
const errorMessage = ref('')
const errorCode = ref('')
const merchantId = ref(getStoredMerchantId() || SUPER_ADMIN_PREVIEW_MERCHANT_ID)
const selectedOrderId = ref('')
const orderDetail = ref<OrderDetail | null>(null)
const isDetailLoading = ref(false)
const detailErrorMessage = ref('')
const detailErrorCode = ref('')
const isStatusUpdating = ref(false)
const statusActionError = ref('')

const requestMerchantId = computed(() => (isMerchantAdmin.value ? undefined : merchantId.value))
const currentMerchantId = computed(() => {
  if (isMerchantAdmin.value) {
    return session.value?.merchant_id || ''
  }

  return merchantId.value
})
const pageDescription = computed(() => {
  if (isMerchantAdmin.value) {
    return `当前小厨房：${currentMerchantId.value || '未识别'}。点菜单列表、详情和出餐进度都跟随登录身份。`
  }

  return `当前小厨：${currentMerchantId.value}。点菜单列表、详情和出餐进度已接入真实云函数。`
})
const pageTitle = computed(() => '今天的点菜单')
const pendingCount = computed(() => orders.value.filter((item) => item.status === 'pending').length)
const processingCount = computed(() =>
  orders.value.filter((item) => item.status === 'accepted' || item.status === 'cooking').length
)
const totalAmountText = computed(() => {
  const total = orders.value.reduce((sum, item) => sum + item.total_amount_cent, 0)
  return `¥${(total / 100).toFixed(2)}`
})
const isAuthError = computed(() => ['UNAUTHORIZED', 'TOKEN_EXPIRED', 'FORBIDDEN'].includes(errorCode.value))
const selectedOrder = computed(() =>
  orders.value.find((item) => getOrderKey(item) === selectedOrderId.value) || null
)
const detailOrder = computed(() => orderDetail.value?.order || selectedOrder.value)
const currentStatusAction = computed(() => {
  const status = detailOrder.value?.status || ''
  return statusActions[String(status)] || null
})

function getStoredMerchantId() {
  if (typeof window === 'undefined') {
    return ''
  }

  return window.localStorage.getItem(MERCHANT_CONTEXT_KEY) || ''
}

function ensureMerchantContext() {
  if (isMerchantAdmin.value && !currentMerchantId.value) {
    errorCode.value = 'SESSION_INVALID'
    errorMessage.value = '小厨登录状态异常，请重新登录'
    clearDetail()
    clearSession()
    router.push('/login')
    return false
  }

  return true
}

function getOrderKey(item: OrderListItem) {
  return item.order_id || item.id
}

function orderTone(status: OrderStatus) {
  if (status === 'pending') {
    return 'orange'
  }

  if (status === 'accepted' || status === 'cooking') {
    return 'brand'
  }

  if (status === 'finished') {
    return 'green'
  }

  return 'muted'
}

function formatDateTime(value: string | null) {
  if (!value) {
    return '-'
  }

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return value
  }

  return new Intl.DateTimeFormat('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  }).format(date)
}

function maskOpenid(value: string) {
  if (!value) {
    return ''
  }

  return value.length > 10 ? `${value.slice(0, 6)}...${value.slice(-4)}` : value
}

function getContactText(item: OrderListItem) {
  return item.contact_name || item.contact_phone || maskOpenid(item.user_openid) || '-'
}

function getRemarkText(value: string) {
  return value || '-'
}

function clearDetail() {
  selectedOrderId.value = ''
  orderDetail.value = null
  detailErrorMessage.value = ''
  detailErrorCode.value = ''
  statusActionError.value = ''
}

async function loadOrderDetail(orderId = selectedOrderId.value) {
  if (!orderId) {
    clearDetail()
    return
  }

  if (!ensureMerchantContext()) {
    return
  }

  isDetailLoading.value = true
  detailErrorMessage.value = ''
  detailErrorCode.value = ''

  try {
    const result = await getOrderDetail(requestMerchantId.value, orderId)
    orderDetail.value = result
  } catch (error) {
    const apiError = error as AdminApiError
    detailErrorCode.value = apiError.code || 'UNKNOWN'
    detailErrorMessage.value = apiError.message || '点菜单详情读取失败，请稍后重试'
    orderDetail.value = null
  } finally {
    isDetailLoading.value = false
  }
}

function openOrderDetail(item: OrderListItem) {
  selectedOrderId.value = getOrderKey(item)
  orderDetail.value = null
  statusActionError.value = ''
  loadOrderDetail(selectedOrderId.value)
}

function formatOptionList(items: Array<Record<string, unknown>>) {
  if (!items.length) {
    return ''
  }

  return items
    .map((item) => {
      const groupName = String(item.group_name || item.name || item.group_id || '选项')
      const optionName = String(item.option_name || item.option_id || '')
      const options = Array.isArray(item.options)
        ? item.options
          .map((option) => String((option as Record<string, unknown>).option_name || (option as Record<string, unknown>).option_id || ''))
          .filter(Boolean)
          .join('、')
        : ''

      return [groupName, optionName || options].filter(Boolean).join('：')
    })
    .filter(Boolean)
    .join('；')
}

function getItemOptionsText(item: OrderDetailItem) {
  const specs = formatOptionList(item.selected_specs)
  const addons = formatOptionList(item.selected_addons)

  return [specs, addons].filter(Boolean).join(' / ')
}

async function loadOrders(page = 1) {
  if (!ensureMerchantContext()) {
    return
  }

  isLoading.value = true
  errorMessage.value = ''
  errorCode.value = ''

  try {
    const result = await listOrders(requestMerchantId.value, {
      page,
      page_size: PAGE_SIZE,
      status: selectedStatus.value || undefined
    })

    orders.value = result.list
    pagination.value = result.pagination
    if (selectedOrderId.value && !result.list.some((item) => getOrderKey(item) === selectedOrderId.value)) {
      clearDetail()
    }
  } catch (error) {
    const apiError = error as AdminApiError
    errorCode.value = apiError.code || 'UNKNOWN'
    errorMessage.value = apiError.message || '点菜单列表读取失败，请稍后重试'
    orders.value = []
    clearDetail()
    pagination.value = {
      page,
      page_size: PAGE_SIZE,
      total: 0,
      has_more: false
    }
  } finally {
    isLoading.value = false
  }
}

async function handleStatusUpdate() {
  if (!ensureMerchantContext()) {
    return
  }

  const action = currentStatusAction.value
  const order = detailOrder.value
  const orderId = order ? getOrderKey(order) : ''

  if (!action || !orderId || isStatusUpdating.value) {
    return
  }

  const confirmed = window.confirm(action.confirmText)
  if (!confirmed) {
    return
  }

  isStatusUpdating.value = true
  statusActionError.value = ''

  try {
    await updateOrderStatus(requestMerchantId.value, orderId, action.to)
    const detailOrderId = selectedOrderId.value
    await loadOrders(pagination.value.page)
    if (detailOrderId) {
      selectedOrderId.value = detailOrderId
      await loadOrderDetail(detailOrderId)
    }
    window.alert('点菜单状态已更新，列表已刷新')
  } catch (error) {
    const apiError = error as AdminApiError
    statusActionError.value = apiError.message || '点菜单状态更新失败，请稍后重试'
    window.alert('点菜单状态更新失败，请稍后重试')
  } finally {
    isStatusUpdating.value = false
  }
}

function changeStatus(value: string) {
  if (selectedStatus.value === value || isLoading.value) {
    return
  }

  selectedStatus.value = value
  loadOrders(1)
}

onMounted(() => {
  loadOrders()
})
</script>

<template>
  <section class="page-stack">
    <PageHeader
      eyebrow="Orders"
      :title="pageTitle"
      :description="pageDescription"
    >
      <template #actions>
        <ActionButton variant="ghost" :disabled="isLoading" @click="loadOrders(pagination.page)">
          {{ isLoading ? '刷新中...' : '刷新' }}
        </ActionButton>
      </template>
    </PageHeader>

    <section class="stat-grid">
      <StatCard title="当前列表" :value="pagination.total" caption="真实点菜单数量" icon="单" />
      <StatCard title="待接单" :value="pendingCount" caption="当前页待处理" tone="orange" icon="接" />
      <StatCard title="处理中" :value="processingCount" caption="已接单 / 制作中" tone="brand" icon="制" />
      <StatCard title="当前页金额" :value="totalAmountText" caption="按当前页汇总" tone="green" icon="¥" />
    </section>

    <GlassCard>
      <div class="section-heading">
        <div>
          <h2>点菜单列表</h2>
          <p>内容来自 getMerchantOrders.listOrders，支持分页、筛选、刷新和查看详情。</p>
        </div>
        <StatusBadge label="真实内容" tone="green" />
      </div>

      <div class="toolbar">
        <div class="filter-pills">
          <button
            v-for="item in statusOptions"
            :key="item.value || 'all'"
            class="filter-pill"
            :class="{ 'is-active': selectedStatus === item.value }"
            type="button"
            :disabled="isLoading"
            @click="changeStatus(item.value)"
          >
            {{ item.label }}
          </button>
        </div>
      </div>

      <div v-if="errorMessage" class="inline-error">
        <div>
          <strong>点菜单列表读取失败</strong>
          <span>{{ errorMessage }}（{{ errorCode }}）</span>
        </div>
        <ActionButton variant="ghost" :disabled="isLoading" @click="loadOrders(1)">
          {{ isAuthError ? '重新尝试' : '重试' }}
        </ActionButton>
      </div>

      <EmptyState v-else-if="isLoading" title="正在读取点菜单" description="请稍候，正在从云函数获取当前小厨房的点菜单。" />
      <EmptyState
        v-else-if="orders.length === 0"
        title="暂无点菜单"
        description="当前小厨房在该筛选条件下还没有点菜单。"
      />

      <div v-else class="mock-table orders-table">
        <div class="mock-table__head mock-table__row orders-table__row">
          <span>点菜单号</span>
          <span>下单时间</span>
          <span>联系人</span>
          <span>金额</span>
          <span>菜品数</span>
          <span>状态</span>
          <span>备注</span>
          <span>操作</span>
        </div>
        <div
          v-for="item in orders"
          :key="item.order_id || item.id"
          class="mock-table__row orders-table__row"
          :class="{ 'orders-table__row--selected': getOrderKey(item) === selectedOrderId }"
        >
          <span>
            <strong class="order-no">{{ item.order_no || item.order_id }}</strong>
          </span>
          <span>{{ formatDateTime(item.created_at) }}</span>
          <span>{{ getContactText(item) }}</span>
          <span class="order-amount">{{ item.total_amount_text }}</span>
          <span>{{ item.item_count }}</span>
          <span>
            <StatusBadge :label="getOrderStatusText(item.status)" :tone="orderTone(item.status)" />
          </span>
          <span class="order-remark">{{ getRemarkText(item.remark) }}</span>
          <span class="table-action-group">
            <ActionButton variant="ghost" @click="openOrderDetail(item)">查看详情</ActionButton>
          </span>
        </div>
      </div>

      <div v-if="orders.length" class="orders-pagination">
        <span>第 {{ pagination.page }} 页，每页 {{ pagination.page_size }} 条，共 {{ pagination.total }} 条</span>
        <div class="card-actions">
          <ActionButton
            variant="ghost"
            :disabled="isLoading || pagination.page <= 1"
            @click="loadOrders(pagination.page - 1)"
          >
            上一页
          </ActionButton>
          <ActionButton
            variant="ghost"
            :disabled="isLoading || !pagination.has_more"
            @click="loadOrders(pagination.page + 1)"
          >
            下一页
          </ActionButton>
        </div>
      </div>
    </GlassCard>

    <GlassCard>
      <div class="section-heading">
        <div>
          <h2>点菜单详情</h2>
          <p>查看选中点菜单的基础信息、联系信息、菜品明细和备注。</p>
        </div>
        <StatusBadge
          :label="detailOrder ? getOrderStatusText(detailOrder.status) : '未选择'"
          :tone="detailOrder ? orderTone(detailOrder.status) : 'muted'"
        />
      </div>

      <EmptyState
        v-if="!selectedOrderId"
        title="请选择点菜单"
        description="点击左侧点菜单列表中的查看详情，读取真实点菜单详情。"
      />

      <EmptyState
        v-else-if="isDetailLoading"
        title="正在读取详情"
        description="请稍候，正在从云函数获取真实点菜单详情。"
      />

      <div v-else-if="detailErrorMessage" class="inline-error">
        <div>
          <strong>点菜单详情读取失败</strong>
          <span>{{ detailErrorMessage }}（{{ detailErrorCode }}）</span>
        </div>
        <ActionButton variant="ghost" :disabled="isDetailLoading" @click="loadOrderDetail()">
          重试
        </ActionButton>
      </div>

      <EmptyState
        v-else-if="!orderDetail"
        title="暂无详情"
        description="当前点菜单详情为空，请刷新后重试。"
      />

      <div v-else class="order-detail-panel">
        <div class="order-detail-section">
          <div class="order-detail-title">
            <strong>{{ orderDetail.order.order_no || orderDetail.order.order_id }}</strong>
            <StatusBadge :label="getOrderStatusText(orderDetail.order.status)" :tone="orderTone(orderDetail.order.status)" />
          </div>
          <div class="order-detail-meta">
            <span>下单：{{ formatDateTime(orderDetail.order.created_at) }}</span>
            <span>更新：{{ formatDateTime(orderDetail.order.updated_at) }}</span>
            <span>金额：{{ orderDetail.order.total_amount_text }}</span>
            <span>菜品数：{{ orderDetail.order.item_count }}</span>
          </div>
        </div>

        <div class="order-detail-section">
          <div class="order-detail-title compact">
            <strong>联系信息</strong>
          </div>
          <div class="order-detail-meta">
            <span>联系人：{{ getContactText(orderDetail.order) }}</span>
            <span>手机：{{ orderDetail.order.contact_phone || '-' }}</span>
            <span>用户：{{ maskOpenid(orderDetail.order.user_openid) || '-' }}</span>
          </div>
        </div>

        <div class="order-detail-section">
          <div class="order-detail-title compact">
            <strong>菜品明细</strong>
            <span>{{ orderDetail.items.length }} 项</span>
          </div>
          <div v-if="orderDetail.items.length" class="order-items-list">
            <div v-for="item in orderDetail.items" :key="item.order_item_id || item.id" class="order-item-card">
              <div>
                <strong>{{ item.dish_name }}</strong>
                <span v-if="getItemOptionsText(item)">{{ getItemOptionsText(item) }}</span>
                <span v-else>暂无规格 / 加料</span>
              </div>
              <div>
                <b>{{ item.quantity }} 份</b>
                <span>{{ item.unit_price_text }} / 份</span>
                <strong>{{ item.subtotal_text }}</strong>
              </div>
            </div>
          </div>
          <p v-else class="dish-detail-muted">暂无菜品明细</p>
        </div>

        <div class="order-detail-section">
          <div class="order-detail-title compact">
            <strong>备注与其它信息</strong>
          </div>
          <div class="order-detail-meta">
            <span>备注：{{ orderDetail.order.remark || '暂无' }}</span>
            <span>取餐时间：{{ orderDetail.order.pickup_time || '暂无' }}</span>
            <span>用餐方式：{{ orderDetail.order.dining_type || orderDetail.order.pickup_type || '暂无' }}</span>
            <span>地址：{{ orderDetail.order.address || '暂无' }}</span>
          </div>
        </div>

        <div class="card-actions">
          <ActionButton
            v-if="currentStatusAction"
            variant="primary"
            :disabled="isStatusUpdating || isDetailLoading"
            @click="handleStatusUpdate"
          >
            {{ isStatusUpdating ? '更新中...' : currentStatusAction.label }}
          </ActionButton>
          <span v-else class="order-status-note">当前状态暂无下一步流转操作</span>
          <ActionButton variant="ghost" @click="clearDetail">关闭详情</ActionButton>
        </div>
        <p v-if="statusActionError" class="form-error">{{ statusActionError }}</p>
      </div>
    </GlassCard>
  </section>
</template>
