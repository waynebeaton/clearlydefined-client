'use strict'

const path = require('path')
const { app, BrowserWindow, ipcMain, shell, safeStorage } = require('electron')

const { ClearlyDefinedClient } = require('./clearlydefined')
const { GitHubAuth } = require('./github-auth')
const { TokenStore } = require('./token-store')
const { loadConfig } = require('./config')
const { buildPatch, extractCuratableValues } = require('../shared/curation')
const { parseCoordinates, formatCoordinates } = require('../shared/coordinates')

const config = loadConfig()
const client = new ClearlyDefinedClient({ baseUrl: config.apiBaseUrl })
const auth = new GitHubAuth({ clientId: config.githubClientId, scope: config.githubScope })

let tokenStore = null
let mainWindow = null
let currentUser = null
let deviceFlow = null

function getTokenStore() {
  if (!tokenStore) {
    tokenStore = new TokenStore({
      filePath: path.join(app.getPath('userData'), 'github-token.bin'),
      safeStorage
    })
  }
  return tokenStore
}

function authState() {
  return {
    signedIn: Boolean(getTokenStore().load()),
    user: currentUser,
    canUseDeviceFlow: auth.isConfigured,
    canPersist: getTokenStore().canPersist
  }
}

function notifyAuthChanged() {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('auth:changed', authState())
  }
}

function requireToken() {
  const token = getTokenStore().load()
  if (!token) throw new Error('Sign in to GitHub before contributing a curation')
  return token
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1100,
    height: 820,
    title: 'ClearlyDefined Client',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  })
  mainWindow.loadFile(path.join(__dirname, '..', 'renderer', 'index.html'))
  mainWindow.on('closed', () => {
    mainWindow = null
  })
}

// Keep the renderer inside the application: any other destination is opened
// in the user's browser instead.
app.on('web-contents-created', (_event, contents) => {
  contents.setWindowOpenHandler(({ url }) => {
    openExternal(url)
    return { action: 'deny' }
  })
  contents.on('will-navigate', (event, url) => {
    if (!url.startsWith('file://')) {
      event.preventDefault()
      openExternal(url)
    }
  })
})

function openExternal(url) {
  try {
    const parsed = new URL(url)
    if (parsed.protocol === 'https:') shell.openExternal(parsed.toString())
  } catch {
    // ignore malformed URLs
  }
}

ipcMain.handle('auth:state', () => authState())

ipcMain.handle('auth:signInWithToken', async (_event, token) => {
  const user = await auth.getUser((token || '').trim())
  getTokenStore().save((token || '').trim())
  currentUser = user
  notifyAuthChanged()
  return authState()
})

ipcMain.handle('auth:startDeviceFlow', async () => {
  const request = await auth.requestDeviceCode()
  deviceFlow = request
  openExternal(request.verificationUri)
  // Poll in the background so the renderer can show the user code right away.
  auth
    .pollForAccessToken(request)
    .then(async token => {
      if (deviceFlow !== request) return
      currentUser = await auth.getUser(token)
      getTokenStore().save(token)
      notifyAuthChanged()
    })
    .catch(error => {
      if (deviceFlow !== request) return
      deviceFlow = null
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('auth:error', error.message)
      }
    })
  return { userCode: request.userCode, verificationUri: request.verificationUri }
})

ipcMain.handle('auth:signOut', () => {
  deviceFlow = null
  currentUser = null
  getTokenStore().clear()
  notifyAuthChanged()
  return authState()
})

ipcMain.handle('clearlydefined:search', async (_event, pattern) => client.search(pattern))

ipcMain.handle('clearlydefined:definition', async (_event, coordinates) => {
  const parsed = typeof coordinates === 'string' ? parseCoordinates(coordinates) : coordinates
  const definition = await client.getDefinition(parsed)
  return {
    coordinates: parsed,
    path: formatCoordinates(parsed),
    definition,
    values: extractCuratableValues(definition)
  }
})

ipcMain.handle('clearlydefined:patch', (_event, { definition, edits }) => buildPatch(definition, edits))

ipcMain.handle('clearlydefined:curate', async (_event, { coordinates, definition, edits, contributionInfo }) => {
  const parsed = typeof coordinates === 'string' ? parseCoordinates(coordinates) : coordinates
  const patch = buildPatch(definition, edits)
  const result = await client.submitCuration({
    coordinates: parsed,
    patch,
    contributionInfo,
    token: requireToken()
  })
  return { patch, result, url: result && (result.url || (result.data && result.data.html_url)) }
})

ipcMain.handle('shell:openExternal', (_event, url) => openExternal(url))

app.whenReady().then(() => {
  createWindow()
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
