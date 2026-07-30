import { ipcMain, BrowserWindow } from 'electron'
import { stateManager } from './state'
import { getConfig, setConfig } from './config'
import { initSafeStorage, savePassword, clearPassword, hasPassword } from './system/safe-storage'
import { getStore } from './config'
import { BLEManager } from './ble/manager'

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
}
