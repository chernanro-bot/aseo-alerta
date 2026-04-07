import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Home, RefreshCw, ChevronRight, Wifi, WifiOff, Bell } from 'lucide-react'
import { api } from '../lib/api'
import toast from 'react-hot-toast'
import Button from '../components/Button'
import Card from '../components/Card'

function StatusBadge({ active }) {
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${
      active ? 'bg-brand-100 text-brand-700' : 'bg-gray-100 text-gray-500'
    }`}>
      {active
        ? <><span className="w-1.5 h-1.5 rounded-full bg-brand-500 animate-pulse" />Activa</>
        : <><span className="w-1.5 h-1.5 rounded-full bg-gray-400" />Inactiva</>
      }
    </span>
  )
}

function PropertyCard({ property, onSync, syncing }) {
  const navigate = useNavigate()
  return (
    <Card
      onClick={() => navigate(`/propiedades/${property.id}`)}
      className="p-4"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 flex-1 min-w-0">
          <div className="w-11 h-11 bg-brand-50 rounded-xl flex items-center justify-center flex-shrink-0">
            <Home size={20} className="text-brand-600" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-gray-900 truncate">{property.name}</p>
            <p className="text-xs text-gray-500 mt-0.5">
              📱 {property.whatsapp_phone || 'Sin teléfono'}
            </p>
            {property.next_checkout && (
              <p className="text-xs text-orange-500 font-medium mt-1">
                🗓 Próximo checkout: {new Date(property.next_checkout).toLocaleDateString('es-CL', {
                  weekday: 'short', day: 'numeric', month: 'short'
                })}
              </p>
            )}
          </div>
        </div>
        <div className="flex flex-col items-end gap-2">
          <StatusBadge active={property.active} />
          <ChevronRight size={16} className="text-gray-300" />
        </div>
      </div>

      {/* Sync button */}
      <div className="mt-3 pt-3 border-t border-gray-50 flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-xs text-gray-400">
          {property.last_sync_at ? (
            <><Wifi size={12} className="text-brand-400" />
            Sync: {new Date(property.last_sync_at).toLocaleString('es-CL', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</>
          ) : (
            <><WifiOff size={12} />Sin sincronizar</>
          )}
        </div>
        <button
          onClick={e => { e.stopPropagation(); onSync(property.id) }}
          disabled={syncing}
          className="flex items-center gap-1 text-xs text-brand-600 font-medium disabled:opacity-50"
        >
          <RefreshCw size={12} className={syncing ? 'animate-spin' : ''} />
          Sincronizar
        </button>
      </div>
    </Card>
  )
}

export default function DashboardPage() {
  const navigate       = useNavigate()
  const [properties, setProperties] = useState([])
  const [loading, setLoading]       = useState(true)
  const [syncing, setSyncing]       = useState(null)

  const fetchProperties = async () => {
    try {
      const data = await api.properties.list()
      setProperties(data)
    } catch (err) {
      toast.error('Error al cargar propiedades')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchProperties() }, [])

  const handleSync = async (id) => {
    setSyncing(id)
    try {
      await api.properties.sync(id)
      toast.success('Calendario sincronizado')
      fetchProperties()
    } catch (err) {
      toast.error('Error al sincronizar')
    } finally {
      setSyncing(null)
    }
  }

  if (loading) {
    return (
      <div className="space-y-4">
        {[1, 2].map(i => (
          <div key={i} className="bg-white rounded-2xl h-32 animate-pulse border border-gray-100" />
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-extrabold text-gray-900">Mis propiedades</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {properties.length === 0
              ? 'Agrega tu primera propiedad'
              : `${properties.length} propiedad${properties.length !== 1 ? 'es' : ''} conectada${properties.length !== 1 ? 's' : ''}`
            }
          </p>
        </div>
        <Button
          onClick={() => navigate('/propiedades/nueva')}
          size="sm"
        >
          <Plus size={18} />
          Nueva
        </Button>
      </div>

      {/* Propiedades */}
      {properties.length === 0 ? (
        <EmptyState onAdd={() => navigate('/propiedades/nueva')} />
      ) : (
        <div className="space-y-3">
          {properties.map(p => (
            <PropertyCard
              key={p.id}
              property={p}
              onSync={handleSync}
              syncing={syncing === p.id}
            />
          ))}
        </div>
      )}

      {/* Stats banner */}
      {properties.length > 0 && (
        <Card className="p-4 bg-brand-50 border-brand-100">
          <div className="flex items-center gap-3">
            <Bell size={20} className="text-brand-600" />
            <div>
              <p className="text-sm font-semibold text-brand-800">Alertas automáticas activas</p>
              <p className="text-xs text-brand-600 mt-0.5">
                Tu encargado recibirá WhatsApp el día anterior al checkout.
              </p>
            </div>
          </div>
        </Card>
      )}
    </div>
  )
}

function EmptyState({ onAdd }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="text-6xl mb-5">🏠</div>
      <h2 className="text-xl font-bold text-gray-800 mb-2">Sin propiedades aún</h2>
      <p className="text-gray-500 text-sm mb-8 max-w-xs">
        Agrega tu primera propiedad de Airbnb y empieza a automatizar el aseo.
      </p>
      <Button onClick={onAdd} size="lg">
        <Plus size={20} />
        Agregar propiedad
      </Button>
    </div>
  )
}
