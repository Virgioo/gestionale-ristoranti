'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase'
import { queryDB } from '@/lib/api'
import { isAdmin } from '@/lib/roles'
import { formatEuro } from '@/lib/utils'
import type { User } from '@supabase/supabase-js'
import { TrendingUp, TrendingDown, Euro, Users, BarChart2, Award, ChevronDown, Sparkles, Loader2 } from 'lucide-react'

/* ── Tipi ───────────────────────────────────────────────────────────────── */
interface VisitaRow {
  data_visita: string; importo: number
  sede_id: string | null; cliente_id: string | null
  sedi: { nome: string } | null
  clienti: { nome: string; cognome: string } | null
}
interface ComandaRow {
  cameriere: string | null; totale: number
}
interface CamerierePerf {
  nome: string; totale: number; tavoli: number; media: number
  prevTotale: number; prevTavoli: number
}
interface GiornoData  { data: string; totale: number; visite: number }
interface SedeData    { nome: string; totale: number; visite: number; prevTotale: number }
interface ClienteTop  { id: string; nome: string; totale: number; visite: number; media: number }

/* ── helpers ─────────────────────────────────────────────────────────────── */
function groupByDay(visite: VisitaRow[]): GiornoData[] {
  const m: Record<string, GiornoData> = {}
  for (const v of visite) {
    if (!m[v.data_visita]) m[v.data_visita] = { data: v.data_visita, totale: 0, visite: 0 }
    m[v.data_visita].totale += v.importo; m[v.data_visita].visite += 1
  }
  return Object.values(m).sort((a, b) => a.data.localeCompare(b.data))
}

function groupBySede(curr: VisitaRow[], prev: VisitaRow[]): SedeData[] {
  const m: Record<string, SedeData> = {}
  for (const v of curr) {
    const nome = v.sedi?.nome ?? 'Sconosciuta'
    if (!m[nome]) m[nome] = { nome, totale: 0, visite: 0, prevTotale: 0 }
    m[nome].totale += v.importo; m[nome].visite += 1
  }
  for (const v of prev) {
    const nome = v.sedi?.nome ?? 'Sconosciuta'
    if (!m[nome]) m[nome] = { nome, totale: 0, visite: 0, prevTotale: 0 }
    m[nome].prevTotale += v.importo
  }
  return Object.values(m).sort((a, b) => b.totale - a.totale)
}

function topClienti(visite: VisitaRow[]): ClienteTop[] {
  const m: Record<string, ClienteTop> = {}
  for (const v of visite) {
    if (!v.cliente_id || !v.clienti) continue
    if (!m[v.cliente_id]) m[v.cliente_id] = { id: v.cliente_id, nome: `${v.clienti.nome} ${v.clienti.cognome}`, totale: 0, visite: 0, media: 0 }
    m[v.cliente_id].totale += v.importo; m[v.cliente_id].visite += 1
  }
  return Object.values(m).map(c => ({ ...c, media: c.totale / c.visite })).sort((a, b) => b.totale - a.totale).slice(0, 5)
}

function trend(curr: number, prev: number) {
  if (prev === 0) return null
  const pct = Math.round(((curr - prev) / prev) * 100)
  return { pct, up: pct >= 0 }
}

function buildMeseData(visite: VisitaRow[]) {
  const m: Record<string, { totale: number; visite: number }> = {}
  for (const v of visite) {
    const mese = v.data_visita.slice(0, 7)
    if (!m[mese]) m[mese] = { totale: 0, visite: 0 }
    m[mese].totale += v.importo; m[mese].visite += 1
  }
  return Object.entries(m).sort(([a], [b]) => b.localeCompare(a)).map(([mese, d]) => ({
    mese: new Date(mese + '-01').toLocaleDateString('it-IT', { month: 'long', year: 'numeric' }), ...d,
  }))
}

/* ── Line chart SVG ─────────────────────────────────────────────────────── */
const SEDE_COLORS = ['#f97316','#3b82f6','#10b981','#a855f7','#ec4899','#f59e0b']

function LineChart({ days, maxVal }: { days: GiornoData[]; maxVal: number }) {
  if (days.length < 2) return <p className="text-slate-400 text-sm text-center py-8">Dati insufficienti per il grafico</p>
  const W = 900, H = 180, PAD = { top: 16, right: 16, bottom: 32, left: 56 }
  const cw = W - PAD.left - PAD.right, ch = H - PAD.top - PAD.bottom
  const pts = days.map((d, i) => ({
    x: PAD.left + (i / (days.length - 1)) * cw,
    y: PAD.top + ch - (maxVal > 0 ? (d.totale / maxVal) * ch : 0), d,
  }))
  const linePath = `M ${pts.map(p => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' L ')}`
  const areaPath = `M ${pts[0].x.toFixed(1)},${(PAD.top + ch).toFixed(1)} L ${pts.map(p => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' L ')} L ${pts[pts.length-1].x.toFixed(1)},${(PAD.top + ch).toFixed(1)} Z`
  const yTicks = [0, 0.25, 0.5, 0.75, 1].map(f => ({ y: PAD.top + ch - f * ch, val: maxVal * f }))
  const xStep = Math.ceil(days.length / 7)
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height: H }}>
      <defs>
        <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#f97316" stopOpacity="0.25" />
          <stop offset="100%" stopColor="#f97316" stopOpacity="0.02" />
        </linearGradient>
      </defs>
      {yTicks.map(t => (
        <g key={t.y}>
          <line x1={PAD.left} y1={t.y} x2={W - PAD.right} y2={t.y} stroke="#f1f5f9" strokeWidth={1} />
          <text x={PAD.left - 6} y={t.y + 4} textAnchor="end" fontSize={9} fill="#94a3b8">
            {t.val >= 1000 ? `${(t.val/1000).toFixed(0)}k` : t.val.toFixed(0)}
          </text>
        </g>
      ))}
      <path d={areaPath} fill="url(#revGrad)" />
      <path d={linePath} fill="none" stroke="#f97316" strokeWidth={2} strokeLinejoin="round" />
      {pts.map((p, i) => (
        <g key={i}>
          {i % xStep === 0 && <text x={p.x} y={H - 4} textAnchor="middle" fontSize={9} fill="#94a3b8">{p.d.data.slice(5)}</text>}
          <circle cx={p.x} cy={p.y} r={3} fill="#f97316" stroke="white" strokeWidth={1.5}>
            <title>{p.d.data}: {formatEuro(p.d.totale)} ({p.d.visite} visite)</title>
          </circle>
        </g>
      ))}
    </svg>
  )
}

/* ── Sede breakdown con trend ───────────────────────────────────────────── */
function SedeBreakdown({ sedi, totale }: { sedi: SedeData[]; totale: number }) {
  if (!sedi.length) return <p className="text-slate-400 text-sm text-center py-6">Nessun dato</p>
  return (
    <div className="space-y-4">
      {sedi.map((s, i) => {
        const pct = totale > 0 ? (s.totale / totale) * 100 : 0
        const color = SEDE_COLORS[i % SEDE_COLORS.length]
        const t = trend(s.totale, s.prevTotale)
        const media = s.visite > 0 ? s.totale / s.visite : 0
        return (
          <div key={s.nome}>
            <div className="flex items-center justify-between text-xs mb-1">
              <span className="font-medium text-slate-700 truncate max-w-[55%]">{s.nome.replace('Scogliera di ', '')}</span>
              <div className="flex items-center gap-2 text-right">
                {t && (
                  <span className={`flex items-center gap-0.5 text-[10px] font-semibold ${t.up ? 'text-green-600' : 'text-red-500'}`}>
                    {t.up ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                    {t.up ? '+' : ''}{t.pct}%
                  </span>
                )}
                <span className="text-slate-500">{formatEuro(s.totale)}</span>
                <span className="text-slate-400 text-[10px]">({pct.toFixed(0)}%)</span>
              </div>
            </div>
            <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
              <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, background: color }} />
            </div>
            <div className="flex gap-3 mt-0.5 text-[10px] text-slate-400">
              <span>{s.visite} visite</span>
              <span>·</span>
              <span>scontrino medio {formatEuro(media)}</span>
              <span>·</span>
              <span>{pct.toFixed(1)}% sul totale gruppo</span>
            </div>
          </div>
        )
      })}
    </div>
  )
}

/* ── Camerieri Performance ────────────────────────────────────────────── */
function buildCamerieriPerf(curr: ComandaRow[], prev: ComandaRow[]): CamerierePerf[] {
  const m: Record<string, CamerierePerf> = {}
  for (const c of curr) {
    if (!c.cameriere) continue
    if (!m[c.cameriere]) m[c.cameriere] = { nome: c.cameriere, totale: 0, tavoli: 0, media: 0, prevTotale: 0, prevTavoli: 0 }
    m[c.cameriere].totale  += c.totale ?? 0
    m[c.cameriere].tavoli  += 1
  }
  for (const c of prev) {
    if (!c.cameriere) continue
    if (!m[c.cameriere]) m[c.cameriere] = { nome: c.cameriere, totale: 0, tavoli: 0, media: 0, prevTotale: 0, prevTavoli: 0 }
    m[c.cameriere].prevTotale += c.totale ?? 0
    m[c.cameriere].prevTavoli += 1
  }
  return Object.values(m)
    .map(c => ({ ...c, media: c.tavoli > 0 ? c.totale / c.tavoli : 0 }))
    .sort((a, b) => b.totale - a.totale)
}

function CamerieriSection({ perf, loading }: { perf: CamerierePerf[]; loading: boolean }) {
  if (loading) return <div className="h-32 animate-pulse bg-slate-100 rounded-lg" />
  if (perf.length === 0) return (
    <p className="text-center text-slate-400 text-sm py-8">
      Nessuna comanda con cameriere assegnato nel periodo.<br />
      <span className="text-xs">Assegna il cameriere nelle comande per vedere le performance.</span>
    </p>
  )
  return (
    <table className="w-full text-xs">
      <thead>
        <tr className="bg-slate-50 border-b border-slate-100">
          {['#', 'Cameriere', 'Venduto settimana', 'Tavoli', 'Scontrino medio', 'Trend'].map(h => (
            <th key={h} className="px-4 py-3 text-left text-[10px] uppercase tracking-wide font-medium text-slate-500">{h}</th>
          ))}
        </tr>
      </thead>
      <tbody className="divide-y divide-slate-50">
        {perf.map((c, i) => {
          const t = c.prevTotale > 0 ? Math.round(((c.totale - c.prevTotale) / c.prevTotale) * 100) : null
          return (
            <tr key={c.nome} className="hover:bg-slate-50 transition">
              <td className="px-4 py-3">
                <span className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold
                  ${i === 0 ? 'bg-yellow-100 text-yellow-700' : i === 1 ? 'bg-slate-100 text-slate-600' : i === 2 ? 'bg-orange-100 text-orange-600' : 'bg-slate-50 text-slate-400'}`}>
                  {i + 1}
                </span>
              </td>
              <td className="px-4 py-3 font-semibold text-slate-800">{c.nome}</td>
              <td className="px-4 py-3 font-bold text-orange-600">{formatEuro(c.totale)}</td>
              <td className="px-4 py-3 text-slate-500">{c.tavoli}</td>
              <td className="px-4 py-3 text-slate-600">{formatEuro(c.media)}</td>
              <td className="px-4 py-3">
                {t !== null ? (
                  <span className={`flex items-center gap-0.5 font-semibold text-[11px] ${t >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                    {t >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                    {t >= 0 ? '+' : ''}{t}%
                  </span>
                ) : <span className="text-slate-300 text-[10px]">—</span>}
              </td>
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}

/* ── KPI card espandibile ──────────────────────────────────────────────── */
function KpiCard({
  label, value, icon: Icon, color, sub, tup,
  expanded, onToggle, children,
}: {
  label: string; value: string; icon: React.ElementType; color: string
  sub: string; tup?: boolean
  expanded: boolean; onToggle: () => void; children?: React.ReactNode
}) {
  return (
    <div className={`bg-white rounded-xl border border-slate-200 overflow-hidden transition-shadow ${expanded ? 'shadow-md' : ''}`}>
      <button className="w-full text-left p-5 hover:bg-slate-50/50 transition" onClick={onToggle}>
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs text-slate-500">{label}</p>
          <div className="flex items-center gap-1">
            <Icon className={`w-4 h-4 ${color} opacity-60`} />
            <ChevronDown className={`w-3.5 h-3.5 text-slate-300 transition-transform ${expanded ? 'rotate-180' : ''}`} />
          </div>
        </div>
        <p className={`text-2xl font-bold ${color}`}>{value}</p>
        <p className={`text-xs mt-1 flex items-center gap-1 ${tup === true ? 'text-green-600' : tup === false ? 'text-red-500' : 'text-slate-400'}`}>
          {tup === true && <TrendingUp className="w-3 h-3" />}
          {tup === false && <TrendingDown className="w-3 h-3" />}
          {sub}
        </p>
      </button>
      {expanded && children && (
        <div className="border-t border-slate-100 bg-slate-50/50 px-5 py-4">{children}</div>
      )}
    </div>
  )
}

/* ── Sezione Analisi AI ─────────────────────────────────────────────────── */
function AnalisiAI({ visite, sedi, giorni, prevTotale, periodo }: {
  visite: VisitaRow[]; sedi: SedeData[]; giorni: GiornoData[]
  prevTotale: number; periodo: string
}) {
  const [testo, setTesto]     = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [loaded, setLoaded]   = useState(false)

  const analizza = useCallback(async () => {
    if (loading || loaded) return
    setLoading(true)
    const totale = visite.reduce((s, v) => s + v.importo, 0)
    const media  = visite.length > 0 ? totale / visite.length : 0
    const topSede = sedi[0]
    const botSede = sedi[sedi.length - 1]
    const pctTrend = prevTotale > 0 ? Math.round(((totale - prevTotale) / prevTotale) * 100) : null

    const giornoMax = [...giorni].sort((a, b) => b.totale - a.totale)[0]
    const giornoMin = [...giorni].sort((a, b) => a.totale - b.totale)[0]

    const prompt = `Sei un consulente esperto di ristorazione. Analizza questi dati reali del ristorante e dai ESATTAMENTE 2 consigli concreti, specifici e azionabili basati SOLO sui numeri forniti. Ogni consiglio deve citare un numero reale dai dati.

DATI PERIODO (${periodo}):
- Revenue totale: ${formatEuro(totale)}
- Visite: ${visite.length}
- Scontrino medio: ${formatEuro(media)}
- Trend vs periodo precedente: ${pctTrend !== null ? `${pctTrend > 0 ? '+' : ''}${pctTrend}%` : 'non disponibile'}
- Sede migliore: ${topSede?.nome ?? '—'} (${formatEuro(topSede?.totale ?? 0)}, ${sedi.length > 0 ? ((topSede?.totale ?? 0) / totale * 100).toFixed(0) : 0}% del totale, scontrino medio ${formatEuro(topSede ? topSede.totale / topSede.visite : 0)})
- Sede con meno revenue: ${botSede?.nome ?? '—'} (${formatEuro(botSede?.totale ?? 0)}, scontrino medio ${formatEuro(botSede ? botSede.totale / botSede.visite : 0)})
- Giorno migliore: ${giornoMax?.data ?? '—'} (${formatEuro(giornoMax?.totale ?? 0)})
- Giorno peggiore: ${giornoMin?.data ?? '—'} (${formatEuro(giornoMin?.totale ?? 0)})
- Numero sedi attive: ${sedi.length}

Rispondi SOLO con 2 punti nel formato esatto:
• [Insight breve]: [Azione concreta con numeri]
• [Insight breve]: [Azione concreta con numeri]

Niente introduzioni, niente conclusioni. Solo 2 bullet point.`

    try {
      const res = await fetch('/api/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: [{ role: 'user', content: prompt }] }),
      })
      const data = await res.json()
      setTesto(data.content?.[0]?.text ?? 'Analisi non disponibile.')
    } catch {
      setTesto('Impossibile generare analisi. Controlla la connessione.')
    } finally {
      setLoading(false)
      setLoaded(true)
    }
  }, [visite, sedi, giorni, prevTotale, periodo, loading, loaded])

  // Reset quando cambiano i dati
  useEffect(() => {
    setTesto(null)
    setLoaded(false)
  }, [periodo])

  return (
    <div className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-xl overflow-hidden">
      <div className="flex items-center justify-between px-5 py-4 border-b border-white/10">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-amber-400" />
          <h2 className="font-semibold text-white text-sm">Analisi AI</h2>
          <span className="text-[10px] px-2 py-0.5 bg-amber-400/20 text-amber-300 rounded-full font-medium">Groq · llama-3.3-70b</span>
        </div>
        {!loaded && (
          <button
            onClick={analizza}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-500 hover:bg-amber-400 text-white text-xs font-medium rounded-lg transition disabled:opacity-60"
          >
            {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
            {loading ? 'Analisi in corso...' : 'Genera consigli'}
          </button>
        )}
        {loaded && (
          <button
            onClick={() => { setLoaded(false); setTesto(null) }}
            className="text-xs text-slate-400 hover:text-white transition"
          >
            Rigenera
          </button>
        )}
      </div>

      <div className="px-5 py-4">
        {!loaded && !loading && (
          <p className="text-slate-400 text-sm">
            Clicca <span className="text-amber-400 font-medium">Genera consigli</span> per ricevere 1-2 suggerimenti concreti basati sui dati reali del periodo selezionato.
          </p>
        )}
        {loading && (
          <div className="flex items-center gap-3 py-2">
            <Loader2 className="w-4 h-4 text-amber-400 animate-spin shrink-0" />
            <p className="text-slate-400 text-sm">Analisi dati in corso...</p>
          </div>
        )}
        {testo && (
          <div className="space-y-3">
            {testo.split('\n').filter(l => l.trim().startsWith('•')).map((line, i) => {
              const parts = line.replace('•', '').trim().split(':')
              const titolo = parts[0]?.trim()
              const corpo  = parts.slice(1).join(':').trim()
              return (
                <div key={i} className="flex gap-3">
                  <span className="w-5 h-5 rounded-full bg-amber-400/20 flex items-center justify-center text-amber-400 text-[10px] font-bold shrink-0 mt-0.5">{i + 1}</span>
                  <div>
                    {titolo && <p className="text-white text-sm font-semibold">{titolo}</p>}
                    {corpo   && <p className="text-slate-300 text-xs mt-0.5 leading-relaxed">{corpo}</p>}
                    {!titolo && !corpo && <p className="text-slate-300 text-xs leading-relaxed">{line.replace('•', '').trim()}</p>}
                  </div>
                </div>
              )
            })}
            {/* Fallback se il formato non è a bullet point */}
            {!testo.includes('•') && (
              <p className="text-slate-300 text-sm leading-relaxed whitespace-pre-line">{testo}</p>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

/* ════════════════════════════════════════════════════════════════════════════
   PAGINA
═══════════════════════════════════════════════════════════════════════════ */
export default function RevenuePage() {
  const [visite,       setVisite]      = useState<VisitaRow[]>([])
  const [prevVisite,   setPrevVisite]  = useState<VisitaRow[]>([])
  const [prevTotale,   setPrevTotale]  = useState(0)
  const [loading,      setLoading]     = useState(true)
  const [periodo,      setPeriodo]     = useState<'7g' | '30g' | '90g' | '365g'>('30g')
  const [expandedKpi,  setExpanded]    = useState<string | null>(null)
  const [user,         setUser]        = useState<User | null>(null)
  const [camPerf,      setCamPerf]     = useState<CamerierePerf[]>([])
  const [camLoading,   setCamLoading]  = useState(false)

  useEffect(() => { createClient().auth.getUser().then(({ data }) => setUser(data.user)) }, [])

  useEffect(() => {
    async function load() {
      setLoading(true)
      const days = { '7g': 7, '30g': 30, '90g': 90, '365g': 365 }[periodo]
      const from = new Date(); from.setDate(from.getDate() - days)
      const fromStr = from.toISOString().split('T')[0]
      const prev = new Date(from); prev.setDate(prev.getDate() - days)
      const prevStr = prev.toISOString().split('T')[0]

      const [curr, prevData] = await Promise.all([
        queryDB<VisitaRow>('visite', {
          select: 'data_visita,importo,sede_id,cliente_id,sedi(nome),clienti(nome,cognome)',
          filters: [{ fn: 'gte', args: ['data_visita', fromStr] }],
          order: { col: 'data_visita', asc: true },
        }),
        queryDB<VisitaRow>('visite', {
          select: 'importo,sede_id,sedi(nome)',
          filters: [{ fn: 'gte', args: ['data_visita', prevStr] }, { fn: 'lt', args: ['data_visita', fromStr] }],
        }),
      ])
      setVisite(curr)
      setPrevVisite(prevData)
      setPrevTotale(prevData.reduce((s, v) => s + v.importo, 0))
      setLoading(false)
    }
    load()
  }, [periodo])

  // Carica performance camerieri — indipendente dal periodo principale (sempre 7gg)
  useEffect(() => {
    if (!isAdmin(user)) return
    setCamLoading(true)
    const weekAgo     = new Date(Date.now() - 7  * 86_400_000).toISOString()
    const twoWeeksAgo = new Date(Date.now() - 14 * 86_400_000).toISOString()
    Promise.all([
      queryDB<ComandaRow>('comande', {
        select: 'cameriere,totale',
        filters: [
          { fn: 'gte',  args: ['created_at', weekAgo] },
          { fn: 'not',  args: ['cameriere', 'is', null] },
        ],
        limit: 500,
      }).catch(() => [] as ComandaRow[]),
      queryDB<ComandaRow>('comande', {
        select: 'cameriere,totale',
        filters: [
          { fn: 'gte',  args: ['created_at', twoWeeksAgo] },
          { fn: 'lt',   args: ['created_at', weekAgo] },
          { fn: 'not',  args: ['cameriere', 'is', null] },
        ],
        limit: 500,
      }).catch(() => [] as ComandaRow[]),
    ]).then(([curr, prev]) => {
      setCamPerf(buildCamerieriPerf(curr, prev))
    }).finally(() => setCamLoading(false))
  }, [user])

  const totale      = visite.reduce((s, v) => s + v.importo, 0)
  const media       = visite.length > 0 ? totale / visite.length : 0
  const giorni      = groupByDay(visite)
  const maxGiorno   = Math.max(...giorni.map(d => d.totale), 1)
  const sedi        = groupBySede(visite, prevVisite)
  const top5        = topClienti(visite)
  const mediaGiorno = giorni.length > 0 ? giorni.reduce((s, d) => s + d.totale / d.visite, 0) / giorni.length : 0
  const t           = trend(totale, prevTotale)

  const toggleKpi = (label: string) => setExpanded(prev => prev === label ? null : label)

  const PERIODI = ['7g','30g','90g','365g'] as const
  const admin = isAdmin(user)

  return (
    <div className="p-6 space-y-6 max-w-7xl">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-orange-500 flex items-center justify-center">
            <Euro className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900">Revenue</h1>
            <p className="text-slate-500 text-xs">Analisi entrate del ristorante</p>
          </div>
        </div>
        <div className="flex gap-1.5">
          {PERIODI.map(p => (
            <button key={p} onClick={() => setPeriodo(p)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${periodo === p ? 'bg-orange-500 text-white' : 'bg-white border border-slate-200 text-slate-600 hover:border-orange-300'}`}>
              {p}
            </button>
          ))}
        </div>
      </div>

      {/* KPI row — espandibili */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          label="Revenue totale" value={formatEuro(totale)} icon={Euro} color="text-orange-600"
          sub={t ? `${t.up ? '+' : ''}${t.pct}% vs periodo prec.` : `ultimi ${periodo}`}
          tup={t?.up} expanded={expandedKpi === 'rev'} onToggle={() => toggleKpi('rev')}
        >
          <div className="space-y-1.5">
            <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide mb-2">Per sede</p>
            {sedi.map((s, i) => (
              <div key={s.nome} className="flex justify-between text-xs">
                <span className="text-slate-600 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full inline-block" style={{ background: SEDE_COLORS[i % SEDE_COLORS.length] }} />
                  {s.nome.replace('Scogliera di ', '')}
                </span>
                <span className="font-medium text-slate-800">{formatEuro(s.totale)}</span>
              </div>
            ))}
          </div>
        </KpiCard>

        <KpiCard
          label="Visite totali" value={String(visite.length)} icon={BarChart2} color="text-blue-600"
          sub={`nel periodo`} expanded={expandedKpi === 'visite'} onToggle={() => toggleKpi('visite')}
        >
          <div className="space-y-1.5">
            <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide mb-2">Ultimi 7 giorni</p>
            {[...giorni].sort((a, b) => b.data.localeCompare(a.data)).slice(0, 7).map(g => (
              <div key={g.data} className="flex justify-between text-xs">
                <span className="text-slate-600">{g.data.slice(5)}</span>
                <span className="font-medium text-slate-800">{g.visite} visite</span>
              </div>
            ))}
          </div>
        </KpiCard>

        <KpiCard
          label="Scontrino medio" value={formatEuro(media)} icon={TrendingUp} color="text-green-600"
          sub={`per visita`} expanded={expandedKpi === 'scontrino'} onToggle={() => toggleKpi('scontrino')}
        >
          <div className="space-y-1.5">
            <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide mb-2">Per sede</p>
            {sedi.map(s => (
              <div key={s.nome} className="flex justify-between text-xs">
                <span className="text-slate-600">{s.nome.replace('Scogliera di ', '')}</span>
                <span className="font-medium text-slate-800">{formatEuro(s.visite > 0 ? s.totale / s.visite : 0)}</span>
              </div>
            ))}
          </div>
        </KpiCard>

        <KpiCard
          label="Media giornaliera" value={formatEuro(mediaGiorno)} icon={Award} color="text-purple-600"
          sub={`scontrino medio/gg`} expanded={expandedKpi === 'media'} onToggle={() => toggleKpi('media')}
        >
          <div className="space-y-1.5">
            <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide mb-2">Per mese</p>
            {buildMeseData(visite).slice(0, 4).map(m => (
              <div key={m.mese} className="flex justify-between text-xs">
                <span className="text-slate-600 capitalize">{m.mese}</span>
                <span className="font-medium text-slate-800">{formatEuro(m.totale / m.visite)}</span>
              </div>
            ))}
          </div>
        </KpiCard>
      </div>

      {/* Line chart */}
      <div className="bg-white rounded-xl border border-slate-200 p-5">
        <h2 className="font-semibold text-slate-900 mb-4 text-sm">Andamento revenue giorno per giorno</h2>
        {loading ? <div className="h-48 animate-pulse bg-slate-100 rounded-lg" /> : <LineChart days={giorni} maxVal={maxGiorno} />}
      </div>

      {/* 2 cols: Sede breakdown + Scontrino medio giornaliero */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <h2 className="font-semibold text-slate-900 mb-4 text-sm">Breakdown per sede</h2>
          {loading ? <div className="h-40 animate-pulse bg-slate-100 rounded-lg" /> : <SedeBreakdown sedi={sedi} totale={totale} />}
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <h2 className="font-semibold text-slate-900 mb-4 text-sm">Scontrino medio per giorno</h2>
          {loading ? (
            <div className="h-40 animate-pulse bg-slate-100 rounded-lg" />
          ) : giorni.length === 0 ? (
            <p className="text-slate-400 text-sm text-center py-8">Nessun dato</p>
          ) : (
            <div className="space-y-1.5 max-h-52 overflow-y-auto pr-1">
              {[...giorni].sort((a, b) => b.data.localeCompare(a.data)).slice(0, 14).map(g => {
                const med = g.totale / g.visite
                const maxMed = Math.max(...giorni.map(d => d.totale / d.visite), 1)
                const pct = (med / maxMed) * 100
                return (
                  <div key={g.data} className="flex items-center gap-3">
                    <span className="text-[10px] text-slate-400 w-12 shrink-0">{g.data.slice(5)}</span>
                    <div className="flex-1 h-5 bg-slate-100 rounded overflow-hidden">
                      <div className="h-full bg-gradient-to-r from-emerald-400 to-emerald-500 rounded flex items-center pl-2 transition-all" style={{ width: `${pct}%` }}>
                        <span className="text-[9px] text-white font-semibold whitespace-nowrap">{formatEuro(med)}</span>
                      </div>
                    </div>
                    <span className="text-[10px] text-slate-400 w-6 shrink-0">{g.visite}v</span>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* Top 5 clienti */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="flex items-center gap-2 px-5 py-4 border-b border-slate-100">
          <Users className="w-4 h-4 text-slate-400" />
          <h2 className="font-semibold text-slate-900 text-sm">Top 5 clienti per spesa nel periodo</h2>
        </div>
        {loading ? <div className="h-32 animate-pulse bg-slate-50" /> : top5.length === 0 ? (
          <p className="text-center text-slate-400 text-sm py-8">Nessun cliente con dati nel periodo</p>
        ) : (
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100">
                {['#','Cliente','Spesa totale','Visite','Scontrino medio'].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-[10px] uppercase tracking-wide font-medium text-slate-500">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {top5.map((c, i) => (
                <tr key={c.id} className="hover:bg-slate-50 transition">
                  <td className="px-4 py-3">
                    <span className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold ${i === 0 ? 'bg-yellow-100 text-yellow-700' : i === 1 ? 'bg-slate-100 text-slate-600' : i === 2 ? 'bg-orange-100 text-orange-600' : 'bg-slate-50 text-slate-400'}`}>{i + 1}</span>
                  </td>
                  <td className="px-4 py-3 font-medium text-slate-800">{c.nome}</td>
                  <td className="px-4 py-3 font-semibold text-orange-600">{formatEuro(c.totale)}</td>
                  <td className="px-4 py-3 text-slate-500">{c.visite}</td>
                  <td className="px-4 py-3 text-slate-600">{formatEuro(c.media)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Performance camerieri — solo admin */}
      {admin && (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="flex items-center gap-2 px-5 py-4 border-b border-slate-100">
            <Users className="w-4 h-4 text-slate-400" />
            <h2 className="font-semibold text-slate-900 text-sm">Performance camerieri</h2>
            <span className="ml-1 text-[10px] px-2 py-0.5 rounded-full bg-[#1D9E75]/10 text-[#1D9E75] font-semibold">ADMIN</span>
            <span className="ml-auto text-[10px] text-slate-400">ultimi 7 giorni · da comande</span>
          </div>
          <CamerieriSection perf={camPerf} loading={camLoading} />
        </div>
      )}

      {/* Analisi AI — solo admin */}
      {admin && !loading && visite.length > 0 && (
        <AnalisiAI visite={visite} sedi={sedi} giorni={giorni} prevTotale={prevTotale} periodo={periodo} />
      )}

      {/* Dettaglio per mese */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100">
          <h2 className="font-semibold text-slate-900 text-sm">Dettaglio per mese</h2>
        </div>
        <div className="divide-y divide-slate-50">
          {buildMeseData(visite).length === 0
            ? <p className="px-5 py-8 text-center text-slate-400 text-sm">Nessun dato</p>
            : buildMeseData(visite).map(m => (
              <div key={m.mese} className="px-5 py-3 flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-800 capitalize">{m.mese}</p>
                  <p className="text-xs text-slate-400">{m.visite} visite · media {formatEuro(m.totale / m.visite)}</p>
                </div>
                <p className="font-semibold text-orange-600">{formatEuro(m.totale)}</p>
              </div>
            ))}
        </div>
      </div>
    </div>
  )
}
