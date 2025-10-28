document.addEventListener('DOMContentLoaded', () => {
    const catalogModalElement = document.getElementById('catalogModal');
    if (!catalogModalElement) {
        console.error('Catalog modal element not found!');
        return;
    }

    const catalogModal = new bootstrap.Modal(catalogModalElement);
    const catalogForm = document.getElementById('catalogForm');
    const catalogModalLabel = document.getElementById('catalogModalLabel');
    const catalogIdInput = document.getElementById('catalogId');
    const catalogNameInput = document.getElementById('catalogName');
    const catalogDescriptionInput = document.getElementById('catalogDescription');
    const saveCatalogBtn = document.getElementById('saveCatalogBtn');
    const addCatalogBtn = document.getElementById('addCatalogBtn');
    const catalogsTable = document.getElementById('catalogsTable');
    const catalogsTableBody = catalogsTable ? catalogsTable.querySelector('tbody') : null;
    const formErrorElement = document.getElementById('formError');
    const generateDescBtn = document.getElementById('generateDescBtn');
    const csrfToken = document.querySelector('meta[name="csrf-token"]')?.getAttribute('content');

    if (!catalogForm || !catalogsTable || !catalogsTableBody) {
        console.error('Catalog form or table elements missing.');
        return;
    }

    let currentEditId = null;

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

    function normalizeCatalog(raw) {
        if (!raw || typeof raw !== 'object') {
            return null;
        }
        const id = raw.id ?? raw.catalog_id ?? null;
        return {
            id,
            name: raw.name ?? '',
            description: raw.description ?? '',
            createdBy: raw.created_by_username ?? raw.creator_name ?? 'N/A',
            createdAt: raw.created_at ?? raw.createdAt ?? null,
        };
    }

    function createTableRow(catalog) {
        const normalized = normalizeCatalog(catalog);
        if (!normalized || !normalized.id) {
            return document.createElement('tr');
        }

        const tr = document.createElement('tr');
        tr.dataset.id = normalized.id;

        const numberCell = document.createElement('td');
        numberCell.classList.add('row-number');
        tr.appendChild(numberCell);

        const nameCell = document.createElement('td');
        nameCell.classList.add('catalog-name');
        nameCell.textContent = normalized.name;
        tr.appendChild(nameCell);

        const descriptionCell = document.createElement('td');
        descriptionCell.classList.add('catalog-description');
        descriptionCell.title = normalized.description;
        descriptionCell.textContent = normalized.description
            ? `${normalized.description.slice(0, 80)}${normalized.description.length > 80 ? '...' : ''}`
            : '';
        tr.appendChild(descriptionCell);

        const createdByCell = document.createElement('td');
        createdByCell.classList.add('catalog-created-by');
        createdByCell.textContent = normalized.createdBy || 'N/A';
        tr.appendChild(createdByCell);

        const createdAtCell = document.createElement('td');
        createdAtCell.classList.add('catalog-created-at');
        createdAtCell.textContent = formatDate(normalized.createdAt);
        tr.appendChild(createdAtCell);

        const actionsCell = document.createElement('td');
        const actionWrapper = document.createElement('div');
        actionWrapper.classList.add('action-buttons');

        const editButton = document.createElement('button');
        editButton.className = 'btn btn-sm btn-warning edit-btn';
        editButton.dataset.id = normalized.id;
        editButton.title = 'Edit Catalog';
        editButton.innerHTML = '<i class="bi bi-pencil-fill"></i>';

        const deleteButton = document.createElement('button');
        deleteButton.className = 'btn btn-sm btn-danger delete-btn';
        deleteButton.dataset.id = normalized.id;
        deleteButton.dataset.name = normalized.name;
        deleteButton.title = 'Delete Catalog';
        deleteButton.innerHTML = '<i class="bi bi-trash-fill"></i>';

        actionWrapper.appendChild(editButton);
        actionWrapper.appendChild(deleteButton);
        actionsCell.appendChild(actionWrapper);
        tr.appendChild(actionsCell);

        return tr;
    }

    function updateTableRow(catalog) {
        const normalized = normalizeCatalog(catalog);
        if (!normalized || !normalized.id) {
            return;
        }
        const row = catalogsTableBody.querySelector(`tr[data-id="${normalized.id}"]`);
        if (!row) {
            return;
        }
        const nameCell = row.querySelector('.catalog-name');
        if (nameCell) {
            nameCell.textContent = normalized.name;
        }
        const descriptionCell = row.querySelector('.catalog-description');
        if (descriptionCell) {
            descriptionCell.title = normalized.description;
            descriptionCell.textContent = normalized.description
                ? `${normalized.description.slice(0, 80)}${normalized.description.length > 80 ? '...' : ''}`
                : '';
        }
        const createdByCell = row.querySelector('.catalog-created-by');
        if (createdByCell) {
            createdByCell.textContent = normalized.createdBy || 'N/A';
        }
        const createdAtCell = row.querySelector('.catalog-created-at');
        if (createdAtCell) {
            createdAtCell.textContent = formatDate(normalized.createdAt);
        }
    }

    function refreshRowNumbers() {
        const rows = catalogsTableBody.querySelectorAll('tr[data-id]');
        rows.forEach((row, index) => {
            const numberCell = row.querySelector('.row-number') || row.firstElementChild;
            if (numberCell) {
                numberCell.textContent = index + 1;
            }
        });
    }

    function clearForm() {
        catalogForm.reset();
        catalogForm.classList.remove('was-validated');
        catalogIdInput.value = '';
        currentEditId = null;
        catalogModalLabel.textContent = 'Add Catalog';
        saveCatalogBtn.textContent = 'Save Catalog';
        hideFormError();
    }

    function showFormError(message) {
        if (!formErrorElement) {
            alert(message);
            return;
        }
        formErrorElement.textContent = message;
        formErrorElement.style.display = 'block';
    }

    function hideFormError() {
        if (!formErrorElement) {
            return;
        }
        formErrorElement.textContent = '';
        formErrorElement.style.display = 'none';
    }

    function showFeedback(message) {
        alert(message);
    }

    function handleAddClick() {
        clearForm();
        catalogModal.show();
    }

    async function handleEditClick(button) {
        clearForm();
        const catalogId = button.dataset.id;
        if (!catalogId) {
            showFeedback('Unable to determine catalog ID for editing.');
            return;
        }
        currentEditId = catalogId;
        catalogModalLabel.textContent = 'Edit Catalog';
        saveCatalogBtn.textContent = 'Update Catalog';
        try {
            const response = await fetch(`/admin/catalogs/data/${catalogId}`);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const catalog = await response.json();
            const normalized = normalizeCatalog(catalog);
            if (!normalized) {
                throw new Error('Invalid catalog data received.');
            }
            catalogIdInput.value = normalized.id;
            catalogNameInput.value = normalized.name;
            catalogDescriptionInput.value = normalized.description;
            catalogModal.show();
        } catch (error) {
            console.error('Error fetching catalog data:', error);
            showFeedback(`Failed to load catalog: ${error.message}`);
            currentEditId = null;
        }
    }

    function ensurePlaceholderRow() {
        if (catalogsTableBody.querySelector('tr[data-id]')) {
            return;
        }
        catalogsTableBody.innerHTML =
            '<tr><td colspan="6" class="text-center">No catalogs found.</td></tr>';
    }

    async function handleDeleteClick(button) {
        const catalogId = button.dataset.id;
        const catalogName = button.dataset.name || 'selected catalog';
        if (!catalogId) {
            return;
        }
        if (!confirm(`Are you sure you want to delete "${catalogName}"?`)) {
            return;
        }
        try {
            const response = await fetch(`/admin/catalogs/delete/${catalogId}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...(csrfToken ? { 'X-CSRFToken': csrfToken } : {}),
                },
            });
            const result = await response.json();
            if (response.ok && result.status === 'success') {
                const row = catalogsTableBody.querySelector(`tr[data-id="${catalogId}"]`);
                if (row) {
                    row.remove();
                }
                ensurePlaceholderRow();
                refreshRowNumbers();
            } else {
                throw new Error(result.message || 'Failed to delete catalog.');
            }
        } catch (error) {
            console.error('Error deleting catalog:', error);
            showFeedback(`Error: ${error.message}`);
        }
    }

    async function handleFormSubmit(event) {
        event.preventDefault();
        catalogForm.classList.add('was-validated');
        hideFormError();

        const catalogData = {
            name: catalogNameInput.value.trim(),
            description: catalogDescriptionInput.value.trim(),
        };

        if (!catalogData.name) {
            showFormError('Catalog name is required.');
            return;
        }

        const url = currentEditId
            ? `/admin/catalogs/edit/${currentEditId}`
            : '/admin/catalogs/add';

        saveCatalogBtn.disabled = true;
        try {
            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...(csrfToken ? { 'X-CSRFToken': csrfToken } : {}),
                },
                body: JSON.stringify(catalogData),
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
                    showFormError('Unexpected server response. Please refresh and retry.');
                    return;
                }
            }

            if (response.ok && result.status === 'success') {
                catalogModal.hide();
                showFeedback(result.message || `Catalog ${currentEditId ? 'updated' : 'added'} successfully.`);
                const returnedCatalog = result.catalog;
                if (returnedCatalog) {
                    if (currentEditId) {
                        updateTableRow(returnedCatalog);
                    } else {
                        const placeholderRow = catalogsTableBody.querySelector('td[colspan="6"]');
                        if (placeholderRow) {
                            placeholderRow.parentElement.remove();
                        }
                        const newRow = createTableRow(returnedCatalog);
                        catalogsTableBody.appendChild(newRow);
                    }
                    refreshRowNumbers();
                    clearForm();
                } else {
                    window.location.reload();
                }
            } else {
                throw new Error(result.message || `Failed to ${currentEditId ? 'update' : 'add'} catalog.`);
            }
        } catch (error) {
            console.error('Error saving catalog:', error);
            showFormError(`Error: ${error.message}`);
        } finally {
            saveCatalogBtn.disabled = false;
        }
    }

    if (addCatalogBtn) {
        addCatalogBtn.addEventListener('click', handleAddClick);
    }

    catalogForm.addEventListener('submit', handleFormSubmit);

    catalogsTable.addEventListener('click', (event) => {
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
        generateDescBtn.addEventListener('click', async () => {
            const name = catalogNameInput.value.trim();
            if (!name) {
                showFormError('Please enter a catalog name before generating a description.');
                return;
            }
            hideFormError();
            const spinner = generateDescBtn.querySelector('.spinner-border');
            generateDescBtn.disabled = true;
            if (spinner) {
                spinner.classList.remove('d-none');
            }
            try {
                const response = await fetch('/admin/generate-description', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        ...(csrfToken ? { 'X-CSRFToken': csrfToken } : {}),
                    },
                    body: JSON.stringify({
                        context_text: name,
                        item_type: 'catalog',
                        deployment_name: 'gpt-4o-mini',
                        catalog_names: [],
                    }),
                });
                const result = await response.json();
                if (response.ok && result.status === 'success' && result.description) {
                    catalogDescriptionInput.value = result.description;
                } else {
                    throw new Error(result.message || 'Failed to generate description.');
                }
            } catch (error) {
                showFormError(`Error generating description: ${error.message}`);
            } finally {
                generateDescBtn.disabled = false;
                if (spinner) {
                    spinner.classList.add('d-none');
                }
            }
        });
    }

    refreshRowNumbers();
});
