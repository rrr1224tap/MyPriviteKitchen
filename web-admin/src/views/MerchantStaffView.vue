<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import ActionButton from '../components/ActionButton.vue'
import EmptyState from '../components/EmptyState.vue'
import GlassCard from '../components/GlassCard.vue'
import PageHeader from '../components/PageHeader.vue'
import StatCard from '../components/StatCard.vue'
import StatusBadge from '../components/StatusBadge.vue'
import {
  fetchMerchantInvites,
  fetchMerchantStaff,
  type MerchantInviteItem,
  type MerchantInviteStatus,
  type MerchantStaffItem,
  type MerchantStaffMerchant
} from '../services/merchant-staff'
import type { AdminApiError } from '../types/api'

const route = useRoute()
const router = useRouter()

const staffList = ref<MerchantStaffItem[]>([])
const inviteList = ref<MerchantInviteItem[]>([])
const merchant = ref<MerchantStaffMerchant | null>(null)
const isStaffLoading = ref(false)
const isInviteLoading = ref(false)
const staffErrorMessage = ref('')
const staffErrorCode = ref('')
const inviteErrorMessage = ref('')
const inviteErrorCode = ref('')

const merchantId = computed(() => {
  const value = route.params.merchantId
  return Array.isArray(value) ? value[0] || 'xiaochu' : String(value || 'xiaochu')
})

const activeCount = computed(() => staffList.value.filter((item) => item.status === 'active').length)
const availableInviteCount = computed(() => inviteList.value.filter((item) => item.status === 'unused').length)
const abnormalInviteCount = computed(() =>
  inviteList.value.filter((item) => item.status === 'disabled' || item.status === 'expired').length
)
const merchantTitle = computed(() => merchant.value?.name || merchantId.value)
const authErrorCodes = ['UNAUTHORIZED', 'TOKEN_EXPIRED', 'FORBIDDEN']
const isStaffAuthError = computed(() => authErrorCodes.includes(staffErrorCode.value))
const isInviteAuthError = computed(() => authErrorCodes.includes(inviteErrorCode.value))

function showPendingTip() {
  window.alert('该操作将在后续版本接入')
}

function goLogin() {
  router.push('/login')
}

function inviteTone(status: MerchantInviteStatus) {
  const toneMap: Record<MerchantInviteStatus, 'green' | 'orange' | 'muted' | 'danger'> = {
    unused: 'green',
    used: 'muted',
    disabled: 'danger',
    expired: 'orange'
  }

  return toneMap[status]
}

function getErrorInfo(error: unknown, fallbackMessage: string) {
  const apiError = error as AdminApiError
  return {
    code: apiError.code || 'REQUEST_FAILED',
    message: apiError.message || fallbackMessage
  }
}

async function loadStaff() {
  isStaffLoading.value = true
  staffErrorMessage.value = ''
  staffErrorCode.value = ''

  try {
    const result = await fetchMerchantStaff(merchantId.value)
    merchant.value = result.merchant
    staffList.value = result.list
  } catch (error) {
    staffList.value = []
    const errorInfo = getErrorInfo(error, '成员列表加载失败，请稍后重试')
    staffErrorCode.value = errorInfo.code
    staffErrorMessage.value = errorInfo.message
  } finally {
    isStaffLoading.value = false
  }
}

async function loadInvites() {
  isInviteLoading.value = true
  inviteErrorMessage.value = ''
  inviteErrorCode.value = ''

  try {
    const result = await fetchMerchantInvites(merchantId.value)
    merchant.value = merchant.value || result.merchant
    inviteList.value = result.list
  } catch (error) {
    inviteList.value = []
    const errorInfo = getErrorInfo(error, '邀请码列表加载失败，请稍后重试')
    inviteErrorCode.value = errorInfo.code
    inviteErrorMessage.value = errorInfo.message
  } finally {
    isInviteLoading.value = false
  }
}

function loadPageData() {
  loadStaff()
  loadInvites()
}

onMounted(loadPageData)
watch(merchantId, () => {
  loadPageData()
})
</script>

<template>
  <section class="page-stack">
    <PageHeader
      eyebrow="Staff & Invites"
      title="成员与邀请"
      :description="`当前商户：${merchantTitle}（merchant_id：${merchantId}）。成员列表和邀请码列表已接入真实云函数，本阶段不执行写操作。`"
    >
      <template #actions>
        <ActionButton variant="ghost" @click="loadPageData">刷新列表</ActionButton>
        <ActionButton variant="primary" @click="showPendingTip">生成邀请码</ActionButton>
      </template>
    </PageHeader>

    <section class="stat-grid">
      <StatCard title="成员数量" :value="isStaffLoading ? '...' : staffList.length" caption="来自 manageMerchantStaff.listStaff" icon="员" />
      <StatCard title="启用成员" :value="isStaffLoading ? '...' : activeCount" caption="可进入商家工作台" tone="green" icon="启" />
      <StatCard title="可用邀请码" :value="isInviteLoading ? '...' : availableInviteCount" caption="待使用邀请码" tone="orange" icon="邀" />
      <StatCard title="异常邀请" :value="isInviteLoading ? '...' : abnormalInviteCount" caption="已禁用或已过期" tone="muted" icon="醒" />
    </section>

    <section class="content-grid">
      <GlassCard>
        <div class="section-heading">
          <div>
            <h2>成员列表</h2>
            <p>当前只开放真实读取，成员启用 / 禁用会在后续版本接入。</p>
          </div>
          <StatusBadge label="真实数据" tone="green" />
        </div>

        <div v-if="staffErrorMessage" class="inline-error">
          <div>
            <strong>成员列表加载失败</strong>
            <span>{{ staffErrorMessage }}</span>
          </div>
          <div class="table-action-group">
            <button class="table-action-button" type="button" @click="loadStaff">重试</button>
            <button v-if="isStaffAuthError" class="table-action-button" type="button" @click="goLogin">返回登录</button>
          </div>
        </div>

        <EmptyState v-else-if="isStaffLoading" title="正在加载成员" description="正在从云函数读取当前商户成员列表。" />
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
            <p>当前只开放真实读取，创建、复制和禁用仍在后续版本接入。</p>
          </div>
          <StatusBadge label="真实数据" tone="green" />
        </div>

        <div v-if="inviteErrorMessage" class="inline-error">
          <div>
            <strong>邀请码列表加载失败</strong>
            <span>{{ inviteErrorMessage }}</span>
          </div>
          <div class="table-action-group">
            <button class="table-action-button" type="button" @click="loadInvites">重试</button>
            <button v-if="isInviteAuthError" class="table-action-button" type="button" @click="goLogin">返回登录</button>
          </div>
        </div>

        <EmptyState v-else-if="isInviteLoading" title="正在加载邀请码" description="正在从云函数读取当前商户邀请码列表。" />
        <EmptyState
          v-else-if="!inviteList.length"
          title="暂无邀请码"
          description="当前商户还没有邀请码，创建能力会在后续版本接入。"
        />

        <div v-else class="mock-table invite-table">
          <div class="mock-table__head invite-table__row">
            <span>邀请码</span>
            <span>角色</span>
            <span>状态</span>
            <span>过期时间</span>
            <span>使用人</span>
            <span>创建时间</span>
            <span>操作</span>
          </div>
          <div v-for="item in inviteList" :key="item.id" class="mock-table__row invite-table__row">
            <strong>{{ item.code }}</strong>
            <span>{{ item.role_text }}</span>
            <StatusBadge :label="item.status_text" :tone="inviteTone(item.status)" />
            <span>{{ item.expires_at }}</span>
            <span>{{ item.masked_used_by_openid }}</span>
            <span>{{ item.created_at }}</span>
            <div class="table-action-group">
              <button class="table-action-button" type="button" @click="showPendingTip">复制</button>
              <button class="table-action-button table-action-button--danger" type="button" @click="showPendingTip">禁用</button>
            </div>
          </div>
        </div>
      </GlassCard>
    </section>
  </section>
</template>
