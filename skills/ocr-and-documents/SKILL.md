---
name: ocr-and-documents
description: Extract text from PDFs, images, scans, and Word documents using Python libraries and CLI tools
category: productivity
version: 1.0.0
origin: aiden
tags: ocr, pdf, image, text-extraction, documents, docx, scan, pymupdf, tesseract, pdf-parse
---

# OCR and Document Text Extraction

Extract readable text from PDFs, scanned images, and Word documents using Python libraries available in most environments. No cloud API required.

## When to Use

- User wants to read text from a PDF file
- User wants to extract text from a scanned image or photo of a document
- User wants to read a `.docx` Word document programmatically
- User wants to convert a multi-page document to plain text for analysis
- User wants to extract specific pages or sections from a PDF

## How to Use

### 1. Extract text from a PDF (pymupdf — fastest)

```python
import fitz  # pip install pymupdf

doc  = fitz.open("document.pdf")
text = "\n\n".join(page.get_text() for page in doc)
print(text[:2000])  # preview first 2000 chars
doc.close()
```

### 2. Extract text from a PDF (pdf-parse via Node.js)

```javascript
// requires: npm install pdf-parse (already in DevOS dependencies)
const pdfParse = require('pdf-parse')
const fs       = require('fs')
const data     = await pdfParse(fs.readFileSync('document.pdf'))
console.log(data.text.slice(0, 2000))
console.log(`Pages: ${data.numpages}`)
```

### 3. OCR a scanned image (Tesseract)

Requires Tesseract installed: `winget install UB-Mannheim.TesseractOCR`

```python
import pytesseract          # pip install pytesseract
from PIL import Image       # pip install Pillow

img  = Image.open("scan.png")
text = pytesseract.image_to_string(img, lang="eng")
print(text)
```

### 4. OCR with preprocessing for better accuracy

```python
import pytesseract
from PIL import Image, ImageFilter, ImageOps

img = Image.open("scan.jpg")
img = ImageOps.grayscale(img)
img = img.filter(ImageFilter.SHARPEN)
img = img.point(lambda p: 255 if p > 128 else 0)  # binarize
text = pytesseract.image_to_string(img, config="--psm 6")
print(text)
```

### 5. Extract text from a Word .docx file

```python
from docx import Document   # pip install python-docx

doc   = Document("report.docx")
paras = [p.text for p in doc.paragraphs if p.text.strip()]
text  = "\n".join(paras)
print(text)
```

### 6. Extract a specific page range from a PDF

```python
import fitz

doc    = fitz.open("big_report.pdf")
pages  = range(4, 9)   # pages 5-9 (0-indexed)
text   = "\n\n".join(doc[i].get_text() for i in pages)
print(text)
```

### 7. Extract tables from a PDF

```python
import pdfplumber   # pip install pdfplumber

with pdfplumber.open("financial_report.pdf") as pdf:
  for page in pdf.pages:
    for table in page.extract_tables():
      for row in table:
        print("\t".join(str(cell or "") for cell in row))
```

## Examples

**"Read the text from this PDF contract"**
→ Use step 1 (pymupdf) or step 2 (pdf-parse) depending on whether Python or Node is preferred.

**"Extract the table from page 3 of this quarterly report PDF"**
→ Use step 7 (pdfplumber) targeting `pdf.pages[2]` for page 3.

**"Read the text from this scanned invoice image"**
→ Use step 3 or 4 (Tesseract). For low-quality scans, use step 4 with preprocessing.

## Cautions

- Scanned PDFs (image-only) have no embedded text — Tesseract OCR is required
- Tesseract accuracy drops on handwriting, decorative fonts, or low-resolution images (< 150 DPI)
- pymupdf (`fitz`) extracts only programmatically embedded text — it won't OCR scanned pages
- Large PDFs can use significant memory — process page by page for files > 100 MB
- For non-English text, specify the language code in Tesseract: `lang="hin"` for Hindi, `"deu"` for German
