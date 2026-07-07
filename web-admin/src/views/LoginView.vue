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
    errorMessage.value = '请输入工作台口令'
    return
  }

  isLoading.value = true
  const result = await loginWebAdmin(inputPasscode)
  isLoading.value = false

  if (!result.success || !result.data) {
    errorMessage.value = result.error?.message || '登录失败，请检查工作台口令或稍后重试'
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
    errorMessage.value = '请输入厨房标识'
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
    errorMessage.value = result.error?.message || '食堂登录失败，请检查厨房标识、登录名或密码'
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
      <h1>朋友们的食堂</h1>
      <p class="login-hero__subtitle">食堂工作台</p>
      <p class="login-hero__desc">
        总控台继续维护全局配置；食堂登录后进入自己的工作台，处理菜单分类、今日菜品、点菜单和备菜清单。
      </p>
    </section>

    <form class="login-card glass-card" aria-label="登录卡片" @submit.prevent="handleLogin">
      <div class="login-card__kicker">CANTEEN PASS</div>
      <h2>工作台入口</h2>

      <div class="login-mode-tabs" role="tablist" aria-label="登录身份">
        <button
          class="login-mode-tabs__button"
          :class="{ 'is-active': loginMode === 'super_admin' }"
          type="button"
          :disabled="isLoading"
          @click="switchMode('super_admin')"
        >
          总控台
        </button>
        <button
          class="login-mode-tabs__button"
          :class="{ 'is-active': loginMode === 'merchant_admin' }"
          type="button"
          :disabled="isLoading"
          @click="switchMode('merchant_admin')"
        >
          食堂登录
        </button>
      </div>

      <div v-if="loginMode === 'super_admin'" class="login-form-stack">
        <label class="form-field">
          <span>工作台口令</span>
          <input
            v-model="passcode"
            type="password"
            placeholder="请输入工作台口令"
            autocomplete="current-password"
            :disabled="isLoading"
          />
        </label>
      </div>

      <div v-else class="login-form-stack">
        <label class="form-field">
          <span>厨房标识</span>
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
            placeholder="请输入厨房密码"
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
        食堂登录只进入自己的工作台，不会看到其它厨房内容。
      </p>
    </form>
  </main>
</template>
