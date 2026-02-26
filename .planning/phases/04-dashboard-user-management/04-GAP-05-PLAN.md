---
phase: 04-dashboard-user-management
plan: GAP-05
type: gap_closure
wave: 5
depends_on: ["04-05"]
gap_closure: true
gap_id: TS-TYPE-01
files_modified:
  - frontend/src/admin-app/src/pages/PasswordResetRequests.tsx
  - frontend/src/admin-app/src/components/users/PasswordResetRequests.tsx
autonomous: true
user_setup: []

must_haves:
  truths:
    - "All callback parameters have explicit type annotations"
    - "No TypeScript implicit any errors in PasswordResetRequests files"
    - "handleApprove and handleDeny have proper typed signatures"
    - "npm run build:admin compiles without type annotation errors"
  artifacts:
    - path: "frontend/src/admin-app/src/pages/PasswordResetRequests.tsx"
      provides: "PasswordResetRequests page with explicit types"
      exports: ["PasswordResetRequests"]
      min_lines: 80
    - path: "frontend/src/admin-app/src/components/users/PasswordResetRequests.tsx"
      provides: "PasswordResetRequestsList with explicit types"
      exports: ["PasswordResetRequestsList"]
      min_lines: 200
  key_links:
    - from: "frontend/src/admin-app/src/pages/PasswordResetRequests.tsx"
      to: "frontend/src/admin-app/src/hooks/usePasswordResetRequests.ts"
      via: "Type imports and usage"
      pattern: "import.*PasswordResetRequest.*from.*usePasswordResetRequests"
---

<objective>
Add explicit type annotations to PasswordResetRequests.tsx callback parameters to fix TypeScript strict mode errors.

**Purpose:** The verification found missing type annotations in PasswordResetRequests.tsx callback parameters, causing TypeScript errors in strict mode. The callbacks handleApprove and handleDeny need explicit types for their parameters and return values.

**Output:** PasswordResetRequests page with fully typed callback handlers that pass TypeScript strict checking.
</objective>

<execution_context>
@/home/mlk/.claude/get-shit-done/workflows/execute-plan.md
@/home/mlk/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/REQUIREMENTS.md
@.planning/ROADMAP.md
@.planning/STATE.md
@frontend/src/admin-app/src/pages/PasswordResetRequests.tsx
@frontend/src/admin-app/src/components/users/PasswordResetRequests.tsx
@frontend/src/admin-app/src/hooks/usePasswordResetRequests.ts
</context>

<tasks>

<task type="auto">
  <name>Analyze current type annotations</name>
  <files>frontend/src/admin-app/src/pages/PasswordResetRequests.tsx</files>
  <action>
    Review current PasswordResetRequests.tsx for missing types:

    **Current code (lines 27-53):**
    ```tsx
    const handleApprove = async (requestId: string) => {
      const result = await actions.approve(requestId)
      if (result.success) {
        toast.success('Password reset approved', {
          description: result.tempPassword
            ? `Temporary password: ${result.tempPassword} (copied to clipboard)`
            : 'Request approved successfully',
        })
        refresh()
      } else {
        toast.error('Failed to approve request', {
          description: result.error || 'An error occurred',
        })
      }
    }

    const handleDeny = async (requestId: string, notes: string) => {
      const result = await actions.deny(requestId, notes)
      if (result.success) {
        toast.success('Request denied')
        refresh()
      } else {
        toast.error('Failed to deny request', {
          description: result.error || 'An error occurred',
        })
      }
    }
    ```

    **Current types look correct**, but check:
    1. Is `requestId` type explicitly `string`?
    2. Is `notes` type explicitly `string`?
    3. Is `result` type inferred correctly from `actions.approve` and `actions.deny`?
    4. Are there any `any` types being inferred?

    **Check if the issue is in the list component:**
    - PasswordResetRequests.tsx may pass callbacks to PasswordResetRequestsList
    - List component may have missing prop types
  </action>
  <verify>
    - Identify which parameters lack explicit types
    - Check if result types are properly inferred
    - Find any implicit `any` types
  </verify>
  <automated>npm run build:admin</automated>
  <done>
    Current type annotations analyzed, missing types identified.
  </done>
</task>

<task type="auto">
  <name>Add explicit types to callback handlers</name>
  <files>frontend/src/admin-app/src/pages/PasswordResetRequests.tsx</files>
  <action>
    Add explicit type annotations:

    **Updated handlers with explicit types:**
    ```tsx
    import { ApproveResult, DenyResult } from '@/hooks/usePasswordResetRequests'

    const handleApprove = async (requestId: string): Promise<void> => {
      const result: ApproveResult = await actions.approve(requestId)
      if (result.success) {
        toast.success('Password reset approved', {
          description: result.tempPassword
            ? `Temporary password: ${result.tempPassword} (copied to clipboard)`
            : 'Request approved successfully',
        })
        refresh()
      } else {
        toast.error('Failed to approve request', {
          description: result.error || 'An error occurred',
        })
      }
    }

    const handleDeny = async (requestId: string, notes: string): Promise<void> => {
      const result: DenyResult = await actions.deny(requestId, notes)
      if (result.success) {
        toast.success('Request denied')
        refresh()
      } else {
        toast.error('Failed to deny request', {
          description: result.error || 'An error occurred',
        })
      }
    }
    ```

    **Key additions:**
    1. Import result types from hook
    2. Add return type `Promise<void>` to handlers
    3. Add explicit type `ApproveResult` and `DenyResult` to result variables
    4. Ensure all parameters have explicit types
  </action>
  <verify>
    - Verify all parameters have explicit types
    - Check return types are specified
    - Confirm result types are explicitly typed
    - Run TypeScript check to verify no implicit any
  </verify>
  <automated>npm run build:admin</automated>
  <done>
    Callback handlers updated with explicit type annotations.
  </done>
</task>

<task type="auto">
  <name>Add explicit types to PasswordResetRequestsList props</name>
  <files>frontend/src/admin-app/src/components/users/PasswordResetRequests.tsx</files>
  <action>
    Ensure list component has typed props:

    **Define interface with explicit types:**
    ```tsx
    import { PasswordResetRequest } from '@/hooks/usePasswordResetRequests'

    export interface PasswordResetRequestsListProps {
      requests: PasswordResetRequest[]
      statusFilter: 'pending' | 'approved' | 'denied' | 'all'
      onStatusChange: (status: 'pending' | 'approved' | 'denied' | 'all') => void
      onSelectRequest: (request: PasswordResetRequest) => void
      onApprove: (requestId: string) => Promise<void>
      onDeny: (requestId: string, notes: string) => Promise<void>
      isLoading: boolean
      error: string | null
    }
    ```

    **Component with typed props:**
    ```tsx
    export function PasswordResetRequestsList({
      requests,
      statusFilter,
      onStatusChange,
      onSelectRequest,
      onApprove,
      onDeny,
      isLoading,
      error,
    }: PasswordResetRequestsListProps) {
      // Component implementation
    }
    ```

    **Check inline handlers in table rows:**
    ```tsx
    // Ensure onClick handlers have typed event parameters
    <Button
      onClick={(e: React.MouseEvent<HTMLButtonElement>) => {
        e.stopPropagation()
        onApprove(request.id)
      }}
    >
      Approve
    </Button>
    ```
  </action>
  <verify>
    - Verify interface defines all props with explicit types
    - Check all callback parameters are typed
    - Confirm event handlers have typed event parameters
    - Run TypeScript check
  </verify>
  <automated>npm run build:admin</automated>
  <done>
    PasswordResetRequestsList props interface updated with explicit type annotations.
  </done>
</task>

<task type="auto">
  <name>Verify status filter type consistency</name>
  <files>frontend/src/admin-app/src/pages/PasswordResetRequests.tsx</files>
  <action>
    Ensure status filter type is consistent across files:

    **Define shared status type:**
    ```tsx
    // In usePasswordResetRequests.ts (export this)
    export type RequestStatus = 'pending' | 'approved' | 'denied' | 'all'

    // In PasswordResetRequests.tsx
    import { RequestStatus } from '@/hooks/usePasswordResetRequests'
    const [statusFilter, setStatusFilter] = useState<RequestStatus>('pending')
    ```

    **This ensures:**
    - Same type used in hook options
    - Same type used in page component
    - Same type used in list component props
    - No string literal mismatches
  </action>
  <verify>
    - Verify RequestStatus type is exported from hook
    - Check all components use the same type
    - Confirm status values are type-safe
  </verify>
  <automated>npm run build:admin</automated>
  <done>
    Status filter type consistency verified across all PasswordResetRequests components.
  </done>
</task>

</tasks>

<verification>
1. Run `npm run build:admin` to verify TypeScript compilation
2. Check that all callback parameters have explicit types
3. Verify no implicit `any` type errors
4. Confirm result types are explicitly typed
5. Check event handlers have typed event parameters
</verification>

<success_criteria>
1. All callback handlers have explicit parameter types
2. All callback handlers have explicit return types
3. Result variables are explicitly typed
4. PasswordResetRequestsList props interface is fully typed
5. Status filter type is consistent across components
6. npm run build:admin passes without type annotation errors
7. TS-TYPE-01 gap marked as CLOSED
</success_criteria>

<requirements_covered>
- FE-06: TypeScript strict mode compliance (type annotations)
- USER-08: View password reset requests (proper typing)
</requirements_covered>

<output>
After completion, create `.planning/phases/04-dashboard-user-management/04-GAP-05-SUMMARY.md` with:
- Missing type annotations identified
- Types added to handlers and props
- Shared types exported from hook
- TS-TYPE-01 gap marked as CLOSED
</output>
