import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('electronAPI', {
  // State
  getState: () => ipcRenderer.invoke('getState'),
  getConfig: () => ipcRenderer.invoke('getConfig'),
  setConfig: (config: any) => ipcRenderer.invoke('setConfig', config),

  // Password
  setPassword: (password: string) => ipcRenderer.invoke('setPassword', password),
  clearPassword: () => ipcRenderer.invoke('clearPassword'),

  // State change listener
  onStateChange: (callback: (state: any) => void) => {
    ipcRenderer.send('subscribeState')
    ipcRenderer.on('stateChange', (_event, state) => callback(state))
  },
  removeStateListener: () => {
    ipcRenderer.send('unsubscribeState')
    ipcRenderer.removeAllListeners('stateChange')
  },

  // ── BLE commands (renderer → main) ──
  bleStartScan: (timeout?: number) => ipcRenderer.send('ble-start-scan', timeout),
  bleStopScan: () => ipcRenderer.send('ble-stop-scan'),
  bleConnect: (address: string) => ipcRenderer.send('ble-connect', address),
  bleDisconnect: () => ipcRenderer.send('ble-disconnect'),

  // ── BLE events (main → renderer) ──
  onBleScanStarted: (callback: () => void) => {
    ipcRenderer.on('ble-scan-started', () => callback())
  },
  onBleScanStopped: (callback: () => void) => {
    ipcRenderer.on('ble-scan-stopped', () => callback())
  },
  onBleDeviceDiscovered: (callback: (device: any) => void) => {
    ipcRenderer.on('ble-device-discovered', (_event, device) => callback(device))
  },

  // Cleanup all BLE listeners
  removeBleListeners: () => {
    ipcRenderer.removeAllListeners('ble-scan-started')
    ipcRenderer.removeAllListeners('ble-scan-stopped')
    ipcRenderer.removeAllListeners('ble-device-discovered')
  },

  // Test lock / unlock
  testLock: () => ipcRenderer.invoke('test-lock'),
  testUnlock: () => ipcRenderer.invoke('test-unlock')
})
