---
phase: quick
plan: 001
type: execute
wave: 1
depends_on: []
files_modified:
  - frontend/src/components/Toast.tsx
  - frontend/src/hooks/useToast.ts
  - frontend/src/App.tsx
  - frontend/src/pages/AddEntry.tsx
  - frontend/src/pages/Estimates.tsx
autonomous: true

must_haves:
  truths:
    - "All success/error/warning feedback appears as toast notifications in top-right corner, never as browser alert() dialogs"
    - "Toasts auto-dismiss after a few seconds without user interaction"
    - "Success toasts are green, error toasts are red, warning toasts are yellow"
    - "Toasts work correctly in both light and dark mode"
  artifacts:
    - path: "frontend/src/components/Toast.tsx"
      provides: "ToastContainer component rendering active toasts with animation"
      min_lines: 40
    - path: "frontend/src/hooks/useToast.ts"
      provides: "Global toast state and toast() trigger function"
      exports: ["useToast", "ToastProvider", "toast"]
    - path: "frontend/src/App.tsx"
      provides: "ToastProvider wrapping app, all alert() calls replaced"
      contains: "ToastProvider"
    - path: "frontend/src/pages/AddEntry.tsx"
      provides: "All alert() calls replaced with toast()"
    - path: "frontend/src/pages/Estimates.tsx"
      provides: "All alert() calls replaced with toast()"
  key_links:
    - from: "frontend/src/App.tsx"
      to: "frontend/src/hooks/useToast.ts"
      via: "useToast hook import"
      pattern: "useToast|toast\\("
    - from: "frontend/src/pages/AddEntry.tsx"
      to: "frontend/src/hooks/useToast.ts"
      via: "useToast hook import"
      pattern: "useToast|toast\\("
    - from: "frontend/src/pages/Estimates.tsx"
      to: "frontend/src/hooks/useToast.ts"
      via: "useToast hook import"
      pattern: "useToast|toast\\("
---

<objective>
Replace all 20 browser `alert()` calls across the frontend with a custom toast notification system built with Tailwind CSS.

Purpose: Browser alerts are jarring and block user interaction. Toast notifications provide non-blocking, visually integrated feedback that matches the existing UI design. The user specifically dislikes alerts appearing after Toggl/Tempo sync operations.

Output: A reusable toast system (component + hook) and all alert() calls replaced across 3 files.
</objective>

<execution_context>
@/Users/vmiller/.claude/get-shit-done/workflows/execute-plan.md
@/Users/vmiller/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@frontend/src/App.tsx
@frontend/src/pages/AddEntry.tsx
@frontend/src/pages/Estimates.tsx
@frontend/src/hooks/useTheme.tsx
@frontend/src/components/ThemeToggle.tsx
</context>

<tasks>

<task type="auto">
  <name>Task 1: Create toast notification system (component + hook)</name>
  <files>
    frontend/src/hooks/useToast.ts
    frontend/src/components/Toast.tsx
  </files>
  <action>
Create a lightweight toast notification system with NO external dependencies. Use React context + Tailwind CSS only.

**frontend/src/hooks/useToast.ts:**
- Create a `ToastProvider` React context provider that manages an array of active toasts
- Each toast has: `id` (string, use crypto.randomUUID() or Date.now()), `message` (string), `type` ('success' | 'error' | 'warning')
- Export a `useToast()` hook that returns a `toast` object with methods: `toast.success(msg)`, `toast.error(msg)`, `toast.warning(msg)`
- Each method adds a toast to the array
- Auto-remove toasts after 4 seconds (success/warning) or 6 seconds (error, since errors need more reading time)
- Use `useCallback` for stability, `setTimeout` for auto-dismiss
- Clean up timeouts on unmount
- ALSO export a standalone `toast` function (module-level) using a subscriber pattern so that non-component code or deeply nested components can call `toast.success()` etc. without needing the hook. The ToastProvider subscribes to this module-level emitter on mount.

**frontend/src/components/Toast.tsx:**
- Create a `ToastContainer` component that renders the toast list
- Position: fixed, top-right (top-4 right-4), z-50
- Stack toasts vertically with gap-2
- Each toast is a rounded card with:
  - Left color accent bar (4px wide): green-500 for success, red-500 for error, yellow-500 for warning
  - Icon from lucide-react: CheckCircle2 for success, XCircle for error, AlertTriangle for warning
  - Message text (text-sm)
  - Small X button to manually dismiss
- Dark mode support: use dark:bg-gray-800 dark:text-gray-100 with bg-white text-gray-800 for light mode
- Entry animation: use Tailwind's animate-in or a simple CSS transition (slide in from right). If animate-in is not available, use a simple `translate-x` transition with a state flag.
- Exit: just remove from array (no exit animation needed for simplicity)
- Shadow: shadow-lg for visibility over page content
- Max width: max-w-sm so toasts don't get too wide

The ToastContainer should be rendered inside ToastProvider so it's always present when the provider is mounted.
  </action>
  <verify>
    - `cd /Users/vmiller/projects/vihais/vihais-time-tracker/frontend && npx tsc --noEmit` passes with no errors related to toast files
    - Both files exist and export the expected symbols
  </verify>
  <done>
    - ToastProvider, useToast hook, and standalone toast function are implemented
    - ToastContainer renders toasts in top-right with success/error/warning variants
    - Auto-dismiss works with appropriate timeouts
    - Dark mode classes are present
  </done>
</task>

<task type="auto">
  <name>Task 2: Replace all alert() calls with toast notifications</name>
  <files>
    frontend/src/App.tsx
    frontend/src/pages/AddEntry.tsx
    frontend/src/pages/Estimates.tsx
  </files>
  <action>
**frontend/src/App.tsx:**

1. Import `ToastProvider` from `../hooks/useToast` (or appropriate relative path)
2. Wrap the app in `ToastProvider` - place it inside `AuthProvider` in the `App()` function so toasts are available everywhere. The ToastContainer is already rendered by ToastProvider, so no separate placement needed.
3. In `AuthenticatedApp`, import and call `useToast()` to get the `toast` object
4. Replace ALL 11 alert() calls in App.tsx:

| Line | Current alert() | Replacement |
|------|----------------|-------------|
| 150 | `alert('Fehler beim Loschen')` | `toast.error('Fehler beim Loschen')` |
| 154 | `alert('Fehler beim Speichern')` | `toast.error('Fehler beim Speichern')` |
| 167 | `alert('Sync erfolgreich: ...')` | `toast.success('Sync erfolgreich: ...')` (keep template literal) |
| 170 | `alert('Fehler beim Toggl Sync: ...')` | `toast.error('Fehler beim Toggl Sync: ...')` |
| 171 | `alert('Unbekannter Fehler beim Toggl Sync.')` | `toast.error('Unbekannter Fehler beim Toggl Sync.')` |
| 181 | `alert('Tempo Sync erfolgreich: ...')` | `toast.success('Tempo Sync erfolgreich: ...')` |
| 184 | `alert('Fehler beim Tempo Sync: ...')` | `toast.error('Fehler beim Tempo Sync: ...')` |
| 185 | `alert('Unbekannter Fehler beim Tempo Sync.')` | `toast.error('Unbekannter Fehler beim Tempo Sync.')` |
| 346 | `alert('Keine Eintrage zum Exportieren vorhanden.')` | `toast.warning('Keine Eintrage zum Exportieren vorhanden.')` |
| 354 | `alert('Keine Eintrage zum Exportieren vorhanden.')` | `toast.warning('Keine Eintrage zum Exportieren vorhanden.')` |
| 391 | `alert('PDF Export fehlgeschlagen...')` | `toast.error('PDF Export fehlgeschlagen. Bitte versuchen Sie es erneut.')` |
| 413 | `alert('Import erfolgreich!')` | `toast.success('Import erfolgreich!')` |
| 414 | `alert('Fehler beim Upload.')` | `toast.error('Fehler beim Upload.')` |

**frontend/src/pages/AddEntry.tsx:**
1. Import `useToast` from `../hooks/useToast`
2. Add `const { toast } = useToast();` at top of component
3. Replace 3 alert() calls:

| Line | Current alert() | Replacement |
|------|----------------|-------------|
| 109 | `alert('Entry created successfully!')` | `toast.success('Entry created successfully!')` |
| 115 | `alert('Validation error:\n...')` | `toast.error('Validation error: ' + errorMessages)` (replace newlines with space or use first error only) |
| 117 | `alert('Failed to create entry. Please try again.')` | `toast.error('Failed to create entry. Please try again.')` |

**frontend/src/pages/Estimates.tsx:**
1. Import `useToast` from `../hooks/useToast`
2. Add `const { toast } = useToast();` at top of component
3. Replace 3 alert() calls:

| Line | Current alert() | Replacement |
|------|----------------|-------------|
| 114 | `alert('Bitte mindestens ein Projekt auswahlen')` | `toast.warning('Bitte mindestens ein Projekt auswahlen')` |
| 128 | `alert('Fehler beim Speichern der Schatzung')` | `toast.error('Fehler beim Speichern der Schatzung')` |
| 140 | `alert('Fehler beim Loschen der Schatzung')` | `toast.error('Fehler beim Loschen der Schatzung')` |

IMPORTANT: Do NOT change any other logic, state management, or UI. Only replace `alert(...)` with `toast.success(...)`, `toast.error(...)`, or `toast.warning(...)` and add the provider wrapper + imports.

Note: The `confirm()` calls on line 149 of App.tsx and line 133 of Estimates.tsx should be LEFT AS-IS. Those are confirmation dialogs (delete actions), not notification alerts.
  </action>
  <verify>
    - `cd /Users/vmiller/projects/vihais/vihais-time-tracker/frontend && npx tsc --noEmit` compiles with no errors
    - `cd /Users/vmiller/projects/vihais/vihais-time-tracker/frontend && grep -rn "alert(" src/ --include="*.tsx" --include="*.ts"` returns ZERO matches (no alert() calls remain)
    - `cd /Users/vmiller/projects/vihais/vihais-time-tracker/frontend && grep -rn "confirm(" src/ --include="*.tsx" --include="*.ts"` still returns the 2 confirm() calls (unchanged)
    - `cd /Users/vmiller/projects/vihais/vihais-time-tracker/frontend && npm run build` completes successfully
  </verify>
  <done>
    - All 20 alert() calls replaced with appropriate toast variant (success/error/warning)
    - ToastProvider wraps the app inside AuthProvider
    - confirm() dialogs are untouched
    - App compiles and builds without errors
    - Zero alert() calls remain in codebase
  </done>
</task>

</tasks>

<verification>
1. `cd /Users/vmiller/projects/vihais/vihais-time-tracker/frontend && npx tsc --noEmit` - TypeScript compiles cleanly
2. `cd /Users/vmiller/projects/vihais/vihais-time-tracker/frontend && npm run build` - Production build succeeds
3. `grep -rn "alert(" frontend/src/ --include="*.tsx" --include="*.ts"` - Returns zero results
4. `grep -rn "confirm(" frontend/src/ --include="*.tsx" --include="*.ts"` - Returns exactly 2 results (delete confirmations untouched)
5. `grep -rn "ToastProvider" frontend/src/App.tsx` - Provider is present
6. `grep -rn "useToast\|toast\." frontend/src/App.tsx frontend/src/pages/AddEntry.tsx frontend/src/pages/Estimates.tsx` - Hook is used in all 3 files
</verification>

<success_criteria>
- Zero alert() calls remain in the frontend codebase
- Toast notifications appear in top-right corner with correct color coding (green/red/yellow)
- Toasts auto-dismiss (4s for success/warning, 6s for error)
- Toasts support manual dismissal via X button
- Dark mode is fully supported
- All existing confirm() dialogs remain unchanged
- Frontend builds successfully with no TypeScript errors
</success_criteria>

<output>
After completion, create `.planning/quick/001-replace-alerts-with-toast-notifications/001-SUMMARY.md`
</output>
