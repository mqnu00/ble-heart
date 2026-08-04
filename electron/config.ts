import Store from 'electron-store'

interface AppConfig {
  targetDeviceId: string
  targetDeviceName: string
  heartbeatTimeout: number
  unlockDelay: number
  autoUnlock: boolean
  autoStart: boolean
  rssiLockThreshold: number
  rssiUnlockThreshold: number
}

const store = new Store<AppConfig>({
  defaults: {
    targetDeviceId: '',
    targetDeviceName: '',
    heartbeatTimeout: 15,
    unlockDelay: 3,
    autoUnlock: false,
    autoStart: false,
    rssiLockThreshold: -80,
    rssiUnlockThreshold: -70
  }
})

export function getConfig(): AppConfig {
  return {
    targetDeviceId: store.get('targetDeviceId'),
    targetDeviceName: store.get('targetDeviceName'),
    heartbeatTimeout: store.get('heartbeatTimeout'),
    unlockDelay: store.get('unlockDelay'),
    autoUnlock: store.get('autoUnlock'),
    autoStart: store.get('autoStart'),
    rssiLockThreshold: store.get('rssiLockThreshold'),
    rssiUnlockThreshold: store.get('rssiUnlockThreshold')
  }
}

export function setConfig(config: Partial<AppConfig>): void {
  for (const [key, value] of Object.entries(config)) {
    if (value !== undefined) {
      store.set(key as keyof AppConfig, value)
    }
  }
}

export function getStore(): Store<AppConfig> {
  return store
}

export { store }
