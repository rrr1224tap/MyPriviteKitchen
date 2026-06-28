<script setup lang="ts">
import { useRouter } from 'vue-router'

const router = useRouter()

const navItems = [
  { label: '概览', path: '/', active: true },
  { label: '商户管理' },
  { label: '成员邀请' },
  { label: '餐品管理' },
  { label: '订单管理' },
  { label: '今日备料' },
  { label: '数据检查' }
]

function handleNav(item: { label: string; path?: string }) {
  if (item.path) {
    router.push(item.path)
    return
  }

  window.alert('该模块将在后续版本接入')
}

function logout() {
  router.push('/login')
}
</script>

<template>
  <div class="admin-shell">
    <aside class="admin-sidebar glass-card">
      <div class="brand-lockup">
        <div class="brand-mark">厨</div>
        <div>
          <div class="brand-name">小厨食堂</div>
          <div class="brand-subtitle">Private Kitchen Admin</div>
        </div>
      </div>

      <nav class="side-nav" aria-label="后台导航">
        <button
          v-for="item in navItems"
          :key="item.label"
          class="side-nav__item"
          :class="{ 'is-active': item.active }"
          type="button"
          @click="handleNav(item)"
        >
          <span>{{ item.label }}</span>
          <span class="side-nav__dot"></span>
        </button>
      </nav>
    </aside>

    <div class="admin-main">
      <header class="topbar glass-card">
        <div>
          <div class="topbar__eyebrow">当前环境：本地预览</div>
          <div class="topbar__title">当前身份：超级管理员</div>
        </div>
        <button class="ghost-button" type="button" @click="logout">退出</button>
      </header>

      <main class="admin-content">
        <RouterView />
      </main>
    </div>
  </div>
</template>
