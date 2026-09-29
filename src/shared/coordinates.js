'use strict'

const EMPTY_NAMESPACE = '-'

/**
 * Parse a ClearlyDefined coordinate string such as
 * `npm/npmjs/-/lodash/4.17.21` into its parts.
 */
function parseCoordinates(value) {
  if (typeof value !== 'string') throw new Error('Coordinates must be a string')
  const parts = value.trim().replace(/^\/+|\/+$/g, '').split('/')
  if (parts.length < 4 || parts.length > 5) {
    throw new Error(`Invalid coordinates: ${value}`)
  }
  const [type, provider, namespace, name, revision] = parts
  if (!type || !provider || !namespace || !name) {
    throw new Error(`Invalid coordinates: ${value}`)
  }
  return {
    type,
    provider,
    namespace: namespace === EMPTY_NAMESPACE ? null : namespace,
    name,
    revision: revision || null
  }
}

/**
 * Turn a coordinate object back into its string (path) form.
 * The revision is only included when it is known.
 */
function formatCoordinates(coordinates) {
  if (!coordinates) throw new Error('Coordinates are required')
  const { type, provider, namespace, name, revision } = coordinates
  if (!type || !provider || !name) throw new Error('Coordinates are incomplete')
  const segments = [type, provider, namespace || EMPTY_NAMESPACE, name]
  if (revision) segments.push(revision)
  return segments.join('/')
}

module.exports = { parseCoordinates, formatCoordinates, EMPTY_NAMESPACE }
