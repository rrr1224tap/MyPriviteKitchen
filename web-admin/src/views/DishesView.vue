<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import ActionButton from '../components/ActionButton.vue'
import EmptyState from '../components/EmptyState.vue'
import GlassCard from '../components/GlassCard.vue'
import PageHeader from '../components/PageHeader.vue'
import StatCard from '../components/StatCard.vue'
import StatusBadge from '../components/StatusBadge.vue'
import { fetchDishes, type DishListItem, type DishStatus } from '../services/dishes'
import type { AdminApiError } from '../types/api'

const route = useRoute()
const MERCHANT_CONTEXT_KEY = 'xiaochu_current_merchant_id'
const FALLBACK_MERCHANT_ID = 'xiaochu'

const dishes = ref<DishListItem[]>([])
const isLoading = ref(false)
const errorMessage = ref('')
const errorCode = ref('')

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
  window.alert('本阶段只接入餐品列表读取，新增、编辑、删除、上下架、做法参考和食材配置会在后续版本接入。')
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
    const adminError = error as AdminApiError
    errorCode.value = adminError.code || 'UNKNOWN_ERROR'
    errorMessage.value = adminError.message || '餐品列表读取失败，请稍后重试'
  } finally {
    isLoading.value = false
  }
}

onMounted(loadDishes)
watch(merchantId, loadDishes)
</script>

<template>
  <section class="page-stack">
    <PageHeader
      eyebrow="Dishes"
      title="餐品管理"
      :description="`当前商户：${merchantId}。查看真实餐品列表、分类归属、售价、状态、做法参考和食材配置。本阶段不执行餐品写入。`"
    >
      <template #actions>
        <ActionButton variant="ghost" :disabled="isLoading" @click="loadDishes">刷新</ActionButton>
        <ActionButton variant="primary" @click="showPendingTip">新增餐品</ActionButton>
      </template>
    </PageHeader>

    <section class="stat-grid">
      <StatCard title="餐品总数" :value="dishes.length" caption="当前真实餐品数量" icon="餐" />
      <StatCard title="上架餐品" :value="onSaleCount" caption="用户端可见" tone="green" icon="售" />
      <StatCard title="已下架" :value="offSaleCount" caption="暂不对用户展示" tone="orange" icon="下" />
      <StatCard title="缺食材配置" :value="missingIngredientCount" caption="需要后续补齐" tone="muted" icon="材" />
    </section>

    <section class="content-grid">
      <GlassCard>
        <div class="section-heading">
          <div>
            <h2>餐品列表</h2>
            <p>数据来自 manageDish.listDishes，仅做真实读取。</p>
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
          description="当前商户还没有餐品。本阶段不开放新增餐品，请在后续版本接入。"
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
              <ActionButton variant="ghost" @click="showPendingTip">编辑</ActionButton>
              <ActionButton variant="ghost" @click="showPendingTip">上下架</ActionButton>
              <ActionButton variant="danger" @click="showPendingTip">删除</ActionButton>
            </span>
          </div>
        </div>
      </GlassCard>

      <GlassCard>
        <div class="section-heading">
          <div>
            <h2>后续接入范围</h2>
            <p>新增、编辑、删除、上下架、做法参考和食材配置仍为后续接入。</p>
          </div>
          <StatusBadge label="只读阶段" tone="orange" />
        </div>
        <div class="form-preview">
          <div class="form-preview__group">
            <strong>基础信息</strong>
            <span>餐品名称、分类、价格、图片、状态</span>
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
