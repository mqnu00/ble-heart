export interface AppState {
  heartRate: number | null
  deviceStatus: 'scanning' | 'connected' | 'disconnected'
  lockState: 'unlocked' | 'pending' | 'locked'
  lastBeatTime: number
  deviceName: string | null
}

export interface AppConfig {
  targetDeviceId: string
  targetDeviceName: string
  heartbeatTimeout: number
  unlockDelay: number
  autoUnlock: boolean
  autoStart: boolean
  hasPassword: boolean
}

export interface BLEDevice {
  id: string
  address: string
  name: string
  rssi: number
}
