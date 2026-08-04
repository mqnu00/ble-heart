export interface AppState {
  heartRate: number | null
  deviceStatus: 'scanning' | 'connected' | 'disconnected'
  lockState: 'unlocked' | 'pending' | 'locked'
  lastBeatTime: number
  deviceName: string | null
  rssi: number | null
  rssiMonitorStatus: 'idle' | 'monitoring'
}

export interface AppConfig {
  targetDeviceId: string
  targetDeviceName: string
  heartbeatTimeout: number
  unlockDelay: number
  autoUnlock: boolean
  autoStart: boolean
  hasPassword: boolean
  rssiLockThreshold: number
  rssiUnlockThreshold: number
}

export interface BLEDevice {
  id: string
  address: string
  name: string
  rssi: number
}
