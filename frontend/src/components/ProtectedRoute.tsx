import { useEffect } from 'react'
import { useAuth } from '@/hooks/useAuth'
import Layout from '@/components/Layout'

const LANDING_URL = (import.meta.env.VITE_LANDING_URL as string) || 'https://apps.stellarglobalsupplies.com'

export default function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { session, loading } = useAuth()

  useEffect(() => {
    if (!loading && !session) {
      // No session — redirect to portal with this page as callback
      const callback = encodeURIComponent(window.location.href)
      window.location.replace(`${LANDING_URL}/login?callback=${callback}`)
    }
  }, [loading, session])

  if (loading || !session) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-gray-500">Loading…</p>
        </div>
      </div>
    )
  }

  return <Layout>{children}</Layout>
}
