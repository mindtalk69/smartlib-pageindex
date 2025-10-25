import os,fitz  # PyMuPDF
import logging
from langchain_community.document_loaders import AzureAIDocumentIntelligenceLoader
from pdfminer.high_level import extract_text
import re
import base64
from io import BytesIO
from PIL import Image

logger = logging.getLogger(__name__) # Add logger


def is_image_only_pdf(pdf_path):
    doc = fitz.open(pdf_path)
    text = extract_text(pdf_path).strip()
    
    # Check if any page has extractable text
    if text:
        return False  # Contains selectable text, not just images
    
    # Check if every page contains images
    for page_num in range(len(doc)):
        images = doc[page_num].get_images(full=True)
        if not images:  # If a page lacks images, it may contain actual text
            return False

    return True  # All pages contain images, likely an image-only PDF

def Is_cuda_available():
#"*** Check if avaliale with torch***"
    import torch

    return torch.cuda.is_available()
    
# Clean up markdown content
def clean_markdown_content(content):    
    content = re.sub(r"<.*?>", "", content)  # Remove HTML tags like <figure>
    content = re.sub(r"[\\]+", "", content) # Remove escape characters like \
    return content.strip()


def Get_image_first_page_base64(pdf_path):
    """
    Extracts the first page of a PDF as a Base64 encoded PNG image.

    Args:
        pdf_path (str): The path to the PDF file.

    Returns:
        str: Base64 encoded PNG image string, or None if an error occurs.
    """
    doc = None  # Initialize doc to None for the finally block
    try:
        if not os.path.exists(pdf_path):
            logger.error(f"PDF file not found: {pdf_path}")
            return None

        doc = fitz.open(pdf_path)

        if len(doc) == 0:
            logger.error(f"PDF has no pages: {pdf_path}")
            return None

        # Get the first page
        page = doc.load_page(0)  # 0-based index

        # Render the page to a pixmap (consider increasing DPI for higher quality if needed)
        # pix = page.get_pixmap(dpi=150) # Example: Higher DPI
        pix = page.get_pixmap() # Default DPI

        # Convert pixmap to PIL Image
        image = Image.frombytes("RGB", [pix.width, pix.height], pix.samples)

        # Save image to BytesIO for Base64 encoding
        image_bytes = BytesIO()
        image.save(image_bytes, format="PNG")  # Save as PNG format
        image_bytes.seek(0) # Reset buffer position to the beginning

        # Encode image as Base64
        image_base64 = base64.b64encode(image_bytes.read()).decode("utf-8")

        return image_base64

    except Exception as e:
        logger.error(f"Error processing PDF '{pdf_path}' for first page image: {e}", exc_info=True)
        return None
    finally:
        if doc:
            try:
                doc.close() # Ensure the document is closed
            except Exception as close_e:
                logger.error(f"Error closing PDF document '{pdf_path}': {close_e}")

def _preprocess_pil_image_for_ocr(image, resize_to=None, enhance_contrast=True, to_grayscale=True, threshold=False):
    """
    Apply preprocessing to a PIL Image to improve OCR accuracy.

    - image: PIL.Image instance
    - resize_to: (width, height) tuple or None — if provided, image will be resized preserving aspect ratio to the given width (height can be None)
    - enhance_contrast: apply autocontrast
    - to_grayscale: convert to 'L' mode
    - threshold: apply simple binary thresholding (after grayscale)

    Returns a new PIL.Image instance ready for OCR.
    """
    try:
        from PIL import ImageOps, ImageFilter, Image
    except Exception:
        return image

    img = image.copy()

    # Optional resize (scale up for small images)
    if resize_to:
        try:
            target_w, target_h = resize_to
            if target_w and not target_h:
                w_percent = target_w / float(img.width)
                target_h = int(float(img.height) * float(w_percent))
            img = img.resize((target_w, target_h), Image.LANCZOS)
        except Exception:
            pass

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
            # Simple adaptive threshold: use a fixed threshold after converting to L
            thresh = 160
            img = img.point(lambda p: 255 if p > thresh else 0)
        except Exception:
            pass

    # Optional slight blur/denoise (uncomment if desired)
    # try:
    #     img = img.filter(ImageFilter.MedianFilter(size=3))
    # except Exception:
    #     pass

    return img

def run_easyocr_on_image(image_path, languages=['en'], gpu=False, preprocess=False, resize_width=None, threshold=False):
    """
    Run EasyOCR on an image file and return a tuple (concatenated_text, detailed_results).

    - image_path: path to an image file (PNG/JPG/etc.) or a file-like object supported by easyocr.
    - languages: list of language codes for EasyOCR (default ['en'])
    - gpu: whether to use GPU (default False)
    - preprocess: whether to run simple preprocessing to improve OCR quality
    - resize_width: if set, scale image to this width before OCR (helps small PDFs)
    - threshold: whether to apply binary thresholding during preprocessing

    Returns:
      (text, results) where:
        - text is the concatenated OCR text (or None on failure)
        - results is the raw EasyOCR result list of (bbox, text, confidence)
    """
    try:
        import easyocr
    except Exception as e:
        logger.error(f"EasyOCR import failed: {e}")
        return None, []

    try:
        reader = easyocr.Reader(languages, gpu=gpu)
    except Exception as e:
        logger.error(f"Failed to initialize EasyOCR Reader: {e}", exc_info=True)
        return None, []

    # If preprocessing requested and image is a path, load and preprocess then pass temporary file to reader
    tmp_path = None
    try:
        if preprocess:
            from PIL import Image
            img = Image.open(image_path).convert("RGB")
            resize_to = (resize_width, None) if resize_width else None
            img = _preprocess_pil_image_for_ocr(img, resize_to=resize_to, threshold=threshold)
            import tempfile
            with tempfile.NamedTemporaryFile(delete=False, suffix=".png") as tmp_img:
                img.save(tmp_img, format="PNG")
                tmp_path = tmp_img.name
            target_for_reader = tmp_path
        else:
            target_for_reader = image_path

        results = reader.readtext(target_for_reader, detail=1)
        if not results:
            return "", []
        texts = [r[1] for r in results if len(r) > 1]
        concatenated = "\n".join(texts)
        return concatenated, results
    except Exception as e:
        logger.error(f"EasyOCR recognition failed for {image_path}: {e}", exc_info=True)
        return None, []
    finally:
        if tmp_path:
            try:
                os.remove(tmp_path)
            except Exception:
                pass

def run_easyocr_on_pdf_all_pages(pdf_path, languages=['en'], gpu=False, dpi=200):
    """
    Run EasyOCR on all pages of a PDF and return a list of page OCR results.

    Returns a list of dicts:
      [{"page_number": 1, "text": "...", "results": [...], "image_bytes": b"..."}, ...]

    - pdf_path: path to the PDF file
    - languages: list of language codes for EasyOCR
    - gpu: whether to use GPU
    - dpi: rendering DPI for page images (higher DPI improves OCR accuracy)
    """
    pages_output = []
    try:
        import easyocr
    except Exception as e:
        logger.error(f"EasyOCR import failed: {e}", exc_info=True)
        return pages_output

    try:
        reader = easyocr.Reader(languages, gpu=gpu)
    except Exception as e:
        logger.error(f"Failed to initialize EasyOCR Reader: {e}", exc_info=True)
        return pages_output

    doc = None
    try:
        if not os.path.exists(pdf_path):
            logger.error(f"PDF file not found for multi-page OCR: {pdf_path}")
            return pages_output

        doc = fitz.open(pdf_path)
        if len(doc) == 0:
            logger.error(f"PDF has no pages for multi-page OCR: {pdf_path}")
            return pages_output

        for page_index in range(len(doc)):
            try:
                page = doc.load_page(page_index)
                # Render at requested DPI
                try:
                    pix = page.get_pixmap(dpi=dpi)
                except TypeError:
                    # Older pymupdf versions may use matrix instead
                    mat = fitz.Matrix(dpi / 72.0, dpi / 72.0)
                    pix = page.get_pixmap(matrix=mat)

                # Convert to PIL image
                image = Image.frombytes("RGB", [pix.width, pix.height], pix.samples)

                # Optional preprocessing could be added here (grayscale, thresholding)

                # Save to bytes for easyocr and return
                from io import BytesIO
                buf = BytesIO()
                image.save(buf, format="PNG")
                image_bytes = buf.getvalue()
                buf.seek(0)

                # easyocr can accept numpy arrays or image file paths; pass bytes via PIL image
                # Use a temporary file to avoid format issues with reader
                import tempfile
                with tempfile.NamedTemporaryFile(delete=False, suffix=".png") as tmp_img:
                    tmp_img.write(image_bytes)
                    tmp_img_path = tmp_img.name

                try:
                    results = reader.readtext(tmp_img_path, detail=1)
                except Exception as rr:
                    logger.error(f"EasyOCR failed on page {page_index+1}: {rr}", exc_info=True)
                    results = []

                # Remove temp file
                try:
                    os.remove(tmp_img_path)
                except Exception:
                    pass

                texts = [r[1] for r in results if len(r) > 1]
                concatenated = "\n".join(texts) if texts else ""

                pages_output.append({
                    "page_number": page_index + 1,
                    "text": concatenated,
                    "results": results,
                    "image_bytes": image_bytes,
                })

            except Exception as page_e:
                logger.error(f"Error processing page {page_index+1} for OCR: {page_e}", exc_info=True)
                continue

    except Exception as e:
        logger.error(f"Failed to run multi-page EasyOCR on PDF {pdf_path}: {e}", exc_info=True)
    finally:
        if doc:
            try:
                doc.close()
            except Exception as close_e:
                logger.error(f"Error closing PDF document '{pdf_path}': {close_e}")
    return pages_output