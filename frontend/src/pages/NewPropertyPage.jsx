import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Home, Link, Phone, ArrowLeft, ArrowRight, CheckCircle } from 'lucide-react'
import { api } from '../lib/api'
import toast from 'react-hot-toast'
import Button from '../components/Button'
import Input from '../components/Input'

const STEPS = [
  { id: 1, title: 'Nombre',    subtitle: '¿Cómo se llama tu propiedad?',    icon: '🏠' },
  { id: 2, title: 'Calendario',subtitle: 'Conecta tu calendario de Airbnb', icon: '📅' },
  { id: 3, title: 'WhatsApp',  subtitle: '¿A quién avisamos?',              icon: '📱' },
]

export default function NewPropertyPage() {
  const navigate = useNavigate()
  const [step, setStep]       = useState(1)
  const [loading, setLoading] = useState(false)
  const [form, setForm]       = useState({
    name:           '',
    ical_url:       '',
    whatsapp_phone: '',
  })
  const [errors, setErrors] = useState({})

  const update = (field, value) => {
    setForm(f => ({ ...f, [field]: value }))
    setErrors(e => ({ ...e, [field]: '' }))
  }

  const validate = () => {
    const errs = {}
    if (step === 1 && !form.name.trim()) errs.name = 'El nombre es obligatorio'
    if (step === 2) {
      if (!form.ical_url.trim()) errs.ical_url = 'La URL del calendario es obligatoria'
      else if (!form.ical_url.startsWith('http')) errs.ical_url = 'Debe ser una URL válida (https://...)'
    }
    if (step === 3 && !form.whatsapp_phone.trim()) errs.whatsapp_phone = 'El teléfono es obligatorio'
    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  const next = () => {
    if (validate()) setStep(s => s + 1)
  }

  const submit = async () => {
    if (!validate()) return
    setLoading(true)
    try {
      await api.properties.create(form)
      toast.success('¡Propiedad creada!')
      navigate('/dashboard')
    } catch (err) {
      toast.error(err.message || 'Error al crear la propiedad')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => step === 1 ? navigate('/dashboard') : setStep(s => s - 1)}
          className="p-2 rounded-xl bg-white border border-gray-200 text-gray-600 active:scale-95 transition-transform"
        >
          <ArrowLeft size={20} />
        </button>
        <div>
          <h1 className="text-xl font-extrabold text-gray-900">Nueva propiedad</h1>
          <p className="text-xs text-gray-500">Paso {step} de {STEPS.length}</p>
        </div>
      </div>

      {/* Progress bar */}
      <div className="flex gap-1.5">
        {STEPS.map(s => (
          <div
            key={s.id}
            className={`h-1.5 flex-1 rounded-full transition-colors duration-300 ${
              s.id <= step ? 'bg-brand-500' : 'bg-gray-200'
            }`}
          />
        ))}
      </div>

      {/* Step content */}
      <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-6">
        <div className="text-center mb-6">
          <div className="text-5xl mb-3">{STEPS[step - 1].icon}</div>
          <h2 className="text-xl font-bold text-gray-900">{STEPS[step - 1].title}</h2>
          <p className="text-sm text-gray-500 mt-1">{STEPS[step - 1].subtitle}</p>
        </div>

        {step === 1 && (
          <div className="space-y-4">
            <Input
              label="Nombre de la propiedad"
              value={form.name}
              onChange={e => update('name', e.target.value)}
              placeholder="Ej: Cabaña Pucón, Depto Pichilemu..."
              icon={Home}
              error={errors.name}
              required
            />
            <div className="bg-brand-50 rounded-2xl p-3.5 text-sm text-brand-700">
              💡 Usa un nombre fácil de reconocer para ti y tu encargado.
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4">
            <Input
              label="URL del calendario iCal de Airbnb"
              value={form.ical_url}
              onChange={e => update('ical_url', e.target.value)}
              placeholder="https://www.airbnb.cl/calendar/ical/..."
              icon={Link}
              error={errors.ical_url}
              hint="Copia el enlace desde Airbnb → Calendario → Exportar calendario"
              required
            />
            {/* Instrucciones paso a paso */}
            <div className="bg-gray-50 rounded-2xl p-4 space-y-3">
              <p className="text-xs font-bold text-gray-700 uppercase tracking-wide">¿Cómo obtener el link?</p>
              {[
                'Abre la app de Airbnb o la web',
                'Ve a tu anuncio → Calendario',
                'Busca "Conectar calendarios" o "Exportar"',
                'Copia el enlace .ics que aparece',
              ].map((t, i) => (
                <div key={i} className="flex gap-2.5 text-sm text-gray-600">
                  <span className="w-5 h-5 bg-brand-600 text-white rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0">
                    {i + 1}
                  </span>
                  {t}
                </div>
              ))}
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-4">
            <Input
              label="WhatsApp del encargado de aseo"
              type="tel"
              value={form.whatsapp_phone}
              onChange={e => update('whatsapp_phone', e.target.value)}
              placeholder="+56 9 1234 5678"
              icon={Phone}
              error={errors.whatsapp_phone}
              hint="Formato internacional: +56 9 XXXX XXXX"
              required
            />
            <div className="bg-brand-50 rounded-2xl p-3.5 text-sm text-brand-700 space-y-1">
              <p className="font-semibold">📩 Este número recibirá:</p>
              <p>• Cuando cae una reserva nueva</p>
              <p>• El día antes de cada checkout</p>
            </div>
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex gap-3">
        {step < STEPS.length ? (
          <Button onClick={next} fullWidth size="lg">
            Continuar
            <ArrowRight size={20} />
          </Button>
        ) : (
          <Button onClick={submit} fullWidth size="lg" loading={loading}>
            {loading ? 'Guardando...' : '¡Listo! Crear propiedad'}
            {!loading && <CheckCircle size={20} />}
          </Button>
        )}
      </div>
    </div>
  )
}
