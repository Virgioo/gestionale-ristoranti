'use client'

import { useEffect, useState } from 'react'
import { queryDB } from '@/lib/api'

interface EventoRow {
  id: string
  nome: string
  nota: string | null
  note: string | null
  data_evento: string | null
  segmento_target: string | null
  posti_massimi: number | null
  posti_confermati: number
  budget_evento: number | null
  revenue_atteso: number | null
  revenue_effettivo: number | null
  stato: string
}

const STATO_COLORS: Record<string, string> = {
  programmato: 'bg-blue-100 text-blue-700',
  attivo: 'bg-green-100 text-green-700',
  cancellato: 'bg-red-100 text-red-700',
  completato: 'bg-slate-100 text-slate-600',
}

const STATO_ICONS: Record<string, string> = {
  programmato: '📅',
  attivo: '🟢',
  cancellato: '❌',
  completato: '✅',
}

function euro(n: number) {
  return new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n)
}

function fmtDate(d: string | null) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('it-IT', { day: 'numeric', month: 'long', year: 'numeric' })
}

export default function EventiPage() {
  const [eventi, setEventi] = useState<EventoRow[]>([])
  const [loading, setLoading] = useState(true)
  const [filtro, setFiltro] = useState<'tutti' | 'programmato' | 'attivo' | 'completato'>('tutti')

  useEffect(() => {
    async function load() {
      setLoading(true)
      try {
        const filters: { fn: string; args: unknown[] }[] = []
        if (filtro !== 'tutti') filters.push({ fn: 'eq', args: ['stato', filtro] })
        const data = await queryDB<EventoRow>('eventi', {
          filters,
          order: { col: 'data_evento', asc: true },
        })
        setEventi(data)
      } catch {
        setEventi([])
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [filtro])

  const totPosti = eventi.reduce((s, e) => s + (e.posti_massimi ?? 0), 0)
  const totRevenue = eventi.reduce((s, e) => s + (e.revenue_atteso ?? 0), 0)

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Eventi</h1>
          <p className="text-slate-500 text-sm">{eventi.length} eventi trovati</p>
        </div>
      </div>

      {/* KPI */}
      {!loading && eventi.length > 0 && (
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-white rounded-xl border border-slate-200 p-4">
            <p className="text-xs text-slate-500">Posti totali</p>
            <p className="text-2xl font-bold text-slate-900 mt-1">{totPosti}</p>
          </div>
          <div className="bg-white rounded-xl border border-slate-200 p-4">
            <p className="text-xs text-slate-500">Revenue atteso</p>
            <p className="text-2xl font-bold text-orange-600 mt-1">{euro(totRevenue)}</p>
          </div>
          <div className="bg-white rounded-xl border border-slate-200 p-4">
            <p className="text-xs text-slate-500">Programmati</p>
            <p className="text-2xl font-bold text-blue-600 mt-1">
              {eventi.filter(e => e.stato === 'programmato').length}
            </p>
          </div>
        </div>
      )}

      {/* Filtri */}
      <div className="flex gap-2 flex-wrap">
        {(['tutti', 'programmato', 'attivo', 'completato'] as const).map(f => (
          <button
            key={f}
            onClick={() => setFiltro(f)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition capitalize ${filtro === f ? 'bg-orange-500 text-white' : 'bg-white border border-slate-300 text-slate-600 hover:border-orange-300'}`}
          >
            {f}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="space-y-3">
          {[...Array(4)].map((_, i) => <div key={i} className="h-28 bg-slate-200 rounded-xl animate-pulse" />)}
        </div>
      ) : eventi.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 p-12 text-center text-slate-400">
          Nessun evento trovato
        </div>
      ) : (
        <div className="space-y-3">
          {eventi.map(e => (
            <div key={e.id} className="bg-white rounded-xl border border-slate-200 p-5 hover:border-orange-200 transition">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <span className="text-xl">{STATO_ICONS[e.stato] ?? '📅'}</span>
                    <h3 className="font-bold text-slate-900 text-lg">{e.nome}</h3>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium capitalize ${STATO_COLORS[e.stato] ?? 'bg-gray-100'}`}>
                      {e.stato}
                    </span>
                  </div>
                  {(e.note || e.nota) && (
                    <p className="text-sm text-slate-500 mb-3">{e.note ?? e.nota}</p>
                  )}
                  <div className="flex flex-wrap gap-4 text-sm text-slate-600">
                    {e.data_evento && <span>📅 {fmtDate(e.data_evento)}</span>}
                    {e.segmento_target && <span>🎯 {e.segmento_target}</span>}
                    {e.posti_massimi && <span>👥 {e.posti_confermati}/{e.posti_massimi} posti</span>}
                    {e.revenue_atteso && <span>💶 {euro(e.revenue_atteso)} atteso</span>}
                    {e.revenue_effettivo && <span className="text-green-600 font-medium">✓ {euro(e.revenue_effettivo)} effettivo</span>}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
