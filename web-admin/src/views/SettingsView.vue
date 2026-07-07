<script setup lang="ts">
import GlassCard from '../components/GlassCard.vue'
import MockTable from '../components/MockTable.vue'
import PageHeader from '../components/PageHeader.vue'
import StatusBadge from '../components/StatusBadge.vue'

const functions = [
  { 云函数: 'getAdminProfile', 用途: '超级管理员身份', 状态: '需部署' },
  { 云函数: 'manageMerchant', 用途: '商户管理', 状态: '需部署' },
  { 云函数: 'manageMerchantStaff', 用途: '成员与邀请码', 状态: '需部署' },
  { 云函数: 'getAdminOverview', 用途: '后台概览', 状态: '需部署' },
  { 云函数: 'checkAdminDataHealth', 用途: '数据检查', 状态: '需部署' }
]
</script>

<template>
  <section class="page-stack">
    <PageHeader
      eyebrow="Settings"
      title="系统设置"
      description="第一版只读展示，不在前端显示敏感值，也不提供真实编辑功能。"
    />

    <section class="content-grid">
      <GlassCard>
        <div class="section-heading">
          <div>
            <h2>当前环境信息</h2>
            <p>用于上线前核对。</p>
          </div>
          <StatusBadge label="本地原型" tone="orange" />
        </div>
        <div class="detail-list">
          <div><strong>环境</strong><span>本地原型</span></div>
          <div><strong>Web Admin 版本</strong><span>v0.5-A2</span></div>
          <div><strong>小程序稳定 tag</strong><span>private-kitchen-v0.4</span></div>
          <div><strong>SUPER_ADMIN_OPENIDS</strong><span>仅在云函数环境变量配置，不在前端显示真实值</span></div>
          <div><strong>厨房来源</strong><span>食堂登录后使用登录身份里的厨房信息</span></div>
        </div>
      </GlassCard>

      <GlassCard>
        <div class="section-heading">
          <div>
            <h2>云函数部署清单</h2>
            <p>上线前逐项确认部署和环境变量。</p>
          </div>
        </div>
        <MockTable :columns="['云函数', '用途', '状态']" :rows="functions" />
      </GlassCard>
    </section>

    <GlassCard>
      <div class="section-heading">
        <div>
          <h2>上线前检查清单</h2>
          <p>当前为上线前核对清单，后续可接入自动检查结果。</p>
        </div>
      </div>
      <div class="checklist-grid">
        <span>Web 构建通过</span>
        <span>小程序核心链路通过</span>
        <span>云函数部署完成</span>
        <span>环境变量已配置</span>
        <span>普通用户不可见后台</span>
        <span>普通商家不可见系统管理</span>
      </div>
    </GlassCard>
  </section>
</template>
