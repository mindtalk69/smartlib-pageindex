document.addEventListener('DOMContentLoaded', function () {
    const groupsTable = document.getElementById('groupsTable');
    const addGroupBtn = document.getElementById('addGroupBtn');
    const groupModalElement = document.getElementById('groupModal');
    const groupModal = new bootstrap.Modal(groupModalElement);
    const groupModalLabel = document.getElementById('groupModalLabel');
    const groupForm = document.getElementById('groupForm');
    const groupIdInput = document.getElementById('groupId');
    const groupNameInput = document.getElementById('groupName');
    const groupDescriptionInput = document.getElementById('groupDescription');
    const saveGroupBtn = document.getElementById('saveGroupBtn');
    const formErrorElement = document.getElementById('formError');

    let currentEditId = null;

    function clearForm() {
        groupForm.reset();
        groupIdInput.value = '';
        currentEditId = null;
        formErrorElement.textContent = '';
        formErrorElement.style.display = 'none';
        saveGroupBtn.textContent = 'Save Group';
        saveGroupBtn.disabled = false;
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

    addGroupBtn.addEventListener('click', () => {
        clearForm();
        saveGroupBtn.textContent = 'Save Group'; // Ensure button text is reset on add
        groupModalLabel.textContent = 'Add Group'; // Ensure modal title is reset on add
        groupModal.show();
    });

    groupForm.addEventListener('submit', async (event) => {
        event.preventDefault();
        hideFormError();

        // Get CSRF token from meta tag
        const csrfToken = document.querySelector('meta[name="csrf-token"]').getAttribute('content');

        const name = groupNameInput.value.trim();
        const description = groupDescriptionInput.value.trim();

        if (!name) {
            showFormError('Group name is required.');
            return;
        }

        // Fix URL for add vs edit
        const id = groupIdInput.value;
        let url = '/admin/groups/add';
        if (id && id !== '') {
            url = `/admin/groups/edit/${id}`;
        }
        const method = 'POST';

        try {
            saveGroupBtn.disabled = true;
            const headers = {
                'Content-Type': 'application/json',
                'X-CSRFToken': csrfToken
            };
            
            const response = await fetch(url, {
                method: method,
                headers: headers,
                body: JSON.stringify({ name, description })
            });
            const result = await response.json();

            if (response.ok && result.status === 'success') {
                groupModal.hide();
                showFeedback(result.message || `Group ${currentEditId ? 'updated' : 'added'} successfully.`);
                // TODO: Update table row or reload page
                window.location.reload();
            } else {
                throw new Error(result.message || 'Failed to save group.');
            }
        } catch (error) {
            showFormError(`Error: ${error.message}`);
        } finally {
            saveGroupBtn.disabled = false;
        }
    });

    // Event delegation for edit and delete buttons
    if (groupsTable) {
        groupsTable.querySelector('tbody').addEventListener('click', async (event) => {
            const editBtn = event.target.closest('.edit-btn');
            const deleteBtn = event.target.closest('.delete-btn');

            if (editBtn) {
                const id = editBtn.getAttribute('data-id');
                if (!id) return;
                clearForm();
                currentEditId = id;
                saveGroupBtn.textContent = 'Update Group';
                groupModalLabel.textContent = 'Edit Group'; // Set modal title on edit

                try {
                    const csrfToken = document.querySelector('meta[name="csrf-token"]').getAttribute('content');
                    const id = await editBtn.getAttribute('data-id');
                    if (!id) {
                        throw new Error('Missing group ID');
                    }
                    const response = await fetch(`/admin/groups/data/${id}`, {
                        method: 'GET'
                    });

                    if (!response.ok) throw new Error('Failed to fetch group data.');
                    const data = await response.json();
                    groupIdInput.value = data.group.group_id;
                    groupNameInput.value = data.group.name;
                    groupDescriptionInput.value = data.group.description || '';
                    groupModal.show();
                } catch (error) {
                    alert(`Error loading group data: ${error.message}`);
                }
            } else if (deleteBtn) {
                // Get CSRF token from meta tag
                const csrfToken = document.querySelector('meta[name="csrf-token"]').getAttribute('content');
                const id = deleteBtn.getAttribute('data-id');
                if (!id) return;
                if (confirm('Are you sure you want to delete this group?')) {
                    try {
                        deleteBtn.disabled = true;
                        const response = await fetch(`/admin/groups/delete/${id}`, {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json', // Good practice
                                'X-CSRFToken': csrfToken // Add CSRF token header
                            }
                        });
                        const result = await response.json();
                        if (response.ok && result.status === 'success') {
                            alert(result.message || 'Group deleted successfully.');
                            window.location.reload();
                        } else {
                            throw new Error(result.message || 'Failed to delete group.');
                        }
                    } catch (error) {
                        alert(`Error deleting group: ${error.message}`);
                    } finally {
                        deleteBtn.disabled = false;
                    }
                }
            }
        });
    }
});
