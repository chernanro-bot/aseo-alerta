import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, RefreshCw, Trash2, Edit3, Calendar, Bell, Phone, CheckCircle, Clock, XCircle } from 'lucide-react'
import { api } from '../lib/api'
import toast from 'react-hot-toast'
import Button from '../components/Button'
import Card from '../components/Card'
import Input from '../components/Input'

function AlertBadge({ type }) {
  const cfg = {
    new_booking: { label: 'Nueva reserva', color: 'blue',   emoji: '🎉' },
    pre_checkout: { label: 'Pre-checkout',  color: 'orange', emoji: '🔔' },
    sent:         { label: 'Enviada',       color: 'green',  emoji: '✅' },
    error:        { label: 'Error',         color: 'red',    emoji: '❌' },
  }
  const c = cfg[type] || { label: type, color: 'gray', emoji: '📨' }
  const colors = {
    blue:   'bg-blue-50 text-blue-700',
    orange: 'bg-orange-50 text-orange-700',
    green:  'bg-green-50 text-green-700',
    red:    'bg-red-50 text-red-700',
    gray:   'bg-gray-100 text-gray-600',
  }
  return (
    <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold ${colors[c.color]}`}>
      {c.emoji} {c.label}
    </span>
  )
}

export default function PropertyDetailPage() {
  const { id }   = useParams()
  const navigate = useNavigate()

  const [property, setProperty]   = useState(null)
  const [reservations, setRes]    = useState([])
  const [alerts, setAlerts]       = useState([])
  const [loading, setLoading]     = useState(true)
  const [syncing, setSyncing]     = useState(false)
  const [deleting, setDeleting]   = useState(false)
  const [editing, setEditing]     = useState(false)
  const [editForm, setEditForm]   = useState({})

  const load = async () => {
    try {
      const [prop, res, alr] = await Promise.all([
        api.properties.get(id),
        api.reservations.byProperty(id),
        api.alerts.byProperty(id),
      ])
      setProperty(prop)
      setEditForm({ name: prop.name, whatsapp_phone: prop.whatsapp_phone, ical_url: prop.ical_url })
      setRes(res)
      setAlerts(alr)
    } catch (err) {
      toast.error('Error al cargar la propiedad')
      navigate('/dashboard')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [id])

  const handleSync = async () => {
    setSyncing(true)
    try {
      await api.properties.sync(id)
      toast.success('Calendario sincronizado')
      load()
    } catch (err) {
      toast.error('Error al sincronizar')
    } finally {
      setSyncing(false)
    }
  }

  const handleDelete = async () => {
    if (!window.confirm('¿Eliminar esta propiedad? Se borrarán todas sus reservas y alertas.')) return
    setDeleting(true)
    try {
      await api.properties.delete(id)
      toast.success('Propiedad eliminada')
      navigate('/dashboard')
    } catch (err) {
      toast.error('Error al eliminar')
      setDeleting(false)
    }
  }

  const handleSaveEdit = async () => {
    try {
      await api.properties.update(id, editForm)
      toast.success('Cambios guardados')
      setEditing(false)
      load()
    } catch (err) {
      toast.error('Error al guardar')
    }
  }

  if (loading) {
    return (
      <div className="space-y-4 animate-pulse">
        <div className="h-8 bg-gray-200 rounded-xl w-32" />
        <div className="h-40 bg-white rounded-2xl border border-gray-100" />
        <div className="h-64 bg-white rounded-2xl border border-gray-100" />
      </div>
    )
  }

  if (!property) return null

  const upcoming = reservations.filter(r => new Date(r.checkout) >= new Date())

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => navigate('/dashboard')}
          className="p-2 rounded-xl bg-white border border-gray-200 text-gray-600"
        >
          <ArrowLeft size={20} />
        </button>
        <div className="flex-1 min-w-0">
          <h1 className="text-xl font-extrabold text-gray-900 truncate">{property.name}</h1>
          <p className="text-xs text-gray-500">{upcoming.length} reserva{upcoming.length !== 1 ? 's' : ''} próxima{upcoming.length !== 1 ? 's' : ''}</p>
        </div>
        <button onClick={() => setEditing(e => !e)} className="p-2 rounded-xl bg-white border border-gray-200 text-gray-600">
          <Edit3 size={18} />
        </button>
      </div>

      {/* Edit form */}
      {editing && (
        <Card className="p-4 space-y-3">
          <h3 className="font-bold text-gray-900">Editar propiedad</h3>
          <Input label="Nombre" value={editForm.name} onChange={e => setEditForm(f => ({...f, name: e.target.value}))} />
          <Input label="URL iCal" value={editForm.ical_url} onChange={e => setEditForm(f => ({...f, ical_url: e.target.value}))} />
          <Input label="WhatsApp" type="tel" value={editForm.whatsapp_phone} onChange={e => setEditForm(f => ({...f, whatsapp_phone: e.target.value}))} />
          <div className="flex gap-2 pt-1">
            <Button onClick={handleSaveEdit} size="sm" fullWidth>Guardar</Button>
            <Button onClick={() => setEditing(false)} size="sm" variant="secondary" fullWidth>Cancelar</Button>
          </div>
        </Card>
      )}

      {/* Info rápida */}
      <Card className="p-4">
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <Phone size={16} className="text-brand-600" />
            <span className="text-sm text-gray-700">{property.whatsapp_phone || '—'}</span>
          </div>
          <div className="flex items-center gap-3">
            <Calendar size={16} className="text-brand-600" />
            <span className="text-xs text-gray-500 truncate flex-1">{property.ical_url}</span>
          </div>
        </div>
        <div className="flex gap-2 mt-4">
          <Button onClick={handleSync} loading={syncing} size="sm" variant="secondary" fullWidth>
            <RefreshCw size={14} className={syncing ? 'animate-spin' : ''} />
            Sincronizar
          </Button>
          <Button onClick={handleDelete} loading={deleting} size="sm" variant="danger">
            <Trash2 size={14} />
          </Button>
        </div>
      </Card>

      {/* Próximas reservas */}
      <div>
        <h2 className="font-bold text-gray-900 mb-3 flex items-center gap-2">
          <Calendar size={18} className="text-brand-600" />
          Próximas reservas
        </h2>
        {upcoming.length === 0 ? (
          <Card className="p-6 text-center text-gray-500 text-sm">
            Sin reservas próximas
          </Card>
        ) : (
          <div className="space-y-2">
            {upcoming.slice(0, 10).map(r => (
              <Card key={r.id} className="p-3.5">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-semibold text-sm text-gray-900">{r.guest_name || 'Huésped'}</p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      Checkout: {new Date(r.checkout).toLocaleDateString('es-CL', {
                        weekday: 'short', day: 'numeric', month: 'short'
                      })}
                    </p>
                  </div>
                  <div className="text-right text-xs text-gray-400">
                    <p>Check-in</p>
                    <p>{new Date(r.checkin).toLocaleDateString('es-CL', { day: 'numeric', month: 'short' })}</p>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Historial de alertas */}
      <div>
        <h2 className="font-bold text-gray-900 mb-3 flex items-center gap-2">
          <Bell size={18} className="text-brand-600" />
          Alertas recientes
        </h2>
        {alerts.length === 0 ? (
          <Card className="p-6 text-center text-gray-500 text-sm">
            Sin alertas aún
          </Card>
        ) : (
          <div className="space-y-2">
            {alerts.slice(0, 10).map(a => (
              <Card key={a.id} className="p-3.5">
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <AlertBadge type={a.type} />
                    <p className="text-xs text-gray-500 mt-1">
                      {new Date(a.sent_at || a.created_at).toLocaleString('es-CL', {
                        day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit'
                      })}
                    </p>
                  </div>
                  {a.status === 'sent' && <CheckCircle size={16} className="text-green-500" />}
                  {a.status === 'pending' && <Clock size={16} className="text-orange-400" />}
                  {a.status === 'error' && <XCircle size={16} className="text-red-500" />}
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
