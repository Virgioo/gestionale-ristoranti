'use client'

import { useCallback, useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { queryDB } from '@/lib/api'
import { formatDate, formatEuro } from '@/lib/utils'
import AllergyBadges from '@/components/AllergyBadges'
import ClienteFormModal, { type ClienteRecord } from '@/components/ClienteFormModal'

interface ClienteDetail {
  id: string; nome: string; cognome: string; email: string | null; telefono: string | null
  tier: string | null; allergie: string | null; preferenze_tavolo: string | null
  bevande_preferite: string | null; note_cucina: string | null; note_interne: string | null
  data_nascita: string | null; ultima_visita: string | null; visite_totali: number
  spesa_totale: number; a_rischio: boolean; attivo: boolean; created_at: string
  sedi?: { nome: string } | null
}
interface AnimaleDetail {
  id: string; nome: string; razza: string | null; genere: string | null
  eta_anni: number | null; piatti_preferiti: string | null; note_staff: string | null
}
interface PrenotazioneDetail {
  id: string; data_prenotazione: string; ora_arrivo: string; coperti: number
  con_animale: boolean; stato: string
}
interface VisitaDetail {
  id: string; data_visita: string; servizio: string; coperti: number
  importo: number; con_animale: boolean
}

export default function ClienteDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const [cliente, setCliente] = useState<ClienteDetail | null>(null)
  const [animali, setAnimali] = useState<AnimaleDetail[]>([])
  const [prenotazioni, setPrenotazioni] = useState<PrenotazioneDetail[]>([])
  const [visite, setVisite] = useState<VisitaDetail[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(false)

  const load = useCallback(async () => {
    const [c, a, p, v] = await Promise.all([
      queryDB<ClienteDetail>('clienti', { select: '*,sedi(nome)', filters: [{ fn: 'eq', args: ['id', id] }], limit: 1 }),
      queryDB<AnimaleDetail>('animali', { filters: [{ fn: 'eq', args: ['cliente_id', id] }] }),
      queryDB<PrenotazioneDetail>('prenotazioni', {
        select: 'id,data_prenotazione,ora_arrivo,coperti,con_animale,stato',
        filters: [{ fn: 'eq', args: ['cliente_id', id] }],
        order: { col: 'data_prenotazione', asc: false },
        limit: 10,
      }),
      queryDB<VisitaDetail>('visite', {
        select: 'id,data_visita,servizio,coperti,importo,con_animale',
        filters: [{ fn: 'eq', args: ['cliente_id', id] }],
        order: { col: 'data_visita', asc: false },
        limit: 10,
      }),
    ])
    if (!c[0]) { router.push('/clienti'); return }
    setCliente(c[0])
    setAnimali(a)
    setPrenotazioni(p)
    setVisite(v)
    setLoading(false)
  }, [id, router])

  useEffect(() => { load() }, [load])

  if (loading) return <div className="p-6"><div className="h-8 w-64 bg-slate-200 rounded animate-pulse" /></div>
  if (!cliente) return null

  const totalSpesa = visite.reduce((sum, v) => sum + (v.importo ?? 0), 0)

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
          {cliente.tier && <span className="bg-yellow-100 text-yellow-700 px-3 py-1 rounded-full text-sm font-medium">⭐ {cliente.tier}</span>}
          {cliente.a_rischio && <span className="bg-amber-100 text-amber-700 px-3 py-1 rounded-full text-sm font-medium">● a rischio</span>}
        </div>
        <button onClick={() => setEditing(true)} className="px-4 py-2 rounded-lg border border-slate-300 text-sm font-medium text-slate-700 hover:border-orange-400 hover:text-orange-500 transition">
          Modifica cliente
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Info */}
        <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-4">
          <h2 className="font-semibold text-slate-900">Informazioni</h2>
          <InfoRow label="Email" value={cliente.email ?? '—'} />
          <InfoRow label="Telefono" value={cliente.telefono ?? '—'} />
          <InfoRow label="Data nascita" value={cliente.data_nascita ? formatDate(cliente.data_nascita) : '—'} />
          <InfoRow label="Sede principale" value={cliente.sedi?.nome ?? '—'} />
          <InfoRow label="Visite totali" value={String(cliente.visite_totali)} />
          <InfoRow label="Spesa totale" value={formatEuro(totalSpesa || cliente.spesa_totale)} />
          {cliente.allergie && (
            <div>
              <p className="text-xs text-slate-400 mb-1">Allergie</p>
              <AllergyBadges value={cliente.allergie} />
            </div>
          )}
          {cliente.preferenze_tavolo && (
            <div>
              <p className="text-xs text-slate-400 mb-1">Preferenze tavolo</p>
              <p className="text-sm text-slate-700">{cliente.preferenze_tavolo}</p>
            </div>
          )}
          {cliente.bevande_preferite && (
            <div>
              <p className="text-xs text-slate-400 mb-1">Bevande preferite</p>
              <p className="text-sm text-slate-700">{cliente.bevande_preferite}</p>
            </div>
          )}
          {cliente.note_cucina && (
            <div>
              <p className="text-xs text-slate-400 mb-1">Note cucina</p>
              <p className="text-sm text-slate-700">{cliente.note_cucina}</p>
            </div>
          )}
          {cliente.note_interne && (
            <div>
              <p className="text-xs text-slate-400 mb-1">Note interne</p>
              <p className="text-sm text-slate-700">{cliente.note_interne}</p>
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
                <p className="text-xs text-slate-400">{a.razza ?? 'Razza non specificata'}{a.eta_anni != null ? ` · ${a.eta_anni} anni` : ''}</p>
                {a.note_staff && <p className="text-xs text-slate-500 mt-0.5">{a.note_staff}</p>}
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
                <p className="text-sm font-medium text-slate-800">{formatDate(v.data_visita)}</p>
                <p className="text-sm font-semibold text-orange-600">{formatEuro(v.importo)}</p>
              </div>
              <p className="text-xs text-slate-400">{v.coperti} persone · {v.servizio}{v.con_animale ? ' · 🐕' : ''}</p>
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

      {editing && (
        <ClienteFormModal
          cliente={cliente as unknown as ClienteRecord}
          onClose={() => setEditing(false)}
          onSaved={load}
        />
      )}
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
