---
name: feishu-drive
description: |
  飞书云空间文件管理。当用户提到云空间、文件夹、云盘时启用。
---

# 飞书云盘工具（Feishu Drive Tool）

只有一个工具 `feishu_drive`，用于云空间（云盘）操作。

> 💡 一句话理解：管理飞书云盘里的文件和文件夹（列目录、查信息、建文件夹、移动、删除）。靠 `action` 参数区分操作。

## 提取 Token（Token Extraction）

从链接 `https://xxx.feishu.cn/drive/folder/ABC123` → `folder_token`（文件夹标识）= `ABC123`。

## 各种动作（Actions）

### 列出文件夹内容（List Folder Contents）

```json
{ "action": "list" }
```

根目录（不传 folder_token）。

```json
{ "action": "list", "folder_token": "fldcnXXX" }
```

返回：文件的 token、名称、类型、链接、时间戳。

### 查文件信息（Get File Info）

```json
{ "action": "info", "file_token": "ABC123", "type": "docx" }
```

在根目录里找该文件。注意：文件必须在根目录，否则先用 `list` 浏览文件夹定位。
`type` 可选：`doc`、`docx`、`sheet`、`bitable`、`folder`、`file`、`mindnote`、`shortcut`

### 新建文件夹（Create Folder）

```json
{ "action": "create_folder", "name": "新文件夹" }
```

放到父文件夹里：

```json
{ "action": "create_folder", "name": "新文件夹", "folder_token": "fldcnXXX" }
```

### 移动文件（Move File）

```json
{ "action": "move", "file_token": "ABC123", "type": "docx", "folder_token": "fldcnXXX" }
```

### 删除文件（Delete File）

```json
{ "action": "delete", "file_token": "ABC123", "type": "docx" }
```

## 文件类型（File Types）

| 类型 | 说明 |
| ---------- | ----------------------- |
| `doc`      | 旧版文档 |
| `docx`     | 新版文档 |
| `sheet`    | 电子表格 |
| `bitable`  | 多维表格 |
| `folder`   | 文件夹 |
| `file`     | 上传的文件 |
| `mindnote` | 思维导图 |
| `shortcut` | 快捷方式 |

## 配置（Configuration）

```yaml
channels:
  feishu:
    tools:
      drive: true # 默认开启
```

## 权限（Permissions）

- `drive:drive` — 完全访问（建/移/删）
- `drive:drive:readonly` — 只读（list、info）

## 已知限制（Known Limitations）

- **机器人没有根目录**：飞书机器人用的是 `tenant_access_token`，没有自己的「我的空间」。根目录概念只对用户账号存在。这意味着：
  - 不带 `folder_token` 的 `create_folder` 会失败（400 错误）
  - 机器人只能访问**别人共享给它**的文件/文件夹
  - **变通办法**：用户先手动建一个文件夹并共享给机器人，机器人就能在里面建子文件夹了

> 📌 大白话：机器人不像人有自己的网盘根目录，所以不能凭空建文件夹。得人先建一个文件夹分享给它，它才能往里放东西。
