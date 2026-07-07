'use client'

import { useEffect, useState } from 'react'
import { queryDB } from '@/lib/api'
import { formatDate } from '@/lib/utils'
import { Sparkles, Loader2, ThumbsUp, ThumbsDown, Zap, Star } from 'lucide-react'

interface ReviewAnalysis {
  sentiment: string
  score: number
  punti_forza: string[]
  aree_miglioramento: string[]
  azioni: string[]
}

function AnalisiRecensioni() {
  const [testo, setTesto]       = useState('')
  const [result, setResult]     = useState<ReviewAnalysis | null>(null)
  const [loading, setLoading]   = useState(false)
  const [errore, setErrore]     = useState<string | null>(null)

  async function analizza() {
    if (!testo.trim() || loading) return
    setLoading(true)
    setErrore(null)
    setResult(null)

    const prompt = `Sei un esperto di reputation management per ristoranti italiani. Analizza queste recensioni reali e rispondi SOLO con un oggetto JSON valido (niente altro, nessun markdown, solo JSON puro).

RECENSIONI:
${testo}

Formato risposta (JSON puro, no markdown):
{"sentiment":"positivo","score":8.2,"punti_forza":["Frase 1","Frase 2","Frase 3"],"aree_miglioramento":["Frase 1","Frase 2","Frase 3"],"azioni":["Azione concreta 1","Azione concreta 2","Azione concreta 3"]}

Regole:
- sentiment: "positivo", "neutro" o "negativo"
- score: da 1 a 10 (media ponderata delle recensioni)
- punti_forza: 3 aspetti più elogiati (citare frasi o temi specifici delle recensioni)
- aree_miglioramento: 3 critiche o mancanze ricorrenti (solo se presenti)
- azioni: 3 azioni concrete e specifiche che il ristorante dovrebbe fare nei prossimi 30 giorni`

    try {
      const res  = await fetch('/api/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: [{ role: 'user', content: prompt }] }),
      })
      const data = await res.json()
      const raw  = data.content?.[0]?.text ?? ''
      // Strip possible markdown code block
      const clean = raw.replace(/```(?:json)?/g, '').replace(/```/g, '').trim()
      const parsed: ReviewAnalysis = JSON.parse(clean)
      setResult(parsed)
    } catch {
      setErrore('Analisi non riuscita. Incolla almeno 2-3 recensioni e riprova.')
    } finally {
      setLoading(false)
    }
  }

  const sentimentConf: Record<string, { color: string; label: string; bg: string }> = {
    positivo: { color: 'text-green-700', label: '😊 Positivo',  bg: 'bg-green-50 border-green-200' },
    neutro:   { color: 'text-yellow-700', label: '😐 Neutro',   bg: 'bg-yellow-50 border-yellow-200' },
    negativo: { color: 'text-red-700',   label: '😞 Negativo',  bg: 'bg-red-50 border-red-200' },
  }
  const sc = result ? (sentimentConf[result.sentiment] ?? sentimentConf.neutro) : null

  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
      <div className="flex items-center gap-2 px-5 py-4 border-b border-slate-100">
        <Star className="w-4 h-4 text-amber-500" />
        <h2 className="font-semibold text-slate-900 text-sm">Analisi reputazione AI</h2>
        <span className="text-[10px] px-2 py-0.5 bg-amber-100 text-amber-700 rounded-full font-medium">Groq · llama-3.3-70b</span>
      </div>
      <div className="p-5 space-y-4">
        <div>
          <label className="text-xs font-medium text-slate-600 block mb-1.5">
            Incolla le recensioni Google / TripAdvisor (anche in blocco, anche in più lingue)
          </label>
          <textarea
            value={testo}
            onChange={e => setTesto(e.target.value)}
            rows={6}
            placeholder={`★★★★★ "Cena fantastica, pesce freschissimo e servizio impeccabile..."\n★★★☆☆ "Buon cibo ma tempi di attesa lunghi, il cameriere..."\n★★★★★ "Ambiente romantico, torneremo sicuramente..."`}
            className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-400 resize-none placeholder:text-slate-300"
          />
        </div>
        <button
          onClick={analizza}
          disabled={loading || !testo.trim()}
          className="flex items-center gap-2 px-4 py-2.5 bg-amber-500 hover:bg-amber-600 text-white text-sm font-semibold rounded-xl transition disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
          {loading ? 'Analisi in corso...' : 'Analizza recensioni'}
        </button>

        {errore && <p className="text-sm text-red-600 bg-red-50 px-4 py-3 rounded-xl border border-red-200">{errore}</p>}

        {result && sc && (
          <div className="space-y-4">
            {/* Sentiment + score */}
            <div className={`flex items-center gap-4 px-4 py-3 rounded-xl border ${sc.bg}`}>
              <div>
                <p className={`text-sm font-bold ${sc.color}`}>{sc.label}</p>
                <p className="text-xs text-slate-500 mt-0.5">Sentiment generale</p>
              </div>
              <div className="ml-auto text-center">
                <p className="text-3xl font-black text-slate-900">{result.score.toFixed(1)}</p>
                <p className="text-[10px] text-slate-400">/10</p>
              </div>
              {/* Stars visual */}
              <div className="flex gap-0.5">
                {[1,2,3,4,5].map(i => (
                  <Star key={i} className={`w-4 h-4 ${i <= Math.round(result.score / 2) ? 'text-amber-400 fill-amber-400' : 'text-slate-200 fill-slate-200'}`} />
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* Punti di forza */}
              <div className="bg-green-50 border border-green-200 rounded-xl p-4">
                <div className="flex items-center gap-2 mb-3">
                  <ThumbsUp className="w-4 h-4 text-green-600" />
                  <p className="text-sm font-semibold text-green-800">Punti di forza</p>
                </div>
                <ul className="space-y-2">
                  {result.punti_forza.map((p, i) => (
                    <li key={i} className="flex gap-2 text-sm text-green-700">
                      <span className="text-green-500 shrink-0">✓</span>{p}
                    </li>
                  ))}
                </ul>
              </div>

              {/* Aree di miglioramento */}
              <div className="bg-red-50 border border-red-200 rounded-xl p-4">
                <div className="flex items-center gap-2 mb-3">
                  <ThumbsDown className="w-4 h-4 text-red-600" />
                  <p className="text-sm font-semibold text-red-800">Aree di miglioramento</p>
                </div>
                <ul className="space-y-2">
                  {result.aree_miglioramento.map((a, i) => (
                    <li key={i} className="flex gap-2 text-sm text-red-700">
                      <span className="text-red-400 shrink-0">▲</span>{a}
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            {/* Azioni concrete */}
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-3">
                <Zap className="w-4 h-4 text-blue-600" />
                <p className="text-sm font-semibold text-blue-800">3 azioni da fare nei prossimi 30 giorni</p>
              </div>
              <div className="space-y-2">
                {result.azioni.map((a, i) => (
                  <div key={i} className="flex gap-3">
                    <span className="w-5 h-5 rounded-full bg-blue-200 text-blue-700 text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5">{i+1}</span>
                    <p className="text-sm text-blue-800">{a}</p>
                  </div>
                ))}
              </div>
            </div>

            <button onClick={() => { setResult(null); setTesto('') }} className="text-xs text-slate-400 hover:text-slate-600 transition">
              Nuova analisi →
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

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

      {/* Analisi reputazione AI */}
      <AnalisiRecensioni />

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
