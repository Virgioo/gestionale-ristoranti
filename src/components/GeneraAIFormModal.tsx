'use client'

import { useState } from 'react'
import { X, Sparkles } from 'lucide-react'

export interface AIFormValues {
  numTavoli: number
  mix: { due: number; quattro: number; seiPiu: number }
  speciali: string[]
  layoutPref: 'classico' | 'dinamico' | 'massimizza'
  note: string
}

const SPECIALI_OPTS = [
  { key: 'romantico_angolo', label: 'Tavolo romantico angolo' },
  { key: 'chef_table', label: "Tavolo chef's table" },
  { key: 'bancone', label: 'Bancone' },
  { key: 'prive', label: 'Tavolo privé' },
  { key: 'lungo_sociale', label: 'Tavolo lungo sociale' },
]

const LAYOUT_OPTS: Array<{ key: AIFormValues['layoutPref']; label: string; desc: string }> = [
  { key: 'classico', label: 'Classico', desc: 'file ordinate' },
  { key: 'dinamico', label: 'Dinamico', desc: 'gruppi misti' },
  { key: 'massimizza', label: 'Massimizza spazio', desc: 'più tavoli possibile' },
]

export default function GeneraAIFormModal({ salaNome, defaultNum, initial, suggerito, onGenera, onClose }: {
  salaNome: string
  defaultNum: number
  initial?: AIFormValues | null
  suggerito?: boolean
  onGenera: (v: AIFormValues) => void
  onClose: () => void
}) {
  const [numTavoli, setNumTavoli] = useState(initial?.numTavoli ?? defaultNum)
  const [due, setDue] = useState(initial?.mix.due ?? 20)
  const [quattro, setQuattro] = useState(initial?.mix.quattro ?? 60)
  const [seiPiu, setSeiPiu] = useState(initial?.mix.seiPiu ?? 20)
  const [speciali, setSpeciali] = useState<Set<string>>(new Set(initial?.speciali ?? []))
  const [layoutPref, setLayoutPref] = useState<AIFormValues['layoutPref']>(initial?.layoutPref ?? 'classico')
  const [note, setNote] = useState(initial?.note ?? '')

  const totale = due + quattro + seiPiu

  function normalizza() {
    const t = totale || 1
    const nDue = Math.round((due / t) * 100)
    const nQuattro = Math.round((quattro / t) * 100)
    setDue(nDue); setQuattro(nQuattro); setSeiPiu(100 - nDue - nQuattro)
  }

  function toggleSpeciale(key: string) {
    setSpeciali(prev => {
      const n = new Set(prev)
      if (n.has(key)) n.delete(key); else n.add(key)
      return n
    })
  }

  function submit(e: React.FormEvent) {
    e.preventDefault()
    if (totale !== 100 || numTavoli < 1) return
    onGenera({ numTavoli, mix: { due, quattro, seiPiu }, speciali: [...speciali], layoutPref, note })
  }

  const inp = 'w-full px-3 py-2 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-slate-900 flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-violet-600" /> Genera disposizione con AI — {salaNome}
          </h3>
          <button onClick={onClose}><X className="w-4 h-4 text-slate-400" /></button>
        </div>

        {suggerito && (
          <p className="text-[11px] text-violet-600 bg-violet-50 border border-violet-100 rounded-lg px-2.5 py-1.5 mb-4">
            💡 Precompilato con la configurazione che in passato hai modificato meno dopo la generazione.
          </p>
        )}

        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className="text-xs font-medium text-slate-600">Quanti tavoli vuoi in questa sala?</label>
            <input type="number" min={1} max={100} value={numTavoli}
              onChange={e => setNumTavoli(Math.max(1, parseInt(e.target.value) || 1))}
              className={`mt-1 ${inp}`} />
          </div>

          <div>
            <div className="flex items-center justify-between">
              <label className="text-xs font-medium text-slate-600">Che mix di tavoli hai?</label>
              <span className={`text-xs font-semibold ${totale === 100 ? 'text-green-600' : 'text-red-500'}`}>{totale}%</span>
            </div>
            <div className="grid grid-cols-3 gap-2 mt-1">
              <div>
                <label className="text-[10px] text-slate-400">Da 2 posti</label>
                <input type="number" min={0} max={100} value={due} onChange={e => setDue(Math.max(0, parseInt(e.target.value) || 0))} className={inp} />
              </div>
              <div>
                <label className="text-[10px] text-slate-400">Da 4 posti</label>
                <input type="number" min={0} max={100} value={quattro} onChange={e => setQuattro(Math.max(0, parseInt(e.target.value) || 0))} className={inp} />
              </div>
              <div>
                <label className="text-[10px] text-slate-400">Da 6+ posti</label>
                <input type="number" min={0} max={100} value={seiPiu} onChange={e => setSeiPiu(Math.max(0, parseInt(e.target.value) || 0))} className={inp} />
              </div>
            </div>
            {totale !== 100 && (
              <button type="button" onClick={normalizza} className="text-[11px] text-violet-600 hover:underline mt-1">
                Normalizza a 100%
              </button>
            )}
          </div>

          <div>
            <label className="text-xs font-medium text-slate-600">Hai tavoli speciali?</label>
            <div className="grid grid-cols-2 gap-1.5 mt-1">
              {SPECIALI_OPTS.map(o => (
                <label key={o.key} className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs cursor-pointer transition ${
                  speciali.has(o.key) ? 'border-violet-400 bg-violet-50 text-violet-700' : 'border-slate-200 text-slate-600 hover:border-slate-300'
                }`}>
                  <input type="checkbox" checked={speciali.has(o.key)} onChange={() => toggleSpeciale(o.key)} className="accent-violet-600" />
                  {o.label}
                </label>
              ))}
            </div>
          </div>

          <div>
            <label className="text-xs font-medium text-slate-600">Preferenze di layout</label>
            <div className="grid grid-cols-3 gap-2 mt-1">
              {LAYOUT_OPTS.map(o => (
                <button key={o.key} type="button" onClick={() => setLayoutPref(o.key)}
                  className={`py-2 px-1 rounded-lg border text-xs font-medium transition ${
                    layoutPref === o.key ? 'bg-violet-600 text-white border-violet-600' : 'border-slate-200 text-slate-600 hover:border-slate-300'
                  }`}>
                  <span className="block">{o.label}</span>
                  <span className={`block text-[10px] font-normal ${layoutPref === o.key ? 'text-violet-100' : 'text-slate-400'}`}>{o.desc}</span>
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-xs font-medium text-slate-600">Note per l&apos;AI <span className="text-slate-400">(opzionale)</span></label>
            <textarea value={note} onChange={e => setNote(e.target.value)} rows={2} placeholder="es. tenere un corridoio centrale libero, tavoli VIP vicino alla finestra..."
              className={`mt-1 ${inp} resize-none`} />
          </div>

          <div className="flex gap-2 pt-1">
            <button type="button" onClick={onClose} className="flex-1 py-2 text-sm border border-slate-200 rounded-xl text-slate-600 hover:bg-slate-50 transition">
              Annulla
            </button>
            <button type="submit" disabled={totale !== 100}
              className="flex-1 flex items-center justify-center gap-1.5 py-2 text-sm font-semibold bg-violet-600 text-white rounded-xl hover:bg-violet-700 transition disabled:opacity-50 disabled:cursor-not-allowed">
              <Sparkles className="w-4 h-4" /> Genera
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
