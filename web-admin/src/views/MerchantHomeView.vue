<script setup lang="ts">
import { computed } from 'vue'
import { getSession } from '../stores/session'

const session = computed(() => getSession())
const merchantId = computed(() => session.value?.merchant_id || '未识别')
</script>

<template>
  <section class="page-stack">
    <div class="page-header glass-card">
      <div>
        <div class="page-header__eyebrow">Merchant Admin</div>
        <h1>商户后台</h1>
        <p>
          商户菜单、订单和备料管理正在接入中，请先完成前置权限隔离。
        </p>
      </div>
      <span class="status-badge tone-green">最小占位页</span>
    </div>

    <div class="merchant-home-grid">
      <section class="panel glass-card">
        <div class="section-heading compact-section-heading">
          <div>
            <h2>当前身份</h2>
            <p>这里仅展示当前商户管理员 session 的基础信息。</p>
          </div>
        </div>
        <div class="detail-list">
          <div>
            <strong>登录角色</strong>
            <span>merchant_admin</span>
          </div>
          <div>
            <strong>当前商户</strong>
            <span>{{ merchantId }}</span>
          </div>
        </div>
      </section>

      <section class="panel glass-card">
        <div class="section-heading compact-section-heading">
          <div>
            <h2>接入状态</h2>
            <p>本阶段只开放登录与占位入口。</p>
          </div>
        </div>
        <div class="checklist-grid merchant-home-checklist">
          <span>分类管理：待权限隔离</span>
          <span>餐品管理：待权限隔离</span>
          <span>订单管理：待权限隔离</span>
          <span>今日备料：待权限隔离</span>
        </div>
      </section>
    </div>
  </section>
</template>
