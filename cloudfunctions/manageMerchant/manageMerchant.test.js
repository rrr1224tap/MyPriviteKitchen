const test = require('node:test')
const assert = require('node:assert/strict')

const {
  createManageMerchantHandler,
  maskOpenid
} = require('./merchant-service')

function createDependencies(options = {}) {
  const state = {
    openid: options.openid || 'admin_openid',
    superAdminOpenids: options.superAdminOpenids || 'admin_openid,another_admin',
    now: options.now || new Date('2026-06-25T10:00:00.000Z'),
    dishesTouched: 0,
    ordersTouched: 0,
    prepTouched: 0,
    merchants: options.merchants || [
      {
        _id: 'doc_merchant_001',
        merchant_id: 'merchant_001',
        name: '小厨食堂',
        short_name: '小厨',
        status: 'active',
        owner_openid: 'owner_openid_123456',
        notice: '默认测试商户',
        created_at: new Date('2026-06-01T10:00:00.000Z'),
        updated_at: new Date('2026-06-01T10:00:00.000Z')
      }
    ]
  }

  return {
    state,
    deps: {
      getOpenid: () => state.openid,
      getSuperAdminOpenids: () => state.superAdminOpenids,
      now: () => state.now,
      findMerchants: async () => state.merchants,
      findMerchantByMerchantId: async (merchantId) => {
        return state.merchants.find((merchant) => merchant.merchant_id === merchantId) || null
      },
      createMerchant: async (merchant) => {
        const record = {
          _id: `doc_${merchant.merchant_id}`,
          ...merchant
        }
        state.merchants.push(record)
        return record
      },
      updateMerchant: async ({ merchant_id, updateData }) => {
        const merchant = state.merchants.find((item) => item.merchant_id === merchant_id)
        if (!merchant) {
          return null
        }
        Object.assign(merchant, updateData)
        return merchant
      },
      touchDishes: () => {
        state.dishesTouched += 1
      },
      touchOrders: () => {
        state.ordersTouched += 1
      },
      touchPrepSummary: () => {
        state.prepTouched += 1
      },
      logger: {
        error: () => {}
      }
    }
  }
}

test('super admin can create merchant with default active status', async () => {
  const { state, deps } = createDependencies()
  const handler = createManageMerchantHandler(deps)

  const result = await handler({
    action: 'create',
    payload: {
      merchant_id: 'private_kitchen',
      name: '私厨小馆',
      short_name: '',
      owner_openid: 'owner_abcdef123456',
      notice: '朋友点菜测试'
    }
  })

  assert.equal(result.success, true)
  assert.equal(result.code, 'SUCCESS')
  assert.equal(result.data.merchant.merchant_id, 'private_kitchen')
  assert.equal(result.data.merchant.name, '私厨小馆')
  assert.equal(result.data.merchant.short_name, '私厨小馆')
  assert.equal(result.data.merchant.status, 'active')
  assert.equal(result.data.merchant.masked_owner_openid, maskOpenid('owner_abcdef123456'))
  assert.equal(state.merchants.length, 2)
})

test('non super admin cannot create merchant', async () => {
  const { state, deps } = createDependencies({
    openid: 'normal_user'
  })
  const handler = createManageMerchantHandler(deps)

  const result = await handler({
    action: 'create',
    payload: {
      merchant_id: 'blocked_merchant',
      name: '不应创建'
    }
  })

  assert.equal(result.success, false)
  assert.equal(result.code, 'FORBIDDEN')
  assert.equal(state.merchants.some((merchant) => merchant.merchant_id === 'blocked_merchant'), false)
})

test('merchant_id is required when creating merchant', async () => {
  const { deps } = createDependencies()
  const handler = createManageMerchantHandler(deps)

  const result = await handler({
    action: 'create',
    payload: {
      name: '缺少 ID'
    }
  })

  assert.equal(result.success, false)
  assert.equal(result.code, 'VALIDATION_ERROR')
})

test('invalid merchant_id fails validation', async () => {
  const { deps } = createDependencies()
  const handler = createManageMerchantHandler(deps)

  const result = await handler({
    action: 'create',
    payload: {
      merchant_id: 'Bad Merchant',
      name: '格式错误'
    }
  })

  assert.equal(result.success, false)
  assert.equal(result.code, 'VALIDATION_ERROR')
})

test('name is required when creating merchant', async () => {
  const { deps } = createDependencies()
  const handler = createManageMerchantHandler(deps)

  const result = await handler({
    action: 'create',
    payload: {
      merchant_id: 'merchant_new',
      name: ''
    }
  })

  assert.equal(result.success, false)
  assert.equal(result.code, 'VALIDATION_ERROR')
})

test('duplicate merchant_id fails when creating merchant', async () => {
  const { deps } = createDependencies()
  const handler = createManageMerchantHandler(deps)

  const result = await handler({
    action: 'create',
    payload: {
      merchant_id: 'merchant_001',
      name: '重复商户'
    }
  })

  assert.equal(result.success, false)
  assert.equal(result.code, 'ALREADY_EXISTS')
})

test('super admin can list merchants', async () => {
  const { deps } = createDependencies()
  const handler = createManageMerchantHandler(deps)

  const result = await handler({
    action: 'list'
  })

  assert.equal(result.success, true)
  assert.equal(result.data.list.length, 1)
  assert.equal(result.data.total, 1)
  assert.equal(result.data.list[0].merchant_id, 'merchant_001')
})

test('non super admin cannot list merchants', async () => {
  const { deps } = createDependencies({
    openid: 'normal_user'
  })
  const handler = createManageMerchantHandler(deps)

  const result = await handler({
    action: 'list'
  })

  assert.equal(result.success, false)
  assert.equal(result.code, 'FORBIDDEN')
})

test('non super admin receives forbidden before action details', async () => {
  const { deps } = createDependencies({
    openid: 'normal_user'
  })
  const handler = createManageMerchantHandler(deps)

  const result = await handler({
    action: 'unknown'
  })

  assert.equal(result.success, false)
  assert.equal(result.code, 'FORBIDDEN')
})

test('super admin can get merchant detail', async () => {
  const { deps } = createDependencies()
  const handler = createManageMerchantHandler(deps)

  const result = await handler({
    action: 'get',
    payload: {
      merchant_id: 'merchant_001'
    }
  })

  assert.equal(result.success, true)
  assert.equal(result.data.merchant.name, '小厨食堂')
})

test('super admin can update merchant basic info', async () => {
  const { state, deps } = createDependencies()
  const handler = createManageMerchantHandler(deps)

  const result = await handler({
    action: 'update',
    payload: {
      merchant_id: 'merchant_001',
      name: '小厨食堂旗舰店',
      short_name: '小厨旗舰',
      owner_openid: 'new_owner_openid',
      notice: '只修改基础信息'
    }
  })

  const merchant = state.merchants.find((item) => item.merchant_id === 'merchant_001')
  assert.equal(result.success, true)
  assert.equal(merchant.name, '小厨食堂旗舰店')
  assert.equal(merchant.short_name, '小厨旗舰')
  assert.equal(merchant.owner_openid, 'new_owner_openid')
  assert.equal(merchant.notice, '只修改基础信息')
  assert.equal(merchant.status, 'active')
})

test('update cannot change merchant_id', async () => {
  const { deps } = createDependencies()
  const handler = createManageMerchantHandler(deps)

  const result = await handler({
    action: 'update',
    payload: {
      merchant_id: 'merchant_001',
      next_merchant_id: 'merchant_changed',
      name: '尝试改 ID'
    }
  })

  assert.equal(result.success, false)
  assert.equal(result.code, 'VALIDATION_ERROR')
})

test('update cannot change document _id', async () => {
  const { deps } = createDependencies()
  const handler = createManageMerchantHandler(deps)

  const result = await handler({
    action: 'update',
    payload: {
      merchant_id: 'merchant_001',
      _id: 'doc_changed',
      name: '尝试改文档 ID'
    }
  })

  assert.equal(result.success, false)
  assert.equal(result.code, 'VALIDATION_ERROR')
})

test('super admin can disable merchant', async () => {
  const { state, deps } = createDependencies()
  const handler = createManageMerchantHandler(deps)

  const result = await handler({
    action: 'disable',
    payload: {
      merchant_id: 'merchant_001'
    }
  })

  const merchant = state.merchants.find((item) => item.merchant_id === 'merchant_001')
  assert.equal(result.success, true)
  assert.equal(merchant.status, 'disabled')
})

test('super admin can enable merchant', async () => {
  const { state, deps } = createDependencies({
    merchants: [
      {
        merchant_id: 'merchant_001',
        name: '小厨食堂',
        short_name: '小厨',
        status: 'disabled'
      }
    ]
  })
  const handler = createManageMerchantHandler(deps)

  const result = await handler({
    action: 'enable',
    payload: {
      merchant_id: 'merchant_001'
    }
  })

  const merchant = state.merchants.find((item) => item.merchant_id === 'merchant_001')
  assert.equal(result.success, true)
  assert.equal(merchant.status, 'active')
})

test('non super admin cannot enable or disable merchant', async () => {
  const { state, deps } = createDependencies({
    openid: 'normal_user'
  })
  const handler = createManageMerchantHandler(deps)

  const disableResult = await handler({
    action: 'disable',
    payload: {
      merchant_id: 'merchant_001'
    }
  })
  const enableResult = await handler({
    action: 'enable',
    payload: {
      merchant_id: 'merchant_001'
    }
  })

  assert.equal(disableResult.success, false)
  assert.equal(disableResult.code, 'FORBIDDEN')
  assert.equal(enableResult.success, false)
  assert.equal(enableResult.code, 'FORBIDDEN')
  assert.equal(state.merchants[0].status, 'active')
})

test('merchant management does not touch dishes orders or prep summary data', async () => {
  const { state, deps } = createDependencies()
  const handler = createManageMerchantHandler(deps)

  await handler({
    action: 'create',
    payload: {
      merchant_id: 'merchant_extra',
      name: '额外商户'
    }
  })
  await handler({
    action: 'list'
  })

  assert.equal(state.dishesTouched, 0)
  assert.equal(state.ordersTouched, 0)
  assert.equal(state.prepTouched, 0)
})

test('unknown fields are not written into merchant records', async () => {
  const { state, deps } = createDependencies()
  const handler = createManageMerchantHandler(deps)

  await handler({
    action: 'create',
    payload: {
      merchant_id: 'merchant_clean',
      name: '字段过滤商户',
      status: 'disabled',
      unknown_field: 'should_not_write',
      role: 'super_admin'
    }
  })

  const merchant = state.merchants.find((item) => item.merchant_id === 'merchant_clean')
  assert.equal(merchant.status, 'active')
  assert.equal(Object.prototype.hasOwnProperty.call(merchant, 'unknown_field'), false)
  assert.equal(Object.prototype.hasOwnProperty.call(merchant, 'role'), false)
})

test('response structure is stable for failures', async () => {
  const { deps } = createDependencies()
  const handler = createManageMerchantHandler(deps)

  const result = await handler({
    action: 'unknown'
  })

  assert.deepEqual(Object.keys(result), ['success', 'code', 'message', 'data'])
  assert.equal(result.success, false)
  assert.equal(result.data, null)
})
