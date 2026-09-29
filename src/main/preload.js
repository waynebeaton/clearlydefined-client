'use strict'

const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('clearlyDefined', {
  auth: {
    state: () => ipcRenderer.invoke('auth:state'),
    signInWithToken: token => ipcRenderer.invoke('auth:signInWithToken', token),
    startDeviceFlow: () => ipcRenderer.invoke('auth:startDeviceFlow'),
    signOut: () => ipcRenderer.invoke('auth:signOut'),
    onChanged: handler => ipcRenderer.on('auth:changed', (_event, state) => handler(state)),
    onError: handler => ipcRenderer.on('auth:error', (_event, message) => handler(message))
  },
  search: pattern => ipcRenderer.invoke('clearlydefined:search', pattern),
  getDefinition: coordinates => ipcRenderer.invoke('clearlydefined:definition', coordinates),
  previewPatch: request => ipcRenderer.invoke('clearlydefined:patch', request),
  curate: request => ipcRenderer.invoke('clearlydefined:curate', request),
  openExternal: url => ipcRenderer.invoke('shell:openExternal', url)
})
