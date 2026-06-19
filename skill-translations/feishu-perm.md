---
name: feishu-perm
description: |
  飞书文档与文件的权限管理。当用户提到共享、权限、协作者时启用。
---

# 飞书权限工具（Feishu Permission Tool）

只有一个工具 `feishu_perm`，用于管理文件/文档的权限。

> 💡 一句话理解：给飞书文档/文件加减「协作者」、设置谁能看/能编辑/能管理。靠 `action` 区分操作。

## 各种动作（Actions）

### 列出协作者（List Collaborators）

```json
{ "action": "list", "token": "ABC123", "type": "docx" }
```

返回：成员的 member_type（成员类型）、member_id、perm（权限）、name。

### 添加协作者（Add Collaborator）

```json
{
  "action": "add",
  "token": "ABC123",
  "type": "docx",
  "member_type": "email",
  "member_id": "user@example.com",
  "perm": "edit"
}
```

### 移除协作者（Remove Collaborator）

```json
{
  "action": "remove",
  "token": "ABC123",
  "type": "docx",
  "member_type": "email",
  "member_id": "user@example.com"
}
```

## Token 类型（Token Types）

| 类型 | 说明 |
| ---------- | ----------------------- |
| `doc`      | 旧版文档 |
| `docx`     | 新版文档 |
| `sheet`    | 电子表格 |
| `bitable`  | 多维表格 |
| `folder`   | 文件夹 |
| `file`     | 上传的文件 |
| `wiki`     | 知识库节点 |
| `mindnote` | 思维导图 |

## 成员类型（Member Types）

| 类型 | 说明 |
| ------------------ | ------------------ |
| `email`            | 邮箱地址 |
| `openid`           | 用户 open_id |
| `userid`           | 用户 user_id |
| `unionid`          | 用户 union_id |
| `openchat`         | 群聊 open_id |
| `opendepartmentid` | 部门 open_id |

## 权限级别（Permission Levels）

| 权限 | 说明 |
| ------------- | ------------------------------------ |
| `view`        | 仅查看 |
| `edit`        | 可编辑 |
| `full_access` | 完全访问（可管理权限） |

## 示例（Examples）

按邮箱共享文档：

```json
{
  "action": "add",
  "token": "doxcnXXX",
  "type": "docx",
  "member_type": "email",
  "member_id": "alice@company.com",
  "perm": "edit"
}
```

把文件夹共享给某个群：

```json
{
  "action": "add",
  "token": "fldcnXXX",
  "type": "folder",
  "member_type": "openchat",
  "member_id": "oc_xxx",
  "perm": "view"
}
```

## 配置（Configuration）

```yaml
channels:
  feishu:
    tools:
      perm: true # 默认：false（关闭）
```

**注意：** 这个工具**默认关闭**，因为权限管理是敏感操作。需要时再显式打开。

## 权限（Permissions）

需要：`drive:permission`

> 📌 大白话：这是「分享/改权限」的工具，因为改别人能不能看你文档比较敏感，默认是关的，要用得自己先开。
