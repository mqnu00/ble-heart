import { ipcMain, BrowserWindow } from 'electron'
import { stateManager } from './state'
import { getConfig, setConfig } from './config'
import { initSafeStorage, savePassword, clearPassword, hasPassword } from './system/safe-storage'
import { getStore } from './config'

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
