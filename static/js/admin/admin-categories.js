document.addEventListener('DOMContentLoaded', function () {
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
    const generateDescBtn = categoryModalElement ? categoryModalElement.querySelector('#generateDescBtn') : null;
    const saveCategoryBtn = document.getElementById('saveCategoryBtn');
    const addCategoryBtn = document.getElementById('addCategoryBtn');
    const categoriesTableBody = document.querySelector('#categoriesTable tbody');
    const formErrorElement = document.getElementById('formError');
    const csrfToken = document.querySelector('meta[name="csrf-token"]').getAttribute('content');

    let currentEditId = null;

    // DataTables initialization removed - using basic HTML table
    // All CRUD operations remain functional

    function clearForm() {
        categoryForm.reset();
        categoryIdInput.value = '';
        currentEditId = null;
        formErrorElement.textContent = '';
        formErrorElement.style.display = 'none';
        categoryModalLabel.textContent = 'Add Category';
        saveCategoryBtn.textContent = 'Save Category';
    }

    function showFormError(message) {
        formErrorElement.textContent = message;
        formErrorElement.style.display = 'block';
    }

    function hideFormError() {
        formErrorElement.textContent = '';
        formErrorElement.style.display = 'none';
    }

    function showFeedback(message, type = 'success') {
        alert(message);
    }

    function createTableRow(category) {
        const tr = document.createElement('tr');
        tr.setAttribute('data-id', category.id);
        tr.innerHTML = `
            <td></td>
            <td>${category.name}</td>
            <td>${category.description || ''}</td>
            <td>${category.created_by_username || 'N/A'}</td>
            <td>${category.created_at ? new Date(category.created_at).toLocaleString() : 'N/A'}</td>
            <td>
                <button class="btn btn-sm btn-warning edit-btn" data-id="${category.id}">
                    <i class="bi bi-pencil-fill"></i>
                </button>
                <button class="btn btn-sm btn-danger delete-btn" data-id="${category.id}" data-name="${category.name}">
                    <i class="bi bi-trash-fill"></i>
                </button>
            </td>
        `;
        return tr;
    }

    function updateTableRow(category) {
        const row = categoriesTableBody.querySelector(`tr[data-id="${category.id}"]`);
        if (row) {
            // Skip the first cell (No.), update the rest
            row.querySelector('td:nth-child(2)').textContent = category.name;
            row.querySelector('td:nth-child(3)').textContent = category.description || '';
            row.querySelector('td:nth-child(4)').textContent = category.created_by_username || 'N/A';
            row.querySelector('td:nth-child(5)').textContent = category.created_at ? new Date(category.created_at).toLocaleString() : 'N/A';
        }
    }

    function handleAddClick() {
        clearForm();
        categoryModal.show();
    }

async function handleEditClick(event) {
        clearForm();
        const button = event.target.closest('.edit-btn') || event.currentTarget;
        // First try getting categoryId directly from button
        let categoryId = button.getAttribute('data-id');
        
        if (!categoryId) {
            // Fallback to finding the row if data-id isn't on the button
            const row = button.closest('tr') || 
                       button.closest('.action-buttons')?.closest('tr') || 
                       button.closest('td')?.closest('tr');
            
            if (!row) {
                console.error('Could not find table row for edit button');
                return;
            }
            categoryId = row.getAttribute('data-id');
        }
        currentEditId = categoryId;
        categoryModalLabel.textContent = 'Edit Category';
        saveCategoryBtn.textContent = 'Update Category';

        try {
            const response = await fetch(`/admin/categories/data/${currentEditId}`);
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            const category = await response.json();
            categoryIdInput.value = category.id;
            categoryNameInput.value = category.name;
            categoryDescriptionInput.value = category.description || '';
        } catch (error) {
            console.error('Error fetching category data:', error);
            showFeedback('Failed to load category data for editing.', 'danger');
        } finally {
            categoryModal.show();
        }
    }

    async function handleDeleteClick(event) {
        const button = event.currentTarget;
        const categoryId = button.getAttribute('data-id');
        const row = button.closest('tr');
        const categoryName = row.querySelector('td').textContent;

        if (confirm(`Are you sure you want to delete the category "${categoryName}"?`)) {
            try {
                const response = await fetch(`/admin/categories/delete/${categoryId}`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-CSRFToken': csrfToken
                    }
                });
                const result = await response.json();

                if (response.ok && result.status === 'success') {
                    row.remove();
                    showFeedback(result.message || 'Category deleted successfully.');
                    if (categoriesTableBody.rows.length === 0) {
                        categoriesTableBody.innerHTML = '<tr><td colspan="5" class="text-center">No categories found.</td></tr>';
                    }
                } else {
                    throw new Error(result.message || 'Failed to delete category.');
                }
            } catch (error) {
                console.error('Error deleting category:', error);
                showFeedback(`Error: ${error.message}`, 'danger');
            }
        }
    }

    async function handleFormSubmit(event) {
        event.preventDefault();
        hideFormError();

        const categoryData = {
            name: categoryNameInput.value.trim(),
            description: categoryDescriptionInput.value.trim()
        };

        if (!categoryData.name) {
            showFormError('Category name is required.');
            return;
        }

        const url = currentEditId ? `/admin/categories/edit/${currentEditId}` : '/admin/categories/add';

        try {
            saveCategoryBtn.disabled = true;
            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRFToken': csrfToken
                },
                body: JSON.stringify(categoryData)
            });

            const result = await response.json();

            if (response.ok && result.status === 'success') {
                categoryModal.hide();
                showFeedback(result.message || `Category ${currentEditId ? 'updated' : 'added'} successfully.`);

                const returnedCategory = result.category;
                if (returnedCategory) {
                    if (!returnedCategory.created_at) returnedCategory.created_at = new Date().toISOString();
                    if (!returnedCategory.created_by_username) returnedCategory.created_by_username = 'Current User';

                    if (currentEditId) {
                        updateTableRow(returnedCategory);
                    } else {
                        const noDataRow = categoriesTableBody.querySelector('td[colspan="5"]');
                        if (noDataRow) noDataRow.parentElement.remove();
                        const newRow = createTableRow(returnedCategory);
                        categoriesTableBody.appendChild(newRow);
                    }
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

    if (categoryForm) {
        categoryForm.addEventListener('submit', handleFormSubmit);
    }

    document.getElementById('categoriesTable').addEventListener('click', (event) => {
        const editButton = event.target.closest('.edit-btn');
        if (editButton) {
            handleEditClick(event);
            return;
        }
        const deleteButton = event.target.closest('.delete-btn');
        if (deleteButton) {
            handleDeleteClick(event);
        }
    });

    async function handleGenerateDescription() {
        const nameValue = categoryNameInput.value.trim();
        if (!nameValue) {
            showFormError('Please enter a category name first to generate a description.');
            return;
        }
        hideFormError();

        const button = generateDescBtn;
        if (!button) {
            console.error("Generate Description button not found in Category modal.");
            return;
        }
        const spinner = button.querySelector('.spinner-border');

        button.disabled = true;
        spinner.classList.remove('d-none');

        try {
            const payload = {
                context_text: nameValue,
                item_type: "category",
                deployment_name: "gpt-4o-mini"
            };

            const headers = {
                'Content-Type': 'application/json'
            };
            if (csrfToken) {
                headers['X-CSRFToken'] = csrfToken;
            }

            const response = await fetch('/admin/generate-description', {
                method: 'POST',
                headers: headers,
                body: JSON.stringify(payload)
            });

            const result = await response.json();

            if (response.ok && result.status === 'success') {
                categoryDescriptionInput.value = result.description;
            } else {
                throw new Error(result.message || `Failed to generate description. Status: ${response.status}`);
            }
        } catch (error) {
            console.error('Error in Category handleGenerateDescription:', error);
            showFormError(`Error generating description: ${error.message}`);
        } finally {
            button.disabled = false;
            spinner.classList.add('d-none');
        }
    }

    if (generateDescBtn) {
        generateDescBtn.addEventListener('click', handleGenerateDescription);
    } else {
        console.warn("Generate Description button not found.");
    }
});
