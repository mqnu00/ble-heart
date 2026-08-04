#!/usr/bin/env node
/**
 * 从 CHANGELOG.md 提取指定版本的段落，输出到 stdout。
 * 用法: node scripts/extract-changelog.js <version>
 *
 * 支持任意级别标题（1-4 个 #）中出现版本号的写法，如：
 *   ## [1.2.0] - 2026-08-04
 *   ## 1.2.0
 * 段落边界为下一个"级别不高于版本标题"的标题，段落内的 ### 子标题会被保留。
 * 若文件不存在或未找到该版本，输出 __NO_CHANGELOG__ 且退出码为 0。
 */

const fs = require('fs')
const path = require('path')

const version = process.argv[2]
if (!version) {
  console.error('Usage: node scripts/extract-changelog.js <version>')
  process.exit(1)
}

const file = path.join(process.cwd(), 'CHANGELOG.md')
if (!fs.existsSync(file)) {
  console.log('__NO_CHANGELOG__')
  process.exit(0)
}

const text = fs.readFileSync(file, 'utf8')
const esc = version.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

// 定位版本标题行（如 "## [1.2.0] - 2026-08-04"）
const titleRe = new RegExp('^#{1,4}\\s*\\[?' + esc + '\\]?[^\\n]*', 'm')
const m = text.match(titleRe)
if (!m) {
  console.log('__NO_MATCH__')
  process.exit(0)
}

// 从标题行结束后找下一个"级别不高于版本标题"的标题行，作为段落终点
const level = m[0].match(/^#+/)[0].length
const rest = text.slice(m.index + m[0].length)
const next = rest.search(new RegExp(`^#{1,${level}}\\s`, 'm'))
const end = next === -1 ? text.length : m.index + m[0].length + next

process.stdout.write(text.slice(m.index, end).replace(/\r\n/g, '\n').trim() + '\n')
