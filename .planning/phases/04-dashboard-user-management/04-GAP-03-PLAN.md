---
phase: 04-dashboard-user-management
plan: GAP-03
type: gap_closure
wave: 3
depends_on: ["04-03", "04-04"]
gap_closure: true
gap_id: USER-01
files_modified:
  - frontend/src/admin-app/src/components/users/UserList.tsx
  - frontend/src/admin-app/src/pages/Users.tsx
autonomous: true
user_setup: []

must_haves:
  truths:
    - "UserList dropdown actions are wired to actual callback props"
    - "onToggleAdmin, onToggleActive, onResetPassword, onDeleteUser props are passed from parent"
    - "onSuccess and onError callbacks are passed from parent"
    - "Dropdown menu actions execute without undefined errors"
  artifacts:
    - path: "frontend/src/admin-app/src/components/users/UserList.tsx"
      provides: "UserList with properly wired action callbacks"
      exports: ["UserList"]
      min_lines: 350
    - path: "frontend/src/admin-app/src/pages/Users.tsx"
      provides: "Users page with action handlers"
      exports: ["Users"]
      min_lines: 50
  key_links:
    - from: "frontend/src/admin-app/src/components/users/UserList.tsx"
      to: "frontend/src/admin-app/src/hooks/useUsers.ts"
      via: "Action callbacks wired through props"
      pattern: "onToggleAdmin|onToggleActive|onResetPassword|onDeleteUser"
---

<objective>
Fix UserList.tsx undefined props issue where onToggleAdmin, onToggleActive, onResetPassword are referenced in dropdown menu handlers but not passed as props from the parent Users page.

**Purpose:** The verification found that UserList.tsx dropdown menu items reference these callbacks but they are never passed from Users.tsx, causing runtime errors when actions are clicked.

**Output:** UserList component with all action callbacks properly wired from parent Users page through useUsers hook actions.
</objective>

<execution_context>
@/home/mlk/.claude/get-shit-done/workflows/execute-plan.md
@/home/mlk/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/REQUIREMENTS.md
@.planning/ROADMAP.md
@.planning/STATE.md
@frontend/src/admin-app/src/components/users/UserList.tsx
@frontend/src/admin-app/src/pages/Users.tsx
@frontend/src/admin-app/src/hooks/useUsers.ts
@frontend/src/admin-app/src/components/users/UsersPage.tsx
</context>

<tasks>

<task type="auto">
  <name>Analyze UserList prop requirements</name>
  <files>frontend/src/admin-app/src/components/users/UserList.tsx</files>
  <action>
    Review current UserList interface and usage:

    **Current interface (lines 54-77):**
    ```tsx
    export interface UserListProps {
      users: User[]
      pagination: { ... }
      search: string
      onSearchChange: (search: string) => void
      onPageChange: (page: number) => void
      onUserSelect: (user: User) => void
      isLoading: boolean
      error: string | null
      onRefresh: () => void
      onNextPage: () => void
      onPrevPage: () => void
      onToggleAdmin?: (userId: string) => Promise<void>
      onToggleActive?: (userId: string) => Promise<void>
      onResetPassword?: (userId: string) => Promise<{ tempPassword: string }>
      onDeleteUser?: (userId: string) => Promise<void>
      onSuccess?: (message: string) => void
      onError?: (message: string) => void
    }
    ```

    **Current usage in dropdown (lines 294-327):**
    - onToggleAdmin?.(user.id) - called with optional chaining
    - onToggleActive?.(user.id) - called with optional chaining
    - onResetPassword?.(user.id) - called with optional chaining
    - onSuccess?.(...) - called with optional chaining
    - onError?.(...) - called with optional chaining

    **Problem:** Props are defined but marked optional - parent may not pass them.

    **Fix options:**
    1. Make props required and ensure parent passes them
    2. Add fallback handlers inside UserList when props not provided
    3. Keep optional but add console warnings when not provided
  </action>
  <verify>
    - Document which props are optional vs required
    - Identify where callbacks are used in dropdown
    - Confirm optional chaining prevents crashes but actions don't work
  </verify>
  <automated>npm run build:admin</automated>
  <done>
    UserList prop requirements analyzed, optional callbacks identified.
  </done>
</task>

<task type="auto">
  <name>Update Users.tsx to pass action callbacks</name>
  <files>frontend/src/admin-app/src/pages/Users.tsx</files>
  <action>
    Add action handlers to Users page that wire to useUsers hook:

    **Current Users.tsx likely looks like:**
    ```tsx
    export function Users() {
      const [selectedUser, setSelectedUser] = useState<User | null>(null)
      const [search, setSearch] = useState('')
      const [page, setPage] = useState(1)

      const { users, pagination, isLoading, error, refresh } = useUsers({
        page,
        perPage: 10,
        search: search || undefined,
      })

      return (
        <div className="space-y-6">
          <div>
            <h1 className="text-3xl font-bold">User Management</h1>
            <p className="text-muted-foreground mt-1">Browse users</p>
          </div>
          <UserList
            users={users}
            pagination={pagination}
            search={search}
            onSearchChange={setSearch}
            onPageChange={setPage}
            onUserSelect={setSelectedUser}
            isLoading={isLoading}
            error={error}
            onRefresh={refresh}
            onNextPage={() => setPage(p => p + 1)}
            onPrevPage={() => setPage(p => p - 1)}
          />
          <UserDialog ... />
        </div>
      )
    }
    ```

    **Add action handlers:**
    ```tsx
    const { actions } = useUsers({ page, perPage: 10, search })
    const [toast, setToast] = useState<{title: string, desc: string} | null>(null)

    const handleToggleAdmin = async (userId: string) => {
      const result = await actions.toggleAdmin(userId)
      if (result.success) {
        setToast({ title: 'Success', desc: 'Admin status updated' })
      } else {
        setToast({ title: 'Error', desc: result.error })
      }
    }

    const handleToggleActive = async (userId: string) => {
      const result = await actions.toggleActive(userId)
      if (result.success) {
        setToast({ title: 'Success', desc: 'User status updated' })
      } else {
        setToast({ title: 'Error', desc: result.error })
      }
    }

    const handleResetPassword = async (userId: string) => {
      const result = await actions.resetPassword(userId)
      if (result.success && result.tempPassword) {
        navigator.clipboard.writeText(result.tempPassword)
        setToast({
          title: 'Password Reset',
          desc: `Temp password: ${result.tempPassword} (copied)`
        })
      } else {
        setToast({ title: 'Error', desc: result.error })
      }
    }

    const handleDeleteUser = async (userId: string) => {
      const result = await actions.deleteUser(userId)
      if (result.success) {
        setToast({ title: 'Success', desc: 'User deleted' })
      } else {
        setToast({ title: 'Error', desc: result.error })
      }
    }
    ```

    **Pass callbacks to UserList:**
    ```tsx
    <UserList
      ...
      onToggleAdmin={handleToggleAdmin}
      onToggleActive={handleToggleActive}
      onResetPassword={handleResetPassword}
      onDeleteUser={handleDeleteUser}
      onSuccess={(msg) => setToast({ title: 'Success', desc: msg })}
      onError={(msg) => setToast({ title: 'Error', desc: msg })}
    />
    ```
  </action>
  <verify>
    - Verify all action handlers are defined
    - Check handlers use useUsers.actions correctly
    - Confirm callbacks are passed to UserList
    - Verify toast notification handling
  </verify>
  <automated>npm run build:admin</automated>
  <done>
    Users.tsx updated with action handlers wired to useUsers hook actions, passed to UserList.
  </done>
</task>

<task type="auto">
  <name>Add toast notification support</name>
  <files>frontend/src/admin-app/src/pages/Users.tsx</files>
  <action>
    Add toast notifications for user actions:

    **Option A: Use existing sonner toast (if available)**
    ```tsx
    import { toast } from 'sonner'

    // In handlers:
    toast.success('Admin status updated')
    toast.error('Failed to update: ' + result.error)
    ```

    **Option B: Simple state-based toast**
    ```tsx
    const [toast, setToast] = useState<{
      title: string
      description: string
      variant?: 'default' | 'destructive'
    } | null>(null)

    // Auto-dismiss after 3 seconds
    useEffect(() => {
      if (toast) {
        const timer = setTimeout(() => setToast(null), 3000)
        return () => clearTimeout(timer)
      }
    }, [toast])
    ```

    **Render toast in component:**
    ```tsx
    {toast && (
      <Alert variant={toast.variant === 'destructive' ? 'destructive' : 'default'}>
        <AlertTitle>{toast.title}</AlertTitle>
        <AlertDescription>{toast.description}</AlertDescription>
      </Alert>
    )}
    ```
  </action>
  <verify>
    - Verify toast displays on actions
    - Check auto-dismiss works
    - Confirm success/error variants render correctly
  </verify>
  <automated>npm run build:admin</automated>
  <done>
    Toast notification support added for user action feedback.
  </done>
</task>

<task type="auto">
  <name>Verify UsersPage component integration</name>
  <files>frontend/src/admin-app/src/components/users/UsersPage.tsx</files>
  <action>
    Check if UsersPage.tsx is the actual component used:

    **Note:** There may be two files:
    - `pages/Users.tsx` - Page wrapper
    - `components/users/UsersPage.tsx` - Actual component

    **If UsersPage.tsx is the main component:**
    - Apply the same changes to UsersPage.tsx instead
    - Ensure Users.tsx imports and re-exports UsersPage

    **Verify the component hierarchy:**
    ```
    App.tsx -> Users (pages/Users.tsx) -> UsersPage (components/users/UsersPage.tsx) -> UserList
    ```

    **Make changes at the correct level** where useUsers hook is consumed.
  </action>
  <verify>
    - Identify which file contains the useUsers hook usage
    - Verify changes are made at correct level
    - Check component hierarchy is correct
  </verify>
  <automated>npm run build:admin</automated>
  <done>
    UsersPage integration verified, changes applied at correct component level.
  </done>
</task>

</tasks>

<verification>
1. Run `npm run build:admin` to verify TypeScript compilation
2. Check that UserList receives all action callback props
3. Verify Users.tsx passes onToggleAdmin, onToggleActive, onResetPassword, onDeleteUser
4. Confirm onSuccess and onError callbacks are passed
5. Test dropdown menu actions execute without undefined errors
6. Verify toast notifications display on actions
</verification>

<success_criteria>
1. UserList action callbacks are properly wired from parent
2. useUsers hook actions are used for all operations
3. Toast notifications display for success/error feedback
4. Dropdown menu actions execute correctly when clicked
5. No undefined prop errors in console
6. TypeScript compilation passes with npm run build:admin
</success_criteria>

<requirements_covered>
- USER-04: Toggle user admin status (properly wired callbacks)
- USER-05: Toggle user active status (properly wired callbacks)
- USER-06: Reset user password (properly wired callbacks)
- USER-07: Delete user (properly wired callbacks)
</requirements_covered>

<output>
After completion, create `.planning/phases/04-dashboard-user-management/04-GAP-03-SUMMARY.md` with:
- UserList undefined props issue explanation
- Action handlers implemented in Users.tsx
- Toast notification approach
- USER-01 gap marked as CLOSED
</output>
