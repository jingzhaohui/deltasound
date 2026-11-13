"use strict";
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('ds', {
  state:            () => ipcRenderer.invoke('ds:state'),
  apply:            (text) => ipcRenderer.invoke('ds:apply', text),
  restore:          () => ipcRenderer.invoke('ds:restore'),
  setAutostart:     (on) => ipcRenderer.invoke('ds:setAutostart', on),
  openConfigurator: () => ipcRenderer.invoke('ds:openConfigurator'),
  openConfigDir:    () => ipcRenderer.invoke('ds:openConfigDir'),
  downloadApo:      () => ipcRenderer.invoke('ds:downloadApo'),
  notify:           (t, b) => ipcRenderer.invoke('ds:notify', t, b),
  pickAudio:        () => ipcRenderer.invoke('ds:pickAudio'),
  onToggleBypass:   (cb) => ipcRenderer.on('ds:toggleBypass', cb),
  onRequestApply:   (cb) => ipcRenderer.on('ds:requestApply', cb),
  onResult:         (cb) => ipcRenderer.on('ds:result', (_e, r) => cb(r))
});
