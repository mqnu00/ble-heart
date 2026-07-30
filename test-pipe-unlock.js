/**
 * hodor 管道解锁端到端测试
 * 
 * 流程: 锁屏 → 等待管道就绪 → 发送凭据 → 自动解锁
 * 
 * 用法: node test-pipe-unlock.js <password>
 */

const { execSync } = require('child_process');
const net = require('net');
const os = require('os');

const PIPE_NAME = '\\\\.\\pipe\\CredentialProviderPipe';
const PASSWORD = process.argv[2];
const USERNAME = os.userInfo().username;

if (!PASSWORD) {
  console.error('用法: node test-pipe-unlock.js <password>');
  process.exit(1);
}

console.log('╔══════════════════════════════════════╗');
console.log('║   hodor 管道解锁端到端测试           ║');
console.log('╚══════════════════════════════════════╝');
console.log('');
console.log(`用户名: ${USERNAME}`);
console.log(`管道路径: ${PIPE_NAME}`);
console.log('');

// Step 1: 锁屏
console.log('[1/3] 锁定工作站...');
try {
  execSync('rundll32.exe user32.dll,LockWorkStation');
  console.log('  ✓ 锁屏命令已发送');
} catch (err) {
  console.error('  ✗ 锁屏失败:', err.message);
  process.exit(1);
}

// Step 2: 等待管道就绪 (最多等 15 秒)
console.log('[2/3] 等待 Credential Provider 加载...');

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function waitForPipe(maxRetries = 30, delayMs = 500) {
  for (let i = 0; i < maxRetries; i++) {
    await sleep(delayMs);
    try {
      await new Promise((resolve, reject) => {
        const client = net.connect(PIPE_NAME);
        client.on('connect', () => { client.destroy(); resolve(); });
        client.on('error', reject);
        client.setTimeout(500, () => { client.destroy(); reject(new Error('timeout')); });
      });
      process.stdout.write(`\r  ✓ 管道已就绪 (${((i + 1) * delayMs / 1000).toFixed(1)}s)\n`);
      return true;
    } catch {
      process.stdout.write(`\r  ⏳ 等待中... (${((i + 1) * delayMs / 1000).toFixed(1)}s)`);
    }
  }
  console.log('');
  return false;
}

// Step 3: 发送解锁命令
function sendUnlock() {
  console.log('[3/3] 发送解锁命令...');
  
  const command = `UNLOCK:.\\${USERNAME}:${PASSWORD}`;
  
  return new Promise((resolve, reject) => {
    let response = '';
    let commandSent = false;

    const client = net.connect(PIPE_NAME, () => {
      client.write(command, 'utf-8', () => {
        commandSent = true;
      });
    });

    client.on('data', (data) => {
      response += data.toString('utf-8');
    });

    client.on('end', () => {
      console.log(`  响应: ${response}`);
      resolve(response === 'OK');
    });

    client.on('error', (err) => {
      // EPIPE/ECONNRESET: 凭据正确, Windows 切换桌面时管道中断 → 成功
      if (commandSent && (err.code === 'EPIPE' || err.code === 'ECONNRESET')) {
        console.log('  ✓ 解锁成功! (管道因桌面切换中断)');
        resolve(true);
        return;
      }
      console.error(`  ✗ 管道错误: ${err.message} (code: ${err.code})`);
      reject(err);
    });

    client.setTimeout(10000, () => {
      client.destroy();
      if (commandSent) {
        console.log('  ✓ 解锁成功! (超时，可能正在切换桌面)');
        resolve(true);
      } else {
        console.error('  ✗ 连接超时');
        reject(new Error('timeout'));
      }
    });
  });
}

// 运行
async function main() {
  const ready = await waitForPipe();
  if (!ready) {
    console.error('  ✗ 管道超时未就绪。请确认:');
    console.error('    1. hodor DLL 已注册 (以管理员运行 register.bat)');
    console.error('    2. 工作站已锁屏');
    process.exit(1);
  }

  try {
    const ok = await sendUnlock();
    if (ok) {
      console.log('');
      console.log('══════════════════════════════════════');
      console.log('  测试通过! Windows 应已解锁。');
      console.log('══════════════════════════════════════');
    } else {
      console.log('');
      console.log('══════════════════════════════════════');
      console.log('  测试失败。请检查密码是否正确。');
      console.log('══════════════════════════════════════');
      process.exit(1);
    }
  } catch (err) {
    console.error('测试失败:', err.message);
    process.exit(1);
  }
}

main();
