<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import ActionButton from '../components/ActionButton.vue'
import EmptyState from '../components/EmptyState.vue'
import GlassCard from '../components/GlassCard.vue'
import MockTable from '../components/MockTable.vue'
import PageHeader from '../components/PageHeader.vue'
import StatCard from '../components/StatCard.vue'
import StatusBadge from '../components/StatusBadge.vue'
import { fetchMerchants, type MerchantListItem, type MerchantStatus } from '../services/merchants'
import type { AdminApiError } from '../types/api'

type StatusFilter = 'all' | MerchantStatus

const router = useRouter()

const merchants = ref<MerchantListItem[]>([])
const isLoading = ref(false)
const errorMessage = ref('')
const errorCode = ref('')
const statusFilter = ref<StatusFilter>('all')
const searchKeyword = ref('')

const isAuthError = computed(() => ['UNAUTHORIZED', 'TOKEN_EXPIRED', 'FORBIDDEN'].includes(errorCode.value))

const filteredMerchants = computed(() => {
  const keyword = searchKeyword.value.trim().toLowerCase()

  return merchants.value.filter((merchant) => {
    const statusMatched = statusFilter.value === 'all' || merchant.status === statusFilter.value
    const keywordMatched = !keyword ||
      merchant.name.toLowerCase().includes(keyword) ||
      merchant.short_name.toLowerCase().includes(keyword) ||
      merchant.merchant_id.toLowerCase().includes(keyword)

    return statusMatched && keywordMatched
  })
})

const merchantRows = computed(() => filteredMerchants.value.map((merchant) => ({
  商户名称: merchant.name || merchant.short_name || '未命名商户',
  merchant_id: merchant.merchant_id || '-',
  状态: formatStatus(merchant.status),
  成员数: merchant.members_count,
  负责人: merchant.masked_owner_openid || maskOpenid(merchant.owner_openid) || '-',
  更新时间: formatDate(merchant.updated_at || merchant.created_at)
})))

const activeCount = computed(() => merchants.value.filter((merchant) => merchant.status === 'active').length)
const disabledCount = computed(() => merchants.value.filter((merchant) => merchant.status === 'disabled').length)
const incompleteCount = computed(() => merchants.value.filter((merchant) => !merchant.owner_openid || !merchant.notice).length)
const selectedMerchant = computed(() => filteredMerchants.value[0] || merchants.value[0] || null)

function formatStatus(status: MerchantStatus) {
  return status === 'disabled' ? '禁用' : '启用'
}

function formatDate(value: string | null) {
  if (!value) {
    return '-'
  }

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return value
  }

  const year = date.getFullYear()
  const month = `${date.getMonth() + 1}`.padStart(2, '0')
  const day = `${date.getDate()}`.padStart(2, '0')
  const hour = `${date.getHours()}`.padStart(2, '0')
  const minute = `${date.getMinutes()}`.padStart(2, '0')
  return `${year}-${month}-${day} ${hour}:${minute}`
}

function maskOpenid(openid: string) {
  if (!openid) {
    return ''
  }

  if (openid.length <= 8) {
    return openid
  }

  return `${openid.slice(0, 4)}****${openid.slice(-4)}`
}

function showPendingTip() {
  window.alert('当前商户列表已接入真实云函数，新增 / 编辑 / 启停将在后续版本接入')
}

function openStaff() {
  router.push(`/merchants/${selectedMerchant.value?.merchant_id || 'xiaochu'}/staff`)
}

function goLogin() {
  router.push('/login')
}

async function loadMerchants() {
  isLoading.value = true
  errorMessage.value = ''
  errorCode.value = ''

  try {
    const result = await fetchMerchants()
    merchants.value = result.list
  } catch (error) {
    const apiError = error as Partial<AdminApiError>
    errorCode.value = apiError.code || 'NETWORK_ERROR'
    errorMessage.value = isAuthError.value
      ? '登录状态无效或已过期，请重新登录'
      : apiError.message || '商户列表加载失败，请稍后重试'
  } finally {
    isLoading.value = false
  }
}

onMounted(() => {
  loadMerchants()
})
</script>

<template>
  <section class="page-stack">
    <PageHeader
      eyebrow="Merchants"
      title="商户管理"
      description="当前商户列表已接入真实云函数，新增 / 编辑 / 启停仍待接入。"
    >
      <template #actions>
        <ActionButton variant="primary" @click="showPendingTip">新增商户</ActionButton>
        <ActionButton @click="loadMerchants">刷新列表</ActionButton>
      </template>
    </PageHeader>

    <section class="stat-grid">
      <StatCard title="商户总数" :value="isLoading ? '...' : merchants.length" caption="来自 manageMerchant.list" icon="商" />
      <StatCard title="启用商户" :value="isLoading ? '...' : activeCount" caption="可被当前系统使用" tone="green" icon="启" />
      <StatCard title="禁用商户" :value="isLoading ? '...' : disabledCount" caption="暂不参与经营" tone="muted" icon="停" />
      <StatCard title="待完善资料" :value="isLoading ? '...' : incompleteCount" caption="负责人或备注待补充" tone="orange" icon="补" />
    </section>

    <section v-if="errorMessage" class="panel glass-card">
      <div class="section-heading">
        <div>
          <h2>商户列表加载失败</h2>
          <p>{{ errorMessage }}</p>
        </div>
        <div class="dashboard-actions">
          <button class="ghost-button" type="button" @click="loadMerchants">重试</button>
          <button v-if="isAuthError" class="primary-button" type="button" @click="goLogin">返回登录页</button>
        </div>
      </div>
    </section>

    <GlassCard>
      <div class="toolbar">
        <div class="filter-pills">
          <button
            class="filter-pill"
            :class="{ 'is-active': statusFilter === 'all' }"
            type="button"
            @click="statusFilter = 'all'"
          >
            全部
          </button>
          <button
            class="filter-pill"
            :class="{ 'is-active': statusFilter === 'active' }"
            type="button"
            @click="statusFilter = 'active'"
          >
            启用
          </button>
          <button
            class="filter-pill"
            :class="{ 'is-active': statusFilter === 'disabled' }"
            type="button"
            @click="statusFilter = 'disabled'"
          >
            禁用
          </button>
        </div>
        <input v-model="searchKeyword" class="search-input" placeholder="搜索商户名称或 ID" aria-label="搜索商户" />
      </div>

      <div v-if="isLoading" class="empty-state">
        <div class="empty-state__mark">商</div>
        <h3>正在加载商户列表</h3>
        <p>正在从云函数读取真实商户数据，请稍候。</p>
      </div>

      <EmptyState
        v-else-if="!merchantRows.length"
        title="暂无匹配商户"
        description="当前没有符合筛选条件的商户。新增商户能力将在后续版本接入。"
      >
        <ActionButton @click="loadMerchants">重新加载</ActionButton>
      </EmptyState>

      <template v-else>
        <MockTable
          :columns="['商户名称', 'merchant_id', '状态', '成员数', '负责人', '更新时间']"
          :rows="merchantRows"
        />

        <div class="card-actions">
          <StatusBadge
            :label="`当前选中：${selectedMerchant?.short_name || selectedMerchant?.name || '未命名商户'}`"
            tone="green"
          />
          <ActionButton @click="showPendingTip">编辑</ActionButton>
          <ActionButton @click="openStaff">成员 / 邀请</ActionButton>
          <ActionButton variant="danger" @click="showPendingTip">禁用 / 启用</ActionButton>
        </div>
      </template>
    </GlassCard>
  </section>
</template>
