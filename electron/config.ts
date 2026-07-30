import Store from 'electron-store'

interface AppConfig {
  targetDeviceId: string
  targetDeviceName: string
  heartbeatTimeout: number
  autoUnlock: boolean
  autoStart: boolean
}

const store = new Store<AppConfig>({
  defaults: {
    targetDeviceId: '',
    targetDeviceName: '',
    heartbeatTimeout: 15,
    autoUnlock: false,
    autoStart: false
  }
})

export function getConfig(): AppConfig {
  return {
    targetDeviceId: store.get('targetDeviceId'),
    targetDeviceName: store.get('targetDeviceName'),
    heartbeatTimeout: store.get('heartbeatTimeout'),
    autoUnlock: store.get('autoUnlock'),
    autoStart: store.get('autoStart')
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
