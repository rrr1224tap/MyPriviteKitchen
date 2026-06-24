const assert = require('node:assert/strict')
const test = require('node:test')

const {
  createGetAdminProfileHandler,
  maskOpenid,
  parseSuperAdminOpenids
} = require('./admin-profile-service')

test('super admin openid returns admin profile', async () => {
  let writeCalls = 0
  const handler = createGetAdminProfileHandler({
    getOpenid: () => 'admin_openid_001',
    getSuperAdminOpenids: () => ['admin_openid_001'],
    recordWrite: () => {
      writeCalls += 1
    }
  })

  const result = await handler()

  assert.equal(result.success, true)
  assert.equal(result.code, 'SUCCESS')
  assert.equal(result.data.ok, true)
  assert.equal(result.data.is_super_admin, true)
  assert.equal(result.data.can_enter_admin, true)
  assert.equal(result.data.role, 'super_admin')
  assert.equal(writeCalls, 0)
})

test('non super admin openid returns non-admin profile', async () => {
  const handler = createGetAdminProfileHandler({
    getOpenid: () => 'normal_openid_001',
    getSuperAdminOpenids: () => ['admin_openid_001']
  })

  const result = await handler()

  assert.equal(result.success, true)
  assert.equal(result.code, 'SUCCESS')
  assert.equal(result.data.is_super_admin, false)
  assert.equal(result.data.can_enter_admin, false)
  assert.equal(result.data.role, 'user')
})

test('missing openid does not crash and returns unauthorized', async () => {
  const handler = createGetAdminProfileHandler({
    getOpenid: () => ''
  })

  const result = await handler()

  assert.equal(result.success, false)
  assert.equal(result.code, 'UNAUTHORIZED')
  assert.equal(result.data, null)
})

test('multiple whitelist openids are supported', async () => {
  const handler = createGetAdminProfileHandler({
    getOpenid: () => 'admin_openid_002',
    getSuperAdminOpenids: () => ['admin_openid_001', 'admin_openid_002', 'admin_openid_003']
  })

  const result = await handler()

  assert.equal(result.success, true)
  assert.equal(result.data.is_super_admin, true)
})

test('environment openid list parser trims and removes empty values', () => {
  assert.deepEqual(
    parseSuperAdminOpenids(' admin_openid_001, ,admin_openid_002 ,, '),
    ['admin_openid_001', 'admin_openid_002']
  )
})

test('return structure is stable and masks openid', async () => {
  const handler = createGetAdminProfileHandler({
    getOpenid: () => 'openid_abcdef123456',
    getSuperAdminOpenids: () => ['openid_abcdef123456']
  })

  const result = await handler()

  assert.deepEqual(Object.keys(result).sort(), ['code', 'data', 'message', 'success'])
  assert.equal(result.data.openid, 'openid_abcdef123456')
  assert.equal(result.data.masked_openid, 'open****3456')
  assert.equal(result.data.source, 'SUPER_ADMIN_OPENIDS')
})

test('merchant identity data is not modified', async () => {
  const merchantStaff = Object.freeze({
    openid: 'admin_openid_001',
    status: 'active',
    role: 'staff'
  })
  let updateCalls = 0
  const handler = createGetAdminProfileHandler({
    getOpenid: () => merchantStaff.openid,
    getSuperAdminOpenids: () => ['admin_openid_001'],
    merchantStaff,
    updateMerchantStaff: () => {
      updateCalls += 1
    }
  })

  const result = await handler()

  assert.equal(result.data.is_super_admin, true)
  assert.equal(updateCalls, 0)
  assert.equal(merchantStaff.role, 'staff')
})

test('maskOpenid handles short values', () => {
  assert.equal(maskOpenid('abcd'), 'a**d')
})
