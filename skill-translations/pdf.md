---
name: pdf
description: 凡是用户要对 PDF 做任何事都用这个技能。包括：读取/抽取 PDF 的文字和表格、合并多个 PDF、拆分 PDF、旋转页面、加水印、新建 PDF、填 PDF 表单、加密/解密、抽图片、对扫描件 OCR 使其可搜索。用户提到 .pdf 文件或要生成 PDF 时使用。
license: 专有。完整条款见 LICENSE.txt
---

# PDF 处理指南

## 概述

本指南讲用 Python 库和命令行工具处理 PDF 的核心操作。高级功能、JavaScript 库和详细示例见 reference.md。要填 PDF 表单则读 forms.md 并按其说明操作。

> 💡 整体理解：这是「PDF 操作手册」，给出读/合并/拆分/旋转/加水印/建/OCR/加密 等各种任务的现成 Python 代码和命令行写法。下面每段代码我都加了一句它在干嘛。

## 快速开始

```python
from pypdf import PdfReader, PdfWriter

# 读一个 PDF
reader = PdfReader("document.pdf")
print(f"Pages: {len(reader.pages)}")

# 抽取文字
text = ""
for page in reader.pages:
    text += page.extract_text()
```
> 🔍 用 pypdf 库打开 PDF、数页数、把每页文字拼起来。

## Python 库

### pypdf —— 基础操作

#### 合并 PDF
```python
from pypdf import PdfWriter, PdfReader

writer = PdfWriter()
for pdf_file in ["doc1.pdf", "doc2.pdf", "doc3.pdf"]:
    reader = PdfReader(pdf_file)
    for page in reader.pages:
        writer.add_page(page)

with open("merged.pdf", "wb") as output:
    writer.write(output)
```
> 🔍 把多个 PDF 的每一页依次塞进一个 writer，最后写成一个合并文件。

#### 拆分 PDF
```python
reader = PdfReader("input.pdf")
for i, page in enumerate(reader.pages):
    writer = PdfWriter()
    writer.add_page(page)
    with open(f"page_{i+1}.pdf", "wb") as output:
        writer.write(output)
```
> 🔍 逐页拆开，每页单独存成一个 PDF。

#### 抽取元数据
```python
reader = PdfReader("document.pdf")
meta = reader.metadata
print(f"Title: {meta.title}")
print(f"Author: {meta.author}")
print(f"Subject: {meta.subject}")
print(f"Creator: {meta.creator}")
```
> 🔍 读 PDF 的标题/作者/主题/创建工具等属性信息。

#### 旋转页面
```python
reader = PdfReader("input.pdf")
writer = PdfWriter()

page = reader.pages[0]
page.rotate(90)  # 顺时针旋转 90 度
writer.add_page(page)

with open("rotated.pdf", "wb") as output:
    writer.write(output)
```
> 🔍 把第一页顺时针转 90 度后另存。

### pdfplumber —— 抽文字和表格

#### 带版式抽文字
```python
import pdfplumber

with pdfplumber.open("document.pdf") as pdf:
    for page in pdf.pages:
        text = page.extract_text()
        print(text)
```
> 🔍 pdfplumber 比 pypdf 更擅长保留排版地抽文字。

#### 抽表格
```python
with pdfplumber.open("document.pdf") as pdf:
    for i, page in enumerate(pdf.pages):
        tables = page.extract_tables()
        for j, table in enumerate(tables):
            print(f"Table {j+1} on page {i+1}:")
            for row in table:
                print(row)
```
> 🔍 把 PDF 里的表格识别出来，按行打印。

#### 高级表格抽取（转 Excel）
```python
import pandas as pd

with pdfplumber.open("document.pdf") as pdf:
    all_tables = []
    for page in pdf.pages:
        tables = page.extract_tables()
        for table in tables:
            if table:  # 表格非空才处理
                df = pd.DataFrame(table[1:], columns=table[0])
                all_tables.append(df)

# 合并所有表格
if all_tables:
    combined_df = pd.concat(all_tables, ignore_index=True)
    combined_df.to_excel("extracted_tables.xlsx", index=False)
```
> 🔍 把所有页的表格抽出来、用 pandas 拼成一张大表、导出成 Excel。对从 PDF 报表提数据很实用。

### reportlab —— 生成 PDF

#### 基础建 PDF
```python
from reportlab.lib.pagesizes import letter
from reportlab.pdfgen import canvas

c = canvas.Canvas("hello.pdf", pagesize=letter)
width, height = letter

# 加文字
c.drawString(100, height - 100, "Hello World!")
c.drawString(100, height - 120, "This is a PDF created with reportlab")

# 画一条线
c.line(100, height - 140, 400, height - 140)

# 保存
c.save()
```
> 🔍 用 reportlab 的 canvas（画布）在指定坐标写字、画线，生成一个 PDF。坐标原点在左下角。

#### 多页 PDF
```python
from reportlab.lib.pagesizes import letter
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, PageBreak
from reportlab.lib.styles import getSampleStyleSheet

doc = SimpleDocTemplate("report.pdf", pagesize=letter)
styles = getSampleStyleSheet()
story = []

# 加内容
title = Paragraph("Report Title", styles['Title'])
story.append(title)
story.append(Spacer(1, 12))

body = Paragraph("This is the body of the report. " * 20, styles['Normal'])
story.append(body)
story.append(PageBreak())

# 第 2 页
story.append(Paragraph("Page 2", styles['Heading1']))
story.append(Paragraph("Content for page 2", styles['Normal']))

# 生成 PDF
doc.build(story)
```
> 🔍 用 Platypus（reportlab 的高级排版）把标题、段落、分页符组成一个「story」列表，自动排版成多页报告。比 canvas 省心。

#### 下标和上标
**重要**：reportlab PDF 里**绝不要**用 Unicode 上下标字符（₀₁₂₃…、⁰¹²³…），内置字体没有这些字形，会渲染成黑方块。

改用 reportlab 的 XML 标签写在 Paragraph 里：
```python
from reportlab.platypus import Paragraph
from reportlab.lib.styles import getSampleStyleSheet

styles = getSampleStyleSheet()

# 下标：用 <sub> 标签
chemical = Paragraph("H<sub>2</sub>O", styles['Normal'])

# 上标：用 <super> 标签
squared = Paragraph("x<super>2</super> + y<super>2</super>", styles['Normal'])
```
对 canvas 直接画的文字（非 Paragraph），手动调字号和位置来模拟上下标，别用 Unicode 上下标。

## 命令行工具

### pdftotext（poppler-utils）
```bash
pdftotext input.pdf output.txt              # 抽文字
pdftotext -layout input.pdf output.txt      # 抽文字并保留版式
pdftotext -f 1 -l 5 input.pdf output.txt    # 只抽第 1-5 页
```

### qpdf
```bash
qpdf --empty --pages file1.pdf file2.pdf -- merged.pdf   # 合并
qpdf input.pdf --pages . 1-5 -- pages1-5.pdf             # 拆出 1-5 页
qpdf input.pdf output.pdf --rotate=+90:1                 # 第 1 页转 90 度
qpdf --password=mypassword --decrypt encrypted.pdf decrypted.pdf  # 去密码
```

### pdftk（如果装了）
```bash
pdftk file1.pdf file2.pdf cat output merged.pdf   # 合并
pdftk input.pdf burst                              # 拆成单页
pdftk input.pdf rotate 1east output rotated.pdf    # 旋转
```

## 常见任务

### 从扫描 PDF 抽文字（OCR）
```python
# 需要: pip install pytesseract pdf2image
import pytesseract
from pdf2image import convert_from_path

# PDF 转图片
images = convert_from_path('scanned.pdf')

# 逐页 OCR
text = ""
for i, image in enumerate(images):
    text += f"Page {i+1}:\n"
    text += pytesseract.image_to_string(image)
    text += "\n\n"

print(text)
```
> 🔍 扫描件是图片没有文字层，先把每页转成图片，再用 OCR（pytesseract）识别成文字。

### 加水印
```python
from pypdf import PdfReader, PdfWriter

# 建/载入水印
watermark = PdfReader("watermark.pdf").pages[0]

# 应用到每一页
reader = PdfReader("document.pdf")
writer = PdfWriter()

for page in reader.pages:
    page.merge_page(watermark)
    writer.add_page(page)

with open("watermarked.pdf", "wb") as output:
    writer.write(output)
```
> 🔍 把一张水印 PDF 的内容叠（merge）到每一页上。

### 抽图片
```bash
# 用 pdfimages（poppler-utils）
pdfimages -j input.pdf output_prefix
# 抽出 output_prefix-000.jpg、output_prefix-001.jpg …
```

### 密码保护
```python
from pypdf import PdfReader, PdfWriter

reader = PdfReader("input.pdf")
writer = PdfWriter()

for page in reader.pages:
    writer.add_page(page)

# 加密码
writer.encrypt("userpassword", "ownerpassword")

with open("encrypted.pdf", "wb") as output:
    writer.write(output)
```
> 🔍 给 PDF 加用户密码（打开用）和所有者密码（改权限用）。

## 速查表

| 任务 | 最佳工具 | 命令/代码 |
|------|-----------|--------------|
| 合并 PDF | pypdf | `writer.add_page(page)` |
| 拆分 PDF | pypdf | 每页一个文件 |
| 抽文字 | pdfplumber | `page.extract_text()` |
| 抽表格 | pdfplumber | `page.extract_tables()` |
| 建 PDF | reportlab | Canvas 或 Platypus |
| 命令行合并 | qpdf | `qpdf --empty --pages ...` |
| 扫描件 OCR | pytesseract | 先转图片 |
| 填表单 | pdf-lib 或 pypdf（见 forms.md） | 见 forms.md |

## 下一步

- pypdfium2 高级用法见 reference.md
- JavaScript 库（pdf-lib）见 reference.md
- 填 PDF 表单按 forms.md 操作
- 排错指南见 reference.md
