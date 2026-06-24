import { existsSync, mkdirSync, readFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import os from 'node:os'
import path from 'node:path'
import { defineConfig, loadEnv } from 'vite'
import vue from '@vitejs/plugin-vue'
import AutoImport from 'unplugin-auto-import/vite'
import Components from 'unplugin-vue-components/vite'
import { ElementPlusResolver } from 'unplugin-vue-components/resolvers'

// 读取 package.json 版本号
const pkg = JSON.parse(readFileSync(`${process.cwd()}/package.json`, 'utf-8'))

function isLoopbackHost(hostname: string): boolean {
  return ['localhost', '127.0.0.1', '::1', '[::1]'].includes(hostname)
}

const TRUSTED_HTTPS_ORIGIN =
  process.env.OPENCLAW_TRUSTED_HTTPS_ORIGIN || 'https://example-host.ts.net'
const TRUSTED_HTTPS_HOST = new URL(TRUSTED_HTTPS_ORIGIN).hostname

function isTrustedTailscaleHost(hostname: string): boolean {
  return hostname === TRUSTED_HTTPS_HOST || hostname.endsWith('.ts.net')
}

function localIpv4Addresses(): string[] {
  const addresses: string[] = []
  for (const entries of Object.values(os.networkInterfaces())) {
    for (const item of entries || []) {
      if (item.family === 'IPv4' && !item.internal) addresses.push(item.address)
    }
  }
  return addresses
}

function loadLocalHttpsConfig() {
  if (process.env.OPENCLAW_HTTPS !== '1') return undefined

  const certDir = path.join(os.homedir(), '.openclaw', 'dashboard-certs')
  const keyPath = path.join(certDir, 'openclaw-dashboard.key')
  const certPath = path.join(certDir, 'openclaw-dashboard.crt')
  mkdirSync(certDir, { recursive: true })

  if (!existsSync(keyPath) || !existsSync(certPath)) {
    const san = [
      'DNS:localhost',
      'IP:127.0.0.1',
      'IP:::1',
      ...localIpv4Addresses().map(ip => `IP:${ip}`),
    ].join(',')
    try {
      execFileSync('openssl', [
        'req',
        '-x509',
        '-newkey', 'rsa:2048',
        '-nodes',
        '-sha256',
        '-days', '825',
        '-subj', '/CN=OpenClaw Dashboard Local',
        '-addext', `subjectAltName=${san}`,
        '-keyout', keyPath,
        '-out', certPath,
      ], { stdio: 'ignore' })
      console.log(`[Vite] 已生成本地 HTTPS 证书：${certDir}`)
    } catch (e: any) {
      console.warn(`[Vite] 无法生成本地 HTTPS 证书，将回退 HTTP：${e?.message || e}`)
      return undefined
    }
  }

  return {
    key: readFileSync(keyPath),
    cert: readFileSync(certPath),
  }
}

function smartVoiceEntryRedirectPlugin() {
  return {
    name: 'openclaw-smart-voice-entry',
    configureServer(server: any) {
      server.middlewares.use((req: any, res: any, next: any) => {
        const isHttpsServer = process.env.OPENCLAW_HTTPS === '1'
        const frontendPort = process.env.FRONTEND_PORT || '31001'
        if (isHttpsServer || frontendPort !== '31021') {
          next()
          return
        }

        const forwardedProto = String(req.headers['x-forwarded-proto'] || '').split(',')[0].trim()
        if (forwardedProto === 'https') {
          next()
          return
        }

        const hostHeader = String(req.headers.host || '')
        const hostname = hostHeader.replace(/^\[/, '').replace(/\].*$/, '').split(':')[0]
        if (!hostname || isLoopbackHost(hostname) || isTrustedTailscaleHost(hostname)) {
          next()
          return
        }

        const target = `${TRUSTED_HTTPS_ORIGIN}${req.url || '/'}`
        res.statusCode = 302
        res.setHeader('Location', target)
        res.setHeader('Cache-Control', 'no-store')
        res.end(`Redirecting to ${target}`)
      })
    },
  }
}

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const gatewayUrl = env.VITE_GATEWAY_URL || 'http://127.0.0.1:18789'
  const frontendPort = parseInt(process.env.FRONTEND_PORT || '31001', 10)
  const backendPort = parseInt(process.env.BACKEND_PORT || env.VITE_BACKEND_PORT || '31002', 10)
  const https = loadLocalHttpsConfig()

  console.log('[Vite] Gateway URL:', gatewayUrl)
  console.log('[Vite] Frontend Port:', frontendPort)
  console.log('[Vite] Backend Port (for proxy):', backendPort)
  console.log('[Vite] HTTPS:', https ? 'enabled' : 'disabled')

  // 用变量承载配置，末尾让 preview 完全复用 server（远程生产预览 vite preview 用同样的代理 / https）
  const config: any = {
    cacheDir: '.vite-cache',
    define: {
      __APP_VERSION__: JSON.stringify(pkg.version),
    },
    plugins: [
      smartVoiceEntryRedirectPlugin(),
      vue(),
      AutoImport({
        resolvers: [ElementPlusResolver()],
      }),
      Components({
        resolvers: [ElementPlusResolver()],
      }),
    ],
    server: {
      host: '0.0.0.0',
      port: frontendPort,
      https,
      allowedHosts: [TRUSTED_HTTPS_HOST],
      proxy: {
        '/api/gpu-vram': {
          // GPU VRAM 统一服务 (端口 31002)
          target: `http://localhost:${backendPort}`,
          changeOrigin: true,
        },
        '/api/usage': {
          // Usage Stats 统一服务 (端口 31002)
          target: `http://localhost:${backendPort}`,
          changeOrigin: true,
        },
        '/api/agents-configured': {
          // 已配置 agent 列表 (端口 31002, 修复升级后新 agent 不显示问题)
          target: `http://localhost:${backendPort}`,
          changeOrigin: true,
        },
        '/api/agent-running-status': {
          // Agent 运行状态检测（基于 session 文件 mtime，端口 31002）
          target: `http://localhost:${backendPort}`,
          changeOrigin: true,
        },
        '/api/agent-full-history': {
          // Agent 全部历史聊天记录（聚合所有 session 文件，端口 31002）
          target: `http://localhost:${backendPort}`,
          changeOrigin: true,
        },
        '/api/agent-stream': {
          // Agent 消息 SSE 流式增量（替代 3 秒轮询，端口由 BACKEND_PORT 决定）
          target: `http://localhost:${backendPort}`,
          changeOrigin: true,
        },
        '/api/session-detail': {
          // 单个 session 详情（活动时间线点击查看做了什么，端口 31002）
          target: `http://localhost:${backendPort}`,
          changeOrigin: true,
        },
        '/api/session-fulltext': {
          // 历史搜索"展开全文"：返回单会话完整原文（端口由 BACKEND_PORT 决定）
          target: `http://localhost:${backendPort}`,
          changeOrigin: true,
        },
        '/api/agent-daily-summary': {
          // Agent 按日期历史总结（端口 31002）
          target: `http://localhost:${backendPort}`,
          changeOrigin: true,
        },
        '/api/day-summary-ai': {
          // 历史总结 AI 摘要（本地Gemma/DeepSeek，端口 31002）
          target: `http://localhost:${backendPort}`,
          changeOrigin: true,
        },
        '/api/agent-crons': {
          // 获取 Agent 定时任务列表（端口 31002）
          target: `http://localhost:${backendPort}`,
          changeOrigin: true,
        },
        '/api/agent-live-activity': {
          // 读取 Agent 实时活动（session jsonl 末尾，端口 31002）
          target: `http://localhost:${backendPort}`,
          changeOrigin: true,
        },
        '/api/agent-latest-reply': {
          // 语音通话用：轻量取最新一条 assistant 回复（只读会话末尾，避免拉全量历史）
          target: `http://localhost:${backendPort}`,
          changeOrigin: true,
        },
        '/api/agent-send-message': {
          // 通过 openclaw CLI 发消息给 agent（端口 31002）
          target: `http://localhost:${backendPort}`,
          changeOrigin: true,
        },
        '/api/agent-model': {
          // 查 agent 当前模型 + 可选模型
          target: `http://localhost:${backendPort}`,
          changeOrigin: true,
        },
        '/api/agent-set-model': {
          // 切换 agent 主模型
          target: `http://localhost:${backendPort}`,
          changeOrigin: true,
        },
        '/api/quick-chat': {
          // Lumi 式直连流式对话(绕开网关/重型 agent)；SSE 流式，不能缓冲
          target: `http://localhost:${backendPort}`,
          changeOrigin: true,
        },
        '/api/voice/asr-stream': {
          // 实时语音识别 WebSocket（阿里 paraformer-realtime，边说边识别）——必须放在 /api/voice 前、且开 ws
          target: `ws://localhost:${backendPort}`,
          ws: true,
          changeOrigin: true,
        },
        '/api/voice': {
          // 语音对话：能力诊断 + 本地 STT fallback（端口 31002）
          target: `http://localhost:${backendPort}`,
          changeOrigin: true,
        },
        '/api/billing-config': {
          // 计费配置读写（端口 31002）
          target: `http://localhost:${backendPort}`,
          changeOrigin: true,
        },
        '/api/file-manager': {
          // 文件管理器（端口 31002）
          target: `http://localhost:${backendPort}`,
          changeOrigin: true,
        },
        '/api/cost-summary': {
          // 费用预估（端口 31002）
          target: `http://localhost:${backendPort}`,
          changeOrigin: true,
        },
        '/api/cost-timeline': {
          // 费用时间线（端口 31002）
          target: `http://localhost:${backendPort}`,
          changeOrigin: true,
        },
        '/api/projects': {
          // 项目看板 API（端口 31002）
          target: `http://localhost:${backendPort}`,
          changeOrigin: true,
        },
        '/api/cron': {
          // Cron 任务中心 API（端口 31002）
          target: `http://localhost:${backendPort}`,
          changeOrigin: true,
        },
        '/api/search': {
          // 全局搜索 API（端口 31002, Sprint 7+8）
          target: `http://localhost:${backendPort}`,
          changeOrigin: true,
        },
        '/api/skill-usage': {
          // 技能调用排行榜（端口 31002, Sprint 8 #8）
          target: `http://localhost:${backendPort}`,
          changeOrigin: true,
        },
        '/api/activity-timeline': {
          // 活动时间线 API（端口 31002, Sprint 7）
          target: `http://localhost:${backendPort}`,
          changeOrigin: true,
        },
        '/api/upload-image': {
          // 图片上传 API (端口 31002, REC-093)
          target: `http://localhost:${backendPort}`,
          changeOrigin: true,
        },
        '/uploads': {
          // 上传图片静态文件 (端口 31002, REC-093)
          target: `http://localhost:${backendPort}`,
          changeOrigin: true,
        },
        '/api/system': {
          // 系统版本 API (端口 31002, REC-066)
          target: `http://localhost:${backendPort}`,
          changeOrigin: true,
        },
        '/reset': {
          // 重置 Agent API (端口 31002, REC-005)
          target: `http://localhost:${backendPort}`,
          changeOrigin: true,
        },
        '/api': {
          target: gatewayUrl,
          changeOrigin: true,
          ws: true, // Enable WebSocket proxy
          rewrite: (path: string) => path.replace(/^\/api/, ''),
        },
      },
    },
    build: {
      rollupOptions: {
        output: {
          manualChunks(id: string) {
            if (id.includes('node_modules')) {
              if (id.includes('element-plus')) return 'element-plus'
              if (id.includes('vue') || id.includes('pinia')) return 'vendor'
              return 'async-vendor'
            }
          },
        },
      },
    },
  }
  config.preview = config.server
  return config
})
