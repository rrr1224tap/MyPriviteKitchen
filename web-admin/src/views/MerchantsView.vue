<script setup lang="ts">
import { useRouter } from 'vue-router'
import ActionButton from '../components/ActionButton.vue'
import EmptyState from '../components/EmptyState.vue'
import GlassCard from '../components/GlassCard.vue'
import MockTable from '../components/MockTable.vue'
import PageHeader from '../components/PageHeader.vue'
import StatCard from '../components/StatCard.vue'
import StatusBadge from '../components/StatusBadge.vue'

const router = useRouter()

const merchantRows = [
  {
    商户名称: '小厨食堂',
    merchant_id: 'xiaochu',
    状态: '启用',
    负责人: 'openid：oX****8a2',
    更新时间: '2026-06-28 18:20'
  },
  {
    商户名称: '朋友试吃厨房',
    merchant_id: 'friends_kitchen',
    状态: '禁用',
    负责人: 'openid：oX****6c9',
    更新时间: '2026-06-25 12:04'
  }
]

function showMockTip() {
  window.alert('静态原型，后续接入 manageMerchant')
}

function openStaff() {
  router.push('/merchants/xiaochu/staff')
}
</script>

<template>
  <section class="page-stack">
    <PageHeader
      eyebrow="Merchants"
      title="商户管理"
      description="管理私厨商户基础信息和启用状态。当前页面仅使用 mock 数据展示结构。"
    >
      <template #actions>
        <ActionButton variant="primary" @click="showMockTip">新增商户</ActionButton>
      </template>
    </PageHeader>

    <section class="stat-grid">
      <StatCard title="商户总数" :value="2" caption="含启用与禁用商户" icon="商" />
      <StatCard title="启用商户" :value="1" caption="可被当前系统使用" tone="green" icon="启" />
      <StatCard title="禁用商户" :value="1" caption="暂不参与经营" tone="muted" icon="停" />
      <StatCard title="待完善资料" :value="1" caption="联系人或备注待补充" tone="orange" icon="补" />
    </section>

    <GlassCard>
      <div class="toolbar">
        <div class="filter-pills">
          <button class="filter-pill is-active" type="button">全部</button>
          <button class="filter-pill" type="button">启用</button>
          <button class="filter-pill" type="button">禁用</button>
        </div>
        <input class="search-input" value="小厨食堂" aria-label="搜索商户" readonly />
      </div>

      <MockTable
        :columns="['商户名称', 'merchant_id', '状态', '负责人', '更新时间']"
        :rows="merchantRows"
      />

      <div class="card-actions">
        <StatusBadge label="当前选中：小厨食堂" tone="green" />
        <ActionButton @click="showMockTip">编辑</ActionButton>
        <ActionButton @click="openStaff">成员 / 邀请</ActionButton>
        <ActionButton variant="danger" @click="showMockTip">禁用 / 启用</ActionButton>
      </div>
    </GlassCard>

    <EmptyState title="空状态示例" description="当暂无商户时，这里会引导超级管理员创建第一个商户。">
      <ActionButton variant="primary" @click="showMockTip">创建第一个商户</ActionButton>
    </EmptyState>
  </section>
</template>
