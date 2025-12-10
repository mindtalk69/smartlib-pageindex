document.addEventListener('DOMContentLoaded', () => {
    const csrfMeta = document.querySelector('meta[name="csrf-token"]');
    const csrfToken = csrfMeta ? csrfMeta.getAttribute('content') : null;
    const libraryModalElement = document.getElementById('libraryModal');

    if (!libraryModalElement) {
        console.error('Library modal element not found!');
        return;
    }

    const libraryModal = new bootstrap.Modal(libraryModalElement);
    const libraryForm = document.getElementById('libraryForm');
    const modalTitle = document.getElementById('libraryModalLabel');
    const libraryIdInput = document.getElementById('library_id');
    const libraryNameInput = document.getElementById('libraryName');
    const libraryDescriptionInput = document.getElementById('libraryDescription');
    const generateDescBtn = document.getElementById('generateDescBtn');
    const saveLibraryBtn = document.getElementById('saveLibraryBtn');
    const addLibraryBtn = document.getElementById('addLibraryBtn');
    const modalAlertPlaceholder = document.getElementById('modalAlertPlaceholder');
    const librariesTable = document.getElementById('librariesTable');
    const librariesTableBody = librariesTable ? librariesTable.querySelector('tbody') : null;

    if (!libraryForm || !librariesTable || !librariesTableBody) {
        console.error('Library form or table elements missing.');
        return;
    }

    let currentEditId = null;

    function truncateText(text, maxLength = 80) {
        if (!text) {
            return '';
        }
        if (text.length <= maxLength) {
            return text;
        }
        return `${text.slice(0, maxLength)}...`;
    }

    function formatDate(value) {
        if (!value) {
            return 'N/A';
        }
        const date = new Date(value);
        if (Number.isNaN(date.getTime())) {
            return typeof value === 'string' ? value : 'N/A';
        }
        return date.toLocaleString();
    }

    function normalizeLibrary(raw) {
        if (!raw || typeof raw !== 'object') {
            return null;
        }
        const id = raw.library_id ?? raw.libraryId ?? raw.id ?? null;
        const knowledgeNamesSource = raw.knowledge_names ?? raw.knowledgeNames ?? raw.knowledges ?? [];
        const knowledgeNames = Array.isArray(knowledgeNamesSource)
            ? knowledgeNamesSource
                .map((entry) => {
                    if (typeof entry === 'string') {
                        return entry;
                    }
                    if (entry && typeof entry === 'object' && 'name' in entry) {
                        return entry.name;
                    }
                    return null;
                })
                .filter(Boolean)
            : [];

        return {
            id,
            name: raw.name ?? '',
            description: raw.description ?? '',
            knowledgeNames,
            createdBy: raw.created_by_username ?? raw.created_by ?? raw.createdBy ?? 'N/A',
            createdAt: raw.created_at ?? raw.createdAt ?? null,
        };
    }

    function renderKnowledgeBadges(names) {
        if (!names || names.length === 0) {
            return '<span class="text-muted">None</span>';
        }
        return names
            .map(
                (name) =>
                    `<span class="badge rounded-pill bg-info text-dark me-1">${name}</span>`,
            )
            .join('');
    }

    function createTableRow(library) {
        const normalized = normalizeLibrary(library);
        if (!normalized || !normalized.id) {
            return document.createElement('tr');
        }

        const tr = document.createElement('tr');
        tr.dataset.id = normalized.id;
        tr.id = `libraryRow-${normalized.id}`;

        const numberCell = document.createElement('td');
        numberCell.classList.add('row-number');
        tr.appendChild(numberCell);

        const nameCell = document.createElement('td');
        nameCell.classList.add('library-name');
        nameCell.textContent = normalized.name;
        tr.appendChild(nameCell);

        const descriptionCell = document.createElement('td');
        descriptionCell.classList.add('library-description');
        descriptionCell.title = normalized.description;
        descriptionCell.textContent = truncateText(normalized.description);
        tr.appendChild(descriptionCell);

        const knowledgeCell = document.createElement('td');
        knowledgeCell.classList.add('library-knowledges');
        knowledgeCell.innerHTML = renderKnowledgeBadges(normalized.knowledgeNames);
        tr.appendChild(knowledgeCell);

        const createdByCell = document.createElement('td');
        createdByCell.classList.add('library-created-by');
        createdByCell.textContent = normalized.createdBy || 'N/A';
        tr.appendChild(createdByCell);

        const createdAtCell = document.createElement('td');
        createdAtCell.classList.add('library-created-at');
        createdAtCell.textContent = formatDate(normalized.createdAt);
        tr.appendChild(createdAtCell);

        const actionsCell = document.createElement('td');
        const actionWrapper = document.createElement('div');
        actionWrapper.classList.add('action-buttons');

        const editBtn = document.createElement('button');
        editBtn.className = 'btn btn-sm btn-warning edit-btn';
        editBtn.dataset.id = normalized.id;
        editBtn.title = 'Edit Library';
        editBtn.innerHTML = '<i class="bi bi-pencil-fill"></i>';

        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'btn btn-sm btn-danger delete-btn';
        deleteBtn.dataset.id = normalized.id;
        deleteBtn.dataset.name = normalized.name;
        deleteBtn.title = 'Delete Library';
        deleteBtn.innerHTML = '<i class="bi bi-trash-fill"></i>';

        actionWrapper.appendChild(editBtn);
        actionWrapper.appendChild(deleteBtn);
        actionsCell.appendChild(actionWrapper);
        tr.appendChild(actionsCell);

        return tr;
    }

    function updateTableRow(library) {
        const normalized = normalizeLibrary(library);
        if (!normalized || !normalized.id) {
            return;
        }
        const row = librariesTableBody.querySelector(`tr[data-id="${normalized.id}"]`);
        if (!row) {
            return;
        }
        const nameCell = row.querySelector('.library-name');
        if (nameCell) {
            nameCell.textContent = normalized.name;
        }
        const descriptionCell = row.querySelector('.library-description');
        if (descriptionCell) {
            descriptionCell.title = normalized.description;
            descriptionCell.textContent = truncateText(normalized.description);
        }
        const knowledgeCell = row.querySelector('.library-knowledges');
        if (knowledgeCell) {
            knowledgeCell.innerHTML = renderKnowledgeBadges(normalized.knowledgeNames);
        }
        const createdByCell = row.querySelector('.library-created-by');
        if (createdByCell) {
            createdByCell.textContent = normalized.createdBy || 'N/A';
        }
        const createdAtCell = row.querySelector('.library-created-at');
        if (createdAtCell) {
            createdAtCell.textContent = formatDate(normalized.createdAt);
        }
    }

    function refreshRowNumbers() {
        const rows = librariesTableBody.querySelectorAll('tr[data-id]');
        rows.forEach((row, index) => {
            const numberCell = row.querySelector('.row-number') || row.firstElementChild;
            if (numberCell) {
                numberCell.textContent = index + 1;
            }
        });
    }

    function clearModalForm() {
        libraryForm.reset();
        libraryForm.classList.remove('was-validated');
        modalAlertPlaceholder.innerHTML = '';
        currentEditId = null;
        libraryIdInput.value = '';
        modalTitle.textContent = 'Add Library';
        saveLibraryBtn.textContent = 'Save';
    }

    function showAlert(message, type = 'danger') {
        if (!modalAlertPlaceholder) {
            alert(message);
            return;
        }
        modalAlertPlaceholder.innerHTML = [
            `<div class="alert alert-${type} alert-dismissible" role="alert">`,
            `  <div>${message}</div>`,
            '  <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>',
            '</div>',
        ].join('');
    }

    function handleAddClick() {
        clearModalForm();
        libraryModal.show();
    }

    async function handleEditClick(button) {
        clearModalForm();
        const libraryId = button.dataset.id;
        if (!libraryId) {
            console.error('Library ID missing on edit button.');
            showAlert('Unable to load library for editing.');
            return;
        }
        currentEditId = libraryId;
        modalTitle.textContent = 'Edit Library';
        saveLibraryBtn.textContent = 'Update';
        try {
            const response = await fetch(`/admin/libraries/data/${libraryId}`);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const data = await response.json();
            const normalized = normalizeLibrary(data);
            if (!normalized) {
                throw new Error('Invalid library payload received.');
            }
            libraryIdInput.value = normalized.id;
            libraryNameInput.value = normalized.name;
            libraryDescriptionInput.value = normalized.description;
            libraryModal.show();
        } catch (error) {
            console.error('Error fetching library data:', error);
            showAlert(`Error loading library: ${error.message}`);
            currentEditId = null;
        }
    }

    function ensurePlaceholderRow() {
        if (librariesTableBody.querySelector('tr[data-id]')) {
            return;
        }
        librariesTableBody.innerHTML =
            '<tr><td colspan="7" class="text-center">No libraries found.</td></tr>';
    }

    async function handleDeleteClick(button) {
        const libraryId = button.dataset.id;
        const libraryName = button.dataset.name || 'selected library';
        if (!libraryId) {
            return;
        }
        if (!confirm(`Are you sure you want to delete "${libraryName}"?`)) {
            return;
        }
        try {
            const response = await fetch(`/admin/libraries/delete/${libraryId}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...(csrfToken ? { 'X-CSRFToken': csrfToken } : {}),
                },
            });
            const result = await response.json();
            if (response.ok && result.status === 'success') {
                const row = librariesTableBody.querySelector(`tr[data-id="${libraryId}"]`);
                if (row) {
                    row.remove();
                }
                ensurePlaceholderRow();
                refreshRowNumbers();
            } else {
                throw new Error(result.message || 'Failed to delete library.');
            }
        } catch (error) {
            console.error('Error deleting library:', error);
            alert(`Error deleting library: ${error.message}`);
        }
    }

    async function handleFormSubmit(event) {
        event.preventDefault();
        event.stopPropagation();

        if (!libraryForm.checkValidity()) {
            libraryForm.classList.add('was-validated');
            return;
        }

        const payload = {
            name: libraryNameInput.value.trim(),
            description: libraryDescriptionInput.value.trim(),
        };

        if (!payload.name) {
            showAlert('Library name is required.');
            return;
        }

        const url = currentEditId
            ? `/admin/libraries/edit/${currentEditId}`
            : '/admin/libraries/add';

        saveLibraryBtn.disabled = true;
        modalAlertPlaceholder.innerHTML = '';

        try {
            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...(csrfToken ? { 'X-CSRFToken': csrfToken } : {}),
                },
                body: JSON.stringify(payload),
            });

            let result;
            const contentType = response.headers.get('content-type');
            if (contentType && contentType.includes('application/json')) {
                result = await response.json();
            } else {
                const text = await response.text();
                try {
                    result = JSON.parse(text);
                } catch (parseError) {
                    showAlert('Unexpected server response. Please refresh and try again.');
                    return;
                }
            }

            if (response.ok && result.status === 'success') {
                libraryModal.hide();
                // Ensure modal backdrop is fully removed
                setTimeout(() => {
                    document.querySelectorAll('.modal-backdrop').forEach(el => el.remove());
                    document.body.classList.remove('modal-open');
                    document.body.style.overflow = '';
                    document.body.style.paddingRight = '';
                }, 150);
                alert(
                    result.message ||
                    `Library ${currentEditId ? 'updated' : 'added'} successfully.`,
                );
                const returnedLibrary = result.library;
                if (returnedLibrary) {
                    if (currentEditId) {
                        updateTableRow(returnedLibrary);
                    } else {
                        const placeholderRow = librariesTableBody.querySelector('td[colspan="7"]');
                        if (placeholderRow) {
                            placeholderRow.parentElement.remove();
                        }
                        const newRow = createTableRow(returnedLibrary);
                        librariesTableBody.appendChild(newRow);
                    }
                    refreshRowNumbers();
                    clearModalForm();
                } else {
                    window.location.reload();
                }
            } else {
                throw new Error(
                    result.message ||
                    `Failed to ${currentEditId ? 'update' : 'add'} library.`,
                );
            }
        } catch (error) {
            console.error('Error saving library:', error);
            showAlert(`Error: ${error.message}`);
        } finally {
            saveLibraryBtn.disabled = false;
        }
    }

    if (addLibraryBtn) {
        addLibraryBtn.addEventListener('click', handleAddClick);
    }

    libraryForm.addEventListener('submit', handleFormSubmit);

    librariesTable.addEventListener('click', (event) => {
        const editButton = event.target.closest('.edit-btn');
        if (editButton) {
            handleEditClick(editButton);
            return;
        }
        const deleteButton = event.target.closest('.delete-btn');
        if (deleteButton) {
            handleDeleteClick(deleteButton);
        }
    });

    if (generateDescBtn) {
        generateDescBtn.addEventListener('click', () => {
            const spinner = generateDescBtn.querySelector('.spinner-border');
            generateDescriptionForEntity({
                nameInput: libraryNameInput,
                descriptionInput: libraryDescriptionInput,
                itemType: 'library',
                alertPlaceholder: modalAlertPlaceholder,
                button: generateDescBtn,
                spinner,
                csrfToken,
            });
        });
    }

    refreshRowNumbers();
});
