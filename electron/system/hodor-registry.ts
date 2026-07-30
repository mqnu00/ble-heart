/**
 * hodor UnlockProvider.dll 注册管理
 *
 * 管理 Credential Provider DLL 的 Windows 注册表注册/卸载。
 * 需要管理员权限执行注册操作。
 */

import { exec, execSync } from 'node:child_process'
import { app } from 'electron'
import { join } from 'node:path'
import { existsSync } from 'node:fs'

/** COM CLSID，与 guid.h 中一致 */
const CLSID = '{E0A8C5B2-9F3D-4E7A-B1C6-8D2F5A3E9B70}'

/** 系统目录下的 DLL 路径 */
const SYSTEM32_DLL = 'C:\\Windows\\System32\\UnlockProvider.dll'

/** 注册表路径 */
const REG_CLSID = `HKLM\\SOFTWARE\\Classes\\CLSID\\${CLSID}`
const REG_CP = `HKLM\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Authentication\\Credential Providers\\${CLSID}`

/**
 * 获取 UnlockProvider.dll 的资源路径
 */
function getDllPath(): string {
  if (app.isPackaged) {
    return join(process.resourcesPath, 'hodor', 'UnlockProvider.dll')
  }
  // 开发模式下，vite-plugin-electron 将所有模块平铺到 dist-electron/
  return join(__dirname, 'hodor', 'UnlockProvider.dll')
}

/**
 * 检查 DLL 是否已在系统注册
 */
export function isRegistered(): boolean {
  try {
    execSync(
      `reg query "${REG_CP}" /ve`,
      { encoding: 'buffer', stdio: 'pipe' }
    )
    return true
  } catch {
    return false
  }
}

/**
 * 检查 DLL 文件是否存在于 System32
 */
export function isDllInstalled(): boolean {
  return existsSync(SYSTEM32_DLL)
}

/**
 * 以管理员权限注册 DLL
 *
 * 执行步骤：
 *   1. 复制 DLL 到 C:\Windows\System32\
 *   2. 注册 COM 类
 *   3. 注册凭据提供程序
 *
 * 需要管理员权限。
 */
export async function register(): Promise<void> {
  const dllPath = getDllPath()

  if (!existsSync(dllPath)) {
    throw new Error(`DLL 未找到: ${dllPath}`)
  }

  // 步骤 1: 复制 DLL
  await execPromise(`copy /Y "${dllPath}" "${SYSTEM32_DLL}"`)

  // 步骤 2: 注册 COM 服务器
  await execPromise(`reg add "${REG_CLSID}" /ve /d "UnlockProvider" /f`)
  await execPromise(
    `reg add "${REG_CLSID}\\InprocServer32" /ve /d "${SYSTEM32_DLL}" /f`
  )
  await execPromise(
    `reg add "${REG_CLSID}\\InprocServer32" /v ThreadingModel /d "Apartment" /f`
  )

  // 步骤 3: 注册凭据提供程序
  await execPromise(`reg add "${REG_CP}" /ve /d "UnlockProvider" /f`)
}

/**
 * 卸载 DLL
 *
 * 删除注册表项和 System32 中的 DLL 文件。
 * 需要管理员权限。
 */
export async function unregister(): Promise<void> {
  // 删除凭据提供程序注册
  await execPromise(`reg delete "${REG_CP}" /f`).catch(() => {})

  // 删除 COM 注册
  await execPromise(`reg delete "${REG_CLSID}" /f`).catch(() => {})

  // 删除 DLL 文件
  await execPromise(`del /f "${SYSTEM32_DLL}"`).catch(() => {})
}

/**
 * 确保 hodor 已就绪（启动时调用）
 *
 * 若非管理员模式运行，注册操作会失败。此时仅打印日志，
 * 不阻止应用启动。用户可在以管理员身份运行后通过设置页面重试。
 */
export async function ensureReady(): Promise<boolean> {
  if (isRegistered() && isDllInstalled()) {
    return true
  }

  // 检查是否有管理员权限
  if (!isAdmin()) {
    console.warn(
      '[hodor] DLL 未注册，需要以管理员身份运行应用一次以完成注册'
    )
    return false
  }

  try {
    await register()
    console.log('[hodor] DLL 注册成功')
    return true
  } catch (err: any) {
    console.error('[hodor] DLL 注册失败:', err.message)
    return false
  }
}

/**
 * 检查当前进程是否有管理员权限
 */
export function isAdmin(): boolean {
  try {
    execSync('net session', { stdio: 'pipe', encoding: 'buffer' })
    return true
  } catch {
    return false
  }
}

// ============================================================
// 辅助函数
// ============================================================

function execPromise(command: string): Promise<string> {
  return new Promise((resolve, reject) => {
    exec(
      command,
      { encoding: 'buffer', windowsHide: true },
      (error, stdout, stderr) => {
        if (error) {
          const msg = stderr
            ? new TextDecoder('gbk').decode(stderr).trim()
            : error.message
          reject(new Error(msg))
        } else {
          const out = stdout
            ? new TextDecoder('gbk').decode(stdout).trim()
            : ''
          resolve(out)
        }
      }
    )
  })
}
