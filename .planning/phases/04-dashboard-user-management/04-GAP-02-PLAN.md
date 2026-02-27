---
phase: 04-dashboard-user-management
plan: GAP-02
type: gap_closure
wave: 2
depends_on: ["03-02"]
gap_closure: true
gap_id: LAYOUT-01
files_modified:
  - frontend/src/admin-app/src/components/layout/AdminLayout.tsx
  - frontend/src/admin-app/App.tsx
autonomous: true
user_setup: []

must_haves:
  truths:
    - "AdminLayout uses Outlet pattern consistently OR children props consistently"
    - "App.tsx routing matches AdminLayout's expected pattern"
    - "No TypeScript errors for children prop on AdminLayout"
    - "Nested routes render correctly inside AdminLayout"
  artifacts:
    - path: "frontend/src/admin-app/src/components/layout/AdminLayout.tsx"
      provides: "Layout component with consistent pattern"
      exports: ["AdminLayout"]
      min_lines: 15
    - path: "frontend/src/admin-app/App.tsx"
      provides: "App routing with consistent layout pattern"
      exports: ["App"]
      min_lines: 50
  key_links:
    - from: "frontend/src/admin-app/App.tsx"
      to: "frontend/src/admin-app/src/components/layout/AdminLayout.tsx"
      via: "Component usage"
      pattern: "<AdminLayout"
---

<objective>
Fix the structural mismatch between AdminLayout (uses Outlet pattern) and App.tsx (passes children as props).

**Purpose:** The verification found that AdminLayout.tsx uses `<Outlet />` for nested routing, but App.tsx passes page components as `children` props. This inconsistency causes TypeScript errors and potential runtime issues.

**Output:** Consistent pattern where either:
- Option A: AdminLayout uses Outlet (keep current) and App.tsx uses element prop with router configuration
- Option B: AdminLayout accepts children and renders them directly (simpler for current setup)
</objective>

<execution_context>
@/home/mlk/.claude/get-shit-done/workflows/execute-plan.md
@/home/mlk/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/REQUIREMENTS.md
@.planning/ROADMAP.md
@.planning/STATE.md
@frontend/src/admin-app/src/components/layout/AdminLayout.tsx
@frontend/src/admin-app/App.tsx
@frontend/src/admin-app/src/components/auth/ProtectedRoute.tsx
</context>

<tasks>

<task type="auto">
  <name>Analyze current pattern mismatch</name>
  <files>frontend/src/admin-app/src/components/layout/AdminLayout.tsx, frontend/src/admin-app/App.tsx</files>
  <action>
    Review the current implementation:

    **Current AdminLayout.tsx:**
    ```tsx
    export function AdminLayout() {
      return (
        <div className="min-h-screen bg-background">
          <Header />
          <div className="flex">
            <Sidebar />
            <main className="flex-1 p-6">
              <Outlet />  {/* Uses Outlet for nested routing */}
            </main>
          </div>
        </div>
      )
    }
    ```

    **Current App.tsx pattern:**
    ```tsx
    <Route path="/dashboard" element={
      <ProtectedRoute>
        <AdminLayout>  {/* Wraps children but AdminLayout doesn't accept children */}
          <Dashboard />
        </AdminLayout>
      </ProtectedRoute>
    } />
    ```

    **Problem:** AdminLayout uses Outlet (expects nested routes), but App.tsx passes children (expects children prop).

    **Decision:** Choose one pattern:
    - **Option A (Outlet pattern):** Requires restructuring routes with AdminLayout as parent route
    - **Option B (Children pattern):** Simpler, just add children prop to AdminLayout

    **Recommendation:** Option B (Children pattern) is simpler and matches current App.tsx structure.
  </action>
  <verify>
    - Document the pattern mismatch clearly
    - Confirm Option B (children pattern) is selected
    - Verify this matches the actual usage in App.tsx
  </verify>
  <automated>npm run build:admin</automated>
  <done>
    Pattern mismatch analyzed and Option B (children pattern) selected for fix.
  </done>
</task>

<task type="auto">
  <name>Update AdminLayout to accept children prop</name>
  <files>frontend/src/admin-app/src/components/layout/AdminLayout.tsx</files>
  <action>
    Modify AdminLayout to use children instead of Outlet:

    **1. Add children prop:**
    ```tsx
    import { ReactNode } from "react"

    interface AdminLayoutProps {
      children: ReactNode
    }

    export function AdminLayout({ children }: AdminLayoutProps) {
      return (
        <div className="min-h-screen bg-background">
          <Header />
          <div className="flex">
            <Sidebar />
            <main className="flex-1 p-6">
              {children}  {/* Render children directly */}
            </main>
          </div>
        </div>
      )
    }
    ```

    **2. Remove Outlet import (no longer needed)**

    **3. Add TypeScript interface for props**

    **4. Keep all existing layout structure (Header, Sidebar)**
  </action>
  <verify>
    - Verify AdminLayout accepts children prop
    - Check TypeScript interface is defined
    - Confirm Outlet is removed
    - Verify layout structure is preserved
  </verify>
  <automated>npm run build:admin</automated>
  <done>
    AdminLayout updated to accept children prop, removing Outlet dependency.
  </done>
</task>

<task type="auto">
  <name>Verify App.tsx routing pattern</name>
  <files>frontend/src/admin-app/App.tsx</files>
  <action>
    Verify App.tsx pattern now matches AdminLayout:

    **Current pattern should work as-is:**
    ```tsx
    <Route path="/dashboard" element={
      <ProtectedRoute>
        <AdminLayout>
          <Dashboard />
        </AdminLayout>
      </ProtectedRoute>
    } />
    ```

    **No changes needed to App.tsx** - the existing pattern now matches the updated AdminLayout.

    **Verify:**
    - All routes use consistent AdminLayout wrapping
    - ProtectedRoute wraps AdminLayout
    - Page components are children of AdminLayout
  </action>
  <verify>
    - Run TypeScript check to verify no children prop errors
    - Confirm all routes compile without errors
    - Check AdminLayout wrapping is consistent
  </verify>
  <automated>npm run build:admin</automated>
  <done>
    App.tsx routing pattern verified as compatible with updated AdminLayout.
  </done>
</task>

<task type="auto">
  <name>Add layout variants for future flexibility (optional)</name>
  <files>frontend/src/admin-app/src/components/layout/AdminLayout.tsx</files>
  <action>
    Add optional support for both patterns:

    **Support both Outlet and children:**
    ```tsx
    interface AdminLayoutProps {
      children?: ReactNode
      useOutlet?: boolean
    }

    export function AdminLayout({ children, useOutlet = false }: AdminLayoutProps) {
      return (
        <div className="min-h-screen bg-background">
          <Header />
          <div className="flex">
            <Sidebar />
            <main className="flex-1 p-6">
              {useOutlet ? <Outlet /> : children}
            </main>
          </div>
        </div>
      )
    }
    ```

    **This is optional** - only implement if future flexibility is needed.
    For now, simple children-only pattern is sufficient.
  </action>
  <verify>
    - Verify optional Outlet support works
    - Check default behavior (children) is correct
  </verify>
  <automated>npm run build:admin</automated>
  <done>
    AdminLayout optionally supports both Outlet and children patterns.
  </done>
</task>

</tasks>

<verification>
1. Run `npm run build:admin` to verify TypeScript compilation
2. Check that AdminLayout no longer has children prop errors
3. Verify App.tsx routes compile without errors
4. Confirm layout renders correctly (Header, Sidebar, content area)
5. Test navigation between routes works correctly
</verification>

<success_criteria>
1. AdminLayout accepts children prop with proper TypeScript typing
2. App.tsx routing pattern is compatible with AdminLayout
3. No TypeScript errors for children prop mismatch
4. Layout renders correctly with Header, Sidebar, and content
5. Navigation between routes works correctly
6. TypeScript compilation passes with npm run build:admin
</success_criteria>

<requirements_covered>
- FE-01: Admin dashboard layout with sidebar navigation (AdminLayout structural fix)
- AUTH-01: Admin-only access control (ProtectedRoute integration preserved)
</requirements_covered>

<output>
After completion, create `.planning/phases/04-dashboard-user-management/04-GAP-02-SUMMARY.md` with:
- Pattern mismatch explanation
- Solution chosen (children vs Outlet)
- AdminLayout changes made
- App.tsx compatibility verification
- LAYOUT-01 gap marked as CLOSED
</output>
