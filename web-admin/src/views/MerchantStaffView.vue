<script setup lang="ts">
import { useRoute } from 'vue-router'
import ActionButton from '../components/ActionButton.vue'
import GlassCard from '../components/GlassCard.vue'
import MockTable from '../components/MockTable.vue'
import PageHeader from '../components/PageHeader.vue'
import StatCard from '../components/StatCard.vue'
import StatusBadge from '../components/StatusBadge.vue'

const route = useRoute()

const members = [
  { 角色: 'owner', 状态: '启用', openid: 'openid：oX****8a2', 加入时间: '2026-06-12' },
  { 角色: 'staff', 状态: '启用', openid: 'openid：oX****5d1', 加入时间: '2026-06-18' },
  { 角色: 'staff', 状态: '禁用', openid: 'openid：oX****7f0', 加入时间: '2026-06-22' }
]

const invites = [
  { 邀请码: 'XCHU-82K1', role: 'staff', status: '未使用', 过期时间: '2026-07-01', 使用人: '-' },
  { 邀请码: 'XCHU-19QA', role: 'staff', status: '已使用', 过期时间: '2026-06-25', 使用人: 'oX****5d1' },
  { 邀请码: 'XCHU-44MN', role: 'staff', status: '已禁用', 过期时间: '2026-06-30', 使用人: '-' },
  { 邀请码: 'XCHU-72VP', role: 'staff', status: '已过期', 过期时间: '2026-06-20', 使用人: '-' }
]

function showMockTip() {
  window.alert('静态原型，后续接入 manageMerchantStaff')
}

function copyInvite() {
  window.alert('已复制邀请码（静态模拟）')
}
</script>

<template>
  <section class="page-stack">
    <PageHeader
      eyebrow="Staff & Invites"
      title="成员与邀请"
      :description="`当前商户：小厨食堂（merchant_id：${route.params.merchantId || 'xiaochu'}）`"
    >
      <template #actions>
        <ActionButton variant="primary" @click="showMockTip">生成邀请码</ActionButton>
      </template>
    </PageHeader>

    <section class="stat-grid">
      <StatCard title="成员数量" :value="3" caption="含 owner 与 staff" icon="员" />
      <StatCard title="启用成员" :value="2" caption="可进入商家工作台" tone="green" icon="启" />
      <StatCard title="可用邀请码" :value="1" caption="尚未使用且未过期" tone="orange" icon="邀" />
      <StatCard title="异常邀请" :value="2" caption="已禁用或已过期" tone="muted" icon="醒" />
    </section>

    <section class="content-grid">
      <GlassCard>
        <div class="section-heading">
          <div>
            <h2>成员列表</h2>
            <p>成员身份仍以云函数校验为准。</p>
          </div>
        </div>
        <MockTable :columns="['角色', '状态', 'openid', '加入时间']" :rows="members" />
        <div class="card-actions">
          <ActionButton @click="showMockTip">启用 / 禁用成员</ActionButton>
        </div>
      </GlassCard>

      <GlassCard>
        <div class="section-heading">
          <div>
            <h2>邀请码列表</h2>
            <p>复制、禁用和生成均为静态模拟。</p>
          </div>
          <StatusBadge label="mock" tone="orange" />
        </div>
        <MockTable :columns="['邀请码', 'role', 'status', '过期时间', '使用人']" :rows="invites" />
        <div class="card-actions">
          <ActionButton @click="copyInvite">复制邀请码</ActionButton>
          <ActionButton variant="danger" @click="showMockTip">禁用邀请码</ActionButton>
        </div>
      </GlassCard>
    </section>
  </section>
</template>
