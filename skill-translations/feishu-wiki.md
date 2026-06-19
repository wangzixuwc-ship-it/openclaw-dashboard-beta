---
name: feishu-wiki
description: |
  飞书知识库导航。当用户提到知识库、wiki 或 wiki 链接时启用。
---

# 飞书知识库工具（Feishu Wiki Tool）

只有一个工具 `feishu_wiki`，用于知识库操作。

知识库的 `space_id`（空间 ID）是不透明字符串。在工具调用里**始终加引号**，即使它看起来全是数字——因为把一长串看似数字的 ID 当成数字传，会因 JavaScript 数字精度限制把末尾几位弄错。

> 💡 一句话理解：飞书知识库（wiki）的「目录导航器」——列空间、列节点、新建/移动/重命名页面。注意它只管「目录结构」，页面正文内容要配合 `feishu_doc` 读写。

## 提取 Token（Token Extraction）

从链接 `https://xxx.feishu.cn/wiki/ABC123def` → `token` = `ABC123def`。

## 各种动作（Actions）

### 列出知识空间（List Knowledge Spaces）

```json
{ "action": "spaces" }
```

返回所有可访问的 wiki 空间。

### 列出节点（List Nodes）

```json
{ "action": "nodes", "space_id": "7xxx" }
```

带父节点：

```json
{ "action": "nodes", "space_id": "7xxx", "parent_node_token": "wikcnXXX" }
```

### 取节点详情（Get Node Details）

```json
{ "action": "get", "token": "ABC123def" }
```

返回：`node_token`、`obj_token`、`obj_type` 等。用 `obj_token` 配合 `feishu_doc` 来读写这个文档。
> 关键：wiki 节点本身只是「目录项」，真正的文档内容要拿它的 `obj_token` 去 feishu_doc 里读写。

### 新建节点（Create Node）

```json
{ "action": "create", "space_id": "7xxx", "title": "新页面" }
```

带类型和父节点：

```json
{
  "action": "create",
  "space_id": "7xxx",
  "title": "表格",
  "obj_type": "sheet",
  "parent_node_token": "wikcnXXX"
}
```

`obj_type` 可选：`docx`（默认）、`sheet`、`bitable`、`mindnote`、`file`、`doc`、`slides`

### 移动节点（Move Node）

```json
{ "action": "move", "space_id": "7xxx", "node_token": "wikcnXXX" }
```

移到不同位置：

```json
{
  "action": "move",
  "space_id": "7xxx",
  "node_token": "wikcnXXX",
  "target_space_id": "7yyy",
  "target_parent_token": "wikcnYYY"
}
```

### 重命名节点（Rename Node）

```json
{ "action": "rename", "space_id": "7xxx", "node_token": "wikcnXXX", "title": "新标题" }
```

## Wiki 文档读写工作流（Wiki-Doc Workflow）

要编辑一个 wiki 页面：

1. 取节点：`{ "action": "get", "token": "wiki_token" }` → 拿到 `obj_token`
2. 读文档：`feishu_doc { "action": "read", "doc_token": "obj_token" }`
3. 写文档：`feishu_doc { "action": "write", "doc_token": "obj_token", "content": "..." }`

## 配置（Configuration）

```yaml
channels:
  feishu:
    tools:
      wiki: true # 默认开启
      doc: true # 必需 —— wiki 内容靠 feishu_doc
```

**依赖：** 这个工具需要 `feishu_doc` 一起开启。wiki 页面本质就是文档——用 `feishu_wiki` 导航，再用 `feishu_doc` 读/改内容。

## 权限（Permissions）

需要：`wiki:wiki` 或 `wiki:wiki:readonly`
