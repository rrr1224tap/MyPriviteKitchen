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
  updateDishIngredients,
  updateDishStatus,
  updateDishTutorials,
  type DishIngredient,
  type DishListItem,
  type DishStatus,
  type DishTutorial,
  type DishTutorialPlatform
} from '../services/dishes'
import type { AdminApiError } from '../types/api'

const route = useRoute()
const MERCHANT_CONTEXT_KEY = 'xiaochu_current_merchant_id'
const FALLBACK_MERCHANT_ID = 'xiaochu'
const MAX_TUTORIAL_COUNT = 3
const tutorialPlatformOptions: Array<{ value: DishTutorialPlatform; label: string }> = [
  { value: 'douyin', label: '抖音' },
  { value: 'xiaohongshu', label: '小红书' },
  { value: 'bilibili', label: 'Bilibili' },
  { value: 'other', label: '其它' }
]

const dishes = ref<DishListItem[]>([])
const categories = ref<CategoryListItem[]>([])
const isLoading = ref(false)
const isCategoryLoading = ref(false)
const errorMessage = ref('')
const errorCode = ref('')
const categoryErrorMessage = ref('')
const selectedDishId = ref('')

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
const isTutorialFormOpen = ref(false)
const isSavingTutorials = ref(false)
const tutorialErrorMessage = ref('')
const tutorialSuccessMessage = ref('')
const tutorialDish = ref<DishListItem | null>(null)
const tutorialForm = ref<DishTutorial[]>([])
const isIngredientFormOpen = ref(false)
const isSavingIngredients = ref(false)
const ingredientErrorMessage = ref('')
const ingredientSuccessMessage = ref('')
const ingredientDish = ref<DishListItem | null>(null)
const ingredientForm = ref<DishIngredient[]>([])

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
const selectedDish = computed(() => {
  return dishes.value.find((item) => getDishKey(item) === selectedDishId.value) || null
})

function getDishKey(item: DishListItem) {
  return item.dish_id || item.id
}

function selectDish(item: DishListItem) {
  selectedDishId.value = getDishKey(item)
}

function ensureSelectedDish(list: DishListItem[]) {
  if (!list.length) {
    selectedDishId.value = ''
    return
  }

  const currentExists = list.some((item) => getDishKey(item) === selectedDishId.value)
  if (!currentExists) {
    selectedDishId.value = getDishKey(list[0])
  }
}

function getDetailStatusText(status: DishStatus) {
  if (status === 'on_sale') {
    return '已上架'
  }

  if (status === 'sold_out') {
    return '已售罄'
  }

  return '已下架'
}

function getTutorialPlatformLabel(platform: DishTutorialPlatform) {
  return tutorialPlatformOptions.find((item) => item.value === platform)?.label || '其它'
}

function getIngredientEnabledText(item: DishIngredient) {
  return item.enabled ? '启用' : '停用'
}

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
  window.alert('删除和规格加料会在后续版本接入，本阶段不执行这些真实写入。')
}

function createEmptyIngredient(index: number): DishIngredient {
  return {
    name: '',
    amount: 0,
    unit: '',
    category: '其他',
    note: '',
    enabled: true,
    sort_order: index + 1
  }
}

function createEmptyTutorial(index: number): DishTutorial {
  return {
    title: '',
    platform: 'other',
    url: '',
    note: '',
    enabled: true,
    sort_order: index + 1
  }
}

function resetIngredientForm() {
  ingredientForm.value = []
  ingredientErrorMessage.value = ''
  ingredientDish.value = null
}

function openIngredientForm(item: DishListItem) {
  ingredientSuccessMessage.value = ''
  ingredientErrorMessage.value = ''
  ingredientDish.value = item
  ingredientForm.value = item.ingredients.map((ingredient, index) => ({
    name: ingredient.name,
    amount: ingredient.amount,
    unit: ingredient.unit,
    category: ingredient.category || '其他',
    note: ingredient.note,
    enabled: ingredient.enabled,
    sort_order: index + 1
  }))
  isIngredientFormOpen.value = true
}

function closeIngredientForm() {
  if (isSavingIngredients.value) return

  isIngredientFormOpen.value = false
  resetIngredientForm()
}

function addIngredient() {
  ingredientErrorMessage.value = ''
  ingredientForm.value.push(createEmptyIngredient(ingredientForm.value.length))
}

function removeIngredient(index: number) {
  ingredientErrorMessage.value = ''
  ingredientForm.value.splice(index, 1)
  ingredientForm.value = ingredientForm.value.map((item, itemIndex) => ({
    ...item,
    sort_order: itemIndex + 1
  }))
}

function clearIngredients() {
  ingredientErrorMessage.value = ''
  ingredientForm.value = []
}

function resetTutorialForm() {
  tutorialForm.value = []
  tutorialErrorMessage.value = ''
  tutorialDish.value = null
}

function openTutorialForm(item: DishListItem) {
  tutorialSuccessMessage.value = ''
  tutorialErrorMessage.value = ''
  tutorialDish.value = item
  tutorialForm.value = item.tutorials.map((tutorial, index) => ({
    title: tutorial.title,
    platform: tutorial.platform,
    url: tutorial.url,
    note: tutorial.note,
    enabled: tutorial.enabled,
    sort_order: index + 1
  }))
  isTutorialFormOpen.value = true
}

function closeTutorialForm() {
  if (isSavingTutorials.value) return

  isTutorialFormOpen.value = false
  resetTutorialForm()
}

function addTutorial() {
  tutorialErrorMessage.value = ''
  if (tutorialForm.value.length >= MAX_TUTORIAL_COUNT) {
    tutorialErrorMessage.value = `做法参考最多配置 ${MAX_TUTORIAL_COUNT} 条`
    return
  }

  tutorialForm.value.push(createEmptyTutorial(tutorialForm.value.length))
}

function removeTutorial(index: number) {
  tutorialErrorMessage.value = ''
  tutorialForm.value.splice(index, 1)
  tutorialForm.value = tutorialForm.value.map((item, itemIndex) => ({
    ...item,
    sort_order: itemIndex + 1
  }))
}

function clearTutorials() {
  tutorialErrorMessage.value = ''
  tutorialForm.value = []
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

function validateTutorialForm() {
  if (tutorialForm.value.length > MAX_TUTORIAL_COUNT) {
    return {
      error: `做法参考最多配置 ${MAX_TUTORIAL_COUNT} 条`
    }
  }

  const tutorials: DishTutorial[] = []
  for (const [index, item] of tutorialForm.value.entries()) {
    const title = item.title.trim()
    const url = item.url.trim()
    const note = item.note.trim()

    if (!title) {
      return {
        error: `第 ${index + 1} 条做法参考标题不能为空`
      }
    }

    if (!url) {
      return {
        error: `第 ${index + 1} 条做法参考链接不能为空`
      }
    }

    tutorials.push({
      title,
      platform: item.platform,
      url,
      note,
      enabled: true,
      sort_order: index + 1
    })
  }

  return {
    payload: tutorials
  }
}

function validateIngredientForm() {
  const ingredients: DishIngredient[] = []
  for (const [index, item] of ingredientForm.value.entries()) {
    const name = item.name.trim()
    const amountText = String(item.amount).trim()
    const amount = Number(item.amount)
    const unit = item.unit.trim()
    const category = item.category.trim() || '其他'
    const note = item.note.trim()

    if (!name) {
      return {
        error: `第 ${index + 1} 条食材名称不能为空`
      }
    }

    if (!amountText || !Number.isFinite(amount) || amount < 0) {
      return {
        error: `第 ${index + 1} 条食材用量必须是大于等于 0 的数字`
      }
    }

    ingredients.push({
      name,
      amount,
      unit,
      category,
      note,
      enabled: item.enabled,
      sort_order: index + 1
    })
  }

  return {
    payload: ingredients
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

async function submitIngredients() {
  if (isSavingIngredients.value || !ingredientDish.value) return

  ingredientErrorMessage.value = ''
  ingredientSuccessMessage.value = ''
  const validation = validateIngredientForm()
  if (validation.error || !validation.payload) {
    ingredientErrorMessage.value = validation.error || '请检查食材配置表单'
    return
  }

  isSavingIngredients.value = true
  try {
    await updateDishIngredients(merchantId.value, ingredientDish.value.dish_id, validation.payload)
    await loadDishes()
    ingredientSuccessMessage.value = '食材配置已更新，列表已刷新'
    isIngredientFormOpen.value = false
    resetIngredientForm()
  } catch (error) {
    const adminError = error as Partial<AdminApiError>
    ingredientErrorMessage.value = adminError.message || '食材配置更新失败，请稍后重试'
  } finally {
    isSavingIngredients.value = false
  }
}

async function submitTutorials() {
  if (isSavingTutorials.value || !tutorialDish.value) return

  tutorialErrorMessage.value = ''
  tutorialSuccessMessage.value = ''
  const validation = validateTutorialForm()
  if (validation.error || !validation.payload) {
    tutorialErrorMessage.value = validation.error || '请检查做法参考表单'
    return
  }

  isSavingTutorials.value = true
  try {
    await updateDishTutorials(merchantId.value, tutorialDish.value.dish_id, validation.payload)
    await loadDishes()
    tutorialSuccessMessage.value = '做法参考已更新，列表已刷新'
    isTutorialFormOpen.value = false
    resetTutorialForm()
  } catch (error) {
    const adminError = error as Partial<AdminApiError>
    tutorialErrorMessage.value = adminError.message || '做法参考更新失败，请稍后重试'
  } finally {
    isSavingTutorials.value = false
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
    ensureSelectedDish(result.list)
  } catch (error) {
    dishes.value = []
    selectedDishId.value = ''
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
      :description="`当前商户：${merchantId}。餐品列表、新增、编辑、上下架、做法参考和食材配置已接入真实云函数；删除和规格加料仍为后续接入。`"
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

    <GlassCard v-if="tutorialSuccessMessage">
      <div class="section-heading compact-section-heading">
        <div>
          <h2>做法参考已更新</h2>
          <p>{{ tutorialSuccessMessage }}</p>
        </div>
      </div>
    </GlassCard>

    <GlassCard v-if="ingredientSuccessMessage">
      <div class="section-heading compact-section-heading">
        <div>
          <h2>食材配置已更新</h2>
          <p>{{ ingredientSuccessMessage }}</p>
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

    <GlassCard v-if="isIngredientFormOpen">
      <div class="section-heading">
        <div>
          <h2>编辑食材配置</h2>
          <p>{{ ingredientDish?.name || '当前餐品' }}，用于今日备料汇总；保存空列表会清空现有食材配置。</p>
        </div>
        <ActionButton variant="ghost" :disabled="isSavingIngredients" @click="closeIngredientForm">收起</ActionButton>
      </div>

      <form class="tutorial-editor ingredient-editor" @submit.prevent="submitIngredients">
        <div class="tutorial-editor__toolbar">
          <ActionButton variant="ghost" :disabled="isSavingIngredients" @click="addIngredient">添加食材</ActionButton>
          <ActionButton
            variant="danger"
            :disabled="isSavingIngredients || ingredientForm.length === 0"
            @click="clearIngredients"
          >
            清空食材
          </ActionButton>
        </div>

        <div v-if="ingredientForm.length === 0" class="tutorial-editor__empty">
          当前没有食材配置，直接保存可清空云端食材配置。
        </div>

        <div v-else class="tutorial-editor__list">
          <div v-for="(item, index) in ingredientForm" :key="index" class="tutorial-editor__item">
            <div class="tutorial-editor__item-head">
              <strong>食材 {{ index + 1 }}</strong>
              <button class="ghost-button compact-button" type="button" :disabled="isSavingIngredients" @click="removeIngredient(index)">
                移除
              </button>
            </div>

            <div class="admin-form tutorial-editor__grid">
              <label class="form-field">
                <span>食材名称 <b>*</b></span>
                <input v-model="item.name" autocomplete="off" placeholder="例如 番茄" :disabled="isSavingIngredients" />
              </label>

              <label class="form-field">
                <span>用量 <b>*</b></span>
                <input v-model.number="item.amount" inputmode="decimal" autocomplete="off" placeholder="例如 2" :disabled="isSavingIngredients" />
              </label>

              <label class="form-field">
                <span>单位</span>
                <input v-model="item.unit" autocomplete="off" placeholder="例如 个 / g / 份" :disabled="isSavingIngredients" />
              </label>

              <label class="form-field">
                <span>分类</span>
                <input v-model="item.category" autocomplete="off" placeholder="例如 蔬菜 / 肉类 / 调料" :disabled="isSavingIngredients" />
              </label>

              <label class="form-field form-field--wide">
                <span>备注</span>
                <textarea v-model="item.note" rows="2" placeholder="例如 中等大小，可提前切块" :disabled="isSavingIngredients" />
              </label>

              <label class="ingredient-toggle form-field--wide">
                <input v-model="item.enabled" type="checkbox" :disabled="isSavingIngredients" />
                <span>启用此食材，参与今日备料汇总</span>
              </label>
            </div>
          </div>
        </div>

        <p v-if="ingredientErrorMessage" class="form-error">{{ ingredientErrorMessage }}</p>

        <div class="form-actions">
          <button class="ghost-button" type="button" :disabled="isSavingIngredients" @click="closeIngredientForm">取消</button>
          <button class="primary-button" type="submit" :disabled="isSavingIngredients">
            {{ isSavingIngredients ? '正在保存...' : '保存食材配置' }}
          </button>
        </div>
      </form>
    </GlassCard>

    <GlassCard v-if="isTutorialFormOpen">
      <div class="section-heading">
        <div>
          <h2>编辑做法参考</h2>
          <p>{{ tutorialDish?.name || '当前餐品' }}，最多配置 {{ MAX_TUTORIAL_COUNT }} 条做法参考；保存空列表会清空现有做法参考。</p>
        </div>
        <ActionButton variant="ghost" :disabled="isSavingTutorials" @click="closeTutorialForm">收起</ActionButton>
      </div>

      <form class="tutorial-editor" @submit.prevent="submitTutorials">
        <div class="tutorial-editor__toolbar">
          <ActionButton
            variant="ghost"
            :disabled="isSavingTutorials || tutorialForm.length >= MAX_TUTORIAL_COUNT"
            @click="addTutorial"
          >
            添加做法
          </ActionButton>
          <ActionButton
            variant="danger"
            :disabled="isSavingTutorials || tutorialForm.length === 0"
            @click="clearTutorials"
          >
            清空做法
          </ActionButton>
        </div>

        <div v-if="tutorialForm.length === 0" class="tutorial-editor__empty">
          当前没有做法参考，直接保存可清空云端做法参考。
        </div>

        <div v-else class="tutorial-editor__list">
          <div v-for="(item, index) in tutorialForm" :key="index" class="tutorial-editor__item">
            <div class="tutorial-editor__item-head">
              <strong>做法参考 {{ index + 1 }}</strong>
              <button class="ghost-button compact-button" type="button" :disabled="isSavingTutorials" @click="removeTutorial(index)">
                移除
              </button>
            </div>

            <div class="admin-form tutorial-editor__grid">
              <label class="form-field">
                <span>标题 <b>*</b></span>
                <input v-model="item.title" autocomplete="off" placeholder="例如 番茄炒蛋家常做法" :disabled="isSavingTutorials" />
              </label>

              <label class="form-field">
                <span>平台</span>
                <select v-model="item.platform" :disabled="isSavingTutorials">
                  <option v-for="option in tutorialPlatformOptions" :key="option.value" :value="option.value">
                    {{ option.label }}
                  </option>
                </select>
              </label>

              <label class="form-field form-field--wide">
                <span>链接或口令 <b>*</b></span>
                <input v-model="item.url" autocomplete="off" placeholder="https://example.com/video 或平台口令" :disabled="isSavingTutorials" />
              </label>

              <label class="form-field form-field--wide">
                <span>备注</span>
                <textarea v-model="item.note" rows="2" placeholder="例如 适合新手，注意火候" :disabled="isSavingTutorials" />
              </label>
            </div>
          </div>
        </div>

        <p v-if="tutorialErrorMessage" class="form-error">{{ tutorialErrorMessage }}</p>

        <div class="form-actions">
          <button class="ghost-button" type="button" :disabled="isSavingTutorials" @click="closeTutorialForm">取消</button>
          <button class="primary-button" type="submit" :disabled="isSavingTutorials">
            {{ isSavingTutorials ? '正在保存...' : '保存做法参考' }}
          </button>
        </div>
      </form>
    </GlassCard>

    <section class="content-grid">
      <GlassCard>
        <div class="section-heading">
          <div>
            <h2>餐品列表</h2>
            <p>数据来自 manageDish.listDishes，新增、编辑、上下架、做法参考和食材配置保存成功后会自动刷新。</p>
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
            <span>餐品信息</span>
            <span>分类</span>
            <span>价格</span>
            <span>状态</span>
            <span>排序</span>
            <span>做法参考</span>
            <span>食材</span>
            <span>操作</span>
          </div>
          <div
            v-for="item in dishes"
            :key="getDishKey(item)"
            class="mock-table__row dish-table__row"
            :class="{ 'dish-table__row--selected': getDishKey(item) === selectedDishId }"
            @click="selectDish(item)"
          >
            <span class="dish-info-cell">
              <strong class="dish-title">{{ item.name }}</strong>
              <small v-if="item.description" class="dish-desc">{{ item.description }}</small>
            </span>
            <span>{{ item.category_id || '-' }}</span>
            <span>{{ item.price_text }}</span>
            <span>
              <StatusBadge :label="item.status_text" :tone="getDishTone(item.status)" />
            </span>
            <span>{{ item.sort_order }}</span>
            <span>{{ item.tutorials.length }} 条</span>
            <span>{{ item.ingredients.length }} 项</span>
            <span class="table-action-group" @click.stop>
              <ActionButton variant="ghost" @click="openEditForm(item)">编辑</ActionButton>
              <ActionButton variant="ghost" @click="openIngredientForm(item)">食材配置</ActionButton>
              <ActionButton variant="ghost" @click="openTutorialForm(item)">做法参考</ActionButton>
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
            <h2>选中餐品详情</h2>
            <p>点击左侧餐品行查看基础信息、做法参考和食材配置摘要。</p>
          </div>
          <StatusBadge :label="selectedDish ? getDetailStatusText(selectedDish.status) : '未选择'" :tone="selectedDish ? getDishTone(selectedDish.status) : 'muted'" />
        </div>

        <div v-if="!selectedDish" class="dish-detail-empty">
          请选择左侧餐品查看详情
        </div>

        <div v-else class="dish-detail-panel">
          <div class="dish-detail-section">
            <div class="dish-detail-title">
              <strong>{{ selectedDish.name }}</strong>
              <StatusBadge :label="getDetailStatusText(selectedDish.status)" :tone="getDishTone(selectedDish.status)" />
            </div>
            <div class="dish-detail-meta">
              <span>分类：{{ selectedDish.category_id || '-' }}</span>
              <span>价格：{{ selectedDish.price_text }}</span>
              <span>排序：{{ selectedDish.sort_order }}</span>
              <span>
                图片：
                <a v-if="selectedDish.image_url" :href="selectedDish.image_url" target="_blank" rel="noreferrer">
                  查看图片
                </a>
                <template v-else>未填写</template>
              </span>
            </div>
          </div>

          <div class="dish-detail-section">
            <strong>餐品描述</strong>
            <p class="dish-detail-text">{{ selectedDish.description || '暂无描述' }}</p>
          </div>

          <div class="dish-detail-section">
            <div class="dish-detail-title compact">
              <strong>做法参考</strong>
              <span>{{ selectedDish.tutorials.length }} 条</span>
            </div>
            <div v-if="selectedDish.tutorials.length" class="dish-mini-list">
              <div v-for="tutorial in selectedDish.tutorials.slice(0, 3)" :key="`${tutorial.title}-${tutorial.sort_order}`" class="dish-mini-item">
                <strong>{{ tutorial.title }}</strong>
                <span>{{ getTutorialPlatformLabel(tutorial.platform) }} · {{ tutorial.url || '未填写链接' }}</span>
              </div>
            </div>
            <p v-else class="dish-detail-muted">暂无做法参考</p>
          </div>

          <div class="dish-detail-section">
            <div class="dish-detail-title compact">
              <strong>食材配置</strong>
              <span>{{ selectedDish.ingredients.length }} 项</span>
            </div>
            <div v-if="selectedDish.ingredients.length" class="dish-mini-list">
              <div v-for="ingredient in selectedDish.ingredients.slice(0, 6)" :key="`${ingredient.name}-${ingredient.sort_order}`" class="dish-mini-item">
                <strong>{{ ingredient.name }}</strong>
                <span>{{ ingredient.amount }}{{ ingredient.unit }} · {{ getIngredientEnabledText(ingredient) }}</span>
              </div>
            </div>
            <p v-else class="dish-detail-muted">暂无食材配置</p>
          </div>
        </div>
      </GlassCard>
    </section>
  </section>
</template>
