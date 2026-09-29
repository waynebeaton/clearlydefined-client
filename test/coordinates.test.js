'use strict'

const test = require('node:test')
const assert = require('node:assert')

const { parseCoordinates, formatCoordinates } = require('../src/shared/coordinates')

test('parses coordinates with a revision', () => {
  assert.deepStrictEqual(parseCoordinates('npm/npmjs/-/lodash/4.17.21'), {
    type: 'npm',
    provider: 'npmjs',
    namespace: null,
    name: 'lodash',
    revision: '4.17.21'
  })
})

test('parses coordinates with a namespace and no revision', () => {
  assert.deepStrictEqual(parseCoordinates('maven/mavencentral/org.apache.commons/commons-lang3'), {
    type: 'maven',
    provider: 'mavencentral',
    namespace: 'org.apache.commons',
    name: 'commons-lang3',
    revision: null
  })
})

test('rejects incomplete coordinates', () => {
  assert.throws(() => parseCoordinates('npm/npmjs/lodash'), /Invalid coordinates/)
  assert.throws(() => parseCoordinates(42), /must be a string/)
})

test('formats coordinates, using - for a missing namespace', () => {
  assert.strictEqual(
    formatCoordinates({ type: 'npm', provider: 'npmjs', namespace: null, name: 'lodash', revision: '4.17.21' }),
    'npm/npmjs/-/lodash/4.17.21'
  )
  assert.strictEqual(
    formatCoordinates({ type: 'npm', provider: 'npmjs', name: 'lodash' }),
    'npm/npmjs/-/lodash'
  )
})
