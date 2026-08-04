/**
 * 管理员权限提升（UAC）
 *
 * 以管理员身份重启自身，在 worker 模式下执行 hodor 安装/卸载，
 * 通过临时结果文件与发起方进程通信。
 */

import { spawn } from 'node:child_process'
import { existsSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { app } from 'electron'

export type HodorAction = 'install' | 'uninstall'

export interface HodorResult {
  action: HodorAction
  success: boolean
  message: string
  timestamp: number
}

const ACTION_FLAG: Record<HodorAction, string> = {
  install: '--hodor-install',
  uninstall: '--hodor-uninstall'
}

/** worker 进程（管理员）写结果、发起方读取结果的文件 */
function getResultFile(): string {
  return join(app.getPath('temp'), 'ble-heart-hodor-result.json')
}

/**
 * 以管理员身份重启自身执行 hodor 安装/卸载，并等待操作结果
 *
 * 通过 PowerShell Start-Process -Verb RunAs 弹 UAC 启动新进程，
 * 新进程完成注册/卸载后把结果写入临时文件，本函数轮询读取。
 */
export async function relaunchAsAdmin(
  action: HodorAction
): Promise<{ success: boolean; message: string }> {
  const resultFile = getResultFile()

  // 清理旧结果，避免读到上一次操作的数据
  try {
    unlinkSync(resultFile)
  } catch {
    /* 文件不存在，忽略 */
  }

  // 构造提权后的启动命令
  const { file, args } = buildElevatedCommand(action)

  // PowerShell 弹 UAC 并等待提权进程退出
  const psCommand = [
    'Start-Process',
    `-FilePath '${file}'`,
    `-ArgumentList '${args.map(quoteArg).join(' ')}'`,
    '-Verb RunAs',
    '-Wait',
    '-ErrorAction Stop'
  ].join(' ')

  const exitCode = await new Promise<number | null>((resolve) => {
    const proc = spawn(
      'powershell.exe',
      ['-NoProfile', '-NonInteractive', '-Command', psCommand],
      { windowsHide: true }
    )
    proc.on('error', () => resolve(null))
    proc.on('exit', (code) => resolve(code))
  })

  // UAC 被取消或启动失败时 PowerShell 返回非零退出码
  if (exitCode !== 0) {
    return { success: false, message: '已取消或提权失败，请重试' }
  }

  // 等待结果文件（最长 60 秒）
  const deadline = Date.now() + 60_000
  while (Date.now() < deadline) {
    if (existsSync(resultFile)) {
      try {
        const data = JSON.parse(readFileSync(resultFile, 'utf-8')) as HodorResult
        if (data.action === action) {
          return { success: data.success, message: data.message }
        }
      } catch {
        // 文件可能正在写入，忽略并继续轮询
      }
    }
    await new Promise((r) => setTimeout(r, 300))
  }
  return { success: false, message: '操作超时，请重试' }
}

/**
 * worker 进程（管理员模式）写入操作结果，供发起方读取
 */
export function writeHodorResult(
  action: HodorAction,
  success: boolean,
  message: string
): void {
  const data: HodorResult = { action, success, message, timestamp: Date.now() }
  try {
    writeFileSync(getResultFile(), JSON.stringify(data), 'utf-8')
  } catch (err: any) {
    console.error('[hodor] 写入结果文件失败:', err.message)
  }
}

/**
 * 构造提权后的启动命令
 *
 * 打包后:   <应用 exe> <flag>
 * 开发模式: <electron.exe> <原参数: 入口 js 等> <flag>
 */
function buildElevatedCommand(
  action: HodorAction
): { file: string; args: string[] } {
  const flag = ACTION_FLAG[action]
  const extraArgs = process.argv.slice(1).filter((a) => !a.startsWith('--hodor-'))
  return { file: process.execPath, args: [...extraArgs, flag] }
}

/** 参数含空格时用双引号包裹，避免被命令行拆分 */
function quoteArg(arg: string): string {
  return /\s/.test(arg) ? `"${arg}"` : arg
}
