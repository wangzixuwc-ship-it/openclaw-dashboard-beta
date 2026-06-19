---
name: feishu-toolkit
version: 1.0.0
description: >
  给 AI agent 用的完整飞书（Lark）集成工具箱。读写文档、拉群聊记录、发文件和截图、
  管理权限、创建定时提醒。支持 Wiki、文档、表格、多维表格和 IM 即时消息操作。
  触发词："飞书"、"feishu"、"lark"、"读文档"、"群聊记录"、"发文件"、
  "截屏发飞书"、"文档权限"、"定时提醒"。
tags: [feishu, lark, document, chat, file, screenshot, permission, reminder, chinese, productivity]
env:
  FEISHU_APP_ID: "你的飞书应用 ID（在 open.feishu.cn 获取）"
  FEISHU_APP_SECRET: "你的飞书应用密钥"
---

# 飞书工具箱（Feishu Toolkit）

给 AI agent 用的全面飞书集成技能，涵盖 6 大能力：

1. **📄 文档操作** —— 读、建、写、追加 飞书文档/表格/多维表格/知识库
2. **💬 聊天记录** —— 拉取并总结群聊消息
3. **📎 发文件** —— 通过 REST API 上传并发送文件到飞书群
4. **📸 截图** —— 截 macOS 屏幕并发到飞书
5. **🔐 权限管理** —— 列出/添加/移除 文档协作者
6. **⏰ 定时提醒** —— 创建发往飞书群的周期性提醒

> 💡 整体理解：这是「飞书全家桶」，比单个 feishu_doc/feishu_im 更全。它直接给出调飞书开放平台 REST API 的方法（含可运行的 Python/bash 代码片段），适合需要自己拼 API 调用的场景。

---

## 前置准备（Prerequisites）

### 飞书应用配置
1. 去 [飞书开放平台](https://open.feishu.cn/app) 创建一个应用
2. 开通需要的权限：
   - `im:message:send_as_bot` —— 发消息
   - `im:resource` —— 上传文件/图片
   - `docx:document` —— 读写文档
   - `drive:permission` —— 管理权限（可选）
3. 设置环境变量 `FEISHU_APP_ID` 和 `FEISHU_APP_SECRET`

### 认证（Authentication）
所有 API 调用都用飞书的「租户访问令牌」（tenant access token）：
```python
import requests

def get_tenant_token(app_id, app_secret):
    r = requests.post(
        'https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal',
        json={'app_id': app_id, 'app_secret': app_secret}
    )
    return r.json()['tenant_access_token']
```
> 🔍 这段代码干嘛：拿你的应用 ID 和密钥，向飞书换一个临时「通行证」(token)。后面每个 API 调用都要在请求头带上这个 token，飞书才认。相当于先刷卡拿门禁卡，再凭卡进各个门。

---

## 1. 文档操作（读/写/建/追加）

### 读文档
```bash
# 把文档内容当 Markdown 拉下来
# 支持：doc、docx、sheet、bitable、wiki
GET /open-apis/docx/v1/documents/{document_id}/raw_content
```

### 建文档
```bash
POST /open-apis/docx/v1/documents
Body: {"title": "我的文档"}
```

### 写（覆盖）文档
```bash
# 用 Markdown 覆盖整篇文档内容
POST /open-apis/docx/v1/documents/{document_id}/blocks/batch_update
```

### 追加内容（长文档）
当文档超过 LLM 单次输出上限时：
1. **先建**文档拿到 `doc_token`
2. 把内容**切**成若干逻辑段
3. **逐段追加**
4. 文档很长时不要妄图一次写完整篇
> 即：太长的内容分批写，先建空文档，再一段段往里追加，避免一次写超出模型输出长度。

### Wiki 链接解析
Wiki 链接要先解析成真正的文档 token：
```bash
POST /open-apis/wiki/v2/spaces/get_node
Body: {"token": "wiki_token"}
# 返回真正的 doc_token 和 doc_type
```

---

## 2. 聊天记录（Chat History）

拉取并总结飞书群聊消息。

### 拉消息
```python
# GET /open-apis/im/v1/messages
params = {
    'container_id_type': 'chat',
    'container_id': chat_id,
    'page_size': 50
}
```
> 🔍 这段：指定要读哪个群（chat_id）、一次读 50 条，去飞书拉这个群的消息列表。

### 消息类型处理
| 类型 | 怎么处理 |
|------|----------|
| `text` | 取 `.body.content` 的 JSON → 里面的 `text` 字段 |
| `interactive` | 从 `elements` 数组里抽出文本节点 |
| `image` | 标记成 `[图片]` |
| `system` | 过滤掉（除非相关） |

### 翻页（Pagination）
如果返回 `has_more=true`，用 `page_token` 继续拉下一页。默认每页 50 条。

---

## 3. 发文件（File Sending）

通过 REST API 发文件到飞书群。

### 上传文件
```python
# POST /open-apis/im/v1/files
headers = {'Authorization': f'Bearer {token}'}
data = {'file_type': 'stream', 'file_name': 'filename.ext'}
files = {'file': ('filename.ext', open(path, 'rb'), 'application/octet-stream')}
```
> 🔍 这段：把本地文件以二进制流上传到飞书，换回一个 `file_key`（文件凭证），下一步发消息时用它。

支持的 `file_type`：`opus`、`mp4`、`pdf`、`doc`、`xls`、`ppt`、`stream`（通用）

### 发文件消息
```python
# POST /open-apis/im/v1/messages
json = {
    'receive_id': chat_id,
    'msg_type': 'file',
    'content': json.dumps({'file_key': file_key})
}
```
> 即：拿上一步的 file_key，发一条「文件类型」的消息到指定群。

---

## 4. 截图并发送（Screenshot & Send）

截 macOS 屏幕并发到飞书。

```bash
# 1. 截图
SCREENSHOT_PATH="$TMPDIR/screenshot_$(date +%s).png"
screencapture -x "$SCREENSHOT_PATH"

# 2. 上传图片
# POST /open-apis/im/v1/images
# data: image_type=message, file=screenshot

# 3. 发图片消息
# POST /open-apis/im/v1/messages
# msg_type: image, content: {"image_key": "..."}
```
> 🔍 三步：`screencapture -x` 是 macOS 自带的静默截屏命令（-x 表示不播快门声）；截到临时目录后上传换 image_key；再发一条图片消息。

> **注意**：macOS 上用 `$TMPDIR` 而不是 `/tmp`。

---

## 5. 权限管理（Permission Management）

管理文档/文件权限。

### 动作
| 动作 | 说明 |
|--------|-------------|
| `list` | 列出所有协作者 |
| `add` | 添加协作者并设权限级别 |
| `remove` | 移除协作者 |

### Token 类型
`doc`、`docx`、`sheet`、`bitable`、`folder`、`file`、`wiki`、`mindnote`

### 成员类型
`email`、`openid`、`userid`、`unionid`、`openchat`、`opendepartmentid`

### 权限级别
| 级别 | 说明 |
|-------|-------------|
| `view` | 仅查看 |
| `edit` | 可编辑 |
| `full_access` | 完全访问（可管理权限） |

### 示例：共享文档
```python
# POST /open-apis/drive/v1/permissions/{token}/members
params = {'type': 'docx'}
json = {
    'member_type': 'email',
    'member_id': 'user@company.com',
    'perm': 'edit'
}
```

> **注意**：权限管理很敏感，谨慎使用。

---

## 6. 定时提醒（Cron Reminders）

创建发往飞书群的周期性定时提醒。

### 创建前
**务必先和用户确认**：
1. **频率**：多久一次？（比如每 10 分钟、每小时、每天早上 9 点）
2. **目标**：发到哪？（默认：当前 IM 会话）

### 模板
```bash
cron add \
  --name "<任务名>" \
  --every "<间隔>" \
  --session main \
  --system-event "[CRON] <任务名>. Send message to Feishu: '<提醒内容>'"
```

### 间隔示例
| 间隔 | 说明 |
|----------|-------------|
| `1m` | 每分钟 |
| `5m` | 每 5 分钟 |
| `30m` | 每 30 分钟 |
| `1h` | 每小时 |
| `*/30 * * * *` | cron 表达式（配 `--tz` 时区） |

### 管理
```bash
cron list          # 列出所有任务
cron edit <id>     # 编辑任务
cron rm <id>       # 删除（先问用户！）
cron runs --id <id> # 查执行历史
cron run <id>      # 手动触发
```

---

## API 速查表（API Reference）

| API | 方法 | 路径 |
|-----|--------|------|
| 租户令牌 | POST | `/auth/v3/tenant_access_token/internal` |
| 读文档 | GET | `/docx/v1/documents/{id}/raw_content` |
| 建文档 | POST | `/docx/v1/documents` |
| 发消息 | POST | `/im/v1/messages` |
| 上传文件 | POST | `/im/v1/files` |
| 上传图片 | POST | `/im/v1/images` |
| 列消息 | GET | `/im/v1/messages` |
| 管理权限 | POST | `/drive/v1/permissions/{token}/members` |
| 解析 Wiki | POST | `/wiki/v2/spaces/get_node` |

Base URL：`https://open.feishu.cn/open-apis`

---

## 注意事项（Notes）

- 所有 API 都要在 `Authorization` 请求头带 `tenant_access_token`
- 文件上传用 `multipart/form-data`
- 发消息用 `application/json`
- 机器人只能下载它自己上传过的文件
- 详细 API 文档见：https://open.feishu.cn/document
