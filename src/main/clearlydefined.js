'use strict'

const { formatCoordinates, parseCoordinates } = require('../shared/coordinates')

const DEFAULT_BASE_URL = 'https://api.clearlydefined.io'

/**
 * Minimal client for the public ClearlyDefined API.
 *
 * Only the three operations needed by this application are implemented:
 * searching for components, fetching the definition of one component and
 * contributing a curation (which requires a GitHub token).
 */
class ClearlyDefinedClient {
  constructor({ baseUrl = DEFAULT_BASE_URL, fetchImpl } = {}) {
    this.baseUrl = baseUrl.replace(/\/+$/, '')
    this.fetch = fetchImpl || ((...args) => globalThis.fetch(...args))
  }

  /**
   * Find the coordinates of the components matching `pattern`.
   * Resolves to an array of coordinate objects.
   */
  async search(pattern) {
    const term = (pattern || '').trim()
    if (!term) throw new Error('A search term is required')
    const url = `${this.baseUrl}/definitions?pattern=${encodeURIComponent(term)}`
    const found = await this.#request(url)
    if (!Array.isArray(found)) return []
    return found
      .map(entry => {
        try {
          return parseCoordinates(entry)
        } catch {
          return null
        }
      })
      .filter(Boolean)
  }

  /**
   * Fetch the current definition of a single component revision.
   */
  async getDefinition(coordinates) {
    const path = formatCoordinates(coordinates)
    if (!path.split('/')[4]) throw new Error('A revision is required to fetch a definition')
    return this.#request(`${this.baseUrl}/definitions/${path}`)
  }

  /**
   * Fetch the curations that have already been applied to a component revision.
   */
  async getCuration(coordinates) {
    const path = formatCoordinates(coordinates)
    if (!path.split('/')[4]) throw new Error('A revision is required to fetch a curation')
    return this.#request(`${this.baseUrl}/curations/${path}`)
  }

  /**
   * Contribute a curation. ClearlyDefined turns this into a pull request
   * against the curated-data repository on behalf of the authenticated user,
   * so a GitHub token is required.
   */
  async submitCuration({ coordinates, revision, patch, contributionInfo, token }) {
    if (!token) throw new Error('A GitHub token is required to contribute a curation')
    const target = { ...coordinates, revision: revision || coordinates.revision }
    if (!target.revision) throw new Error('A revision is required to contribute a curation')
    if (!patch || Object.keys(patch).length === 0) throw new Error('There are no changes to contribute')
    const info = contributionInfo || {}
    if (!info.summary) throw new Error('A summary is required to contribute a curation')

    const body = {
      contributionInfo: {
        type: info.type || 'other',
        summary: info.summary,
        details: info.details || '',
        resolution: info.resolution || '',
        removeDefinitions: false
      },
      patches: [
        {
          coordinates: {
            type: target.type,
            provider: target.provider,
            namespace: target.namespace || null,
            name: target.name
          },
          revisions: { [target.revision]: patch }
        }
      ]
    }

    return this.#request(`${this.baseUrl}/curations`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: ['Bearer', token].join(' ')
      },
      body: JSON.stringify(body)
    })
  }

  async #request(url, options = {}) {
    let response
    try {
      response = await this.fetch(url, {
        ...options,
        headers: { Accept: 'application/json', ...(options.headers || {}) }
      })
    } catch (error) {
      throw new Error(`Unable to reach ClearlyDefined: ${error.message}`)
    }
    const text = await response.text()
    let payload = null
    if (text) {
      try {
        payload = JSON.parse(text)
      } catch {
        payload = text
      }
    }
    if (!response.ok) {
      const detail = (payload && (payload.message || payload.error)) || (typeof payload === 'string' ? payload : '')
      throw new Error(`ClearlyDefined request failed (${response.status})${detail ? `: ${detail}` : ''}`)
    }
    return payload
  }
}

module.exports = { ClearlyDefinedClient, DEFAULT_BASE_URL }
