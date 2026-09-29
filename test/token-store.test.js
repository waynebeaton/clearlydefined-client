'use strict'

const test = require('node:test')
const assert = require('node:assert')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')

const { TokenStore } = require('../src/main/token-store')

// Stand-in for Electron's safeStorage.
function fakeSafeStorage(available = true) {
  return {
    isEncryptionAvailable: () => available,
    encryptString: value => Buffer.from(`enc:${value}`),
    decryptString: buffer => buffer.toString().replace(/^enc:/, '')
  }
}

function tempFile() {
  return path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'cd-client-')), 'github-token.bin')
}

test('stores and reloads an encrypted token', () => {
  const filePath = tempFile()
  const store = new TokenStore({ filePath, safeStorage: fakeSafeStorage() })
  assert.strictEqual(store.save('gho_token'), true)
  assert.strictEqual(fs.existsSync(filePath), true)

  const reloaded = new TokenStore({ filePath, safeStorage: fakeSafeStorage() })
  assert.strictEqual(reloaded.load(), 'gho_token')
})

test('clearing removes the stored token', () => {
  const filePath = tempFile()
  const store = new TokenStore({ filePath, safeStorage: fakeSafeStorage() })
  store.save('gho_token')
  store.clear()
  assert.strictEqual(fs.existsSync(filePath), false)
  assert.strictEqual(new TokenStore({ filePath, safeStorage: fakeSafeStorage() }).load(), null)
})

test('keeps the token in memory when encryption is unavailable', () => {
  const filePath = tempFile()
  const store = new TokenStore({ filePath, safeStorage: fakeSafeStorage(false) })
  assert.strictEqual(store.canPersist, false)
  assert.strictEqual(store.save('gho_token'), false)
  assert.strictEqual(store.load(), 'gho_token')
  assert.strictEqual(fs.existsSync(filePath), false)
})

test('unreadable token files are ignored', () => {
  const filePath = tempFile()
  fs.writeFileSync(filePath, 'not encrypted')
  const store = new TokenStore({
    filePath,
    safeStorage: {
      isEncryptionAvailable: () => true,
      encryptString: value => Buffer.from(value),
      decryptString: () => {
        throw new Error('cannot decrypt')
      }
    }
  })
  assert.strictEqual(store.load(), null)
})
