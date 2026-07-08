'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { formatDate, formatEuro } from '@/lib/utils'
import type { Cliente, Animale, Prenotazione, Visita } from '@/types/database'
import toast from 'react-hot-toast'

export default function ClienteDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const [cliente, setCliente] = useState<Cliente | null>(null)
  const [animali, setAnimali] = useState<Animale[]>([])
  const [prenotazioni, setPrenotazioni] = useState<Prenotazione[]>([])
  const [visite, setVisite] = useState<Visita[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const [{ data: c }, { data: a }, { data: p }, { data: v }] = await Promise.all([
        supabase.from('clienti').select('*').eq('id', id).single(),
        supabase.from('animali').select('*').eq('cliente_id', id),
        supabase.from('prenotazioni').select('*').eq('cliente_id', id).order('data_prenotazione', { ascending: false }).limit(10),
        supabase.from('visite').select('*').eq('cliente_id', id).order('data', { ascending: false }).limit(10),
      ])
      if (!c) { router.push('/clienti'); return }
      setCliente(c)
      setAnimali(a ?? [])
      setPrenotazioni(p ?? [])
      setVisite(v ?? [])
      setLoading(false)
    }
    load()
  }, [id, router])

  async function toggleVip() {
    if (!cliente) return
    const supabase = createClient()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase.from('clienti') as any).update({ vip: !cliente.vip }).eq('id', id)
    if (error) { toast.error('Errore aggiornamento'); return }
    setCliente({ ...cliente, vip: !cliente.vip })
    toast.success(cliente.vip ? 'VIP rimosso' : 'Cliente promosso a VIP')
  }

  if (loading) return <div className="p-6"><div className="h-8 w-64 bg-slate-200 rounded animate-pulse" /></div>
  if (!cliente) return null

  const totalSpesa = visite.reduce((sum, v) => sum + (v.spesa_totale ?? 0), 0)

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-4">
          <button onClick={() => router.back()} className="text-slate-400 hover:text-slate-600">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
          </button>
          <div className="w-14 h-14 rounded-full bg-orange-100 flex items-center justify-center text-orange-600 font-bold text-xl">
            {cliente.nome[0]}{cliente.cognome[0]}
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">{cliente.nome} {cliente.cognome}</h1>
            <p className="text-slate-500 text-sm">Cliente dal {formatDate(cliente.created_at)}</p>
          </div>
          {cliente.vip && <span className="bg-yellow-100 text-yellow-700 px-3 py-1 rounded-full text-sm font-medium">⭐ VIP</span>}
        </div>
        <button onClick={toggleVip} className="px-4 py-2 rounded-lg border border-slate-300 text-sm font-medium text-slate-700 hover:border-orange-400 hover:text-orange-500 transition">
          {cliente.vip ? 'Rimuovi VIP' : 'Promuovi VIP'}
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Info */}
        <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-4">
          <h2 className="font-semibold text-slate-900">Informazioni</h2>
          <InfoRow label="Email" value={cliente.email ?? '—'} />
          <InfoRow label="Telefono" value={cliente.telefono ?? '—'} />
          <InfoRow label="Data nascita" value={cliente.data_nascita ? formatDate(cliente.data_nascita) : '—'} />
          <InfoRow label="Visite totali" value={String(cliente.visite_totali)} />
          <InfoRow label="Spesa totale" value={formatEuro(totalSpesa)} />
          {cliente.allergie && cliente.allergie.length > 0 && (
            <div>
              <p className="text-xs text-slate-400 mb-1">Allergie</p>
              <p className="text-sm text-red-600">⚠️ {cliente.allergie.join(', ')}</p>
            </div>
          )}
          {cliente.preferenze && (
            <div>
              <p className="text-xs text-slate-400 mb-1">Preferenze</p>
              <p className="text-sm text-slate-700">{cliente.preferenze}</p>
            </div>
          )}
          {cliente.note && (
            <div>
              <p className="text-xs text-slate-400 mb-1">Note</p>
              <p className="text-sm text-slate-700">{cliente.note}</p>
            </div>
          )}
        </div>

        {/* Animali */}
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <h2 className="font-semibold text-slate-900 mb-4">Animali 🐕</h2>
          {animali.length === 0 ? (
            <p className="text-sm text-slate-400">Nessun animale registrato</p>
          ) : animali.map((a) => (
            <div key={a.id} className="flex items-center gap-3 py-2.5 border-b border-slate-50 last:border-0">
              <span className="text-2xl">🐶</span>
              <div>
                <p className="font-medium text-slate-800">{a.nome}</p>
                <p className="text-xs text-slate-400">{a.razza ?? 'Razza non specificata'} · Taglia {a.taglia}</p>
                {a.note && <p className="text-xs text-slate-500 mt-0.5">{a.note}</p>}
              </div>
            </div>
          ))}
        </div>

        {/* Storico */}
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <h2 className="font-semibold text-slate-900 mb-4">Ultime visite</h2>
          {visite.length === 0 ? (
            <p className="text-sm text-slate-400">Nessuna visita registrata</p>
          ) : visite.map((v) => (
            <div key={v.id} className="py-2.5 border-b border-slate-50 last:border-0">
              <div className="flex justify-between">
                <p className="text-sm font-medium text-slate-800">{formatDate(v.data)}</p>
                <p className="text-sm font-semibold text-orange-600">{formatEuro(v.spesa_totale)}</p>
              </div>
              <p className="text-xs text-slate-400">{v.persone} persone {v.animali > 0 ? `· ${v.animali} 🐕` : ''}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Prenotazioni */}
      <div className="bg-white rounded-xl border border-slate-200">
        <div className="px-5 py-4 border-b border-slate-100">
          <h2 className="font-semibold text-slate-900">Storico prenotazioni</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="text-left px-5 py-3 font-medium text-slate-600">Data</th>
                <th className="text-left px-5 py-3 font-medium text-slate-600">Ora</th>
                <th className="text-left px-5 py-3 font-medium text-slate-600">Persone</th>
                <th className="text-left px-5 py-3 font-medium text-slate-600">Stato</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {prenotazioni.length === 0 ? (
                <tr><td colSpan={4} className="px-5 py-8 text-center text-slate-400">Nessuna prenotazione</td></tr>
              ) : prenotazioni.map((p) => (
                <tr key={p.id} className="hover:bg-slate-50">
                  <td className="px-5 py-3">{formatDate(p.data_prenotazione)}</td>
                  <td className="px-5 py-3">{p.ora_arrivo.slice(0, 5)}</td>
                  <td className="px-5 py-3">{p.coperti} {p.con_animale ? '🐕' : ''}</td>
                  <td className="px-5 py-3"><StatoBadge stato={p.stato} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-slate-400">{label}</p>
      <p className="text-sm text-slate-800 font-medium">{value}</p>
    </div>
  )
}

function StatoBadge({ stato }: { stato: string }) {
  const map: Record<string, string> = {
    confermata: 'bg-green-100 text-green-700',
    in_attesa: 'bg-yellow-100 text-yellow-700',
    cancellata: 'bg-red-100 text-red-700',
    completata: 'bg-slate-100 text-slate-600',
    no_show: 'bg-gray-100 text-gray-500',
  }
  return <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${map[stato] ?? 'bg-gray-100'}`}>{stato.replace('_', ' ')}</span>
}
