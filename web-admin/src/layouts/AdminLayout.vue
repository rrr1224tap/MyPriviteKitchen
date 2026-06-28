<script setup lang="ts">
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'

const route = useRoute()
const router = useRouter()

const navItems = [
  { label: '概览', path: '/', key: 'dashboard' },
  { label: '商户管理', path: '/merchants', key: 'merchants' },
  { label: '成员邀请', path: '/merchants/xiaochu/staff', key: 'staff' },
  { label: '餐品管理', path: '/dishes', key: 'dishes' },
  { label: '分类管理', path: '/categories', key: 'categories' },
  { label: '订单管理', path: '/orders', key: 'orders' },
  { label: '今日备料', path: '/prep-summary', key: 'prep-summary' },
  { label: '数据检查', path: '/data-health', key: 'data-health' },
  { label: '系统设置', path: '/settings', key: 'settings' }
]

const activePath = computed(() => route.path)

function handleNav(path: string) {
  router.push(path)
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
          :key="item.key"
          class="side-nav__item"
          :class="{ 'is-active': activePath === item.path || (item.path !== '/' && activePath.startsWith(item.path)) }"
          type="button"
          @click="handleNav(item.path)"
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
