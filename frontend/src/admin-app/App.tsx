import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom"

// Placeholder components
function AdminDashboard() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <h1 className="text-3xl font-bold">Admin Dashboard</h1>
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

export function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<AdminDashboard />} />
        <Route path="/login" element={<AdminLogin />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
