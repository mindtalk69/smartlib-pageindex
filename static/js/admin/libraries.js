document.addEventListener('DOMContentLoaded', function () {
  // Modal and form elements
  const modalEl = document.getElementById('libraryModal');
  if (!modalEl) return;
  const libraryModal = new bootstrap.Modal(modalEl);
  const form = document.getElementById('libraryForm');
  const inputId = document.getElementById('library_id');
  const inputName = document.getElementById('libraryName');
  const inputDesc = document.getElementById('libraryDescription');
  const alertPlaceholder = document.getElementById('modalAlertPlaceholder');
  const inputKnowledge = document.getElementById('libraryKnowledge');

  function showAlert(message, type = 'danger') {
    alertPlaceholder.innerHTML = `
      <div class="alert alert-${type} alert-dismissible" role="alert">
        ${message}
        <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
      </div>`;
  }

  // "Add New Library" button
  document.getElementById('addLibraryBtn').addEventListener('click', () => {
    form.reset();
    inputId.value = '';
    form.dataset.editId = '';
    alertPlaceholder.innerHTML = '';
    inputKnowledge.value = '';
    document.getElementById('libraryModalLabel').textContent = 'Add Library';
  });

  // "Edit" buttons in table
  $('#librariesTable').on('click', '.edit-btn', async function () {
    const id = $(this).data('id');
    form.reset();
    alertPlaceholder.innerHTML = '';
    form.dataset.editId = id;
    document.getElementById('libraryModalLabel').textContent = 'Edit Library';
    try {
      const res = await fetch(`/admin/libraries/data/${id}`);
      if (!res.ok) throw new Error(res.statusText);
      const data = await res.json();
      inputId.value = id;
      inputName.value = data.name || '';
      inputDesc.value = data.description || '';
      // Set knowledge select (assume only one associated knowledge for now)
      if (data.knowledges && Array.isArray(data.knowledges) && data.knowledges.length > 0) {
        inputKnowledge.value = data.knowledges[0].id;
      } else {
        inputKnowledge.value = '';
      }
    } catch (e) {
      console.error('Failed to load library data:', e);
      showAlert('Failed to load library data.');
    }
    libraryModal.show();
  });

  // Initialize DataTable (disable sorting on Actions column)
  $('#librariesTable').DataTable({
    columnDefs: [{ orderable: false, targets: 6 }] // Actions is now column 7 (index 6)
  });

  // Explicit form submission for add/edit library
  form.addEventListener('submit', async function (event) {
    event.preventDefault();
    const editId = form.dataset.editId;
    const url = editId ? `/admin/libraries/edit/${editId}` : '/admin/libraries/add';
    const payload = {
      name: inputName.value.trim(),
      description: inputDesc.value.trim(),
      knowledge_id: inputKnowledge.value ? parseInt(inputKnowledge.value) : null
    };
    try {
      const res = await fetch(url, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRFToken': document.querySelector('meta[name="csrf-token"]').getAttribute('content')
        },
        body: JSON.stringify(payload)
      });
      const result = await res.json();
      console.log('Library save API result:', result);
      if (res.ok && result.status === 'success') {
        libraryModal.hide();
        location.reload();
      } else {
        showAlert(result.message || 'Save failed.');
      }
    } catch (err) {
      console.error('Save error:', err);
      showAlert('An error occurred.');
    }
  });
});
