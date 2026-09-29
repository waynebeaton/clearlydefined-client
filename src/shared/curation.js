'use strict'

/**
 * The parts of a definition that this application lets the user curate.
 * Each entry knows how to read the current value from a definition and where
 * the new value belongs in a curation patch.
 */
const CURATABLE_FIELDS = [
  { key: 'declaredLicense', label: 'Declared license', path: ['licensed', 'declared'] },
  { key: 'releaseDate', label: 'Release date', path: ['described', 'releaseDate'] },
  { key: 'projectWebsite', label: 'Project website', path: ['described', 'projectWebsite'] },
  { key: 'issueTracker', label: 'Issue tracker', path: ['described', 'issueTracker'] }
]

const SOURCE_LOCATION_FIELDS = ['type', 'provider', 'namespace', 'name', 'revision', 'url']

function readPath(object, path) {
  return path.reduce((current, segment) => (current == null ? undefined : current[segment]), object)
}

function setPath(object, path, value) {
  const last = path[path.length - 1]
  const parent = path.slice(0, -1).reduce((current, segment) => {
    if (!current[segment]) current[segment] = {}
    return current[segment]
  }, object)
  parent[last] = value
}

function normalize(value) {
  if (value == null) return ''
  return String(value).trim()
}

/**
 * Extract the curatable values of a definition so they can be shown in the
 * editor.
 */
function extractCuratableValues(definition) {
  const values = {}
  for (const field of CURATABLE_FIELDS) {
    values[field.key] = normalize(readPath(definition, field.path))
  }
  const sourceLocation = readPath(definition, ['described', 'sourceLocation']) || {}
  values.sourceLocation = {}
  for (const field of SOURCE_LOCATION_FIELDS) {
    values.sourceLocation[field] = normalize(sourceLocation[field])
  }
  return values
}

/**
 * Build a ClearlyDefined curation patch containing only the values that the
 * user actually changed. Returns an empty object when nothing changed.
 */
function buildPatch(definition, edits) {
  const current = extractCuratableValues(definition)
  const patch = {}

  for (const field of CURATABLE_FIELDS) {
    const value = normalize(edits && edits[field.key])
    if (value !== current[field.key]) {
      setPath(patch, field.path, value === '' ? null : value)
    }
  }

  const editedLocation = (edits && edits.sourceLocation) || {}
  const location = {}
  let locationChanged = false
  for (const field of SOURCE_LOCATION_FIELDS) {
    const value = normalize(editedLocation[field])
    if (value !== current.sourceLocation[field]) locationChanged = true
    if (value !== '') location[field] = value
  }
  if (locationChanged) {
    setPath(patch, ['described', 'sourceLocation'], Object.keys(location).length ? location : null)
  }

  return patch
}

module.exports = { CURATABLE_FIELDS, SOURCE_LOCATION_FIELDS, extractCuratableValues, buildPatch }
