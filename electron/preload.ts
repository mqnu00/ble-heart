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

  // RSSI monitor events (main → renderer)
  onBleRssiUpdate: (callback: (sample: { address: string; name: string; rssi: number; timestamp: number }) => void) => {
    ipcRenderer.on('ble-rssi-update', (_event, sample) => callback(sample))
  },

  // 蓝牙不可用事件 (main → renderer),独立于扫描生命周期,常驻监听
  onBleBluetoothError: (callback: (info: { code: string; message: string }) => void) => {
    ipcRenderer.on('ble-bluetooth-error', (_event, info) => callback(info))
  },

  // RSSI monitor commands
  bleStartRssiMonitor: (address: string) => ipcRenderer.send('ble-start-rssi-monitor', address),
  bleStopRssiMonitor: () => ipcRenderer.send('ble-stop-rssi-monitor'),

  // Cleanup all BLE listeners
  removeBleListeners: () => {
    ipcRenderer.removeAllListeners('ble-scan-started')
    ipcRenderer.removeAllListeners('ble-scan-stopped')
    ipcRenderer.removeAllListeners('ble-device-discovered')
    ipcRenderer.removeAllListeners('ble-rssi-update')
  },

  // Test lock / unlock
  testLock: () => ipcRenderer.invoke('test-lock'),
  testUnlock: () => ipcRenderer.invoke('test-unlock'),

  // ── Hodor 解锁组件（UnlockProvider.dll）──
  getHodorStatus: () => ipcRenderer.invoke('hodor-status'),
  installHodor: () => ipcRenderer.invoke('hodor-install'),
  uninstallHodor: () => ipcRenderer.invoke('hodor-uninstall')
})
