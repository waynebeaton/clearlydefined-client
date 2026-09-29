'use strict'

const DEVICE_CODE_URL = 'https://github.com/login/device/code'
const ACCESS_TOKEN_URL = 'https://github.com/login/oauth/access_token'
const USER_URL = 'https://api.github.com/user'

/**
 * GitHub authentication using the OAuth device flow.
 *
 * The device flow is used because it works for a desktop application without
 * requiring a client secret: the user is sent to github.com to enter a short
 * code and this application polls for the resulting access token.
 */
class GitHubAuth {
  constructor({
    clientId,
    scope = 'public_repo',
    fetchImpl,
    deviceCodeUrl = DEVICE_CODE_URL,
    accessTokenUrl = ACCESS_TOKEN_URL,
    userUrl = USER_URL,
    wait
  } = {}) {
    this.clientId = clientId
    this.scope = scope
    this.fetch = fetchImpl || ((...args) => globalThis.fetch(...args))
    this.deviceCodeUrl = deviceCodeUrl
    this.accessTokenUrl = accessTokenUrl
    this.userUrl = userUrl
    this.wait = wait || (ms => new Promise(resolve => setTimeout(resolve, ms)))
  }

  get isConfigured() {
    return Boolean(this.clientId)
  }

  /**
   * Ask GitHub for a device and user code. The user code has to be entered by
   * the user at the returned verification URI.
   */
  async requestDeviceCode() {
    if (!this.isConfigured) throw new Error('No GitHub OAuth client id is configured')
    const payload = await this.#post(this.deviceCodeUrl, {
      client_id: this.clientId,
      scope: this.scope
    })
    if (payload.error) throw new Error(payload.error_description || payload.error)
    return {
      deviceCode: payload.device_code,
      userCode: payload.user_code,
      verificationUri: payload.verification_uri,
      interval: Number(payload.interval) || 5,
      expiresIn: Number(payload.expires_in) || 900
    }
  }

  /**
   * Poll GitHub until the user has approved the request (or it expires).
   * Resolves with the access token.
   */
  async pollForAccessToken({ deviceCode, interval = 5, expiresIn = 900 }) {
    if (!deviceCode) throw new Error('A device code is required')
    let delay = interval * 1000
    const deadline = Date.now() + expiresIn * 1000
    while (Date.now() < deadline) {
      await this.wait(delay)
      const payload = await this.#post(this.accessTokenUrl, {
        client_id: this.clientId,
        device_code: deviceCode,
        grant_type: 'urn:ietf:params:oauth:grant-type:device_code'
      })
      if (payload.access_token) return payload.access_token
      switch (payload.error) {
        case 'authorization_pending':
          break
        case 'slow_down':
          delay += (Number(payload.interval) || 5) * 1000
          break
        default:
          throw new Error(payload.error_description || payload.error || 'Unable to sign in to GitHub')
      }
    }
    throw new Error('Timed out waiting for GitHub authorization')
  }

  /**
   * Validate a token and return the login of its owner. Used both after the
   * device flow and when a personal access token is provided by the user.
   */
  async getUser(token) {
    if (!token) throw new Error('A GitHub token is required')
    const response = await this.fetch(this.userUrl, {
      headers: {
        Accept: 'application/vnd.github+json',
        Authorization: ['Bearer', token].join(' ')
      }
    })
    if (!response.ok) {
      throw new Error(`The GitHub token was rejected (${response.status})`)
    }
    const user = await response.json()
    return { login: user.login, name: user.name || null, avatarUrl: user.avatar_url || null }
  }

  async #post(url, body) {
    const response = await this.fetch(url, {
      method: 'POST',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    })
    const text = await response.text()
    let payload = {}
    if (text) {
      try {
        payload = JSON.parse(text)
      } catch {
        throw new Error(`Unexpected response from GitHub: ${text}`)
      }
    }
    if (!response.ok && !payload.error) {
      throw new Error(`GitHub request failed (${response.status})`)
    }
    return payload
  }
}

module.exports = { GitHubAuth, DEVICE_CODE_URL, ACCESS_TOKEN_URL, USER_URL }
