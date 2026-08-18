import { useEffect } from 'react'
import { useAuth } from '@/hooks/useAuth'

const LANDING_URL = (import.meta.env.VITE_LANDING_URL as string) || 'https://apps.stellarglobalsupplies.com'

// Login page no longer shows a form.
// If someone hits /login directly, send them to the portal.
// If they already have a session, ProtectedRoute handles the redirect to /.
export default function Login() {
  const { session } = useAuth()

  useEffect(() => {
    if (!session) {
      const callback = encodeURIComponent(window.location.origin + '/')
      window.location.replace(`${LANDING_URL}/login?callback=${callback}`)
    }
  }, [session])

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-brand-900 via-brand-800 to-dark">
      <div className="w-8 h-8 border-2 border-brand-300 border-t-white rounded-full animate-spin" />
    </div>
  )
}
