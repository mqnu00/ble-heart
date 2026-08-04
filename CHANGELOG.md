# Changelog

本项目的所有重要变更都会记录在此文件中。

格式基于 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.0.0/)，版本号遵循 [语义化版本](https://semver.org/lang/zh-CN/)。

## [1.0.0] - 2026-07-31

首个正式版本：基于 BLE 心率监测的 Windows 自动锁屏/解锁工具。

### 新增

- **BLE 心率监测** — 连接标准 BLE 心率设备（智能手表、心率带），实时显示心率
- **自动锁屏** — 设备断开或心跳超时（默认 15 秒，可配置）时自动锁定 Windows
- **自动解锁** — 心率恢复后通过 Windows Credential Provider 原生认证自动解锁，替代不可靠的 SendKeys 模拟按键方案
- **自动重连** — 设备意外断开后自动启动广播监听并重连；用户手动断开则不会重连
- **系统托盘** — 最小化到托盘后台运行
- **可配置项** — 心跳超时时间、解锁确认时长（1–10 秒，默认 3）、自动解锁开关、开机自启动
- **密码安全存储** — Windows DPAPI 加密登录密码，仅当前用户可解密
- **锁屏检测** — koffi FFI 调用 Win32 `OpenInputDesktop` 实时检测锁屏状态

### 修复

- 打包后无法运行的问题：koffi 原生模块正确纳入打包、`ble-helper` 改为自包含发布、构建前自动结束旧进程
- 构建流程改用 `--dir` 免签名模式（NSIS 安装包需联网下载 winCodeSign）
- BLE 扫描 watcher 构造后状态为 Created 导致 `Start()` 未执行的问题
- 重连期间连接失败被误判为用户手动断开的问题

### 其他

- 新增构建说明文档（`build:dir` 与 `build:nsis` 区分）
