const test = require('node:test')
const assert = require('node:assert/strict')

const { createLoginHandler } = require('./login-service')

function createDependencies(overrides = {}) {
  const calls = {
    createUser: [],
    updateUser: []
  }

  const dependencies = {
    logError: () => {},
    getOpenid: () => 'openid_test',
    now: () => new Date('2026-06-14T10:00:00.000Z'),
    findUserByOpenid: async () => null,
    createUser: async (user) => {
      calls.createUser.push(user)
      return Object.assign({ _id: 'user_001' }, user)
    },
    updateUser: async (user, updates) => {
      calls.updateUser.push({ user, updates })
      return Object.assign({}, user, updates)
    },
    findActiveMerchantStaff: async () => null,
    findMerchantById: async () => null,
    ...overrides
  }

  return { dependencies, calls }
}

test('creates a new user from the cloud openid', async () => {
  const { dependencies, calls } = createDependencies()
  const login = createLoginHandler(dependencies)

  const result = await login({
    openid: 'untrusted_openid',
    nickname: '微信用户',
    avatar_url: 'avatar.png'
  })

  assert.equal(result.success, true)
  assert.equal(result.data.openid, 'openid_test')
  assert.equal(result.data.user.avatar_url, 'avatar.png')
  assert.equal(result.data.is_merchant, false)
  assert.equal(calls.createUser.length, 1)
  assert.equal(calls.createUser[0].openid, 'openid_test')
  assert.equal(calls.createUser[0].role, 'user')
  assert.equal(calls.createUser[0].status, 'active')
})

test('updates login timestamps for an existing user', async () => {
  const existingUser = {
    _id: 'user_001',
    openid: 'openid_test',
    nickname: '旧昵称',
    avatar: '',
    phone: '',
    role: 'user',
    status: 'active'
  }
  const { dependencies, calls } = createDependencies({
    findUserByOpenid: async () => existingUser
  })
  const login = createLoginHandler(dependencies)

  const result = await login({ nickname: '新昵称' })

  assert.equal(result.success, true)
  assert.equal(result.data.user.nickname, '新昵称')
  assert.equal(calls.updateUser.length, 1)
  assert.ok(calls.updateUser[0].updates.updated_at instanceof Date)
  assert.ok(calls.updateUser[0].updates.last_login_at instanceof Date)
})

test('returns merchant identity for an active merchant staff member', async () => {
  const merchantStaff = {
    _id: 'staff_001',
    merchant_id: 'merchant_001',
    openid: 'openid_test',
    role: 'owner',
    status: 'active'
  }
  const merchant = {
    _id: 'merchant_001',
    name: '测试点餐店',
    business_status: 'open'
  }
  const { dependencies } = createDependencies({
    findActiveMerchantStaff: async () => merchantStaff,
    findMerchantById: async () => merchant
  })
  const login = createLoginHandler(dependencies)

  const result = await login({})

  assert.equal(result.data.is_merchant, true)
  assert.equal(result.data.merchant_staff.merchant_id, 'merchant_001')
  assert.equal(result.data.merchant.merchant_id, 'merchant_001')
})

test('returns null merchant data for a normal user', async () => {
  const { dependencies } = createDependencies()
  const login = createLoginHandler(dependencies)

  const result = await login({})

  assert.equal(result.data.is_merchant, false)
  assert.equal(result.data.merchant_staff, null)
  assert.equal(result.data.merchant, null)
})

test('returns a unified error when openid is unavailable', async () => {
  const { dependencies } = createDependencies({
    getOpenid: () => ''
  })
  const login = createLoginHandler(dependencies)

  const result = await login({})

  assert.deepEqual(result, {
    success: false,
    code: 'UNAUTHORIZED',
    message: '无法获取用户身份',
    data: null
  })
})

test('returns a unified server error when database access fails', async () => {
  const { dependencies } = createDependencies({
    findUserByOpenid: async () => {
      throw new Error('database unavailable')
    }
  })
  const login = createLoginHandler(dependencies)

  const result = await login({})

  assert.deepEqual(result, {
    success: false,
    code: 'SERVER_ERROR',
    message: '登录失败，请稍后重试',
    data: null
  })
})
