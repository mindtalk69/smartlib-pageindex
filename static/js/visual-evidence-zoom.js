document.addEventListener('DOMContentLoaded', function() {
  // Enable zoom on the visual evidence image when modal is shown
  var zoomInstance = null;
  var modal = document.getElementById('visualEvidenceModal'); // Corrected ID
  var image = document.getElementById('visualEvidenceImage'); // Corrected ID
  if (modal && image && window.mediumZoom) {
    modal.addEventListener('shown.bs.modal', function() {
      if (zoomInstance) zoomInstance.detach();
      zoomInstance = mediumZoom(image, {
        background: 'rgba(30,40,60,0.85)',
        margin: 24,
        scrollOffset: 40
      });
    });
    modal.addEventListener('hidden.bs.modal', function() {
      if (zoomInstance) zoomInstance.detach();
    });
  }
});
