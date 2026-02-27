---
phase: 04-dashboard-user-management
plan: GAP-04
type: gap_closure
wave: 4
depends_on: ["03-01"]
gap_closure: true
gap_id: TS-PATH-01
files_modified:
  - frontend/src/admin-app/tsconfig.json
  - frontend/src/admin-app/vite.config.ts
autonomous: true
user_setup: []

must_haves:
  truths:
    - "TypeScript path alias @/* resolves correctly in all files"
    - "No module not found errors for @/ imports"
    - "vite.config.ts path alias matches tsconfig.json"
    - "npm run build:admin compiles without path resolution errors"
  artifacts:
    - path: "frontend/src/admin-app/tsconfig.json"
      provides: "TypeScript configuration with path aliases"
      exports: []
      min_lines: 20
    - path: "frontend/src/admin-app/vite.config.ts"
      provides: "Vite configuration with path aliases"
      exports: []
      min_lines: 20
  key_links:
    - from: "frontend/src/admin-app/tsconfig.json"
      to: "frontend/src/admin-app/vite.config.ts"
      via: "Matching path alias configuration"
      pattern: "@/\*.*src/\*"
---

<objective>
Fix TypeScript path alias resolution errors for @/ imports that cause compilation failures even though runtime imports work correctly.

**Purpose:** The verification found that import paths like `import { api } from '@/lib/apiClient'` resolve correctly at runtime but fail TypeScript checks, indicating a mismatch between tsconfig.json paths and TypeScript's module resolution.

**Output:** Consistent path alias configuration that works for both TypeScript compilation and Vite bundling.
</objective>

<execution_context>
@/home/mlk/.claude/get-shit-done/workflows/execute-plan.md
@/home/mlk/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/REQUIREMENTS.md
@.planning/ROADMAP.md
@.planning/STATE.md
@frontend/src/admin-app/tsconfig.json
@frontend/src/admin-app/vite.config.ts
@frontend/src/admin-app/package.json
</context>

<tasks>

<task type="auto">
  <name>Analyze current tsconfig path configuration</name>
  <files>frontend/src/admin-app/tsconfig.json</files>
  <action>
    Review current TypeScript configuration:

    **Current tsconfig.json paths:**
    ```json
    {
      "compilerOptions": {
        "baseUrl": ".",
        "paths": {
          "@/*": ["./src/*"]
        }
      }
    }
    ```

    **This should work, but check:**
    1. Is `baseUrl` being resolved correctly?
    2. Are there conflicting settings?
    3. Is TypeScript using the correct tsconfig file?

    **Check vite.config.ts alias:**
    ```ts
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    }
    ```

    **Potential issues:**
    - TypeScript strictness settings
    - Missing `moduleResolution: "bundler"` or `"node"`
    - Path not matching between vite and tsconfig
  </action>
  <verify>
    - Document current tsconfig settings
    - Identify any conflicting options
    - Check if moduleResolution is set correctly
  </verify>
  <automated>npm run build:admin</automated>
  <done>
    Current tsconfig path configuration analyzed, potential issues identified.
  </done>
</task>

<task type="auto">
  <name>Update tsconfig.json for proper path resolution</name>
  <files>frontend/src/admin-app/tsconfig.json</files>
  <action>
    Fix TypeScript path resolution:

    **Recommended tsconfig.json:**
    ```json
    {
      "compilerOptions": {
        "target": "ES2020",
        "useDefineForClassFields": true,
        "lib": ["ES2020", "DOM", "DOM.Iterable"],
        "module": "ESNext",
        "skipLibCheck": true,
        "moduleResolution": "bundler",
        "allowImportingTsExtensions": true,
        "resolveJsonModule": true,
        "isolatedModules": true,
        "noEmit": true,
        "jsx": "react-jsx",
        "strict": true,
        "noUnusedLocals": false,
        "noUnusedParameters": false,
        "noFallthroughCasesInSwitch": true,
        "baseUrl": ".",
        "paths": {
          "@/*": ["./src/*"]
        },
        "types": ["vite/client"]
      },
      "include": ["./src/**/*", "./*.tsx", "./*.ts"],
      "exclude": ["../src", "node_modules", "dist"]
    }
    ```

    **Key fixes:**
    1. Ensure `moduleResolution: "bundler"` (for Vite)
    2. Add `types: ["vite/client"]` for Vite types
    3. Verify `include` covers all necessary files
    4. Make sure baseUrl paths are relative to tsconfig location
  </action>
  <verify>
    - Verify moduleResolution is set to "bundler"
    - Check paths alias matches vite.config.ts
    - Confirm include pattern covers src files
    - Run TypeScript check to verify resolution works
  </verify>
  <automated>npm run build:admin</automated>
  <done>
    tsconfig.json updated with correct moduleResolution and path aliases.
  </done>
</task>

<task type="auto">
  <name>Sync vite.config.ts alias with tsconfig</name>
  <files>frontend/src/admin-app/vite.config.ts</files>
  <action>
    Ensure Vite alias matches TypeScript:

    **Current vite.config.ts should already be correct:**
    ```ts
    export default defineConfig({
      root: __dirname,
      base: '/admin-app/',
      plugins: [react(), tailwindcss()],
      resolve: {
        alias: {
          "@": path.resolve(__dirname, "./src"),
        },
      },
      // ... rest of config
    })
    ```

    **Verify:**
    - Alias path `@` resolves to `./src`
    - Root is set to __dirname (admin-app directory)
    - No conflicting aliases

    **If needed, add explicit path mapping:**
    ```ts
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
        "@/": path.resolve(__dirname, "./src/"),
      },
    }
    ```
  </action>
  <verify>
    - Verify vite alias matches tsconfig paths
    - Check root directory is correct
    - Confirm no conflicting aliases exist
  </verify>
  <automated>npm run build:admin</automated>
  <done>
    vite.config.ts alias synced with tsconfig.json paths.
  </done>
</task>

<task type="auto">
  <name>Verify import paths in source files</name>
  <files>frontend/src/admin-app/src</files>
  <action>
    Check that all @/ imports use correct paths:

    **Common import patterns:**
    ```tsx
    import { api } from '@/lib/apiClient'      // Should resolve to src/lib/apiClient.ts
    import { Button } from '@/components/ui/button'  // Should resolve to src/components/ui/button.tsx
    import { useUsers } from '@/hooks/useUsers'  // Should resolve to src/hooks/useUsers.ts
    ```

    **Verify:**
    - All @/ imports start from src/ directory
    - File extensions are included or .ts/.tsx is default
    - No circular dependencies

    **If any imports fail:**
    - Check file exists at expected path
    - Verify export is named correctly
    - Try adding .ts or .tsx extension
  </action>
  <verify>
    - Run TypeScript check on entire admin-app
    - Identify any remaining path resolution errors
    - Fix any incorrect import paths
  </verify>
  <automated>npm run build:admin</automated>
  <done>
    All @/ import paths verified and working correctly.
  </done>
</task>

</tasks>

<verification>
1. Run `npm run build:admin` to verify TypeScript compilation
2. Check that all @/ imports resolve without errors
3. Verify no "Cannot find module" errors for path aliases
4. Confirm vite build succeeds
5. Test runtime to ensure imports still work
</verification>

<success_criteria>
1. tsconfig.json has correct moduleResolution and paths
2. vite.config.ts alias matches tsconfig paths
3. All @/ imports resolve in TypeScript check
4. npm run build:admin passes without path errors
5. Runtime imports continue to work correctly
</success_criteria>

<requirements_covered>
- FE-01: Admin app TypeScript configuration (path alias fix)
- FE-06: Build system configuration (vite + TypeScript integration)
</requirements_covered>

<output>
After completion, create `.planning/phases/04-dashboard-user-management/04-GAP-04-SUMMARY.md` with:
- Path alias issue explanation
- tsconfig.json changes made
- vite.config.ts verification
- Remaining import issues (if any)
- TS-PATH-01 gap marked as CLOSED
</output>
