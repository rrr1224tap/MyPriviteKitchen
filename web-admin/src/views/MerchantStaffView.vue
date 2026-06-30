<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import ActionButton from '../components/ActionButton.vue'
import EmptyState from '../components/EmptyState.vue'
import GlassCard from '../components/GlassCard.vue'
import MockTable from '../components/MockTable.vue'
import PageHeader from '../components/PageHeader.vue'
import StatCard from '../components/StatCard.vue'
import StatusBadge from '../components/StatusBadge.vue'
import { fetchMerchantStaff, type MerchantStaffItem, type MerchantStaffMerchant } from '../services/merchant-staff'
import type { AdminApiError } from '../types/api'

const route = useRoute()
const router = useRouter()

const staffList = ref<MerchantStaffItem[]>([])
const merchant = ref<MerchantStaffMerchant | null>(null)
const isLoading = ref(false)
const errorMessage = ref('')
const errorCode = ref('')

const merchantId = computed(() => {
  const value = route.params.merchantId
  return Array.isArray(value) ? value[0] || 'xiaochu' : String(value || 'xiaochu')
})

const activeCount = computed(() => staffList.value.filter((item) => item.status === 'active').length)
const disabledCount = computed(() => staffList.value.filter((item) => item.status === 'disabled').length)
const ownerCount = computed(() => staffList.value.filter((item) => item.role === 'owner').length)
const merchantTitle = computed(() => merchant.value?.name || merchantId.value)
const authErrorCodes = ['UNAUTHORIZED', 'TOKEN_EXPIRED', 'FORBIDDEN']
const isAuthError = computed(() => authErrorCodes.includes(errorCode.value))

const invites = [
  { 邀请码: 'XCHU-82K1', role: 'staff', status: '待接入', 过期时间: '-', 使用人: '-' },
  { 邀请码: 'XCHU-19QA', role: 'staff', status: '待接入', 过期时间: '-', 使用人: '-' }
]

function showPendingTip() {
  window.alert('该操作将在后续版本接入')
}

function goLogin() {
  router.push('/login')
}

function handleError(error: unknown) {
  const apiError = error as AdminApiError
  errorCode.value = apiError.code || 'REQUEST_FAILED'
  errorMessage.value = apiError.message || '成员列表加载失败，请稍后重试'
}

async function loadStaff() {
  isLoading.value = true
  errorMessage.value = ''
  errorCode.value = ''

  try {
    const result = await fetchMerchantStaff(merchantId.value)
    merchant.value = result.merchant
    staffList.value = result.list
  } catch (error) {
    staffList.value = []
    handleError(error)
  } finally {
    isLoading.value = false
  }
}

onMounted(loadStaff)
watch(merchantId, () => {
  loadStaff()
})
</script>

<template>
  <section class="page-stack">
    <PageHeader
      eyebrow="Staff & Invites"
      title="成员与邀请"
      :description="`当前商户：${merchantTitle}（merchant_id：${merchantId}）。成员列表已接入真实云函数，邀请码能力仍保持静态占位。`"
    >
      <template #actions>
        <ActionButton variant="ghost" @click="loadStaff">刷新成员</ActionButton>
        <ActionButton variant="primary" @click="showPendingTip">生成邀请码</ActionButton>
      </template>
    </PageHeader>

    <section class="stat-grid">
      <StatCard title="成员数量" :value="isLoading ? '...' : staffList.length" caption="来自 manageMerchantStaff.listStaff" icon="员" />
      <StatCard title="启用成员" :value="isLoading ? '...' : activeCount" caption="可进入商家工作台" tone="green" icon="启" />
      <StatCard title="禁用成员" :value="isLoading ? '...' : disabledCount" caption="暂不可参与管理" tone="muted" icon="停" />
      <StatCard title="负责人" :value="isLoading ? '...' : ownerCount" caption="owner 角色成员" tone="orange" icon="责" />
    </section>

    <GlassCard v-if="errorMessage">
      <div class="section-heading">
        <div>
          <h2>成员列表加载失败</h2>
          <p>{{ errorMessage }}</p>
        </div>
        <StatusBadge label="需要处理" tone="danger" />
      </div>
      <div class="card-actions">
        <ActionButton variant="primary" @click="loadStaff">重新加载</ActionButton>
        <ActionButton v-if="isAuthError" variant="ghost" @click="goLogin">返回登录页</ActionButton>
      </div>
    </GlassCard>

    <section class="content-grid">
      <GlassCard>
        <div class="section-heading">
          <div>
            <h2>成员列表</h2>
            <p>当前只开放真实读取，成员启用 / 禁用会在后续版本接入。</p>
          </div>
          <StatusBadge label="真实数据" tone="green" />
        </div>

        <EmptyState v-if="isLoading" title="正在加载成员" description="正在从云函数读取当前商户成员列表。" />
        <EmptyState
          v-else-if="!staffList.length"
          title="暂无成员"
          description="当前商户还没有成员记录，可以先在小程序端或后续 Web 版本中添加。"
        />

        <div v-else class="mock-table staff-table">
          <div class="mock-table__head staff-table__row">
            <span>角色</span>
            <span>状态</span>
            <span>openid</span>
            <span>昵称</span>
            <span>备注</span>
            <span>加入时间</span>
            <span>操作</span>
          </div>
          <div v-for="item in staffList" :key="item.id" class="mock-table__row staff-table__row">
            <span>{{ item.role_text }}</span>
            <StatusBadge :label="item.status_text" :tone="item.status === 'active' ? 'green' : 'muted'" />
            <span>{{ item.masked_openid }}</span>
            <span>{{ item.nickname }}</span>
            <span>{{ item.remark }}</span>
            <span>{{ item.created_at }}</span>
            <div class="table-action-group">
              <button class="table-action-button" type="button" @click="showPendingTip">启用 / 禁用</button>
            </div>
          </div>
        </div>
      </GlassCard>

      <GlassCard>
        <div class="section-heading">
          <div>
            <h2>邀请码列表</h2>
            <p>邀请码真实读取、生成和禁用将在后续版本接入，本阶段不写入邀请数据。</p>
          </div>
          <StatusBadge label="待接入" tone="orange" />
        </div>
        <MockTable :columns="['邀请码', 'role', 'status', '过期时间', '使用人']" :rows="invites" />
        <div class="card-actions">
          <ActionButton @click="showPendingTip">复制邀请码</ActionButton>
          <ActionButton variant="danger" @click="showPendingTip">禁用邀请码</ActionButton>
        </div>
      </GlassCard>
    </section>
  </section>
</template>
