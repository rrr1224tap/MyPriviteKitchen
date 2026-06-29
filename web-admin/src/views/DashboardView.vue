<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import ModuleCard from '../components/ModuleCard.vue'
import StatCard from '../components/StatCard.vue'
import StatusBadge from '../components/StatusBadge.vue'
import { fetchAdminOverview, type AdminOverviewData } from '../services/admin-overview'
import type { AdminApiError } from '../types/api'

const router = useRouter()

const overview = ref<AdminOverviewData | null>(null)
const isLoading = ref(false)
const errorMessage = ref('')
const errorCode = ref('')

const modules = [
  { title: '商户管理', description: '维护商户基础信息与启用状态', tag: '后台', path: '/merchants', icon: '商' },
  { title: '成员邀请', description: '生成邀请码并管理成员身份', tag: '权限', path: '/merchants/xiaochu/staff', icon: '员' },
  { title: '餐品管理', description: '维护菜品、规格、加料与食材', tag: '菜单', path: '/dishes', icon: '餐' },
  { title: '今日备料', description: '按今日订单汇总采购清单', tag: '私厨', path: '/prep-summary', icon: '备' },
  { title: '数据检查', description: '检查关键数据完整性与轻量修复', tag: '安全', path: '/data-health', icon: '检' }
]

const stats = computed(() => [
  {
    title: '今日订单',
    value: overview.value?.orders.today_total ?? (isLoading.value ? '...' : 0),
    caption: `未取消 ${overview.value?.orders.today_not_cancelled ?? 0} 单，已取消 ${overview.value?.orders.today_cancelled ?? 0} 单`,
    tone: 'brand' as const,
    icon: '单'
  },
  {
    title: '启用商户',
    value: overview.value?.merchants.active ?? (isLoading.value ? '...' : 0),
    caption: `共 ${overview.value?.merchants.total ?? 0} 个商户，禁用 ${overview.value?.merchants.disabled ?? 0} 个`,
    tone: 'green' as const,
    icon: '商'
  },
  {
    title: '商户成员',
    value: overview.value?.staff.active ?? (isLoading.value ? '...' : 0),
    caption: `共 ${overview.value?.staff.total ?? 0} 人，停用 ${overview.value?.staff.disabled ?? 0} 人`,
    tone: 'orange' as const,
    icon: '员'
  },
  {
    title: '待处理提醒',
    value: overview.value?.warnings.length ?? (isLoading.value ? '...' : 0),
    caption: '来自真实后台数据概览',
    tone: 'muted' as const,
    icon: '醒'
  }
])

const warnings = computed(() => overview.value?.warnings || [])

const recentOrders = computed(() => (
  overview.value?.orders.recent.map((order) => ({
    no: order.order_no || order.order_id || '未命名订单',
    dish: `${order.item_count || 0} 件商品`,
    status: order.status_text || formatOrderStatus(order.status),
    amount: formatAmount(order.total_amount_cent)
  })) || []
))

const isAuthError = computed(() => ['UNAUTHORIZED', 'TOKEN_EXPIRED', 'FORBIDDEN'].includes(errorCode.value))

function openModule(path: string) {
  router.push(path)
}

function goLogin() {
  router.push('/login')
}

function formatAmount(value: number) {
  const amount = Number.isFinite(value) ? value : 0
  return `¥${(amount / 100).toFixed(2)}`
}

function formatOrderStatus(status: string) {
  const statusMap: Record<string, string> = {
    pending: '待接单',
    accepted: '已接单',
    cooking: '制作中',
    finished: '已完成',
    cancelled: '已取消',
    canceled: '已取消'
  }
  return statusMap[status] || '未知状态'
}

function orderTone(status: string) {
  if (status === '已完成') return 'green'
  if (status === '制作中') return 'orange'
  if (status === '已接单') return 'muted'
  return 'brand'
}

async function loadOverview() {
  isLoading.value = true
  errorMessage.value = ''
  errorCode.value = ''

  try {
    overview.value = await fetchAdminOverview()
  } catch (error) {
    const apiError = error as Partial<AdminApiError>
    errorCode.value = apiError.code || 'NETWORK_ERROR'
    errorMessage.value = isAuthError.value
      ? '登录状态无效或已过期，请重新登录'
      : apiError.message || '后台总览加载失败，请稍后重试'
  } finally {
    isLoading.value = false
  }
}

onMounted(() => {
  loadOverview()
})
</script>

<template>
  <section class="dashboard-view">
    <div class="dashboard-hero glass-card">
      <div>
        <div class="dashboard-hero__kicker">Private Kitchen Web Admin v0.5-B5</div>
        <h1>欢迎回来，小厨管理员</h1>
        <p>当前总览数据已接入真实云函数，其它模块仍为静态原型</p>
      </div>
      <StatusBadge :label="isLoading ? '加载中' : '真实总览'" tone="orange" />
    </div>

    <section v-if="errorMessage" class="panel glass-card">
      <div class="section-heading">
        <div>
          <h2>总览加载失败</h2>
          <p>{{ errorMessage }}</p>
        </div>
        <div class="dashboard-actions">
          <button class="ghost-button" type="button" @click="loadOverview">重试</button>
          <button v-if="isAuthError" class="primary-button" type="button" @click="goLogin">返回登录页</button>
        </div>
      </div>
    </section>

    <section class="stat-grid" aria-label="数据统计">
      <StatCard
        v-for="item in stats"
        :key="item.title"
        :title="item.title"
        :value="item.value"
        :caption="item.caption"
        :tone="item.tone"
        :icon="item.icon"
      />
    </section>

    <section class="content-grid">
      <div class="panel glass-card">
        <div class="section-heading">
          <div>
            <h2>后台模块</h2>
            <p>总览已接入真实数据，其它模块入口仍用于原型预览</p>
          </div>
        </div>
        <div class="module-grid">
          <ModuleCard
            v-for="item in modules"
            :key="item.title"
            :title="item.title"
            :description="item.description"
            :tag="item.tag"
            :icon="item.icon"
            @select="openModule(item.path)"
          />
        </div>
      </div>

      <div class="panel-stack">
        <section class="panel glass-card">
          <div class="section-heading">
            <div>
              <h2>风险提醒</h2>
              <p>来自真实后台数据概览</p>
            </div>
          </div>
          <ul v-if="warnings.length" class="warning-list">
            <li v-for="item in warnings" :key="item.type">
              <span class="warning-dot"></span>
              <span>{{ item.title }}<template v-if="item.count">：{{ item.count }}</template></span>
            </li>
          </ul>
          <div v-else class="empty-state">
            <div class="empty-state__mark">✓</div>
            <h3>暂无风险提醒</h3>
            <p>当前后台数据没有需要立即处理的提醒。</p>
          </div>
        </section>

        <section class="panel glass-card">
          <div class="section-heading">
            <div>
              <h2>最近订单</h2>
              <p>显示最近 5 条真实订单</p>
            </div>
          </div>
          <div v-if="recentOrders.length" class="order-list">
            <article v-for="order in recentOrders" :key="order.no" class="order-row">
              <div>
                <div class="order-row__no">{{ order.no }}</div>
                <div class="order-row__dish">{{ order.dish }}</div>
              </div>
              <div class="order-row__side">
                <StatusBadge :label="order.status" :tone="orderTone(order.status)" />
                <div class="order-row__amount">{{ order.amount }}</div>
              </div>
            </article>
          </div>
          <div v-else class="empty-state">
            <div class="empty-state__mark">单</div>
            <h3>暂无最近订单</h3>
            <p>有新订单后，这里会显示最近订单摘要。</p>
          </div>
        </section>
      </div>
    </section>
  </section>
</template>
