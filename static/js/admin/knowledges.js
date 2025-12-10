document.addEventListener('DOMContentLoaded', () => {
    const knowledgeModalElement = document.getElementById('knowledgeModal');
    if (!knowledgeModalElement) {
        console.error('Knowledge modal element not found.');
        return;
    }

    const knowledgeModal = new bootstrap.Modal(knowledgeModalElement);
    const knowledgeForm = document.getElementById('knowledgeForm');
    const knowledgeModalLabel = document.getElementById('knowledgeModalLabel');
    const knowledgeIdInput = document.getElementById('knowledgeId');
    const knowledgeNameInput = document.getElementById('knowledgeName');
    const knowledgeDescriptionInput = document.getElementById('knowledgeDescription');
    const knowledgeCategoriesDiv = document.getElementById('knowledgeCategories');
    const knowledgeCatalogsDiv = document.getElementById('knowledgeCatalogs');
    const knowledgeLibrariesDiv = document.getElementById('knowledgeLibraries');
    const knowledgeGroupsDiv = document.getElementById('knowledgeGroups');
    const categoryFilterInput = document.getElementById('categoryFilterInput');
    const catalogFilterInput = document.getElementById('catalogFilterInput');
    const libraryFilterInput = document.getElementById('libraryFilterInput');
    const groupFilterInput = document.getElementById('groupFilterInput');
    const selectedCategoriesDisplay = document.getElementById('selectedCategoriesDisplay');
    const selectedCatalogsDisplay = document.getElementById('selectedCatalogsDisplay');
    const selectedLibrariesDisplay = document.getElementById('selectedLibrariesDisplay');
    const selectedGroupsDisplay = document.getElementById('selectedGroupsDisplay');
    const saveKnowledgeBtn = document.getElementById('saveKnowledgeBtn');
    const addKnowledgeBtn = document.getElementById('addKnowledgeBtn');
    const knowledgesTable = document.getElementById('knowledgesTable');
    const knowledgesTableBody = knowledgesTable ? knowledgesTable.querySelector('tbody') : null;
    const formErrorElement = document.getElementById('formError');
    const generateDescBtn = knowledgeModalElement.querySelector('#generateDescBtn');
    const csrfToken = document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') ?? null;

    if (!knowledgeForm || !knowledgesTableBody) {
        console.error('Knowledge form or table elements missing.');
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

    function truncate(value, maxLength = 80) {
        if (!value) {
            return '';
        }
        return `${value.slice(0, maxLength)}${value.length > maxLength ? '...' : ''}`;
    }

    function joinNames(list) {
        if (!Array.isArray(list) || list.length === 0) {
            return 'N/A';
        }
        return list.join(', ');
    }

    function resolveLabel(checkbox) {
        if (!checkbox) {
            return null;
        }
        if (checkbox.nextElementSibling && checkbox.nextElementSibling.tagName === 'LABEL') {
            return checkbox.nextElementSibling;
        }
        if (checkbox.closest('label')) {
            return checkbox.closest('label');
        }
        return document.querySelector(`label[for="${checkbox.id}"]`);
    }

    function collectSelectedNames(container, checkboxSelector) {
        if (!container) {
            return [];
        }
        return Array.from(container.querySelectorAll(`${checkboxSelector}:checked`))
            .map((checkbox) => resolveLabel(checkbox)?.textContent.trim())
            .filter((name) => !!name);
    }

    function updateSelectionDisplay(container, displayElement, checkboxSelector) {
        if (!displayElement) {
            return;
        }
        const names = collectSelectedNames(container, checkboxSelector);
        if (names.length > 0) {
            displayElement.innerHTML = '<strong>Selected:</strong> ' + names
                .map((name) => `<span class="badge bg-primary me-1">${name}</span>`)
                .join('');
        } else {
            displayElement.innerHTML = '<span class="text-muted">Selected: None</span>';
        }
    }

    function getCheckedValues(container, selector) {
        if (!container) {
            return [];
        }
        return Array.from(container.querySelectorAll(`${selector}:checked`))
            .map((checkbox) => parseInt(checkbox.value, 10))
            .filter((value) => !Number.isNaN(value));
    }

    function resetListVisibility(container, itemSelector) {
        if (!container) {
            return;
        }
        container.querySelectorAll(itemSelector).forEach((item) => {
            item.style.display = '';
        });
    }

    function filterList(container, itemSelector, filterValue) {
        if (!container) {
            return;
        }
        const normalized = filterValue.toLowerCase();
        container.querySelectorAll(itemSelector).forEach((item) => {
            const label = item.querySelector('label');
            const text = label ? label.textContent.toLowerCase() : '';
            item.style.display = text.includes(normalized) ? '' : 'none';
        });
    }

    function normalizeKnowledge(raw) {
        if (!raw || typeof raw !== 'object') {
            return null;
        }
        const id = raw.id ?? raw.knowledge_id ?? null;
        if (!id) {
            return null;
        }
        const categoryNames = Array.isArray(raw.category_names)
            ? raw.category_names
            : Array.isArray(raw.categories)
                ? raw.categories
                    .map((category) => (category && typeof category === 'object' ? category.name : null))
                    .filter((name) => !!name)
                : [];
        const catalogNames = Array.isArray(raw.catalog_names)
            ? raw.catalog_names
            : Array.isArray(raw.catalogs)
                ? raw.catalogs
                    .map((catalog) => (catalog && typeof catalog === 'object' ? catalog.name : null))
                    .filter((name) => !!name)
                : [];
        const libraryNames = Array.isArray(raw.library_names)
            ? raw.library_names
            : Array.isArray(raw.libraries)
                ? raw.libraries
                    .map((library) => (library && typeof library === 'object' ? library.name : null))
                    .filter((name) => !!name)
                : [];
        const groupNames = Array.isArray(raw.group_names)
            ? raw.group_names
            : Array.isArray(raw.groups)
                ? raw.groups
                    .map((group) => (group && typeof group === 'object' ? group.name : null))
                    .filter((name) => !!name)
                : [];
        return {
            id,
            name: raw.name ?? '',
            description: raw.description ?? '',
            categoryNames,
            catalogNames,
            libraryNames,
            groupNames,
            createdBy: raw.created_by_username
                ?? raw.created_by
                ?? (raw.creator && typeof raw.creator === 'object' ? raw.creator.username : null)
                ?? 'N/A',
            createdAt: raw.created_at ?? raw.createdAt ?? null,
        };
    }

    function createTableRow(raw) {
        const knowledge = normalizeKnowledge(raw);
        if (!knowledge) {
            return document.createElement('tr');
        }

        const tr = document.createElement('tr');
        tr.dataset.id = knowledge.id;

        const numberCell = document.createElement('td');
        numberCell.classList.add('row-number');
        tr.appendChild(numberCell);

        const nameCell = document.createElement('td');
        nameCell.classList.add('knowledge-name');
        nameCell.textContent = knowledge.name;
        tr.appendChild(nameCell);

        const descriptionCell = document.createElement('td');
        descriptionCell.classList.add('knowledge-description');
        descriptionCell.title = knowledge.description;
        descriptionCell.textContent = truncate(knowledge.description);
        tr.appendChild(descriptionCell);

        const categoriesCell = document.createElement('td');
        categoriesCell.classList.add('knowledge-categories');
        categoriesCell.textContent = joinNames(knowledge.categoryNames);
        tr.appendChild(categoriesCell);

        const librariesCell = document.createElement('td');
        librariesCell.classList.add('knowledge-libraries');
        librariesCell.textContent = joinNames(knowledge.libraryNames);
        tr.appendChild(librariesCell);

        const groupsCell = document.createElement('td');
        groupsCell.classList.add('knowledge-groups');
        groupsCell.textContent = joinNames(knowledge.groupNames);
        tr.appendChild(groupsCell);

        const createdByCell = document.createElement('td');
        createdByCell.classList.add('knowledge-created-by');
        createdByCell.textContent = knowledge.createdBy || 'N/A';
        tr.appendChild(createdByCell);

        const createdAtCell = document.createElement('td');
        createdAtCell.classList.add('knowledge-created-at');
        createdAtCell.textContent = formatDate(knowledge.createdAt);
        tr.appendChild(createdAtCell);

        const actionsCell = document.createElement('td');
        const actionWrapper = document.createElement('div');
        actionWrapper.classList.add('action-buttons');

        const editButton = document.createElement('button');
        editButton.className = 'btn btn-sm btn-warning edit-btn';
        editButton.dataset.id = knowledge.id;
        editButton.title = 'Edit Knowledge';
        editButton.innerHTML = '<i class="bi bi-pencil-fill"></i>';

        const deleteButton = document.createElement('button');
        deleteButton.className = 'btn btn-sm btn-danger delete-btn';
        deleteButton.dataset.id = knowledge.id;
        deleteButton.dataset.name = knowledge.name;
        deleteButton.title = 'Delete Knowledge';
        deleteButton.innerHTML = '<i class="bi bi-trash-fill"></i>';

        actionWrapper.appendChild(editButton);
        actionWrapper.appendChild(deleteButton);
        actionsCell.appendChild(actionWrapper);
        tr.appendChild(actionsCell);

        return tr;
    }

    function updateTableRow(raw) {
        const knowledge = normalizeKnowledge(raw);
        if (!knowledge) {
            return;
        }
        const row = knowledgesTableBody.querySelector(`tr[data-id="${knowledge.id}"]`);
        if (!row) {
            return;
        }
        const nameCell = row.querySelector('.knowledge-name');
        if (nameCell) {
            nameCell.textContent = knowledge.name;
        }
        const descriptionCell = row.querySelector('.knowledge-description');
        if (descriptionCell) {
            descriptionCell.title = knowledge.description;
            descriptionCell.textContent = truncate(knowledge.description);
        }
        const categoriesCell = row.querySelector('.knowledge-categories');
        if (categoriesCell) {
            categoriesCell.textContent = joinNames(knowledge.categoryNames);
        }
        const librariesCell = row.querySelector('.knowledge-libraries');
        if (librariesCell) {
            librariesCell.textContent = joinNames(knowledge.libraryNames);
        }
        const groupsCell = row.querySelector('.knowledge-groups');
        if (groupsCell) {
            groupsCell.textContent = joinNames(knowledge.groupNames);
        }
        const createdByCell = row.querySelector('.knowledge-created-by');
        if (createdByCell) {
            createdByCell.textContent = knowledge.createdBy || 'N/A';
        }
        const createdAtCell = row.querySelector('.knowledge-created-at');
        if (createdAtCell) {
            createdAtCell.textContent = formatDate(knowledge.createdAt);
        }
    }

    function refreshRowNumbers() {
        const rows = knowledgesTableBody.querySelectorAll('tr[data-id]');
        rows.forEach((row, index) => {
            const numberCell = row.querySelector('.row-number') || row.firstElementChild;
            if (numberCell) {
                numberCell.textContent = index + 1;
            }
        });
    }

    function removePlaceholderRow() {
        const placeholderCell = knowledgesTableBody.querySelector('td[colspan="9"]');
        if (placeholderCell) {
            placeholderCell.parentElement.remove();
        }
    }

    function ensurePlaceholderRow() {
        if (knowledgesTableBody.querySelector('tr[data-id]')) {
            return;
        }
        knowledgesTableBody.innerHTML = '<tr><td colspan="9" class="text-center">No knowledge entries found.</td></tr>';
    }

    function hideFormError() {
        if (!formErrorElement) {
            return;
        }
        formErrorElement.textContent = '';
        formErrorElement.style.display = 'none';
    }

    function showFormError(message) {
        if (formErrorElement) {
            formErrorElement.textContent = message;
            formErrorElement.style.display = 'block';
        } else {
            alert(message);
        }
    }

    function showFeedback(message) {
        alert(message);
    }

    function clearForm() {
        knowledgeForm.reset();
        knowledgeIdInput.value = '';
        currentEditId = null;
        knowledgeModalLabel.textContent = 'Add Knowledge';
        saveKnowledgeBtn.textContent = 'Save Knowledge';
        hideFormError();

        updateSelectionDisplay(knowledgeCategoriesDiv, selectedCategoriesDisplay, '.category-checkbox');
        updateSelectionDisplay(knowledgeCatalogsDiv, selectedCatalogsDisplay, '.catalog-checkbox');
        updateSelectionDisplay(knowledgeLibrariesDiv, selectedLibrariesDisplay, '.library-checkbox');
        updateSelectionDisplay(knowledgeGroupsDiv, selectedGroupsDisplay, '.group-checkbox');

        if (categoryFilterInput) {
            categoryFilterInput.value = '';
        }
        if (catalogFilterInput) {
            catalogFilterInput.value = '';
        }
        if (libraryFilterInput) {
            libraryFilterInput.value = '';
        }
        if (groupFilterInput) {
            groupFilterInput.value = '';
        }

        resetListVisibility(knowledgeCategoriesDiv, '.category-item');
        resetListVisibility(knowledgeCatalogsDiv, '.catalog-item');
        resetListVisibility(knowledgeLibrariesDiv, '.library-item');
        resetListVisibility(knowledgeGroupsDiv, '.group-item');

        saveKnowledgeBtn.disabled = false;
    }

    function handleAddClick() {
        clearForm();
        knowledgeModal.show();
    }

    async function handleEditClick(button) {
        clearForm();
        const knowledgeId = button.dataset.id;
        if (!knowledgeId) {
            showFeedback('Unable to determine knowledge ID for editing.');
            return;
        }
        currentEditId = knowledgeId;
        knowledgeModalLabel.textContent = 'Edit Knowledge';
        saveKnowledgeBtn.textContent = 'Update Knowledge';
        saveKnowledgeBtn.disabled = true;
        try {
            const response = await fetch(`/admin/knowledges/data/${knowledgeId}`);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const payload = await response.json();
            const knowledge = payload.knowledge;
            if (!knowledge) {
                throw new Error('Invalid knowledge data received.');
            }
            knowledgeIdInput.value = knowledge.id;
            knowledgeNameInput.value = knowledge.name ?? '';
            knowledgeDescriptionInput.value = knowledge.description ?? '';

            const selectedCategories = Array.isArray(payload.selected_categories) ? payload.selected_categories : [];
            const selectedCatalogs = Array.isArray(payload.selected_catalogs) ? payload.selected_catalogs : [];
            const selectedLibraries = Array.isArray(payload.selected_libraries)
                ? payload.selected_libraries.map((value) => value.toString())
                : [];
            const selectedGroups = Array.isArray(payload.selected_groups)
                ? payload.selected_groups.map((value) => value.toString())
                : [];

            if (knowledgeCategoriesDiv) {
                knowledgeCategoriesDiv.querySelectorAll('.category-checkbox').forEach((checkbox) => {
                    const value = parseInt(checkbox.value, 10);
                    checkbox.checked = selectedCategories.includes(value);
                });
                updateSelectionDisplay(knowledgeCategoriesDiv, selectedCategoriesDisplay, '.category-checkbox');
            }
            if (knowledgeCatalogsDiv) {
                knowledgeCatalogsDiv.querySelectorAll('.catalog-checkbox').forEach((checkbox) => {
                    const value = parseInt(checkbox.value, 10);
                    checkbox.checked = selectedCatalogs.includes(value);
                });
                updateSelectionDisplay(knowledgeCatalogsDiv, selectedCatalogsDisplay, '.catalog-checkbox');
            }
            if (knowledgeLibrariesDiv) {
                knowledgeLibrariesDiv.querySelectorAll('.library-checkbox').forEach((checkbox) => {
                    checkbox.checked = selectedLibraries.includes(checkbox.value);
                });
                updateSelectionDisplay(knowledgeLibrariesDiv, selectedLibrariesDisplay, '.library-checkbox');
            }
            if (knowledgeGroupsDiv) {
                knowledgeGroupsDiv.querySelectorAll('.group-checkbox').forEach((checkbox) => {
                    checkbox.checked = selectedGroups.includes(checkbox.value);
                });
                updateSelectionDisplay(knowledgeGroupsDiv, selectedGroupsDisplay, '.group-checkbox');
            }

            knowledgeModal.show();
        } catch (error) {
            console.error('Error fetching knowledge data:', error);
            showFeedback(`Failed to load knowledge: ${error.message}`);
            currentEditId = null;
        } finally {
            saveKnowledgeBtn.disabled = false;
        }
    }

    async function handleDeleteClick(button) {
        const knowledgeId = button.dataset.id;
        const knowledgeName = button.dataset.name || 'selected knowledge';
        if (!knowledgeId) {
            return;
        }
        if (!confirm(`Are you sure you want to delete "${knowledgeName}"?`)) {
            return;
        }
        try {
            const response = await fetch(`/admin/knowledges/delete/${knowledgeId}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...(csrfToken ? { 'X-CSRFToken': csrfToken } : {}),
                },
            });
            const result = await response.json();
            if (response.ok && result.status === 'success') {
                const row = knowledgesTableBody.querySelector(`tr[data-id="${knowledgeId}"]`);
                if (row) {
                    row.remove();
                }
                ensurePlaceholderRow();
                refreshRowNumbers();
            } else {
                throw new Error(result.message || 'Failed to delete knowledge.');
            }
        } catch (error) {
            console.error('Error deleting knowledge:', error);
            showFeedback(`Error: ${error.message}`);
        }
    }

    async function handleFormSubmit(event) {
        event.preventDefault();
        hideFormError();

        const knowledgeData = {
            name: knowledgeNameInput.value.trim(),
            description: knowledgeDescriptionInput.value.trim(),
            category_ids: getCheckedValues(knowledgeCategoriesDiv, '.category-checkbox'),
            catalog_ids: getCheckedValues(knowledgeCatalogsDiv, '.catalog-checkbox'),
            library_ids: getCheckedValues(knowledgeLibrariesDiv, '.library-checkbox'),
            group_ids: getCheckedValues(knowledgeGroupsDiv, '.group-checkbox'),
        };

        if (!knowledgeData.name) {
            showFormError('Knowledge name is required.');
            return;
        }

        const url = currentEditId
            ? `/admin/knowledges/edit/${currentEditId}`
            : '/admin/knowledges/add';

        saveKnowledgeBtn.disabled = true;
        try {
            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...(csrfToken ? { 'X-CSRFToken': csrfToken } : {}),
                },
                body: JSON.stringify(knowledgeData),
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
                knowledgeModal.hide();
                // Ensure modal backdrop is fully removed
                setTimeout(() => {
                    document.querySelectorAll('.modal-backdrop').forEach(el => el.remove());
                    document.body.classList.remove('modal-open');
                    document.body.style.overflow = '';
                    document.body.style.paddingRight = '';
                }, 150);
                showFeedback(result.message || `Knowledge ${currentEditId ? 'updated' : 'added'} successfully.`);
                const returnedKnowledge = result.knowledge;
                if (returnedKnowledge) {
                    if (currentEditId) {
                        updateTableRow(returnedKnowledge);
                    } else {
                        removePlaceholderRow();
                        const newRow = createTableRow(returnedKnowledge);
                        knowledgesTableBody.appendChild(newRow);
                    }
                    refreshRowNumbers();
                    clearForm();
                } else {
                    window.location.reload();
                }
            } else {
                throw new Error(result.message || `Failed to ${currentEditId ? 'update' : 'add'} knowledge.`);
            }
        } catch (error) {
            console.error('Error saving knowledge:', error);
            showFormError(`Error: ${error.message}`);
        } finally {
            saveKnowledgeBtn.disabled = false;
        }
    }

    if (addKnowledgeBtn) {
        addKnowledgeBtn.addEventListener('click', handleAddClick);
    }

    knowledgeForm.addEventListener('submit', handleFormSubmit);

    knowledgesTable.addEventListener('click', (event) => {
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

    knowledgeModalElement.addEventListener('hidden.bs.modal', clearForm);

    if (catalogFilterInput) {
        catalogFilterInput.addEventListener('input', () => {
            filterList(knowledgeCatalogsDiv, '.catalog-item', catalogFilterInput.value.trim());
        });
    }
    if (libraryFilterInput) {
        libraryFilterInput.addEventListener('input', () => {
            filterList(knowledgeLibrariesDiv, '.library-item', libraryFilterInput.value.trim());
        });
    }
    if (categoryFilterInput) {
        categoryFilterInput.addEventListener('input', () => {
            filterList(knowledgeCategoriesDiv, '.category-item', categoryFilterInput.value.trim());
        });
    }
    if (groupFilterInput) {
        groupFilterInput.addEventListener('input', () => {
            filterList(knowledgeGroupsDiv, '.group-item', groupFilterInput.value.trim());
        });
    }

    if (knowledgeCatalogsDiv) {
        knowledgeCatalogsDiv.addEventListener('change', (event) => {
            if (event.target.classList.contains('catalog-checkbox')) {
                updateSelectionDisplay(knowledgeCatalogsDiv, selectedCatalogsDisplay, '.catalog-checkbox');
            }
        });
    }
    if (knowledgeLibrariesDiv) {
        knowledgeLibrariesDiv.addEventListener('change', (event) => {
            if (event.target.classList.contains('library-checkbox')) {
                updateSelectionDisplay(knowledgeLibrariesDiv, selectedLibrariesDisplay, '.library-checkbox');
            }
        });
    }
    if (knowledgeCategoriesDiv) {
        knowledgeCategoriesDiv.addEventListener('change', (event) => {
            if (event.target.classList.contains('category-checkbox')) {
                updateSelectionDisplay(knowledgeCategoriesDiv, selectedCategoriesDisplay, '.category-checkbox');
            }
        });
    }
    if (knowledgeGroupsDiv) {
        knowledgeGroupsDiv.addEventListener('change', (event) => {
            if (event.target.classList.contains('group-checkbox')) {
                updateSelectionDisplay(knowledgeGroupsDiv, selectedGroupsDisplay, '.group-checkbox');
            }
        });
    }

    if (generateDescBtn) {
        generateDescBtn.addEventListener('click', async () => {
            const name = knowledgeNameInput.value.trim();
            if (!name) {
                showFormError('Please enter a knowledge name before generating a description.');
                return;
            }
            hideFormError();
            const spinner = generateDescBtn.querySelector('.spinner-border');
            generateDescBtn.disabled = true;
            if (spinner) {
                spinner.classList.remove('d-none');
            }
            try {
                const catalogNames = collectSelectedNames(knowledgeCatalogsDiv, '.catalog-checkbox');
                const response = await fetch('/admin/generate-description', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        ...(csrfToken ? { 'X-CSRFToken': csrfToken } : {}),
                    },
                    body: JSON.stringify({
                        context_text: name,
                        item_type: 'knowledge base item',
                        deployment_name: 'gpt-4o-mini',
                        catalog_names: catalogNames,
                    }),
                });
                const result = await response.json();
                if (response.ok && result.status === 'success' && result.description) {
                    knowledgeDescriptionInput.value = result.description;
                } else {
                    throw new Error(result.message || 'Failed to generate description.');
                }
            } catch (error) {
                console.error('Error generating knowledge description:', error);
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
