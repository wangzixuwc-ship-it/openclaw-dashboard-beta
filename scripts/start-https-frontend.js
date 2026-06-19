import { spawn } from 'child_process'
import os from 'os'

const frontendPort = process.env.FRONTEND_PORT || '31023'
const backendPort = process.env.BACKEND_PORT || '31022'

const env = {
  ...process.env,
  OPENCLAW_HTTPS: '1',
  FRONTEND_PORT: frontendPort,
  BACKEND_PORT: backendPort,
  VITE_BACKEND_URL: `http://127.0.0.1:${backendPort}`,
  OPENCLAW_DASHBOARD_PROFILE: process.env.OPENCLAW_DASHBOARD_PROFILE || '2.0',
}

console.log('='.repeat(56))
console.log('OpenClaw Dashboard 2.0 HTTPS voice entry')
console.log(`前端：https://127.0.0.1:${frontendPort}`)
for (const entries of Object.values(os.networkInterfaces())) {
  for (const item of entries || []) {
    if (item.family === 'IPv4' && !item.internal) {
      console.log(`内网：https://${item.address}:${frontendPort}`)
    }
  }
}
console.log(`后端：http://127.0.0.1:${backendPort}`)
console.log('提示：这是语音/远程访问专用 HTTPS 入口；普通工作台仍可用 http://127.0.0.1:31021。')
console.log('='.repeat(56))

const child = spawn('npx', ['vite', '--host', '0.0.0.0', '--port', frontendPort], {
  cwd: process.cwd(),
  env,
  stdio: 'inherit',
  shell: process.platform === 'win32',
})

process.on('SIGINT', () => {
  child.kill('SIGTERM')
  process.exit(0)
})
process.on('SIGTERM', () => {
  child.kill('SIGTERM')
  process.exit(0)
})
