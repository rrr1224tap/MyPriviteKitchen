<script setup lang="ts">
import ActionButton from '../components/ActionButton.vue'
import GlassCard from '../components/GlassCard.vue'
import MockTable from '../components/MockTable.vue'
import PageHeader from '../components/PageHeader.vue'
import StatCard from '../components/StatCard.vue'
import StatusBadge from '../components/StatusBadge.vue'

const orders = [
  { 订单号: '20260628001', 状态: '待接单', 金额: '¥56.80', 商品数: 2, 下单时间: '14:32', 备注: '不要葱，微辣' },
  { 订单号: '20260628002', 状态: '制作中', 金额: '¥28.90', 商品数: 1, 下单时间: '14:41', 备注: '-' },
  { 订单号: '20260628003', 状态: '已完成', 金额: '¥64.80', 商品数: 3, 下单时间: '12:18', 备注: '到店自提' },
  { 订单号: '20260628004', 状态: '已取消', 金额: '¥24.90', 商品数: 1, 下单时间: '11:02', 备注: '-' }
]

function showMockTip() {
  window.alert('静态原型，后续接入真实接口')
}
</script>

<template>
  <section class="page-stack">
    <PageHeader
      eyebrow="Orders"
      title="订单管理"
      description="查看订单列表、订单详情、规格 / 加料快照和做法参考。第一版不新增 Web 端状态流转按钮。"
    />

    <section class="stat-grid">
      <StatCard title="今日订单" :value="18" caption="今日有效订单" />
      <StatCard title="待接单" :value="3" caption="需要商家处理" tone="brand" />
      <StatCard title="制作中" :value="5" caption="正在出餐" tone="orange" />
      <StatCard title="已完成" :value="10" caption="今日完成订单" tone="green" />
    </section>

    <section class="content-grid">
      <GlassCard>
        <div class="toolbar">
          <div class="filter-pills">
            <button class="filter-pill is-active" type="button">全部</button>
            <button class="filter-pill" type="button">待接单</button>
            <button class="filter-pill" type="button">制作中</button>
            <button class="filter-pill" type="button">已完成</button>
            <button class="filter-pill" type="button">已取消</button>
          </div>
          <input class="search-input" value="20260628" aria-label="搜索订单号" readonly />
        </div>
        <MockTable :columns="['订单号', '状态', '金额', '商品数', '下单时间', '备注']" :rows="orders" />
        <div class="card-actions">
          <ActionButton @click="showMockTip">查看详情</ActionButton>
        </div>
      </GlassCard>

      <GlassCard>
        <div class="section-heading">
          <div>
            <h2>订单详情 mock</h2>
            <p>用于展示后续抽屉或详情页信息层级。</p>
          </div>
          <StatusBadge label="待接单" tone="brand" />
        </div>
        <div class="detail-list">
          <div><strong>商品明细</strong><span>招牌肥牛石锅拌饭 x1、黑椒牛肉饭 x1</span></div>
          <div><strong>规格 / 加料快照</strong><span>大份 / 加肥牛、海苔</span></div>
          <div><strong>做法参考</strong><span>韩式牛肉拌饭做法，重点看酱料比例</span></div>
          <div><strong>备注</strong><span>不要葱，微辣</span></div>
        </div>
      </GlassCard>
    </section>
  </section>
</template>
