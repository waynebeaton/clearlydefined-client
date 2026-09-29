'use strict'

const test = require('node:test')
const assert = require('node:assert')

const { ClearlyDefinedClient } = require('../src/main/clearlydefined')

function fakeFetch(handler) {
  const calls = []
  const fetchImpl = async (url, options = {}) => {
    calls.push({ url, options })
    const { status = 200, body = '' } = handler(url, options) || {}
    return {
      ok: status >= 200 && status < 300,
      status,
      text: async () => (typeof body === 'string' ? body : JSON.stringify(body))
    }
  }
  return { fetchImpl, calls }
}

test('search returns parsed coordinates and skips unusable entries', async () => {
  const { fetchImpl, calls } = fakeFetch(() => ({
    body: ['npm/npmjs/-/lodash/4.17.21', 'nonsense']
  }))
  const client = new ClearlyDefinedClient({ baseUrl: 'https://example.test', fetchImpl })
  const results = await client.search('lodash')
  assert.strictEqual(calls[0].url, 'https://example.test/definitions?pattern=lodash')
  assert.deepStrictEqual(results, [
    { type: 'npm', provider: 'npmjs', namespace: null, name: 'lodash', revision: '4.17.21' }
  ])
})

test('search requires a term', async () => {
  const client = new ClearlyDefinedClient({ baseUrl: 'https://example.test', fetchImpl: async () => {} })
  await assert.rejects(() => client.search('  '), /search term is required/)
})

test('getDefinition requests the definition of a revision', async () => {
  const { fetchImpl, calls } = fakeFetch(() => ({ body: { licensed: { declared: 'MIT' } } }))
  const client = new ClearlyDefinedClient({ baseUrl: 'https://example.test', fetchImpl })
  const definition = await client.getDefinition({
    type: 'npm',
    provider: 'npmjs',
    namespace: null,
    name: 'lodash',
    revision: '4.17.21'
  })
  assert.strictEqual(calls[0].url, 'https://example.test/definitions/npm/npmjs/-/lodash/4.17.21')
  assert.deepStrictEqual(definition, { licensed: { declared: 'MIT' } })
})

test('getDefinition requires a revision', async () => {
  const client = new ClearlyDefinedClient({ baseUrl: 'https://example.test', fetchImpl: async () => {} })
  await assert.rejects(
    () => client.getDefinition({ type: 'npm', provider: 'npmjs', name: 'lodash' }),
    /revision is required/
  )
})

test('submitCuration sends an authenticated patch request', async () => {
  const { fetchImpl, calls } = fakeFetch(() => ({ body: { url: 'https://github.com/pr/1' } }))
  const client = new ClearlyDefinedClient({ baseUrl: 'https://example.test', fetchImpl })
  const result = await client.submitCuration({
    coordinates: { type: 'npm', provider: 'npmjs', namespace: null, name: 'lodash', revision: '4.17.21' },
    patch: { licensed: { declared: 'Apache-2.0' } },
    contributionInfo: { summary: 'Fix the license', type: 'incorrect' },
    token: 'secret-token'
  })

  const call = calls[0]
  assert.strictEqual(call.url, 'https://example.test/curations')
  assert.strictEqual(call.options.method, 'PATCH')
  assert.strictEqual(call.options.headers.Authorization, ['Bearer', 'secret-token'].join(' '))
  assert.deepStrictEqual(JSON.parse(call.options.body), {
    contributionInfo: {
      type: 'incorrect',
      summary: 'Fix the license',
      details: '',
      resolution: '',
      removeDefinitions: false
    },
    patches: [
      {
        coordinates: { type: 'npm', provider: 'npmjs', namespace: null, name: 'lodash' },
        revisions: { '4.17.21': { licensed: { declared: 'Apache-2.0' } } }
      }
    ]
  })
  assert.deepStrictEqual(result, { url: 'https://github.com/pr/1' })
})

test('submitCuration validates its inputs', async () => {
  const client = new ClearlyDefinedClient({ baseUrl: 'https://example.test', fetchImpl: async () => {} })
  const coordinates = { type: 'npm', provider: 'npmjs', name: 'lodash', revision: '4.17.21' }
  const patch = { licensed: { declared: 'MIT' } }
  const contributionInfo = { summary: 'Fix' }

  await assert.rejects(() => client.submitCuration({ coordinates, patch, contributionInfo }), /token is required/)
  await assert.rejects(
    () => client.submitCuration({ coordinates, patch: {}, contributionInfo, token: 't' }),
    /no changes to contribute/
  )
  await assert.rejects(
    () => client.submitCuration({ coordinates, patch, contributionInfo: {}, token: 't' }),
    /summary is required/
  )
  await assert.rejects(
    () =>
      client.submitCuration({
        coordinates: { type: 'npm', provider: 'npmjs', name: 'lodash' },
        patch,
        contributionInfo,
        token: 't'
      }),
    /revision is required/
  )
})

test('failed requests report the status and message', async () => {
  const { fetchImpl } = fakeFetch(() => ({ status: 404, body: { message: 'not found' } }))
  const client = new ClearlyDefinedClient({ baseUrl: 'https://example.test', fetchImpl })
  await assert.rejects(
    () =>
      client.getDefinition({ type: 'npm', provider: 'npmjs', name: 'nope', revision: '1.0.0' }),
    /failed \(404\): not found/
  )
})

test('network failures are reported clearly', async () => {
  const client = new ClearlyDefinedClient({
    baseUrl: 'https://example.test',
    fetchImpl: async () => {
      throw new Error('offline')
    }
  })
  await assert.rejects(() => client.search('lodash'), /Unable to reach ClearlyDefined: offline/)
})
