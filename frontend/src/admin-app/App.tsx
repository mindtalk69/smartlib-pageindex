import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom"
import { AdminAuthProvider } from "./src/contexts/AdminAuthContext"
import { ProtectedRoute } from "./src/components/auth/ProtectedRoute"
import { AdminLayout } from "./src/components/layout/AdminLayout"

// Placeholder components - detailed implementations in future phases
function AdminDashboard() {
  return (
    <div>
      <h1 className="text-3xl font-bold">Admin Dashboard</h1>
      <p className="text-muted-foreground mt-2">Welcome to the SmartLib Admin Dashboard</p>
    </div>
  )
}

function UsersPage() {
  return <h1 className="text-2xl font-bold">Users</h1>
}

function LLMProvidersPage() {
  return <h1 className="text-2xl font-bold">LLM Providers</h1>
}

function ModelsPage() {
  return <h1 className="text-2xl font-bold">Models</h1>
}

function LanguagesPage() {
  return <h1 className="text-2xl font-bold">Languages</h1>
}

function ContentPage() {
  return <h1 className="text-2xl font-bold">Content</h1>
}

function SettingsPage() {
  return <h1 className="text-2xl font-bold">Settings</h1>
}

export function App() {
  return (
    <BrowserRouter>
      <AdminAuthProvider>
        <Routes>
          {/* All admin routes are protected - no separate login route for admin app */}
          <Route path="/" element={
            <ProtectedRoute>
              <AdminLayout>
                <AdminDashboard />
              </AdminLayout>
            </ProtectedRoute>
          } />
          <Route path="users" element={
            <ProtectedRoute>
              <AdminLayout>
                <UsersPage />
              </AdminLayout>
            </ProtectedRoute>
          } />
          <Route path="llm-providers" element={
            <ProtectedRoute>
              <AdminLayout>
                <LLMProvidersPage />
              </AdminLayout>
            </ProtectedRoute>
          } />
          <Route path="models" element={
            <ProtectedRoute>
              <AdminLayout>
                <ModelsPage />
              </AdminLayout>
            </ProtectedRoute>
          } />
          <Route path="languages" element={
            <ProtectedRoute>
              <AdminLayout>
                <LanguagesPage />
              </AdminLayout>
            </ProtectedRoute>
          } />
          <Route path="content" element={
            <ProtectedRoute>
              <AdminLayout>
                <ContentPage />
              </AdminLayout>
            </ProtectedRoute>
          } />
          <Route path="settings" element={
            <ProtectedRoute>
              <AdminLayout>
                <SettingsPage />
              </AdminLayout>
            </ProtectedRoute>
          } />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AdminAuthProvider>
    </BrowserRouter>
  )
}
