<script setup lang="ts">
import ActionButton from '../components/ActionButton.vue'
import GlassCard from '../components/GlassCard.vue'
import MockTable from '../components/MockTable.vue'
import PageHeader from '../components/PageHeader.vue'
import StatCard from '../components/StatCard.vue'
import StatusBadge from '../components/StatusBadge.vue'

const dishes = [
  { 菜名: '招牌肥牛石锅拌饭', 分类: '热门推荐', 价格: '¥35.90', 状态: '上架中', 食材: '已配置', 做法参考: '2 条', 库存: '充足' },
  { 菜名: '黑椒牛肉饭', 分类: '主食', 价格: '¥28.90', 状态: '上架中', 食材: '缺食材', 做法参考: '1 条', 库存: '18' },
  { 菜名: '宫保鸡丁饭', 分类: '主食', 价格: '¥24.90', 状态: '下架', 食材: '已配置', 做法参考: '缺做法', 库存: '0' }
]

function showMockTip() {
  window.alert('静态原型，后续接入真实接口')
}
</script>

<template>
  <section class="page-stack">
    <PageHeader
      eyebrow="Dishes"
      title="餐品管理"
      description="维护餐品、规格、加料、食材和做法参考。当前不做真实保存。"
    >
      <template #actions>
        <ActionButton variant="primary" @click="showMockTip">新增餐品</ActionButton>
      </template>
    </PageHeader>

    <section class="stat-grid">
      <StatCard title="餐品总数" :value="24" caption="当前 mock 菜品数量" icon="餐" />
      <StatCard title="上架餐品" :value="18" caption="用户端可见" tone="green" icon="架" />
      <StatCard title="缺食材" :value="2" caption="影响今日备料" tone="orange" icon="材" />
      <StatCard title="缺做法" :value="3" caption="影响商家制作参考" tone="muted" icon="法" />
    </section>

    <section class="content-grid">
      <GlassCard>
        <div class="toolbar">
          <div class="filter-pills">
            <button class="filter-pill is-active" type="button">全部分类</button>
            <button class="filter-pill" type="button">热门推荐</button>
            <button class="filter-pill" type="button">主食</button>
            <button class="filter-pill" type="button">下架</button>
          </div>
          <input class="search-input" value="石锅拌饭" aria-label="搜索餐品" readonly />
        </div>
        <MockTable
          :columns="['菜名', '分类', '价格', '状态', '食材', '做法参考', '库存']"
          :rows="dishes"
        />
        <div class="card-actions">
          <ActionButton @click="showMockTip">编辑</ActionButton>
          <ActionButton variant="danger" @click="showMockTip">上架 / 下架</ActionButton>
        </div>
      </GlassCard>

      <GlassCard>
        <div class="section-heading">
          <div>
            <h2>餐品编辑结构</h2>
            <p>用于截图说明后续表单层级。</p>
          </div>
          <StatusBadge label="mock 表单" tone="orange" />
        </div>
        <div class="form-preview">
          <div class="form-preview__group">
            <strong>基础信息</strong>
            <span>菜名、分类、价格、库存、状态</span>
          </div>
          <div class="form-preview__group">
            <strong>规格配置</strong>
            <span>标准份、大份、双拼等规格项</span>
          </div>
          <div class="form-preview__group">
            <strong>加料配置</strong>
            <span>加肥牛、海苔、煎蛋等加料项</span>
          </div>
          <div class="form-preview__group">
            <strong>食材配置</strong>
            <span>食材名称、数量、单位、启用状态</span>
          </div>
          <div class="form-preview__group">
            <strong>做法参考</strong>
            <span>标题、平台、链接 / 口令、备注</span>
          </div>
        </div>
      </GlassCard>
    </section>
  </section>
</template>
