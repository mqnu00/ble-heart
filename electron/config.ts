import Store from 'electron-store'

export type DeviceType = 'heart-rate' | 'rssi-only'

interface AppConfig {
  targetDeviceId: string
  targetDeviceName: string
  deviceType: DeviceType
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
    deviceType: 'rssi-only',
    heartbeatTimeout: 15,
    unlockDelay: 3,
    autoUnlock: false,
    autoStart: false,
    rssiLockThreshold: -80,
    rssiUnlockThreshold: -70
  }
})

export function getConfig(): AppConfig {
  const targetDeviceId = store.get('targetDeviceId')
  const deviceType = store.get('deviceType')

  // 配置校验:已配置设备但类型缺失/非法(旧配置或损坏)→ 清空设备配置,避免按错误模式判断
  if (targetDeviceId && deviceType !== 'heart-rate' && deviceType !== 'rssi-only') {
    console.warn('[Config] 设备类型缺失或非法,清空设备配置,请重新选择设备')
    store.set('targetDeviceId', '')
    store.set('targetDeviceName', '')
    store.set('deviceType', 'rssi-only')
  }

  return {
    targetDeviceId: store.get('targetDeviceId'),
    targetDeviceName: store.get('targetDeviceName'),
    deviceType: store.get('deviceType') === 'heart-rate' ? 'heart-rate' : 'rssi-only',
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
