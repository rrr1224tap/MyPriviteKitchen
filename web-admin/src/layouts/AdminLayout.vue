<script setup lang="ts">
import { computed, watchEffect } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { logoutWebAdmin, roleText } from '../services/auth'
import { getSession } from '../stores/session'

const route = useRoute()
const router = useRouter()
const MERCHANT_CONTEXT_KEY = 'xiaochu_current_merchant_id'
const FALLBACK_MERCHANT_ID = 'xiaochu'

const session = computed(() => getSession())
const isMerchantAdmin = computed(() => session.value?.role === 'merchant_admin')

function getRouteMerchantId() {
  const value = route.params.merchantId
  return Array.isArray(value) ? value[0] || '' : String(value || '')
}

function getStoredMerchantId() {
  if (typeof window === 'undefined') {
    return ''
  }

  return window.localStorage.getItem(MERCHANT_CONTEXT_KEY) || ''
}

const currentMerchantId = computed(() => {
  if (isMerchantAdmin.value) {
    return session.value?.merchant_id || ''
  }

  return getRouteMerchantId() || getStoredMerchantId() || FALLBACK_MERCHANT_ID
})

watchEffect(() => {
  const routeMerchantId = getRouteMerchantId()
  if (!isMerchantAdmin.value && routeMerchantId && typeof window !== 'undefined') {
    window.localStorage.setItem(MERCHANT_CONTEXT_KEY, routeMerchantId)
  }
})

const superAdminNavItems = computed(() => [
  { label: '概览', path: '/', key: 'dashboard', icon: '总' },
  { label: '商户管理', path: '/merchants', key: 'merchants', icon: '商' },
  { label: '成员邀请', path: `/merchants/${currentMerchantId.value}/staff`, key: 'staff', icon: '员' },
  { label: '餐品管理', path: `/merchants/${currentMerchantId.value}/dishes`, key: 'dishes', icon: '餐' },
  { label: '分类管理', path: '/categories', key: 'categories', icon: '类' },
  { label: '订单管理', path: '/orders', key: 'orders', icon: '单' },
  { label: '今日备料', path: '/prep-summary', key: 'prep-summary', icon: '备' },
  { label: '数据检查', path: '/data-health', key: 'data-health', icon: '检' },
  { label: '系统设置', path: '/settings', key: 'settings', icon: '设' }
])

const merchantAdminNavItems = [
  { label: '商户首页', path: '/merchant', key: 'merchant-home', icon: '店' },
  { label: '分类管理', path: '/merchant/categories', key: 'merchant-categories', icon: '类' }
]

const navItems = computed(() => {
  return isMerchantAdmin.value ? merchantAdminNavItems : superAdminNavItems.value
})

const activePath = computed(() => route.path)
const currentRoleText = computed(() => roleText(session.value?.role))
const profileDesc = computed(() => {
  return isMerchantAdmin.value ? `商户：${currentMerchantId.value || '未识别'}` : '本地静态预览'
})

function isNavItemActive(path: string) {
  if (path === '/merchant') {
    return activePath.value === path
  }

  return activePath.value === path || activePath.value.startsWith(`${path}/`)
}

function handleNav(path: string) {
  router.push(path)
}

function logout() {
  logoutWebAdmin()
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
          :class="{ 'is-active': isNavItemActive(item.path) }"
          type="button"
          @click="handleNav(item.path)"
        >
          <span class="side-nav__label">
            <span class="side-nav__icon">{{ item.icon }}</span>
            <span>{{ item.label }}</span>
          </span>
          <span class="side-nav__dot"></span>
        </button>
      </nav>

      <div class="sidebar-profile">
        <div class="sidebar-profile__label">当前身份</div>
        <div class="sidebar-profile__name">{{ currentRoleText }}</div>
        <div class="sidebar-profile__desc">{{ profileDesc }}</div>
      </div>
    </aside>

    <div class="admin-main">
      <header class="topbar glass-card">
        <div>
          <div class="topbar__eyebrow">当前环境：本地预览</div>
          <div class="topbar__title">
            当前身份：{{ currentRoleText }}
            <span v-if="isMerchantAdmin"> · {{ currentMerchantId }}</span>
          </div>
        </div>
        <button class="ghost-button" type="button" @click="logout">退出</button>
      </header>

      <main class="admin-content">
        <RouterView />
      </main>
    </div>
  </div>
</template>
