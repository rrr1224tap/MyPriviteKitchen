const test = require('node:test')
const assert = require('node:assert/strict')

const { createManageMerchantStaffHandler } = require('./merchant-staff-service')
const {
  createSignedToken
} = require('../webAdminAuth/web-admin-auth-service')

const FIXED_NOW = new Date('2026-06-25T10:00:00.000Z')

function createDependencies(options = {}) {
  const state = {
    openid: options.openid || 'admin_openid',
    superAdminOpenids: options.superAdminOpenids || 'admin_openid',
    tokenSecret: options.tokenSecret === undefined ? 'merchant-staff-test-secret' : options.tokenSecret,
    now: options.now || FIXED_NOW,
    codeIndex: 1,
    merchants: options.merchants || [
      {
        _id: 'doc_xiaochu',
        merchant_id: 'xiaochu',
        name: '小厨食堂',
        status: 'active'
      }
    ],
    staff: options.staff || [
      {
        _id: 'staff_001',
        merchant_id: 'xiaochu',
        openid: 'staff_openid_123456',
        role: 'staff',
        status: 'active',
        nickname: '小厨成员',
        remark: '测试成员',
        created_at: new Date('2026-06-20T10:00:00.000Z'),
        updated_at: new Date('2026-06-20T10:00:00.000Z')
      }
    ],
    invites: options.invites || []
  }

  return {
    state,
    deps: {
      getOpenid: () => state.openid,
      getSuperAdminOpenids: () => state.superAdminOpenids,
      getTokenSecret: () => state.tokenSecret,
      now: () => state.now,
      createInviteCode: () => `XK7M2Q${state.codeIndex++ === 1 ? '8' : '9'}A`,
      findMerchantByMerchantId: async (merchantId) => {
        return state.merchants.find((merchant) => merchant.merchant_id === merchantId) || null
      },
      findStaffByMerchantId: async (merchantId) => {
        return state.staff.filter((item) => item.merchant_id === merchantId)
      },
      findStaffById: async (staffId) => {
        return state.staff.find((item) => item._id === staffId) || null
      },
      updateStaff: async ({ staff_id, updateData }) => {
        const staff = state.staff.find((item) => item._id === staff_id)
        if (!staff) {
          return null
        }
        Object.assign(staff, updateData)
        return staff
      },
      findInvitesByMerchantId: async (merchantId) => {
        return state.invites.filter((invite) => invite.merchant_id === merchantId)
      },
      findInviteByCode: async (code) => {
        return state.invites.find((invite) => invite.code === code) || null
      },
      createInvite: async (invite) => {
        const record = {
          _id: `invite_${invite.code}`,
          ...invite
        }
        state.invites.push(record)
        return record
      },
      updateInvite: async ({ code, updateData }) => {
        const invite = state.invites.find((item) => item.code === code)
        if (!invite) {
          return null
        }
        Object.assign(invite, updateData)
        return invite
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
    secret: options.secret || 'merchant-staff-test-secret',
    now: options.now || FIXED_NOW,
    ttlMinutes: options.ttlMinutes || 60,
    nonce: options.nonce || 'merchant-staff-test-nonce'
  }).token
}

test('super admin can list merchant staff', async () => {
  const { deps } = createDependencies()
  const handler = createManageMerchantStaffHandler(deps)

  const result = await handler({
    action: 'listStaff',
    payload: {
      merchant_id: 'xiaochu'
    }
  })

  assert.equal(result.success, true)
  assert.equal(result.data.list.length, 1)
  assert.equal(result.data.list[0].masked_openid, 'staf****3456')
})

test('non super admin cannot list staff', async () => {
  const { deps } = createDependencies({
    openid: 'normal_user'
  })
  const handler = createManageMerchantStaffHandler(deps)

  const result = await handler({
    action: 'listStaff',
    payload: {
      merchant_id: 'xiaochu'
    }
  })

  assert.equal(result.success, false)
  assert.equal(result.code, 'FORBIDDEN')
})

test('web valid admin token can list merchant staff without openid', async () => {
  const { deps } = createDependencies({
    openid: ''
  })
  const handler = createManageMerchantStaffHandler(deps)

  const result = await handler({
    action: 'listStaff',
    merchant_id: 'xiaochu',
    admin_token: createWebToken()
  })

  assert.equal(result.success, true)
  assert.equal(result.data.list.length, 1)
  assert.equal(result.data.list[0].merchant_id, 'xiaochu')
  assert.equal(result.data.list[0].masked_openid, 'staf****3456')
})

test('web invalid tokens cannot list merchant staff', async () => {
  const invalidRequests = [
    {
      admin_token: ''
    },
    {
      admin_token: `${createWebToken()}x`
    },
    {
      admin_token: createWebToken({
        now: new Date('2026-06-24T10:00:00.000Z'),
        ttlMinutes: 60
      })
    },
    {
      admin_token: createWebToken({
        role: 'viewer'
      })
    }
  ]

  for (const request of invalidRequests) {
    const { deps } = createDependencies({
      openid: ''
    })
    const handler = createManageMerchantStaffHandler(deps)

    const result = await handler({
      action: 'listStaff',
      merchant_id: 'xiaochu',
      admin_token: request.admin_token
    })

    assert.equal(result.success, false)
    assert.ok(['UNAUTHORIZED', 'TOKEN_EXPIRED'].includes(result.code))
  }
})

test('web admin token in http string body can list merchant staff', async () => {
  const { deps } = createDependencies({
    openid: ''
  })
  const handler = createManageMerchantStaffHandler(deps)

  const result = await handler({
    body: JSON.stringify({
      action: 'listStaff',
      merchant_id: 'xiaochu',
      admin_token: createWebToken()
    })
  })

  assert.equal(result.success, true)
  assert.equal(result.data.total, 1)
})

test('web admin token in http object body can list merchant staff', async () => {
  const { deps } = createDependencies({
    openid: ''
  })
  const handler = createManageMerchantStaffHandler(deps)

  const result = await handler({
    body: {
      action: 'listStaff',
      merchant_id: 'xiaochu',
      admin_token: createWebToken()
    }
  })

  assert.equal(result.success, true)
  assert.equal(result.data.total, 1)
})

test('web admin token in query string parameters can list merchant staff', async () => {
  const { deps } = createDependencies({
    openid: ''
  })
  const handler = createManageMerchantStaffHandler(deps)

  const result = await handler({
    queryStringParameters: {
      action: 'listStaff',
      merchant_id: 'xiaochu',
      admin_token: createWebToken()
    }
  })

  assert.equal(result.success, true)
  assert.equal(result.data.total, 1)
})

test('web valid admin token can list merchant invites without openid', async () => {
  const { deps } = createDependencies({
    openid: '',
    invites: [
      {
        _id: 'invite_001',
        code: 'XK7M2Q8A',
        merchant_id: 'xiaochu',
        role: 'staff',
        status: 'unused',
        created_by_openid: 'admin_openid',
        used_by_openid: '',
        expires_at: new Date('2026-07-02T10:00:00.000Z'),
        created_at: FIXED_NOW,
        updated_at: FIXED_NOW
      }
    ]
  })
  const handler = createManageMerchantStaffHandler(deps)

  const result = await handler({
    action: 'listInvites',
    merchant_id: 'xiaochu',
    admin_token: createWebToken()
  })

  assert.equal(result.success, true)
  assert.equal(result.data.total, 1)
  assert.equal(result.data.list[0].code, 'XK7M2Q8A')
  assert.equal(result.data.list[0].status, 'unused')
  assert.equal(result.data.list[0].created_by_openid, 'admin_openid')
})

test('web invalid tokens cannot list merchant invites', async () => {
  const invalidRequests = [
    {
      admin_token: ''
    },
    {
      admin_token: `${createWebToken()}x`
    },
    {
      admin_token: createWebToken({
        now: new Date('2026-06-24T10:00:00.000Z'),
        ttlMinutes: 60
      })
    },
    {
      admin_token: createWebToken({
        role: 'viewer'
      })
    }
  ]

  for (const request of invalidRequests) {
    const { deps } = createDependencies({
      openid: '',
      invites: [
        {
          code: 'XK7M2Q8A',
          merchant_id: 'xiaochu',
          role: 'staff',
          status: 'unused'
        }
      ]
    })
    const handler = createManageMerchantStaffHandler(deps)

    const result = await handler({
      action: 'listInvites',
      merchant_id: 'xiaochu',
      admin_token: request.admin_token
    })

    assert.equal(result.success, false)
    assert.ok(['UNAUTHORIZED', 'TOKEN_EXPIRED'].includes(result.code))
  }
})

test('web admin token in http string body can list merchant invites', async () => {
  const { deps } = createDependencies({
    openid: '',
    invites: [
      {
        code: 'XK7M2Q8A',
        merchant_id: 'xiaochu',
        role: 'staff',
        status: 'unused'
      }
    ]
  })
  const handler = createManageMerchantStaffHandler(deps)

  const result = await handler({
    body: JSON.stringify({
      action: 'listInvites',
      merchant_id: 'xiaochu',
      admin_token: createWebToken()
    })
  })

  assert.equal(result.success, true)
  assert.equal(result.data.total, 1)
})

test('web admin token in http object body can list merchant invites', async () => {
  const { deps } = createDependencies({
    openid: '',
    invites: [
      {
        code: 'XK7M2Q8A',
        merchant_id: 'xiaochu',
        role: 'staff',
        status: 'unused'
      }
    ]
  })
  const handler = createManageMerchantStaffHandler(deps)

  const result = await handler({
    body: {
      action: 'listInvites',
      merchant_id: 'xiaochu',
      admin_token: createWebToken()
    }
  })

  assert.equal(result.success, true)
  assert.equal(result.data.total, 1)
})

test('web admin token in query string parameters can list merchant invites', async () => {
  const { deps } = createDependencies({
    openid: '',
    invites: [
      {
        code: 'XK7M2Q8A',
        merchant_id: 'xiaochu',
        role: 'staff',
        status: 'unused'
      }
    ]
  })
  const handler = createManageMerchantStaffHandler(deps)

  const result = await handler({
    queryStringParameters: {
      action: 'listInvites',
      merchant_id: 'xiaochu',
      admin_token: createWebToken()
    }
  })

  assert.equal(result.success, true)
  assert.equal(result.data.total, 1)
})

test('list invites requires merchant_id', async () => {
  const { deps } = createDependencies()
  const handler = createManageMerchantStaffHandler(deps)

  const result = await handler({
    action: 'listInvites',
    payload: {}
  })

  assert.equal(result.success, false)
  assert.equal(result.code, 'INVALID_PARAMS')
})

test('invalid http body json does not crash', async () => {
  const { deps } = createDependencies({
    openid: ''
  })
  const handler = createManageMerchantStaffHandler(deps)

  const result = await handler({
    body: '{"action":'
  })

  assert.equal(result.success, false)
  assert.equal(result.code, 'INVALID_PARAMS')
})

test('web admin token cannot update staff status in current phase', async () => {
  const blockedActions = [
    {
      action: 'enableStaff',
      payload: {
        staff_id: 'staff_001'
      }
    },
    {
      action: 'disableStaff',
      payload: {
        staff_id: 'staff_001'
      }
    }
  ]

  for (const request of blockedActions) {
    const { state, deps } = createDependencies({
      openid: '',
      invites: [
        {
          code: 'XK7M2Q8A',
          merchant_id: 'xiaochu',
          role: 'staff',
          status: 'unused'
        }
      ]
    })
    const handler = createManageMerchantStaffHandler(deps)

    const result = await handler({
      action: request.action,
      payload: request.payload,
      admin_token: createWebToken()
    })

    assert.equal(result.success, false)
    assert.equal(result.code, 'FORBIDDEN')
    assert.equal(state.staff[0].status, 'active')
  }
})

test('web valid admin token can disable merchant invite without openid', async () => {
  const originalCreatedAt = new Date('2026-06-20T10:00:00.000Z')
  const originalExpiresAt = new Date('2026-07-02T10:00:00.000Z')
  const { state, deps } = createDependencies({
    openid: '',
    invites: [
      {
        _id: 'invite_001',
        code: 'XK7M2Q8A',
        merchant_id: 'xiaochu',
        role: 'staff',
        status: 'unused',
        created_by_openid: 'admin_openid',
        used_by_openid: '',
        used_at: null,
        expires_at: originalExpiresAt,
        created_at: originalCreatedAt,
        updated_at: originalCreatedAt
      }
    ]
  })
  const handler = createManageMerchantStaffHandler(deps)

  const result = await handler({
    action: 'disableInvite',
    merchant_id: 'xiaochu',
    code: 'XK7M2Q8A',
    admin_token: createWebToken()
  })

  assert.equal(result.success, true)
  assert.equal(result.data.invite.code, 'XK7M2Q8A')
  assert.equal(result.data.invite.status, 'disabled')
  assert.equal(state.invites[0].status, 'disabled')
  assert.equal(state.invites[0].updated_at, FIXED_NOW)
  assert.equal(state.invites[0].role, 'staff')
  assert.equal(state.invites[0].created_at, originalCreatedAt)
  assert.equal(state.invites[0].used_at, null)
  assert.equal(state.invites[0].used_by_openid, '')
  assert.equal(state.invites[0].created_by_openid, 'admin_openid')
  assert.equal(state.invites[0].expires_at, originalExpiresAt)
})

test('web empty token cannot disable merchant invite', async () => {
  const { state, deps } = createDependencies({
    openid: '',
    invites: [
      {
        code: 'XK7M2Q8A',
        merchant_id: 'xiaochu',
        role: 'staff',
        status: 'unused'
      }
    ]
  })
  const handler = createManageMerchantStaffHandler(deps)

  const result = await handler({
    action: 'disableInvite',
    merchant_id: 'xiaochu',
    code: 'XK7M2Q8A',
    admin_token: ''
  })

  assert.equal(result.success, false)
  assert.equal(result.code, 'UNAUTHORIZED')
  assert.equal(state.invites[0].status, 'unused')
})

test('web tampered token cannot disable merchant invite', async () => {
  const { state, deps } = createDependencies({
    openid: '',
    invites: [
      {
        code: 'XK7M2Q8A',
        merchant_id: 'xiaochu',
        role: 'staff',
        status: 'unused'
      }
    ]
  })
  const handler = createManageMerchantStaffHandler(deps)

  const result = await handler({
    action: 'disableInvite',
    merchant_id: 'xiaochu',
    code: 'XK7M2Q8A',
    admin_token: `${createWebToken()}x`
  })

  assert.equal(result.success, false)
  assert.equal(result.code, 'UNAUTHORIZED')
  assert.equal(state.invites[0].status, 'unused')
})

test('web expired token cannot disable merchant invite', async () => {
  const { state, deps } = createDependencies({
    openid: '',
    invites: [
      {
        code: 'XK7M2Q8A',
        merchant_id: 'xiaochu',
        role: 'staff',
        status: 'unused'
      }
    ]
  })
  const handler = createManageMerchantStaffHandler(deps)

  const result = await handler({
    action: 'disableInvite',
    merchant_id: 'xiaochu',
    code: 'XK7M2Q8A',
    admin_token: createWebToken({
      now: new Date('2026-06-24T10:00:00.000Z'),
      ttlMinutes: 60
    })
  })

  assert.equal(result.success, false)
  assert.equal(result.code, 'TOKEN_EXPIRED')
  assert.equal(state.invites[0].status, 'unused')
})

test('web non super admin role cannot disable merchant invite', async () => {
  const { state, deps } = createDependencies({
    openid: '',
    invites: [
      {
        code: 'XK7M2Q8A',
        merchant_id: 'xiaochu',
        role: 'staff',
        status: 'unused'
      }
    ]
  })
  const handler = createManageMerchantStaffHandler(deps)

  const result = await handler({
    action: 'disableInvite',
    merchant_id: 'xiaochu',
    code: 'XK7M2Q8A',
    admin_token: createWebToken({
      role: 'viewer'
    })
  })

  assert.equal(result.success, false)
  assert.equal(result.code, 'UNAUTHORIZED')
  assert.equal(state.invites[0].status, 'unused')
})

test('web admin token in http string body can disable merchant invite', async () => {
  const { state, deps } = createDependencies({
    openid: '',
    invites: [
      {
        code: 'XK7M2Q8A',
        merchant_id: 'xiaochu',
        role: 'staff',
        status: 'unused'
      }
    ]
  })
  const handler = createManageMerchantStaffHandler(deps)

  const result = await handler({
    body: JSON.stringify({
      action: 'disableInvite',
      merchant_id: 'xiaochu',
      code: 'XK7M2Q8A',
      admin_token: createWebToken()
    })
  })

  assert.equal(result.success, true)
  assert.equal(state.invites[0].status, 'disabled')
})

test('web admin token in http object body can disable merchant invite', async () => {
  const { state, deps } = createDependencies({
    openid: '',
    invites: [
      {
        code: 'XK7M2Q8A',
        merchant_id: 'xiaochu',
        role: 'staff',
        status: 'unused'
      }
    ]
  })
  const handler = createManageMerchantStaffHandler(deps)

  const result = await handler({
    body: {
      action: 'disableInvite',
      merchant_id: 'xiaochu',
      code: 'XK7M2Q8A',
      admin_token: createWebToken()
    }
  })

  assert.equal(result.success, true)
  assert.equal(state.invites[0].status, 'disabled')
})

test('web admin token in query string parameters can disable merchant invite', async () => {
  const { state, deps } = createDependencies({
    openid: '',
    invites: [
      {
        code: 'XK7M2Q8A',
        merchant_id: 'xiaochu',
        role: 'staff',
        status: 'unused'
      }
    ]
  })
  const handler = createManageMerchantStaffHandler(deps)

  const result = await handler({
    queryStringParameters: {
      action: 'disableInvite',
      merchant_id: 'xiaochu',
      code: 'XK7M2Q8A',
      admin_token: createWebToken()
    }
  })

  assert.equal(result.success, true)
  assert.equal(state.invites[0].status, 'disabled')
})

test('disable invite requires merchant_id', async () => {
  const { state, deps } = createDependencies({
    openid: '',
    invites: [
      {
        code: 'XK7M2Q8A',
        merchant_id: 'xiaochu',
        role: 'staff',
        status: 'unused'
      }
    ]
  })
  const handler = createManageMerchantStaffHandler(deps)

  const result = await handler({
    action: 'disableInvite',
    code: 'XK7M2Q8A',
    admin_token: createWebToken()
  })

  assert.equal(result.success, false)
  assert.equal(result.code, 'INVALID_PARAMS')
  assert.equal(state.invites[0].status, 'unused')
})

test('disable invite requires code', async () => {
  const { deps } = createDependencies({
    openid: ''
  })
  const handler = createManageMerchantStaffHandler(deps)

  const result = await handler({
    action: 'disableInvite',
    merchant_id: 'xiaochu',
    admin_token: createWebToken()
  })

  assert.equal(result.success, false)
  assert.equal(result.code, 'INVALID_PARAMS')
})

test('disable invite fails when invite does not exist', async () => {
  const { deps } = createDependencies({
    openid: ''
  })
  const handler = createManageMerchantStaffHandler(deps)

  const result = await handler({
    action: 'disableInvite',
    merchant_id: 'xiaochu',
    code: 'NOINVITE',
    admin_token: createWebToken()
  })

  assert.equal(result.success, false)
  assert.equal(result.code, 'NOT_FOUND')
})

test('disable invite cannot update another merchant invite', async () => {
  const { state, deps } = createDependencies({
    openid: '',
    merchants: [
      {
        _id: 'doc_xiaochu',
        merchant_id: 'xiaochu',
        name: 'xiaochu',
        status: 'active'
      },
      {
        _id: 'doc_other',
        merchant_id: 'other',
        name: 'other',
        status: 'active'
      }
    ],
    invites: [
      {
        code: 'XK7M2Q8A',
        merchant_id: 'other',
        role: 'staff',
        status: 'unused'
      }
    ]
  })
  const handler = createManageMerchantStaffHandler(deps)

  const result = await handler({
    action: 'disableInvite',
    merchant_id: 'xiaochu',
    code: 'XK7M2Q8A',
    admin_token: createWebToken()
  })

  assert.equal(result.success, false)
  assert.equal(result.code, 'FORBIDDEN')
  assert.equal(state.invites[0].status, 'unused')
})

test('web valid admin token can create invite without openid', async () => {
  const { state, deps } = createDependencies({
    openid: ''
  })
  const handler = createManageMerchantStaffHandler(deps)

  const result = await handler({
    action: 'createInvite',
    merchant_id: 'xiaochu',
    role: 'staff',
    admin_token: createWebToken()
  })

  assert.equal(result.success, true)
  assert.equal(state.invites.length, 1)
  assert.match(result.data.invite.code, /^[A-HJ-NP-Z2-9]{8}$/)
  assert.equal(result.data.invite.role, 'staff')
  assert.equal(result.data.invite.status, 'unused')
  assert.equal(result.data.invite.created_by_openid, 'web_super_admin')
  assert.equal(result.data.invite.used_by_openid, '')
})

test('web invalid tokens cannot create invite', async () => {
  const invalidRequests = [
    {
      admin_token: ''
    },
    {
      admin_token: `${createWebToken()}x`
    },
    {
      admin_token: createWebToken({
        now: new Date('2026-06-24T10:00:00.000Z'),
        ttlMinutes: 60
      })
    },
    {
      admin_token: createWebToken({
        role: 'viewer'
      })
    }
  ]

  for (const request of invalidRequests) {
    const { state, deps } = createDependencies({
      openid: ''
    })
    const handler = createManageMerchantStaffHandler(deps)

    const result = await handler({
      action: 'createInvite',
      merchant_id: 'xiaochu',
      role: 'staff',
      admin_token: request.admin_token
    })

    assert.equal(result.success, false)
    assert.ok(['UNAUTHORIZED', 'TOKEN_EXPIRED'].includes(result.code))
    assert.equal(state.invites.length, 0)
  }
})

test('web admin token in http string body can create invite', async () => {
  const { state, deps } = createDependencies({
    openid: ''
  })
  const handler = createManageMerchantStaffHandler(deps)

  const result = await handler({
    body: JSON.stringify({
      action: 'createInvite',
      merchant_id: 'xiaochu',
      role: 'staff',
      admin_token: createWebToken()
    })
  })

  assert.equal(result.success, true)
  assert.equal(state.invites.length, 1)
})

test('web admin token in http object body can create invite', async () => {
  const { state, deps } = createDependencies({
    openid: ''
  })
  const handler = createManageMerchantStaffHandler(deps)

  const result = await handler({
    body: {
      action: 'createInvite',
      merchant_id: 'xiaochu',
      role: 'owner',
      admin_token: createWebToken()
    }
  })

  assert.equal(result.success, true)
  assert.equal(state.invites.length, 1)
  assert.equal(result.data.invite.role, 'owner')
})

test('web admin token in query string parameters can create invite', async () => {
  const { state, deps } = createDependencies({
    openid: ''
  })
  const handler = createManageMerchantStaffHandler(deps)

  const result = await handler({
    queryStringParameters: {
      action: 'createInvite',
      merchant_id: 'xiaochu',
      role: 'staff',
      admin_token: createWebToken()
    }
  })

  assert.equal(result.success, true)
  assert.equal(state.invites.length, 1)
})

test('web create invite rejects invalid role', async () => {
  const { state, deps } = createDependencies({
    openid: ''
  })
  const handler = createManageMerchantStaffHandler(deps)

  const result = await handler({
    action: 'createInvite',
    merchant_id: 'xiaochu',
    role: 'manager',
    admin_token: createWebToken()
  })

  assert.equal(result.success, false)
  assert.equal(result.code, 'VALIDATION_ERROR')
  assert.equal(state.invites.length, 0)
})

test('web create invite ignores unsafe client supplied invite fields', async () => {
  const { state, deps } = createDependencies({
    openid: ''
  })
  const handler = createManageMerchantStaffHandler(deps)

  const result = await handler({
    action: 'createInvite',
    merchant_id: 'xiaochu',
    role: 'staff',
    code: 'CLIENT01',
    status: 'used',
    used_by_openid: 'attacker_openid',
    admin_token: createWebToken()
  })

  assert.equal(result.success, true)
  assert.equal(state.invites.length, 1)
  assert.notEqual(result.data.invite.code, 'CLIENT01')
  assert.equal(result.data.invite.status, 'unused')
  assert.equal(result.data.invite.used_by_openid, '')
})

test('super admin can create invite with default unused status and seven day expiry', async () => {
  const { state, deps } = createDependencies()
  const handler = createManageMerchantStaffHandler(deps)

  const result = await handler({
    action: 'createInvite',
    payload: {
      merchant_id: 'xiaochu',
      role: 'staff'
    }
  })

  assert.equal(result.success, true)
  assert.match(result.data.invite.code, /^[A-HJ-NP-Z2-9]{8}$/)
  assert.equal(result.data.invite.status, 'unused')
  assert.equal(result.data.invite.role, 'staff')
  assert.equal(result.data.invite.created_by_openid, 'admin_openid')
  assert.equal(result.data.invite.expires_at.getTime(), FIXED_NOW.getTime() + 7 * 24 * 60 * 60 * 1000)
  assert.equal(state.invites.length, 1)
})

test('non super admin cannot create invite', async () => {
  const { state, deps } = createDependencies({
    openid: 'normal_user'
  })
  const handler = createManageMerchantStaffHandler(deps)

  const result = await handler({
    action: 'createInvite',
    payload: {
      merchant_id: 'xiaochu',
      role: 'staff'
    }
  })

  assert.equal(result.success, false)
  assert.equal(result.code, 'FORBIDDEN')
  assert.equal(state.invites.length, 0)
})

test('super admin can list invites', async () => {
  const { deps } = createDependencies({
    invites: [
      {
        _id: 'invite_001',
        code: 'XK7M2Q8A',
        merchant_id: 'xiaochu',
        role: 'staff',
        status: 'unused',
        created_by_openid: 'admin_openid',
        expires_at: new Date('2026-07-02T10:00:00.000Z'),
        created_at: FIXED_NOW,
        updated_at: FIXED_NOW
      }
    ]
  })
  const handler = createManageMerchantStaffHandler(deps)

  const result = await handler({
    action: 'listInvites',
    payload: {
      merchant_id: 'xiaochu'
    }
  })

  assert.equal(result.success, true)
  assert.equal(result.data.list[0].code, 'XK7M2Q8A')
})

test('super admin can disable invite', async () => {
  const { state, deps } = createDependencies({
    invites: [
      {
        code: 'XK7M2Q8A',
        merchant_id: 'xiaochu',
        role: 'staff',
        status: 'unused'
      }
    ]
  })
  const handler = createManageMerchantStaffHandler(deps)

  const result = await handler({
    action: 'disableInvite',
    payload: {
      merchant_id: 'xiaochu',
      code: 'XK7M2Q8A'
    }
  })

  assert.equal(result.success, true)
  assert.equal(state.invites[0].status, 'disabled')
})

test('non super admin cannot disable invite', async () => {
  const { state, deps } = createDependencies({
    openid: 'normal_user',
    invites: [
      {
        code: 'XK7M2Q8A',
        merchant_id: 'xiaochu',
        role: 'staff',
        status: 'unused'
      }
    ]
  })
  const handler = createManageMerchantStaffHandler(deps)

  const result = await handler({
    action: 'disableInvite',
    payload: {
      code: 'XK7M2Q8A'
    }
  })

  assert.equal(result.success, false)
  assert.equal(result.code, 'FORBIDDEN')
  assert.equal(state.invites[0].status, 'unused')
})

test('super admin can disable and enable staff', async () => {
  const { state, deps } = createDependencies()
  const handler = createManageMerchantStaffHandler(deps)

  const disableResult = await handler({
    action: 'disableStaff',
    payload: {
      staff_id: 'staff_001'
    }
  })
  const enableResult = await handler({
    action: 'enableStaff',
    payload: {
      staff_id: 'staff_001'
    }
  })

  assert.equal(disableResult.success, true)
  assert.equal(enableResult.success, true)
  assert.equal(state.staff[0].status, 'active')
})

test('non super admin cannot update staff status', async () => {
  const { state, deps } = createDependencies({
    openid: 'normal_user'
  })
  const handler = createManageMerchantStaffHandler(deps)

  const result = await handler({
    action: 'disableStaff',
    payload: {
      staff_id: 'staff_001'
    }
  })

  assert.equal(result.success, false)
  assert.equal(result.code, 'FORBIDDEN')
  assert.equal(state.staff[0].status, 'active')
})

test('cannot create invite for missing merchant', async () => {
  const { deps } = createDependencies()
  const handler = createManageMerchantStaffHandler(deps)

  const result = await handler({
    action: 'createInvite',
    payload: {
      merchant_id: 'missing',
      role: 'staff'
    }
  })

  assert.equal(result.success, false)
  assert.equal(result.code, 'NOT_FOUND')
})

test('cannot create invite for disabled merchant', async () => {
  const { deps } = createDependencies({
    merchants: [
      {
        merchant_id: 'xiaochu',
        name: '小厨食堂',
        status: 'disabled'
      }
    ]
  })
  const handler = createManageMerchantStaffHandler(deps)

  const result = await handler({
    action: 'createInvite',
    payload: {
      merchant_id: 'xiaochu',
      role: 'staff'
    }
  })

  assert.equal(result.success, false)
  assert.equal(result.code, 'MERCHANT_DISABLED')
})

test('create invite supports owner role', async () => {
  const { deps } = createDependencies()
  const handler = createManageMerchantStaffHandler(deps)

  const result = await handler({
    action: 'createInvite',
    payload: {
      merchant_id: 'xiaochu',
      role: 'owner'
    }
  })

  assert.equal(result.success, true)
  assert.equal(result.data.invite.role, 'owner')
})

test('create invite rejects invalid role', async () => {
  const { deps } = createDependencies()
  const handler = createManageMerchantStaffHandler(deps)

  const result = await handler({
    action: 'createInvite',
    payload: {
      merchant_id: 'xiaochu',
      role: 'manager'
    }
  })

  assert.equal(result.success, false)
  assert.equal(result.code, 'VALIDATION_ERROR')
})

test('list staff requires merchant_id', async () => {
  const { deps } = createDependencies()
  const handler = createManageMerchantStaffHandler(deps)

  const result = await handler({
    action: 'listStaff',
    payload: {}
  })

  assert.equal(result.success, false)
  assert.equal(result.code, 'INVALID_PARAMS')
})

test('response structure is stable for invalid action', async () => {
  const { deps } = createDependencies()
  const handler = createManageMerchantStaffHandler(deps)

  const result = await handler({
    action: 'unknown'
  })

  assert.deepEqual(Object.keys(result), ['success', 'code', 'message', 'data'])
  assert.equal(result.success, false)
  assert.equal(result.data, null)
})
