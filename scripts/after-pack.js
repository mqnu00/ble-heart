/**
 * electron-builder afterPack 钩子
 * 清理打包产物中的冗余文件，减小体积。
 */

const fs = require('fs')
const path = require('path')

/** 保留的语言 */
const KEEP_LOCALES = ['en-US.pak', 'en.pak', 'zh-CN.pak', 'zh.pak']

/** 可安全移除的 GPU 相关 DLL（非 WebGL 应用不需要） */
const GPU_DLLS = [
  'dxcompiler.dll',       // ~21MB DirectX shader compiler
  'd3dcompiler_47.dll',   // ~4.7MB
  'libEGL.dll',           // 468KB EGL
  'libGLESv2.dll',        // ~7.5MB OpenGL ES
  'vk_swiftshader.dll',   // ~5MB Vulkan software renderer
  'vulkan-1.dll',         // 928KB Vulkan loader
  'dxil.dll',             // ~1.5MB DirectX IL compiler (WebGPU only)
]

exports.default = async function (context) {
  const appOutDir = context.appOutDir
  const stats = { removed: 0, savedBytes: 0 }

  // 1. 清理多余语言包
  const localesDir = path.join(appOutDir, 'locales')
  if (fs.existsSync(localesDir)) {
    const files = fs.readdirSync(localesDir)
    for (const file of files) {
      if (!KEEP_LOCALES.includes(file) && file.endsWith('.pak')) {
        const filePath = path.join(localesDir, file)
        const size = fs.statSync(filePath).size
        fs.unlinkSync(filePath)
        stats.removed++
        stats.savedBytes += size
        console.log(`  [afterPack] removed locale: ${file} (${(size / 1024 / 1024).toFixed(1)}MB)`)
      }
    }
  }

  // 2. 清理 GPU DLL（注意：不能删 ffmpeg.dll，Electron 启动时依赖它）
  for (const dll of GPU_DLLS) {
    const dllPath = path.join(appOutDir, dll)
    if (fs.existsSync(dllPath)) {
      const size = fs.statSync(dllPath).size
      fs.unlinkSync(dllPath)
      stats.removed++
      stats.savedBytes += size
      console.log(`  [afterPack] removed DLL: ${dll} (${(size / 1024 / 1024).toFixed(1)}MB)`)
    }
  }

  // 3. 清理 koffi 多平台二进制（如果 files 配置没拦住）
  const koffiBuildDir = path.join(appOutDir, 'resources', 'app', 'node_modules', 'koffi', 'build', 'koffi')
  if (fs.existsSync(koffiBuildDir)) {
    const dirs = fs.readdirSync(koffiBuildDir)
    for (const dir of dirs) {
      if (dir !== 'win32_x64') {
        const dirPath = path.join(koffiBuildDir, dir)
        if (fs.statSync(dirPath).isDirectory()) {
          fs.rmSync(dirPath, { recursive: true })
          stats.removed++
          console.log(`  [afterPack] removed koffi arch: ${dir}`)
        }
      }
    }
  }

  // 4. 清理 PDB 调试符号
  function removePdbs(dir) {
    if (!fs.existsSync(dir)) return
    const entries = fs.readdirSync(dir, { withFileTypes: true })
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name)
      if (entry.isDirectory()) {
        removePdbs(fullPath)
      } else if (entry.name.endsWith('.pdb')) {
        const size = fs.statSync(fullPath).size
        fs.unlinkSync(fullPath)
        stats.removed++
        stats.savedBytes += size
      }
    }
  }
  removePdbs(appOutDir)

  const savedMB = (stats.savedBytes / 1024 / 1024).toFixed(1)
  console.log(`[afterPack] 清理完成: ${stats.removed} 个文件, 节省 ${savedMB}MB`)
}
