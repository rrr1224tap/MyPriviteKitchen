<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import ActionButton from '../components/ActionButton.vue'
import EmptyState from '../components/EmptyState.vue'
import GlassCard from '../components/GlassCard.vue'
import PageHeader from '../components/PageHeader.vue'
import StatCard from '../components/StatCard.vue'
import StatusBadge from '../components/StatusBadge.vue'
import {
  getOrderStatusText,
  listOrders,
  type OrderListItem,
  type OrderPagination,
  type OrderStatus
} from '../services/orders'
import type { AdminApiError } from '../types/api'

const MERCHANT_CONTEXT_KEY = 'xiaochu_current_merchant_id'
const FALLBACK_MERCHANT_ID = 'xiaochu'
const PAGE_SIZE = 20

const statusOptions = [
  { value: '', label: '全部' },
  { value: 'pending', label: '待接单' },
  { value: 'accepted', label: '已接单' },
  { value: 'cooking', label: '制作中' },
  { value: 'finished', label: '已完成' },
  { value: 'cancelled', label: '已取消' }
]

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
const merchantId = ref(getStoredMerchantId() || FALLBACK_MERCHANT_ID)

const pendingCount = computed(() => orders.value.filter((item) => item.status === 'pending').length)
const processingCount = computed(() =>
  orders.value.filter((item) => item.status === 'accepted' || item.status === 'cooking').length
)
const totalAmountText = computed(() => {
  const total = orders.value.reduce((sum, item) => sum + item.total_amount_cent, 0)
  return `¥${(total / 100).toFixed(2)}`
})
const isAuthError = computed(() => ['UNAUTHORIZED', 'TOKEN_EXPIRED', 'FORBIDDEN'].includes(errorCode.value))

function getStoredMerchantId() {
  if (typeof window === 'undefined') {
    return ''
  }

  return window.localStorage.getItem(MERCHANT_CONTEXT_KEY) || ''
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

function showPendingTip() {
  window.alert('订单详情和状态流转会在后续版本接入，本阶段只开放订单列表真实读取。')
}

async function loadOrders(page = 1) {
  isLoading.value = true
  errorMessage.value = ''
  errorCode.value = ''

  try {
    const result = await listOrders(merchantId.value, {
      page,
      page_size: PAGE_SIZE,
      status: selectedStatus.value || undefined
    })

    orders.value = result.list
    pagination.value = result.pagination
  } catch (error) {
    const apiError = error as AdminApiError
    errorCode.value = apiError.code || 'UNKNOWN'
    errorMessage.value = apiError.message || '订单列表读取失败，请稍后重试'
    orders.value = []
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
      title="订单管理"
      :description="`当前商户：${merchantId}。订单列表已接入 getMerchantOrders.listOrders；详情和状态流转暂不执行真实写入。`"
    >
      <template #actions>
        <ActionButton variant="ghost" :disabled="isLoading" @click="loadOrders(pagination.page)">
          {{ isLoading ? '刷新中...' : '刷新' }}
        </ActionButton>
      </template>
    </PageHeader>

    <section class="stat-grid">
      <StatCard title="当前列表" :value="pagination.total" caption="真实订单数量" icon="单" />
      <StatCard title="待接单" :value="pendingCount" caption="当前页待处理" tone="orange" icon="接" />
      <StatCard title="处理中" :value="processingCount" caption="已接单 / 制作中" tone="brand" icon="制" />
      <StatCard title="当前页金额" :value="totalAmountText" caption="按当前页汇总" tone="green" icon="¥" />
    </section>

    <GlassCard>
      <div class="section-heading">
        <div>
          <h2>订单列表</h2>
          <p>数据来自 getMerchantOrders.listOrders，仅做真实读取，不开放详情和状态流转。</p>
        </div>
        <StatusBadge label="真实数据" tone="green" />
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
          <strong>订单列表读取失败</strong>
          <span>{{ errorMessage }}（{{ errorCode }}）</span>
        </div>
        <ActionButton variant="ghost" :disabled="isLoading" @click="loadOrders(1)">
          {{ isAuthError ? '重新尝试' : '重试' }}
        </ActionButton>
      </div>

      <EmptyState v-else-if="isLoading" title="正在读取订单" description="请稍候，正在从云函数获取当前商户订单列表。" />
      <EmptyState
        v-else-if="orders.length === 0"
        title="暂无订单"
        description="当前商户在该筛选条件下还没有订单。"
      />

      <div v-else class="mock-table orders-table">
        <div class="mock-table__head mock-table__row orders-table__row">
          <span>订单号</span>
          <span>下单时间</span>
          <span>联系人</span>
          <span>金额</span>
          <span>商品数</span>
          <span>状态</span>
          <span>备注</span>
          <span>操作</span>
        </div>
        <div
          v-for="item in orders"
          :key="item.order_id || item.id"
          class="mock-table__row orders-table__row"
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
            <ActionButton variant="ghost" @click="showPendingTip">查看详情</ActionButton>
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
  </section>
</template>
