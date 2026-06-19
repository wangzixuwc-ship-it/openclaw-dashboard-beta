---
name: diagram-maker
description: 为概念、架构、流程、白板创建 SVG/HTML 或 Excalidraw 图表。
metadata: { "openclaw": { "emoji": "🧭" } }
---

# 图表制作（Diagram Maker）

把图表作为「成品文件」产出，而不是用文字描述。从下面三种输出模式里选一种：

- `clean-svg`（干净 SVG）：教学概念、物理系统、流程、生命周期、简单的数据流向。
- `architecture-svg`（架构 SVG）：软件/云/基础设施拓扑、服务、数据库、消息队列、信任域。
- `excalidraw`：可编辑的手绘风白板、流程图、时序图、架构草图。

## 怎么选（Routing）

- 用户要「可编辑/可协作」→ 选 Excalidraw。
- 用户要「精致、能独立在浏览器打开」的成品 → 选 SVG/HTML。
- 带基础设施组件的软件架构 → 选架构 SVG。
- 科学、产品、流程、概念图、实物 → 选干净 SVG。
- 拿不准：只在「输出格式很关键」时问一句简短的问题；否则默认用干净 SVG。

## 工作流程（Workflow）

1. 提炼出节点、分组、标签，以及它们之间的「有方向的关系」。
2. 先定布局：从左到右、从上到下、中心放射（hub-spoke）、泳道图、分层堆叠、时序。
3. 标签尽量短。宁可 5–9 个主要元素，也不要画得密密麻麻。
4. 在指定路径生成文件，或默认 `./diagram.html` / `./diagram.excalidraw`。
5. 条件允许时，通过打开/解析文件来验证语法是否正确。

## SVG/HTML 规则

- 单个独立的 `.html` 文件，CSS 内联、SVG 内联。
- 不用外部字体、JS、图片、渐变、发光、装饰色块或任何远程资源。
- 用「有语义的颜色」，不要用彩虹色：中性、输入、处理、存储、外部、风险。
- 先画连线再画节点，这样箭头会压在方框后面（更整洁）。
- 每条连线路径都要 `fill="none"`，有方向时配一个箭头 marker。
- 方框内文字留 24px 内边距，别让文字贴着边框。
- 只有当符号/颜色含义不明显时才加图例（Legend）。

## SVG 模板

用 `references/svg-template.md` 作为外层包装，把里面的 `<!-- SVG -->` 替换成你的内容。

## Excalidraw 规则

- 保存 `.excalidraw` 的 JSON，要带 `type`、`version`、`source`、`elements`、`appState` 这几个字段。
- 形状的标签用「绑定文本（bound text）」，不要用非标准的 `label` 属性。
- 绑定文本要紧跟在它所属容器的后面（在 elements 数组里）。
- 带标签的形状最小 120×60；正文文字最小 16px。
- 用 roughness `1`、`fontFamily: 1`、简单填充。

需要 Excalidraw 元素的精确写法时，读 `references/excalidraw-patterns.md`。

---
> 📌 这个技能没有可执行代码，全是给 AI 的「画图规范」：告诉它该选哪种图、怎么布局、配色和连线规则，最终产出一个能直接打开的 SVG/HTML 文件或可编辑的 Excalidraw 文件。
