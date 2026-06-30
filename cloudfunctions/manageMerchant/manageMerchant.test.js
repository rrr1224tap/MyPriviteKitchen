const test = require('node:test')
const assert = require('node:assert/strict')

const {
  createManageMerchantHandler,
  maskOpenid
} = require('./merchant-service')
const {
  createSignedToken
} = require('../webAdminAuth/web-admin-auth-service')

function createDependencies(options = {}) {
  const state = {
    openid: options.openid === undefined ? 'admin_openid' : options.openid,
    superAdminOpenids: options.superAdminOpenids || 'admin_openid,another_admin',
    tokenSecret: options.tokenSecret === undefined ? 'manage-merchant-test-secret' : options.tokenSecret,
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
      getTokenSecret: () => state.tokenSecret,
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

function createWebToken(options = {}) {
  return createSignedToken({
    role: options.role || 'super_admin',
    secret: options.secret || 'manage-merchant-test-secret',
    now: options.now || new Date('2026-06-25T10:00:00.000Z'),
    ttlMinutes: options.ttlMinutes || 60,
    nonce: options.nonce || 'manage-merchant-test-nonce'
  }).token
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

test('web valid admin token can list merchants without openid', async () => {
  const { deps } = createDependencies({
    openid: ''
  })
  const handler = createManageMerchantHandler(deps)

  const result = await handler({
    action: 'list',
    admin_token: createWebToken()
  })

  assert.equal(result.success, true)
  assert.equal(result.data.list.length, 1)
  assert.equal(result.data.total, 1)
  assert.equal(result.data.list[0].merchant_id, 'merchant_001')
})

test('web empty admin token cannot list merchants', async () => {
  const { deps } = createDependencies({
    openid: ''
  })
  const handler = createManageMerchantHandler(deps)

  const result = await handler({
    action: 'list',
    admin_token: ''
  })

  assert.equal(result.success, false)
  assert.equal(result.code, 'UNAUTHORIZED')
})

test('web tampered admin token cannot list merchants', async () => {
  const { deps } = createDependencies({
    openid: ''
  })
  const handler = createManageMerchantHandler(deps)

  const result = await handler({
    action: 'list',
    admin_token: `${createWebToken()}x`
  })

  assert.equal(result.success, false)
  assert.equal(result.code, 'UNAUTHORIZED')
})

test('web expired admin token cannot list merchants', async () => {
  const { deps } = createDependencies({
    openid: ''
  })
  const handler = createManageMerchantHandler(deps)

  const result = await handler({
    action: 'list',
    admin_token: createWebToken({
      now: new Date('2026-06-25T08:00:00.000Z'),
      ttlMinutes: 30
    })
  })

  assert.equal(result.success, false)
  assert.equal(result.code, 'TOKEN_EXPIRED')
})

test('web non super admin token cannot list merchants', async () => {
  const { deps } = createDependencies({
    openid: ''
  })
  const handler = createManageMerchantHandler(deps)

  const result = await handler({
    action: 'list',
    admin_token: createWebToken({
      role: 'viewer'
    })
  })

  assert.equal(result.success, false)
  assert.equal(result.code, 'UNAUTHORIZED')
})

test('web admin token in http string body can list merchants', async () => {
  const { deps } = createDependencies({
    openid: ''
  })
  const handler = createManageMerchantHandler(deps)

  const result = await handler({
    body: JSON.stringify({
      action: 'list',
      admin_token: createWebToken()
    })
  })

  assert.equal(result.success, true)
  assert.equal(result.data.list.length, 1)
})

test('web admin token in http object body can list merchants', async () => {
  const { deps } = createDependencies({
    openid: ''
  })
  const handler = createManageMerchantHandler(deps)

  const result = await handler({
    body: {
      action: 'list',
      admin_token: createWebToken()
    }
  })

  assert.equal(result.success, true)
  assert.equal(result.data.list.length, 1)
})

test('web admin token in query string parameters can list merchants', async () => {
  const { deps } = createDependencies({
    openid: ''
  })
  const handler = createManageMerchantHandler(deps)

  const result = await handler({
    queryStringParameters: {
      action: 'list',
      admin_token: createWebToken()
    }
  })

  assert.equal(result.success, true)
  assert.equal(result.data.list.length, 1)
})

test('invalid http body json does not crash', async () => {
  const { deps } = createDependencies({
    openid: ''
  })
  const handler = createManageMerchantHandler(deps)

  const result = await handler({
    body: '{"action":'
  })

  assert.equal(result.success, false)
  assert.equal(result.code, 'INVALID_PARAMS')
})

test('web valid admin token can create merchant', async () => {
  const { state, deps } = createDependencies({
    openid: ''
  })
  const handler = createManageMerchantHandler(deps)

  const result = await handler({
    action: 'create',
    admin_token: createWebToken(),
    payload: {
      merchant_id: 'web_create',
      name: 'Web 私厨',
      short_name: 'Web 私厨',
      owner_openid: 'web_owner_openid',
      notice: 'Web 后台创建'
    }
  })

  const merchant = state.merchants.find((item) => item.merchant_id === 'web_create')
  assert.equal(result.success, true)
  assert.equal(result.code, 'SUCCESS')
  assert.equal(result.data.merchant.merchant_id, 'web_create')
  assert.equal(merchant.name, 'Web 私厨')
  assert.equal(merchant.status, 'active')
})

test('web invalid tokens cannot create merchant', async () => {
  const { state, deps } = createDependencies({
    openid: ''
  })
  const handler = createManageMerchantHandler(deps)

  const requests = [
    {
      admin_token: '',
      merchant_id: 'web_empty_token'
    },
    {
      admin_token: `${createWebToken()}x`,
      merchant_id: 'web_tampered_token'
    },
    {
      admin_token: createWebToken({
        now: new Date('2026-06-25T08:00:00.000Z'),
        ttlMinutes: 30
      }),
      merchant_id: 'web_expired_token'
    },
    {
      admin_token: createWebToken({
        role: 'viewer'
      }),
      merchant_id: 'web_viewer_token'
    }
  ]

  for (const request of requests) {
    const result = await handler({
      action: 'create',
      admin_token: request.admin_token,
      payload: {
        merchant_id: request.merchant_id,
        name: '不应创建'
      }
    })

    assert.equal(result.success, false)
  }

  assert.equal(state.merchants.length, 1)
})

test('web create validates required merchant fields', async () => {
  const { deps } = createDependencies({
    openid: ''
  })
  const handler = createManageMerchantHandler(deps)

  const missingMerchantId = await handler({
    action: 'create',
    admin_token: createWebToken(),
    payload: {
      name: '缺少 ID'
    }
  })

  const missingName = await handler({
    action: 'create',
    admin_token: createWebToken(),
    payload: {
      merchant_id: 'web_missing_name'
    }
  })

  const duplicate = await handler({
    action: 'create',
    admin_token: createWebToken(),
    payload: {
      merchant_id: 'merchant_001',
      name: '重复商户'
    }
  })

  assert.equal(missingMerchantId.success, false)
  assert.equal(missingMerchantId.code, 'VALIDATION_ERROR')
  assert.equal(missingName.success, false)
  assert.equal(missingName.code, 'VALIDATION_ERROR')
  assert.equal(duplicate.success, false)
  assert.equal(duplicate.code, 'ALREADY_EXISTS')
})

test('web create cannot override system merchant fields', async () => {
  const { state, deps } = createDependencies({
    openid: ''
  })
  const handler = createManageMerchantHandler(deps)

  const result = await handler({
    action: 'create',
    admin_token: createWebToken(),
    payload: {
      merchant_id: 'web_clean',
      name: '字段安全商户',
      status: 'disabled',
      created_at: new Date('2020-01-01T00:00:00.000Z'),
      updated_at: new Date('2020-01-01T00:00:00.000Z'),
      unknown_field: 'should_not_write'
    }
  })

  const merchant = state.merchants.find((item) => item.merchant_id === 'web_clean')
  assert.equal(result.success, true)
  assert.equal(merchant.status, 'active')
  assert.equal(merchant.created_at, state.now)
  assert.equal(merchant.updated_at, state.now)
  assert.equal(Object.prototype.hasOwnProperty.call(merchant, 'unknown_field'), false)
})

test('web valid admin token can update merchant basic info', async () => {
  const { state, deps } = createDependencies({
    openid: ''
  })
  const handler = createManageMerchantHandler(deps)

  const result = await handler({
    action: 'update',
    admin_token: createWebToken(),
    payload: {
      merchant_id: 'merchant_001',
      name: 'Web 更新商户',
      short_name: 'Web 更新',
      owner_openid: 'web_updated_owner',
      notice: 'Web 后台更新'
    }
  })

  const merchant = state.merchants.find((item) => item.merchant_id === 'merchant_001')
  assert.equal(result.success, true)
  assert.equal(result.code, 'SUCCESS')
  assert.equal(merchant.name, 'Web 更新商户')
  assert.equal(merchant.short_name, 'Web 更新')
  assert.equal(merchant.owner_openid, 'web_updated_owner')
  assert.equal(merchant.notice, 'Web 后台更新')
  assert.equal(merchant.status, 'active')
  assert.equal(merchant.updated_at, state.now)
})

test('web invalid tokens cannot update merchant', async () => {
  const { state, deps } = createDependencies({
    openid: ''
  })
  const handler = createManageMerchantHandler(deps)

  const requests = [
    {
      admin_token: ''
    },
    {
      admin_token: `${createWebToken()}x`
    },
    {
      admin_token: createWebToken({
        now: new Date('2026-06-25T08:00:00.000Z'),
        ttlMinutes: 30
      })
    },
    {
      admin_token: createWebToken({
        role: 'viewer'
      })
    }
  ]

  for (const request of requests) {
    const result = await handler({
      action: 'update',
      admin_token: request.admin_token,
      payload: {
        merchant_id: 'merchant_001',
        name: '不应更新'
      }
    })

    assert.equal(result.success, false)
  }

  assert.equal(state.merchants[0].name, '小厨食堂')
})

test('web update validates required merchant fields', async () => {
  const { deps } = createDependencies({
    openid: ''
  })
  const handler = createManageMerchantHandler(deps)

  const missingMerchantId = await handler({
    action: 'update',
    admin_token: createWebToken(),
    payload: {
      name: '缺少 ID'
    }
  })

  const missingName = await handler({
    action: 'update',
    admin_token: createWebToken(),
    payload: {
      merchant_id: 'merchant_001'
    }
  })

  const notFound = await handler({
    action: 'update',
    admin_token: createWebToken(),
    payload: {
      merchant_id: 'missing_merchant',
      name: '不存在商户'
    }
  })

  assert.equal(missingMerchantId.success, false)
  assert.equal(missingMerchantId.code, 'INVALID_PARAMS')
  assert.equal(missingName.success, false)
  assert.equal(missingName.code, 'VALIDATION_ERROR')
  assert.equal(notFound.success, false)
  assert.equal(notFound.code, 'NOT_FOUND')
})

test('web update cannot override protected merchant fields', async () => {
  const { state, deps } = createDependencies({
    openid: ''
  })
  const handler = createManageMerchantHandler(deps)

  const requests = [
    {
      payload: {
        merchant_id: 'merchant_001',
        next_merchant_id: 'changed_id',
        name: '尝试改 ID'
      }
    },
    {
      payload: {
        merchant_id: 'merchant_001',
        name: '尝试改状态',
        status: 'disabled'
      }
    },
    {
      payload: {
        merchant_id: 'merchant_001',
        name: '尝试改时间',
        created_at: new Date('2020-01-01T00:00:00.000Z')
      }
    },
    {
      payload: {
        merchant_id: 'merchant_001',
        name: '尝试改成员数',
        members_count: 999
      }
    }
  ]

  for (const request of requests) {
    const result = await handler({
      action: 'update',
      admin_token: createWebToken(),
      payload: request.payload
    })
    assert.equal(result.success, false)
    assert.equal(result.code, 'VALIDATION_ERROR')
  }

  assert.equal(state.merchants[0].merchant_id, 'merchant_001')
  assert.equal(state.merchants[0].status, 'active')
  assert.equal(state.merchants[0].members_count, undefined)
  assert.equal(state.merchants[0].name, '小厨食堂')
})

test('web admin token still cannot enable or disable merchants', async () => {
  const { state, deps } = createDependencies({
    openid: ''
  })
  const handler = createManageMerchantHandler(deps)

  const actions = [
    {
      action: 'enable',
      payload: {
        merchant_id: 'merchant_001'
      }
    },
    {
      action: 'disable',
      payload: {
        merchant_id: 'merchant_001'
      }
    }
  ]

  for (const request of actions) {
    const result = await handler({
      ...request,
      admin_token: createWebToken()
    })
    assert.equal(result.success, false)
    assert.equal(result.code, 'FORBIDDEN')
  }

  assert.equal(state.merchants[0].name, '小厨食堂')
  assert.equal(state.merchants[0].status, 'active')
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
