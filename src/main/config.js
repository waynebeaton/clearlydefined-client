'use strict'

const { DEFAULT_BASE_URL } = require('./clearlydefined')

/**
 * Runtime configuration. The GitHub OAuth client id has to be provided by
 * whoever ships the application: register an OAuth app on GitHub, enable the
 * device flow for it and set CLEARLYDEFINED_GITHUB_CLIENT_ID.
 *
 * Without a client id the application still works: the user can sign in with a
 * GitHub personal access token instead.
 */
function loadConfig(env = process.env) {
  return {
    apiBaseUrl: env.CLEARLYDEFINED_API_BASE || DEFAULT_BASE_URL,
    githubClientId: env.CLEARLYDEFINED_GITHUB_CLIENT_ID || null,
    githubScope: env.CLEARLYDEFINED_GITHUB_SCOPE || 'public_repo'
  }
}

module.exports = { loadConfig }
