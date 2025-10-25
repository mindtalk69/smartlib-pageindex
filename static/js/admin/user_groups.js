document.addEventListener('DOMContentLoaded', function () {
    const userGroupsTable = document.getElementById('userGroupsTable');
    const addUserGroupBtn = document.getElementById('addUserGroupBtn');
    const userGroupModalElement = document.getElementById('userGroupModal');
    const userGroupModal = new bootstrap.Modal(userGroupModalElement);
    const userGroupForm = document.getElementById('userGroupForm');
    const userIdSelect = document.getElementById('userIdSelect');
    const groupIdSelect = document.getElementById('groupIdSelect');
    const saveUserGroupBtn = document.getElementById('saveUserGroupBtn');
    const formErrorElement = document.getElementById('formError');

    function clearForm() {
        userGroupForm.reset();
        formErrorElement.textContent = '';
        formErrorElement.style.display = 'none';
        saveUserGroupBtn.disabled = false;
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

    addUserGroupBtn.addEventListener('click', () => {
        clearForm();
        userGroupModal.show();
    });

    userGroupForm.addEventListener('submit', async (event) => {
        event.preventDefault();
        hideFormError();

        const user_id = userIdSelect.value;
        const group_id = parseInt(groupIdSelect.value);

        if (!user_id || isNaN(group_id)) {
            showFormError('User and Group selection are required.');
            return;
        }

        try {
            saveUserGroupBtn.disabled = true;
            const csrfToken = document.querySelector('meta[name="csrf-token"]').getAttribute('content');
            const headers = {
                'Content-Type': 'application/json',
                'X-CSRFToken': csrfToken // Add CSRF token header
            };
            const response = await fetch('/admin/user_groups/add', {
                method: 'POST',
                headers: headers,
                body: JSON.stringify({ user_id, group_id })
            });
            const result = await response.json();

            if (response.ok && result.status === 'success') {
                userGroupModal.hide();
                showFeedback(result.message || 'User added to group successfully.');
                // TODO: Update table row or reload page
                window.location.reload();
            } else {
                throw new Error(result.message || 'Failed to add user to group.');
            }
        } catch (error) {
            showFormError(`Error: ${error.message}`);
        } finally {
            saveUserGroupBtn.disabled = false;
        }
    });

    // Event delegation for delete buttons
    if (userGroupsTable) {
        userGroupsTable.querySelector('tbody').addEventListener('click', async (event) => {
            const deleteBtn = event.target.closest('.delete-btn');
            if (deleteBtn) {
                const user_id = deleteBtn.getAttribute('data-user-id');
                const group_id = deleteBtn.getAttribute('data-group-id');
                if (!user_id || !group_id) return;
                if (confirm('Are you sure you want to remove this user from the group?')) {
                    try {
                        const csrfToken = document.querySelector('meta[name="csrf-token"]').getAttribute('content');
                        const response = await fetch(`/admin/user_groups/delete/${user_id}/${group_id}`, {
                            method: 'POST',
                            headers: {
                                'X-CSRFToken': csrfToken
                            }
                        });
                        const result = await response.json();
                        if (response.ok && result.status === 'success') {
                            alert(result.message || 'User removed from group successfully.');
                            window.location.reload();
                        } else {
                            throw new Error(result.message || 'Failed to remove user from group.');
                        }
                    } catch (error) {
                        alert(`Error removing user from group: ${error.message}`);
                    }
                }
            }
        });
    }
});
