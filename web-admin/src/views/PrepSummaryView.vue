<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import ActionButton from '../components/ActionButton.vue'
import EmptyState from '../components/EmptyState.vue'
import GlassCard from '../components/GlassCard.vue'
import PageHeader from '../components/PageHeader.vue'
import StatCard from '../components/StatCard.vue'
import StatusBadge from '../components/StatusBadge.vue'
import { getPrepSummary, type PrepSummary, type PrepSummaryItem } from '../services/prepSummary'
import type { AdminApiError } from '../types/api'

const MERCHANT_CONTEXT_KEY = 'xiaochu_current_merchant_id'
const FALLBACK_MERCHANT_ID = 'xiaochu'

const merchantId = ref(getStoredMerchantId() || FALLBACK_MERCHANT_ID)
const selectedDate = ref(getTodayText())
const summary = ref<PrepSummary | null>(null)
const isLoading = ref(false)
const errorMessage = ref('')
const errorCode = ref('')

const allItems = computed(() => summary.value?.groups.flatMap((group) => group.items) || [])
const missingConfigCount = computed(() =>
  allItems.value.filter((item) => !item.unit || !Number.isFinite(item.amount) || item.amount <= 0).length
)
const hasSummaryData = computed(() => Boolean(summary.value && summary.value.ingredient_count > 0))
const emptyTitle = computed(() => {
  if (!summary.value || summary.value.order_count <= 0) {
    return '今日暂无需要备料的订单'
  }

  return '当前餐品未配置食材'
})
const emptyDescription = computed(() => {
  if (!summary.value || summary.value.order_count <= 0) {
    return '有新的非取消订单后，这里会自动汇总对应餐品的食材。'
  }

  return '请确认今日订单中的餐品是否已经在餐品管理中配置 ingredients。'
})
const isAuthError = computed(() => ['UNAUTHORIZED', 'TOKEN_EXPIRED', 'FORBIDDEN'].includes(errorCode.value))

function getStoredMerchantId() {
  if (typeof window === 'undefined') {
    return ''
  }

  return window.localStorage.getItem(MERCHANT_CONTEXT_KEY) || ''
}

function getTodayText() {
  const today = new Date()
  const year = today.getFullYear()
  const month = String(today.getMonth() + 1).padStart(2, '0')
  const day = String(today.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function getSourceText(item: PrepSummaryItem) {
  if (!item.sources.length) {
    return '暂无来源餐品'
  }

  return item.sources
    .map((source) => `${source.dish_name} x${source.quantity}`)
    .join('，')
}

async function loadPrepSummary() {
  isLoading.value = true
  errorMessage.value = ''
  errorCode.value = ''

  try {
    summary.value = await getPrepSummary(merchantId.value, {
      date: selectedDate.value || undefined
    })
  } catch (error) {
    const apiError = error as AdminApiError
    errorCode.value = apiError.code || 'UNKNOWN'
    errorMessage.value = apiError.message || '今日备料读取失败，请稍后重试'
    summary.value = null
  } finally {
    isLoading.value = false
  }
}

function handleDateChange(event: Event) {
  const target = event.target as HTMLInputElement
  selectedDate.value = target.value
  loadPrepSummary()
}

onMounted(() => {
  loadPrepSummary()
})
</script>

<template>
  <section class="page-stack">
    <PageHeader
      eyebrow="Prep Summary"
      title="今日备料"
      :description="`当前商户：${merchantId}。数据来自 getPrepSummary，仅做真实读取，不执行采购、库存或打印写入。`"
    >
      <template #actions>
        <input
          class="date-input"
          type="date"
          :value="selectedDate"
          :disabled="isLoading"
          @change="handleDateChange"
        />
        <ActionButton variant="ghost" :disabled="isLoading" @click="loadPrepSummary">
          {{ isLoading ? '刷新中...' : '刷新' }}
        </ActionButton>
      </template>
    </PageHeader>

    <section class="stat-grid">
      <StatCard title="有效订单" :value="summary?.order_count || 0" caption="排除已取消订单" icon="单" />
      <StatCard title="餐品份数" :value="summary?.item_count || 0" caption="订单商品数量汇总" tone="orange" icon="份" />
      <StatCard title="来源餐品" :value="summary?.dish_count || 0" caption="涉及已配置餐品" tone="green" icon="餐" />
      <StatCard title="备料食材" :value="summary?.ingredient_count || 0" caption="按名称和单位合并" tone="brand" icon="材" />
    </section>

    <GlassCard>
      <div class="section-heading">
        <div>
          <h2>备料清单</h2>
          <p>按食材分类汇总用量，来源餐品只读展示。</p>
        </div>
        <StatusBadge :label="summary?.date || selectedDate || '今日'" tone="green" />
      </div>

      <div v-if="errorMessage" class="inline-error">
        <div>
          <strong>今日备料读取失败</strong>
          <span>{{ errorMessage }}（{{ errorCode }}）</span>
        </div>
        <ActionButton variant="ghost" :disabled="isLoading" @click="loadPrepSummary">
          {{ isAuthError ? '重新尝试' : '重试' }}
        </ActionButton>
      </div>

      <EmptyState
        v-else-if="isLoading"
        title="正在生成今日备料"
        description="正在读取今日订单和餐品食材配置，请稍候。"
      />

      <EmptyState
        v-else-if="!hasSummaryData"
        :title="emptyTitle"
        :description="emptyDescription"
      />

      <div v-else class="prep-group-list">
        <section v-for="group in summary?.groups" :key="group.category" class="prep-group">
          <div class="prep-group__title">
            <strong>{{ group.category }}</strong>
            <span>{{ group.items.length }} 项</span>
          </div>
          <div class="prep-table">
            <div class="prep-table__head prep-table__row">
              <span>食材</span>
              <span>用量</span>
              <span>来源餐品</span>
              <span>备注</span>
            </div>
            <div v-for="item in group.items" :key="`${item.name}-${item.unit}`" class="prep-table__row">
              <span>
                <strong>{{ item.name }}</strong>
                <small>{{ item.category }}</small>
              </span>
              <span class="prep-amount">{{ item.display_amount }}</span>
              <span>{{ getSourceText(item) }}</span>
              <span>{{ item.note || '-' }}</span>
            </div>
          </div>
        </section>
      </div>
    </GlassCard>

    <section class="content-grid">
      <GlassCard>
        <div class="section-heading">
          <div>
            <h2>采购清单摘要</h2>
            <p>只读展示当前汇总结果，不创建采购单。</p>
          </div>
        </div>
        <div class="prep-summary-list">
          <div>
            <strong>{{ summary?.ingredient_count || 0 }}</strong>
            <span>启用食材项</span>
          </div>
          <div>
            <strong>{{ missingConfigCount }}</strong>
            <span>缺少单位或数量的食材提示</span>
          </div>
          <div>
            <strong>{{ allItems.length }}</strong>
            <span>当前展示备料行</span>
          </div>
        </div>
      </GlassCard>

      <GlassCard>
        <div class="section-heading">
          <div>
            <h2>采购清单文本</h2>
            <p>由 getPrepSummary 返回，只读展示，复制体验后续再优化。</p>
          </div>
        </div>
        <pre class="copy-box">{{ summary?.copy_text || '暂无可展示的采购清单文本' }}</pre>
      </GlassCard>
    </section>
  </section>
</template>
