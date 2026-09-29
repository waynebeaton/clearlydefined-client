'use strict'

const test = require('node:test')
const assert = require('node:assert')

const { extractCuratableValues, buildPatch } = require('../src/shared/curation')

const definition = {
  coordinates: { type: 'npm', provider: 'npmjs', name: 'lodash', revision: '4.17.21' },
  described: {
    releaseDate: '2021-02-20',
    sourceLocation: {
      type: 'git',
      provider: 'github',
      namespace: 'lodash',
      name: 'lodash',
      revision: 'abc123',
      url: 'https://github.com/lodash/lodash/tree/abc123'
    }
  },
  licensed: { declared: 'MIT' }
}

test('extracts the curatable values of a definition', () => {
  const values = extractCuratableValues(definition)
  assert.strictEqual(values.declaredLicense, 'MIT')
  assert.strictEqual(values.releaseDate, '2021-02-20')
  assert.strictEqual(values.projectWebsite, '')
  assert.strictEqual(values.sourceLocation.namespace, 'lodash')
})

test('produces an empty patch when nothing changed', () => {
  assert.deepStrictEqual(buildPatch(definition, extractCuratableValues(definition)), {})
})

test('patches only the fields that changed', () => {
  const edits = extractCuratableValues(definition)
  edits.declaredLicense = 'Apache-2.0'
  edits.projectWebsite = 'https://lodash.com'
  assert.deepStrictEqual(buildPatch(definition, edits), {
    licensed: { declared: 'Apache-2.0' },
    described: { projectWebsite: 'https://lodash.com' }
  })
})

test('patches the whole source location when one of its fields changes', () => {
  const edits = extractCuratableValues(definition)
  edits.sourceLocation.revision = 'def456'
  assert.deepStrictEqual(buildPatch(definition, edits), {
    described: {
      sourceLocation: {
        type: 'git',
        provider: 'github',
        namespace: 'lodash',
        name: 'lodash',
        revision: 'def456',
        url: 'https://github.com/lodash/lodash/tree/abc123'
      }
    }
  })
})

test('clears a value with null when it is emptied', () => {
  const edits = extractCuratableValues(definition)
  edits.declaredLicense = '   '
  assert.deepStrictEqual(buildPatch(definition, edits), { licensed: { declared: null } })
})

test('handles a definition without described or licensed data', () => {
  const values = extractCuratableValues({})
  values.declaredLicense = 'MIT'
  assert.deepStrictEqual(buildPatch({}, values), { licensed: { declared: 'MIT' } })
})
