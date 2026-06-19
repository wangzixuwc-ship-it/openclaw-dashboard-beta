<template>
  <!-- 内嵌版本历史面板（Changelog Panel — 版本迭代说明） -->
  <div class="cl-panel">
    <!-- 顶部工具栏 -->
    <div class="cl-toolbar">
      <div class="cl-toolbar-left">
        <span class="cl-count">2.0 版本记录</span>
        <span class="cl-range">当前体系：Workbench 2.0 · 最新：{{ versions[0]?.date || '-' }}</span>
      </div>
      <div class="cl-toolbar-right">
        <button class="cl-btn cl-btn-share" @click="copyShare" :disabled="!selected" title="复制选中版本的介绍 + 部署链接，发给别人即可部署该版本">
          分享此版本
        </button>
        <button class="cl-btn cl-btn-ghost" @click="fetchBackups" :disabled="loadingBackups" title="刷新备份列表">
          <span v-if="loadingBackups" class="cl-spin">刷新中</span>
          <span v-else>备份（{{ backups.length }}）</span>
        </button>
        <button class="cl-btn cl-btn-ghost" @click="load" title="刷新版本列表">刷新</button>
      </div>
    </div>

    <!-- 主内容：左侧版本列表 + 右侧功能详情 -->
    <div class="cl-body">
      <!-- 左侧版本时间线 -->
      <div class="cl-sidebar">
        <div
          v-for="v in versions"
          :key="v.version"
          class="cl-version-item"
          :class="{ active: selected?.version === v.version, current: v.version === currentVersion }"
          @click="selected = v"
        >
          <span class="cl-ver-dot" :class="v.version === currentVersion ? 'dot-current' : 'dot-normal'"></span>
          <div class="cl-ver-main">
            <span class="cl-ver-num">v{{ v.version }}</span>
            <div v-if="v.channel === 'beta' || v.version === currentVersion" class="cl-ver-tags">
              <span v-if="v.channel === 'beta'" class="cl-ver-beta">内测</span>
              <span v-if="v.version === currentVersion" class="cl-ver-badge">当前</span>
            </div>
            <div class="cl-ver-desc">
              <span class="cl-ver-tag">{{ v.tag }}</span>
              <span class="cl-ver-date">{{ v.date }}</span>
            </div>
          </div>
        </div>
      </div>

      <!-- 右侧版本详情 -->
      <div class="cl-detail" v-if="selected">
        <div class="cl-detail-header">
          <div class="cl-detail-title-wrap">
            <h3 class="cl-detail-title">v{{ selected.version }} · {{ selected.summary }}</h3>
            <div class="cl-detail-meta">
              <el-tag size="small" :type="selected.channel === 'beta' ? 'warning' : 'success'" effect="dark">{{ selected.channel === 'beta' ? '内测版 Beta' : '正式版' }}</el-tag>
              <el-tag size="small" type="info" effect="plain">{{ selected.tag }}</el-tag>
              <span class="cl-detail-date">{{ selected.date }}</span>
              <el-tag v-if="selected.version === currentVersion" size="small" type="success" effect="light">当前版本</el-tag>
            </div>
          </div>
        </div>

        <ul class="cl-feature-list">
          <li v-for="(f, i) in selected.features" :key="i" class="cl-feature-item">
            <span class="cl-feature-dot"></span>
            <span class="cl-feature-text">{{ f }}</span>
          </li>
        </ul>

        <!-- 该版本对应的功能截图 -->
        <figure v-if="selected.image" class="cl-feature-shot">
          <img :src="selected.image" :alt="`v${selected.version} ${selected.summary}`" loading="lazy" />
          <figcaption>v{{ selected.version }} · {{ selected.tag }}</figcaption>
        </figure>

        <!-- 版本回退（Rollback）区域 -->
        <div v-if="selected.version !== currentVersion" class="cl-rollback-section">
          <div class="cl-rollback-header">
            <span class="cl-rollback-title">版本回退（Rollback）</span>
            <span class="cl-rollback-hint">出现问题时可恢复到该版本的 dist 备份</span>
          </div>

          <!-- 加载备份中 -->
          <div v-if="loadingBackups" class="cl-rollback-loading">
            <span class="cl-spin">检查中</span> 正在检查备份...
          </div>

          <!-- 有可用备份 -->
          <div v-else-if="backupsForSelected.length > 0" class="cl-backup-list">
            <div
              v-for="bk in backupsForSelected"
              :key="bk.path"
              class="cl-backup-item"
            >
              <div class="cl-backup-info">
                <span class="cl-backup-time">{{ bk.date }}</span>
                <span class="cl-backup-size">{{ bk.sizeDisplay }}</span>
                <span class="cl-backup-path">{{ bk.path }}</span>
              </div>
              <button
                class="cl-btn cl-btn-rollback"
                :disabled="rollingBack === bk.path"
                @click="rollback(bk)"
              >
                {{ rollingBack === bk.path ? '恢复中...' : '恢复此备份' }}
              </button>
            </div>
          </div>

          <!-- 无备份 -->
          <div v-else class="cl-no-backup">
            <span>暂无该版本备份</span>
            <span class="cl-no-backup-hint">每次服务启动时自动备份当前 dist，重启一次后即可看到备份</span>
          </div>
        </div>

        <!-- 当前版本提示 -->
        <div v-else class="cl-current-hint">
          <span>这是当前运行版本，无需回退</span>
          <span class="cl-current-sub">2.0 页面只保留当前体系的版本说明</span>
        </div>
      </div>

      <!-- 右侧空状态 -->
      <div class="cl-detail cl-detail-empty" v-else>
        <span class="cl-empty-text">点击左侧版本查看详情</span>
      </div>
    </div>

    <!-- 底部备份管理（所有备份一览）-->
    <div v-if="showAllBackups && backups.length > 0" class="cl-all-backups">
      <div class="cl-all-backups-header">
        <span>所有可用备份（All Backups）</span>
        <button class="cl-btn cl-btn-ghost" @click="showAllBackups = false">收起</button>
      </div>
      <div class="cl-all-backups-list">
        <div v-for="bk in backups" :key="bk.path" class="cl-backup-item">
          <div class="cl-backup-info">
            <span class="cl-backup-ver">v{{ bk.version }}</span>
            <span class="cl-backup-time">{{ bk.date }}</span>
            <span class="cl-backup-size">{{ bk.sizeDisplay }}</span>
          </div>
          <button
            class="cl-btn cl-btn-rollback"
            :disabled="rollingBack === bk.path"
            @click="rollback(bk)"
          >
            {{ rollingBack === bk.path ? '恢复中...' : '恢复' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import CHANGELOG from '../changelog.json'

// ── 版本数据（Changelog Data）──
interface VersionEntry {
  version: string
  date: string
  tag: string
  summary: string
  features: string[]
  image?: string
  channel?: 'stable' | 'beta'
}

// ── 备份条目（Backup Item）──
interface BackupItem {
  path: string
  version: string
  date: string
  ts: number
  sizeDisplay: string
}

const versions = ref<VersionEntry[]>(CHANGELOG.versions as VersionEntry[])
const selected = ref<VersionEntry | null>(versions.value[0] || null)
const currentVersion = ref<string>('')
const backups = ref<BackupItem[]>([])
const loadingBackups = ref(false)
const rollingBack = ref<string | null>(null)
const showAllBackups = ref(false)

// 过滤出与当前选中版本匹配的备份
const backupsForSelected = computed(() => {
  if (!selected.value) return []
  return backups.value.filter(b => b.version === selected.value!.version)
})

// 复制「当前选中版本」的分享内容（介绍 + 该版本功能 + 该版本部署链接），粘贴给别人即可部署对应版本
// 仓库地址从环境变量 VITE_SHARE_REPO_URL 读，不写死任何仓库
function copyShare() {
  const v = selected.value
  if (!v) return
  const repo = (import.meta.env.VITE_SHARE_REPO_URL as string) || 'https://github.com/<你的用户名>/openclaw-dashboard'
  const channel = v.channel === 'beta' ? '内测版' : '正式版'
  const feats = (v.features || []).map((f) => '· ' + f).join('\n')
  const text = `OpenClaw Dashboard · v${v.version}（${channel}）—— 多 Agent 可视化管理工作台
${v.summary}

本版功能：
${feats}

下载部署：${repo}/releases/tag/v${v.version}
（下载源码包 → npm install → 复制 .env.example 为 .env 填配置 → npm run dev）`
  navigator.clipboard.writeText(text).then(
    () => ElMessage.success(`已复制 v${v.version} 的分享内容，直接粘贴给别人`),
    () => ElMessage.error('复制失败，请检查浏览器剪贴板权限，或手动复制'),
  )
}

// 加载当前 package.json 版本号
async function load() {
  try {
    // 从 APP_VERSION 全局变量获取当前版本（vite define 注入）
    if (typeof __APP_VERSION__ !== 'undefined') {
      currentVersion.value = __APP_VERSION__
    }
  } catch {
    currentVersion.value = ''
  }
  await fetchBackups()
}

// 获取所有备份列表
async function fetchBackups() {
  loadingBackups.value = true
  try {
    const resp = await fetch('/api/system/dist-backups')
    if (resp.ok) {
      const data = await resp.json()
      backups.value = (data.backups || []) as BackupItem[]
    }
  } catch {
    // 静默失败，备份列表为空
  } finally {
    loadingBackups.value = false
  }
}

// 执行回退（Rollback）
async function rollback(bk: BackupItem) {
  try {
    await ElMessageBox.confirm(
      `确认恢复到备份 v${bk.version}（${bk.date}）？\n\n当前版本的 dist 会被自动备份后替换。操作完成后需刷新页面。`,
      '确认版本回退',
      {
        confirmButtonText: '确认回退',
        cancelButtonText: '取消',
        type: 'warning',
        dangerouslyUseHTMLString: false,
      }
    )
    rollingBack.value = bk.path
    const resp = await fetch('/api/system/dist-rollback', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ backupPath: bk.path }),
    })
    const result = await resp.json()
    if (result.ok) {
      ElMessage.success(`已成功恢复到 v${bk.version} 备份，3 秒后自动刷新页面...`)
      setTimeout(() => window.location.reload(), 3000)
    } else {
      ElMessage.error(result.error || '回退失败，请检查后端日志')
    }
  } catch (e: unknown) {
    if (e !== 'cancel') {
      ElMessage.error('回退请求失败')
    }
  } finally {
    rollingBack.value = null
  }
}

onMounted(load)

// 声明 vite 注入的全局变量（TypeScript 类型）
declare const __APP_VERSION__: string
</script>

<style scoped>
.cl-panel {
  display: flex;
  flex-direction: column;
  gap: 0;
  background: transparent;
}

/* ── 工具栏 ── */
.cl-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 16px 8px;
  border-bottom: 1px solid var(--glass-card-border);
}
.cl-toolbar-left {
  display: flex;
  align-items: center;
  gap: 12px;
  font-size: 12px;
  color: var(--text-secondary);
}
.cl-count { font-weight: 600; color: var(--text-primary); }
.cl-range { opacity: 0.75; }
.cl-toolbar-right {
  display: flex;
  align-items: center;
  gap: 8px;
}

/* ── 按钮 ── */
.cl-btn {
  border: 1px solid var(--glass-card-border);
  border-radius: 999px;
  cursor: pointer;
  font-size: 12px;
  padding: 4px 10px;
  transition: all 0.15s;
  background: rgba(255, 255, 255, 0.06);
  color: var(--text-secondary);
  box-shadow: inset 0 1px 0 var(--glass-inner-highlight);
}
.cl-btn:hover { background: rgba(10, 132, 255, 0.13); color: var(--text-primary); border-color: rgba(10, 132, 255, 0.30); }
.cl-btn:disabled { opacity: 0.4; cursor: not-allowed; }
.cl-btn-ghost { background: rgba(255, 255, 255, 0.045); border: 1px solid var(--glass-card-border); }
.cl-btn-share {
  background: rgba(10, 132, 255, 0.14);
  border: 1px solid rgba(10, 132, 255, 0.32);
  color: #0a84ff;
  font-weight: 600;
}
.cl-btn-share:hover { background: rgba(10, 132, 255, 0.22); border-color: #0a84ff; }
.cl-btn-share:disabled { opacity: 0.4; cursor: not-allowed; }
.cl-btn-rollback {
  background: rgba(255, 159, 10, 0.1);
  border: 1px solid rgba(255, 159, 10, 0.3);
  color: #ff9f0a;
  font-size: 11px;
  padding: 3px 10px;
  white-space: nowrap;
}
.cl-btn-rollback:hover {
  background: rgba(255, 159, 10, 0.2);
  border-color: #ff9f0a;
}

/* ── 主体 ── */
.cl-body {
  display: flex;
  gap: 0;
  min-height: 280px;
  max-height: 380px;
}

/* ── 左侧版本列表 ── */
.cl-sidebar {
  width: 200px;
  flex-shrink: 0;
  overflow-y: auto;
  border-right: 1px solid var(--glass-card-border);
  padding: 8px 0;
}
.cl-sidebar::-webkit-scrollbar { width: 4px; }
.cl-sidebar::-webkit-scrollbar-thumb { background: var(--border-color); border-radius: 2px; }
.cl-sidebar::-webkit-scrollbar-track { background: transparent; }

.cl-version-item {
  display: flex;
  gap: 8px;
  padding: 8px 12px;
  cursor: pointer;
  border-left: 3px solid transparent;
  transition: all 0.15s;
  position: relative;
}
.cl-version-item:hover { background: rgba(255, 255, 255, 0.06); }
.cl-version-item.active {
  background: rgba(10, 132, 255, 0.12);
  border-left-color: #0a84ff;
}
.cl-version-item.current .cl-ver-num { color: #30d158; }

.cl-ver-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
  margin-top: 5px;
}
.dot-current { background: #30d158; box-shadow: 0 0 5px rgba(48, 209, 88,0.5); }
.dot-normal { background: rgba(235, 235, 245, 0.30); }

/* 主体：纵向三行 —— 版本号行 / 标签+标题行 / 日期 */
.cl-ver-main {
  display: flex;
  flex-direction: column;
  gap: 3px;
  min-width: 0;
  flex: 1;
}
.cl-ver-num {
  font-size: 13px;
  font-weight: 700;
  color: var(--text-primary);
  white-space: nowrap;
}
/* 内测 + 当前 两个标签放一行 */
.cl-ver-tags {
  display: flex;
  align-items: center;
  gap: 6px;
}
/* 灰字说明（标题 + 日期）一行 */
.cl-ver-desc {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}
.cl-ver-badge {
  font-size: 10px;
  padding: 1px 5px;
  border-radius: 3px;
  background: rgba(48, 209, 88,0.15);
  color: #30d158;
  border: 1px solid rgba(48, 209, 88,0.3);
  white-space: nowrap;
}
.cl-ver-beta {
  font-size: 10px;
  padding: 1px 5px;
  border-radius: 3px;
  background: rgba(255, 159, 10, 0.15);
  color: #ff9f0a;
  border: 1px solid rgba(255, 159, 10, 0.3);
  white-space: nowrap;
  flex-shrink: 0;
}
.cl-ver-tag {
  font-size: 11px;
  color: var(--text-secondary);
  opacity: 0.7;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  flex: 1;
  min-width: 0;
}
.cl-ver-date {
  font-size: 11px;
  color: var(--text-secondary);
  opacity: 0.6;
  white-space: nowrap;
  flex-shrink: 0;
}
/* ── 右侧详情 ── */
.cl-detail {
  flex: 1;
  overflow-y: auto;
  padding: 14px 18px;
  min-width: 0;
}
.cl-detail::-webkit-scrollbar { width: 4px; }
.cl-detail::-webkit-scrollbar-thumb { background: var(--border-color); border-radius: 2px; }
.cl-detail-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  color: var(--text-secondary);
  opacity: 0.5;
}
.cl-empty-icon { font-size: 28px; }
.cl-empty-text { font-size: 13px; }

.cl-detail-header {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  margin-bottom: 14px;
  padding-bottom: 12px;
  border-bottom: 1px solid var(--glass-card-border);
}
.cl-detail-title-wrap { flex: 1; min-width: 0; }
.cl-detail-title {
  font-size: 15px;
  font-weight: 700;
  color: var(--text-primary);
  margin: 0 0 6px;
  line-height: 1.4;
}
.cl-detail-meta { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.cl-detail-date { font-size: 12px; color: var(--text-secondary); }

/* ── 功能列表 ── */
.cl-feature-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-bottom: 16px;
}
.cl-feature-item {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  font-size: 13px;
  color: var(--text-primary);
  line-height: 1.5;
}
.cl-feature-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #0a84ff;
  flex-shrink: 0;
  margin-top: 8px;
}
.cl-feature-text { flex: 1; }

/* ── 功能截图 ── */
.cl-feature-shot {
  margin: 0 0 16px;
}
.cl-feature-shot img {
  display: block;
  width: 100%;
  border-radius: 10px;
  border: 1px solid var(--glass-card-border);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.18);
}
.cl-feature-shot figcaption {
  margin-top: 6px;
  font-size: 11px;
  color: var(--text-secondary);
  opacity: 0.7;
  text-align: center;
}
:global(html.light-theme) .cl-feature-shot img {
  box-shadow: 0 8px 24px rgba(15, 23, 42, 0.08);
}

/* ── 回退区域 ── */
.cl-rollback-section {
  background: rgba(255, 159, 10, 0.08);
  border: 1px solid rgba(255, 159, 10, 0.18);
  border-radius: 12px;
  padding: 12px;
  margin-top: 4px;
}
.cl-rollback-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 10px;
}
.cl-rollback-title { font-size: 13px; font-weight: 600; color: #ff9f0a; }
.cl-rollback-hint { font-size: 11px; color: var(--text-secondary); flex: 1; }

.cl-rollback-loading {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: var(--text-secondary);
  padding: 6px 0;
}
.cl-no-backup {
  display: flex;
  flex-direction: column;
  gap: 4px;
  font-size: 12px;
  color: var(--text-secondary);
  padding: 4px 0;
}
.cl-no-backup-hint { font-size: 11px; opacity: 0.7; }

.cl-backup-list { display: flex; flex-direction: column; gap: 6px; }
.cl-backup-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 6px 8px;
  background: rgba(255, 255, 255, 0.055);
  border: 1px solid var(--glass-card-border);
  border-radius: 10px;
  box-shadow: inset 0 1px 0 var(--glass-inner-highlight);
}
.cl-backup-info {
  display: flex;
  align-items: center;
  gap: 10px;
  flex: 1;
  min-width: 0;
  font-size: 12px;
}
.cl-backup-ver { font-weight: 600; color: var(--text-primary); }
.cl-backup-time { color: var(--text-secondary); }
.cl-backup-size { color: var(--text-secondary); opacity: 0.7; font-size: 11px; }
.cl-backup-path {
  color: var(--text-secondary);
  opacity: 0.5;
  font-size: 11px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 140px;
}

/* 当前版本提示 */
.cl-current-hint {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 10px 12px;
  background: rgba(48, 209, 88,0.06);
  border: 1px solid rgba(48, 209, 88,0.15);
  border-radius: 12px;
  font-size: 13px;
  color: #30d158;
}
.cl-current-sub { font-size: 11px; color: var(--text-secondary); }

/* ── 全部备份面板 ── */
.cl-all-backups {
  border-top: 1px solid var(--glass-card-border);
  padding: 10px 16px;
}

:global(html.light-theme .cl-btn) {
  background: rgba(255, 255, 255, 0.62);
  border-color: rgba(60, 60, 67, 0.12);
  box-shadow: 0 8px 24px rgba(15, 23, 42, 0.05), inset 0 1px 0 rgba(255,255,255,0.85);
}

:global(html.light-theme .cl-version-item:hover) {
  background: rgba(10, 132, 255, 0.07);
}

:global(html.light-theme .cl-version-item.active) {
  background: rgba(10, 132, 255, 0.10);
}

:global(html.light-theme .cl-backup-item) {
  background: rgba(255, 255, 255, 0.58);
  border-color: rgba(60, 60, 67, 0.12);
}
.cl-all-backups-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 13px;
  font-weight: 600;
  color: var(--text-primary);
  margin-bottom: 8px;
}
.cl-all-backups-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
  max-height: 160px;
  overflow-y: auto;
}

/* ── 旋转动画 ── */
.cl-spin {
  display: inline-block;
  animation: cl-rotate 1s linear infinite;
}
@keyframes cl-rotate {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}
</style>
