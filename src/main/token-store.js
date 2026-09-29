'use strict'

const fs = require('fs')
const path = require('path')

/**
 * Persists the GitHub access token.
 *
 * The token is only written to disk when the platform provides working
 * encryption (Electron's `safeStorage`). Without it the token is kept in
 * memory for the lifetime of the session rather than being stored in clear
 * text on disk.
 */
class TokenStore {
  constructor({ filePath, safeStorage } = {}) {
    this.filePath = filePath
    this.safeStorage = safeStorage
    this.cached = undefined
  }

  get canPersist() {
    return Boolean(this.filePath && this.safeStorage && this.safeStorage.isEncryptionAvailable())
  }

  load() {
    if (this.cached !== undefined) return this.cached
    this.cached = null
    if (this.canPersist && fs.existsSync(this.filePath)) {
      try {
        this.cached = this.safeStorage.decryptString(fs.readFileSync(this.filePath)) || null
      } catch {
        this.cached = null
      }
    }
    return this.cached
  }

  save(token) {
    this.cached = token || null
    if (!this.canPersist) return false
    if (!token) return this.clear()
    fs.mkdirSync(path.dirname(this.filePath), { recursive: true })
    fs.writeFileSync(this.filePath, this.safeStorage.encryptString(token), { mode: 0o600 })
    return true
  }

  clear() {
    this.cached = null
    if (this.filePath && fs.existsSync(this.filePath)) {
      fs.rmSync(this.filePath, { force: true })
    }
    return true
  }
}

module.exports = { TokenStore }
