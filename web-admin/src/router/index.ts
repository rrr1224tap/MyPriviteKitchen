import { createRouter, createWebHistory } from 'vue-router'
import AdminLayout from '../layouts/AdminLayout.vue'
import CategoriesView from '../views/CategoriesView.vue'
import DashboardView from '../views/DashboardView.vue'
import DataHealthView from '../views/DataHealthView.vue'
import DishesView from '../views/DishesView.vue'
import LoginView from '../views/LoginView.vue'
import MerchantsView from '../views/MerchantsView.vue'
import MerchantStaffView from '../views/MerchantStaffView.vue'
import OrdersView from '../views/OrdersView.vue'
import PrepSummaryView from '../views/PrepSummaryView.vue'
import SettingsView from '../views/SettingsView.vue'
import { clearSession, hasValidLocalSession } from '../stores/session'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/login',
      name: 'login',
      component: LoginView
    },
    {
      path: '/',
      component: AdminLayout,
      children: [
        {
          path: '',
          name: 'dashboard',
          component: DashboardView
        },
        {
          path: 'merchants',
          name: 'merchants',
          component: MerchantsView
        },
        {
          path: 'merchants/:merchantId/staff',
          name: 'merchant-staff',
          component: MerchantStaffView
        },
        {
          path: 'dishes',
          name: 'dishes',
          component: DishesView
        },
        {
          path: 'categories',
          name: 'categories',
          component: CategoriesView
        },
        {
          path: 'orders',
          name: 'orders',
          component: OrdersView
        },
        {
          path: 'prep-summary',
          name: 'prep-summary',
          component: PrepSummaryView
        },
        {
          path: 'data-health',
          name: 'data-health',
          component: DataHealthView
        },
        {
          path: 'settings',
          name: 'settings',
          component: SettingsView
        }
      ]
    }
  ]
})

router.beforeEach((to) => {
  const isLoginRoute = to.name === 'login'
  const hasSession = hasValidLocalSession()

  if (isLoginRoute) {
    return hasSession ? { path: '/' } : true
  }

  if (hasSession) {
    return true
  }

  clearSession()
  return { path: '/login' }
})

export default router
