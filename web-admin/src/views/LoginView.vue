<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { loginMerchantAdmin, loginWebAdmin } from '../services/auth'
import { saveSession } from '../stores/session'

type LoginMode = 'super_admin' | 'merchant_admin'

const router = useRouter()
const loginMode = ref<LoginMode>('super_admin')
const passcode = ref('')
const merchantSlug = ref('')
const loginName = ref('')
const merchantPassword = ref('')
const errorMessage = ref('')
const isLoading = ref(false)

function switchMode(mode: LoginMode) {
  if (isLoading.value) {
    return
  }

  loginMode.value = mode
  errorMessage.value = ''
}

async function handleSuperAdminLogin() {
  const inputPasscode = passcode.value.trim()
  errorMessage.value = ''

  if (!inputPasscode) {
    errorMessage.value = '请输入管理口令'
    return
  }

  isLoading.value = true
  const result = await loginWebAdmin(inputPasscode)
  isLoading.value = false

  if (!result.success || !result.data) {
    errorMessage.value = result.error?.message || '登录失败，请检查管理口令或稍后重试'
    return
  }

  saveSession({
    token: result.data.token,
    role: result.data.role,
    expires_at: result.data.expires_at
  })

  router.push('/')
}

async function handleMerchantAdminLogin() {
  const inputMerchantSlug = merchantSlug.value.trim()
  const inputLoginName = loginName.value.trim()
  const inputPassword = merchantPassword.value
  errorMessage.value = ''

  if (!inputMerchantSlug) {
    errorMessage.value = '请输入商户标识'
    return
  }

  if (!inputLoginName) {
    errorMessage.value = '请输入登录名'
    return
  }

  if (!inputPassword) {
    errorMessage.value = '请输入密码'
    return
  }

  isLoading.value = true
  const result = await loginMerchantAdmin({
    merchant_slug: inputMerchantSlug,
    login_name: inputLoginName,
    password: inputPassword
  })
  isLoading.value = false

  if (!result.success || !result.data) {
    errorMessage.value = result.error?.message || '商户登录失败，请检查商户标识、登录名或密码'
    return
  }

  saveSession({
    token: result.data.session.token,
    role: result.data.session.role,
    merchant_id: result.data.session.merchant_id,
    expires_at: result.data.session.expires_at
  })

  router.push('/merchant')
}

function handleLogin() {
  if (loginMode.value === 'merchant_admin') {
    return handleMerchantAdminLogin()
  }

  return handleSuperAdminLogin()
}
</script>

<template>
  <main class="login-page">
    <section class="login-hero">
      <div class="login-hero__badge">LOCAL PREVIEW</div>
      <h1>小厨食堂</h1>
      <p class="login-hero__subtitle">私厨管理后台</p>
      <p class="login-hero__desc">
        超级管理员继续管理全局后台；商户管理员登录后会先进入独立占位页，后续再逐步开放分类、餐品、订单和备料管理。
      </p>
    </section>

    <form class="login-card glass-card" aria-label="登录卡片" @submit.prevent="handleLogin">
      <div class="login-card__kicker">WEB ADMIN</div>
      <h2>管理入口</h2>

      <div class="login-mode-tabs" role="tablist" aria-label="登录身份">
        <button
          class="login-mode-tabs__button"
          :class="{ 'is-active': loginMode === 'super_admin' }"
          type="button"
          :disabled="isLoading"
          @click="switchMode('super_admin')"
        >
          超级管理员
        </button>
        <button
          class="login-mode-tabs__button"
          :class="{ 'is-active': loginMode === 'merchant_admin' }"
          type="button"
          :disabled="isLoading"
          @click="switchMode('merchant_admin')"
        >
          商户管理员
        </button>
      </div>

      <div v-if="loginMode === 'super_admin'" class="login-form-stack">
        <label class="form-field">
          <span>管理口令</span>
          <input
            v-model="passcode"
            type="password"
            placeholder="请输入管理口令"
            autocomplete="current-password"
            :disabled="isLoading"
          />
        </label>
      </div>

      <div v-else class="login-form-stack">
        <label class="form-field">
          <span>商户标识</span>
          <input
            v-model="merchantSlug"
            type="text"
            placeholder="例如 b3-test-kitchen-001"
            autocomplete="organization"
            :disabled="isLoading"
          />
        </label>
        <label class="form-field">
          <span>登录名</span>
          <input
            v-model="loginName"
            type="text"
            placeholder="例如 owner"
            autocomplete="username"
            :disabled="isLoading"
          />
        </label>
        <label class="form-field">
          <span>密码</span>
          <input
            v-model="merchantPassword"
            type="password"
            placeholder="请输入商户密码"
            autocomplete="current-password"
            :disabled="isLoading"
          />
        </label>
      </div>

      <p v-if="errorMessage" class="form-error">{{ errorMessage }}</p>
      <button class="primary-button login-card__button" type="submit" :disabled="isLoading">
        {{ isLoading ? '登录中...' : '登录' }}
      </button>
      <p class="hint-text">
        商户管理员本阶段只进入占位页，不开放分类、餐品、订单和备料真实管理。
      </p>
    </form>
  </main>
</template>
