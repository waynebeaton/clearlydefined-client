'use strict'

const api = window.clearlyDefined

const elements = {
  authStatus: document.getElementById('auth-status'),
  signInDevice: document.getElementById('sign-in-device'),
  signInToken: document.getElementById('sign-in-token'),
  signOut: document.getElementById('sign-out'),
  tokenForm: document.getElementById('token-form'),
  tokenInput: document.getElementById('token-input'),
  tokenSave: document.getElementById('token-save'),
  tokenCancel: document.getElementById('token-cancel'),
  tokenHint: document.getElementById('token-hint'),
  deviceFlow: document.getElementById('device-flow'),
  deviceCode: document.getElementById('device-code'),
  deviceUrl: document.getElementById('device-url'),
  searchInput: document.getElementById('search-input'),
  searchButton: document.getElementById('search-button'),
  results: document.getElementById('results'),
  definitionSection: document.getElementById('definition-section'),
  definitionCoordinates: document.getElementById('definition-coordinates'),
  definitionForm: document.getElementById('definition-form'),
  contributionSection: document.getElementById('contribution-section'),
  contributionType: document.getElementById('contribution-type'),
  contributionSummary: document.getElementById('contribution-summary'),
  contributionDetails: document.getElementById('contribution-details'),
  contributionResolution: document.getElementById('contribution-resolution'),
  patchPreview: document.getElementById('patch-preview'),
  submitCuration: document.getElementById('submit-curation'),
  message: document.getElementById('message')
}

const simpleFields = ['declaredLicense', 'releaseDate', 'projectWebsite', 'issueTracker']
const sourceFields = ['type', 'provider', 'namespace', 'name', 'revision', 'url']

let selected = null

// Errors raised by a main process handler arrive with an
// "Error invoking remote method '…': Error: " prefix that is noise for the user.
function toMessage(error) {
  return String((error && error.message) || error).replace(/^Error invoking remote method '[^']*': (Error: )?/, '')
}

function showMessage(text, kind = 'info') {
  elements.message.textContent = text || ''
  elements.message.className = text ? kind : ''
}

function applyAuthState(state) {
  const signedIn = Boolean(state && state.signedIn)
  const login = state && state.user && state.user.login
  elements.authStatus.textContent = signedIn ? `Signed in as ${login || 'GitHub user'}` : 'Not signed in'
  elements.signOut.hidden = !signedIn
  elements.signInDevice.hidden = signedIn || !(state && state.canUseDeviceFlow)
  elements.signInToken.hidden = signedIn
  if (signedIn) {
    elements.tokenForm.hidden = true
    elements.deviceFlow.hidden = true
    elements.tokenInput.value = ''
  }
  elements.tokenHint.textContent =
    state && state.canPersist
      ? 'The token is stored encrypted on this machine.'
      : 'Encrypted storage is unavailable, so the token is only kept for this session.'
}

function readEdits() {
  const edits = { sourceLocation: {} }
  for (const field of simpleFields) {
    edits[field] = document.getElementById(field).value
  }
  for (const field of sourceFields) {
    edits.sourceLocation[field] = document.getElementById(`source-${field}`).value
  }
  return edits
}

function fillForm(values) {
  for (const field of simpleFields) {
    document.getElementById(field).value = values[field] || ''
  }
  for (const field of sourceFields) {
    document.getElementById(`source-${field}`).value = (values.sourceLocation && values.sourceLocation[field]) || ''
  }
}

async function refreshPatchPreview() {
  if (!selected) return
  const patch = await api.previewPatch({ definition: selected.definition, edits: readEdits() })
  selected.patch = patch
  elements.patchPreview.textContent = Object.keys(patch).length
    ? JSON.stringify(patch, null, 2)
    : 'No changes yet.'
}

async function runSearch() {
  const pattern = elements.searchInput.value.trim()
  if (!pattern) return
  showMessage('Searching…')
  elements.results.replaceChildren()
  try {
    const coordinates = await api.search(pattern)
    if (!coordinates.length) {
      showMessage('No components matched that search.')
      return
    }
    showMessage(`${coordinates.length} match${coordinates.length === 1 ? '' : 'es'}.`)
    for (const entry of coordinates) {
      const item = document.createElement('li')
      const button = document.createElement('button')
      button.type = 'button'
      button.className = 'link'
      button.textContent = [
        entry.type,
        entry.provider,
        entry.namespace || '-',
        entry.name,
        entry.revision || ''
      ]
        .filter(Boolean)
        .join('/')
      button.addEventListener('click', () => loadDefinition(entry))
      item.appendChild(button)
      elements.results.appendChild(item)
    }
  } catch (error) {
    showMessage(toMessage(error), 'error')
  }
}

async function loadDefinition(coordinates) {
  showMessage('Loading definition…')
  try {
    const loaded = await api.getDefinition(coordinates)
    selected = { coordinates: loaded.coordinates, definition: loaded.definition, patch: {} }
    elements.definitionCoordinates.textContent = loaded.path
    fillForm(loaded.values)
    elements.definitionSection.hidden = false
    elements.contributionSection.hidden = false
    await refreshPatchPreview()
    showMessage('Definition loaded. Edit the values you want to curate.')
  } catch (error) {
    showMessage(toMessage(error), 'error')
  }
}

async function submitCuration() {
  if (!selected) return
  const contributionInfo = {
    type: elements.contributionType.value,
    summary: elements.contributionSummary.value.trim(),
    details: elements.contributionDetails.value.trim(),
    resolution: elements.contributionResolution.value.trim()
  }
  showMessage('Contributing curation…')
  elements.submitCuration.disabled = true
  try {
    const result = await api.curate({
      coordinates: selected.coordinates,
      definition: selected.definition,
      edits: readEdits(),
      contributionInfo
    })
    if (result.url) {
      showMessage(`Curation contributed: ${result.url}`, 'success')
      api.openExternal(result.url)
    } else {
      showMessage('Curation contributed.', 'success')
    }
  } catch (error) {
    showMessage(toMessage(error), 'error')
  } finally {
    elements.submitCuration.disabled = false
  }
}

elements.searchButton.addEventListener('click', runSearch)
elements.searchInput.addEventListener('keydown', event => {
  if (event.key === 'Enter') runSearch()
})
elements.definitionForm.addEventListener('input', () => {
  refreshPatchPreview().catch(error => showMessage(toMessage(error), 'error'))
})
elements.submitCuration.addEventListener('click', submitCuration)

elements.signInToken.addEventListener('click', () => {
  elements.tokenForm.hidden = false
  elements.tokenInput.focus()
})
elements.tokenCancel.addEventListener('click', () => {
  elements.tokenForm.hidden = true
  elements.tokenInput.value = ''
})
elements.tokenSave.addEventListener('click', async () => {
  try {
    applyAuthState(await api.auth.signInWithToken(elements.tokenInput.value))
    showMessage('Signed in to GitHub.', 'success')
  } catch (error) {
    showMessage(toMessage(error), 'error')
  }
})
elements.signInDevice.addEventListener('click', async () => {
  try {
    const request = await api.auth.startDeviceFlow()
    elements.deviceCode.textContent = request.userCode
    elements.deviceUrl.textContent = request.verificationUri
    elements.deviceUrl.onclick = event => {
      event.preventDefault()
      api.openExternal(request.verificationUri)
    }
    elements.deviceFlow.hidden = false
    showMessage('Waiting for GitHub authorization…')
  } catch (error) {
    showMessage(toMessage(error), 'error')
  }
})
elements.signOut.addEventListener('click', async () => {
  applyAuthState(await api.auth.signOut())
  showMessage('Signed out.')
})

api.auth.onChanged(state => {
  applyAuthState(state)
  if (state.signedIn) showMessage('Signed in to GitHub.', 'success')
})
api.auth.onError(message => showMessage(message, 'error'))

api.auth
  .state()
  .then(applyAuthState)
  .catch(error => showMessage(toMessage(error), 'error'))
