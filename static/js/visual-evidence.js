/**
 * Visual Evidence Module - Handles showing visual grounding evidence
 */

class VisualEvidence {
  constructor() {
    const modalElement = document.getElementById('visualGroundingModal');
    if (modalElement) {
      try {
        this.modal = new bootstrap.Modal(modalElement);
        this._setupEventListeners();
      } catch (e) {
        console.error("Error initializing Bootstrap Modal for VisualEvidence:", e);
        this.modal = null; // Ensure modal is null if initialization fails
      }
    } else {
      console.warn("Visual grounding modal element (#visualGroundingModal) not found. VisualEvidence will not be fully functional.");
      this.modal = null;
    }
  }

  _setupEventListeners() {
    if (!this.modal) return; // Don't set up listeners if modal isn't initialized

    document.addEventListener('click', (e) => {
      const button = e.target.closest('.visual-grounding-btn');
      if (button) {
        this.show(
          button.dataset.doclingJsonPath,
          button.dataset.pageNo,
          button.dataset.bbox,
          button.dataset.documentId
        );
      }
    });

    document.getElementById('downloadEvidenceBtn')?.addEventListener('click', this._downloadEvidence.bind(this));
    document.getElementById('copyEvidenceBtn')?.addEventListener('click', this._copyEvidence.bind(this));
  }

  show(doclingJsonPath, pageNo, bbox, documentId) {
    if (!this.modal) return; // Do nothing if modal isn't initialized

    const img = document.getElementById('visualGroundingImage');
    const meta = document.getElementById('visualGroundingMeta');
    const error = document.getElementById('visualGroundingError');

    // Reset state
    error.style.display = 'none';
    img.style.display = 'none';

    // Show loading state
    this.modal.show();

    // Fetch and display image
    fetch(`/api/visual_evidence?docling_json_path=${doclingJsonPath}&page_no=${pageNo}&bbox=${bbox}&document_id=${documentId}`)
      .then(response => {
        if (!response.ok) throw new Error('Failed to load image');
        return response.blob();
      })
      .then(blob => {
        const url = URL.createObjectURL(blob);
        img.src = url;
        img.style.display = 'block';
        
        // Set metadata
        meta.querySelector('.evidence-meta-source').textContent = documentId;
        meta.querySelector('.evidence-meta-page').textContent = `Page ${pageNo}`;
        meta.querySelector('.evidence-meta-snippet').textContent = bbox;
      })
      .catch(err => {
        console.error('Visual evidence error:', err);
        error.style.display = 'block';
        error.textContent = err.message;
      });
  }

  _downloadEvidence() {
    if (!this.modal) return;

    const img = document.getElementById('visualGroundingImage');
    if (!img.src) return;

    const a = document.createElement('a');
    a.href = img.src;
    a.download = 'evidence.png';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }

  _copyEvidence() {
    if (!this.modal) return;

    const img = document.getElementById('visualGroundingImage');
    if (!img.src) return;

    fetch(img.src)
      .then(res => res.blob())
      .then(blob => navigator.clipboard.write([new ClipboardItem({'image/png': blob})]))
      .then(() => showToast('Image copied to clipboard', 'success'))
      .catch(err => {
        console.error('Copy image error:', err);
        showToast('Failed to copy image', 'danger');
      });
  }
}

// Initialize if not in module system
if (typeof module === 'undefined') {
  document.addEventListener('DOMContentLoaded', function() {
    window.visualEvidence = new VisualEvidence();
  });
}
