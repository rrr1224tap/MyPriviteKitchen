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
  createCategory,
  fetchCategories,
  updateCategory,
  type CategoryListItem,
  type CategoryStatus,
  type EditableCategoryStatus
} from '../services/categories'
import { clearSession, getSession } from '../stores/session'
import type { AdminApiError } from '../types/api'

const MERCHANT_CONTEXT_KEY = 'xiaochu_current_merchant_id'
const FALLBACK_MERCHANT_ID = 'xiaochu'

interface CategoryFormState {
  name: string
  sort_order: string
  status: EditableCategoryStatus
}

const router = useRouter()
const session = computed(() => getSession())
const isMerchantAdmin = computed(() => session.value?.role === 'merchant_admin')
const categories = ref<CategoryListItem[]>([])
const isLoading = ref(false)
const errorMessage = ref('')
const errorCode = ref('')
const merchantId = ref(getInitialMerchantId())

const isFormOpen = ref(false)
const formMode = ref<'create' | 'edit'>('create')
const editingCategoryId = ref('')
const form = ref<CategoryFormState>({
  name: '',
  sort_order: '0',
  status: 'active'
})
const isSubmitting = ref(false)
const formErrorMessage = ref('')
const formSuccessMessage = ref('')

const activeCount = computed(() => categories.value.filter((item) => item.status === 'active').length)
const inactiveCount = computed(() =>
  categories.value.filter((item) => item.status === 'inactive' || item.status === 'disabled').length
)
const isAuthError = computed(() => ['UNAUTHORIZED', 'TOKEN_EXPIRED', 'FORBIDDEN'].includes(errorCode.value))
const formTitle = computed(() => formMode.value === 'create' ? '新增分类' : '编辑分类')
const pageDescription = computed(() => {
  if (isMerchantAdmin.value) {
    return `当前商户：${merchantId.value || '未识别'}。分类列表、新增分类和编辑分类已绑定登录商户，不支持切换商户。`
  }

  return `当前商户：${merchantId.value}。分类列表、新增分类和编辑分类已接入真实云函数；删除和排序暂不执行真实写入。`
})
const submitLabel = computed(() => {
  if (isSubmitting.value) {
    return formMode.value === 'create' ? '正在新增...' : '正在更新...'
  }

  return formMode.value === 'create' ? '新增分类' : '保存修改'
})

function getStoredMerchantId() {
  if (typeof window === 'undefined') {
    return ''
  }

  return window.localStorage.getItem(MERCHANT_CONTEXT_KEY) || ''
}

function getInitialMerchantId() {
  if (session.value?.role === 'merchant_admin') {
    return session.value?.merchant_id || ''
  }

  return getStoredMerchantId() || FALLBACK_MERCHANT_ID
}

function showPendingTip() {
  window.alert('删除分类和分类排序会在后续版本接入，本阶段只开放新增和编辑分类。')
}

function categoryTone(status: CategoryStatus) {
  if (status === 'active') {
    return 'green'
  }

  if (status === 'deleted') {
    return 'danger'
  }

  return 'muted'
}

function toEditableStatus(status: CategoryStatus): EditableCategoryStatus {
  return status === 'active' ? 'active' : 'disabled'
}

function resetForm() {
  form.value = {
    name: '',
    sort_order: '0',
    status: 'active'
  }
  editingCategoryId.value = ''
  formErrorMessage.value = ''
}

function openCreateForm() {
  formMode.value = 'create'
  resetForm()
  formSuccessMessage.value = ''
  isFormOpen.value = true
}

function openEditForm(item: CategoryListItem) {
  formMode.value = 'edit'
  editingCategoryId.value = item.category_id
  form.value = {
    name: item.name,
    sort_order: String(item.sort_order),
    status: toEditableStatus(item.status)
  }
  formErrorMessage.value = ''
  formSuccessMessage.value = ''
  isFormOpen.value = true
}

function closeForm() {
  if (isSubmitting.value) return

  isFormOpen.value = false
  resetForm()
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

function validateForm() {
  const name = form.value.name.trim()
  if (!name) {
    return {
      error: '分类名称不能为空'
    }
  }

  const sortOrder = Number(form.value.sort_order)
  if (!Number.isInteger(sortOrder) || sortOrder < 0) {
    return {
      error: '排序值必须是非负整数'
    }
  }

  return {
    payload: {
      name,
      sort_order: sortOrder,
      status: form.value.status
    }
  }
}

async function submitCategoryForm() {
  if (isSubmitting.value) return

  formErrorMessage.value = ''
  formSuccessMessage.value = ''
  const validation = validateForm()
  if (validation.error || !validation.payload) {
    formErrorMessage.value = validation.error || '请检查分类表单'
    return
  }

  isSubmitting.value = true
  try {
    if (formMode.value === 'create') {
      await createCategory(merchantId.value, validation.payload)
      formSuccessMessage.value = '分类已新增，列表已刷新'
      resetForm()
    } else {
      await updateCategory(merchantId.value, editingCategoryId.value, validation.payload)
      formSuccessMessage.value = '分类已更新，列表已刷新'
    }
    await loadCategories()
  } catch (error) {
    const apiError = error as Partial<AdminApiError>
    formErrorMessage.value = formMode.value === 'create'
      ? apiError.message || '分类新增失败，请稍后重试'
      : apiError.message || '分类更新失败，请稍后重试'
  } finally {
    isSubmitting.value = false
  }
}

async function loadCategories() {
  if (!merchantId.value) {
    categories.value = []
    errorCode.value = 'TOKEN_INVALID'
    errorMessage.value = '登录状态异常，请重新登录后再管理分类。'
    if (isMerchantAdmin.value) {
      clearSession()
      router.push('/login')
    }
    return
  }

  isLoading.value = true
  errorMessage.value = ''
  errorCode.value = ''

  try {
    const result = await fetchCategories(merchantId.value)
    categories.value = result.list
  } catch (error) {
    categories.value = []
    const apiError = error as Partial<AdminApiError>
    errorCode.value = apiError.code || 'REQUEST_FAILED'
    errorMessage.value = apiError.message || '分类列表加载失败，请稍后重试'
  } finally {
    isLoading.value = false
  }
}

onMounted(loadCategories)
</script>

<template>
  <section class="page-stack">
    <PageHeader
      eyebrow="Categories"
      title="分类管理"
      :description="pageDescription"
    >
      <template #actions>
        <ActionButton variant="ghost" :disabled="isLoading" @click="loadCategories">刷新列表</ActionButton>
        <ActionButton variant="primary" @click="openCreateForm">新增分类</ActionButton>
      </template>
    </PageHeader>

    <section class="stat-grid">
      <StatCard title="分类总数" :value="isLoading ? '...' : categories.length" caption="来自 manageCategory.listCategories" icon="类" />
      <StatCard title="启用分类" :value="isLoading ? '...' : activeCount" caption="点餐页可展示" tone="green" icon="启" />
      <StatCard title="停用分类" :value="isLoading ? '...' : inactiveCount" caption="暂不展示" tone="muted" icon="停" />
      <StatCard title="真实写入" value="2 项" caption="仅新增和编辑分类" tone="orange" icon="写" />
    </section>

    <GlassCard v-if="isFormOpen">
      <div class="section-heading">
        <div>
          <h2>{{ formTitle }}</h2>
          <p>只会写入分类名称、排序值和状态。商户 ID、分类 ID 和时间字段由后端控制。</p>
        </div>
        <ActionButton variant="ghost" :disabled="isSubmitting" @click="closeForm">收起</ActionButton>
      </div>

      <form class="admin-form" @submit.prevent="submitCategoryForm">
        <label class="form-field">
          <span>分类名称 <b>*</b></span>
          <input
            v-model="form.name"
            autocomplete="off"
            placeholder="例如 热菜"
            :disabled="isSubmitting"
          />
        </label>

        <label class="form-field">
          <span>排序值 <b>*</b></span>
          <input
            v-model="form.sort_order"
            inputmode="numeric"
            autocomplete="off"
            placeholder="例如 10"
            :disabled="isSubmitting"
          />
        </label>

        <label class="form-field">
          <span>状态</span>
          <select v-model="form.status" :disabled="isSubmitting">
            <option value="active">启用</option>
            <option value="disabled">停用</option>
          </select>
        </label>

        <p v-if="formErrorMessage" class="form-error">{{ formErrorMessage }}</p>
        <p v-if="formSuccessMessage" class="form-success">{{ formSuccessMessage }}</p>

        <div class="form-actions">
          <button class="ghost-button" type="button" :disabled="isSubmitting" @click="closeForm">取消</button>
          <button class="primary-button" type="submit" :disabled="isSubmitting">{{ submitLabel }}</button>
        </div>
      </form>
    </GlassCard>

    <GlassCard>
      <div class="section-heading">
        <div>
          <h2>分类列表</h2>
          <p>按分类排序值升序展示真实数据；已删除分类由云函数过滤，不在列表中展示。</p>
        </div>
        <StatusBadge label="真实数据" tone="green" />
      </div>

      <div v-if="errorMessage" class="inline-error">
        <div>
          <strong>分类列表加载失败</strong>
          <span>{{ errorMessage }}</span>
        </div>
        <div class="table-action-group">
          <button class="table-action-button" type="button" @click="loadCategories">重试</button>
        </div>
      </div>

      <EmptyState
        v-else-if="isLoading"
        title="正在加载分类"
        description="正在从云函数读取当前商户的真实分类列表。"
      />

      <EmptyState
        v-else-if="!categories.length"
        title="暂无分类"
        description="当前商户还没有可展示分类。可以点击新增分类创建第一条分类。"
      >
        <ActionButton v-if="!isAuthError" variant="ghost" @click="openCreateForm">新增分类</ActionButton>
      </EmptyState>

      <div v-else class="mock-table category-table">
        <div class="mock-table__head mock-table__row category-table__row">
          <span>分类名称</span>
          <span>状态</span>
          <span>排序</span>
          <span>category_id</span>
          <span>更新时间</span>
          <span>操作</span>
        </div>

        <div v-for="item in categories" :key="item.id" class="mock-table__row category-table__row">
          <span>{{ item.name || '-' }}</span>
          <StatusBadge :label="item.status_text" :tone="categoryTone(item.status)" />
          <span>{{ item.sort_order }}</span>
          <span>{{ item.category_id }}</span>
          <span>{{ formatDate(item.updated_at) }}</span>
          <div class="table-action-group">
            <button class="table-action-button" type="button" @click="openEditForm(item)">编辑</button>
            <button v-if="!isMerchantAdmin" class="table-action-button" type="button" @click="showPendingTip">排序</button>
            <button v-if="!isMerchantAdmin" class="table-action-button table-action-button--danger" type="button" @click="showPendingTip">删除</button>
          </div>
        </div>
      </div>
    </GlassCard>
  </section>
</template>
