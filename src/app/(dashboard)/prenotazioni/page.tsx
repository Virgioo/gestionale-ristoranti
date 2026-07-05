'use client'

import { useEffect, useState } from 'react'
import { queryDB, updateDB } from '@/lib/api'
import toast from 'react-hot-toast'

interface PrenDB {
  id: string
  nome_ospite: string
  telefono_ospite: string | null
  data_prenotazione: string
  ora_arrivo: string
  coperti: number
  tipo_tavolo: string | null
  stato: string
  note_speciali: string | null
  allergie_comunicare: string | null
  con_animale: boolean
  occasione_speciale: string | null
}

type Stato = 'confermata' | 'in_attesa' | 'cancellata' | 'completata' | 'no_show'

const STATI: Array<Stato | 'tutte'> = ['tutte', 'confermata', 'in_attesa', 'cancellata', 'completata', 'no_show']

const STATO_LABEL: Record<string, string> = {
  tutte: 'Tutte',
  confermata: 'Confermata',
  in_attesa: 'In attesa',
  cancellata: 'Cancellata',
  completata: 'Completata',
  no_show: 'No show',
}

export default function PrenotazioniPage() {
  const [prenotazioni, setPrenotazioni] = useState<PrenDB[]>([])
  const [loading, setLoading] = useState(true)
  const [dataFiltro, setDataFiltro] = useState(new Date().toISOString().split('T')[0])
  const [statoFiltro, setStatoFiltro] = useState<string>('tutte')

  useEffect(() => { load() }, [dataFiltro, statoFiltro])

  async function load() {
    setLoading(true)
    const filters: { fn: string; args: unknown[] }[] = [
      { fn: 'eq', args: ['data_prenotazione', dataFiltro] },
    ]
    if (statoFiltro !== 'tutte') filters.push({ fn: 'eq', args: ['stato', statoFiltro] })
    const data = await queryDB<PrenDB>('prenotazioni', {
      select: 'id,nome_ospite,telefono_ospite,data_prenotazione,ora_arrivo,coperti,tipo_tavolo,stato,note_speciali,allergie_comunicare,con_animale,occasione_speciale',
      filters,
      order: { col: 'ora_arrivo' },
    })
    setPrenotazioni(data)
    setLoading(false)
  }

  async function aggiornaStato(id: string, stato: Stato) {
    try {
      await updateDB('prenotazioni', { stato }, { id })
      toast.success('Stato aggiornato')
      setPrenotazioni(prev => prev.map(p => p.id === id ? { ...p, stato } : p))
    } catch {
      toast.error('Errore aggiornamento')
    }
  }

  function fmtDate(d: string) {
    return new Date(d + 'T00:00:00').toLocaleDateString('it-IT', { weekday: 'short', day: 'numeric', month: 'short' })
  }

  return (
    <div className="p-5 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-base font-semibold text-slate-900">Prenotazioni</h1>
          <p className="text-xs text-slate-500">
            {prenotazioni.length} prenotazioni · {fmtDate(dataFiltro)}
          </p>
        </div>
        <button
          onClick={() => setDataFiltro(new Date().toISOString().split('T')[0])}
          className="text-xs text-orange-500 hover:underline"
        >
          Oggi
        </button>
      </div>

      {/* Filtri */}
      <div className="flex gap-2 flex-wrap items-center">
        <input
          type="date"
          value={dataFiltro}
          onChange={(e) => setDataFiltro(e.target.value)}
          className="px-3 py-1.5 rounded-md border border-slate-300 text-xs focus:outline-none focus:ring-2 focus:ring-orange-400"
        />
        <div className="flex gap-1.5 flex-wrap">
          {STATI.map((s) => (
            <button
              key={s}
              onClick={() => setStatoFiltro(s)}
              className={`px-2.5 py-1.5 rounded-md text-xs font-medium transition ${
                statoFiltro === s
                  ? 'bg-orange-500 text-white'
                  : 'bg-white border border-slate-300 text-slate-600 hover:border-orange-300'
              }`}
            >
              {STATO_LABEL[s]}
            </button>
          ))}
        </div>
      </div>

      {/* Tabella */}
      <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-slate-50 border-b border-slate-100">
              <tr>
                <th className="text-left px-4 py-2.5 font-medium text-slate-600">Ora</th>
                <th className="text-left px-4 py-2.5 font-medium text-slate-600">Ospite</th>
                <th className="text-left px-4 py-2.5 font-medium text-slate-600">Coperti</th>
                <th className="text-left px-4 py-2.5 font-medium text-slate-600">Tavolo</th>
                <th className="text-left px-4 py-2.5 font-medium text-slate-600">Note</th>
                <th className="text-left px-4 py-2.5 font-medium text-slate-600">Stato</th>
                <th className="px-4 py-2.5 font-medium text-slate-600">Azione</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {loading ? (
                [...Array(5)].map((_, i) => (
                  <tr key={i}>
                    <td colSpan={7} className="px-4 py-2.5">
                      <div className="h-3.5 bg-slate-100 rounded animate-pulse" />
                    </td>
                  </tr>
                ))
              ) : prenotazioni.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-slate-400">
                    Nessuna prenotazione per questa data
                  </td>
                </tr>
              ) : prenotazioni.map((p) => (
                <tr key={p.id} className="hover:bg-slate-50 transition">
                  <td className="px-4 py-2.5 font-semibold text-slate-900 whitespace-nowrap">
                    {p.ora_arrivo?.slice(0, 5)}
                  </td>
                  <td className="px-4 py-2.5">
                    <p className="font-medium text-slate-800">{p.nome_ospite}</p>
                    {p.telefono_ospite && (
                      <p className="text-[10px] text-slate-400">{p.telefono_ospite}</p>
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-slate-700">
                    {p.coperti}
                    {p.con_animale && <span className="ml-1">🐕</span>}
                  </td>
                  <td className="px-4 py-2.5 text-slate-600">{p.tipo_tavolo ?? '—'}</td>
                  <td className="px-4 py-2.5 text-slate-500 max-w-[200px]">
                    {p.allergie_comunicare && (
                      <p className="text-red-500 font-medium">⚠️ {p.allergie_comunicare}</p>
                    )}
                    {p.occasione_speciale && (
                      <p className="text-purple-600">🎉 {p.occasione_speciale}</p>
                    )}
                    {p.note_speciali && (
                      <p className="truncate text-slate-400">{p.note_speciali}</p>
                    )}
                  </td>
                  <td className="px-4 py-2.5">
                    <StatoBadge stato={p.stato} />
                  </td>
                  <td className="px-4 py-2.5">
                    <select
                      value={p.stato}
                      onChange={(e) => aggiornaStato(p.id, e.target.value as Stato)}
                      className="text-[10px] border border-slate-300 rounded px-1.5 py-1 focus:outline-none focus:ring-1 focus:ring-orange-400 bg-white"
                    >
                      {(['confermata', 'in_attesa', 'cancellata', 'completata', 'no_show'] as const).map(s => (
                        <option key={s} value={s}>{STATO_LABEL[s]}</option>
                      ))}
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
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
  const STATO_LABEL: Record<string, string> = {
    confermata: 'Confermata', in_attesa: 'In attesa',
    cancellata: 'Cancellata', completata: 'Completata', no_show: 'No show',
  }
  return (
    <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium whitespace-nowrap ${map[stato] ?? 'bg-gray-100'}`}>
      {STATO_LABEL[stato] ?? stato}
    </span>
  )
}
