'use client'

import { useEffect, useState } from 'react'
import { queryDB } from '@/lib/api'
import { formatDate } from '@/lib/utils'

interface CampagnaRow {
  id: string; nome: string; canale: string; stato: string; messaggio: string
  data_invio: string | null; totale_destinatari: number
  totale_risposti: number; totale_convertiti: number; created_at: string
}

const TIPO_ICONS: Record<string, string> = { email: '✉️', sms: '📱', push: '🔔', social: '📣', whatsapp: '💬' }
const STATO_COLORS: Record<string, string> = {
  bozza: 'bg-slate-100 text-slate-600',
  programmata: 'bg-blue-100 text-blue-700',
  pianificata: 'bg-blue-100 text-blue-700',
  inviata: 'bg-orange-100 text-orange-700',
  attiva: 'bg-orange-100 text-orange-700',
  completata: 'bg-green-100 text-green-700',
}

export default function MarketingPage() {
  const [campagne, setCampagne] = useState<CampagnaRow[]>([])
  const [loading, setLoading] = useState(true)
  const [filtro, setFiltro] = useState('tutte')

  useEffect(() => {
    async function load() {
      setLoading(true)
      const filters: { fn: string; args: unknown[] }[] = []
      if (filtro !== 'tutte') filters.push({ fn: 'eq', args: ['stato', filtro] })
      const data = await queryDB<CampagnaRow>('campagne', {
        filters,
        order: { col: 'created_at', asc: false },
      })
      setCampagne(data)
      setLoading(false)
    }
    load()
  }, [filtro])

  const totaleDestinatari = campagne.reduce((s, c) => s + c.totale_destinatari, 0)
  const totaleAperture = campagne.reduce((s, c) => s + c.totale_risposti, 0)
  const tassoApertura = totaleDestinatari > 0 ? Math.round((totaleAperture / totaleDestinatari) * 100) : 0

  return (
    <div className="p-6 space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Marketing</h1>
        <p className="text-slate-500 text-sm">Campagne e comunicazioni</p>
      </div>

      {/* KPI */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <p className="text-xs text-slate-400">Campagne totali</p>
          <p className="text-2xl font-bold text-slate-900 mt-1">{campagne.length}</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <p className="text-xs text-slate-400">Destinatari raggiunti</p>
          <p className="text-2xl font-bold text-slate-900 mt-1">{totaleDestinatari.toLocaleString('it-IT')}</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <p className="text-xs text-slate-400">Tasso apertura medio</p>
          <p className="text-2xl font-bold text-orange-600 mt-1">{tassoApertura}%</p>
        </div>
      </div>

      {/* Filtri */}
      <div className="flex gap-2 flex-wrap">
        {['tutte', 'bozza', 'programmata', 'inviata', 'completata'].map(f => (
          <button
            key={f}
            onClick={() => setFiltro(f)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${filtro === f ? 'bg-orange-500 text-white' : 'bg-white border border-slate-300 text-slate-600 hover:border-orange-300'}`}
          >
            {f}
          </button>
        ))}
      </div>

      {/* Lista campagne */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-100">
              <tr>
                <th className="text-left px-5 py-3 font-medium text-slate-600">Campagna</th>
                <th className="text-left px-5 py-3 font-medium text-slate-600">Tipo</th>
                <th className="text-left px-5 py-3 font-medium text-slate-600">Stato</th>
                <th className="text-left px-5 py-3 font-medium text-slate-600">Data invio</th>
                <th className="text-right px-5 py-3 font-medium text-slate-600">Destinatari</th>
                <th className="text-right px-5 py-3 font-medium text-slate-600">Aperture</th>
                <th className="text-right px-5 py-3 font-medium text-slate-600">Click</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {loading ? (
                [...Array(4)].map((_, i) => (
                  <tr key={i}><td colSpan={7} className="px-5 py-3"><div className="h-4 bg-slate-200 rounded animate-pulse" /></td></tr>
                ))
              ) : campagne.length === 0 ? (
                <tr><td colSpan={7} className="px-5 py-12 text-center text-slate-400">Nessuna campagna trovata</td></tr>
              ) : campagne.map(c => (
                <tr key={c.id} className="hover:bg-slate-50 transition">
                  <td className="px-5 py-3">
                    <p className="font-medium text-slate-900">{c.nome}</p>
                    <p className="text-xs text-slate-400 line-clamp-1">{c.messaggio}</p>
                  </td>
                  <td className="px-5 py-3">
                    <span>{TIPO_ICONS[c.canale] ?? '📧'} {c.canale}</span>
                  </td>
                  <td className="px-5 py-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATO_COLORS[c.stato] ?? 'bg-gray-100'}`}>
                      {c.stato}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-slate-500">{c.data_invio ? formatDate(c.data_invio) : '—'}</td>
                  <td className="px-5 py-3 text-right text-slate-700">{c.totale_destinatari}</td>
                  <td className="px-5 py-3 text-right text-slate-700">
                    {c.totale_risposti} <span className="text-slate-400 text-xs">({c.totale_destinatari > 0 ? Math.round(c.totale_risposti / c.totale_destinatari * 100) : 0}%)</span>
                  </td>
                  <td className="px-5 py-3 text-right text-slate-700">{c.totale_convertiti}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
