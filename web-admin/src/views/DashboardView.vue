<script setup lang="ts">
import { useRouter } from 'vue-router'
import ModuleCard from '../components/ModuleCard.vue'
import StatCard from '../components/StatCard.vue'
import StatusBadge from '../components/StatusBadge.vue'

const router = useRouter()

const stats = [
  { title: '今日订单', value: 12, caption: '含待处理与制作中订单', tone: 'brand' as const },
  { title: '启用商户', value: 1, caption: '当前私厨经营主体', tone: 'green' as const },
  { title: '商户成员', value: 3, caption: '含管理员与协作成员', tone: 'orange' as const },
  { title: '待处理提醒', value: 4, caption: '数据与备料提醒', tone: 'muted' as const }
]

const modules = [
  { title: '商户管理', description: '维护商户基础信息与启用状态', tag: '后台', path: '/merchants' },
  { title: '成员邀请', description: '生成邀请码并管理成员身份', tag: '权限', path: '/merchants/xiaochu/staff' },
  { title: '餐品管理', description: '维护菜品、规格、加料与食材', tag: '菜单', path: '/dishes' },
  { title: '今日备料', description: '按今日订单汇总采购清单', tag: '私厨', path: '/prep-summary' },
  { title: '数据检查', description: '检查关键数据完整性与轻量修复', tag: '安全', path: '/data-health' }
]

const warnings = [
  '有 2 个餐品未配置食材',
  '有 1 个邀请码即将过期'
]

const recentOrders = [
  { no: '20260628001', dish: '招牌肥牛石锅拌饭', status: '待接单', amount: '¥35.90' },
  { no: '20260628002', dish: '黑椒牛肉饭', status: '制作中', amount: '¥28.90' },
  { no: '20260628003', dish: '宫保鸡丁饭', status: '已接单', amount: '¥24.90' },
  { no: '20260628004', dish: '招牌肥牛石锅拌饭', status: '已完成', amount: '¥35.90' },
  { no: '20260628005', dish: '黑椒牛肉饭', status: '待接单', amount: '¥28.90' }
]

function openModule(path: string) {
  router.push(path)
}
</script>

<template>
  <section class="dashboard-view">
    <div class="dashboard-hero glass-card">
      <div>
        <div class="dashboard-hero__kicker">Private Kitchen Web Admin v0.5-A2</div>
        <h1>欢迎回来，小厨管理员</h1>
        <p>当前为静态页面原型，真实数据将在后续版本接入</p>
      </div>
      <StatusBadge label="本地预览" tone="orange" />
    </div>

    <section class="stat-grid" aria-label="数据统计">
      <StatCard
        v-for="item in stats"
        :key="item.title"
        :title="item.title"
        :value="item.value"
        :caption="item.caption"
        :tone="item.tone"
      />
    </section>

    <section class="content-grid">
      <div class="panel glass-card">
        <div class="section-heading">
          <div>
            <h2>后台模块</h2>
            <p>第一版仅保留静态入口，用于原型预览和截图</p>
          </div>
        </div>
        <div class="module-grid">
          <ModuleCard
            v-for="item in modules"
            :key="item.title"
            :title="item.title"
            :description="item.description"
            :tag="item.tag"
            @select="openModule(item.path)"
          />
        </div>
      </div>

      <div class="panel-stack">
        <section class="panel glass-card">
          <div class="section-heading">
            <div>
              <h2>风险提醒</h2>
              <p>静态 mock 数据</p>
            </div>
          </div>
          <ul class="warning-list">
            <li v-for="item in warnings" :key="item">
              <span class="warning-dot"></span>
              <span>{{ item }}</span>
            </li>
          </ul>
        </section>

        <section class="panel glass-card">
          <div class="section-heading">
            <div>
              <h2>最近订单</h2>
              <p>显示 5 条静态订单</p>
            </div>
          </div>
          <div class="order-list">
            <article v-for="order in recentOrders" :key="order.no" class="order-row">
              <div>
                <div class="order-row__no">{{ order.no }}</div>
                <div class="order-row__dish">{{ order.dish }}</div>
              </div>
              <div class="order-row__side">
                <StatusBadge :label="order.status" tone="brand" />
                <div class="order-row__amount">{{ order.amount }}</div>
              </div>
            </article>
          </div>
        </section>
      </div>
    </section>
  </section>
</template>
