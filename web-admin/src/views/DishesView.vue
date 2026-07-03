<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import ActionButton from '../components/ActionButton.vue'
import EmptyState from '../components/EmptyState.vue'
import GlassCard from '../components/GlassCard.vue'
import PageHeader from '../components/PageHeader.vue'
import StatCard from '../components/StatCard.vue'
import StatusBadge from '../components/StatusBadge.vue'
import { fetchCategories, type CategoryListItem } from '../services/categories'
import {
  createDish,
  fetchDishes,
  updateDish,
  updateDishStatus,
  type DishListItem,
  type DishStatus
} from '../services/dishes'
import type { AdminApiError } from '../types/api'

const route = useRoute()
const MERCHANT_CONTEXT_KEY = 'xiaochu_current_merchant_id'
const FALLBACK_MERCHANT_ID = 'xiaochu'

const dishes = ref<DishListItem[]>([])
const categories = ref<CategoryListItem[]>([])
const isLoading = ref(false)
const isCategoryLoading = ref(false)
const errorMessage = ref('')
const errorCode = ref('')
const categoryErrorMessage = ref('')

const isCreateFormOpen = ref(false)
const isCreating = ref(false)
const createErrorMessage = ref('')
const createSuccessMessage = ref('')
const createForm = ref({
  name: '',
  category_id: '',
  price: '',
  description: '',
  image_url: ''
})
const isEditFormOpen = ref(false)
const isUpdating = ref(false)
const editErrorMessage = ref('')
const editSuccessMessage = ref('')
const editingDish = ref<DishListItem | null>(null)
const editForm = ref({
  name: '',
  category_id: '',
  price: '',
  description: '',
  image_url: ''
})
const statusActionDishId = ref('')
const statusSuccessMessage = ref('')
const statusErrorMessage = ref('')

function getRouteMerchantId() {
  const value = route.params.merchantId
  return Array.isArray(value) ? value[0] || '' : String(value || '')
}

function getStoredMerchantId() {
  if (typeof window === 'undefined') {
    return ''
  }

  return window.localStorage.getItem(MERCHANT_CONTEXT_KEY) || ''
}

function rememberMerchantId(value: string) {
  if (value && typeof window !== 'undefined') {
    window.localStorage.setItem(MERCHANT_CONTEXT_KEY, value)
  }
}

const merchantId = computed(() => getRouteMerchantId() || getStoredMerchantId() || FALLBACK_MERCHANT_ID)

const onSaleCount = computed(() => dishes.value.filter((item) => item.status === 'on_sale').length)
const offSaleCount = computed(() => dishes.value.filter((item) => item.status === 'off_sale').length)
const missingIngredientCount = computed(() => dishes.value.filter((item) => item.ingredients.length === 0).length)
const activeCategories = computed(() => categories.value.filter((item) => item.status === 'active'))

function getDishTone(status: DishStatus) {
  if (status === 'on_sale') {
    return 'green'
  }

  if (status === 'sold_out') {
    return 'orange'
  }

  return 'muted'
}

function showPendingTip() {
  window.alert('删除、做法参考和食材配置会在后续版本接入，本阶段不执行真实删除。')
}

function formatPriceInput(priceCent: number) {
  const yuan = priceCent / 100
  return Number.isInteger(yuan) ? String(yuan) : String(Number(yuan.toFixed(2)))
}

function resetCreateForm() {
  createForm.value = {
    name: '',
    category_id: activeCategories.value[0]?.category_id || '',
    price: '',
    description: '',
    image_url: ''
  }
  createErrorMessage.value = ''
}

async function openCreateForm() {
  createSuccessMessage.value = ''
  if (!categories.value.length) {
    await loadCategories()
  }
  resetCreateForm()
  isCreateFormOpen.value = true
}

function closeCreateForm() {
  if (isCreating.value) return

  isCreateFormOpen.value = false
  resetCreateForm()
}

function resetEditForm() {
  editForm.value = {
    name: '',
    category_id: '',
    price: '',
    description: '',
    image_url: ''
  }
  editErrorMessage.value = ''
  editingDish.value = null
}

async function openEditForm(item: DishListItem) {
  editSuccessMessage.value = ''
  if (!categories.value.length) {
    await loadCategories()
  }
  editingDish.value = item
  editForm.value = {
    name: item.name,
    category_id: item.category_id,
    price: formatPriceInput(item.price_cent),
    description: item.description || '',
    image_url: item.image_url || ''
  }
  editErrorMessage.value = ''
  isEditFormOpen.value = true
}

function closeEditForm() {
  if (isUpdating.value) return

  isEditFormOpen.value = false
  resetEditForm()
}

function validateCreateForm() {
  const name = createForm.value.name.trim()
  if (!name) {
    return {
      error: '餐品名称不能为空'
    }
  }

  if (!createForm.value.category_id) {
    return {
      error: '请选择所属分类'
    }
  }

  if (!createForm.value.price.trim()) {
    return {
      error: '价格不能为空'
    }
  }

  const price = Number(createForm.value.price)
  if (!Number.isFinite(price) || price < 0) {
    return {
      error: '价格必须是大于等于 0 的数字'
    }
  }

  return {
    payload: {
      name,
      category_id: createForm.value.category_id,
      price,
      description: createForm.value.description.trim(),
      image_url: createForm.value.image_url.trim()
    }
  }
}

function validateEditForm() {
  const name = editForm.value.name.trim()
  if (!name) {
    return {
      error: '餐品名称不能为空'
    }
  }

  if (!editForm.value.category_id) {
    return {
      error: '请选择所属分类'
    }
  }

  if (!editForm.value.price.trim()) {
    return {
      error: '价格不能为空'
    }
  }

  const price = Number(editForm.value.price)
  if (!Number.isFinite(price) || price < 0) {
    return {
      error: '价格必须是大于等于 0 的数字'
    }
  }

  return {
    payload: {
      name,
      category_id: editForm.value.category_id,
      price,
      description: editForm.value.description.trim(),
      image_url: editForm.value.image_url.trim()
    }
  }
}

async function submitCreateDish() {
  if (isCreating.value) return

  createErrorMessage.value = ''
  createSuccessMessage.value = ''
  const validation = validateCreateForm()
  if (validation.error || !validation.payload) {
    createErrorMessage.value = validation.error || '请检查餐品表单'
    return
  }

  isCreating.value = true
  try {
    await createDish(merchantId.value, validation.payload)
    await loadDishes()
    createSuccessMessage.value = '餐品已新增，列表已刷新'
    isCreateFormOpen.value = false
    resetCreateForm()
  } catch (error) {
    const adminError = error as Partial<AdminApiError>
    createErrorMessage.value = adminError.message || '餐品新增失败，请稍后重试'
  } finally {
    isCreating.value = false
  }
}

async function submitUpdateDish() {
  if (isUpdating.value || !editingDish.value) return

  editErrorMessage.value = ''
  editSuccessMessage.value = ''
  const validation = validateEditForm()
  if (validation.error || !validation.payload) {
    editErrorMessage.value = validation.error || '请检查餐品表单'
    return
  }

  isUpdating.value = true
  try {
    await updateDish(merchantId.value, editingDish.value.dish_id, validation.payload)
    await loadDishes()
    editSuccessMessage.value = '餐品已更新，列表已刷新'
    isEditFormOpen.value = false
    resetEditForm()
  } catch (error) {
    const adminError = error as Partial<AdminApiError>
    editErrorMessage.value = adminError.message || '餐品编辑失败，请稍后重试'
  } finally {
    isUpdating.value = false
  }
}

function getStatusActionLabel(item: DishListItem) {
  return item.status === 'on_sale' ? '下架' : '上架'
}

function getStatusActionLoadingLabel(item: DishListItem) {
  return item.status === 'on_sale' ? '下架中...' : '上架中...'
}

async function toggleDishStatus(item: DishListItem) {
  if (statusActionDishId.value) return

  const isOnSale = item.status === 'on_sale'
  const nextStatus = isOnSale ? 'off_sale' : 'on_sale'
  const confirmMessage = isOnSale
    ? '确认下架该餐品吗？下架后用户端将不再展示或不可点选，具体以小程序现有逻辑为准。'
    : '确认上架该餐品吗？'

  if (!window.confirm(confirmMessage)) {
    return
  }

  statusActionDishId.value = item.dish_id
  statusSuccessMessage.value = ''
  statusErrorMessage.value = ''
  try {
    await updateDishStatus(merchantId.value, item.dish_id, nextStatus)
    await loadDishes()
    statusSuccessMessage.value = nextStatus === 'on_sale'
      ? '餐品已上架，列表已刷新'
      : '餐品已下架，列表已刷新'
  } catch (error) {
    const adminError = error as Partial<AdminApiError>
    statusErrorMessage.value = adminError.message || '餐品状态更新失败，请稍后重试'
  } finally {
    statusActionDishId.value = ''
  }
}

async function loadDishes() {
  isLoading.value = true
  errorMessage.value = ''
  errorCode.value = ''

  try {
    rememberMerchantId(merchantId.value)
    const result = await fetchDishes(merchantId.value)
    dishes.value = result.list
  } catch (error) {
    dishes.value = []
    const adminError = error as Partial<AdminApiError>
    errorCode.value = adminError.code || 'UNKNOWN_ERROR'
    errorMessage.value = adminError.message || '餐品列表读取失败，请稍后重试'
  } finally {
    isLoading.value = false
  }
}

async function loadCategories() {
  isCategoryLoading.value = true
  categoryErrorMessage.value = ''

  try {
    const result = await fetchCategories(merchantId.value)
    categories.value = result.list
    if (!createForm.value.category_id) {
      createForm.value.category_id = activeCategories.value[0]?.category_id || ''
    }
  } catch (error) {
    categories.value = []
    const adminError = error as Partial<AdminApiError>
    categoryErrorMessage.value = adminError.message || '分类列表读取失败，请稍后重试'
  } finally {
    isCategoryLoading.value = false
  }
}

function loadPageData() {
  loadDishes()
  loadCategories()
}

onMounted(loadPageData)
watch(merchantId, loadPageData)
</script>

<template>
  <section class="page-stack">
    <PageHeader
      eyebrow="Dishes"
      title="餐品管理"
      :description="`当前商户：${merchantId}。餐品列表、新增、编辑和上下架已接入真实云函数；删除、做法参考和食材配置仍为后续接入。`"
    >
      <template #actions>
        <ActionButton variant="ghost" :disabled="isLoading" @click="loadPageData">刷新</ActionButton>
        <ActionButton variant="primary" @click="openCreateForm">新增餐品</ActionButton>
      </template>
    </PageHeader>

    <section class="stat-grid">
      <StatCard title="餐品总数" :value="dishes.length" caption="当前真实餐品数量" icon="餐" />
      <StatCard title="上架餐品" :value="onSaleCount" caption="用户端可见" tone="green" icon="售" />
      <StatCard title="已下架" :value="offSaleCount" caption="暂不对用户展示" tone="orange" icon="下" />
      <StatCard title="缺食材配置" :value="missingIngredientCount" caption="需要后续补齐" tone="muted" icon="材" />
    </section>

    <GlassCard v-if="createSuccessMessage">
      <div class="section-heading compact-section-heading">
        <div>
          <h2>餐品已新增</h2>
          <p>{{ createSuccessMessage }}</p>
        </div>
      </div>
    </GlassCard>

    <GlassCard v-if="editSuccessMessage">
      <div class="section-heading compact-section-heading">
        <div>
          <h2>餐品已更新</h2>
          <p>{{ editSuccessMessage }}</p>
        </div>
      </div>
    </GlassCard>

    <GlassCard v-if="statusSuccessMessage">
      <div class="section-heading compact-section-heading">
        <div>
          <h2>餐品状态已更新</h2>
          <p>{{ statusSuccessMessage }}</p>
        </div>
      </div>
    </GlassCard>

    <GlassCard v-if="statusErrorMessage">
      <div class="inline-error">
        <div>
          <strong>餐品状态更新失败</strong>
          <span>{{ statusErrorMessage }}</span>
        </div>
      </div>
    </GlassCard>

    <GlassCard v-if="isCreateFormOpen">
      <div class="section-heading">
        <div>
          <h2>新增餐品基础信息</h2>
          <p>本阶段只保存餐品名称、所属分类、价格、描述和图片地址。</p>
        </div>
        <ActionButton variant="ghost" :disabled="isCreating" @click="closeCreateForm">收起</ActionButton>
      </div>

      <form class="admin-form" @submit.prevent="submitCreateDish">
        <label class="form-field">
          <span>餐品名称 <b>*</b></span>
          <input
            v-model="createForm.name"
            autocomplete="off"
            placeholder="例如 番茄炒蛋"
            :disabled="isCreating"
          />
        </label>

        <label class="form-field">
          <span>所属分类 <b>*</b></span>
          <select v-model="createForm.category_id" :disabled="isCreating || isCategoryLoading">
            <option value="">请选择分类</option>
            <option v-for="item in activeCategories" :key="item.category_id" :value="item.category_id">
              {{ item.name || item.category_id }}
            </option>
          </select>
        </label>

        <label class="form-field">
          <span>价格 <b>*</b></span>
          <input
            v-model="createForm.price"
            inputmode="decimal"
            autocomplete="off"
            placeholder="例如 18"
            :disabled="isCreating"
          />
        </label>

        <label class="form-field">
          <span>图片地址</span>
          <input
            v-model="createForm.image_url"
            autocomplete="off"
            placeholder="https://example.com/dish.jpg"
            :disabled="isCreating"
          />
        </label>

        <label class="form-field form-field--wide">
          <span>描述</span>
          <textarea
            v-model="createForm.description"
            rows="3"
            placeholder="例如 家常下饭菜"
            :disabled="isCreating"
          />
        </label>

        <p v-if="categoryErrorMessage" class="form-error">{{ categoryErrorMessage }}</p>
        <p v-if="createErrorMessage" class="form-error">{{ createErrorMessage }}</p>

        <div class="form-actions">
          <button class="ghost-button" type="button" :disabled="isCreating" @click="closeCreateForm">取消</button>
          <button class="primary-button" type="submit" :disabled="isCreating || isCategoryLoading">
            {{ isCreating ? '正在新增...' : '新增餐品' }}
          </button>
        </div>
      </form>
    </GlassCard>

    <GlassCard v-if="isEditFormOpen">
      <div class="section-heading">
        <div>
          <h2>编辑餐品基础信息</h2>
          <p>只更新餐品名称、所属分类、价格、描述和图片地址。</p>
        </div>
        <ActionButton variant="ghost" :disabled="isUpdating" @click="closeEditForm">收起</ActionButton>
      </div>

      <form class="admin-form" @submit.prevent="submitUpdateDish">
        <label class="form-field">
          <span>餐品名称 <b>*</b></span>
          <input
            v-model="editForm.name"
            autocomplete="off"
            placeholder="例如 番茄炒蛋"
            :disabled="isUpdating"
          />
        </label>

        <label class="form-field">
          <span>所属分类 <b>*</b></span>
          <select v-model="editForm.category_id" :disabled="isUpdating || isCategoryLoading">
            <option value="">请选择分类</option>
            <option v-for="item in activeCategories" :key="item.category_id" :value="item.category_id">
              {{ item.name || item.category_id }}
            </option>
          </select>
        </label>

        <label class="form-field">
          <span>价格 <b>*</b></span>
          <input
            v-model="editForm.price"
            inputmode="decimal"
            autocomplete="off"
            placeholder="例如 18"
            :disabled="isUpdating"
          />
        </label>

        <label class="form-field">
          <span>图片地址</span>
          <input
            v-model="editForm.image_url"
            autocomplete="off"
            placeholder="https://example.com/dish.jpg"
            :disabled="isUpdating"
          />
        </label>

        <label class="form-field form-field--wide">
          <span>描述</span>
          <textarea
            v-model="editForm.description"
            rows="3"
            placeholder="例如 家常下饭菜"
            :disabled="isUpdating"
          />
        </label>

        <p v-if="categoryErrorMessage" class="form-error">{{ categoryErrorMessage }}</p>
        <p v-if="editErrorMessage" class="form-error">{{ editErrorMessage }}</p>

        <div class="form-actions">
          <button class="ghost-button" type="button" :disabled="isUpdating" @click="closeEditForm">取消</button>
          <button class="primary-button" type="submit" :disabled="isUpdating || isCategoryLoading">
            {{ isUpdating ? '正在保存...' : '保存修改' }}
          </button>
        </div>
      </form>
    </GlassCard>

    <section class="content-grid">
      <GlassCard>
        <div class="section-heading">
          <div>
            <h2>餐品列表</h2>
            <p>数据来自 manageDish.listDishes，新增、编辑和上下架成功后会自动刷新。</p>
          </div>
          <StatusBadge label="真实数据" tone="green" />
        </div>

        <div v-if="errorMessage" class="inline-error">
          <div>
            <strong>餐品列表读取失败</strong>
            <span>{{ errorMessage }}（{{ errorCode }}）</span>
          </div>
          <ActionButton variant="ghost" :disabled="isLoading" @click="loadDishes">重试</ActionButton>
        </div>

        <EmptyState v-else-if="isLoading" title="正在读取餐品" description="请稍候，正在从云函数获取真实餐品列表。" />
        <EmptyState
          v-else-if="dishes.length === 0"
          title="暂无餐品"
          description="当前商户还没有餐品。可以点击新增餐品创建第一条基础餐品。"
        />

        <div v-else class="mock-table dish-table">
          <div class="mock-table__head mock-table__row dish-table__row">
            <span>餐品名称</span>
            <span>分类</span>
            <span>价格</span>
            <span>状态</span>
            <span>排序</span>
            <span>做法参考</span>
            <span>食材</span>
            <span>操作</span>
          </div>
          <div v-for="item in dishes" :key="item.id || item.dish_id" class="mock-table__row dish-table__row">
            <span>
              <strong>{{ item.name }}</strong>
              <small>{{ item.description || '暂无描述' }}</small>
            </span>
            <span>{{ item.category_id || '-' }}</span>
            <span>{{ item.price_text }}</span>
            <span>
              <StatusBadge :label="item.status_text" :tone="getDishTone(item.status)" />
            </span>
            <span>{{ item.sort_order }}</span>
            <span>{{ item.tutorials.length }} 条</span>
            <span>{{ item.ingredients.length }} 项</span>
            <span class="table-action-group">
              <ActionButton variant="ghost" @click="openEditForm(item)">编辑</ActionButton>
              <ActionButton
                :variant="item.status === 'on_sale' ? 'danger' : 'ghost'"
                :disabled="Boolean(statusActionDishId)"
                @click="toggleDishStatus(item)"
              >
                {{ statusActionDishId === item.dish_id ? getStatusActionLoadingLabel(item) : getStatusActionLabel(item) }}
              </ActionButton>
              <ActionButton variant="danger" @click="showPendingTip">删除</ActionButton>
            </span>
          </div>
        </div>
      </GlassCard>

      <GlassCard>
        <div class="section-heading">
          <div>
            <h2>后续接入范围</h2>
            <p>删除、做法参考和食材配置仍为后续接入。</p>
          </div>
          <StatusBadge label="基础信息" tone="orange" />
        </div>
        <div class="form-preview">
          <div class="form-preview__group">
            <strong>已接入</strong>
            <span>新增 / 编辑基础信息，上架 / 下架状态切换</span>
          </div>
          <div class="form-preview__group">
            <strong>规格配置</strong>
            <span>标准份、大份、双拼等规格项</span>
          </div>
          <div class="form-preview__group">
            <strong>食材配置</strong>
            <span>食材名称、数量、单位、启用状态</span>
          </div>
          <div class="form-preview__group">
            <strong>做法参考</strong>
            <span>标题、平台、链接、口令、备注</span>
          </div>
        </div>
      </GlassCard>
    </section>
  </section>
</template>
