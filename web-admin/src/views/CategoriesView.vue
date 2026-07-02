<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import ActionButton from '../components/ActionButton.vue'
import EmptyState from '../components/EmptyState.vue'
import GlassCard from '../components/GlassCard.vue'
import PageHeader from '../components/PageHeader.vue'
import StatCard from '../components/StatCard.vue'
import StatusBadge from '../components/StatusBadge.vue'
import {
  fetchCategories,
  type CategoryListItem,
  type CategoryStatus
} from '../services/categories'
import type { AdminApiError } from '../types/api'

const DEFAULT_MERCHANT_ID = 'xiaochu'

const categories = ref<CategoryListItem[]>([])
const isLoading = ref(false)
const errorMessage = ref('')
const errorCode = ref('')

const activeCount = computed(() => categories.value.filter((item) => item.status === 'active').length)
const inactiveCount = computed(() => categories.value.filter((item) => item.status === 'inactive').length)
const isAuthError = computed(() => ['UNAUTHORIZED', 'TOKEN_EXPIRED', 'FORBIDDEN'].includes(errorCode.value))

function showPendingTip() {
  window.alert('本阶段只接入分类列表读取，新增、编辑、删除和排序会在后续版本接入。')
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

async function loadCategories() {
  isLoading.value = true
  errorMessage.value = ''
  errorCode.value = ''

  try {
    const result = await fetchCategories(DEFAULT_MERCHANT_ID)
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
      :description="`当前商户：${DEFAULT_MERCHANT_ID}。本阶段已接入真实分类列表读取，新增、编辑、删除和排序暂不执行真实写入。`"
    >
      <template #actions>
        <ActionButton variant="ghost" @click="loadCategories">刷新列表</ActionButton>
        <ActionButton variant="primary" @click="showPendingTip">新增分类</ActionButton>
      </template>
    </PageHeader>

    <section class="stat-grid">
      <StatCard title="分类总数" :value="isLoading ? '...' : categories.length" caption="来自 manageCategory.listCategories" icon="类" />
      <StatCard title="启用分类" :value="isLoading ? '...' : activeCount" caption="点餐页可展示" tone="green" icon="启" />
      <StatCard title="停用分类" :value="isLoading ? '...' : inactiveCount" caption="暂不展示" tone="muted" icon="停" />
      <StatCard title="真实写入" value="0" caption="本阶段只读，不写入" tone="orange" icon="读" />
    </section>

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
        description="当前商户还没有可展示分类。本阶段只读取列表，不新增分类。"
      >
        <ActionButton v-if="!isAuthError" variant="ghost" @click="loadCategories">重新加载</ActionButton>
      </EmptyState>

      <div v-else class="mock-table">
        <div class="mock-table__head mock-table__row">
          <span>分类名称</span>
          <span>状态</span>
          <span>排序</span>
          <span>category_id</span>
          <span>更新时间</span>
          <span>操作</span>
        </div>

        <div v-for="item in categories" :key="item.id" class="mock-table__row">
          <span>{{ item.name || '-' }}</span>
          <StatusBadge :label="item.status_text" :tone="categoryTone(item.status)" />
          <span>{{ item.sort_order }}</span>
          <span>{{ item.category_id }}</span>
          <span>{{ formatDate(item.updated_at) }}</span>
          <div class="table-action-group">
            <button class="table-action-button" type="button" @click="showPendingTip">编辑</button>
            <button class="table-action-button" type="button" @click="showPendingTip">排序</button>
            <button class="table-action-button table-action-button--danger" type="button" @click="showPendingTip">启停</button>
          </div>
        </div>
      </div>
    </GlassCard>
  </section>
</template>
