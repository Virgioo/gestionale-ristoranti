'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { PlayCircle, RefreshCw, TrendingUp, Clock, Users, Euro, AlertTriangle, Trophy } from 'lucide-react'
import { formatEuro } from '@/lib/utils'

// ─── Types ────────────────────────────────────────────────────────────────────
interface SerataRecord {
  id: string
  data: string
  giorno_settimana: string
  meteo: string
  evento_speciale: string | null
  coperti_totali: number
  tavoli_serviti: number
  no_show: number
  revenue_totale: number
  tempo_medio_servizio_min: number
  cameriere_top: string | null
  problemi: string[]
  created_at: string
}

interface LogLine {
  emoji: string
  msg: string
  ts: string
}

// ─── Mini bar chart (SVG) ─────────────────────────────────────────────────────
function BarChart({ data, color = '#10b981', label }: {
  data: number[]
  color?: string
  label: string
}) {
  if (data.length < 2) return null
  const max = Math.max(...data, 1)
  const w = 260
  const h = 60
  const barW = Math.floor(w / data.length) - 2

  return (
    <div>
      <p className="text-[10px] text-slate-400 uppercase tracking-wide mb-1">{label}</p>
      <svg width={w} height={h} style={{ overflow: 'visible' }}>
        {data.map((v, i) => {
          const barH = Math.max(2, (v / max) * (h - 8))
          const x = i * (barW + 2)
          return (
            <g key={i}>
              <rect x={x} y={h - barH} width={barW} height={barH}
                fill={color} opacity={0.85} rx={2} />
              {barW > 20 && (
                <text x={x + barW / 2} y={h + 12} textAnchor="middle"
                  fontSize={9} fill="#6b7280">
                  {data.length <= 7 ? String(v) : ''}
                </text>
              )}
            </g>
          )
        })}
        {/* Baseline */}
        <line x1={0} y1={h} x2={w} y2={h} stroke="#1f2937" strokeWidth={1} />
      </svg>
    </div>
  )
}

// ─── Sparkline ────────────────────────────────────────────────────────────────
function Sparkline({ data, color = '#3b82f6' }: { data: number[]; color?: string }) {
  if (data.length < 2) return null
  const max = Math.max(...data, 1)
  const min = Math.min(...data, 0)
  const range = max - min || 1
  const w = 100
  const h = 28

  const pts = data.map((v, i) => {
    const x = (i / (data.length - 1)) * w
    const y = h - ((v - min) / range) * h
    return `${x},${y}`
  }).join(' ')

  return (
    <svg width={w} height={h}>
      <polyline points={pts} fill="none" stroke={color} strokeWidth={1.5}
        strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

// ─── Live terminal ────────────────────────────────────────────────────────────
function Terminal({ lines }: { lines: LogLine[] }) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (ref.current) ref.current.scrollTop = ref.current.scrollHeight
  }, [lines])

  function lineColor(emoji: string) {
    if (emoji === '🚫') return '#ef4444'
    if (emoji === '⚡') return '#f59e0b'
    if (emoji === '✅' || emoji === '💾' || emoji === '🏆') return '#4ade80'
    if (emoji === '💶') return '#34d399'
    if (emoji === '⭐') return '#a78bfa'
    if (emoji === '🕐') return '#6b7280'
    return '#d1d5db'
  }

  return (
    <div ref={ref} style={{
      background: '#0a0a0a', borderRadius: 8,
      fontFamily: "'JetBrains Mono', 'Fira Code', 'Consolas', monospace",
      fontSize: 12, lineHeight: 1.6,
      padding: '12px 16px',
      height: 340, overflowY: 'auto',
      border: '1px solid #1f1f1f',
    }}>
      {lines.length === 0 && (
        <span style={{ color: '#374151' }}>$ Nessuna simulazione in corso. Premi "Avvia nuova simulazione" per iniziare.</span>
      )}
      {lines.map((l, i) => (
        <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 2 }}>
          <span style={{ color: '#374151', flexShrink: 0, fontSize: 10 }}>[{l.ts}]</span>
          <span style={{ flexShrink: 0 }}>{l.emoji}</span>
          <span style={{ color: lineColor(l.emoji) }}>{l.msg}</span>
        </div>
      ))}
    </div>
  )
}

// ─── KPI card ─────────────────────────────────────────────────────────────────
function KPICard({ label, value, sub, icon: Icon, color }: {
  label: string; value: string; sub?: string
  icon: React.ElementType; color: string
}) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs text-slate-500">{label}</p>
          <p className="text-2xl font-bold mt-1" style={{ color }}>{value}</p>
          {sub && <p className="text-[10px] text-slate-400 mt-0.5">{sub}</p>}
        </div>
        <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: color + '18' }}>
          <Icon className="w-4 h-4" style={{ color }} />
        </div>
      </div>
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function SimulazionePage() {
  const [history,    setHistory]    = useState<SerataRecord[]>([])
  const [logLines,   setLogLines]   = useState<LogLine[]>([])
  const [running,    setRunning]    = useState(false)
  const [loading,    setLoading]    = useState(true)
  const [lastResult, setLastResult] = useState<SerataRecord | null>(null)

  const loadHistory = useCallback(async () => {
    setLoading(true)
    try {
      const r = await fetch('/api/simulazione')
      const { data } = await r.json()
      setHistory(data ?? [])
    } catch {}
    finally { setLoading(false) }
  }, [])

  useEffect(() => { loadHistory() }, [loadHistory])

  async function avviaSimulazione() {
    if (running) return
    setRunning(true)
    setLogLines([])
    setLastResult(null)

    try {
      const resp = await fetch('/api/simulazione', { method: 'POST' })
      if (!resp.body) throw new Error('No stream')

      const reader  = resp.body.getReader()
      const decoder = new TextDecoder()

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        const text = decoder.decode(value, { stream: true })
        const lines = text.split('\n').filter(l => l.startsWith('data: '))

        for (const line of lines) {
          try {
            const payload = JSON.parse(line.slice(6))
            if (payload.type === 'done') {
              setLastResult(payload.record)
              await loadHistory()
            } else if (payload.type === 'log') {
              setLogLines(prev => [...prev, { emoji: payload.emoji, msg: payload.msg, ts: payload.ts }])
            } else if (payload.type === 'error') {
              setLogLines(prev => [...prev, { emoji: '❌', msg: payload.msg, ts: new Date().toLocaleTimeString('it-IT') }])
            }
          } catch {}
        }
      }
    } catch (err) {
      setLogLines(prev => [...prev, { emoji: '❌', msg: String(err), ts: new Date().toLocaleTimeString('it-IT') }])
    } finally {
      setRunning(false)
    }
  }

  // ── Derived stats ──────────────────────────────────────────────────────────
  const recent = history.slice(0, 10).reverse() // chronological for charts
  const revenueData = recent.map(s => s.revenue_totale)
  const tempoData   = recent.map(s => s.tempo_medio_servizio_min)
  const copertiData = recent.map(s => s.coperti_totali)

  const avgRevenue  = history.length ? history.reduce((s, h) => s + h.revenue_totale, 0) / history.length : 0
  const avgTempo    = history.length ? Math.round(history.reduce((s, h) => s + h.tempo_medio_servizio_min, 0) / history.length) : 0
  const totalNoShow = history.reduce((s, h) => s + h.no_show, 0)

  // Cameriere più produttivo in assoluto
  const cameriereCounts: Record<string, number> = {}
  history.forEach(h => { if (h.cameriere_top) cameriereCounts[h.cameriere_top] = (cameriereCounts[h.cameriere_top] ?? 0) + 1 })
  const cameriereMvp = Object.entries(cameriereCounts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? '—'

  // Problemi più frequenti
  const allProblemi = history.flatMap(h => h.problemi ?? [])
  const tipiProblemi = { no_show: 0, allergia: 0, errore: 0, lento: 0, esaurito: 0, speciale: 0 }
  allProblemi.forEach(p => {
    if (p.includes('no-show') || p.includes('no_show')) tipiProblemi.no_show++
    else if (p.includes('ALLERGIA') || p.includes('allergia')) tipiProblemi.allergia++
    else if (p.includes('ERRORE')) tipiProblemi.errore++
    else if (p.includes('🐌')) tipiProblemi.lento++
    else if (p.includes('saurit')) tipiProblemi.esaurito++
    else tipiProblemi.speciale++
  })

  return (
    <div className="p-6 space-y-5 max-w-6xl">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-violet-600 flex items-center justify-center shrink-0">
            <PlayCircle className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900">Simulazione Serata</h1>
            <p className="text-slate-500 text-xs">Solo admin · Ogni run genera una serata unica e la salva nello storico</p>
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={loadHistory} disabled={loading}
            className="flex items-center gap-1.5 px-3 py-2 text-xs border border-slate-200 text-slate-600 rounded-xl hover:bg-slate-50 disabled:opacity-50 transition">
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} /> Aggiorna
          </button>
          <button
            onClick={avviaSimulazione}
            disabled={running}
            className="flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-xl transition disabled:opacity-60 disabled:cursor-not-allowed"
            style={{ background: running ? '#4c1d95' : '#7c3aed', color: '#fff' }}
          >
            <PlayCircle className={`w-4 h-4 ${running ? 'animate-pulse' : ''}`} />
            {running ? 'Simulazione in corso...' : 'Avvia nuova simulazione'}
          </button>
        </div>
      </div>

      {/* Live terminal */}
      <div>
        <div className="flex items-center gap-2 mb-2">
          <div className={`w-2 h-2 rounded-full ${running ? 'bg-green-400 animate-pulse' : 'bg-slate-300'}`} />
          <p className="text-xs font-semibold text-slate-600 uppercase tracking-wide">
            {running ? 'Simulazione in corso...' : 'Log ultima simulazione'}
          </p>
        </div>
        <Terminal lines={logLines} />
      </div>

      {/* Last result highlight */}
      {lastResult && (
        <div className="bg-violet-50 border border-violet-200 rounded-xl p-4">
          <p className="text-sm font-semibold text-violet-800 mb-3">
            ✅ Serata simulata — {lastResult.giorno_settimana} {lastResult.data}
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-white rounded-lg p-3 border border-violet-100 text-center">
              <p className="text-xs text-slate-500">Revenue</p>
              <p className="text-xl font-bold text-green-600">{formatEuro(lastResult.revenue_totale)}</p>
            </div>
            <div className="bg-white rounded-lg p-3 border border-violet-100 text-center">
              <p className="text-xs text-slate-500">Coperti</p>
              <p className="text-xl font-bold text-blue-600">{lastResult.coperti_totali}</p>
            </div>
            <div className="bg-white rounded-lg p-3 border border-violet-100 text-center">
              <p className="text-xs text-slate-500">Tempo medio</p>
              <p className="text-xl font-bold text-orange-600">{lastResult.tempo_medio_servizio_min} min</p>
            </div>
            <div className="bg-white rounded-lg p-3 border border-violet-100 text-center">
              <p className="text-xs text-slate-500">Top cameriere</p>
              <p className="text-xl font-bold text-violet-600">{lastResult.cameriere_top ?? '—'}</p>
            </div>
          </div>
        </div>
      )}

      {/* KPIs aggregate */}
      {history.length > 0 && (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <KPICard label="Revenue media" value={formatEuro(avgRevenue)}
              icon={Euro} color="#10b981"
              sub={`su ${history.length} serate`} />
            <KPICard label="Tempo medio svc" value={`${avgTempo} min`}
              icon={Clock} color="#f59e0b" />
            <KPICard label="No-show totali" value={String(totalNoShow)}
              icon={AlertTriangle} color="#ef4444"
              sub={`${history.length > 0 ? (totalNoShow / history.length).toFixed(1) : 0} per serata`} />
            <KPICard label="Cameriere MVP" value={cameriereMvp}
              icon={Trophy} color="#8b5cf6"
              sub="più serate come top" />
          </div>

          {/* Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="bg-white rounded-xl border border-slate-200 p-4">
              <div className="flex items-center justify-between mb-3">
                <p className="text-sm font-semibold text-slate-800">Revenue per serata</p>
                <Sparkline data={revenueData} color="#10b981" />
              </div>
              <BarChart data={revenueData} color="#10b981" label="€ ultimi 10 run" />
            </div>
            <div className="bg-white rounded-xl border border-slate-200 p-4">
              <div className="flex items-center justify-between mb-3">
                <p className="text-sm font-semibold text-slate-800">Tempo medio servizio</p>
                <Sparkline data={tempoData} color="#f59e0b" />
              </div>
              <BarChart data={tempoData} color="#f59e0b" label="minuti ultimi 10 run" />
            </div>
            <div className="bg-white rounded-xl border border-slate-200 p-4">
              <div className="flex items-center justify-between mb-3">
                <p className="text-sm font-semibold text-slate-800">Coperti per serata</p>
                <Sparkline data={copertiData} color="#3b82f6" />
              </div>
              <BarChart data={copertiData} color="#3b82f6" label="coperti ultimi 10 run" />
            </div>
          </div>

          {/* Problemi ricorrenti */}
          {allProblemi.length > 0 && (
            <div className="bg-white rounded-xl border border-slate-200 p-4">
              <p className="text-sm font-semibold text-slate-800 mb-3">Problemi ricorrenti</p>
              <div className="flex flex-wrap gap-2">
                {Object.entries(tipiProblemi).filter(([, v]) => v > 0)
                  .sort((a, b) => b[1] - a[1])
                  .map(([tipo, count]) => {
                    const LABEL: Record<string, string> = {
                      no_show: '🚫 No-show', allergia: '⚠️ Allergia', errore: '❌ Errore ordine',
                      lento: '🐌 Tavolo lento', esaurito: '📛 Piatto esaurito', speciale: '✨ Dieta speciale',
                    }
                    const pct = Math.round((count / history.length) * 100)
                    return (
                      <div key={tipo} className="flex items-center gap-2 bg-red-50 border border-red-100 rounded-lg px-3 py-1.5">
                        <span className="text-sm">{LABEL[tipo]}</span>
                        <span className="text-xs font-bold text-red-600">{count}×</span>
                        <span className="text-[10px] text-slate-400">{pct}% serate</span>
                      </div>
                    )
                  })}
              </div>
            </div>
          )}

          {/* History table */}
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-100 flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-slate-500" />
              <p className="text-sm font-semibold text-slate-800">Storico serate simulate</p>
              <span className="ml-auto text-xs text-slate-400">{history.length} record</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-100">
                    {['Data','Giorno','Meteo','Evento','Coperti','Revenue','Tempo','No-show','Top Cameriere'].map(h => (
                      <th key={h} className="px-3 py-2.5 text-left text-[10px] uppercase tracking-wide font-medium text-slate-400 whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {history.slice(0, 20).map(s => (
                    <tr key={s.id} className="hover:bg-slate-50 transition">
                      <td className="px-3 py-2.5 text-slate-600 whitespace-nowrap">{s.data}</td>
                      <td className="px-3 py-2.5 font-medium text-slate-800 whitespace-nowrap">{s.giorno_settimana}</td>
                      <td className="px-3 py-2.5 whitespace-nowrap">{s.meteo}</td>
                      <td className="px-3 py-2.5 whitespace-nowrap">
                        {s.evento_speciale
                          ? <span className="bg-violet-50 text-violet-700 px-1.5 py-0.5 rounded text-[10px] font-medium">{s.evento_speciale}</span>
                          : <span className="text-slate-300">—</span>}
                      </td>
                      <td className="px-3 py-2.5">
                        <div className="flex items-center gap-1.5">
                          <Users className="w-3 h-3 text-blue-400" />
                          <span className="font-medium text-slate-800">{s.coperti_totali}</span>
                        </div>
                      </td>
                      <td className="px-3 py-2.5">
                        <span className={`font-bold ${s.revenue_totale >= 5000 ? 'text-green-600' : s.revenue_totale >= 3000 ? 'text-yellow-600' : 'text-red-500'}`}>
                          {formatEuro(s.revenue_totale)}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 text-slate-600">{s.tempo_medio_servizio_min} min</td>
                      <td className="px-3 py-2.5">
                        {s.no_show > 0
                          ? <span className="bg-red-50 text-red-600 px-1.5 py-0.5 rounded text-[10px] font-medium">{s.no_show}</span>
                          : <span className="text-slate-300">0</span>}
                      </td>
                      <td className="px-3 py-2.5 font-medium text-violet-600">{s.cameriere_top ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {!loading && history.length === 0 && (
        <div className="text-center py-16">
          <PlayCircle className="w-12 h-12 text-slate-200 mx-auto mb-4" />
          <p className="text-slate-400 text-sm font-medium">Nessuna serata simulata ancora</p>
          <p className="text-slate-300 text-xs mt-1">Premi "Avvia nuova simulazione" per iniziare</p>
          <p className="text-amber-600 text-xs mt-3">
            ⚠️ Prima esegui la migration SQL:
            <code className="ml-1 bg-amber-50 px-1 rounded">supabase/migrations/20260707_create_serate_simulate.sql</code>
          </p>
        </div>
      )}
    </div>
  )
}
