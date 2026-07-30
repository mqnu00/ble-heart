# BLE Heart Monitor

基于 BLE 心率监测的 Windows 自动锁屏/解锁工具。

佩戴心率设备离开电脑 → 心跳信号丢失 → **自动锁屏**。  
返回电脑 → 心率恢复 → **自动解锁**。

## 特性

- **BLE 心率监测** — 连接任意标准 BLE 心率设备（智能手表、心率带）
- **自动锁屏** — 设备断开或心跳超时自动锁定 Windows
- **自动解锁** — 心率恢复后通过 Windows Credential Provider 原生认证自动解锁
- **安全可靠** — 密码使用 Windows DPAPI 加密存储，解锁通过 Kerberos 认证，非模拟按键
- **系统托盘** — 最小化到托盘后台运行
- **可配置** — 自定义心跳超时时间、启用/禁用自动解锁

## 技术栈

| 层 | 技术 |
|---|---|
| UI | Vue 3 + Element Plus + Vite 5 |
| 桌面框架 | Electron 28 |
| BLE 后端 | C# .NET 10 (WinRT BLE API) |
| 解锁机制 | hodor — Windows Credential Provider + Named Pipe |
| 锁屏检测 | koffi FFI → Win32 `OpenInputDesktop` |
| 密码存储 | Electron safeStorage (Windows DPAPI) |
| 构建打包 | electron-builder (NSIS) |

## 架构

```
┌─────────────────────┐     IPC      ┌──────────────────────┐    stdin/stdout    ┌──────────────────┐
│   Renderer (Vue 3)  │ ◄──────────► │  Main Process (TS)   │ ◄───────────────► │  ble-helper (.NET)│
│   Dashboard / 设置   │              │  状态机 / 锁屏控制     │                    │  BLE 扫描 / 连接   │
└─────────────────────┘              └───────┬──────────────┘                    └──────────────────┘
                                             │
                                      Named Pipe
                                             │
                                  ┌──────────▼──────────┐
                                  │  UnlockProvider.dll │
                                  │  (hodor Credential   │
                                  │   Provider)          │
                                  └─────────────────────┘
```

### 解锁流程

```
心率恢复 → stateManager.shouldTriggerUnlock()
  → triggerUnlock()
    → net.connect(\\.\pipe\CredentialProviderPipe)
      → "UNLOCK:.\username:password"
        → UnlockProvider.dll (COM)
          → Kerberos 认证
            → Windows 解锁
```

旧方案使用 `SendKeys` 模拟键盘输入（不可靠，需 SYSTEM 权限），现已替换为 hodor 的原生 Credential Provider 方案。

## 快速开始

### 前置要求

- Windows 10/11 x64
- Node.js 18+
- .NET 10 SDK（BLE 辅助进程）
- Visual Studio 2022（编译 hodor DLL，可选，已提供预编译版本）

### 开发运行

```bash
# 安装依赖
npm install

# 编译 BLE 辅助进程
npm run build:helper

# 编译 hodor DLL（如已预编译则跳过）
# cd ../hodor && build.bat && copy UnlockProvider.dll ../ble-heart/dist-electron/hodor/

# 启动开发服务器（Vite + Electron）
npm run dev
```

### 首次运行 — 注册解锁组件

hodor 的 Credential Provider DLL 需要注册到 Windows 才能工作，**需要管理员权限**：

```bash
# 以管理员身份运行应用一次，自动完成注册
# 或手动注册（管理员终端）:
cd d:/program/hodor
register.bat
```

注册后 DLL 由 Windows LogonUI 在锁屏时自动加载，无需额外进程。

### 构建安装包

```bash
npm run build
# 输出: release/BLE Heart Monitor Setup x.x.x.exe
```

## 使用说明

1. **设置密码** — 在"设置"页面输入 Windows 登录密码（DPAPI 加密存储）
2. **扫描设备** — 点击"扫描设备"，选择你的 BLE 心率设备
3. **连接** — 连接后仪表盘显示实时心率
4. **自动锁屏** — 离开电脑（设备断开/心跳超时），2 秒后自动锁屏
5. **自动解锁** — 返回电脑（心率恢复），自动解锁
6. **手动测试** — 设置页面提供"测试锁屏"和"测试解锁"按钮

## 配置项

| 配置 | 默认值 | 说明 |
|---|---|---|
| 心跳超时 | 15 秒 | 超过此时长未收到心率数据则锁屏 |
| 自动解锁 | 关闭 | 开启后心率恢复自动解锁 |
| 开机启动 | 关闭 | 系统启动时自动运行 |

## 项目结构

```
ble-heart/
├── electron/                  # Electron 主进程 (TypeScript)
│   ├── main.ts                # 入口
│   ├── state.ts               # 状态机
│   ├── config.ts              # 配置管理
│   ├── tray.ts                # 系统托盘
│   ├── ipc-handlers.ts        # IPC 处理
│   ├── ble/                   # BLE 管理
│   │   ├── manager.ts         # BLE 管理器（与 C# 进程通信）
│   │   ├── heart-rate-parser.ts
│   │   └── types.ts
│   └── system/                # 系统控制
│       ├── lock.ts            # 锁屏控制
│       ├── lock-detect.ts     # 锁屏状态检测 (koffi → Win32)
│       ├── unlock.ts          # 解锁调度
│       ├── pipe-unlock.ts     # Named Pipe 解锁客户端
│       ├── hodor-registry.ts  # DLL 注册管理
│       └── safe-storage.ts    # 密码安全存储 (DPAPI)
├── src/                       # 前端 (Vue 3)
│   ├── views/
│   │   ├── Dashboard.vue
│   │   └── Settings.vue
│   ├── components/
│   │   ├── HeartRateDisplay.vue
│   │   ├── DeviceScan.vue
│   │   ├── StatusBadge.vue
│   │   └── TimeoutSlider.vue
│   └── composables/
│       └── useElectron.ts
├── ble-helper/                # C# BLE 辅助进程
│   ├── Program.cs
│   ├── BleScanner.cs
│   ├── BleConnector.cs
│   └── Protocol.cs
├── dist-electron/             # 编译产物
│   ├── main.js
│   ├── preload.js
│   ├── hodor/                 # hodor Credential Provider DLL
│   └── ble-helper/            # C# 发布产物
├── test-pipe-unlock.js        # 管道解锁端到端测试脚本
└── package.json
```

## 测试

```bash
# 管道解锁端到端测试（锁屏 → 管道连接 → 解锁）
node test-pipe-unlock.js <你的Windows密码>
```

## 安全

- 密码通过 Windows **DPAPI** 加密，仅当前用户可解密
- 解锁使用 **Kerberos** 原生认证，密码仅在管道中传输，不落盘
- hodor 命名管道仅接受本地连接（`PIPE_REJECT_REMOTE_CLIENTS` + DACL）
- 凭据缓冲区使用 `SecureZeroMemory` 即时清零

## License

MIT
