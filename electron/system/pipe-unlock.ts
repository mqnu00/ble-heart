/**
 * Named Pipe 解锁客户端
 *
 * 通过 Windows Named Pipe 与 hodor 的 UnlockProvider.dll 通信，
 * 发送凭据实现 Windows 锁屏解锁。
 *
 * 管道协议：
 *   命令: UNLOCK:domain\username:password
 *   响应: OK 或 ERR:...
 *
 * 基于 hodor SDK (Node.js) 移植，使用 Node.js 内置 net 模块，零额外依赖。
 */

import * as net from 'node:net'

const PIPE_NAME = '\\\\.\\pipe\\CredentialProviderPipe'
const DEFAULT_TIMEOUT_MS = 5000

export interface UnlockResult {
  success: boolean
  response: string
}

export class CredentialProviderError extends Error {
  code: string

  constructor(message: string, code = 'UNKNOWN') {
    super(message)
    this.name = 'CredentialProviderError'
    this.code = code
  }
}

/**
 * 发送 UNLOCK 命令到 hodor Credential Provider
 *
 * 注意: 凭据验证成功后 Windows 会立即切换桌面，此时管道会被中断（EPIPE）。
 * 因此 EPIPE 错误在已发送命令的情况下视为解锁成功。
 */
export function unlock(
  username: string,
  password: string,
  domain = '.',
  timeoutMs = DEFAULT_TIMEOUT_MS
): Promise<UnlockResult> {
  return new Promise((resolve, reject) => {
    const command = `UNLOCK:${domain}\\${username}:${password}`
    let response = ''
    let commandSent = false

    const client = net.connect(PIPE_NAME, () => {
      client.write(command, 'utf-8', () => {
        commandSent = true
      })
    })

    client.on('data', (data: Buffer) => {
      response += data.toString('utf-8')
    })

    client.on('end', () => {
      // 正常关闭: 检查响应
      resolve({ success: response === 'OK', response })
    })

    client.on('error', (err: NodeJS.ErrnoException) => {
      // EPIPE: 凭据正确 → Windows 切换桌面时管道被中断 → 视为成功
      if (commandSent && (err.code === 'EPIPE' || err.code === 'ECONNRESET')) {
        resolve({ success: true, response: 'OK (pipe broken by desktop switch)' })
        return
      }
      reject(
        new CredentialProviderError(
          `管道连接失败: ${err.message}`,
          err.code || 'PIPE_ERROR'
        )
      )
    })

    client.setTimeout(timeoutMs, () => {
      client.destroy()
      if (commandSent) {
        // 超时但已发送命令: 可能 desktop switch 正在发生
        resolve({ success: true, response: 'OK (timeout after send)' })
      } else {
        reject(new CredentialProviderError('连接超时', 'TIMEOUT'))
      }
    })
  })
}

/**
 * 带重试的解锁
 *
 * 适用于锁屏后 LogonUI 还在加载 Credential Provider 的场景。
 * 最多重试 maxRetries 次，每次间隔 delayMs 毫秒。
 */
export async function unlockWithRetry(
  username: string,
  password: string,
  domain = '.',
  options: { maxRetries?: number; delayMs?: number } = {}
): Promise<UnlockResult> {
  const { maxRetries = 10, delayMs = 500 } = options

  let lastError: unknown
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await unlock(username, password, domain)
    } catch (err) {
      lastError = err
      if (attempt < maxRetries - 1) {
        await new Promise((r) => setTimeout(r, delayMs))
      }
    }
  }
  throw lastError
}
