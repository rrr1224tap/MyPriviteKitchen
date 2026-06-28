<script setup lang="ts">
import ActionButton from '../components/ActionButton.vue'
import GlassCard from '../components/GlassCard.vue'
import MockTable from '../components/MockTable.vue'
import PageHeader from '../components/PageHeader.vue'
import StatCard from '../components/StatCard.vue'
import StatusBadge from '../components/StatusBadge.vue'

const issues = [
  { 模块: '餐品', 问题: '缺失 merchant_id 的餐品', 级别: 'warning', 可修复: '是' },
  { 模块: '分类', 问题: '缺失 merchant_id 的分类', 级别: 'warning', 可修复: '是' },
  { 模块: '邀请码', 问题: '过期未使用邀请码', 级别: 'info', 可修复: '否' },
  { 模块: '餐品', 问题: '缺食材餐品', 级别: 'warning', 可修复: '否' }
]

function showCheckTip() {
  window.alert('静态原型，后续接入 checkAdminDataHealth')
}

function confirmFix() {
  window.confirm('该操作只会补齐缺失或空的 merchant_id，不会覆盖已有值。')
}
</script>

<template>
  <section class="page-stack">
    <PageHeader
      eyebrow="Data Health"
      title="数据检查"
      description="检查关键数据完整性，轻量修复前必须确认。当前为静态原型。"
    >
      <template #actions>
        <ActionButton variant="primary" @click="showCheckTip">执行检查</ActionButton>
      </template>
    </PageHeader>

    <section class="stat-grid">
      <StatCard title="问题总数" :value="4" caption="静态 mock 问题" tone="orange" />
      <StatCard title="error" :value="0" caption="暂无严重问题" tone="green" />
      <StatCard title="warning" :value="3" caption="建议上线前处理" tone="brand" />
      <StatCard title="可修复项" :value="2" caption="仅限 merchant_id 补齐" tone="muted" />
    </section>

    <section class="content-grid">
      <GlassCard>
        <div class="section-heading">
          <div>
            <h2>模块分组</h2>
            <p>商户、成员、邀请码、餐品、分类、订单、订单明细。</p>
          </div>
          <StatusBadge label="只读检查" tone="green" />
        </div>
        <div class="tag-grid">
          <span>商户：正常</span>
          <span>成员：正常</span>
          <span>邀请码：1 条提醒</span>
          <span>餐品：2 条提醒</span>
          <span>分类：1 条提醒</span>
          <span>订单：正常</span>
          <span>订单明细：正常</span>
        </div>
        <MockTable :columns="['模块', '问题', '级别', '可修复']" :rows="issues" />
      </GlassCard>

      <GlassCard>
        <div class="section-heading">
          <div>
            <h2>可修复项</h2>
            <p>不出现删除订单、删除餐品、清空集合等危险操作。</p>
          </div>
        </div>
        <div class="fix-list">
          <div>
            <strong>补齐餐品默认商户 ID</strong>
            <span>只补齐缺失或空的 dishes.merchant_id。</span>
            <ActionButton variant="danger" size="small" @click="confirmFix">修复</ActionButton>
          </div>
          <div>
            <strong>补齐分类默认商户 ID</strong>
            <span>只补齐缺失或空的 categories.merchant_id。</span>
            <ActionButton variant="danger" size="small" @click="confirmFix">修复</ActionButton>
          </div>
        </div>
      </GlassCard>
    </section>
  </section>
</template>
