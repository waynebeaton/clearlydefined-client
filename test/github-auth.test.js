'use strict'

const test = require('node:test')
const assert = require('node:assert')

const { GitHubAuth } = require('../src/main/github-auth')

function responder(responses) {
  const calls = []
  const fetchImpl = async (url, options = {}) => {
    calls.push({ url, options, body: options.body ? JSON.parse(options.body) : null })
    const next = responses.shift()
    const { status = 200, body = {} } = typeof next === 'function' ? next() : next
    return {
      ok: status >= 200 && status < 300,
      status,
      text: async () => JSON.stringify(body),
      json: async () => body
    }
  }
  return { fetchImpl, calls }
}

function authFor(responses, overrides = {}) {
  const { fetchImpl, calls } = responder(responses)
  const auth = new GitHubAuth({
    clientId: 'client-id',
    fetchImpl,
    wait: async () => {},
    ...overrides
  })
  return { auth, calls }
}

test('requests a device code', async () => {
  const { auth, calls } = authFor([
    {
      body: {
        device_code: 'device',
        user_code: 'ABCD-1234',
        verification_uri: 'https://github.com/login/device',
        interval: 5,
        expires_in: 900
      }
    }
  ])
  const request = await auth.requestDeviceCode()
  assert.strictEqual(calls[0].body.client_id, 'client-id')
  assert.strictEqual(calls[0].body.scope, 'public_repo')
  assert.deepStrictEqual(request, {
    deviceCode: 'device',
    userCode: 'ABCD-1234',
    verificationUri: 'https://github.com/login/device',
    interval: 5,
    expiresIn: 900
  })
})

test('a device code cannot be requested without a client id', async () => {
  const auth = new GitHubAuth({ fetchImpl: async () => {} })
  assert.strictEqual(auth.isConfigured, false)
  await assert.rejects(() => auth.requestDeviceCode(), /No GitHub OAuth client id/)
})

test('polls until the user authorizes the request', async () => {
  const { auth, calls } = authFor([
    { body: { error: 'authorization_pending' } },
    { body: { error: 'slow_down', interval: 5 } },
    { body: { access_token: 'gho_token' } }
  ])
  const token = await auth.pollForAccessToken({ deviceCode: 'device', interval: 1, expiresIn: 900 })
  assert.strictEqual(token, 'gho_token')
  assert.strictEqual(calls.length, 3)
  assert.strictEqual(calls[0].body.grant_type, 'urn:ietf:params:oauth:grant-type:device_code')
})

test('reports a denied authorization', async () => {
  const { auth } = authFor([{ status: 400, body: { error: 'access_denied', error_description: 'denied' } }])
  await assert.rejects(
    () => auth.pollForAccessToken({ deviceCode: 'device', interval: 1, expiresIn: 900 }),
    /denied/
  )
})

test('stops polling once the device code expires', async () => {
  const { auth } = authFor([])
  await assert.rejects(
    () => auth.pollForAccessToken({ deviceCode: 'device', interval: 1, expiresIn: 0 }),
    /Timed out/
  )
})

test('looks up the owner of a token', async () => {
  const { auth, calls } = authFor([{ body: { login: 'octocat', name: 'The Octocat' } }])
  const user = await auth.getUser('gho_token')
  assert.strictEqual(calls[0].options.headers.Authorization, ['Bearer', 'gho_token'].join(' '))
  assert.deepStrictEqual(user, { login: 'octocat', name: 'The Octocat', avatarUrl: null })
})

test('rejects an invalid token', async () => {
  const { auth } = authFor([{ status: 401, body: {} }])
  await assert.rejects(() => auth.getUser('bad'), /token was rejected \(401\)/)
  await assert.rejects(() => auth.getUser(''), /token is required/)
})
