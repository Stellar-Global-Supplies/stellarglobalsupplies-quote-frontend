import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import { AuthProvider } from '@/hooks/useAuth'
import ProtectedRoute from '@/components/ProtectedRoute'
import SSOCallback from '@/components/SSOCallback'
import Login from '@/pages/Login'
import Dashboard from '@/pages/Dashboard'
import QuoteEditor from '@/pages/QuoteEditor'
import QuotesList from '@/pages/QuotesList'
import ImportCustomers from '@/pages/ImportCustomers'

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* SSO entry point — landing page redirects here after login */}
          <Route path="/sso-callback" element={<SSOCallback />} />

          {/* /login now redirects to portal instead of showing a form */}
          <Route path="/login" element={<Login />} />

          {/* Protected routes — redirect to portal if no session */}
          <Route path="/"        element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
          <Route path="/quotes"  element={<ProtectedRoute><QuotesList /></ProtectedRoute>} />
          <Route path="/quotes/new" element={<ProtectedRoute><QuoteEditor /></ProtectedRoute>} />
          <Route path="/quotes/:id" element={<ProtectedRoute><QuoteEditor /></ProtectedRoute>} />
          <Route path="/import"  element={<ProtectedRoute><ImportCustomers /></ProtectedRoute>} />
        </Routes>
      </BrowserRouter>
      <Toaster
        position="top-right"
        toastOptions={{
          style: { borderRadius: '12px', fontSize: '13px', fontFamily: 'Inter, sans-serif' },
          success: { iconTheme: { primary: '#1a5c3a', secondary: '#fff' } },
        }}
      />
    </AuthProvider>
  )
}
