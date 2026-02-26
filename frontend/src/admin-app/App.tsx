import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom"
import { AdminLayout } from "./src/components/layout/AdminLayout"

// Placeholder components
function AdminDashboard() {
  return (
    <div>
      <h1 className="text-3xl font-bold">Admin Dashboard</h1>
      <p className="text-muted-foreground mt-2">Welcome to the SmartLib Admin Dashboard</p>
    </div>
  )
}

function AdminLogin() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <h1 className="text-3xl font-bold">Admin Login</h1>
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
      <Routes>
        <Route path="/login" element={<AdminLogin />} />
        <Route path="/" element={<AdminLayout />}>
          <Route index element={<AdminDashboard />} />
          <Route path="users" element={<UsersPage />} />
          <Route path="llm-providers" element={<LLMProvidersPage />} />
          <Route path="models" element={<ModelsPage />} />
          <Route path="languages" element={<LanguagesPage />} />
          <Route path="content" element={<ContentPage />} />
          <Route path="settings" element={<SettingsPage />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
