const test = require('node:test')
const assert = require('node:assert/strict')
const Module = require('node:module')
const crypto = require('node:crypto')

const {
  createSignedToken
} = require('../webAdminAuth/web-admin-auth-service')

const FIXED_NOW = new Date('2026-07-04T10:00:00.000Z')
const TOKEN_SECRET = 'merchant-self-service-test-secret'
const DAY_MS = 24 * 60 * 60 * 1000
const INTERNAL_STACK_MARKER = 'INTERNAL_STACK_MARKER_SHOULD_NOT_LEAK'

function createWebToken(options = {}) {
  return createSignedToken({
    role: options.role || 'super_admin',
    secret: options.secret || TOKEN_SECRET,
    now: options.now || FIXED_NOW,
    ttlMinutes: options.ttlMinutes || 60,
    nonce: options.nonce || 'merchant-self-service-test-nonce'
  }).token
}

function createDeps(options = {}) {
  const state = {
    now: options.now || FIXED_NOW,
    tokenSecret: options.tokenSecret === undefined ? TOKEN_SECRET : options.tokenSecret,
    codeIndex: 0,
    staffIndex: 1,
    codeSequence: options.codeSequence || ['ABCD2345', 'JKLM6789', 'PQRS2345', 'WXYZ6789', 'BCDF2345', 'GHJK6789'],
    invites: options.invites || [],
    merchants: options.merchants || [],
    staff: options.staff || [],
    inviteWrites: 0,
    merchantWrites: 0,
    staffWrites: 0,
    staffLoginUpdates: 0,
    merchantCompensations: 0,
    staffCompensations: 0
  }

  return {
    state,
    deps: {
      getTokenSecret: () => state.tokenSecret,
      now: () => state.now,
      createInviteCode: () => state.codeSequence[state.codeIndex++] || 'ZZZZ9999',
      findInviteByCode: options.findInviteByCode || (async (code) => {
        return state.invites.find((invite) => invite.code === code) || null
      }),
      createInvite: options.createInvite || (async (invite) => {
        state.inviteWrites += 1
        const record = {
          _id: `invite_${invite.code}`,
          ...invite
        }
        state.invites.push(record)
        return record
      }),
      createMerchant: async () => {
        state.merchantWrites += 1
        throw new Error('SHOULD_NOT_CREATE_MERCHANT')
      },
      createStaff: async () => {
        state.staffWrites += 1
        throw new Error('SHOULD_NOT_CREATE_STAFF')
      },
      updateInvite: async () => {
        state.inviteWrites += 1
        throw new Error('SHOULD_NOT_UPDATE_INVITE')
      },
      removeInvite: async () => {
        state.inviteWrites += 1
        throw new Error('SHOULD_NOT_REMOVE_INVITE')
      },
      findMerchantBySlug: options.findMerchantBySlug || (async (merchantSlug) => {
        return state.merchants.find((merchant) => merchant.merchant_slug === merchantSlug || merchant.merchant_id === merchantSlug) || null
      }),
      findStaffByLoginName: options.findStaffByLoginName || (async ({ merchant_id, login_name }) => {
        return state.staff.find((staff) => {
          return staff.merchant_id === merchant_id && staff.login_name === login_name
        }) || null
      }),
      createMerchantForSignup: options.createMerchantForSignup
        ? ((merchant) => options.createMerchantForSignup(merchant, state))
        : (async (merchant) => {
        state.merchantWrites += 1
        const record = {
          _id: `merchant_${merchant.merchant_id}`,
          ...merchant
        }
        state.merchants.push(record)
        return record
      }),
      createOwnerStaff: options.createOwnerStaff
        ? ((staff) => options.createOwnerStaff(staff, state))
        : (async (staff) => {
        state.staffWrites += 1
        const record = {
          _id: staff.staff_id,
          ...staff
        }
        state.staff.push(record)
        return record
      }),
      markInviteUsed: options.markInviteUsed
        ? ((params) => options.markInviteUsed(params, state))
        : (async ({ code, updateData }) => {
        state.inviteWrites += 1
        const invite = state.invites.find((item) => item.code === code)
        if (!invite || invite.status !== 'unused') {
          return null
        }
        Object.assign(invite, updateData)
        return invite
      }),
      disableMerchantForSignup: options.disableMerchantForSignup || (async (merchantId) => {
        state.merchantCompensations += 1
        const merchant = state.merchants.find((item) => item.merchant_id === merchantId)
        if (merchant) {
          merchant.status = 'disabled'
          merchant.compensated = true
        }
      }),
      disableStaffForSignup: options.disableStaffForSignup || (async (staffId) => {
        state.staffCompensations += 1
        const staff = state.staff.find((item) => item.staff_id === staffId || item._id === staffId)
        if (staff) {
          staff.status = 'disabled'
          staff.account_status = 'disabled'
          staff.compensated = true
        }
      }),
      updateStaffLoginAt: options.updateStaffLoginAt
        ? ((params) => options.updateStaffLoginAt(params, state))
        : (async ({ staff_id, updateData }) => {
        state.staffLoginUpdates += 1
        const staff = state.staff.find((item) => item.staff_id === staff_id || item._id === staff_id)
        if (!staff) {
          return null
        }
        Object.assign(staff, updateData)
        return staff
      }),
      createStaffId: options.createStaffId || (() => `staff_${state.staffIndex++}`),
      createPasswordSalt: options.createPasswordSalt || (() => 'fixed-test-password-salt'),
      createNonce: options.createNonce || (() => 'fixed-merchant-admin-nonce'),
      getMerchantTokenTtlMinutes: options.getMerchantTokenTtlMinutes || (() => 240),
      logger: {
        error: () => {}
      }
    }
  }
}

function loadService() {
  return require('./merchant-self-service')
}

function assertResponseDoesNotLeak(result, blockedValues = []) {
  const responseText = JSON.stringify(result)
  assert.equal(Object.prototype.hasOwnProperty.call(result, 'stack'), false)
  assert.equal(responseText.includes('admin_token'), false)
  assert.equal(responseText.includes('WEB_ADMIN_TOKEN_SECRET'), false)
  assert.equal(responseText.includes(TOKEN_SECRET), false)
  blockedValues.filter(Boolean).forEach((value) => {
    assert.equal(responseText.includes(value), false)
  })
}

function decodeTokenPayload(token) {
  const payloadSegment = token.split('.')[0]
  const padded = payloadSegment.padEnd(payloadSegment.length + ((4 - (payloadSegment.length % 4)) % 4), '=')
  return JSON.parse(Buffer.from(padded.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8'))
}

function base64urlEncode(value) {
  return Buffer.from(value)
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
}

function assertTokenSignedWithSecret(token, secret) {
  const [payloadSegment, signatureSegment] = token.split('.')
  const expectedSignature = base64urlEncode(
    crypto
      .createHmac('sha256', secret)
      .update(payloadSegment)
      .digest()
  )

  assert.equal(signatureSegment, expectedSignature)
}

function createPasswordHash(password, salt) {
  return crypto.scryptSync(password, salt, 64).toString('hex')
}

async function createInviteWithDeps(event = {}, options = {}) {
  const { state, deps } = createDeps(options)
  const { createMerchantSelfServiceHandler } = loadService()
  const handler = createMerchantSelfServiceHandler(deps)
  const result = await handler({
    action: 'createMerchantSignupInvite',
    admin_token: createWebToken(),
    ...event
  })

  return {
    state,
    deps,
    result
  }
}

function createPreviewInvite(overrides = {}) {
  return {
    _id: 'invite_preview_001',
    code: 'ABCD2345',
    invite_type: 'merchant_signup',
    merchant_id: '',
    used_merchant_id: '',
    role: 'owner',
    status: 'unused',
    remark: 'private remark',
    created_by_role: 'super_admin',
    created_by_openid: 'admin_openid_should_not_leak',
    created_by_account_id: 'admin_account_should_not_leak',
    used_by_openid: 'used_openid_should_not_leak',
    used_by_account_id: 'used_account_should_not_leak',
    expires_at: new Date(FIXED_NOW.getTime() + 3 * DAY_MS),
    created_at: new Date('2026-07-01T10:00:00.000Z'),
    updated_at: new Date('2026-07-01T10:00:00.000Z'),
    used_at: null,
    disabled_at: null,
    ...overrides
  }
}

function createRedeemPayload(overrides = {}) {
  return {
    action: 'redeemMerchantSignupInvite',
    code: 'ABCD2345',
    merchant_name: 'Zhang San Private Kitchen',
    short_name: 'Zhang San',
    merchant_slug: 'zhangsan-kitchen',
    login_name: 'owner',
    password: 'password123',
    ...overrides
  }
}

function createLoginPayload(overrides = {}) {
  return {
    action: 'merchantAdminLogin',
    merchant_slug: 'zhangsan-kitchen',
    login_name: 'owner',
    password: 'password123',
    ...overrides
  }
}

function createLoginMerchant(overrides = {}) {
  return {
    _id: 'merchant_zhangsan-kitchen',
    merchant_id: 'zhangsan-kitchen',
    merchant_slug: 'zhangsan-kitchen',
    name: 'Zhang San Private Kitchen',
    short_name: 'Zhang San',
    status: 'active',
    owner_staff_id: 'staff_owner_001',
    created_at: new Date('2026-07-01T10:00:00.000Z'),
    updated_at: new Date('2026-07-01T10:00:00.000Z'),
    ...overrides
  }
}

function createLoginStaff(overrides = {}) {
  const passwordSalt = overrides.password_salt || 'login-test-password-salt'
  return {
    _id: 'staff_owner_001',
    staff_id: 'staff_owner_001',
    merchant_id: 'zhangsan-kitchen',
    openid: '',
    role: 'owner',
    status: 'active',
    nickname: 'Zhang San',
    remark: 'owner account',
    login_name: 'owner',
    password_hash: createPasswordHash('password123', passwordSalt),
    password_salt: passwordSalt,
    account_status: 'active',
    token_version: 3,
    last_login_at: new Date('2026-07-01T10:00:00.000Z'),
    created_at: new Date('2026-07-01T10:00:00.000Z'),
    updated_at: new Date('2026-07-01T10:00:00.000Z'),
    ...overrides
  }
}

async function merchantAdminLoginWithDeps(event = {}, options = {}) {
  const { state, deps } = createDeps({
    merchants: [createLoginMerchant()],
    staff: [createLoginStaff()],
    ...options
  })
  const { createMerchantSelfServiceHandler } = loadService()
  const handler = createMerchantSelfServiceHandler(deps)
  const result = await handler(createLoginPayload(event))

  return {
    state,
    deps,
    result
  }
}

async function redeemInviteWithDeps(event = {}, options = {}) {
  const { state, deps } = createDeps({
    invites: [createPreviewInvite({
      used_by_openid: '',
      used_by_account_id: ''
    })],
    ...options
  })
  const { createMerchantSelfServiceHandler } = loadService()
  const handler = createMerchantSelfServiceHandler(deps)
  const result = await handler(createRedeemPayload(event))

  return {
    state,
    deps,
    result
  }
}

async function previewInviteWithDeps(event = {}, options = {}) {
  const { state, deps } = createDeps({
    invites: [createPreviewInvite()],
    ...options
  })
  const { createMerchantSelfServiceHandler } = loadService()
  const handler = createMerchantSelfServiceHandler(deps)
  const result = await handler({
    action: 'previewMerchantSignupInvite',
    code: 'ABCD2345',
    ...event
  })

  return {
    state,
    result
  }
}

test('createMerchantSignupInvite succeeds and writes merchant signup invite', async () => {
  const { state, result } = await createInviteWithDeps({
    expires_in_days: 7,
    remark: '给张三开店'
  })

  assert.equal(result.success, true)
  assert.equal(result.code, 'SUCCESS')
  assert.equal(result.message, '开店邀请码已创建')
  assert.equal(state.invites.length, 1)

  const invite = state.invites[0]
  assert.equal(invite.code, 'ABCD2345')
  assert.equal(invite.invite_type, 'merchant_signup')
  assert.equal(invite.merchant_id, '')
  assert.equal(invite.used_merchant_id, '')
  assert.equal(invite.role, 'owner')
  assert.equal(invite.status, 'unused')
  assert.equal(invite.remark, '给张三开店')
  assert.equal(invite.created_by_role, 'super_admin')
  assert.equal(invite.created_by_openid, '')
  assert.equal(invite.created_by_account_id, '')
  assert.equal(invite.used_by_openid, '')
  assert.equal(invite.used_by_account_id, '')
  assert.equal(invite.used_at, null)
  assert.equal(invite.disabled_at, null)
  assert.equal(invite.created_at, FIXED_NOW)
  assert.equal(invite.updated_at, FIXED_NOW)
  assert.equal(invite.expires_at.getTime(), FIXED_NOW.getTime() + 7 * DAY_MS)

  assert.equal(result.data.invite.code, 'ABCD2345')
  assert.equal(result.data.invite.invite_type, 'merchant_signup')
  assert.equal(result.data.invite.status, 'unused')
  assert.equal(result.data.invite.role, 'owner')
  assert.equal(result.data.invite.remark, '给张三开店')
  assert.equal(result.data.invite.expires_at, invite.expires_at)
  assert.equal(result.data.invite.created_at, FIXED_NOW)
  assert.equal(result.data.invite.created_by_role, undefined)
  assert.equal(result.data.invite.used_by_account_id, undefined)
})

test('createMerchantSignupInvite rejects empty token', async () => {
  const { state, deps } = createDeps()
  const { createMerchantSelfServiceHandler } = loadService()
  const handler = createMerchantSelfServiceHandler(deps)

  const result = await handler({
    action: 'createMerchantSignupInvite',
    admin_token: ''
  })

  assert.equal(result.success, false)
  assert.equal(result.code, 'UNAUTHORIZED')
  assert.equal(state.invites.length, 0)
})

test('createMerchantSignupInvite rejects tampered token', async () => {
  const { state, deps } = createDeps()
  const { createMerchantSelfServiceHandler } = loadService()
  const handler = createMerchantSelfServiceHandler(deps)

  const result = await handler({
    action: 'createMerchantSignupInvite',
    admin_token: `${createWebToken()}x`
  })

  assert.equal(result.success, false)
  assert.equal(result.code, 'UNAUTHORIZED')
  assert.equal(state.invites.length, 0)
})

test('createMerchantSignupInvite rejects expired token', async () => {
  const { state, deps } = createDeps()
  const { createMerchantSelfServiceHandler } = loadService()
  const handler = createMerchantSelfServiceHandler(deps)

  const result = await handler({
    action: 'createMerchantSignupInvite',
    admin_token: createWebToken({
      now: new Date('2026-07-03T10:00:00.000Z'),
      ttlMinutes: 60
    })
  })

  assert.equal(result.success, false)
  assert.equal(result.code, 'TOKEN_EXPIRED')
  assert.equal(state.invites.length, 0)
})

test('createMerchantSignupInvite rejects non super admin role', async () => {
  const { state, deps } = createDeps()
  const { createMerchantSelfServiceHandler } = loadService()
  const handler = createMerchantSelfServiceHandler(deps)

  const result = await handler({
    action: 'createMerchantSignupInvite',
    admin_token: createWebToken({
      role: 'viewer'
    })
  })

  assert.equal(result.success, false)
  assert.equal(result.code, 'UNAUTHORIZED')
  assert.equal(state.invites.length, 0)
})

test('createMerchantSignupInvite rejects merchant admin token', async () => {
  const { state, deps } = createDeps()
  const { createMerchantSelfServiceHandler } = loadService()
  const handler = createMerchantSelfServiceHandler(deps)

  const result = await handler({
    action: 'createMerchantSignupInvite',
    admin_token: createWebToken({
      role: 'merchant_admin'
    })
  })

  assert.equal(result.success, false)
  assert.equal(result.code, 'UNAUTHORIZED')
  assert.equal(state.invites.length, 0)
})

test('missing action fails with INVALID_ACTION', async () => {
  const { deps } = createDeps()
  const { createMerchantSelfServiceHandler } = loadService()
  const handler = createMerchantSelfServiceHandler(deps)

  const result = await handler({
    admin_token: createWebToken()
  })

  assert.equal(result.success, false)
  assert.equal(result.code, 'INVALID_ACTION')
})

test('unknown action fails with INVALID_ACTION', async () => {
  const { deps } = createDeps()
  const { createMerchantSelfServiceHandler } = loadService()
  const handler = createMerchantSelfServiceHandler(deps)

  const result = await handler({
    action: 'unknownMerchantSelfServiceAction',
    admin_token: createWebToken()
  })

  assert.equal(result.success, false)
  assert.equal(result.code, 'INVALID_ACTION')
})

test('redeemMerchantSignupInvite succeeds and creates merchant owner invite used and merchant admin session', async () => {
  const { state, result } = await redeemInviteWithDeps()

  assert.equal(result.success, true)
  assert.equal(result.code, 'SUCCESS')
  assert.equal(result.message, '开店成功')

  assert.equal(state.merchants.length, 1)
  assert.equal(state.merchants[0].merchant_id, 'zhangsan-kitchen')
  assert.equal(state.merchants[0].merchant_slug, 'zhangsan-kitchen')
  assert.equal(state.merchants[0].name, 'Zhang San Private Kitchen')
  assert.equal(state.merchants[0].short_name, 'Zhang San')
  assert.equal(state.merchants[0].status, 'active')
  assert.equal(state.merchants[0].owner_openid, '')
  assert.equal(state.merchants[0].owner_staff_id, 'staff_1')
  assert.equal(state.merchants[0].created_from_invite_code, 'ABCD2345')
  assert.equal(state.merchants[0].notice, '')
  assert.equal(state.merchants[0].password, undefined)
  assert.equal(state.merchants[0].created_at, FIXED_NOW)
  assert.equal(state.merchants[0].updated_at, FIXED_NOW)

  assert.equal(state.staff.length, 1)
  assert.equal(state.staff[0].staff_id, 'staff_1')
  assert.equal(state.staff[0].merchant_id, 'zhangsan-kitchen')
  assert.equal(state.staff[0].openid, '')
  assert.equal(state.staff[0].role, 'owner')
  assert.equal(state.staff[0].status, 'active')
  assert.equal(state.staff[0].nickname, 'Zhang San')
  assert.equal(state.staff[0].login_name, 'owner')
  assert.ok(state.staff[0].password_hash)
  assert.ok(state.staff[0].password_salt)
  assert.notEqual(state.staff[0].password_hash, 'password123')
  assert.notEqual(state.staff[0].password_salt, 'password123')
  assert.equal(state.staff[0].password, undefined)
  assert.equal(state.staff[0].account_status, 'active')
  assert.equal(state.staff[0].token_version, 1)
  assert.equal(state.staff[0].last_login_at, FIXED_NOW)
  assert.equal(state.staff[0].created_at, FIXED_NOW)
  assert.equal(state.staff[0].updated_at, FIXED_NOW)

  assert.equal(state.invites[0].status, 'used')
  assert.equal(state.invites[0].used_merchant_id, 'zhangsan-kitchen')
  assert.equal(state.invites[0].used_by_account_id, 'staff_1')
  assert.equal(state.invites[0].used_by_openid, '')
  assert.equal(state.invites[0].used_at, FIXED_NOW)
  assert.equal(state.invites[0].updated_at, FIXED_NOW)

  assert.deepEqual(result.data.merchant, {
    merchant_id: 'zhangsan-kitchen',
    merchant_slug: 'zhangsan-kitchen',
    name: 'Zhang San Private Kitchen',
    short_name: 'Zhang San',
    status: 'active'
  })
  assert.equal(result.data.session.role, 'merchant_admin')
  assert.equal(result.data.session.merchant_id, 'zhangsan-kitchen')
  assert.ok(result.data.session.token)
  assert.ok(result.data.session.expires_at)

  const tokenPayload = decodeTokenPayload(result.data.session.token)
  assert.equal(tokenPayload.role, 'merchant_admin')
  assert.equal(tokenPayload.merchant_id, 'zhangsan-kitchen')
  assert.equal(tokenPayload.staff_id, 'staff_1')
  assert.equal(tokenPayload.account_id, 'staff_1')
  assert.equal(tokenPayload.login_name, 'owner')
  assert.equal(tokenPayload.token_version, 1)
  assert.equal(tokenPayload.nonce, 'fixed-merchant-admin-nonce')
  assertTokenSignedWithSecret(result.data.session.token, TOKEN_SECRET)
})

test('redeemMerchantSignupInvite normalizes merchant_slug and login_name', async () => {
  const { state, result } = await redeemInviteWithDeps({
    merchant_slug: '  ZhangSan-Kitchen  ',
    login_name: ' OWNER '
  })

  assert.equal(result.success, true)
  assert.equal(state.merchants[0].merchant_id, 'zhangsan-kitchen')
  assert.equal(state.merchants[0].merchant_slug, 'zhangsan-kitchen')
  assert.equal(state.staff[0].login_name, 'owner')
})

test('redeemMerchantSignupInvite rejects missing or invalid invite code', async () => {
  const cases = [
    {
      event: { code: '' },
      code: 'INVALID_INVITE_CODE'
    },
    {
      event: { code: 'BAD_CODE!' },
      code: 'INVALID_INVITE_CODE'
    },
    {
      event: { code: 'ZZZZ9999' },
      options: { invites: [] },
      code: 'INVITE_NOT_FOUND'
    }
  ]

  for (const item of cases) {
    const { state, result } = await redeemInviteWithDeps(item.event, item.options)
    assert.equal(result.success, false)
    assert.equal(result.code, item.code)
    assert.equal(state.merchants.length, 0)
    assert.equal(state.staff.length, 0)
    assert.notEqual(state.invites[0] && state.invites[0].status, 'used')
  }
})

test('redeemMerchantSignupInvite rejects invite that cannot be used for merchant signup', async () => {
  const legacyInvite = createPreviewInvite()
  delete legacyInvite.invite_type

  const cases = [
    {
      invite: createPreviewInvite({ invite_type: 'staff_join', merchant_id: 'merchant_001' }),
      code: 'INVITE_TYPE_MISMATCH'
    },
    {
      invite: legacyInvite,
      code: 'INVITE_TYPE_MISMATCH'
    },
    {
      invite: createPreviewInvite({ status: 'used' }),
      code: 'INVITE_USED'
    },
    {
      invite: createPreviewInvite({ status: 'disabled' }),
      code: 'INVITE_DISABLED'
    },
    {
      invite: createPreviewInvite({ status: 'expired' }),
      code: 'INVITE_EXPIRED'
    },
    {
      invite: createPreviewInvite({ status: 'unused', expires_at: new Date(FIXED_NOW.getTime() - DAY_MS) }),
      code: 'INVITE_EXPIRED'
    }
  ]

  for (const item of cases) {
    const originalStatus = item.invite.status
    const { state, result } = await redeemInviteWithDeps({}, {
      invites: [item.invite]
    })
    assert.equal(result.success, false)
    assert.equal(result.code, item.code)
    assert.equal(state.merchants.length, 0)
    assert.equal(state.staff.length, 0)
    assert.equal(state.invites[0].status, originalStatus)
  }
})

test('redeemMerchantSignupInvite validates merchant and account fields', async () => {
  const cases = [
    {
      event: { merchant_name: '' },
      code: 'MERCHANT_NAME_REQUIRED'
    },
    {
      event: { merchant_name: 'a'.repeat(41) },
      code: 'MERCHANT_NAME_INVALID'
    },
    {
      event: { short_name: '' },
      code: 'SHORT_NAME_REQUIRED'
    },
    {
      event: { short_name: 'a'.repeat(13) },
      code: 'SHORT_NAME_INVALID'
    },
    {
      event: { merchant_slug: '' },
      code: 'MERCHANT_SLUG_REQUIRED'
    },
    {
      event: { merchant_slug: 'bad_slug' },
      code: 'MERCHANT_SLUG_INVALID'
    },
    {
      event: { merchant_slug: '-bad' },
      code: 'MERCHANT_SLUG_INVALID'
    },
    {
      event: { merchant_slug: 'bad--slug' },
      code: 'MERCHANT_SLUG_INVALID'
    },
    {
      event: { login_name: '' },
      code: 'LOGIN_NAME_REQUIRED'
    },
    {
      event: { login_name: 'bad name' },
      code: 'LOGIN_NAME_INVALID'
    },
    {
      event: { password: '' },
      code: 'PASSWORD_REQUIRED'
    },
    {
      event: { password: '1234567' },
      code: 'PASSWORD_TOO_SHORT'
    }
  ]

  for (const item of cases) {
    const { state, result } = await redeemInviteWithDeps(item.event)
    assert.equal(result.success, false)
    assert.equal(result.code, item.code)
    assert.equal(state.merchants.length, 0)
    assert.equal(state.staff.length, 0)
    assert.equal(state.invites[0].status, 'unused')
  }
})

test('redeemMerchantSignupInvite rejects duplicate merchant slug and duplicate owner login name', async () => {
  const duplicateSlug = await redeemInviteWithDeps({}, {
    merchants: [
      {
        merchant_id: 'zhangsan-kitchen',
        merchant_slug: 'zhangsan-kitchen',
        status: 'active'
      }
    ]
  })
  assert.equal(duplicateSlug.result.success, false)
  assert.equal(duplicateSlug.result.code, 'MERCHANT_SLUG_EXISTS')
  assert.equal(duplicateSlug.state.merchants.length, 1)
  assert.equal(duplicateSlug.state.staff.length, 0)
  assert.equal(duplicateSlug.state.invites[0].status, 'unused')

  const duplicateLogin = await redeemInviteWithDeps({}, {
    staff: [
      {
        merchant_id: 'zhangsan-kitchen',
        login_name: 'owner',
        status: 'active'
      }
    ]
  })
  assert.equal(duplicateLogin.result.success, false)
  assert.equal(duplicateLogin.result.code, 'LOGIN_NAME_INVALID')
  assert.equal(duplicateLogin.state.merchants.length, 0)
  assert.equal(duplicateLogin.state.staff.length, 1)
  assert.equal(duplicateLogin.state.invites[0].status, 'unused')
})

test('redeemMerchantSignupInvite response does not leak password secret or stack details', async () => {
  const { state, result } = await redeemInviteWithDeps()

  assert.equal(result.success, true)
  assertResponseDoesNotLeak(result, [
    'password123',
    state.staff[0].password_hash,
    state.staff[0].password_salt
  ])

  const internalError = await redeemInviteWithDeps({}, {
    createMerchantForSignup: async () => {
      const error = new Error(INTERNAL_STACK_MARKER)
      error.stack = `Error: ${INTERNAL_STACK_MARKER}\n    at private-file.js:1:1`
      throw error
    }
  })

  assert.equal(internalError.result.success, false)
  assert.equal(internalError.result.code, 'MERCHANT_CREATE_FAILED')
  assertResponseDoesNotLeak(internalError.result, [INTERNAL_STACK_MARKER, 'password123'])
})

test('redeemMerchantSignupInvite failures do not create token or write data before validation passes', async () => {
  const { state, result } = await redeemInviteWithDeps({
    merchant_name: '',
    password: 'password123'
  })

  assert.equal(result.success, false)
  assert.equal(result.data, null)
  assert.equal(state.merchants.length, 0)
  assert.equal(state.staff.length, 0)
  assert.equal(state.invites[0].status, 'unused')
})

test('redeemMerchantSignupInvite compensates active merchant when owner creation fails', async () => {
  const { state, result } = await redeemInviteWithDeps({}, {
    createOwnerStaff: async (staff, currentState) => {
      void staff
      currentState.staffWrites += 1
      throw new Error('OWNER_CREATE_FAILED')
    }
  })

  assert.equal(result.success, false)
  assert.equal(result.code, 'OWNER_CREATE_FAILED')
  assert.equal(state.merchants.length, 1)
  assert.equal(state.merchants[0].status, 'disabled')
  assert.equal(state.merchantCompensations, 1)
  assert.equal(state.staff.length, 0)
  assert.equal(state.invites[0].status, 'unused')
})

test('redeemMerchantSignupInvite compensates merchant and owner when invite mark used fails', async () => {
  const { state, result } = await redeemInviteWithDeps({}, {
    markInviteUsed: async (params, currentState) => {
      void params
      currentState.inviteWrites += 1
      throw new Error('INVITE_MARK_USED_FAILED')
    }
  })

  assert.equal(result.success, false)
  assert.equal(result.code, 'INVITE_MARK_USED_FAILED')
  assert.equal(state.merchants.length, 1)
  assert.equal(state.merchants[0].status, 'disabled')
  assert.equal(state.staff.length, 1)
  assert.equal(state.staff[0].status, 'disabled')
  assert.equal(state.staff[0].account_status, 'disabled')
  assert.equal(state.merchantCompensations, 1)
  assert.equal(state.staffCompensations, 1)
  assert.equal(state.invites[0].status, 'unused')
})

test('redeemMerchantSignupInvite cannot redeem same invite or same slug twice', async () => {
  const first = await redeemInviteWithDeps()
  assert.equal(first.result.success, true)

  const { createMerchantSelfServiceHandler } = loadService()
  const handler = createMerchantSelfServiceHandler(first.deps)

  const secondByInvite = await handler(createRedeemPayload({
    merchant_slug: 'another-kitchen',
    login_name: 'other-owner'
  }))
  assert.equal(secondByInvite.success, false)
  assert.equal(secondByInvite.code, 'INVITE_USED')
  assert.equal(first.state.merchants.length, 1)
  assert.equal(first.state.staff.length, 1)

  const secondInvite = createPreviewInvite({
    _id: 'invite_preview_002',
    code: 'JKLM6789'
  })
  first.state.invites.push(secondInvite)
  const secondBySlug = await handler(createRedeemPayload({
    code: 'JKLM6789'
  }))
  assert.equal(secondBySlug.success, false)
  assert.equal(secondBySlug.code, 'MERCHANT_SLUG_EXISTS')
  assert.equal(secondInvite.status, 'unused')
  assert.equal(first.state.merchants.length, 1)
  assert.equal(first.state.staff.length, 1)
})

test('redeemMerchantSignupInvite works with http body string', async () => {
  const { state, deps } = createDeps({
    invites: [createPreviewInvite()]
  })
  const { createMerchantSelfServiceHandler } = loadService()
  const handler = createMerchantSelfServiceHandler(deps)

  const result = await handler({
    body: JSON.stringify(createRedeemPayload({
      merchant_slug: 'body-string-kitchen',
      login_name: 'body-owner'
    }))
  })

  assert.equal(result.success, true)
  assert.equal(result.data.merchant.merchant_id, 'body-string-kitchen')
  assert.equal(state.merchants.length, 1)
  assert.equal(state.staff.length, 1)
  assert.equal(state.invites[0].status, 'used')
})

test('redeemMerchantSignupInvite works with http body object', async () => {
  const { state, deps } = createDeps({
    invites: [createPreviewInvite()]
  })
  const { createMerchantSelfServiceHandler } = loadService()
  const handler = createMerchantSelfServiceHandler(deps)

  const result = await handler({
    body: createRedeemPayload({
      merchant_slug: 'body-object-kitchen',
      login_name: 'body-object-owner'
    })
  })

  assert.equal(result.success, true)
  assert.equal(result.data.merchant.merchant_id, 'body-object-kitchen')
  assert.equal(state.merchants.length, 1)
  assert.equal(state.staff.length, 1)
  assert.equal(state.invites[0].status, 'used')
})

test('redeemMerchantSignupInvite works with queryStringParameters', async () => {
  const { state, deps } = createDeps({
    invites: [createPreviewInvite()]
  })
  const { createMerchantSelfServiceHandler } = loadService()
  const handler = createMerchantSelfServiceHandler(deps)

  const result = await handler({
    queryStringParameters: createRedeemPayload({
      merchant_slug: 'query-kitchen',
      login_name: 'query-owner'
    })
  })

  assert.equal(result.success, true)
  assert.equal(result.data.merchant.merchant_id, 'query-kitchen')
  assert.equal(state.merchants.length, 1)
  assert.equal(state.staff.length, 1)
  assert.equal(state.invites[0].status, 'used')
})

test('merchantAdminLogin succeeds and returns safe merchant admin session', async () => {
  const { state, result } = await merchantAdminLoginWithDeps()

  assert.equal(result.success, true)
  assert.equal(result.code, 'SUCCESS')
  assert.equal(result.message, '鐧诲綍鎴愬姛')
  assert.deepEqual(result.data.merchant, {
    merchant_id: 'zhangsan-kitchen',
    merchant_slug: 'zhangsan-kitchen',
    name: 'Zhang San Private Kitchen',
    short_name: 'Zhang San',
    status: 'active'
  })
  assert.equal(result.data.session.role, 'merchant_admin')
  assert.equal(result.data.session.merchant_id, 'zhangsan-kitchen')
  assert.ok(result.data.session.token)
  assert.ok(result.data.session.expires_at)

  const tokenPayload = decodeTokenPayload(result.data.session.token)
  assert.equal(tokenPayload.role, 'merchant_admin')
  assert.equal(tokenPayload.merchant_id, 'zhangsan-kitchen')
  assert.equal(tokenPayload.staff_id, 'staff_owner_001')
  assert.equal(tokenPayload.account_id, 'staff_owner_001')
  assert.equal(tokenPayload.login_name, 'owner')
  assert.equal(tokenPayload.token_version, 3)
  assert.equal(tokenPayload.nonce, 'fixed-merchant-admin-nonce')
  assertTokenSignedWithSecret(result.data.session.token, TOKEN_SECRET)

  assert.equal(state.staff[0].last_login_at, FIXED_NOW)
  assert.equal(state.staff[0].updated_at, FIXED_NOW)
  assert.equal(state.staffLoginUpdates, 1)
  assert.equal(state.merchantWrites, 0)
  assert.equal(state.staffWrites, 0)
  assert.equal(state.inviteWrites, 0)
  assert.equal(state.merchants.length, 1)
  assert.equal(state.staff.length, 1)
  assert.equal(state.staff[0].password_hash, createPasswordHash('password123', 'login-test-password-salt'))
  assert.equal(state.staff[0].password_salt, 'login-test-password-salt')

  assertResponseDoesNotLeak(result, [
    'password123',
    state.staff[0].password_hash,
    state.staff[0].password_salt
  ])
})

test('merchantAdminLogin normalizes merchant_slug and login_name', async () => {
  const { result } = await merchantAdminLoginWithDeps({
    merchant_slug: '  ZhangSan-Kitchen  ',
    login_name: ' OWNER '
  })

  assert.equal(result.success, true)
  assert.equal(result.data.session.merchant_id, 'zhangsan-kitchen')
})

test('merchantAdminLogin validates required fields', async () => {
  const cases = [
    {
      event: { merchant_slug: '' },
      code: 'MERCHANT_SLUG_REQUIRED'
    },
    {
      event: { merchant_slug: 'bad_slug' },
      code: 'MERCHANT_SLUG_INVALID'
    },
    {
      event: { login_name: '' },
      code: 'LOGIN_NAME_REQUIRED'
    },
    {
      event: { login_name: 'bad name' },
      code: 'LOGIN_NAME_INVALID'
    },
    {
      event: { password: '' },
      code: 'PASSWORD_REQUIRED'
    }
  ]

  for (const item of cases) {
    const { state, result } = await merchantAdminLoginWithDeps(item.event)
    assert.equal(result.success, false)
    assert.equal(result.code, item.code)
    assert.equal(result.data, null)
    assert.equal(state.staffLoginUpdates, 0)
    assert.equal(state.merchantWrites, 0)
    assert.equal(state.staffWrites, 0)
    assert.equal(state.inviteWrites, 0)
  }
})

test('merchantAdminLogin returns invalid login for missing merchant account or wrong password', async () => {
  const cases = [
    {
      options: { merchants: [] }
    },
    {
      options: { staff: [] }
    },
    {
      event: { password: 'wrong-password' }
    },
    {
      options: { staff: [createLoginStaff({ password_hash: '' })] }
    },
    {
      options: { staff: [createLoginStaff({ password_salt: '' })] }
    },
    {
      options: { staff: [createLoginStaff({ role: 'staff' })] }
    }
  ]

  for (const item of cases) {
    const { state, result } = await merchantAdminLoginWithDeps(item.event || {}, item.options || {})
    assert.equal(result.success, false)
    assert.equal(result.code, 'INVALID_LOGIN')
    assert.equal(result.data, null)
    assert.equal(state.staffLoginUpdates, 0)
    assert.equal(state.inviteWrites, 0)
    assert.equal(result.data && result.data.session, null)
  }
})

test('merchantAdminLogin rejects disabled merchant staff or account', async () => {
  const disabledMerchant = await merchantAdminLoginWithDeps({}, {
    merchants: [createLoginMerchant({ status: 'disabled' })]
  })
  assert.equal(disabledMerchant.result.success, false)
  assert.equal(disabledMerchant.result.code, 'MERCHANT_DISABLED')
  assert.equal(disabledMerchant.state.staffLoginUpdates, 0)

  const disabledStaff = await merchantAdminLoginWithDeps({}, {
    staff: [createLoginStaff({ status: 'disabled' })]
  })
  assert.equal(disabledStaff.result.success, false)
  assert.equal(disabledStaff.result.code, 'ACCOUNT_DISABLED')
  assert.equal(disabledStaff.state.staffLoginUpdates, 0)

  const disabledAccount = await merchantAdminLoginWithDeps({}, {
    staff: [createLoginStaff({ account_status: 'disabled' })]
  })
  assert.equal(disabledAccount.result.success, false)
  assert.equal(disabledAccount.result.code, 'ACCOUNT_DISABLED')
  assert.equal(disabledAccount.state.staffLoginUpdates, 0)
})

test('merchantAdminLogin failure response does not leak sensitive data or stack details', async () => {
  const broken = await merchantAdminLoginWithDeps({}, {
    findMerchantBySlug: async () => {
      const error = new Error(INTERNAL_STACK_MARKER)
      error.stack = `Error: ${INTERNAL_STACK_MARKER}\n    at private-file.js:1:1`
      throw error
    }
  })

  assert.equal(broken.result.success, false)
  assert.equal(broken.result.code, 'INTERNAL_ERROR')
  assertResponseDoesNotLeak(broken.result, [INTERNAL_STACK_MARKER, 'password123'])

  const invalid = await merchantAdminLoginWithDeps({ password: 'wrong-password' })
  assertResponseDoesNotLeak(invalid.result, [
    'password123',
    invalid.state.staff[0].password_hash,
    invalid.state.staff[0].password_salt
  ])
})

test('merchantAdminLogin works with http body string', async () => {
  const { state, deps } = createDeps({
    merchants: [createLoginMerchant()],
    staff: [createLoginStaff()]
  })
  const { createMerchantSelfServiceHandler } = loadService()
  const handler = createMerchantSelfServiceHandler(deps)

  const result = await handler({
    body: JSON.stringify(createLoginPayload())
  })

  assert.equal(result.success, true)
  assert.equal(result.data.session.role, 'merchant_admin')
  assert.equal(state.staffLoginUpdates, 1)
})

test('merchantAdminLogin works with http body object', async () => {
  const { state, deps } = createDeps({
    merchants: [createLoginMerchant()],
    staff: [createLoginStaff()]
  })
  const { createMerchantSelfServiceHandler } = loadService()
  const handler = createMerchantSelfServiceHandler(deps)

  const result = await handler({
    body: createLoginPayload()
  })

  assert.equal(result.success, true)
  assert.equal(result.data.session.role, 'merchant_admin')
  assert.equal(state.staffLoginUpdates, 1)
})

test('merchantAdminLogin works with queryStringParameters', async () => {
  const { state, deps } = createDeps({
    merchants: [createLoginMerchant()],
    staff: [createLoginStaff()]
  })
  const { createMerchantSelfServiceHandler } = loadService()
  const handler = createMerchantSelfServiceHandler(deps)

  const result = await handler({
    queryStringParameters: createLoginPayload()
  })

  assert.equal(result.success, true)
  assert.equal(result.data.session.role, 'merchant_admin')
  assert.equal(state.staffLoginUpdates, 1)
})

test('merchantAdminLogin invalid json body does not crash', async () => {
  const { deps } = createDeps({
    merchants: [createLoginMerchant()],
    staff: [createLoginStaff()]
  })
  const { createMerchantSelfServiceHandler } = loadService()
  const handler = createMerchantSelfServiceHandler(deps)

  const result = await handler({
    body: '{"action":'
  })

  assert.equal(result.success, false)
  assert.equal(result.code, 'INVALID_ACTION')
})

test('previewMerchantSignupInvite succeeds for available merchant signup invite', async () => {
  const { state, result } = await previewInviteWithDeps()

  assert.equal(result.success, true)
  assert.equal(result.code, 'SUCCESS')
  assert.equal(result.message, '邀请码可用')
  assert.equal(result.data.invite.code, 'ABCD2345')
  assert.equal(result.data.invite.invite_type, 'merchant_signup')
  assert.equal(result.data.invite.status, 'unused')
  assert.equal(result.data.invite.can_use, true)
  assert.equal(result.data.invite.expires_at, state.invites[0].expires_at)
  assert.equal(state.inviteWrites, 0)
})

test('previewMerchantSignupInvite response does not leak sensitive fields', async () => {
  const { result } = await previewInviteWithDeps()

  assert.equal(result.success, true)
  assert.equal(result.data.invite.created_by_openid, undefined)
  assert.equal(result.data.invite.created_by_account_id, undefined)
  assert.equal(result.data.invite.used_by_openid, undefined)
  assert.equal(result.data.invite.used_by_account_id, undefined)
  assert.equal(result.data.session, undefined)
  assert.equal(result.data.token, undefined)
  assertResponseDoesNotLeak(result, [
    'admin_openid_should_not_leak',
    'admin_account_should_not_leak',
    'used_openid_should_not_leak',
    'used_account_should_not_leak'
  ])
})

test('previewMerchantSignupInvite requires code', async () => {
  const { result } = await previewInviteWithDeps({
    code: ''
  })

  assert.equal(result.success, false)
  assert.equal(result.code, 'INVALID_INVITE_CODE')
})

test('previewMerchantSignupInvite rejects invalid code format', async () => {
  const { result } = await previewInviteWithDeps({
    code: 'BAD_CODE!'
  })

  assert.equal(result.success, false)
  assert.equal(result.code, 'INVALID_INVITE_CODE')
})

test('previewMerchantSignupInvite fails when invite does not exist', async () => {
  const { result } = await previewInviteWithDeps({}, {
    invites: []
  })

  assert.equal(result.success, false)
  assert.equal(result.code, 'INVITE_NOT_FOUND')
})

test('previewMerchantSignupInvite rejects staff join invite', async () => {
  const { result } = await previewInviteWithDeps({}, {
    invites: [
      createPreviewInvite({
        invite_type: 'staff_join',
        merchant_id: 'merchant_001'
      })
    ]
  })

  assert.equal(result.success, false)
  assert.equal(result.code, 'INVITE_TYPE_MISMATCH')
})

test('previewMerchantSignupInvite rejects legacy invite without invite_type', async () => {
  const legacyInvite = createPreviewInvite()
  delete legacyInvite.invite_type
  legacyInvite.merchant_id = 'merchant_001'

  const { result } = await previewInviteWithDeps({}, {
    invites: [legacyInvite]
  })

  assert.equal(result.success, false)
  assert.equal(result.code, 'INVITE_TYPE_MISMATCH')
})

test('previewMerchantSignupInvite rejects used invite', async () => {
  const { result } = await previewInviteWithDeps({}, {
    invites: [
      createPreviewInvite({
        status: 'used'
      })
    ]
  })

  assert.equal(result.success, false)
  assert.equal(result.code, 'INVITE_USED')
})

test('previewMerchantSignupInvite rejects disabled invite', async () => {
  const { result } = await previewInviteWithDeps({}, {
    invites: [
      createPreviewInvite({
        status: 'disabled'
      })
    ]
  })

  assert.equal(result.success, false)
  assert.equal(result.code, 'INVITE_DISABLED')
})

test('previewMerchantSignupInvite rejects expired status invite', async () => {
  const { result } = await previewInviteWithDeps({}, {
    invites: [
      createPreviewInvite({
        status: 'expired'
      })
    ]
  })

  assert.equal(result.success, false)
  assert.equal(result.code, 'INVITE_EXPIRED')
})

test('previewMerchantSignupInvite rejects date expired unused invite', async () => {
  const { result } = await previewInviteWithDeps({}, {
    invites: [
      createPreviewInvite({
        status: 'unused',
        expires_at: new Date(FIXED_NOW.getTime() - DAY_MS)
      })
    ]
  })

  assert.equal(result.success, false)
  assert.equal(result.code, 'INVITE_EXPIRED')
})

test('previewMerchantSignupInvite works with http body string', async () => {
  const { state, deps } = createDeps({
    invites: [createPreviewInvite()]
  })
  const { createMerchantSelfServiceHandler } = loadService()
  const handler = createMerchantSelfServiceHandler(deps)

  const result = await handler({
    body: JSON.stringify({
      action: 'previewMerchantSignupInvite',
      code: 'ABCD2345'
    })
  })

  assert.equal(result.success, true)
  assert.equal(result.data.invite.can_use, true)
  assert.equal(state.inviteWrites, 0)
})

test('previewMerchantSignupInvite works with http body object', async () => {
  const { state, deps } = createDeps({
    invites: [createPreviewInvite()]
  })
  const { createMerchantSelfServiceHandler } = loadService()
  const handler = createMerchantSelfServiceHandler(deps)

  const result = await handler({
    body: {
      action: 'previewMerchantSignupInvite',
      code: 'ABCD2345'
    }
  })

  assert.equal(result.success, true)
  assert.equal(result.data.invite.can_use, true)
  assert.equal(state.inviteWrites, 0)
})

test('previewMerchantSignupInvite works with queryStringParameters', async () => {
  const { state, deps } = createDeps({
    invites: [createPreviewInvite()]
  })
  const { createMerchantSelfServiceHandler } = loadService()
  const handler = createMerchantSelfServiceHandler(deps)

  const result = await handler({
    queryStringParameters: {
      action: 'previewMerchantSignupInvite',
      code: 'ABCD2345'
    }
  })

  assert.equal(result.success, true)
  assert.equal(result.data.invite.can_use, true)
  assert.equal(state.inviteWrites, 0)
})

test('previewMerchantSignupInvite invalid json body does not crash', async () => {
  const { deps } = createDeps({
    invites: [createPreviewInvite()]
  })
  const { createMerchantSelfServiceHandler } = loadService()
  const handler = createMerchantSelfServiceHandler(deps)

  const result = await handler({
    body: '{"action":'
  })

  assert.equal(result.success, false)
  assert.equal(result.code, 'INVALID_ACTION')
})

test('previewMerchantSignupInvite is read only and creates no merchant admin token', async () => {
  const { state, result } = await previewInviteWithDeps()

  assert.equal(result.success, true)
  assert.equal(state.inviteWrites, 0)
  assert.equal(state.merchantWrites, 0)
  assert.equal(state.staffWrites, 0)
  assert.equal(result.data.session, undefined)
  assert.equal(result.data.token, undefined)
})

test('previewMerchantSignupInvite internal error response does not leak stack details', async () => {
  const { deps } = createDeps({
    findInviteByCode: async () => {
      const error = new Error(INTERNAL_STACK_MARKER)
      error.stack = `Error: ${INTERNAL_STACK_MARKER}\n    at private-file.js:1:1`
      throw error
    }
  })
  const { createMerchantSelfServiceHandler } = loadService()
  const handler = createMerchantSelfServiceHandler(deps)

  const result = await handler({
    action: 'previewMerchantSignupInvite',
    code: 'ABCD2345'
  })

  assert.equal(result.success, false)
  assert.equal(result.code, 'INTERNAL_ERROR')
  assertResponseDoesNotLeak(result, [INTERNAL_STACK_MARKER])
})

test('http body string can create merchant signup invite', async () => {
  const { state, deps } = createDeps()
  const { createMerchantSelfServiceHandler } = loadService()
  const handler = createMerchantSelfServiceHandler(deps)

  const result = await handler({
    body: JSON.stringify({
      action: 'createMerchantSignupInvite',
      admin_token: createWebToken(),
      remark: 'body string'
    })
  })

  assert.equal(result.success, true)
  assert.equal(state.invites.length, 1)
  assert.equal(state.invites[0].remark, 'body string')
})

test('http body object can create merchant signup invite', async () => {
  const { state, deps } = createDeps()
  const { createMerchantSelfServiceHandler } = loadService()
  const handler = createMerchantSelfServiceHandler(deps)

  const result = await handler({
    body: {
      action: 'createMerchantSignupInvite',
      admin_token: createWebToken(),
      remark: 'body object'
    }
  })

  assert.equal(result.success, true)
  assert.equal(state.invites.length, 1)
  assert.equal(state.invites[0].remark, 'body object')
})

test('queryStringParameters can create merchant signup invite', async () => {
  const { state, deps } = createDeps()
  const { createMerchantSelfServiceHandler } = loadService()
  const handler = createMerchantSelfServiceHandler(deps)

  const result = await handler({
    queryStringParameters: {
      action: 'createMerchantSignupInvite',
      admin_token: createWebToken(),
      remark: 'query'
    }
  })

  assert.equal(result.success, true)
  assert.equal(state.invites.length, 1)
  assert.equal(state.invites[0].remark, 'query')
})

test('invalid json body does not crash', async () => {
  const { deps } = createDeps()
  const { createMerchantSelfServiceHandler } = loadService()
  const handler = createMerchantSelfServiceHandler(deps)

  const result = await handler({
    body: '{"action":'
  })

  assert.equal(result.success, false)
  assert.equal(result.code, 'INVALID_ACTION')
})

test('expires_in_days defaults to seven days', async () => {
  const { state, result } = await createInviteWithDeps()

  assert.equal(result.success, true)
  assert.equal(state.invites[0].expires_at.getTime(), FIXED_NOW.getTime() + 7 * DAY_MS)
})

test('expires_in_days below one fails', async () => {
  const { state, result } = await createInviteWithDeps({
    expires_in_days: 0
  })

  assert.equal(result.success, false)
  assert.equal(result.code, 'EXPIRES_IN_DAYS_INVALID')
  assert.equal(state.invites.length, 0)
})

test('expires_in_days above thirty fails', async () => {
  const { state, result } = await createInviteWithDeps({
    expires_in_days: 31
  })

  assert.equal(result.success, false)
  assert.equal(result.code, 'EXPIRES_IN_DAYS_INVALID')
  assert.equal(state.invites.length, 0)
})

test('expires_in_days non number fails', async () => {
  const { state, result } = await createInviteWithDeps({
    expires_in_days: 'abc'
  })

  assert.equal(result.success, false)
  assert.equal(result.code, 'EXPIRES_IN_DAYS_INVALID')
  assert.equal(state.invites.length, 0)
})

test('remark longer than one hundred characters fails', async () => {
  const { state, result } = await createInviteWithDeps({
    remark: 'a'.repeat(101)
  })

  assert.equal(result.success, false)
  assert.equal(result.code, 'REMARK_TOO_LONG')
  assert.equal(state.invites.length, 0)
})

test('code conflict retries and creates next available code', async () => {
  const { state, result } = await createInviteWithDeps({}, {
    codeSequence: ['ABCD2345', 'JKLM6789'],
    invites: [
      {
        code: 'ABCD2345'
      }
    ]
  })

  assert.equal(result.success, true)
  assert.equal(state.invites.length, 2)
  assert.equal(state.invites[1].code, 'JKLM6789')
})

test('code generation fails after repeated conflicts', async () => {
  const { state, result } = await createInviteWithDeps({}, {
    codeSequence: ['ABCD2345', 'ABCD2345', 'ABCD2345', 'ABCD2345', 'ABCD2345'],
    invites: [
      {
        code: 'ABCD2345'
      }
    ]
  })

  assert.equal(result.success, false)
  assert.equal(result.code, 'INVITE_CODE_GENERATE_FAILED')
  assert.equal(state.invites.length, 1)
})

test('createMerchantSignupInvite does not write merchants or merchant_staff and returns no merchant admin token', async () => {
  const { state, result } = await createInviteWithDeps()

  assert.equal(result.success, true)
  assert.equal(state.merchantWrites, 0)
  assert.equal(state.staffWrites, 0)
  assert.equal(result.data.session, undefined)
  assert.equal(result.data.token, undefined)
})

test('createMerchantSignupInvite success response does not leak admin token or token secret', async () => {
  const adminToken = createWebToken()
  const { deps } = createDeps()
  const { createMerchantSelfServiceHandler } = loadService()
  const handler = createMerchantSelfServiceHandler(deps)

  const result = await handler({
    action: 'createMerchantSignupInvite',
    admin_token: adminToken,
    remark: 'safe response'
  })

  assert.equal(result.success, true)
  assertResponseDoesNotLeak(result, [adminToken])
})

test('createMerchantSignupInvite failure response does not leak admin token or token secret', async () => {
  const adminToken = `${createWebToken()}x`
  const { deps } = createDeps()
  const { createMerchantSelfServiceHandler } = loadService()
  const handler = createMerchantSelfServiceHandler(deps)

  const result = await handler({
    action: 'createMerchantSignupInvite',
    admin_token: adminToken
  })

  assert.equal(result.success, false)
  assertResponseDoesNotLeak(result, [adminToken])
})

test('createMerchantSignupInvite internal error response does not leak stack details', async () => {
  const { deps } = createDeps({
    createInvite: async () => {
      const error = new Error(INTERNAL_STACK_MARKER)
      error.stack = `Error: ${INTERNAL_STACK_MARKER}\n    at private-file.js:1:1`
      throw error
    }
  })
  const { createMerchantSelfServiceHandler } = loadService()
  const handler = createMerchantSelfServiceHandler(deps)

  const result = await handler({
    action: 'createMerchantSignupInvite',
    admin_token: createWebToken()
  })

  assert.equal(result.success, false)
  assert.equal(result.code, 'INTERNAL_ERROR')
  assertResponseDoesNotLeak(result, [INTERNAL_STACK_MARKER])
})

function matchesQuery(record, query = {}) {
  return Object.entries(query).every(([key, value]) => record[key] === value)
}

function createIndexCloudMock(options = {}) {
  const state = {
    invites: options.invites || [],
    merchants: options.merchants || [],
    staff: options.staff || [],
    inviteUpdates: 0,
    inviteRemoves: 0,
    merchantAdds: 0,
    merchantUpdates: 0,
    staffAdds: 0,
    staffUpdates: 0
  }

  function createQuery(collectionName, query = {}) {
    const queryApi = {
      where(nextQuery) {
        return createQuery(collectionName, nextQuery)
      },
      limit() {
        return queryApi
      },
      async get() {
        const sources = {
          merchant_invites: state.invites,
          merchants: state.merchants,
          merchant_staff: state.staff
        }
        const source = sources[collectionName] || []
        return {
          data: source.filter((record) => matchesQuery(record, query))
        }
      },
      async update({ data }) {
        const sources = {
          merchant_invites: state.invites,
          merchants: state.merchants,
          merchant_staff: state.staff
        }
        const source = sources[collectionName] || []
        const matched = source.filter((record) => matchesQuery(record, query))
        matched.forEach((record) => {
          Object.assign(record, data)
        })

        if (collectionName === 'merchant_invites') {
          state.inviteUpdates += matched.length
        }
        if (collectionName === 'merchants') {
          state.merchantUpdates += matched.length
        }
        if (collectionName === 'merchant_staff') {
          state.staffUpdates += matched.length
        }

        return {
          stats: {
            updated: matched.length
          }
        }
      }
    }

    return queryApi
  }

  const db = {
    collection(collectionName) {
      return {
      where(query) {
          return createQuery(collectionName, query)
        },
        doc() {
          return {
            async update() {
              state.inviteUpdates += 1
              throw new Error('SHOULD_NOT_UPDATE_INVITE')
            },
            async remove() {
              state.inviteRemoves += 1
              throw new Error('SHOULD_NOT_REMOVE_INVITE')
            }
          }
        },
        async add({ data }) {
          if (collectionName === 'merchants') {
            state.merchantAdds += 1
            const record = {
              _id: `merchant_${data.merchant_id}`,
              ...data
            }
            state.merchants.push(record)

            return {
              _id: record._id
            }
          }

          if (collectionName === 'merchant_staff') {
            state.staffAdds += 1
            const record = {
              _id: data.staff_id,
              ...data
            }
            state.staff.push(record)

            return {
              _id: record._id
            }
          }

          if (collectionName !== 'merchant_invites') {
            throw new Error(`UNEXPECTED_COLLECTION_WRITE_${collectionName}`)
          }

          const record = {
            _id: `invite_${data.code}`,
            ...data
          }
          state.invites.push(record)

          return {
            _id: record._id
          }
        }
      }
    }
  }

  return {
    state,
    cloud: {
      DYNAMIC_CURRENT_ENV: 'test-env',
      init: () => {},
      database: () => db,
      getWXContext: () => ({
        OPENID: ''
      })
    }
  }
}

function loadMerchantSelfServiceIndexWithCloudMock(cloudMock) {
  const indexPath = require.resolve('./index')
  delete require.cache[indexPath]

  const originalLoad = Module._load
  Module._load = function loadMockedModule(request, parent, isMain) {
    if (request === 'wx-server-sdk') {
      return cloudMock
    }

    return originalLoad.call(this, request, parent, isMain)
  }

  try {
    return require('./index').main
  } finally {
    Module._load = originalLoad
  }
}

test('index entry creates merchant signup invite through cloud database', async () => {
  const originalSecret = process.env.WEB_ADMIN_TOKEN_SECRET
  process.env.WEB_ADMIN_TOKEN_SECRET = TOKEN_SECRET

  try {
    const { state, cloud } = createIndexCloudMock()
    const main = loadMerchantSelfServiceIndexWithCloudMock(cloud)

    const result = await main({
      action: 'createMerchantSignupInvite',
      admin_token: createWebToken(),
      expires_in_days: 3,
      remark: 'index entry'
    })

    assert.equal(result.success, true)
    assert.equal(state.invites.length, 1)
    assert.equal(state.invites[0].invite_type, 'merchant_signup')
    assert.equal(state.invites[0].merchant_id, '')
    assert.equal(state.invites[0].used_merchant_id, '')
    assert.equal(state.invites[0].role, 'owner')
    assert.equal(state.invites[0].status, 'unused')
    assert.equal(state.invites[0].remark, 'index entry')
    assert.equal(state.merchantAdds, 0)
    assert.equal(state.staffAdds, 0)
  } finally {
    if (originalSecret === undefined) {
      delete process.env.WEB_ADMIN_TOKEN_SECRET
    } else {
      process.env.WEB_ADMIN_TOKEN_SECRET = originalSecret
    }
  }
})

test('index entry redeems merchant signup invite through cloud database', async () => {
  const originalSecret = process.env.WEB_ADMIN_TOKEN_SECRET
  const originalTtl = process.env.MERCHANT_ADMIN_TOKEN_TTL_MINUTES
  process.env.WEB_ADMIN_TOKEN_SECRET = TOKEN_SECRET
  process.env.MERCHANT_ADMIN_TOKEN_TTL_MINUTES = '240'

  try {
    const { state, cloud } = createIndexCloudMock({
      invites: [
        createPreviewInvite({
          used_by_openid: '',
          used_by_account_id: ''
        })
      ]
    })
    const main = loadMerchantSelfServiceIndexWithCloudMock(cloud)

    const result = await main(createRedeemPayload({
      merchant_slug: 'index-kitchen',
      login_name: 'index-owner'
    }))

    assert.equal(result.success, true)
    assert.equal(result.data.merchant.merchant_id, 'index-kitchen')
    assert.equal(result.data.session.role, 'merchant_admin')
    assert.equal(result.data.session.merchant_id, 'index-kitchen')
    assert.ok(result.data.session.token)
    assert.equal(state.merchants.length, 1)
    assert.equal(state.merchants[0].merchant_id, 'index-kitchen')
    assert.equal(state.merchants[0].status, 'active')
    assert.equal(state.staff.length, 1)
    assert.equal(state.staff[0].merchant_id, 'index-kitchen')
    assert.equal(state.staff[0].role, 'owner')
    assert.equal(state.staff[0].status, 'active')
    assert.equal(state.staff[0].password, undefined)
    assert.ok(state.staff[0].password_hash)
    assert.ok(state.staff[0].password_salt)
    assert.equal(state.invites[0].status, 'used')
    assert.equal(state.invites[0].used_merchant_id, 'index-kitchen')
    assert.equal(state.invites[0].used_by_openid, '')
    assert.equal(state.inviteUpdates, 1)
    assert.equal(state.merchantAdds, 1)
    assert.equal(state.staffAdds, 1)
  } finally {
    if (originalSecret === undefined) {
      delete process.env.WEB_ADMIN_TOKEN_SECRET
    } else {
      process.env.WEB_ADMIN_TOKEN_SECRET = originalSecret
    }

    if (originalTtl === undefined) {
      delete process.env.MERCHANT_ADMIN_TOKEN_TTL_MINUTES
    } else {
      process.env.MERCHANT_ADMIN_TOKEN_TTL_MINUTES = originalTtl
    }
  }
})

test('index entry logs merchant admin in through cloud database', async () => {
  const originalSecret = process.env.WEB_ADMIN_TOKEN_SECRET
  const originalTtl = process.env.MERCHANT_ADMIN_TOKEN_TTL_MINUTES
  process.env.WEB_ADMIN_TOKEN_SECRET = TOKEN_SECRET
  process.env.MERCHANT_ADMIN_TOKEN_TTL_MINUTES = '240'

  try {
    const { state, cloud } = createIndexCloudMock({
      merchants: [createLoginMerchant({ merchant_id: 'index-kitchen', merchant_slug: 'index-kitchen' })],
      staff: [createLoginStaff({
        merchant_id: 'index-kitchen',
        login_name: 'index-owner'
      })]
    })
    const main = loadMerchantSelfServiceIndexWithCloudMock(cloud)

    const result = await main(createLoginPayload({
      merchant_slug: 'index-kitchen',
      login_name: 'index-owner'
    }))

    assert.equal(result.success, true)
    assert.equal(result.data.merchant.merchant_id, 'index-kitchen')
    assert.equal(result.data.session.role, 'merchant_admin')
    assert.equal(result.data.session.merchant_id, 'index-kitchen')
    assert.ok(result.data.session.token)
    assert.equal(state.merchants.length, 1)
    assert.equal(state.staff.length, 1)
    assert.equal(state.staff[0].last_login_at instanceof Date, true)
    assert.equal(state.staff[0].updated_at instanceof Date, true)
    assert.equal(state.staffUpdates, 1)
    assert.equal(state.merchantAdds, 0)
    assert.equal(state.staffAdds, 0)
    assert.equal(state.inviteUpdates, 0)
  } finally {
    if (originalSecret === undefined) {
      delete process.env.WEB_ADMIN_TOKEN_SECRET
    } else {
      process.env.WEB_ADMIN_TOKEN_SECRET = originalSecret
    }

    if (originalTtl === undefined) {
      delete process.env.MERCHANT_ADMIN_TOKEN_TTL_MINUTES
    } else {
      process.env.MERCHANT_ADMIN_TOKEN_TTL_MINUTES = originalTtl
    }
  }
})

test('index entry previews merchant signup invite through cloud database without writes', async () => {
  const originalSecret = process.env.WEB_ADMIN_TOKEN_SECRET
  process.env.WEB_ADMIN_TOKEN_SECRET = TOKEN_SECRET

  try {
    const { state, cloud } = createIndexCloudMock({
      invites: [createPreviewInvite()]
    })
    const main = loadMerchantSelfServiceIndexWithCloudMock(cloud)

    const result = await main({
      action: 'previewMerchantSignupInvite',
      code: 'ABCD2345'
    })

    assert.equal(result.success, true)
    assert.equal(result.data.invite.code, 'ABCD2345')
    assert.equal(result.data.invite.can_use, true)
    assert.equal(state.invites.length, 1)
    assert.equal(state.inviteUpdates, 0)
    assert.equal(state.inviteRemoves, 0)
    assert.equal(state.merchantAdds, 0)
    assert.equal(state.staffAdds, 0)
  } finally {
    if (originalSecret === undefined) {
      delete process.env.WEB_ADMIN_TOKEN_SECRET
    } else {
      process.env.WEB_ADMIN_TOKEN_SECRET = originalSecret
    }
  }
})
