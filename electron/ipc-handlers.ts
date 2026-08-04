import { ipcMain, BrowserWindow } from 'electron'
import { stateManager } from './state'
import { getConfig, setConfig } from './config'
import { initSafeStorage, savePassword, clearPassword, hasPassword } from './system/safe-storage'
import { getStore } from './config'
import { BLEManager } from './ble/manager'
import { isRegistered, isDllInstalled, isAdmin } from './system/hodor-registry'
import { relaunchAsAdmin } from './system/elevate'
import { rssiMonitor } from './ble/rssi-monitor'

// 由 main.ts 注入，用于配置变更时同步心跳超时
let bleManagerRef: BLEManager | null = null
export function setBleManagerRef(mgr: BLEManager | null) {
  bleManagerRef = mgr
}

export function registerIpcHandlers(win: BrowserWindow): void {
  // 初始化安全存储
  initSafeStorage(getStore())

  // 获取当前状态
  ipcMain.handle('getState', () => {
    return stateManager.getState()
  })

  // 获取配置
  ipcMain.handle('getConfig', () => {
    const config = getConfig()
    return {
      ...config,
      hasPassword: hasPassword()
    }
  })

  // 设置配置
  ipcMain.handle('setConfig', async (_event, newConfig: any) => {
    setConfig(newConfig)
    // 配置变更时同步到各模块
    if (newConfig.heartbeatTimeout !== undefined) {
      bleManagerRef?.setHeartbeatTimeout(newConfig.heartbeatTimeout * 1000)
    }
    if (newConfig.unlockDelay !== undefined) {
      stateManager.setUnlockDelay(newConfig.unlockDelay)
      rssiMonitor.applyConfig({ unlockConfirmMs: newConfig.unlockDelay * 1000 })
    }

    // RSSI 配置同步
    if (newConfig.rssiLockThreshold !== undefined) {
      rssiMonitor.applyConfig({ rssiLockThreshold: newConfig.rssiLockThreshold })
    }
    if (newConfig.rssiUnlockThreshold !== undefined) {
      rssiMonitor.applyConfig({ rssiUnlockThreshold: newConfig.rssiUnlockThreshold })
    }
    if (newConfig.heartbeatTimeout !== undefined) {
      rssiMonitor.applyConfig({ weakTimeoutMs: newConfig.heartbeatTimeout * 1000 })
    }

    // 目标设备变更 → 启动/停止 C# 侧监听(设备唯一,连接或监听共用)
    if (newConfig.targetDeviceId !== undefined) {
      syncRssiMonitor()
    }

    return { success: true }
  })

  // 设置密码
  ipcMain.handle('setPassword', async (_event, password: string) => {
    if (!password || password.trim().length === 0) {
      throw new Error('密码不能为空')
    }
    savePassword(password)
    return { success: true }
  })

  // 清除密码
  ipcMain.handle('clearPassword', async () => {
    clearPassword()
    return { success: true }
  })

  // ── hodor 解锁组件（UnlockProvider.dll）──

  // 查询解锁组件安装状态
  ipcMain.handle('hodor-status', () => {
    return {
      registered: isRegistered(),
      dllInstalled: isDllInstalled(),
      admin: isAdmin()
    }
  })

  // 安装解锁组件（UAC 提权）
  ipcMain.handle('hodor-install', async () => {
    return relaunchAsAdmin('install')
  })

  // 卸载解锁组件（UAC 提权）
  ipcMain.handle('hodor-uninstall', async () => {
    return relaunchAsAdmin('uninstall')
  })

  // 状态推送
  ipcMain.on('subscribeState', () => {
    const handler = () => {
      win.webContents.send('stateChange', stateManager.getState())
    }
    stateManager.on('change', handler)
    ;(ipcMain as any)._stateHandler = handler
  })

  ipcMain.on('unsubscribeState', () => {
    const handler = (ipcMain as any)._stateHandler
    if (handler) {
      stateManager.removeListener('change', handler)
      ;(ipcMain as any)._stateHandler = null
    }
  })

  // ── RSSI 监听同步辅助 ──

  function syncRssiMonitor(): void {
    const config = getConfig()
    if (config.targetDeviceId) {
      rssiMonitor.start(config.targetDeviceId, config.targetDeviceName, {
        rssiLockThreshold: config.rssiLockThreshold,
        rssiUnlockThreshold: config.rssiUnlockThreshold,
        weakTimeoutMs: config.heartbeatTimeout * 1000,
        unlockConfirmMs: config.unlockDelay * 1000
      })
      bleManagerRef?.startRssiMonitor(config.targetDeviceId)
      stateManager.setRssiMonitorStatus('monitoring')
      console.log('[RSSI] 监听已启动:', config.targetDeviceName, `(${config.targetDeviceId})`)
    } else {
      rssiMonitor.stop()
      bleManagerRef?.stopRssiMonitor()
      stateManager.setRssiMonitorStatus('idle')
      stateManager.setRssi(null)
    }
  }
}
