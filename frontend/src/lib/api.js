import { supabase } from './supabase'

const API_URL = import.meta.env.VITE_API_URL || '/api'

async function getHeaders() {
  const { data: { session } } = await supabase.auth.getSession()
  return {
    'Content-Type': 'application/json',
    ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
  }
}

async function request(method, path, body) {
  const headers = await getHeaders()
  const res = await fetch(`${API_URL}${path}`, {
    method,
    headers,
    ...(body ? { body: JSON.stringify(body) } : {}),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error || 'Error desconocido')
  return data
}

// --- Propiedades ---
export const api = {
  properties: {
    list: ()                => request('GET',    '/properties'),
    get:  (id)              => request('GET',    `/properties/${id}`),
    create: (body)          => request('POST',   '/properties', body),
    update: (id, body)      => request('PATCH',  `/properties/${id}`, body),
    delete: (id)            => request('DELETE', `/properties/${id}`),
    sync:   (id)            => request('POST',   `/properties/${id}/sync`),
  },
  reservations: {
    byProperty: (id)        => request('GET',    `/properties/${id}/reservations`),
  },
  alerts: {
    byProperty: (id)        => request('GET',    `/properties/${id}/alerts`),
  },
  subscription: {
    get:    ()              => request('GET',    '/subscription'),
    create: (body)          => request('POST',   '/subscription', body),
    cancel: ()              => request('DELETE', '/subscription'),
    portal: ()              => request('POST',   '/subscription/portal'),
  },
}
