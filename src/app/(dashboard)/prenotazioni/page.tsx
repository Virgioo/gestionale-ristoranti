'use client'

import { useEffect, useRef, useState } from 'react'
import { queryDB, updateDB } from '@/lib/api'
import toast from 'react-hot-toast'
import AllergyBadges from '@/components/AllergyBadges'
import { useRealtimeTable } from '@/hooks/useRealtimeTable'

interface PrenStatRow { nome_ospite: string; stato: string }

function AffidabilitaBadge({ pct }: { pct: number }) {
  const { bg, text } = pct >= 90
    ? { bg: 'bg-green-100',  text: 'text-green-700' }
    : pct >= 70
      ? { bg: 'bg-yellow-100', text: 'text-yellow-700' }
      : { bg: 'bg-red-100',    text: 'text-red-700' }
  return (
    <span title={`Affidabilità: ${pct}%`}
      className={`text-[10px] px-1.5 py-0.5 rounded-full font-semibold ${bg} ${text}`}>
      ●{pct}%
    </span>
  )
}

interface PrenDB {
  id: string
  sede_id: string
  nome_ospite: string
  telefono_ospite: string | null
  data_prenotazione: string
  ora_arrivo: string
  coperti: number
  tipo_tavolo: string | null
  tavolo_id: string | null
  stato: string
  note_speciali: string | null
  allergie_comunicare: string | null
  con_animale: boolean
  occasione_speciale: string | null
}

interface TavoloOpt { id: string; nome: string; salaNome: string; note: string | null }

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

const SELECT_FIELDS = 'id,sede_id,nome_ospite,telefono_ospite,data_prenotazione,ora_arrivo,coperti,tipo_tavolo,tavolo_id,stato,note_speciali,allergie_comunicare,con_animale,occasione_speciale'

export default function PrenotazioniPage() {
  const [prenotazioni, setPrenotazioni] = useState<PrenDB[]>([])
  const [loading, setLoading] = useState(true)
  const [dataFiltro, setDataFiltro] = useState(new Date().toISOString().split('T')[0])
  const [statoFiltro, setStatoFiltro] = useState<string>('tutte')
  const [prenStats, setPrenStats] = useState<Record<string, { tot: number; ns: number }>>({})
  const [tavoliPerSede, setTavoliPerSede] = useState<Record<string, TavoloOpt[]>>({})
  const [tavoliById, setTavoliById] = useState<Record<string, TavoloOpt>>({})
  const [nuoveIds, setNuoveIds] = useState<Set<string>>(new Set())

  const dataFiltroRef = useRef(dataFiltro)
  const statoFiltroRef = useRef(statoFiltro)
  useEffect(() => { dataFiltroRef.current = dataFiltro; statoFiltroRef.current = statoFiltro })

  useEffect(() => {
    queryDB<PrenStatRow>('prenotazioni', { select: 'nome_ospite,stato', limit: 5000 })
      .then(rows => {
        const m: Record<string, { tot: number; ns: number }> = {}
        for (const r of rows) {
          const k = r.nome_ospite.toLowerCase()
          if (!m[k]) m[k] = { tot: 0, ns: 0 }
          m[k].tot++
          if (r.stato === 'no_show') m[k].ns++
        }
        setPrenStats(m)
      }).catch(() => {})
  }, [])

  // Mappa tavoli/sale per il selettore "Tavolo" e le indicazioni al maitre
  useEffect(() => {
    async function loadTavoli() {
      try {
        const sale = await queryDB<{ id: string; nome: string; sede_id: string }>('sale', { select: 'id,nome,sede_id' })
        const salaById: Record<string, { nome: string; sede_id: string }> = {}
        for (const s of sale) salaById[s.id] = { nome: s.nome, sede_id: s.sede_id }

        const tavoli = await queryDB<{ id: string; nome: string; sala_id: string; note: string | null }>('tavoli', {
          select: 'id,nome,sala_id,note',
        })

        const perSede: Record<string, TavoloOpt[]> = {}
        const byId: Record<string, TavoloOpt> = {}
        for (const t of tavoli) {
          const sala = salaById[t.sala_id]
          if (!sala) continue
          const opt: TavoloOpt = { id: t.id, nome: t.nome, salaNome: sala.nome, note: t.note }
          byId[t.id] = opt
          if (!perSede[sala.sede_id]) perSede[sala.sede_id] = []
          perSede[sala.sede_id].push(opt)
        }
        for (const arr of Object.values(perSede)) arr.sort((a, b) => a.salaNome.localeCompare(b.salaNome) || a.nome.localeCompare(b.nome))
        setTavoliPerSede(perSede)
        setTavoliById(byId)
      } catch {}
    }
    loadTavoli()
  }, [])

  function getAffidabilita(nome: string): number | null {
    const k = nome.toLowerCase()
    const v = prenStats[k]
    if (!v || v.tot < 2) return null
    return Math.round(((v.tot - v.ns) / v.tot) * 100)
  }

  useEffect(() => { load() }, [dataFiltro, statoFiltro])

  async function load() {
    setLoading(true)
    const filters: { fn: string; args: unknown[] }[] = [
      { fn: 'eq', args: ['data_prenotazione', dataFiltro] },
    ]
    if (statoFiltro !== 'tutte') filters.push({ fn: 'eq', args: ['stato', statoFiltro] })
    const data = await queryDB<PrenDB>('prenotazioni', {
      select: SELECT_FIELDS,
      filters,
      order: { col: 'ora_arrivo' },
    })
    setPrenotazioni(data)
    setLoading(false)
  }

  // realtime: una nuova prenotazione (anche da /prenota/[slug]) appare subito, con badge "NUOVA" per 10s
  useRealtimeTable(
    'prenotazioni-live', 'prenotazioni',
    (payload) => {
      if (payload.eventType === 'INSERT') {
        const row = payload.new as unknown as PrenDB
        if (row.data_prenotazione !== dataFiltroRef.current) return
        if (statoFiltroRef.current !== 'tutte' && row.stato !== statoFiltroRef.current) return
        setPrenotazioni(prev => prev.some(p => p.id === row.id)
          ? prev
          : [...prev, row].sort((a, b) => a.ora_arrivo.localeCompare(b.ora_arrivo)))
        setNuoveIds(prev => new Set(prev).add(row.id))
        setTimeout(() => setNuoveIds(prev => { const n = new Set(prev); n.delete(row.id); return n }), 10_000)
        return
      }
      if (payload.eventType === 'UPDATE') {
        const row = payload.new as unknown as PrenDB
        setPrenotazioni(prev => {
          if (row.data_prenotazione !== dataFiltroRef.current) return prev.filter(p => p.id !== row.id)
          if (statoFiltroRef.current !== 'tutte' && row.stato !== statoFiltroRef.current) return prev.filter(p => p.id !== row.id)
          const exists = prev.some(p => p.id === row.id)
          if (!exists) return [...prev, row].sort((a, b) => a.ora_arrivo.localeCompare(b.ora_arrivo))
          return prev.map(p => p.id === row.id ? row : p)
        })
        return
      }
      if (payload.eventType === 'DELETE') {
        const old = payload.old as { id?: string }
        if (!old?.id) return
        setPrenotazioni(prev => prev.filter(p => p.id !== old.id))
      }
    }
  )

  async function aggiornaStato(id: string, stato: Stato) {
    try {
      await updateDB('prenotazioni', { stato }, { id })
      toast.success('Stato aggiornato')
      setPrenotazioni(prev => prev.map(p => p.id === id ? { ...p, stato } : p))
    } catch {
      toast.error('Errore aggiornamento')
    }
  }

  async function assegnaTavolo(id: string, tavoloId: string) {
    try {
      await updateDB('prenotazioni', { tavolo_id: tavoloId || null }, { id })
      setPrenotazioni(prev => prev.map(p => p.id === id ? { ...p, tavolo_id: tavoloId || null } : p))
    } catch {
      toast.error('Errore assegnazione tavolo')
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
              ) : prenotazioni.map((p) => {
                const opzioniTavolo = tavoliPerSede[p.sede_id] ?? []
                const tavoloAssegnato = p.tavolo_id ? tavoliById[p.tavolo_id] : null
                return (
                <tr key={p.id} className={`hover:bg-slate-50 transition ${nuoveIds.has(p.id) ? 'bg-emerald-50' : ''}`}>
                  <td className="px-4 py-2.5 font-semibold text-slate-900 whitespace-nowrap">
                    {p.ora_arrivo?.slice(0, 5)}
                  </td>
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <p className="font-medium text-slate-800">{p.nome_ospite}</p>
                      {nuoveIds.has(p.id) && (
                        <span className="text-[9px] px-1.5 py-0.5 rounded-full font-bold bg-emerald-500 text-white animate-pulse">NUOVA</span>
                      )}
                      {(() => { const a = getAffidabilita(p.nome_ospite); return a !== null ? <AffidabilitaBadge pct={a} /> : null })()}
                    </div>
                    {p.telefono_ospite && (
                      <p className="text-[10px] text-slate-400">{p.telefono_ospite}</p>
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-slate-700">
                    {p.coperti}
                    {p.con_animale && <span className="ml-1">🐕</span>}
                  </td>
                  <td className="px-4 py-2.5 text-slate-600 min-w-[160px]">
                    <select
                      value={p.tavolo_id ?? ''}
                      onChange={(e) => assegnaTavolo(p.id, e.target.value)}
                      className="text-[10px] border border-slate-300 rounded px-1.5 py-1 focus:outline-none focus:ring-1 focus:ring-orange-400 bg-white w-full"
                    >
                      <option value="">{p.tipo_tavolo ?? 'Nessun tavolo assegnato'}</option>
                      {opzioniTavolo.map(t => (
                        <option key={t.id} value={t.id}>{t.salaNome} — {t.nome}</option>
                      ))}
                    </select>
                    {tavoloAssegnato && (
                      <p className="text-[10px] text-emerald-600 mt-1 leading-snug">
                        📍 Accompagnare al Tavolo {tavoloAssegnato.nome}, {tavoloAssegnato.salaNome}
                        {tavoloAssegnato.note ? `, ${tavoloAssegnato.note}` : ''}.
                      </p>
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-slate-500 max-w-[200px]">
                    {p.allergie_comunicare && (
                      <div className="mb-0.5"><AllergyBadges value={p.allergie_comunicare} /></div>
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
              )})}
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
