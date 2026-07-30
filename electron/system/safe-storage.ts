import { safeStorage } from 'electron'
import { writeFileSync, readFileSync, unlinkSync, existsSync } from 'fs'
import { tmpdir } from 'os'
import { join, basename } from 'path'
import { randomBytes } from 'crypto'

/**
 * 安全存储管理器
 * 使用 Electron safeStorage (底层 Windows DPAPI) 加密密码
 */

const ENCRYPTED_PASSWORD_KEY = 'encrypted_password'
let store: any = null // electron-store 实例，由外部注入

export function initSafeStorage(storeInstance: any) {
  store = storeInstance
}

/**
 * 加密并存储密码
 */
export function savePassword(password: string): void {
  if (!store) throw new Error('SafeStorage not initialized')
  if (safeStorage.isEncryptionAvailable()) {
    const encrypted = safeStorage.encryptString(password)
    store.set(ENCRYPTED_PASSWORD_KEY, encrypted.toString('base64'))
  } else {
    throw new Error('系统不支持安全加密 (DPAPI 不可用)')
  }
}

/**
 * 获取解密后的密码
 */
export function getPassword(): string | null {
  if (!store) throw new Error('SafeStorage not initialized')
  const encryptedBase64 = store.get(ENCRYPTED_PASSWORD_KEY)
  if (!encryptedBase64) return null

  if (safeStorage.isEncryptionAvailable()) {
    const encrypted = Buffer.from(encryptedBase64, 'base64')
    return safeStorage.decryptString(encrypted)
  }
  return null
}

/**
 * 清除已存储的密码
 */
export function clearPassword(): void {
  if (!store) throw new Error('SafeStorage not initialized')
  store.delete(ENCRYPTED_PASSWORD_KEY)
}

/**
 * 检查是否已设置密码
 */
export function hasPassword(): boolean {
  if (!store) return false
  return store.has(ENCRYPTED_PASSWORD_KEY)
}

/**
 * 将密码写入临时文件（供解锁辅助程序读取）
 * 返回文件路径
 * @param baseDir 临时文件目录，默认系统临时目录。跨用户访问（如 SYSTEM 任务）需指定公共目录。
 */
export function writePasswordToTempFile(password: string, baseDir?: string): string {
  const fileName = `.ble_unlock_${randomBytes(8).toString('hex')}.tmp`
  const dir = baseDir || tmpdir()
  const filePath = join(dir, fileName)
  writeFileSync(filePath, password, { encoding: 'utf-8', mode: 0o600 })
  return filePath
}

/**
 * 从临时文件读取密码并删除文件
 */
export function readAndDeletePasswordFile(filePath: string): string | null {
  try {
    if (!existsSync(filePath)) return null
    const password = readFileSync(filePath, 'utf-8')
    unlinkSync(filePath)
    return password
  } catch {
    return null
  }
}
