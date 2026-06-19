import { spawn } from 'child_process'
import os from 'os'

const PROFILES = {
  v2: { label: '2.0', frontendPort: 31021, backendPort: 31022 },
}

function parseProfile() {
  const arg = process.argv.slice(2).find((item) => item.startsWith('--profile='))
  const direct = process.argv.slice(2).find((item) => !item.startsWith('--'))
  return (arg?.split('=')[1] || direct || 'v2').toLowerCase()
}

const profileName = parseProfile()
const profile = PROFILES[profileName]
const httpsEnabled = process.argv.includes('--https') || process.env.OPENCLAW_HTTPS === '1'

if (!profile) {
  console.error(`未知启动配置：${profileName}`)
  console.error(`可用配置：${Object.keys(PROFILES).join(', ')}`)
  process.exit(1)
}

const env = {
  ...process.env,
  FRONTEND_PORT: String(profile.frontendPort),
  BACKEND_PORT: String(profile.backendPort),
  VITE_BACKEND_URL: `http://127.0.0.1:${profile.backendPort}`,
  OPENCLAW_HTTPS: httpsEnabled ? '1' : '',
  OPENCLAW_DASHBOARD_PROFILE: profile.label,
}

console.log('='.repeat(56))
console.log(`OpenClaw Dashboard ${profile.label}`)
const scheme = httpsEnabled ? 'https' : 'http'
console.log(`前端：${scheme}://127.0.0.1:${profile.frontendPort}`)
if (httpsEnabled) {
  const ips = []
  for (const entries of Object.values(os.networkInterfaces())) {
    for (const item of entries || []) {
      if (item.family === 'IPv4' && !item.internal) ips.push(item.address)
    }
  }
  for (const ip of ips) console.log(`内网：${scheme}://${ip}:${profile.frontendPort}`)
  console.log('提示：首次打开 HTTPS 本地证书时，浏览器会提示不受信任，手动继续后即可授权麦克风。')
}
console.log(`后端：http://127.0.0.1:${profile.backendPort}`)
console.log('='.repeat(56))

const children = []

function start(command, args) {
  const child = spawn(command, args, {
    cwd: process.cwd(),
    env,
    stdio: 'inherit',
    shell: process.platform === 'win32',
  })
  children.push(child)
  child.on('exit', (code, signal) => {
    if (signal) return
    if (code && code !== 0) {
      console.error(`${command} ${args.join(' ')} 退出，code=${code}`)
      stopAll()
    }
  })
  return child
}

function stopAll() {
  for (const child of children) {
    if (!child.killed) child.kill('SIGTERM')
  }
}

process.on('SIGINT', () => {
  stopAll()
  process.exit(0)
})
process.on('SIGTERM', () => {
  stopAll()
  process.exit(0)
})

start('node', ['scripts/unified-service.js'])
start('npx', ['vite', '--host', '0.0.0.0'])
