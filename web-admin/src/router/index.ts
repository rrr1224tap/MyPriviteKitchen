import { createRouter, createWebHistory } from 'vue-router'
import AdminLayout from '../layouts/AdminLayout.vue'
import CategoriesView from '../views/CategoriesView.vue'
import DashboardView from '../views/DashboardView.vue'
import DataHealthView from '../views/DataHealthView.vue'
import DishesView from '../views/DishesView.vue'
import LoginView from '../views/LoginView.vue'
import MerchantHomeView from '../views/MerchantHomeView.vue'
import MerchantsView from '../views/MerchantsView.vue'
import MerchantStaffView from '../views/MerchantStaffView.vue'
import OrdersView from '../views/OrdersView.vue'
import PrepSummaryView from '../views/PrepSummaryView.vue'
import SettingsView from '../views/SettingsView.vue'
import { clearSession, getSession, hasValidLocalSession, type AdminRole } from '../stores/session'

function homePathForRole(role?: AdminRole) {
  return role === 'merchant_admin' ? '/merchant' : '/'
}

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
          component: DashboardView,
          meta: {
            roles: ['super_admin']
          }
        },
        {
          path: 'merchants',
          name: 'merchants',
          component: MerchantsView,
          meta: {
            roles: ['super_admin']
          }
        },
        {
          path: 'merchants/:merchantId/staff',
          name: 'merchant-staff',
          component: MerchantStaffView,
          meta: {
            roles: ['super_admin']
          }
        },
        {
          path: 'merchants/:merchantId/dishes',
          name: 'merchant-dishes',
          component: DishesView,
          meta: {
            roles: ['super_admin']
          }
        },
        {
          path: 'dishes',
          name: 'dishes',
          component: DishesView,
          meta: {
            roles: ['super_admin']
          }
        },
        {
          path: 'categories',
          name: 'categories',
          component: CategoriesView,
          meta: {
            roles: ['super_admin']
          }
        },
        {
          path: 'orders',
          name: 'orders',
          component: OrdersView,
          meta: {
            roles: ['super_admin']
          }
        },
        {
          path: 'prep-summary',
          name: 'prep-summary',
          component: PrepSummaryView,
          meta: {
            roles: ['super_admin']
          }
        },
        {
          path: 'data-health',
          name: 'data-health',
          component: DataHealthView,
          meta: {
            roles: ['super_admin']
          }
        },
        {
          path: 'settings',
          name: 'settings',
          component: SettingsView,
          meta: {
            roles: ['super_admin']
          }
        },
        {
          path: 'merchant',
          name: 'merchant-home',
          component: MerchantHomeView,
          meta: {
            roles: ['merchant_admin']
          }
        }
      ]
    }
  ]
})

router.beforeEach((to) => {
  const isLoginRoute = to.name === 'login'
  const hasSession = hasValidLocalSession()
  const session = getSession()

  if (isLoginRoute) {
    return hasSession ? { path: homePathForRole(session?.role) } : true
  }

  if (!hasSession || !session) {
    clearSession()
    return { path: '/login' }
  }

  const allowedRoles = to.matched
    .flatMap((record) => record.meta.roles || []) as AdminRole[]

  if (allowedRoles.length > 0 && !allowedRoles.includes(session.role)) {
    return { path: homePathForRole(session.role) }
  }

  return true
})

export default router
