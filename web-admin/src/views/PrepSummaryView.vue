<script setup lang="ts">
import ActionButton from '../components/ActionButton.vue'
import GlassCard from '../components/GlassCard.vue'
import MockTable from '../components/MockTable.vue'
import PageHeader from '../components/PageHeader.vue'
import StatCard from '../components/StatCard.vue'

const ingredients = [
  { 食材名称: '肥牛片', 数量: '1800', 单位: 'g', 来源菜品: '招牌肥牛石锅拌饭、黑椒牛肉饭' },
  { 食材名称: '米饭', 数量: '12', 单位: '份', 来源菜品: '全部主食' },
  { 食材名称: '胡萝卜丝', 数量: '600', 单位: 'g', 来源菜品: '招牌肥牛石锅拌饭' },
  { 食材名称: '拌饭酱', 数量: '420', 单位: 'g', 来源菜品: '招牌肥牛石锅拌饭' }
]

const shoppingList = `今日采购清单（静态模拟）
- 肥牛片 1800g
- 米饭 12份
- 胡萝卜丝 600g
- 拌饭酱 420g`

function copyShoppingList() {
  window.alert('已复制采购清单（静态模拟）')
}
</script>

<template>
  <section class="page-stack">
    <PageHeader
      eyebrow="Prep Summary"
      title="今日备料"
      description="按今日未取消订单汇总启用食材，帮助私厨提前准备采购清单。"
    >
      <template #actions>
        <ActionButton variant="primary" @click="copyShoppingList">复制采购清单</ActionButton>
      </template>
    </PageHeader>

    <section class="stat-grid">
      <StatCard title="今日有效订单" :value="12" caption="排除已取消订单" />
      <StatCard title="需要备料食材" :value="18" caption="按名称和单位合并" tone="orange" />
      <StatCard title="来源菜品" :value="6" caption="含启用食材配置" tone="green" />
      <StatCard title="空配置菜品" :value="2" caption="建议补齐食材" tone="muted" />
    </section>

    <section class="content-grid">
      <GlassCard>
        <div class="section-heading">
          <div>
            <h2>食材分组</h2>
            <p>肉类、蔬菜、主食、调料按 mock 数据展示。</p>
          </div>
        </div>
        <div class="tag-grid">
          <span>肉类：肥牛片、鸡丁</span>
          <span>蔬菜：胡萝卜丝、菠菜、豆芽</span>
          <span>主食：米饭</span>
          <span>调料：拌饭酱、黑椒汁</span>
        </div>
        <MockTable :columns="['食材名称', '数量', '单位', '来源菜品']" :rows="ingredients" />
      </GlassCard>

      <GlassCard>
        <div class="section-heading">
          <div>
            <h2>采购清单文本</h2>
            <p>后续接入 getPrepSummary 后自动生成。</p>
          </div>
        </div>
        <pre class="copy-box">{{ shoppingList }}</pre>
        <div class="card-actions">
          <ActionButton variant="primary" @click="copyShoppingList">复制采购清单</ActionButton>
        </div>
      </GlassCard>
    </section>
  </section>
</template>
