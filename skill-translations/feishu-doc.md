---
name: feishu-doc
description: |
  飞书文档读写操作。当用户提到飞书文档、云文档或 docx 链接时启用。
---

# 飞书文档工具（Feishu Document Tool）

只有一个工具 `feishu_doc`，通过 `action`（动作）参数来完成所有文档操作，包括给 Docx 创建表格。

> 💡 一句话理解：这是个「飞书文档的瑞士军刀」。你调用同一个 `feishu_doc` 工具，靠传不同的 `action` 告诉它要干嘛（读、写、追加、建表、传图……）。下面每段的 JSON 就是「调用时要传的参数」，不是要你手写的代码。

## 提取文档 Token（Token Extraction）

从链接 `https://xxx.feishu.cn/docx/ABC123def` 里 → `doc_token`（文档标识）就是 `ABC123def`。
> 即：链接 `/docx/` 后面那串就是文档的「身份证号」，后面所有操作都靠它定位文档。

## 各种动作（Actions）

### 读文档（Read Document）

```json
{ "action": "read", "doc_token": "ABC123def" }
```

返回：标题、纯文本内容、块（block）统计。注意看返回里的 `hint` 字段——如果有，说明文档里有表格、图片这类结构化内容，需要再用 `list_blocks` 才能完整读出来。
> 大白话：先用 read 拿到正文文字。如果文档里有表格/图片，read 只给你文字，得用下面的 list_blocks 才能拿到完整结构。

### 写文档（整篇覆盖，Write Document - Replace All）

```json
{ "action": "write", "doc_token": "ABC123def", "content": "# 标题\n\nMarkdown 内容..." }
```

用 markdown 内容**整篇替换**文档。支持：标题、列表、代码块、引用、链接、图片（`![](url)` 会自动上传）、加粗/斜体/删除线。
**限制：** 不支持 Markdown 表格（要建表用下面的 create_table 系列）。
> 注意：这是「整篇覆盖」，原内容会被全部替换掉，慎用。只想加内容用下面的 append。

### 追加内容（Append Content）

```json
{ "action": "append", "doc_token": "ABC123def", "content": "要补充的内容" }
```

把 markdown 追加到文档末尾（不覆盖原内容）。

### 新建文档（Create Document）

```json
{ "action": "create", "title": "新文档", "owner_open_id": "ou_xxx" }
```

放到指定文件夹里：

```json
{
  "action": "create",
  "title": "新文档",
  "folder_token": "fldcnXXX",
  "owner_open_id": "ou_xxx"
}
```

**重要：** 一定要传 `owner_open_id`，填发起请求那个用户的 `open_id`（来自消息元数据里的 `sender_id`），这样该用户会自动获得新文档的 `full_access`（完全访问）权限。不传的话，就只有机器人应用自己能访问这个文档。
> 大白话：建文档时把「谁让我建的」这个人的 open_id 带上，否则建出来的文档只有机器人能看，本人反而打不开。

### 列出所有块（List Blocks）

```json
{ "action": "list_blocks", "doc_token": "ABC123def" }
```

返回完整的块数据，包括表格、图片。要读结构化内容时用它。
> block（块）= 飞书文档把每段/每个表格/每张图都当成一个「块」。list_blocks 就是把这些块全列出来。

### 取单个块（Get Single Block）

```json
{ "action": "get_block", "doc_token": "ABC123def", "block_id": "doxcnXXX" }
```

### 改某个块的文字（Update Block Text）

```json
{
  "action": "update_block",
  "doc_token": "ABC123def",
  "block_id": "doxcnXXX",
  "content": "新文字"
}
```

### 删除某个块（Delete Block）

```json
{ "action": "delete_block", "doc_token": "ABC123def", "block_id": "doxcnXXX" }
```

### 建表格（Docx 表格块，Create Table）

```json
{
  "action": "create_table",
  "doc_token": "ABC123def",
  "row_size": 2,
  "column_size": 2,
  "column_width": [200, 200]
}
```

可选：用 `parent_block_id` 把表格插到某个块下面。
> row_size=行数，column_size=列数，column_width=每列宽度（像素）。

### 往表格里写单元格（Write Table Cells）

```json
{
  "action": "write_table_cells",
  "doc_token": "ABC123def",
  "table_block_id": "doxcnTABLE",
  "values": [
    ["A1", "B1"],
    ["A2", "B2"]
  ]
}
```
> `values` 是个二维数组：外层一个元素=一行，内层=这行各列的值。

### 一步建表并填值（Create Table With Values）

```json
{
  "action": "create_table_with_values",
  "doc_token": "ABC123def",
  "row_size": 2,
  "column_size": 2,
  "column_width": [200, 200],
  "values": [
    ["A1", "B1"],
    ["A2", "B2"]
  ]
}
```

可选：`parent_block_id` 插到指定块下。
> 这个动作 = create_table + write_table_cells 合并成一步，建表同时把内容填好。

### 上传图片到文档（从 URL 或本地文件，Upload Image）

```json
{
  "action": "upload_image",
  "doc_token": "ABC123def",
  "url": "https://example.com/image.png"
}
```

或用本地路径并控制插入位置：

```json
{
  "action": "upload_image",
  "doc_token": "ABC123def",
  "file_path": "/tmp/image.png",
  "parent_block_id": "doxcnParent",
  "index": 5
}
```

可选 `index`（从 0 开始）把图片插到同级块的指定位置；不填就追加到末尾。
**注意：** 图片显示大小由图片本身的像素尺寸决定。小图（比如 480x270 的 GIF）建议先放大到 800px 宽以上再传，才能正常显示。

### 上传文件附件到文档（Upload File）

```json
{
  "action": "upload_file",
  "doc_token": "ABC123def",
  "url": "https://example.com/report.pdf"
}
```

或本地路径：

```json
{
  "action": "upload_file",
  "doc_token": "ABC123def",
  "file_path": "/tmp/report.pdf",
  "filename": "Q1-report.pdf"
}
```

规则：
- `url` 和 `file_path` 二选一（只能传一个）
- 可选 `filename` 覆盖文件名
- 可选 `parent_block_id`

## 读取工作流（Reading Workflow）

1. 先用 `action: "read"` —— 拿到纯文本 + 统计。
2. 看返回里的 `block_types`，是否有 Table（表格）、Image（图片）、Code（代码）等。
3. 如果有结构化内容，再用 `action: "list_blocks"` 拿完整数据。

## 配置（Configuration）

```yaml
channels:
  feishu:
    tools:
      doc: true # 默认开启
```
> 这段是飞书渠道的开关配置：`doc: true` 表示启用文档工具（默认就是开的）。

**注意：** `feishu_wiki`（知识库）依赖这个工具——wiki 页面内容的读写其实都是通过 `feishu_doc` 完成的。

## 权限（Permissions）

需要：`docx:document`、`docx:document:readonly`、`docx:document.block:convert`、`drive:drive`
> 即机器人应用要在飞书后台开通这几项文档/云盘权限，否则调用会报权限错误。
