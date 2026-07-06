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
        <div class="page-header__eyebrow">Kitchen Workbench</div>
        <h1>小厨工作台</h1>
        <p>
          菜单分类、今日菜品、今天的点菜单和备菜清单已经按当前小厨房隔离。
        </p>
      </div>
      <span class="status-badge tone-green">已按小厨房隔离</span>
    </div>

    <div class="merchant-home-grid">
      <section class="panel glass-card">
        <div class="section-heading compact-section-heading">
          <div>
            <h2>当前身份</h2>
            <p>这里仅展示当前小厨登录身份的基础信息。</p>
          </div>
        </div>
        <div class="detail-list">
          <div>
            <strong>登录角色</strong>
            <span>merchant_admin</span>
          </div>
          <div>
            <strong>当前小厨房</strong>
            <span>{{ merchantId }}</span>
          </div>
        </div>
      </section>

      <section class="panel glass-card">
        <div class="section-heading compact-section-heading">
          <div>
            <h2>工作台入口</h2>
            <p>从左侧进入对应小厨房的日常操作。</p>
          </div>
        </div>
        <div class="checklist-grid merchant-home-checklist">
          <span>菜单分类：已可使用</span>
          <span>今日菜品：已可使用</span>
          <span>今天谁来吃饭：已可使用</span>
          <span>备菜清单：已可使用</span>
        </div>
      </section>
    </div>
  </section>
</template>
