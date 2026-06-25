const test = require('node:test')
const assert = require('node:assert/strict')

const { createRedeemMerchantInviteHandler } = require('./redeem-invite-service')

const FIXED_NOW = new Date('2026-06-25T10:00:00.000Z')

function createDependencies(options = {}) {
  const state = {
    openid: options.openid === undefined ? 'new_staff_openid' : options.openid,
    now: options.now || FIXED_NOW,
    ordersTouched: 0,
    dishesTouched: 0,
    merchants: options.merchants || [
      {
        merchant_id: 'xiaochu',
        name: '小厨食堂',
        status: 'active'
      }
    ],
    invites: options.invites || [
      {
        _id: 'invite_001',
        code: 'XK7M2Q8A',
        merchant_id: 'xiaochu',
        role: 'staff',
        status: 'unused',
        created_by_openid: 'admin_openid',
        expires_at: new Date('2026-07-02T10:00:00.000Z'),
        created_at: new Date('2026-06-25T09:00:00.000Z'),
        updated_at: new Date('2026-06-25T09:00:00.000Z')
      }
    ],
    staff: options.staff || []
  }

  return {
    state,
    deps: {
      getOpenid: () => state.openid,
      now: () => state.now,
      findInviteByCode: async (code) => {
        return state.invites.find((invite) => invite.code === code) || null
      },
      findMerchantByMerchantId: async (merchantId) => {
        return state.merchants.find((merchant) => merchant.merchant_id === merchantId) || null
      },
      findStaffByMerchantAndOpenid: async ({ merchant_id, openid }) => {
        return state.staff.find((item) => item.merchant_id === merchant_id && item.openid === openid) || null
      },
      createStaff: async (staff) => {
        const record = {
          _id: `staff_${state.staff.length + 1}`,
          ...staff
        }
        state.staff.push(record)
        return record
      },
      updateStaff: async ({ staff_id, updateData }) => {
        const staff = state.staff.find((item) => item._id === staff_id)
        if (!staff) {
          return null
        }
        Object.assign(staff, updateData)
        return staff
      },
      updateInvite: async ({ code, updateData }) => {
        const invite = state.invites.find((item) => item.code === code)
        if (!invite) {
          return null
        }
        Object.assign(invite, updateData)
        return invite
      },
      touchOrders: () => {
        state.ordersTouched += 1
      },
      touchDishes: () => {
        state.dishesTouched += 1
      },
      logger: {
        error: () => {}
      }
    }
  }
}

test('normal user can redeem valid invite', async () => {
  const { state, deps } = createDependencies()
  const handler = createRedeemMerchantInviteHandler(deps)

  const result = await handler({
    code: 'XK7M2Q8A',
    openid: 'fake_openid_should_be_ignored'
  })

  assert.equal(result.success, true)
  assert.equal(result.data.staff.openid, 'new_staff_openid')
  assert.equal(result.data.staff.merchant_id, 'xiaochu')
  assert.equal(result.data.staff.role, 'staff')
  assert.equal(state.staff.length, 1)
})

test('redeem creates merchant_staff and marks invite used', async () => {
  const { state, deps } = createDependencies()
  const handler = createRedeemMerchantInviteHandler(deps)

  await handler({
    payload: {
      code: 'XK7M2Q8A'
    }
  })

  assert.equal(state.staff[0].openid, 'new_staff_openid')
  assert.equal(state.invites[0].status, 'used')
  assert.equal(state.invites[0].used_by_openid, 'new_staff_openid')
  assert.deepEqual(state.invites[0].used_at, FIXED_NOW)
})

test('used invite cannot be redeemed again', async () => {
  const { deps } = createDependencies({
    invites: [
      {
        code: 'XK7M2Q8A',
        merchant_id: 'xiaochu',
        role: 'staff',
        status: 'used'
      }
    ]
  })
  const handler = createRedeemMerchantInviteHandler(deps)

  const result = await handler({
    code: 'XK7M2Q8A'
  })

  assert.equal(result.success, false)
  assert.equal(result.code, 'INVITE_USED')
})

test('expired invite cannot be redeemed', async () => {
  const { deps } = createDependencies({
    invites: [
      {
        code: 'XK7M2Q8A',
        merchant_id: 'xiaochu',
        role: 'staff',
        status: 'unused',
        expires_at: new Date('2026-06-20T10:00:00.000Z')
      }
    ]
  })
  const handler = createRedeemMerchantInviteHandler(deps)

  const result = await handler({
    code: 'XK7M2Q8A'
  })

  assert.equal(result.success, false)
  assert.equal(result.code, 'INVITE_EXPIRED')
})

test('disabled invite cannot be redeemed', async () => {
  const { deps } = createDependencies({
    invites: [
      {
        code: 'XK7M2Q8A',
        merchant_id: 'xiaochu',
        role: 'staff',
        status: 'disabled',
        expires_at: new Date('2026-07-02T10:00:00.000Z')
      }
    ]
  })
  const handler = createRedeemMerchantInviteHandler(deps)

  const result = await handler({
    code: 'XK7M2Q8A'
  })

  assert.equal(result.success, false)
  assert.equal(result.code, 'INVITE_DISABLED')
})

test('missing invite cannot be redeemed', async () => {
  const { deps } = createDependencies({
    invites: []
  })
  const handler = createRedeemMerchantInviteHandler(deps)

  const result = await handler({
    code: 'MISSING8'
  })

  assert.equal(result.success, false)
  assert.equal(result.code, 'INVITE_NOT_FOUND')
})

test('disabled merchant invite cannot be redeemed', async () => {
  const { deps } = createDependencies({
    merchants: [
      {
        merchant_id: 'xiaochu',
        name: '小厨食堂',
        status: 'disabled'
      }
    ]
  })
  const handler = createRedeemMerchantInviteHandler(deps)

  const result = await handler({
    code: 'XK7M2Q8A'
  })

  assert.equal(result.success, false)
  assert.equal(result.code, 'MERCHANT_DISABLED')
})

test('existing staff is updated instead of duplicated', async () => {
  const { state, deps } = createDependencies({
    staff: [
      {
        _id: 'staff_existing',
        merchant_id: 'xiaochu',
        openid: 'new_staff_openid',
        role: 'staff',
        status: 'disabled'
      }
    ]
  })
  const handler = createRedeemMerchantInviteHandler(deps)

  const result = await handler({
    code: 'XK7M2Q8A'
  })

  assert.equal(result.success, true)
  assert.equal(state.staff.length, 1)
  assert.equal(state.staff[0].status, 'active')
})

test('event openid is ignored and current cloud openid is used', async () => {
  const { state, deps } = createDependencies()
  const handler = createRedeemMerchantInviteHandler(deps)

  await handler({
    code: 'XK7M2Q8A',
    openid: 'attacker_openid'
  })

  assert.equal(state.staff[0].openid, 'new_staff_openid')
})

test('redeem does not touch orders or dishes', async () => {
  const { state, deps } = createDependencies()
  const handler = createRedeemMerchantInviteHandler(deps)

  await handler({
    code: 'XK7M2Q8A'
  })

  assert.equal(state.ordersTouched, 0)
  assert.equal(state.dishesTouched, 0)
})

test('response structure is stable', async () => {
  const { deps } = createDependencies({
    invites: []
  })
  const handler = createRedeemMerchantInviteHandler(deps)

  const result = await handler({
    code: ''
  })

  assert.deepEqual(Object.keys(result), ['success', 'code', 'message', 'data'])
  assert.equal(result.success, false)
  assert.equal(result.data, null)
})

test('missing openid returns unauthorized', async () => {
  const { deps } = createDependencies({
    openid: ''
  })
  const handler = createRedeemMerchantInviteHandler(deps)

  const result = await handler({
    code: 'XK7M2Q8A'
  })

  assert.equal(result.success, false)
  assert.equal(result.code, 'UNAUTHORIZED')
})

test('empty code fails validation', async () => {
  const { deps } = createDependencies()
  const handler = createRedeemMerchantInviteHandler(deps)

  const result = await handler({
    code: ''
  })

  assert.equal(result.success, false)
  assert.equal(result.code, 'INVALID_PARAMS')
})

test('missing merchant invite cannot be redeemed', async () => {
  const { deps } = createDependencies({
    merchants: []
  })
  const handler = createRedeemMerchantInviteHandler(deps)

  const result = await handler({
    code: 'XK7M2Q8A'
  })

  assert.equal(result.success, false)
  assert.equal(result.code, 'MERCHANT_NOT_FOUND')
})

test('owner invite creates owner staff without unknown fields', async () => {
  const { state, deps } = createDependencies({
    invites: [
      {
        code: 'XK7M2Q8A',
        merchant_id: 'xiaochu',
        role: 'owner',
        status: 'unused',
        expires_at: new Date('2026-07-02T10:00:00.000Z'),
        unexpected: 'ignore'
      }
    ]
  })
  const handler = createRedeemMerchantInviteHandler(deps)

  await handler({
    code: 'XK7M2Q8A',
    role: 'staff',
    unexpected: 'ignore'
  })

  assert.equal(state.staff[0].role, 'owner')
  assert.equal(Object.prototype.hasOwnProperty.call(state.staff[0], 'unexpected'), false)
})
