I have to explain to you since we have to add these feature as an option while user want to upload.

1. since these features need gpu capabilities to make performance better, I suppose it has an option if we execute or not
2. I give a sample on how the code works :


### Document loading

1. We first define our converter, in this case including options for keeping page images (for visual grounding).

```
from docling.datamodel.base_models import InputFormat
from docling.datamodel.pipeline_options import PdfPipelineOptions
from docling.document_converter import DocumentConverter, PdfFormatOption

converter = DocumentConverter(
    format_options={
        InputFormat.PDF: PdfFormatOption(
            pipeline_options=PdfPipelineOptions(
                generate_page_images=True,
                images_scale=2.0,
            ),
        )
    }
)

```

2. We set up a simple doc store for keeping converted documents, as that is needed for visual grounding further below.

```
doc_store = {}
doc_store_root = Path(mkdtemp())
for source in SOURCES:
    dl_doc = converter.convert(source=source).document
    file_path = Path(doc_store_root / f"{dl_doc.origin.binary_hash}.json")
    dl_doc.save_as_json(file_path)
    doc_store[dl_doc.origin.binary_hash] = file_path
```

3. Now we can instantiate our loader and load documents.

NOTE: already implemented in the code

```
from langchain_docling import DoclingLoader

from docling.chunking import HybridChunker

loader = DoclingLoader(
    file_path=SOURCES,
    converter=converter,
    export_type=ExportType.DOC_CHUNKS,
    chunker=HybridChunker(tokenizer=EMBED_MODEL_ID),
)

docs = loader.load()

```

the rest assume its applied to vector store the same as we did now


4. How to make visual grounding appear ?

- this will show in index.html
- for enable grounding it shall have an options if the upload also applied (depend on users give a parameter default no, since we have to add this param to endpoint upload)
- automaticly docling when add to document in faiss the metadata also save to used in loaded in show visual grounding capabilities.
- the metadata still complex 

sample metadata: 
visual grounding use 'dl_meta' as based to draw in the screen

metadata={'source': 'data_user/uploads/MAP FOLDER-01.pdf', 'dl_meta': {'schema_name': 'docling_core.transforms.chunker.DocMeta', 'version': '1.0.0', 'doc_items': [{'self_ref': '#/texts/1', 'parent': {'$ref': '#/body'}, 'children': [], 'content_layer': 'body', 'label': 'text', 'prov': [{'page_no': 1, 'bbox': {'l': 39.333333333333336, 't': 140.62668863932288, 'r': 559.0, 'b': 85.62668863932288, 'coord_origin': 'BOTTOMLEFT'}, 'charspan': [0, 380]}]}, {'self_ref': '#/texts/2', 'parent': {'$ref': '#/body'}, 'children': [], 'content_layer': 'body', 'label': 'text', 'prov': [{'page_no': 1, 'bbox': {'l': 645.0, 't': 750.9600219726562, 'r': 900.6666666666666, 'b': 722.9600219726562, 'coord_origin': 'BOTTOMLEFT'}, 'charspan': [0, 56]}]}, {'self_ref': '#/texts/4', 'parent': {'$ref': '#/body'}, 'children': [], 'content_layer': 'body', 'label': 'text', 'prov': [{'page_no': 1, 'bbox': {'l': 650.3333333333334, 't': 81.29335530598962, 'r': 712.6666666666666, 'b': 64.96002197265625, 'coord_origin': 'BOTTOMLEFT'}, 'charspan': [0, 6]}]}, {'self_ref': '#/texts/5', 'parent': {'$ref': '#/body'}, 'children': [], 'content_layer': 'body', 'label': 'text', 'prov': [{'page_no': 1, 'bbox': {'l': 1045.3333333333333, 't': 106.29335530598962, 'r': 1202.3333333333333, 'b': 56.29335530598962, 'coord_origin': 'BOTTOMLEFT'}, 'charspan': [0, 35]}]}], 'origin': {'mimetype': 'application/pdf', 'binary_hash': 6399133110736973633, 'filename': 'MAP FOLDER-01.pdf'}}}

```
import matplotlib.pyplot as plt
from PIL import ImageDraw

for i, doc in enumerate(resp_dict["context"][:]):
    image_by_page = {}
    print(f"Source {i+1}:")
    print(f"  text: {json.dumps(clip_text(doc.page_content, threshold=350))}")
    meta = DocMeta.model_validate(doc.metadata["dl_meta"])

    # loading the full DoclingDocument from the document store:
    dl_doc = DoclingDocument.load_from_json(doc_store.get(meta.origin.binary_hash))

    for doc_item in meta.doc_items:
        if doc_item.prov:
            prov = doc_item.prov[0]  # here we only consider the first provenence item
            page_no = prov.page_no
            if img := image_by_page.get(page_no):
                pass
            else:
                page = dl_doc.pages[prov.page_no]
                print(f"  page: {prov.page_no}")
                img = page.image.pil_image
                image_by_page[page_no] = img
            bbox = prov.bbox.to_top_left_origin(page_height=page.size.height)
            bbox = bbox.normalized(page.size)
            thickness = 2
            padding = thickness + 2
            bbox.l = round(bbox.l * img.width - padding)
            bbox.r = round(bbox.r * img.width + padding)
            bbox.t = round(bbox.t * img.height - padding)
            bbox.b = round(bbox.b * img.height + padding)
            draw = ImageDraw.Draw(img)
            draw.rectangle(
                xy=bbox.as_tuple(),
                outline="blue",
                width=thickness,
            )
    for p in image_by_page:
        img = image_by_page[p]
        plt.figure(figsize=[15, 15])
        plt.imshow(img)
        plt.axis("off")
        plt.show()

```