<script setup lang="ts">
import ActionButton from '../components/ActionButton.vue'
import GlassCard from '../components/GlassCard.vue'
import MockTable from '../components/MockTable.vue'
import PageHeader from '../components/PageHeader.vue'
import StatCard from '../components/StatCard.vue'

const categories = [
  { 分类名称: '热门推荐', 状态: '启用', 排序: 1, 餐品数量: 6 },
  { 分类名称: '主食', 状态: '启用', 排序: 2, 餐品数量: 12 },
  { 分类名称: '小菜', 状态: '启用', 排序: 3, 餐品数量: 4 },
  { 分类名称: '饮品', 状态: '停用', 排序: 4, 餐品数量: 2 }
]

function showMockTip() {
  window.alert('静态原型，后续接入真实接口')
}
</script>

<template>
  <section class="page-stack">
    <PageHeader eyebrow="Categories" title="分类管理" description="维护餐品分类、启用状态和展示排序。">
      <template #actions>
        <ActionButton variant="primary" @click="showMockTip">新增分类</ActionButton>
      </template>
    </PageHeader>

    <section class="stat-grid">
      <StatCard title="分类总数" :value="4" caption="当前 mock 分类" icon="类" />
      <StatCard title="启用分类" :value="3" caption="点餐页可见" tone="green" icon="启" />
      <StatCard title="停用分类" :value="1" caption="暂不展示" tone="muted" icon="停" />
      <StatCard title="待排序" :value="0" caption="排序状态正常" tone="orange" icon="序" />
    </section>

    <GlassCard>
      <MockTable :columns="['分类名称', '状态', '排序', '餐品数量']" :rows="categories" />
      <div class="card-actions">
        <ActionButton @click="showMockTip">编辑</ActionButton>
        <ActionButton @click="showMockTip">上移 / 下移</ActionButton>
        <ActionButton variant="danger" @click="showMockTip">启用 / 停用</ActionButton>
      </div>
    </GlassCard>
  </section>
</template>
