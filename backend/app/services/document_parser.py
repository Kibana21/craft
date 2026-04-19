import asyncio
from io import BytesIO

from fastapi import HTTPException, status

SUPPORTED_TYPES = {
    "application/pdf",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "text/plain",
}


def _extract_pdf_markdown(data: bytes) -> str:
    import pymupdf
    import pymupdf4llm

    doc = pymupdf.open(stream=data, filetype="pdf")
    md = pymupdf4llm.to_markdown(doc, show_progress=False, use_ocr=False)
    doc.close()
    return md


def _extract_docx_markdown(data: bytes) -> str:
    from docx import Document

    doc = Document(BytesIO(data))
    lines: list[str] = []
    for para in doc.paragraphs:
        text = para.text.strip()
        if not text:
            lines.append("")
            continue
        style = (para.style.name or "").lower()
        if "heading 1" in style:
            lines.append(f"# {text}")
        elif "heading 2" in style:
            lines.append(f"## {text}")
        elif "heading 3" in style:
            lines.append(f"### {text}")
        elif "heading" in style:
            lines.append(f"#### {text}")
        elif "list" in style or "bullet" in style:
            lines.append(f"- {text}")
        else:
            lines.append(_format_runs(para.runs) if para.runs else text)
    return "\n\n".join(lines)


def _format_runs(runs: list) -> str:
    parts: list[str] = []
    for run in runs:
        text = run.text
        if not text:
            continue
        if run.bold and run.italic:
            text = f"***{text}***"
        elif run.bold:
            text = f"**{text}**"
        elif run.italic:
            text = f"*{text}*"
        parts.append(text)
    return "".join(parts)


async def extract_content_from_file(data: bytes, content_type: str) -> str:
    if content_type not in SUPPORTED_TYPES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Unsupported file type. Upload a PDF, DOCX, or plain text file.",
        )

    if content_type == "text/plain":
        text = data.decode("utf-8", errors="replace")
    elif content_type == "application/pdf":
        text = await asyncio.to_thread(_extract_pdf_markdown, data)
    else:
        text = await asyncio.to_thread(_extract_docx_markdown, data)

    if not text or not text.strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Could not extract text from file. The document may be scanned or image-only.",
        )

    return text.strip()
