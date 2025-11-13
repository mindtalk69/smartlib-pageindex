import base64
import logging
import os
import re
from io import BytesIO
from typing import TYPE_CHECKING, Any, Dict, Iterable, List, Optional, Sequence, Tuple, Union

import fitz  # type: ignore[import-not-found]  # PyMuPDF
import numpy as np
from pdfminer.high_level import extract_text
from PIL import Image, ImageOps

if TYPE_CHECKING:  # pragma: no cover - import only for type hints
    from rapidocr_onnxruntime import RapidOCR

logger = logging.getLogger(__name__)

PathLike = Union[str, os.PathLike[str]]


def is_image_only_pdf(pdf_path: PathLike) -> bool:
    try:
        doc: Any = fitz.open(pdf_path)
    except Exception as exc:
        logger.error(
            "Failed to open PDF for inspection %s: %s", pdf_path, exc, exc_info=True
        )
        return False

    try:
        try:
            extracted_text = extract_text(str(pdf_path)).strip()
        except Exception as extract_exc:
            logger.warning(
                "Failed to extract text while checking PDF %s: %s",
                pdf_path,
                extract_exc,
                exc_info=True,
            )
            extracted_text = ""

        if extracted_text:
            return False

        for page_index in range(len(doc)):
            page: Any = doc.load_page(page_index)
            images = page.get_images(full=True)  # type: ignore[attr-defined]
            if not images:
                return False
        return True
    finally:
        try:
            doc.close()
        except Exception:
            pass


def Is_cuda_available() -> bool:
    try:
        import torch

        return bool(torch.cuda.is_available())
    except Exception:
        return False


# Clean up markdown content
def clean_markdown_content(content: str) -> str:
    content = re.sub(r"<.*?>", "", content)
    content = re.sub(r"[\\]+", "", content)
    return content.strip()


def Get_image_first_page_base64(pdf_path: PathLike) -> Optional[str]:
    doc: Optional[Any] = None
    try:
        if not os.path.exists(pdf_path):
            logger.error("PDF file not found: %s", pdf_path)
            return None

        doc = fitz.open(pdf_path)
        if len(doc) == 0:
            logger.error("PDF has no pages: %s", pdf_path)
            return None

        page: Any = doc.load_page(0)
        pix = page.get_pixmap()  # type: ignore[attr-defined]

        image = Image.frombytes(
            "RGB",
            (int(pix.width), int(pix.height)),
            pix.samples,
        )

        buffer = BytesIO()
        image.save(buffer, format="PNG")
        buffer.seek(0)
        encoded = base64.b64encode(buffer.read()).decode("utf-8")
        return encoded
    except Exception as exc:
        logger.error(
            "Error processing PDF '%s' for first page image: %s",
            pdf_path,
            exc,
            exc_info=True,
        )
        return None
    finally:
        if doc is not None:
            try:
                doc.close()
            except Exception:
                pass


def _preprocess_pil_image_for_ocr(
    image: Image.Image,
    resize_to: Optional[Tuple[Optional[int], Optional[int]]] = None,
    enhance_contrast: bool = True,
    to_grayscale: bool = True,
    threshold: bool = False,
) -> Image.Image:
    img = image.copy()
    resampling_module = getattr(Image, "Resampling", Image)

    if resize_to:
        target_w, target_h = resize_to
        if target_w and not target_h:
            w_percent = target_w / float(img.width)
            target_h = int(float(img.height) * w_percent)
        if target_w and target_h:
            try:
                img = img.resize(
                    (target_w, target_h),
                    resampling_module.LANCZOS,  # type: ignore[attr-defined]
                )
            except Exception:
                img = img.resize((target_w, target_h))

    if enhance_contrast:
        try:
            img = ImageOps.autocontrast(img)
        except Exception:
            pass

    if to_grayscale:
        try:
            img = img.convert("L")
        except Exception:
            pass

    if threshold:
        try:
            thresh = 160
            img = img.point(lambda pixel: 255 if pixel > thresh else 0)  # type: ignore[arg-type]
        except Exception:
            pass

    return img


def _create_rapidocr_reader(gpu: bool = False) -> Optional["RapidOCR"]:
    try:
        from rapidocr_onnxruntime import RapidOCR
    except (ImportError, RuntimeError) as exc:
        logger.error("RapidOCR import failed: %s", exc)
        return None

    try:
        reader = RapidOCR()
        if gpu:
            logger.warning(
                "RapidOCR GPU flag requested, but default CPU configuration "
                "is being used."
            )
        return reader
    except Exception as exc:
        logger.error(
            "Failed to initialize RapidOCR reader: %s", exc, exc_info=True
        )
        return None


def _format_rapidocr_results(
    raw_result: Optional[Iterable[Sequence[Any]]],
) -> Tuple[str, List[List[Any]]]:
    if not raw_result:
        return "", []

    texts: List[str] = []
    formatted: List[List[Any]] = []
    for item in raw_result:
        if not isinstance(item, Sequence) or len(item) < 3:
            continue
        bbox = item[0]
        text_value = item[1]
        score = item[2]
        formatted.append([bbox, text_value, score])
        if isinstance(text_value, str) and text_value:
            texts.append(text_value)

    return "\n".join(texts), formatted


def _image_to_png_bytes(image: Image.Image) -> bytes:
    buffer = BytesIO()
    image.save(buffer, format="PNG")
    return buffer.getvalue()


def run_rapidocr_on_image(
    image_path: PathLike,
    languages: Sequence[str] | None = None,
    gpu: bool = False,
    preprocess: bool = False,
    resize_width: Optional[int] = None,
    threshold: bool = False,
) -> Tuple[Optional[str], List[List[Any]]]:
    reader = _create_rapidocr_reader(gpu=gpu)
    if reader is None:
        return None, []

    if languages and any(lang.lower() != "en" for lang in languages):
        logger.warning(
            "RapidOCR multi-language input requested (%s); default English "
            "models will be used.",
            languages,
        )

    input_for_reader: Union[str, np.ndarray] = str(image_path)

    if preprocess or resize_width or threshold:
        try:
            with Image.open(image_path) as pil_image:
                pil_rgb = pil_image.convert("RGB")
                resize_to = (resize_width, None) if resize_width else None
                processed = _preprocess_pil_image_for_ocr(
                    pil_rgb,
                    resize_to=resize_to,
                    threshold=threshold,
                )
        except Exception as exc:
            logger.error(
                "Failed to open image %s for RapidOCR preprocessing: %s",
                image_path,
                exc,
                exc_info=True,
            )
            return None, []
        input_for_reader = np.array(processed)

    try:
        raw_result, _ = reader(input_for_reader)
    except Exception as exc:
        logger.error(
            "RapidOCR recognition failed for %s: %s",
            image_path,
            exc,
            exc_info=True,
        )
        return None, []

    text, formatted = _format_rapidocr_results(raw_result)
    return text or "", formatted


def run_rapidocr_on_pdf_all_pages(
    pdf_path: PathLike,
    languages: Sequence[str] | None = None,
    gpu: bool = False,
    dpi: int = 200,
    preprocess: bool = False,
    resize_width: Optional[int] = None,
    threshold: bool = False,
) -> List[Dict[str, Any]]:
    reader = _create_rapidocr_reader(gpu=gpu)
    if reader is None:
        return []

    if languages and any(lang.lower() != "en" for lang in languages):
        logger.warning(
            "RapidOCR multi-language input requested (%s); default English "
            "models will be used.",
            languages,
        )

    if not os.path.exists(pdf_path):
        logger.error("PDF file not found for multi-page OCR: %s", pdf_path)
        return []

    doc: Optional[Any] = None
    pages_output: List[Dict[str, Any]] = []
    try:
        doc = fitz.open(pdf_path)
        if len(doc) == 0:
            logger.error("PDF has no pages for multi-page OCR: %s", pdf_path)
            return pages_output

        for page_index in range(len(doc)):
            try:
                page: Any = doc.load_page(page_index)
                pix = page.get_pixmap(dpi=dpi)  # type: ignore[attr-defined]
                image = Image.frombytes(
                    "RGB",
                    (int(pix.width), int(pix.height)),
                    pix.samples,
                )

                resize_to = (resize_width, None) if resize_width else None
                processed = (
                    _preprocess_pil_image_for_ocr(
                        image,
                        resize_to=resize_to,
                        threshold=threshold,
                    )
                    if preprocess or resize_width or threshold
                    else image
                )

                image_bytes = _image_to_png_bytes(processed)
                numpy_image = np.array(processed)

                raw_result, _ = reader(numpy_image)
                text, formatted = _format_rapidocr_results(raw_result)

                pages_output.append(
                    {
                        "page_number": page_index + 1,
                        "text": text,
                        "results": formatted,
                        "image_bytes": image_bytes,
                    }
                )
            except Exception as page_exc:
                logger.error(
                    "RapidOCR failed on page %s for %s: %s",
                    page_index + 1,
                    pdf_path,
                    page_exc,
                    exc_info=True,
                )
    except Exception as exc:
        logger.error(
            "Failed to run multi-page RapidOCR on PDF %s: %s",
            pdf_path,
            exc,
            exc_info=True,
        )
    finally:
        if doc is not None:
            try:
                doc.close()
            except Exception:
                pass

    return pages_output


def run_easyocr_on_image(
    *args: Any, **kwargs: Any
) -> Tuple[Optional[str], List[List[Any]]]:
    logger.warning(
        "EasyOCR support has been replaced by RapidOCR. Using RapidOCR instead."
    )
    return run_rapidocr_on_image(*args, **kwargs)


def run_easyocr_on_pdf_all_pages(
    *args: Any, **kwargs: Any
) -> List[Dict[str, Any]]:
    logger.warning(
        "EasyOCR support has been replaced by RapidOCR. Using RapidOCR instead."
    )
    return run_rapidocr_on_pdf_all_pages(*args, **kwargs)
