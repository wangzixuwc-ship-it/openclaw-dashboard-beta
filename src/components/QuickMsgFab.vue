<template>
  <!-- FAB（Floating Action Button 浮动操作按钮）— 快捷发消息 -->
  <div class="qmf-wrap" :class="[`qmf-corner-${triggerCorner}`, { 'qmf-free': triggerPosition }]" :style="triggerStyle">
    <!-- 悬浮触发按钮 -->
    <button
      class="qmf-trigger"
      :class="{ open: panelVisible, dragging: triggerDragging }"
      @mousedown="startTriggerDrag"
      @click="onTriggerClick"
      @dblclick.stop="resetTriggerPosition"
      title="快捷发消息（⌘⇧M）"
      aria-label="快捷发消息"
    >
      <el-icon class="qmf-icon"><Promotion /></el-icon>
    </button>

    <!-- 面板（Teleport 挂载到 body，避免 overflow hidden 截断）-->
    <Teleport to="body">
      <Transition name="qm-slide">
        <div v-if="panelVisible" class="qmf-panel-wrap" @keydown.esc="close">
          <!-- 遮罩层（点击关闭）-->
          <div class="qmf-backdrop" @click="close" />

          <!-- 主面板 -->
          <div class="qmf-panel" :style="panelStyle" @click.stop>
            <!-- 标题栏 -->
            <div class="qmf-header" @mousedown="startPanelDrag">
              <span class="qmf-title">快捷发消息</span>
              <button class="qmf-close" @mousedown.stop @click="close">✕</button>
            </div>

            <!-- Agent 选择区 -->
            <div class="qmf-section-label">发送给</div>
            <div class="qmf-agents">
              <button
                v-for="ag in agentList"
                :key="ag.id"
                class="qmf-agent-btn"
                :class="{ selected: selectedId === ag.id }"
                @click="selectAgent(ag.id)"
              >
                <img class="qmf-agent-avatar" :src="ag.avatar" :alt="ag.name" />
                <span class="qmf-agent-name">{{ ag.name }}</span>
              </button>
            </div>

            <!-- 快捷模板按钮区 -->
            <template v-if="templates.length">
              <div class="qmf-section-label">快捷模板（点击填入）</div>
              <div class="qmf-templates">
                <button
                  v-for="(tpl, i) in templates"
                  :key="i"
                  class="qmf-tpl-btn"
                  :class="{ active: message === tpl }"
                  @click="fillTemplate(tpl)"
                >
                  {{ tpl }}
                </button>
              </div>
            </template>

            <!-- 消息输入框 -->
            <div class="qmf-section-label">消息内容</div>
            <textarea
              ref="inputRef"
              v-model="message"
              class="qmf-textarea"
              placeholder="输入要发送的消息内容..."
              rows="3"
              @keydown.meta.enter.prevent="send"
              @keydown.ctrl.enter.prevent="send"
            />
            <div class="qmf-hint">⌘↵ 快速发送</div>

            <!-- 底部操作区 -->
            <div class="qmf-footer">
              <span class="qmf-target" v-if="selectedAgent">
                → <img class="qmf-target-avatar" :src="selectedAgent.avatar" :alt="selectedAgent.name" /> {{ selectedAgent.name }}
              </span>
              <span class="qmf-target empty" v-else>← 请先选择 Agent</span>
              <button
                class="qmf-send-btn"
                :class="{ loading: sending }"
                :disabled="!canSend"
                @click="send"
              >
                {{ sending ? '发送中…' : '发送' }}
              </button>
            </div>

            <!-- 发送结果提示 -->
            <Transition name="qm-result">
              <div v-if="resultMsg" class="qmf-result" :class="resultType">
                {{ resultMsg }}
              </div>
            </Transition>
          </div>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, nextTick, onMounted, onUnmounted, watch } from 'vue'
import { Promotion } from '@element-plus/icons-vue'
import { useAgentStore } from '../stores/agent'

// ─── 类型定义 ────────────────────────────────────────────────────────────────
interface AgentItem {
  id: string
  name: string
  emoji: string
  avatar: string
}

// ─── Store ───────────────────────────────────────────────────────────────────
const store = useAgentStore()

// ─── 状态 ─────────────────────────────────────────────────────────────────────
const panelVisible = ref(false)
const selectedId = ref('pm')
const message = ref('')
const sending = ref(false)
const resultMsg = ref('')
const resultType = ref<'success' | 'error'>('success')
const inputRef = ref<HTMLTextAreaElement | null>(null)
const panelPosition = ref<{ left: number; top: number } | null>(loadPanelPosition())
const dragState = ref<{ dx: number; dy: number } | null>(null)
type TriggerCorner = 'br' | 'bl' | 'tr' | 'tl'
const triggerCorner = ref<TriggerCorner>(loadTriggerCorner())
const triggerPosition = ref<{ left: number; top: number } | null>(clampTriggerPosition(loadTriggerPosition()))
const triggerDragging = ref(false)
const triggerDragState = ref<{ startX: number; startY: number; dx: number; dy: number; moved: boolean } | null>(null)

const panelStyle = computed(() => {
  if (!panelPosition.value) {
    if (triggerPosition.value) {
      const panelW = 380
      const panelH = 560
      const triggerW = 78
      const triggerH = 54
      const left = Math.min(
        Math.max(12, triggerPosition.value.left < window.innerWidth / 2
          ? triggerPosition.value.left
          : triggerPosition.value.left + triggerW - panelW),
        window.innerWidth - panelW - 12,
      )
      const top = Math.min(
        Math.max(12, triggerPosition.value.top < window.innerHeight / 2
          ? triggerPosition.value.top + triggerH + 12
          : triggerPosition.value.top - panelH - 12),
        window.innerHeight - panelH - 12,
      )
      return { left: `${left}px`, top: `${top}px`, right: 'auto', bottom: 'auto' }
    }
    const style: Record<string, string> = {}
    if (triggerCorner.value.includes('t')) style.top = '86px'
    else style.bottom = '94px'
    if (triggerCorner.value.includes('l')) style.left = '28px'
    else style.right = '28px'
    return style
  }
  return {
    left: `${panelPosition.value.left}px`,
    top: `${panelPosition.value.top}px`,
    right: 'auto',
    bottom: 'auto',
  }
})

const triggerStyle = computed(() => {
  if (!triggerPosition.value) return {}
  return {
    left: `${triggerPosition.value.left}px`,
    top: `${triggerPosition.value.top}px`,
    right: 'auto',
    bottom: 'auto',
  }
})

// ─── Agent 列表（从 store 读取，含头像）────────────────────────────────────
// 固定排序：main 在最后（通常不需要直接发给 main）
const AGENT_ORDER = ['pm', 'developer', 'tester', 'inspector', 'archivist', 'designer', 'main']

function agentAvatar(id: string): string {
  return `/avatars/${id}.${id === 'main' ? 'jpg' : 'png'}`
}

const agentList = computed<AgentItem[]>(() => {
  const fromStore = store.agents.map(a => {
    const parts = (a.key || '').split(':')
    return {
      id: parts[1] || a.key || '',
      name: a.name || a.displayName || a.key || '',
      emoji: a.emoji || '',
      avatar: agentAvatar(parts[1] || a.key || ''),
    }
  }).filter(a => a.id && AGENT_ORDER.includes(a.id))

  // 按固定顺序排列
  fromStore.sort((a, b) => {
    const ia = AGENT_ORDER.indexOf(a.id)
    const ib = AGENT_ORDER.indexOf(b.id)
    return ia - ib
  })

  // 若 store 尚未加载，使用内置默认列表
  if (fromStore.length === 0) {
    return [
      { id: 'pm',         name: '项目经理',   emoji: '', avatar: agentAvatar('pm') },
      { id: 'developer',  name: '开发工程师',  emoji: '', avatar: agentAvatar('developer') },
      { id: 'tester',     name: '测试工程师',  emoji: '', avatar: agentAvatar('tester') },
      { id: 'inspector',  name: '巡检员',      emoji: '', avatar: agentAvatar('inspector') },
      { id: 'archivist',  name: '档案员',      emoji: '', avatar: agentAvatar('archivist') },
      { id: 'designer',   name: '美术设计师',  emoji: '', avatar: agentAvatar('designer') },
      { id: 'main',       name: '主控',        emoji: '', avatar: agentAvatar('main') },
    ]
  }
  return fromStore
})

const selectedAgent = computed(() =>
  agentList.value.find(a => a.id === selectedId.value) ?? null
)

// ─── 快捷模板（按 Agent 区分）────────────────────────────────────────────────
const TEMPLATES: Record<string, string[]> = {
  pm:        ['请汇报当前项目状态', '请评估团队工作负载', '有新需求待分配，请准备'],
  developer: ['请汇报开发进度', '请检查代码并修复问题', '请实现刚分配的任务'],
  tester:    ['请汇报测试状态', '请对最新代码进行测试', '测试完成请提交报告'],
  inspector: ['巡检时间到', '请立即扫描项目异常状态', '有项目疑似卡住，请排查'],
  archivist: ['请检查待归档项目', '请执行每日归档任务', '请整理本周完成项目'],
  main:      ['请查看并处理待办', '请汇报整体状态', '需要你的协助，请回复'],
}

const templates = computed<string[]>(() =>
  TEMPLATES[selectedId.value] || []
)

const canSend = computed(() =>
  !!message.value.trim() && !!selectedId.value && !sending.value
)

// ─── 方法 ─────────────────────────────────────────────────────────────────────
function togglePanel(): void {
  panelVisible.value = !panelVisible.value
}

function onTriggerClick(): void {
  if (triggerDragState.value?.moved) {
    triggerDragState.value = null
    return
  }
  togglePanel()
}

function close(): void {
  panelVisible.value = false
}

function selectAgent(id: string): void {
  selectedId.value = id
  // 切换 agent 时清空模板选中（不清空消息，方便编辑后换目标发）
  nextTick(() => inputRef.value?.focus())
}

function fillTemplate(tpl: string): void {
  message.value = tpl
  nextTick(() => inputRef.value?.focus())
}

function loadPanelPosition(): { left: number; top: number } | null {
  try {
    const raw = localStorage.getItem('quick_msg_panel_position_v2')
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (typeof parsed?.left === 'number' && typeof parsed?.top === 'number') return parsed
  } catch { /* ignore */ }
  return null
}

function loadTriggerCorner(): TriggerCorner {
  try {
    const raw = localStorage.getItem('quick_msg_trigger_corner_v2')
    if (raw === 'br' || raw === 'bl' || raw === 'tr' || raw === 'tl') return raw
  } catch { /* ignore */ }
  return 'br'
}

function loadTriggerPosition(): { left: number; top: number } | null {
  try {
    const raw = localStorage.getItem('quick_msg_trigger_position_v2')
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (typeof parsed?.left === 'number' && typeof parsed?.top === 'number') return parsed
  } catch { /* ignore */ }
  return null
}

function clampTriggerPosition(pos: { left: number; top: number } | null): { left: number; top: number } | null {
  if (!pos) return null
  if (!Number.isFinite(pos.left) || !Number.isFinite(pos.top)) return null
  if (typeof window === 'undefined') return pos
  const btnW = 78
  const btnH = 54
  return {
    left: Math.min(Math.max(12, pos.left), Math.max(12, window.innerWidth - btnW - 12)),
    top: Math.min(Math.max(80, pos.top), Math.max(80, window.innerHeight - btnH - 12)),
  }
}

function keepTriggerVisible(): void {
  if (!triggerPosition.value) return
  const clamped = clampTriggerPosition(triggerPosition.value)
  if (!clamped) {
    resetTriggerPosition()
    return
  }
  if (clamped.left !== triggerPosition.value.left || clamped.top !== triggerPosition.value.top) {
    triggerPosition.value = clamped
    saveTriggerPosition()
  }
}

function saveTriggerCorner(): void {
  localStorage.setItem('quick_msg_trigger_corner_v2', triggerCorner.value)
}

function resetTriggerPosition(): void {
  triggerPosition.value = null
  triggerCorner.value = 'br'
  panelPosition.value = null
  localStorage.removeItem('quick_msg_trigger_position_v2')
  localStorage.removeItem('quick_msg_panel_position_v2')
  saveTriggerCorner()
}

function saveTriggerPosition(): void {
  if (!triggerPosition.value) return
  localStorage.setItem('quick_msg_trigger_position_v2', JSON.stringify(triggerPosition.value))
}

function savePanelPosition(): void {
  if (!panelPosition.value) return
  localStorage.setItem('quick_msg_panel_position_v2', JSON.stringify(panelPosition.value))
}

function startPanelDrag(event: MouseEvent): void {
  const panel = (event.currentTarget as HTMLElement).closest('.qmf-panel') as HTMLElement | null
  if (!panel) return
  const rect = panel.getBoundingClientRect()
  dragState.value = { dx: event.clientX - rect.left, dy: event.clientY - rect.top }
  panelPosition.value = { left: rect.left, top: rect.top }
  document.addEventListener('mousemove', onPanelDrag)
  document.addEventListener('mouseup', stopPanelDrag)
}

function onPanelDrag(event: MouseEvent): void {
  if (!dragState.value) return
  const width = 380
  const height = 560
  const left = Math.min(Math.max(12, event.clientX - dragState.value.dx), window.innerWidth - width - 12)
  const top = Math.min(Math.max(12, event.clientY - dragState.value.dy), window.innerHeight - height - 12)
  panelPosition.value = { left, top }
}

function stopPanelDrag(): void {
  if (dragState.value) savePanelPosition()
  dragState.value = null
  document.removeEventListener('mousemove', onPanelDrag)
  document.removeEventListener('mouseup', stopPanelDrag)
}

function startTriggerDrag(event: MouseEvent): void {
  if (event.button !== 0) return
  const wrap = (event.currentTarget as HTMLElement).closest('.qmf-wrap') as HTMLElement | null
  const rect = wrap?.getBoundingClientRect()
  triggerDragState.value = {
    startX: event.clientX,
    startY: event.clientY,
    dx: rect ? event.clientX - rect.left : 39,
    dy: rect ? event.clientY - rect.top : 27,
    moved: false,
  }
  document.addEventListener('mousemove', onTriggerDrag)
  document.addEventListener('mouseup', stopTriggerDrag)
}

function onTriggerDrag(event: MouseEvent): void {
  if (!triggerDragState.value) return
  const dx = event.clientX - triggerDragState.value.startX
  const dy = event.clientY - triggerDragState.value.startY
  if (Math.hypot(dx, dy) < 8) return
  triggerDragState.value.moved = true
  triggerDragging.value = true
  const btnW = 78
  const btnH = 54
  const left = Math.min(Math.max(12, event.clientX - triggerDragState.value.dx), window.innerWidth - btnW - 12)
  const top = Math.min(Math.max(80, event.clientY - triggerDragState.value.dy), window.innerHeight - btnH - 12)
  triggerPosition.value = { left, top }
  const vertical = top + btnH / 2 < window.innerHeight / 2 ? 't' : 'b'
  const horizontal = left + btnW / 2 < window.innerWidth / 2 ? 'l' : 'r'
  triggerCorner.value = `${vertical}${horizontal}` as TriggerCorner
}

function stopTriggerDrag(): void {
  if (triggerDragState.value?.moved) {
    saveTriggerCorner()
    saveTriggerPosition()
    panelPosition.value = null
  }
  triggerDragging.value = false
  document.removeEventListener('mousemove', onTriggerDrag)
  document.removeEventListener('mouseup', stopTriggerDrag)
}

async function send(): Promise<void> {
  if (!canSend.value) return
  sending.value = true
  resultMsg.value = ''
  try {
    const resp = await fetch('/api/agent-send-message', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ agentId: selectedId.value, message: message.value.trim() }),
    })
    const data = await resp.json()
    if (resp.ok && data.success) {
      resultType.value = 'success'
      resultMsg.value = `已发送给 ${selectedAgent.value?.name || selectedId.value}`
      message.value = ''
      // 2.5 秒后自动关闭面板
      setTimeout(close, 2500)
    } else {
      resultType.value = 'error'
      resultMsg.value = `发送失败：${data.error || '未知错误'}`
    }
  } catch (e: any) {
    resultType.value = 'error'
    resultMsg.value = `请求失败：${e.message}`
  } finally {
    sending.value = false
    // 3 秒后清除提示
    setTimeout(() => { resultMsg.value = '' }, 3000)
  }
}

// ─── 全局键盘快捷键 ⌘⇧M ────────────────────────────────────────────────────
function onKeydown(e: KeyboardEvent): void {
  if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key.toLowerCase() === 'm') {
    e.preventDefault()
    panelVisible.value = !panelVisible.value
  }
}

onMounted(() => {
  keepTriggerVisible()
  document.addEventListener('keydown', onKeydown)
  window.addEventListener('resize', keepTriggerVisible)
})
onUnmounted(() => {
  document.removeEventListener('keydown', onKeydown)
  window.removeEventListener('resize', keepTriggerVisible)
  document.removeEventListener('mousemove', onPanelDrag)
  document.removeEventListener('mouseup', stopPanelDrag)
  document.removeEventListener('mousemove', onTriggerDrag)
  document.removeEventListener('mouseup', stopTriggerDrag)
})

// 面板打开时聚焦输入框
watch(panelVisible, (v) => {
  if (v) nextTick(() => inputRef.value?.focus())
})
</script>

<style scoped>
/* ─── FAB 触发按钮 ──────────────────────────────────────────────────────────── */
.qmf-wrap {
  position: fixed;
  bottom: 28px;
  right: 28px;
  z-index: 2600;
  transition: inset 0.22s ease, left 0.18s ease, top 0.18s ease, transform 0.22s ease;
}

.qmf-wrap.qmf-free {
  bottom: auto;
  right: auto;
}

.qmf-corner-br { bottom: 28px; right: 28px; top: auto; left: auto; }
.qmf-corner-bl { bottom: 28px; left: 28px; top: auto; right: auto; }
.qmf-corner-tr { top: 86px; right: 28px; bottom: auto; left: auto; }
.qmf-corner-tl { top: 86px; left: 28px; bottom: auto; right: auto; }

.qmf-trigger {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 78px;
  height: 54px;
  padding: 0;
  background: rgba(10, 132, 255, 0.86);
  color: #fff;
  border: 1px solid rgba(186, 230, 253, 0.38);
  border-radius: 18px;
  cursor: pointer;
  box-shadow:
    0 14px 34px rgba(10, 132, 255, 0.3),
    inset 0 1px 0 rgba(255, 255, 255, 0.34);
  transition: transform 0.15s, box-shadow 0.15s, background 0.15s, border-color 0.15s, width 0.15s;
  outline: none;
  touch-action: none;
}

.qmf-trigger:hover {
  transform: translateY(-2px);
  border-color: rgba(186, 230, 253, 0.72);
  box-shadow:
    0 18px 42px rgba(10, 132, 255, 0.38),
    0 0 0 5px rgba(10, 132, 255, 0.1),
    inset 0 1px 0 rgba(255, 255, 255, 0.32);
}

.qmf-trigger.open {
  background: rgba(0, 122, 255, 0.92);
  transform: scale(0.96);
}

.qmf-trigger.dragging {
  cursor: grabbing;
  transform: scale(0.98);
}

.qmf-icon {
  font-size: 24px;
  line-height: 1;
}

/* ─── 遮罩 + 面板布局 ───────────────────────────────────────────────────────── */
.qmf-panel-wrap {
  position: fixed;
  inset: 0;
  z-index: 2000;
  pointer-events: none;
}

.qmf-backdrop {
  position: absolute;
  inset: 0;
  pointer-events: all;
}

.qmf-panel {
  position: absolute;
  bottom: 80px;
  right: 28px;
  width: 380px;
  background: var(--glass-card-bg);
  border: 1px solid var(--glass-card-border);
  border-radius: 14px;
  box-shadow: var(--glass-inner-highlight), 0 24px 60px rgba(0, 0, 0, 0.38);
  backdrop-filter: var(--glass-blur);
  -webkit-backdrop-filter: var(--glass-blur);
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 12px;
  pointer-events: all;
}

/* ─── 标题栏 ─────────────────────────────────────────────────────────────────── */
.qmf-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  cursor: move;
  user-select: none;
}

.qmf-title {
  font-size: 15px;
  font-weight: 700;
  color: #f1f5f9;
}

.qmf-close {
  background: none;
  border: none;
  color: #8e8e93;
  cursor: pointer;
  font-size: 16px;
  padding: 2px 6px;
  border-radius: 4px;
  line-height: 1;
  transition: color 0.15s;
}

.qmf-close:hover {
  color: #f1f5f9;
}

/* ─── 区块标题 ───────────────────────────────────────────────────────────────── */
.qmf-section-label {
  font-size: 11px;
  color: #8e8e93;
  text-transform: uppercase;
  letter-spacing: 0.8px;
  font-weight: 600;
}

/* ─── Agent 选择区 ───────────────────────────────────────────────────────────── */
.qmf-agents {
  display: flex;
  flex-wrap: wrap;
  gap: 7px;
}

.qmf-agent-btn {
  display: flex;
  align-items: center;
  gap: 5px;
  padding: 5px 11px;
  background: var(--fill-subtle);
  border: 1px solid var(--border-color);
  border-radius: 20px;
  cursor: pointer;
  color: #98989d;
  font-size: 12px;
  font-weight: 500;
  transition: all 0.15s;
  outline: none;
}

.qmf-agent-btn:hover {
  background: var(--fill-hover);
  color: #e5e5ea;
}

.qmf-agent-btn.selected {
  background: rgba(10, 132, 255, 0.13);
  border-color: rgba(10, 132, 255, 0.32);
  color: #b3d7ff;
}

.qmf-agent-avatar {
  width: 22px;
  height: 22px;
  border-radius: 50%;
  object-fit: cover;
  flex-shrink: 0;
  border: 1px solid var(--border-color);
}

.qmf-target {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.qmf-target-avatar {
  width: 18px;
  height: 18px;
  border-radius: 50%;
  object-fit: cover;
  border: 1px solid var(--border-color);
}

/* ─── 快捷模板区 ─────────────────────────────────────────────────────────────── */
.qmf-templates {
  display: flex;
  flex-direction: column;
  gap: 5px;
}

.qmf-tpl-btn {
  text-align: left;
  padding: 6px 11px;
  background: var(--fill-subtle);
  border: 1px solid var(--border-color);
  border-radius: 7px;
  cursor: pointer;
  color: #98989d;
  font-size: 12px;
  transition: all 0.15s;
  outline: none;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.qmf-tpl-btn:hover {
  background: rgba(10, 132, 255, 0.1);
  border-color: rgba(10, 132, 255, 0.28);
  color: #b3d7ff;
}

.qmf-tpl-btn.active {
  background: rgba(10, 132, 255, 0.13);
  border-color: rgba(10, 132, 255, 0.34);
  color: #b3d7ff;
}

/* ─── 消息输入框 ─────────────────────────────────────────────────────────────── */
.qmf-textarea {
  width: 100%;
  background: var(--fill-subtle);
  border: 1px solid var(--border-color);
  border-radius: 8px;
  color: #e5e5ea;
  font-size: 13px;
  padding: 10px 12px;
  resize: vertical;
  outline: none;
  font-family: inherit;
  box-sizing: border-box;
  transition: border-color 0.15s;
  line-height: 1.6;
}

.qmf-textarea::placeholder {
  color: #6e6e73;
}

.qmf-textarea:focus {
  border-color: rgba(10, 132, 255, 0.34);
  background: var(--fill-subtle);
}

.qmf-hint {
  font-size: 10px;
  color: #6e6e73;
  text-align: right;
  margin-top: -6px;
}

/* ─── 底部操作区 ─────────────────────────────────────────────────────────────── */
.qmf-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}

.qmf-target {
  font-size: 12px;
  color: #8e8e93;
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.qmf-target.empty {
  color: #6e6e73;
}

.qmf-send-btn {
  padding: 8px 18px;
  background: #0a84ff;
  color: #fff;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  font-size: 13px;
  font-weight: 600;
  transition: all 0.15s;
  white-space: nowrap;
  outline: none;
}

.qmf-send-btn:hover:not(:disabled) {
  transform: translateY(-1px);
  box-shadow: 0 6px 16px rgba(10, 132, 255, 0.22);
}

.qmf-send-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
  transform: none;
}

.qmf-send-btn.loading {
  background: #6e6e73;
}

/* ─── 发送结果提示 ───────────────────────────────────────────────────────────── */
.qmf-result {
  padding: 8px 12px;
  border-radius: 7px;
  font-size: 12px;
  font-weight: 500;
  text-align: center;
}

.qmf-result.success {
  background: rgba(48, 209, 88, 0.12);
  color: #4ade80;
  border: 1px solid rgba(48, 209, 88, 0.2);
}

.qmf-result.error {
  background: rgba(255, 69, 58, 0.12);
  color: #ff6961;
  border: 1px solid rgba(255, 69, 58, 0.2);
}

:global(html.light-theme .qmf-panel) {
  background: rgba(255, 255, 255, 0.97);
  border-color: rgba(0, 122, 255, 0.15);
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.9),
    0 24px 58px rgba(15, 23, 42, 0.18);
}

:global(html.light-theme .qmf-title) {
  color: #1d1d1f;
}

:global(html.light-theme .qmf-close) {
  color: #6b7280;
}

:global(html.light-theme .qmf-close:hover) {
  color: #1d1d1f;
  background: rgba(0, 122, 255, 0.06);
}

:global(html.light-theme .qmf-section-label) {
  color: #4b5563;
}

:global(html.light-theme .qmf-agent-btn),
:global(html.light-theme .qmf-tpl-btn) {
  background: #ffffff;
  border-color: rgba(15, 23, 42, 0.13);
  color: #374151;
  box-shadow: 0 1px 2px rgba(15, 23, 42, 0.04);
}

:global(html.light-theme .qmf-agent-btn:hover),
:global(html.light-theme .qmf-tpl-btn:hover) {
  background: rgba(239, 246, 255, 0.98);
  border-color: rgba(0, 122, 255, 0.26);
  color: #0b63ce;
}

:global(html.light-theme .qmf-agent-btn.selected),
:global(html.light-theme .qmf-tpl-btn.active) {
  background: rgba(219, 234, 254, 0.9);
  border-color: rgba(0, 122, 255, 0.38);
  color: #0057b8;
}

:global(html.light-theme .qmf-textarea) {
  background: #ffffff;
  border-color: rgba(0, 122, 255, 0.24);
  color: #1f2937;
}

:global(html.light-theme .qmf-textarea::placeholder) {
  color: #6b7280;
}

:global(html.light-theme .qmf-textarea:focus) {
  background: #ffffff;
  border-color: rgba(0, 122, 255, 0.45);
  box-shadow: 0 0 0 3px rgba(0, 122, 255, 0.1);
}

:global(html.light-theme .qmf-hint),
:global(html.light-theme .qmf-target.empty) {
  color: #6b7280;
}

:global(html.light-theme .qmf-target) {
  color: #4b5563;
}

:global(html.light-theme .qmf-send-btn:disabled) {
  opacity: 1;
  background: #bfdbfe;
  color: #ffffff;
  box-shadow: none;
}

:global(html.light-theme .qmf-result.success) {
  background: rgba(48, 209, 88, 0.1);
  color: #15803d;
  border-color: rgba(22, 163, 74, 0.2);
}

:global(html.light-theme .qmf-result.error) {
  background: rgba(255, 59, 48, 0.08);
  color: #b42318;
  border-color: rgba(255, 59, 48, 0.18);
}

/* ─── 动画 ──────────────────────────────────────────────────────────────────── */
.qm-slide-enter-active,
.qm-slide-leave-active {
  transition: opacity 0.2s ease, transform 0.2s ease;
}

.qm-slide-enter-from,
.qm-slide-leave-to {
  opacity: 0;
  transform: translateY(8px) scale(0.97);
}

.qm-result-enter-active,
.qm-result-leave-active {
  transition: opacity 0.3s ease;
}

.qm-result-enter-from,
.qm-result-leave-to {
  opacity: 0;
}
</style>
