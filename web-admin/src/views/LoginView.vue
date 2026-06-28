<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'

const router = useRouter()
const passcode = ref('')

function handleLogin() {
  router.push('/')
}
</script>

<template>
  <main class="login-page">
    <section class="login-hero">
      <div class="login-hero__badge">LOCAL PREVIEW</div>
      <h1>小厨食堂</h1>
      <p class="login-hero__subtitle">私厨管理后台</p>
      <p class="login-hero__desc">
        为个人私厨准备的轻量后台：商户、成员、备料、数据检查会在这里逐步接入。
      </p>
    </section>

    <section class="login-card glass-card" aria-label="登录卡片">
      <div class="login-card__kicker">WEB ADMIN</div>
      <h2>管理入口</h2>
      <label class="form-field">
        <span>管理口令</span>
        <input v-model="passcode" type="password" placeholder="请输入管理口令" />
      </label>
      <button class="primary-button login-card__button" type="button" @click="handleLogin">
        登录
      </button>
      <p class="hint-text">当前为本地静态预览，真实登录将在 v0.5-B 接入</p>
    </section>
  </main>
</template>
