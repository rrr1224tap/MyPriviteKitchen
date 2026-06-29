const assert = require('node:assert/strict')
const test = require('node:test')
const crypto = require('node:crypto')

const {
  createWebAdminAuthHandler,
  createSignedToken,
  hashPasscode
} = require('./web-admin-auth-service')

const FIXED_NOW = new Date('2026-06-29T08:00:00.000Z')
const SECRET = 'unit-test-secret-with-enough-length'
const PASSCODE = 'xiaochu-admin-passcode'

function createDeps(overrides = {}) {
  return {
    getPasscodeHash: () => overrides.passcodeHash,
    getPasscode: () => overrides.passcode === undefined ? PASSCODE : overrides.passcode,
    getTokenSecret: () => overrides.tokenSecret === undefined ? SECRET : overrides.tokenSecret,
    getTokenTtlMinutes: () => overrides.ttlMinutes,
    now: () => overrides.now || FIXED_NOW,
    createNonce: () => overrides.nonce || 'nonce-for-test',
    logger: {
      error() {}
    }
  }
}

async function callAuth(event, overrides = {}) {
  const handler = createWebAdminAuthHandler(createDeps(overrides))
  return handler(event)
}

test('correct fallback passcode logs in and returns signed super admin token', async () => {
  const result = await callAuth({
    action: 'login',
    passcode: PASSCODE
  })

  assert.equal(result.success, true)
  assert.equal(result.data.role, 'super_admin')
  assert.equal(result.data.expires_at, '2026-06-29T12:00:00.000Z')
  assert.equal(typeof result.data.token, 'string')
  assert.equal(result.data.token.split('.').length, 2)
})

test('http gateway string body can log in', async () => {
  const result = await callAuth({
    body: JSON.stringify({
      action: 'login',
      passcode: PASSCODE
    })
  })

  assert.equal(result.success, true)
  assert.equal(result.data.role, 'super_admin')
  assert.equal(typeof result.data.token, 'string')
})

test('http gateway object body can log in', async () => {
  const result = await callAuth({
    body: {
      action: 'login',
      passcode: PASSCODE
    }
  })

  assert.equal(result.success, true)
  assert.equal(result.data.role, 'super_admin')
  assert.equal(typeof result.data.token, 'string')
})

test('direct event action takes priority over http gateway body action', async () => {
  const result = await callAuth({
    action: 'login',
    passcode: PASSCODE,
    body: JSON.stringify({
      action: 'verify',
      token: ''
    })
  })

  assert.equal(result.success, true)
  assert.equal(result.data.role, 'super_admin')
})

test('http gateway query string parameters can log in', async () => {
  const result = await callAuth({
    queryStringParameters: {
      action: 'login',
      passcode: PASSCODE
    }
  })

  assert.equal(result.success, true)
  assert.equal(result.data.role, 'super_admin')
})

test('wrong passcode fails without returning token', async () => {
  const result = await callAuth({
    action: 'login',
    passcode: 'wrong-passcode'
  })

  assert.equal(result.success, false)
  assert.equal(result.error.code, 'INVALID_PASSCODE')
  assert.equal(result.data, undefined)
})

test('empty passcode fails', async () => {
  const result = await callAuth({
    action: 'login',
    passcode: ''
  })

  assert.equal(result.success, false)
  assert.equal(result.error.code, 'INVALID_PASSCODE')
})

test('missing action returns invalid action', async () => {
  const result = await callAuth({
    passcode: PASSCODE
  })

  assert.equal(result.success, false)
  assert.equal(result.error.code, 'INVALID_ACTION')
})

test('missing token secret returns server config error', async () => {
  const result = await callAuth({
    action: 'login',
    passcode: PASSCODE
  }, {
    tokenSecret: ''
  })

  assert.equal(result.success, false)
  assert.equal(result.error.code, 'SERVER_CONFIG_ERROR')
})

test('hashed passcode config can log in', async () => {
  const result = await callAuth({
    action: 'login',
    passcode: PASSCODE
  }, {
    passcodeHash: hashPasscode(PASSCODE),
    passcode: ''
  })

  assert.equal(result.success, true)
  assert.equal(result.data.role, 'super_admin')
})

test('passcode hash takes priority over fallback plain passcode', async () => {
  const result = await callAuth({
    action: 'login',
    passcode: PASSCODE
  }, {
    passcodeHash: hashPasscode('different-passcode'),
    passcode: PASSCODE
  })

  assert.equal(result.success, false)
  assert.equal(result.error.code, 'INVALID_PASSCODE')
})

test('missing passcode config returns server config error on login', async () => {
  const result = await callAuth({
    action: 'login',
    passcode: PASSCODE
  }, {
    passcodeHash: '',
    passcode: ''
  })

  assert.equal(result.success, false)
  assert.equal(result.error.code, 'SERVER_CONFIG_ERROR')
})

test('verify accepts valid token', async () => {
  const loginResult = await callAuth({
    action: 'login',
    passcode: PASSCODE
  })

  const verifyResult = await callAuth({
    action: 'verify',
    token: loginResult.data.token
  })

  assert.equal(verifyResult.success, true)
  assert.equal(verifyResult.data.valid, true)
  assert.equal(verifyResult.data.role, 'super_admin')
  assert.equal(verifyResult.data.expires_at, '2026-06-29T12:00:00.000Z')
})

test('http gateway string body can verify valid token', async () => {
  const loginResult = await callAuth({
    action: 'login',
    passcode: PASSCODE
  })

  const verifyResult = await callAuth({
    body: JSON.stringify({
      action: 'verify',
      token: loginResult.data.token
    })
  })

  assert.equal(verifyResult.success, true)
  assert.equal(verifyResult.data.valid, true)
  assert.equal(verifyResult.data.role, 'super_admin')
})

test('invalid http body json returns invalid action without crashing', async () => {
  const result = await callAuth({
    body: '{"action":"login"'
  })

  assert.equal(result.success, false)
  assert.equal(result.error.code, 'INVALID_ACTION')
})

test('verify empty token fails unauthorized', async () => {
  const result = await callAuth({
    action: 'verify',
    token: ''
  })

  assert.equal(result.success, false)
  assert.equal(result.error.code, 'UNAUTHORIZED')
})

test('verify malformed token fails unauthorized', async () => {
  const result = await callAuth({
    action: 'verify',
    token: 'not-a-valid-token'
  })

  assert.equal(result.success, false)
  assert.equal(result.error.code, 'UNAUTHORIZED')
})

test('verify tampered token fails unauthorized', async () => {
  const loginResult = await callAuth({
    action: 'login',
    passcode: PASSCODE
  })
  const token = `${loginResult.data.token.slice(0, -2)}xx`

  const result = await callAuth({
    action: 'verify',
    token
  })

  assert.equal(result.success, false)
  assert.equal(result.error.code, 'UNAUTHORIZED')
})

test('verify expired token fails token expired', async () => {
  const token = createSignedToken({
    role: 'super_admin',
    now: new Date('2026-06-29T01:00:00.000Z'),
    ttlMinutes: 10,
    nonce: 'old-token',
    secret: SECRET
  }).token

  const result = await callAuth({
    action: 'verify',
    token
  })

  assert.equal(result.success, false)
  assert.equal(result.error.code, 'TOKEN_EXPIRED')
})

test('verify non super admin role fails unauthorized', async () => {
  const token = createSignedToken({
    role: 'staff',
    now: FIXED_NOW,
    ttlMinutes: 240,
    nonce: 'staff-token',
    secret: SECRET
  }).token

  const result = await callAuth({
    action: 'verify',
    token
  })

  assert.equal(result.success, false)
  assert.equal(result.error.code, 'UNAUTHORIZED')
})

test('token payload does not contain passcode secret or openid', async () => {
  const result = await callAuth({
    action: 'login',
    passcode: PASSCODE
  })

  const payloadText = Buffer.from(result.data.token.split('.')[0], 'base64url').toString('utf8')

  assert.equal(payloadText.includes(PASSCODE), false)
  assert.equal(payloadText.includes(SECRET), false)
  assert.equal(payloadText.includes('openid'), false)
})

test('default ttl is 240 minutes and custom ttl is supported', async () => {
  const defaultResult = await callAuth({
    action: 'login',
    passcode: PASSCODE
  })
  const customResult = await callAuth({
    action: 'login',
    passcode: PASSCODE
  }, {
    ttlMinutes: '30'
  })

  assert.equal(defaultResult.data.expires_at, '2026-06-29T12:00:00.000Z')
  assert.equal(customResult.data.expires_at, '2026-06-29T08:30:00.000Z')
})

test('return structure is unified', async () => {
  const successResult = await callAuth({
    action: 'login',
    passcode: PASSCODE
  })
  const failureResult = await callAuth({
    action: 'login',
    passcode: 'bad'
  })

  assert.deepEqual(Object.keys(successResult).sort(), ['data', 'success'])
  assert.deepEqual(Object.keys(failureResult).sort(), ['error', 'success'])
  assert.deepEqual(Object.keys(failureResult.error).sort(), ['code', 'message'])
})

test('web admin auth does not require database dependencies', async () => {
  const calls = {
    database: 0
  }
  const deps = {
    ...createDeps(),
    touchDatabase: () => {
      calls.database += 1
    }
  }
  const handler = createWebAdminAuthHandler(deps)

  await handler({
    action: 'login',
    passcode: PASSCODE
  })

  assert.equal(calls.database, 0)
})

test('hashPasscode returns sha256 hex digest', () => {
  const expected = crypto.createHash('sha256').update(PASSCODE).digest('hex')

  assert.equal(hashPasscode(PASSCODE), expected)
})
