/**
 * 解锁调度器
 *
 * 通过 hodor 的 Credential Provider Named Pipe 实现 Windows 自动解锁，
 * 替代原有的 schtasks + SendKeys 方案。
 */

import { getPassword } from './safe-storage'
import { unlockWithRetry } from './pipe-unlock'
import { isRegistered } from './hodor-registry'

/**
 * 触发解锁
 *
 * 通过命名管道向 hodor UnlockProvider.dll 发送凭据。
 * 未锁屏时管道不存在，连接自然失败，无需额外检查。
 * 包含重试机制，适配锁屏后 LogonUI 延迟加载 DLL 的场景。
 */
export async function triggerUnlock(): Promise<void> {
  const password = getPassword()
  if (!password) {
    throw new Error('未设置解锁密码')
  }

  if (!isRegistered()) {
    throw new Error('解锁组件未注册，请以管理员权限重启应用完成注册')
  }

  // 获取当前用户名
  const username = process.env.USERNAME || ''
  if (!username) {
    throw new Error('无法获取当前用户名')
  }

  // 通过管道发送解锁命令（带重试，最多 10 次 × 500ms = 5 秒）
  const result = await unlockWithRetry(username, password, '.', {
    maxRetries: 10,
    delayMs: 500
  })

  if (!result.success) {
    throw new Error(`解锁失败: ${result.response}`)
  }
}

/**
 * 确保 hodor 组件就绪（启动时调用）
 *
 * 返回 true 表示 hodor 已注册且可用。
 * 返回 false 表示需要管理员权限注册。
 */
export { ensureReady as ensureHodorReady } from './hodor-registry'

/**
 * 注册 hodor DLL（管理员权限下）
 */
export { register as registerHodor } from './hodor-registry'

/**
 * 卸载 hodor DLL（管理员权限下）
 */
export { unregister as unregisterHodor } from './hodor-registry'
