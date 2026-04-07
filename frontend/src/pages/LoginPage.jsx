import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { Mail, ArrowRight, CheckCircle } from 'lucide-react'
import toast from 'react-hot-toast'
import Button from '../components/Button'
import Input from '../components/Input'

export default function LoginPage() {
  const [email, setEmail]     = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent]       = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!email) return
    setLoading(true)
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email: email.trim().toLowerCase(),
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        },
      })
      if (error) throw error
      setSent(true)
    } catch (err) {
      toast.error(err.message || 'Ocurrió un error. Intenta de nuevo.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-brand-50 via-white to-green-50 flex flex-col">
      {/* Logo area */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 py-12">
        <div className="w-full max-w-sm">
          {/* Brand */}
          <div className="text-center mb-10">
            <div className="text-6xl mb-4">🧹</div>
            <h1 className="text-3xl font-extrabold text-gray-900 tracking-tight">Aseo Alerta</h1>
            <p className="mt-2 text-gray-500 text-base">Tu Airbnb se coordina solo.</p>
          </div>

          {/* Card */}
          <div className="bg-white rounded-3xl shadow-lg border border-gray-100 p-7">
            {!sent ? (
              <>
                <h2 className="text-xl font-bold text-gray-900 mb-1">Ingresar</h2>
                <p className="text-sm text-gray-500 mb-6">
                  Ingresa tu email y te enviamos un link de acceso. Sin contraseña.
                </p>

                <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                  <Input
                    label="Email"
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder="tu@email.com"
                    icon={Mail}
                    required
                  />
                  <Button
                    type="submit"
                    loading={loading}
                    fullWidth
                    size="lg"
                    className="mt-1"
                  >
                    {loading ? 'Enviando...' : 'Enviar link de acceso'}
                    {!loading && <ArrowRight size={20} />}
                  </Button>
                </form>

                <p className="text-xs text-center text-gray-400 mt-5">
                  Al ingresar aceptas nuestros términos de servicio.<br />
                  Sin contraseña, 100% seguro.
                </p>
              </>
            ) : (
              <div className="text-center py-4">
                <div className="flex justify-center mb-4">
                  <CheckCircle size={52} className="text-brand-500" strokeWidth={1.5} />
                </div>
                <h2 className="text-xl font-bold text-gray-900 mb-2">¡Revisa tu email!</h2>
                <p className="text-gray-500 text-sm mb-1">
                  Enviamos un link de acceso a:
                </p>
                <p className="font-semibold text-brand-700 text-sm mb-5">{email}</p>
                <p className="text-xs text-gray-400">
                  Haz clic en el link del email para entrar.<br />
                  El link expira en 60 minutos.
                </p>
                <button
                  onClick={() => setSent(false)}
                  className="mt-5 text-sm text-brand-600 font-medium underline underline-offset-2"
                >
                  Usar otro email
                </button>
              </div>
            )}
          </div>

          {/* Features summary */}
          <div className="mt-8 space-y-3">
            {[
              { emoji: '📅', text: 'Conecta tu calendario de Airbnb' },
              { emoji: '🔔', text: 'Detectamos checkouts automáticamente' },
              { emoji: '📱', text: 'WhatsApp a tu encargado de aseo' },
            ].map(({ emoji, text }) => (
              <div key={text} className="flex items-center gap-3 text-sm text-gray-600">
                <span className="text-xl">{emoji}</span>
                <span>{text}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
