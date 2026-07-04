const test = require('node:test')
const assert = require('node:assert/strict')
const Module = require('node:module')

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
    codeSequence: options.codeSequence || ['ABCD2345', 'JKLM6789', 'PQRS2345', 'WXYZ6789', 'BCDF2345', 'GHJK6789'],
    invites: options.invites || [],
    merchantWrites: 0,
    staffWrites: 0
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
    action: 'previewMerchantSignupInvite',
    admin_token: createWebToken()
  })

  assert.equal(result.success, false)
  assert.equal(result.code, 'INVALID_ACTION')
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
    merchantAdds: 0,
    staffAdds: 0
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
        const source = collectionName === 'merchant_invites' ? state.invites : []
        return {
          data: source.filter((record) => matchesQuery(record, query))
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
        async add({ data }) {
          if (collectionName === 'merchants') {
            state.merchantAdds += 1
          }

          if (collectionName === 'merchant_staff') {
            state.staffAdds += 1
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
