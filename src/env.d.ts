/// <reference types="vite/client" />

declare module '*.vue' {
  import type { DefineComponent } from 'vue'
  const component: DefineComponent<object, object, unknown>
  export default component
}

export {}

declare global {
  interface Window {
    electronAPI: {
      // State
      getState: () => Promise<{
        heartRate: number | null
        deviceStatus: 'scanning' | 'connected' | 'disconnected'
        lockState: 'unlocked' | 'pending' | 'locked'
        lastBeatTime: number
        deviceName: string | null
        rssi: number | null
        rssiMonitorStatus: 'idle' | 'monitoring'
      }>
      getConfig: () => Promise<{
        targetDeviceId: string
        targetDeviceName: string
        heartbeatTimeout: number
        unlockDelay: number
        autoUnlock: boolean
        autoStart: boolean
        hasPassword: boolean
        rssiLockThreshold: number
        rssiUnlockThreshold: number
      }>
      setConfig: (config: Record<string, unknown>) => Promise<{ success: boolean }>
      setPassword: (password: string) => Promise<{ success: boolean }>
      clearPassword: () => Promise<{ success: boolean }>

      // State listener
      onStateChange: (callback: (state: any) => void) => void
      removeStateListener: () => void

      // BLE commands (renderer → main)
      bleStartScan: (timeout?: number) => void
      bleStopScan: () => void
      bleConnect: (address: string) => void
      bleDisconnect: () => void

      // BLE events (main → renderer)
      onBleScanStarted: (callback: () => void) => void
      onBleScanStopped: (callback: () => void) => void
      onBleDeviceDiscovered: (callback: (device: { id: string; address: string; name: string; rssi: number }) => void) => void
      onBleRssiUpdate: (callback: (sample: { address: string; name: string; rssi: number; timestamp: number }) => void) => void
      removeBleListeners: () => void

      // RSSI monitor commands
      bleStartRssiMonitor: (address: string) => void
      bleStopRssiMonitor: () => void

      // Test lock / unlock
      testLock: () => Promise<{ success: boolean; message?: string }>
      testUnlock: () => Promise<{ success: boolean; message?: string }>

      // Hodor 解锁组件（UnlockProvider.dll）
      getHodorStatus: () => Promise<{
        registered: boolean
        dllInstalled: boolean
        admin: boolean
      }>
      installHodor: () => Promise<{ success: boolean; message: string }>
      uninstallHodor: () => Promise<{ success: boolean; message: string }>
    }
  }
}
