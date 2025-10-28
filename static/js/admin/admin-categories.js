document.addEventListener('DOMContentLoaded', () => {
    const categoryModalElement = document.getElementById('categoryModal');
    if (!categoryModalElement) {
        console.error('Category modal element not found!');
        return;
    }

    const categoryModal = new bootstrap.Modal(categoryModalElement);
    const categoryForm = document.getElementById('categoryForm');
    const categoryModalLabel = document.getElementById('categoryModalLabel');
    const categoryIdInput = document.getElementById('categoryId');
    const categoryNameInput = document.getElementById('categoryName');
    const categoryDescriptionInput = document.getElementById('categoryDescription');
    const saveCategoryBtn = document.getElementById('saveCategoryBtn');
    const addCategoryBtn = document.getElementById('addCategoryBtn');
    const categoriesTable = document.getElementById('categoriesTable');
    const categoriesTableBody = categoriesTable ? categoriesTable.querySelector('tbody') : null;
    const formErrorElement = document.getElementById('formError');
    const generateDescBtn = document.getElementById('generateDescBtn');
    const csrfToken = document.querySelector('meta[name="csrf-token"]')?.getAttribute('content');

    if (!categoryForm || !categoriesTable || !categoriesTableBody) {
        console.error('Category form or table elements missing.');
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

    function normalizeCategory(raw) {
        if (!raw || typeof raw !== 'object') {
            return null;
        }
        const id = raw.id ?? raw.category_id ?? null;
        return {
            id,
            name: raw.name ?? '',
            description: raw.description ?? '',
            createdBy: raw.created_by_username ?? raw.creator_name ?? 'N/A',
            createdAt: raw.created_at ?? raw.createdAt ?? null,
        };
    }

    function createTableRow(category) {
        const normalized = normalizeCategory(category);
        if (!normalized || !normalized.id) {
            return document.createElement('tr');
        }

        const tr = document.createElement('tr');
        tr.dataset.id = normalized.id;

        const numberCell = document.createElement('td');
        numberCell.classList.add('row-number');
        tr.appendChild(numberCell);

        const nameCell = document.createElement('td');
        nameCell.classList.add('category-name');
        nameCell.textContent = normalized.name;
        tr.appendChild(nameCell);

        const descriptionCell = document.createElement('td');
        descriptionCell.classList.add('category-description');
        descriptionCell.title = normalized.description;
        descriptionCell.textContent = normalized.description
            ? `${normalized.description.slice(0, 80)}${normalized.description.length > 80 ? '...' : ''}`
            : '';
        tr.appendChild(descriptionCell);

        const createdByCell = document.createElement('td');
        createdByCell.classList.add('category-created-by');
        createdByCell.textContent = normalized.createdBy || 'N/A';
        tr.appendChild(createdByCell);

        const createdAtCell = document.createElement('td');
        createdAtCell.classList.add('category-created-at');
        createdAtCell.textContent = formatDate(normalized.createdAt);
        tr.appendChild(createdAtCell);

        const actionsCell = document.createElement('td');
        const actionWrapper = document.createElement('div');
        actionWrapper.classList.add('action-buttons');

        const editButton = document.createElement('button');
        editButton.className = 'btn btn-sm btn-warning edit-btn';
        editButton.dataset.id = normalized.id;
        editButton.title = 'Edit Category';
        editButton.innerHTML = '<i class="bi bi-pencil-fill"></i>';

        const deleteButton = document.createElement('button');
        deleteButton.className = 'btn btn-sm btn-danger delete-btn';
        deleteButton.dataset.id = normalized.id;
        deleteButton.dataset.name = normalized.name;
        deleteButton.title = 'Delete Category';
        deleteButton.innerHTML = '<i class="bi bi-trash-fill"></i>';

        actionWrapper.appendChild(editButton);
        actionWrapper.appendChild(deleteButton);
        actionsCell.appendChild(actionWrapper);
        tr.appendChild(actionsCell);

        return tr;
    }

    function updateTableRow(category) {
        const normalized = normalizeCategory(category);
        if (!normalized || !normalized.id) {
            return;
        }
        const row = categoriesTableBody.querySelector(`tr[data-id="${normalized.id}"]`);
        if (!row) {
            return;
        }
        const nameCell = row.querySelector('.category-name');
        if (nameCell) {
            nameCell.textContent = normalized.name;
        }
        const descriptionCell = row.querySelector('.category-description');
        if (descriptionCell) {
            descriptionCell.title = normalized.description;
            descriptionCell.textContent = normalized.description
                ? `${normalized.description.slice(0, 80)}${normalized.description.length > 80 ? '...' : ''}`
                : '';
        }
        const createdByCell = row.querySelector('.category-created-by');
        if (createdByCell) {
            createdByCell.textContent = normalized.createdBy || 'N/A';
        }
        const createdAtCell = row.querySelector('.category-created-at');
        if (createdAtCell) {
            createdAtCell.textContent = formatDate(normalized.createdAt);
        }
    }

    function refreshRowNumbers() {
        const rows = categoriesTableBody.querySelectorAll('tr[data-id]');
        rows.forEach((row, index) => {
            const numberCell = row.querySelector('.row-number') || row.firstElementChild;
            if (numberCell) {
                numberCell.textContent = index + 1;
            }
        });
    }

    function clearForm() {
        categoryForm.reset();
        categoryForm.classList.remove('was-validated');
        categoryIdInput.value = '';
        currentEditId = null;
        categoryModalLabel.textContent = 'Add Category';
        saveCategoryBtn.textContent = 'Save Category';
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
        categoryModal.show();
    }

    async function handleEditClick(button) {
        clearForm();
        const categoryId = button.dataset.id;
        if (!categoryId) {
            showFeedback('Unable to determine category ID for editing.');
            return;
        }
        currentEditId = categoryId;
        categoryModalLabel.textContent = 'Edit Category';
        saveCategoryBtn.textContent = 'Update Category';
        try {
            const response = await fetch(`/admin/categories/data/${categoryId}`);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const category = await response.json();
            const normalized = normalizeCategory(category);
            if (!normalized) {
                throw new Error('Invalid category data received.');
            }
            categoryIdInput.value = normalized.id;
            categoryNameInput.value = normalized.name;
            categoryDescriptionInput.value = normalized.description;
            categoryModal.show();
        } catch (error) {
            console.error('Error fetching category data:', error);
            showFeedback(`Failed to load category: ${error.message}`);
            currentEditId = null;
        }
    }

    function ensurePlaceholderRow() {
        if (categoriesTableBody.querySelector('tr[data-id]')) {
            return;
        }
        categoriesTableBody.innerHTML =
            '<tr><td colspan="6" class="text-center">No categories found.</td></tr>';
    }

    async function handleDeleteClick(button) {
        const categoryId = button.dataset.id;
        const categoryName = button.dataset.name || 'selected category';
        if (!categoryId) {
            return;
        }
        if (!confirm(`Are you sure you want to delete "${categoryName}"?`)) {
            return;
        }
        try {
            const response = await fetch(`/admin/categories/delete/${categoryId}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...(csrfToken ? { 'X-CSRFToken': csrfToken } : {}),
                },
            });
            const result = await response.json();
            if (response.ok && result.status === 'success') {
                const row = categoriesTableBody.querySelector(`tr[data-id="${categoryId}"]`);
                if (row) {
                    row.remove();
                }
                ensurePlaceholderRow();
                refreshRowNumbers();
            } else {
                throw new Error(result.message || 'Failed to delete category.');
            }
        } catch (error) {
            console.error('Error deleting category:', error);
            showFeedback(`Error: ${error.message}`);
        }
    }

    async function handleFormSubmit(event) {
        event.preventDefault();
        categoryForm.classList.add('was-validated');
        hideFormError();

        const categoryData = {
            name: categoryNameInput.value.trim(),
            description: categoryDescriptionInput.value.trim(),
        };

        if (!categoryData.name) {
            showFormError('Category name is required.');
            return;
        }

        const url = currentEditId
            ? `/admin/categories/edit/${currentEditId}`
            : '/admin/categories/add';

        saveCategoryBtn.disabled = true;
        try {
            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...(csrfToken ? { 'X-CSRFToken': csrfToken } : {}),
                },
                body: JSON.stringify(categoryData),
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
                categoryModal.hide();
                showFeedback(result.message || `Category ${currentEditId ? 'updated' : 'added'} successfully.`);
                const returnedCategory = result.category;
                if (returnedCategory) {
                    if (currentEditId) {
                        updateTableRow(returnedCategory);
                    } else {
                        const placeholderRow = categoriesTableBody.querySelector('td[colspan="6"]');
                        if (placeholderRow) {
                            placeholderRow.parentElement.remove();
                        }
                        const newRow = createTableRow(returnedCategory);
                        categoriesTableBody.appendChild(newRow);
                    }
                    refreshRowNumbers();
                    clearForm();
                } else {
                    window.location.reload();
                }
            } else {
                throw new Error(result.message || `Failed to ${currentEditId ? 'update' : 'add'} category.`);
            }
        } catch (error) {
            console.error('Error saving category:', error);
            showFormError(`Error: ${error.message}`);
        } finally {
            saveCategoryBtn.disabled = false;
        }
    }

    if (addCategoryBtn) {
        addCategoryBtn.addEventListener('click', handleAddClick);
    }

    categoryForm.addEventListener('submit', handleFormSubmit);

    categoriesTable.addEventListener('click', (event) => {
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
            const nameValue = categoryNameInput.value.trim();
            if (!nameValue) {
                showFormError('Please enter a category name first to generate a description.');
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
                        context_text: nameValue,
                        item_type: 'category',
                        deployment_name: 'gpt-4o-mini',
                    }),
                });
                const result = await response.json();
                if (response.ok && result.status === 'success' && result.description) {
                    categoryDescriptionInput.value = result.description;
                } else {
                    throw new Error(result.message || 'Failed to generate description.');
                }
            } catch (error) {
                console.error('Error generating category description:', error);
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
