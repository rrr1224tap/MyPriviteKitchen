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
  createMerchantInvite,
  disableMerchantInvite,
  fetchMerchantInvites,
  fetchMerchantStaff,
  type MerchantInviteItem,
  type MerchantInviteStatus,
  type MerchantStaffItem,
  type MerchantStaffRole,
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
const isCreateInviteOpen = ref(false)
const isCreatingInvite = ref(false)
const createInviteRole = ref<MerchantStaffRole>('staff')
const createInviteError = ref('')
const createInviteSuccess = ref('')
const latestInviteCode = ref('')
const isDisablingInviteCode = ref('')
const disableInviteError = ref('')
const disableInviteSuccess = ref('')

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

function showMemberPendingTip() {
  window.alert('成员启停将在后续版本接入')
}

function openCreateInvitePanel() {
  isCreateInviteOpen.value = true
  createInviteRole.value = 'staff'
  createInviteError.value = ''
  createInviteSuccess.value = ''
  latestInviteCode.value = ''
}

function closeCreateInvitePanel() {
  if (isCreatingInvite.value) return

  isCreateInviteOpen.value = false
  createInviteError.value = ''
  createInviteSuccess.value = ''
  latestInviteCode.value = ''
}

async function copyInviteCode(code: string) {
  if (!code || code === '-') return

  try {
    await navigator.clipboard.writeText(code)
    if (isCreateInviteOpen.value) {
      createInviteSuccess.value = '邀请码已复制'
    } else {
      window.alert('邀请码已复制')
    }
  } catch (error) {
    window.prompt('请手动复制邀请码', code)
  }
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

function canDisableInvite(item: MerchantInviteItem) {
  return item.status === 'unused'
}

function getErrorInfo(error: unknown, fallbackMessage: string) {
  const apiError = error as AdminApiError
  return {
    code: apiError.code || 'REQUEST_FAILED',
    message: apiError.message || fallbackMessage
  }
}

async function handleCreateInvite() {
  if (isCreatingInvite.value) return

  const roleText = createInviteRole.value === 'owner' ? '负责人' : '普通成员'
  const confirmed = window.confirm(`确认生成${roleText}邀请码？`)
  if (!confirmed) return

  isCreatingInvite.value = true
  createInviteError.value = ''
  createInviteSuccess.value = ''
  latestInviteCode.value = ''

  try {
    const invite = await createMerchantInvite(merchantId.value, createInviteRole.value)
    latestInviteCode.value = invite.code
    createInviteSuccess.value = `邀请码生成成功：${invite.code}，列表已刷新`
    await loadInvites()
  } catch (error) {
    const errorInfo = getErrorInfo(error, '邀请码生成失败，请稍后重试')
    createInviteError.value = errorInfo.message
  } finally {
    isCreatingInvite.value = false
  }
}

async function handleDisableInvite(item: MerchantInviteItem) {
  if (!canDisableInvite(item) || isDisablingInviteCode.value) return

  const confirmed = window.confirm('确认禁用这个邀请码吗？禁用后该邀请码将无法再被使用。')
  if (!confirmed) return

  isDisablingInviteCode.value = item.code
  disableInviteError.value = ''
  disableInviteSuccess.value = ''

  try {
    await disableMerchantInvite(merchantId.value, item.code)
    disableInviteSuccess.value = '邀请码已禁用，列表已刷新'
    await loadInvites()
  } catch (error) {
    disableInviteError.value = '邀请码禁用失败，请稍后重试'
  } finally {
    isDisablingInviteCode.value = ''
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
      :description="`当前商户：${merchantTitle}（merchant_id：${merchantId}）。成员列表、邀请码列表和禁用未使用邀请码已接入真实云函数，成员启停仍在后续版本接入。`"
    >
      <template #actions>
        <ActionButton variant="ghost" @click="loadPageData">刷新列表</ActionButton>
        <ActionButton variant="primary" @click="openCreateInvitePanel">生成邀请码</ActionButton>
      </template>
    </PageHeader>

    <section class="stat-grid">
      <StatCard title="成员数量" :value="isStaffLoading ? '...' : staffList.length" caption="来自 manageMerchantStaff.listStaff" icon="员" />
      <StatCard title="启用成员" :value="isStaffLoading ? '...' : activeCount" caption="可进入商家工作台" tone="green" icon="启" />
      <StatCard title="可用邀请码" :value="isInviteLoading ? '...' : availableInviteCount" caption="待使用邀请码" tone="orange" icon="邀" />
      <StatCard title="异常邀请" :value="isInviteLoading ? '...' : abnormalInviteCount" caption="已禁用或已过期" tone="muted" icon="醒" />
    </section>

    <GlassCard v-if="isCreateInviteOpen" class="invite-create-card">
      <div class="section-heading">
        <div>
          <h2>生成邀请码</h2>
          <p>选择成员角色后生成一次性邀请码。邀请码创建成功后会刷新列表，并显示新邀请码方便复制。</p>
        </div>
        <StatusBadge label="真实写入" tone="orange" />
      </div>

      <div class="invite-create-form">
        <label class="field-label">成员角色</label>
        <div class="role-segment">
          <button
            class="role-segment__button"
            :class="{ 'role-segment__button--active': createInviteRole === 'staff' }"
            type="button"
            :disabled="isCreatingInvite"
            @click="createInviteRole = 'staff'"
          >
            普通成员
          </button>
          <button
            class="role-segment__button"
            :class="{ 'role-segment__button--active': createInviteRole === 'owner' }"
            type="button"
            :disabled="isCreatingInvite"
            @click="createInviteRole = 'owner'"
          >
            负责人
          </button>
        </div>
        <p class="form-helper">邀请码默认 7 天有效。创建前会二次确认，本阶段只开放生成和禁用未使用邀请码，不开放重新启用或删除。</p>

        <div v-if="latestInviteCode" class="invite-code-card">
          <span>新邀请码</span>
          <strong>{{ latestInviteCode }}</strong>
          <button class="table-action-button" type="button" @click="copyInviteCode(latestInviteCode)">复制邀请码</button>
        </div>

        <div v-if="createInviteError" class="form-error">{{ createInviteError }}</div>
        <div v-if="createInviteSuccess" class="form-success">{{ createInviteSuccess }}</div>

        <div class="form-actions">
          <ActionButton variant="ghost" :disabled="isCreatingInvite" @click="closeCreateInvitePanel">收起</ActionButton>
          <ActionButton variant="primary" :disabled="isCreatingInvite" @click="handleCreateInvite">
            {{ isCreatingInvite ? '生成中...' : '确认生成' }}
          </ActionButton>
        </div>
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
              <button class="table-action-button" type="button" @click="showMemberPendingTip">启用 / 禁用</button>
            </div>
          </div>
        </div>
      </GlassCard>

      <GlassCard>
        <div class="section-heading">
          <div>
            <h2>邀请码列表</h2>
            <p>当前支持真实读取、创建、复制和禁用未使用邀请码；已使用、已禁用、已过期的邀请码不提供禁用操作。</p>
          </div>
          <StatusBadge label="真实数据" tone="green" />
        </div>

        <div v-if="disableInviteError" class="form-error">{{ disableInviteError }}</div>
        <div v-if="disableInviteSuccess" class="form-success">{{ disableInviteSuccess }}</div>

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
          description="当前商户还没有邀请码，可以点击右上角生成邀请码。"
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
              <button class="table-action-button" type="button" @click="copyInviteCode(item.code)">复制</button>
              <button
                v-if="canDisableInvite(item)"
                class="table-action-button table-action-button--danger"
                type="button"
                :disabled="Boolean(isDisablingInviteCode)"
                @click="handleDisableInvite(item)"
              >
                {{ isDisablingInviteCode === item.code ? '禁用中...' : '禁用邀请码' }}
              </button>
            </div>
          </div>
        </div>
      </GlassCard>
    </section>
  </section>
</template>
