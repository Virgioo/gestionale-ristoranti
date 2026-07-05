'use client'

import { useState, useEffect, useRef } from 'react'
import {
  LayoutGrid, Plus, Save, RefreshCw, Settings, Eye, ChevronDown,
  X, RotateCcw, Copy, Trash2, Accessibility, Clock, PenTool, Check,
} from 'lucide-react'
import { queryDB, insertDB, deleteDB, updateDB, upsertDB } from '@/lib/api'

// ─────────────────────────────────────── TYPES
type Forma      = 'rettangolare' | 'rotondo' | 'ovale' | 'quadrato'
type Stato      = 'libero' | 'occupato' | 'prenotato' | 'conto' | 'bloccato' | 'riservato'
type EditorTool = 'select' | 'drawSala'

interface Pt     { x: number; y: number }
interface Sede   { id: string; nome: string; citta: string }
interface Sala   {
  id: string; nome: string; sede_id: string; ordine: number
  colore: string; note: string | null
  larghezza_metri: number | null; altezza_metri: number | null
  punti_poligono: Pt[] | null; sfondo_url: string | null
}
interface Tavolo {
  id: string; sala_id: string; nome: string; forma: Forma
  capienza: number; capienza_min: number | null; capienza_max: number | null; capienza_evento: number | null
  pos_x: number; pos_y: number; larghezza: number; altezza: number; rotazione: number
  note: string | null; accessibile: boolean; nome_cameriere: string | null; unione_gruppo: string | null
}
interface StatoTavolo {
  tavolo_id: string; stato: Stato; note: string | null; coperti_effettivi: number | null
  aggiornato_at: string; ora_apertura: string | null; cameriere_assegnato: string | null
}

// ─────────────────────────────────────── CONSTANTS
const CW = 1000, CH = 680

const SC: Record<Stato, { label: string; bg: string; fg: string; dot: string; border: string }> = {
  libero:    { label: 'Libero',    bg: '#dcfce7', fg: '#166534', dot: '#4ade80', border: '#86efac' },
  occupato:  { label: 'Occupato',  bg: '#fee2e2', fg: '#991b1b', dot: '#f87171', border: '#fca5a5' },
  prenotato: { label: 'Prenotato', bg: '#fef3c7', fg: '#92400e', dot: '#fbbf24', border: '#fcd34d' },
  conto:     { label: 'Conto',     bg: '#dbeafe', fg: '#1e40af', dot: '#60a5fa', border: '#93c5fd' },
  bloccato:  { label: 'Bloccato',  bg: '#f1f5f9', fg: '#475569', dot: '#94a3b8', border: '#e2e8f0' },
  riservato: { label: 'Riservato', bg: '#f3e8ff', fg: '#6b21a8', dot: '#a855f7', border: '#c084fc' },
}
const STATI: Stato[] = ['libero','occupato','prenotato','conto','bloccato','riservato']

const SALA_COLORS = ['#94a3b8','#f97316','#10b981','#3b82f6','#a855f7','#ec4899','#f59e0b','#14b8a6','#ef4444','#84cc16']

// ─────────────────────────────────────── HELPERS
function elapsed(from: string | null): string | null {
  if (!from) return null
  const ms = Date.now() - new Date(from).getTime()
  if (ms < 0) return null
  const h = Math.floor(ms / 3_600_000), m = Math.floor((ms % 3_600_000) / 60_000)
  return h > 0 ? `${h}h ${m}m` : `${m}m`
}
function initials(n: string | null) {
  if (!n) return ''
  return n.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)
}
function defaultAltezza(forma: Forma, larghezza: number): number {
  return forma === 'rotondo' || forma === 'quadrato' ? larghezza : Math.round(larghezza * 0.72)
}

// ─────────────────────────────────────── TAVOLO SHAPE
function TavoloShape({ t, st, mode, selected, isUnito, timerStr, onMouseDown, onClick, onRotateStart, divRef }: {
  t: Tavolo; st: StatoTavolo | null; mode: 'editor' | 'operativo'
  selected: boolean; isUnito: boolean; timerStr: string | null
  onMouseDown?: (e: React.MouseEvent) => void; onClick?: () => void
  onRotateStart?: (e: React.MouseEvent) => void; divRef?: (el: HTMLDivElement | null) => void
}) {
  const stato  = st?.stato ?? 'libero'
  const cfg    = SC[stato]
  const isCirc = t.forma === 'rotondo' || t.forma === 'ovale'
  const w      = t.larghezza
  const h      = t.forma === 'rotondo' || t.forma === 'quadrato' ? t.larghezza : t.altezza
  const brad   = isCirc ? '50%' : 8

  const bgColor = mode === 'operativo' ? cfg.bg : (selected ? '#fff7ed' : '#ffffff')
  const border  = `2px ${isUnito ? 'dashed' : 'solid'} ${
    mode === 'editor' ? (selected ? '#f97316' : '#94a3b8') : cfg.border}`
  const shadow  = selected ? '0 0 0 3px rgba(249,115,22,0.3), 0 4px 12px rgba(0,0,0,0.1)' : '0 1px 4px rgba(0,0,0,0.06)'

  return (
    <div
      ref={divRef}
      style={{
        position: 'absolute', left: t.pos_x, top: t.pos_y, width: w, height: h,
        borderRadius: brad, transform: `rotate(${t.rotazione}deg)`, transformOrigin: 'center',
        cursor: mode === 'editor' ? 'grab' : 'pointer', userSelect: 'none',
        zIndex: selected ? 20 : 2, border, background: bgColor, boxShadow: shadow,
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        transition: 'box-shadow 0.12s, border-color 0.12s',
      }}
      onMouseDown={onMouseDown}
      onClick={mode === 'operativo' ? onClick : undefined}
    >
      {/* Rotation handle */}
      {mode === 'editor' && selected && (
        <>
          <div style={{
            position: 'absolute', top: -22, left: '50%', transform: 'translateX(-50%)',
            width: 2, height: 16, background: '#f97316',
          }} />
          <div
            style={{
              position: 'absolute', top: -32, left: '50%', transform: 'translateX(-50%)',
              width: 14, height: 14, borderRadius: '50%', background: '#f97316',
              border: '2px solid white', boxShadow: '0 1px 4px rgba(0,0,0,0.25)', cursor: 'grab', zIndex: 30,
            }}
            onMouseDown={e => { e.stopPropagation(); onRotateStart?.(e) }}
          />
        </>
      )}

      <span style={{ fontSize: 11, fontWeight: 700, color: mode === 'operativo' ? cfg.fg : '#1e293b', lineHeight: 1.2, padding: '0 4px', textAlign: 'center', wordBreak: 'break-word' }}>
        {t.nome}
      </span>

      {mode === 'editor' && (
        <span style={{ fontSize: 9, color: '#94a3b8', marginTop: 2 }}>
          {t.capienza} pax{t.rotazione !== 0 ? ` · ${t.rotazione}°` : ''}
        </span>
      )}

      {mode === 'operativo' && (
        <>
          <span style={{ fontSize: 8, fontWeight: 600, color: cfg.fg, marginTop: 2 }}>{cfg.label}</span>
          {st?.coperti_effettivi != null && (
            <span style={{ fontSize: 8, color: '#64748b' }}>{st.coperti_effettivi}/{t.capienza}</span>
          )}
          {timerStr && <span style={{ fontSize: 8, color: cfg.fg, fontWeight: 700 }}>{timerStr}</span>}
          {st?.cameriere_assegnato && (
            <span style={{ fontSize: 7, background: '#1e293b', color: '#fff', borderRadius: 4, padding: '0 3px', marginTop: 1, lineHeight: 1.6 }}>
              {initials(st.cameriere_assegnato)}
            </span>
          )}
        </>
      )}

      {t.accessibile && (
        <span style={{ position: 'absolute', bottom: 2, right: 4, fontSize: 9 }}>♿</span>
      )}
    </div>
  )
}

// ─────────────────────────────────────── EDITOR PANEL
function EditorPanel({ t, onChange, onDelete, onDuplicate, onClose }: {
  t: Tavolo; onChange: (p: Partial<Tavolo>) => void
  onDelete: () => void; onDuplicate: () => void; onClose: () => void
}) {
  const FORME: Forma[] = ['rettangolare','rotondo','quadrato','ovale']
  const FORME_LABEL: Record<Forma, string> = { rettangolare: '⬜ Rett.', rotondo: '⭕ Rotondo', quadrato: '◼ Quad.', ovale: '⬭ Ovale' }
  const inp = 'w-full mt-1 px-2.5 py-1.5 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-orange-400'

  function setForma(f: Forma) {
    const l = t.larghezza
    onChange({ forma: f, altezza: defaultAltezza(f, l) })
  }

  return (
    <div className="w-60 shrink-0 flex flex-col bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden max-h-[calc(100vh-180px)]">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
        <p className="font-semibold text-slate-900 text-sm">Proprietà tavolo</p>
        <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition"><X className="w-4 h-4" /></button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {/* Nome */}
        <div>
          <label className="text-xs font-medium text-slate-500">Nome tavolo</label>
          <input value={t.nome} onChange={e => onChange({ nome: e.target.value })} className={inp} />
        </div>

        {/* Forma */}
        <div>
          <label className="text-xs font-medium text-slate-500">Forma</label>
          <div className="grid grid-cols-2 gap-1 mt-1">
            {FORME.map(f => (
              <button key={f} type="button" onClick={() => setForma(f)}
                className={`py-1.5 text-xs rounded-lg border transition ${t.forma === f ? 'bg-orange-500 text-white border-orange-500' : 'border-slate-200 text-slate-600 hover:border-orange-300'}`}>
                {FORME_LABEL[f]}
              </button>
            ))}
          </div>
        </div>

        {/* Capienza */}
        <div className="grid grid-cols-3 gap-2">
          <div><label className="text-xs font-medium text-slate-500">Min</label>
            <input type="number" min={1} max={100} value={t.capienza_min ?? t.capienza} onChange={e => onChange({ capienza_min: parseInt(e.target.value)||1 })} className={inp} /></div>
          <div><label className="text-xs font-medium text-slate-500">Norm.</label>
            <input type="number" min={1} max={100} value={t.capienza} onChange={e => onChange({ capienza: parseInt(e.target.value)||1 })} className={inp} /></div>
          <div><label className="text-xs font-medium text-slate-500">Max</label>
            <input type="number" min={1} max={100} value={t.capienza_max ?? t.capienza} onChange={e => onChange({ capienza_max: parseInt(e.target.value)||1 })} className={inp} /></div>
        </div>
        <div>
          <label className="text-xs font-medium text-slate-500">Capienza evento</label>
          <input type="number" min={1} max={100} value={t.capienza_evento ?? ''} placeholder="Lascia vuoto per default"
            onChange={e => onChange({ capienza_evento: e.target.value ? parseInt(e.target.value) : null })} className={inp} />
        </div>

        {/* Dimensioni */}
        <div className="grid grid-cols-2 gap-2">
          <div><label className="text-xs font-medium text-slate-500">Largh. (px)</label>
            <input type="number" min={40} max={280} value={Math.round(t.larghezza)}
              onChange={e => { const v=Math.max(40,parseInt(e.target.value)||80); onChange({ larghezza: v, altezza: defaultAltezza(t.forma, v) }) }} className={inp} /></div>
          {(t.forma === 'rettangolare' || t.forma === 'ovale') && (
            <div><label className="text-xs font-medium text-slate-500">Alt. (px)</label>
              <input type="number" min={30} max={220} value={Math.round(t.altezza)}
                onChange={e => onChange({ altezza: Math.max(30, parseInt(e.target.value)||60) })} className={inp} /></div>
          )}
        </div>

        {/* Rotazione */}
        <div>
          <div className="flex items-center justify-between">
            <label className="text-xs font-medium text-slate-500">Rotazione</label>
            <button onClick={() => onChange({ rotazione: 0 })} className="text-xs text-orange-500 hover:underline flex items-center gap-0.5">
              <RotateCcw className="w-3 h-3" /> Reset
            </button>
          </div>
          <div className="flex gap-2 items-center mt-1">
            <input type="range" min={-180} max={180} value={t.rotazione}
              onChange={e => onChange({ rotazione: parseInt(e.target.value) })}
              className="flex-1 accent-orange-500" />
            <input type="number" min={-180} max={180} value={t.rotazione}
              onChange={e => onChange({ rotazione: parseInt(e.target.value)||0 })}
              className="w-14 px-2 py-1 text-xs border border-slate-200 rounded-lg text-center focus:outline-none" />
          </div>
        </div>

        {/* Cameriere */}
        <div>
          <label className="text-xs font-medium text-slate-500">Cameriere assegnato</label>
          <input value={t.nome_cameriere ?? ''} placeholder="Nome cameriere" onChange={e => onChange({ nome_cameriere: e.target.value || null })} className={inp} />
        </div>

        {/* Note */}
        <div>
          <label className="text-xs font-medium text-slate-500">Note</label>
          <textarea value={t.note ?? ''} rows={2} placeholder="es. Vicino alla finestra, VIP..."
            onChange={e => onChange({ note: e.target.value || null })}
            className="w-full mt-1 px-2.5 py-1.5 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-orange-400 resize-none" />
        </div>

        {/* Flags */}
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-1.5 text-xs text-slate-600 cursor-pointer select-none">
            <input type="checkbox" checked={t.accessibile} onChange={e => onChange({ accessibile: e.target.checked })} className="accent-orange-500" />
            <Accessibility className="w-3.5 h-3.5 text-slate-400" /> Accessibile ♿
          </label>
        </div>
        <div>
          <label className="text-xs font-medium text-slate-500">Gruppo unione tavoli</label>
          <input value={t.unione_gruppo ?? ''} placeholder="es. G1 (stesso valore = uniti)"
            onChange={e => onChange({ unione_gruppo: e.target.value || null })} className={inp} />
        </div>
      </div>

      {/* Footer actions */}
      <div className="border-t border-slate-100 p-3 space-y-2">
        <button onClick={onDuplicate}
          className="w-full flex items-center justify-center gap-1.5 py-1.5 text-xs text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50 transition">
          <Copy className="w-3.5 h-3.5" /> Duplica tavolo
        </button>
        <button onClick={onDelete}
          className="w-full flex items-center justify-center gap-1.5 py-1.5 text-xs text-red-500 border border-red-200 rounded-lg hover:bg-red-50 transition">
          <Trash2 className="w-3.5 h-3.5" /> Elimina tavolo
        </button>
      </div>
    </div>
  )
}

// ─────────────────────────────────────── ADD TAVOLO MODAL
function AddTavoloModal({ n, onAdd, onClose }: {
  n: string; onAdd: (d: Omit<Tavolo,'id'|'sala_id'>) => void; onClose: () => void
}) {
  const [nome, setNome]     = useState(n)
  const [forma, setForma]   = useState<Forma>('rettangolare')
  const [cap, setCap]       = useState(4)
  const FORME: Forma[]      = ['rettangolare','rotondo','quadrato','ovale']
  const FORME_L: Record<Forma,string> = { rettangolare:'⬜ Rettangolare', rotondo:'⭕ Rotondo', quadrato:'◼ Quadrato', ovale:'⬭ Ovale' }

  function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!nome.trim()) return
    const l = forma === 'rotondo' || forma === 'quadrato' ? 80 : 110
    onAdd({
      nome: nome.trim(), forma, capienza: cap, capienza_min: null, capienza_max: null, capienza_evento: null,
      pos_x: 100, pos_y: 100, larghezza: l, altezza: defaultAltezza(forma, l),
      rotazione: 0, note: null, accessibile: false, nome_cameriere: null, unione_gruppo: null,
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl p-6 w-80" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-slate-900">Aggiungi tavolo</h3>
          <button onClick={onClose}><X className="w-4 h-4 text-slate-400" /></button>
        </div>
        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className="text-xs text-slate-500">Nome tavolo</label>
            <input autoFocus value={nome} onChange={e => setNome(e.target.value)}
              className="w-full mt-1 px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-orange-400" />
          </div>
          <div>
            <label className="text-xs text-slate-500">Forma</label>
            <div className="grid grid-cols-2 gap-2 mt-1">
              {FORME.map(f => (
                <button key={f} type="button" onClick={() => setForma(f)}
                  className={`py-2 text-xs rounded-lg border transition ${forma === f ? 'bg-orange-500 text-white border-orange-500' : 'border-slate-300 text-slate-600'}`}>
                  {FORME_L[f]}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="text-xs text-slate-500">Posti</label>
            <input type="number" min={1} max={100} value={cap} onChange={e => setCap(Math.max(1,parseInt(e.target.value)||1))}
              className="w-full mt-1 px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-orange-400" />
          </div>
          <div className="flex gap-2 pt-1">
            <button type="button" onClick={onClose} className="flex-1 py-2 text-sm border border-slate-200 rounded-xl text-slate-600 hover:bg-slate-50 transition">Annulla</button>
            <button type="submit" className="flex-1 py-2 text-sm bg-orange-500 text-white rounded-xl hover:bg-orange-600 transition">Aggiungi</button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─────────────────────────────────────── SALA MODAL
function SalaModal({ sala, isNew, sedeId, onSave, onClose }: {
  sala: Partial<Sala>; isNew: boolean; sedeId: string
  onSave: (d: Partial<Sala>) => void; onClose: () => void
}) {
  const [nome, setNome]       = useState(sala.nome ?? '')
  const [colore, setColore]   = useState(sala.colore ?? '#94a3b8')
  const [note, setNote]       = useState(sala.note ?? '')
  const [lm, setLm]           = useState<string>(sala.larghezza_metri?.toString() ?? '')
  const [am, setAm]           = useState<string>(sala.altezza_metri?.toString() ?? '')
  const [sfondo, setSfondo]   = useState(sala.sfondo_url ?? '')

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl p-6 w-96" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-slate-900">{isNew ? 'Nuova sala' : 'Modifica sala'}</h3>
          <button onClick={onClose}><X className="w-4 h-4 text-slate-400" /></button>
        </div>
        <div className="space-y-3">
          <div>
            <label className="text-xs text-slate-500">Nome sala</label>
            <input autoFocus value={nome} onChange={e => setNome(e.target.value)} placeholder="Sala principale"
              className="w-full mt-1 px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-orange-400" />
          </div>
          <div>
            <label className="text-xs text-slate-500">Colore sala</label>
            <div className="flex gap-2 mt-1 flex-wrap">
              {SALA_COLORS.map(c => (
                <button key={c} type="button" onClick={() => setColore(c)}
                  style={{ background: c }}
                  className={`w-7 h-7 rounded-full border-2 transition ${colore === c ? 'border-slate-800 scale-110' : 'border-white'}`} />
              ))}
              <input type="color" value={colore} onChange={e => setColore(e.target.value)}
                className="w-7 h-7 rounded-full border-2 border-slate-200 cursor-pointer p-0 overflow-hidden" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs text-slate-500">Larghezza (m)</label>
              <input type="number" min={0} step={0.1} value={lm} onChange={e => setLm(e.target.value)} placeholder="es. 12"
                className="w-full mt-1 px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-orange-400" />
            </div>
            <div>
              <label className="text-xs text-slate-500">Altezza (m)</label>
              <input type="number" min={0} step={0.1} value={am} onChange={e => setAm(e.target.value)} placeholder="es. 8"
                className="w-full mt-1 px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-orange-400" />
            </div>
          </div>
          <div>
            <label className="text-xs text-slate-500">URL sfondo/planimetria</label>
            <input value={sfondo} onChange={e => setSfondo(e.target.value)} placeholder="https://..."
              className="w-full mt-1 px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-orange-400" />
          </div>
          <div>
            <label className="text-xs text-slate-500">Note</label>
            <textarea value={note} onChange={e => setNote(e.target.value)} rows={2}
              className="w-full mt-1 px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-orange-400 resize-none" />
          </div>
        </div>
        <div className="flex gap-2 mt-4">
          <button onClick={onClose} className="flex-1 py-2 text-sm border border-slate-200 rounded-xl text-slate-600 hover:bg-slate-50 transition">Annulla</button>
          <button onClick={() => onSave({ nome: nome.trim(), colore, note: note||null, larghezza_metri: lm?parseFloat(lm):null, altezza_metri: am?parseFloat(am):null, sfondo_url: sfondo||null })}
            className="flex-1 py-2 text-sm bg-orange-500 text-white rounded-xl hover:bg-orange-600 transition">
            {isNew ? 'Crea sala' : 'Salva'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────── OPER MODAL
function OperModal({ t, st, onClose, onSave }: {
  t: Tavolo; st: StatoTavolo | null; onClose: () => void
  onSave: (stato: Stato, note: string, coperti: number|null, cam: string, apri: boolean) => void
}) {
  const [stato, setStato]   = useState<Stato>(st?.stato ?? 'libero')
  const [note, setNote]     = useState(st?.note ?? '')
  const [coperti, setCop]   = useState<number>(st?.coperti_effettivi ?? t.capienza)
  const [cam, setCam]       = useState(st?.cameriere_assegnato ?? t.nome_cameriere ?? '')
  const [apri, setApri]     = useState(false)
  const needsCop = stato === 'occupato' || stato === 'prenotato'

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40" onClick={onClose}>
      <div className="bg-white rounded-t-2xl p-5 w-full max-w-md shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-slate-900">{t.nome} <span className="font-normal text-slate-500 text-sm">({t.capienza} pax)</span></h3>
          <button onClick={onClose}><X className="w-4 h-4 text-slate-400" /></button>
        </div>

        {st?.ora_apertura && (
          <div className="flex items-center gap-1.5 text-xs text-slate-500 mb-3">
            <Clock className="w-3.5 h-3.5" />
            Apertura: {new Date(st.ora_apertura).toLocaleTimeString('it-IT',{hour:'2-digit',minute:'2-digit'})}
            {elapsed(st.ora_apertura) && <span className="font-semibold text-slate-800 ml-1">({elapsed(st.ora_apertura)})</span>}
          </div>
        )}

        <div className="grid grid-cols-3 gap-2 mb-4">
          {STATI.map(s => (
            <button key={s} onClick={() => setStato(s)}
              className="py-2 text-xs font-medium rounded-xl border-2 transition"
              style={stato === s
                ? { background: SC[s].bg, color: SC[s].fg, borderColor: SC[s].dot }
                : { background: '#f8fafc', color: '#64748b', borderColor: '#e2e8f0' }}>
              <span className="block w-2.5 h-2.5 rounded-full mx-auto mb-1" style={{ background: SC[s].dot }} />
              {SC[s].label}
            </button>
          ))}
        </div>

        {needsCop && (
          <div className="mb-3">
            <label className="text-xs text-slate-500">Coperti effettivi</label>
            <input type="number" min={1} max={t.capienza_max ?? t.capienza} value={coperti}
              onChange={e => setCop(Math.max(1,parseInt(e.target.value)||1))}
              className="w-full mt-1 px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-orange-400" />
          </div>
        )}

        <div className="mb-3">
          <label className="text-xs text-slate-500">Cameriere</label>
          <input value={cam} onChange={e => setCam(e.target.value)} placeholder="Nome cameriere"
            className="w-full mt-1 px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-orange-400" />
        </div>

        <div className="mb-4">
          <label className="text-xs text-slate-500">Note</label>
          <textarea value={note} onChange={e => setNote(e.target.value)} rows={2}
            className="w-full mt-1 px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-orange-400 resize-none" />
        </div>

        {stato === 'occupato' && !st?.ora_apertura && (
          <label className="flex items-center gap-2 text-xs text-slate-600 mb-3 cursor-pointer">
            <input type="checkbox" checked={apri} onChange={e => setApri(e.target.checked)} className="accent-orange-500" />
            Registra ora di apertura tavolo
          </label>
        )}

        <button onClick={() => onSave(stato, note, needsCop ? coperti : null, cam, apri)}
          className="w-full py-2.5 bg-orange-500 text-white rounded-xl font-medium text-sm hover:bg-orange-600 transition">
          Salva stato
        </button>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════ MAIN PAGE
export default function TavoliPage() {
  const [mode, setMode]         = useState<'editor' | 'operativo'>('editor')
  const [tool, setTool]         = useState<EditorTool>('select')
  const [sedi, setSedi]         = useState<Sede[]>([])
  const [sedeId, setSedeId]     = useState('')
  const [sale, setSale]         = useState<Sala[]>([])
  const [salaId, setSalaId]     = useState('')
  const [tavoli, setTavoli]     = useState<Tavolo[]>([])
  const [statiMap, setStatiMap] = useState<Record<string, StatoTavolo>>({})
  const [selId, setSelId]       = useState<string | null>(null)
  const [dirty, setDirty]       = useState(false)
  const [saving, setSaving]     = useState(false)
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState<string | null>(null)
  const [showAddT, setShowAddT] = useState(false)
  const [salaModal, setSalaModal] = useState<{ sala: Partial<Sala>; isNew: boolean } | null>(null)
  const [operModal, setOperModal] = useState<Tavolo | null>(null)
  const [drawVerts, setDrawVerts] = useState<Pt[]>([])
  const [mousePos, setMousePos]   = useState<Pt | null>(null)
  const [now, setNow]             = useState(Date.now())
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null)

  // refs
  const canvasRef   = useRef<HTMLDivElement>(null)
  const saleRef     = useRef<Sala[]>([])
  const tavoliRef   = useRef<Tavolo[]>([])
  const salaIdRef   = useRef('')
  const tableRefs   = useRef<Record<string, HTMLDivElement | null>>({})

  // drag state (refs for perf)
  type DragType = 'table' | 'vertex' | 'rotate'
  const drag = useRef<{ type: DragType; id?: string; idx?: number; offset?: Pt } | null>(null)
  const dragPos = useRef<Pt>({ x: 0, y: 0 })

  // keep refs in sync
  useEffect(() => { saleRef.current = sale }, [sale])
  useEffect(() => { tavoliRef.current = tavoli }, [tavoli])
  useEffect(() => { salaIdRef.current = salaId }, [salaId])

  // timer tick every minute
  useEffect(() => {
    const iv = setInterval(() => setNow(Date.now()), 60_000)
    return () => clearInterval(iv)
  }, [])

  // ── load sedi
  useEffect(() => {
    queryDB<Sede>('sedi', { select: 'id,nome,citta', order: { col: 'nome' } })
      .then(r => { setSedi(r); if (r[0]) setSedeId(r[0].id) })
      .catch(() => setError('Errore caricamento sedi'))
  }, [])

  // ── load sale
  useEffect(() => {
    if (!sedeId) return
    setSalaId(''); setSale([]); setTavoli([]); setStatiMap({})
    queryDB<Sala>('sale', {
      select: 'id,nome,sede_id,ordine,colore,note,larghezza_metri,altezza_metri,punti_poligono,sfondo_url',
      filters: [{ fn: 'eq', args: ['sede_id', sedeId] }],
      order: { col: 'ordine' },
    }).then(r => { setSale(r); if (r[0]) setSalaId(r[0].id) })
  }, [sedeId])

  // ── load tavoli
  useEffect(() => {
    if (!salaId) { setTavoli([]); setStatiMap({}); return }
    setLoading(true); setSelId(null); setTool('select')
    queryDB<Tavolo>('tavoli', {
      select: 'id,sala_id,nome,forma,capienza,capienza_min,capienza_max,capienza_evento,pos_x,pos_y,larghezza,altezza,rotazione,note,accessibile,nome_cameriere,unione_gruppo',
      filters: [{ fn: 'eq', args: ['sala_id', salaId] }],
    }).then(async r => {
      setTavoli(r)
      if (r.length) await loadStati(r.map(t => t.id))
    }).finally(() => setLoading(false))
  }, [salaId])

  async function loadStati(ids: string[]) {
    if (!ids.length) return
    const r = await queryDB<StatoTavolo>('stato_tavoli', {
      select: 'tavolo_id,stato,note,coperti_effettivi,aggiornato_at,ora_apertura,cameriere_assegnato',
      filters: [{ fn: 'in', args: ['tavolo_id', ids] }],
    })
    const m: Record<string, StatoTavolo> = {}
    for (const s of r) m[s.tavolo_id] = s
    setStatiMap(m); setLastRefresh(new Date())
  }

  // ── auto-refresh
  useEffect(() => {
    if (mode !== 'operativo' || !tavoli.length) return
    const iv = setInterval(() => loadStati(tavoliRef.current.map(t => t.id)), 30_000)
    return () => clearInterval(iv)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, tavoli.length])

  // ── window mouse events (all dragging)
  useEffect(() => {
    function onMove(e: MouseEvent) {
      if (!drag.current || !canvasRef.current) return
      const r = canvasRef.current.getBoundingClientRect()
      const cx = e.clientX - r.left, cy = e.clientY - r.top

      if (drag.current.type === 'table' && drag.current.id) {
        const off = drag.current.offset ?? { x: 0, y: 0 }
        const x = Math.max(0, Math.min(cx - off.x, CW - 40))
        const y = Math.max(0, Math.min(cy - off.y, CH - 40))
        const el = tableRefs.current[drag.current.id]
        if (el) { el.style.left = x + 'px'; el.style.top = y + 'px' }
        dragPos.current = { x, y }
      }

      if (drag.current.type === 'vertex' && drag.current.idx !== undefined) {
        const idx = drag.current.idx
        const sid = salaIdRef.current
        const x = Math.max(0, Math.min(cx, CW)), y = Math.max(0, Math.min(cy, CH))
        setSale(prev => prev.map(s => {
          if (s.id !== sid || !s.punti_poligono) return s
          const pts = [...s.punti_poligono]; pts[idx] = { x, y }
          return { ...s, punti_poligono: pts }
        }))
      }

      if (drag.current.type === 'rotate' && drag.current.id) {
        const tid = drag.current.id
        const t = tavoliRef.current.find(tv => tv.id === tid)
        if (t) {
          const tcx = t.pos_x + t.larghezza / 2, tcy = t.pos_y + t.altezza / 2
          const angle = Math.atan2(cx - tcx, -(cy - tcy)) * 180 / Math.PI
          const snapped = Math.round(angle / 5) * 5
          setTavoli(prev => prev.map(tv => tv.id === tid ? { ...tv, rotazione: snapped } : tv))
          setDirty(true)
        }
      }
    }

    function onUp(e: MouseEvent) {
      if (!drag.current) return
      const d = drag.current; drag.current = null

      if (d.type === 'table' && d.id) {
        const pos = { ...dragPos.current }
        setTavoli(prev => prev.map(t => t.id === d.id ? { ...t, pos_x: pos.x, pos_y: pos.y } : t))
        setDirty(true)
      }
      if (d.type === 'vertex') {
        const sala = saleRef.current.find(s => s.id === salaIdRef.current)
        if (sala?.punti_poligono) {
          updateDB('sale', { punti_poligono: sala.punti_poligono }, { id: sala.id }).catch(() => {})
        }
      }
    }

    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    return () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp) }
  }, [])

  function startTableDrag(e: React.MouseEvent, t: Tavolo) {
    if (mode !== 'editor' || tool !== 'select') return
    e.preventDefault(); e.stopPropagation()
    setSelId(t.id)
    const off = canvasRef.current
      ? { x: e.clientX - canvasRef.current.getBoundingClientRect().left - t.pos_x, y: e.clientY - canvasRef.current.getBoundingClientRect().top - t.pos_y }
      : { x: 0, y: 0 }
    drag.current = { type: 'table', id: t.id, offset: off }
    dragPos.current = { x: t.pos_x, y: t.pos_y }
  }

  function startRotate(e: React.MouseEvent, t: Tavolo) {
    e.preventDefault(); e.stopPropagation()
    drag.current = { type: 'rotate', id: t.id }
  }

  function startVertexDrag(e: React.MouseEvent, idx: number) {
    e.preventDefault(); e.stopPropagation()
    drag.current = { type: 'vertex', idx }
  }

  function onCanvasClick(e: React.MouseEvent) {
    if (tool !== 'drawSala' || !canvasRef.current) return
    const r = canvasRef.current.getBoundingClientRect()
    const pt = { x: e.clientX - r.left, y: e.clientY - r.top }
    // Click on first vertex to close (if ≥3 pts)
    if (drawVerts.length >= 3) {
      const first = drawVerts[0]
      const dist = Math.hypot(pt.x - first.x, pt.y - first.y)
      if (dist < 16) { closePolygon(); return }
    }
    setDrawVerts(prev => [...prev, pt])
  }

  function closePolygon() {
    if (drawVerts.length < 3) return
    const sala = sale.find(s => s.id === salaId)
    if (!sala) return
    const updated = { ...sala, punti_poligono: drawVerts }
    setSale(prev => prev.map(s => s.id === salaId ? updated : s))
    updateDB('sale', { punti_poligono: drawVerts }, { id: salaId }).catch(() => {})
    setDrawVerts([]); setTool('select')
  }

  function cancelDraw() { setDrawVerts([]); setTool('select') }

  // ── CRUD
  async function saveSala(data: Partial<Sala>, isNew: boolean, existingId?: string) {
    if (!data.nome?.trim()) return
    try {
      if (isNew) {
        const rows = await insertDB<Sala>('sale', { ...data, sede_id: sedeId, ordine: sale.length, colore: data.colore ?? '#94a3b8', punti_poligono: null })
        setSale(prev => [...prev, rows[0]]); setSalaId(rows[0].id)
      } else if (existingId) {
        await updateDB('sale', data, { id: existingId })
        setSale(prev => prev.map(s => s.id === existingId ? { ...s, ...data } : s))
      }
      setSalaModal(null)
    } catch (err) { setError('Errore: ' + (err as Error).message) }
  }

  async function deleteSala(id: string) {
    if (!confirm('Eliminare questa sala e tutti i tavoli?')) return
    try {
      await deleteDB('sale', { id })
      const rest = sale.filter(s => s.id !== id)
      setSale(rest); if (salaId === id) setSalaId(rest[0]?.id ?? '')
    } catch (err) { setError('Errore: ' + (err as Error).message) }
  }

  async function addTavolo(d: Omit<Tavolo,'id'|'sala_id'>) {
    if (!salaId) return
    const cx = Math.round(CW/2 - d.larghezza/2), cy = Math.round(CH/2 - d.altezza/2)
    try {
      const rows = await insertDB<Tavolo>('tavoli', { ...d, sala_id: salaId, pos_x: cx, pos_y: cy })
      setTavoli(prev => [...prev, rows[0]]); setSelId(rows[0].id); setShowAddT(false)
    } catch (err) { setError('Errore: ' + (err as Error).message) }
  }

  async function deleteTavolo(id: string) {
    if (!confirm('Eliminare questo tavolo?')) return
    try {
      await deleteDB('tavoli', { id })
      setTavoli(prev => prev.filter(t => t.id !== id)); setSelId(null)
    } catch (err) { setError('Errore: ' + (err as Error).message) }
  }

  async function duplicateTavolo(t: Tavolo) {
    try {
      const { id: _id, ...rest } = t
      const rows = await insertDB<Tavolo>('tavoli', { ...rest, nome: t.nome + ' (copia)', pos_x: t.pos_x + 24, pos_y: t.pos_y + 24 })
      setTavoli(prev => [...prev, rows[0]]); setSelId(rows[0].id)
    } catch (err) { setError('Errore: ' + (err as Error).message) }
  }

  async function saveLayout() {
    if (!dirty || !tavoli.length) return
    setSaving(true)
    try {
      await Promise.all(tavoli.map(t => updateDB('tavoli', {
        nome: t.nome, forma: t.forma, capienza: t.capienza, capienza_min: t.capienza_min,
        capienza_max: t.capienza_max, capienza_evento: t.capienza_evento,
        pos_x: t.pos_x, pos_y: t.pos_y, larghezza: t.larghezza, altezza: t.altezza,
        rotazione: t.rotazione, note: t.note, accessibile: t.accessibile,
        nome_cameriere: t.nome_cameriere, unione_gruppo: t.unione_gruppo,
      }, { id: t.id })))
      setDirty(false)
    } catch (err) { setError('Errore salvataggio: ' + (err as Error).message) }
    finally { setSaving(false) }
  }

  async function updateStato(tavoloId: string, stato: Stato, note: string, coperti: number|null, cam: string, apri: boolean) {
    const existing = statiMap[tavoloId]
    const payload: Record<string, unknown> = {
      tavolo_id: tavoloId, stato, note: note||null, coperti_effettivi: coperti,
      aggiornato_at: new Date().toISOString(),
      cameriere_assegnato: cam||null,
      ora_apertura: apri ? new Date().toISOString() : (existing?.ora_apertura ?? null),
    }
    if (stato !== 'occupato') payload.ora_apertura = null
    try {
      await upsertDB('stato_tavoli', payload, 'tavolo_id')
      setStatiMap(prev => ({ ...prev, [tavoloId]: payload as unknown as StatoTavolo }))
    } catch (err) { setError('Errore: ' + (err as Error).message) }
    setOperModal(null)
  }

  function patchSel(p: Partial<Tavolo>) {
    if (!selId) return
    setTavoli(prev => prev.map(t => t.id === selId ? { ...t, ...p } : t))
    setDirty(true)
  }

  // ── derived
  const selTavolo  = tavoli.find(t => t.id === selId) ?? null
  const salaSel    = sale.find(s => s.id === salaId)
  const sedeSel    = sedi.find(s => s.id === sedeId)
  const counts     = STATI.reduce((a, s) => { a[s] = tavoli.filter(t => (statiMap[t.id]?.stato ?? 'libero') === s).length; return a }, {} as Record<Stato,number>)
  const gruppen    = new Set(tavoli.filter(t => t.unione_gruppo).map(t => t.unione_gruppo!))

  // ══════════════════════════════════════ RENDER
  return (
    <div className="p-5 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-orange-500 flex items-center justify-center shrink-0">
            <LayoutGrid className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-slate-900">Mappa Tavoli</h1>
            {sedeSel && <p className="text-xs text-slate-500">{sedeSel.nome} · {sedeSel.citta}</p>}
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex bg-slate-100 rounded-xl p-1">
            {([['editor','Editor',Settings],['operativo','Operativo',Eye]] as const).map(([m,lbl,Icon]) => (
              <button key={m} onClick={() => { setMode(m as 'editor'|'operativo'); setTool('select') }}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition ${mode===m?'bg-white text-slate-900 shadow-sm':'text-slate-500 hover:text-slate-700'}`}>
                <Icon className="w-3.5 h-3.5" />{lbl}
              </button>
            ))}
          </div>
          <div className="relative">
            <select value={sedeId} onChange={e => setSedeId(e.target.value)}
              className="appearance-none pl-3 pr-7 py-2 text-xs font-medium bg-white border border-slate-200 rounded-xl text-slate-700 focus:outline-none cursor-pointer">
              {sedi.map(s => <option key={s.id} value={s.id}>{s.nome}</option>)}
            </select>
            <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-sm text-red-700 flex justify-between gap-2">
          {error}<button onClick={() => setError(null)}><X className="w-4 h-4 shrink-0" /></button>
        </div>
      )}

      {/* Sala tabs + toolbar */}
      <div className="flex items-center gap-2 flex-wrap">
        {sale.map(s => (
          <div key={s.id} className="flex items-center gap-0.5">
            <button onClick={() => setSalaId(s.id)}
              style={{ borderBottom: salaId===s.id ? `3px solid ${s.colore}` : '3px solid transparent' }}
              className={`px-3 py-1.5 rounded-t-lg text-xs font-medium transition ${salaId===s.id?'bg-white text-slate-900':'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}>
              {s.nome}
            </button>
            {mode === 'editor' && (
              <button onClick={() => setSalaModal({ sala: s, isNew: false })} className="text-slate-300 hover:text-slate-600 transition p-0.5">
                <Settings className="w-3 h-3" />
              </button>
            )}
            {mode === 'editor' && sale.length > 1 && (
              <button onClick={() => deleteSala(s.id)} className="text-slate-300 hover:text-red-400 transition p-0.5">
                <X className="w-3 h-3" />
              </button>
            )}
          </div>
        ))}
        <button onClick={() => setSalaModal({ sala: {}, isNew: true })}
          className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs text-slate-500 border border-dashed border-slate-300 hover:border-orange-400 hover:text-orange-500 transition">
          <Plus className="w-3 h-3" /> Sala
        </button>

        {/* Editor tools */}
        {mode === 'editor' && salaId && (
          <div className="ml-auto flex items-center gap-2">
            {tool === 'drawSala' ? (
              <>
                <span className="text-xs text-orange-600 font-medium">
                  {drawVerts.length === 0 ? 'Clicca per aggiungere vertici' : `${drawVerts.length} vertici — clicca il primo per chiudere`}
                </span>
                {drawVerts.length >= 3 && (
                  <button onClick={closePolygon} className="flex items-center gap-1 px-3 py-1.5 text-xs bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 transition">
                    <Check className="w-3 h-3" /> Chiudi forma
                  </button>
                )}
                <button onClick={cancelDraw} className="px-3 py-1.5 text-xs border border-slate-200 text-slate-600 rounded-lg hover:bg-slate-50 transition">
                  Annulla
                </button>
              </>
            ) : (
              <>
                <button onClick={() => { setSelId(null); setDrawVerts([]); setTool('drawSala') }}
                  title="Disegna contorno sala"
                  style={{ borderColor: salaSel?.colore ?? '#94a3b8' }}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs border-2 text-slate-600 rounded-lg hover:bg-slate-50 transition">
                  <PenTool className="w-3.5 h-3.5" /> Contorno sala
                </button>
                <button onClick={() => setShowAddT(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition">
                  <Plus className="w-3.5 h-3.5" /> Tavolo
                </button>
                <button onClick={saveLayout} disabled={!dirty || saving}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-slate-800 text-white rounded-lg hover:bg-slate-900 transition disabled:opacity-40 disabled:cursor-not-allowed">
                  <Save className="w-3.5 h-3.5" /> {saving ? 'Salvataggio...' : dirty ? 'Salva*' : 'Salvato'}
                </button>
              </>
            )}
          </div>
        )}

        {/* Operative toolbar */}
        {mode === 'operativo' && (
          <button onClick={() => loadStati(tavoliRef.current.map(t=>t.id))}
            className="ml-auto flex items-center gap-1.5 px-3 py-1.5 text-xs text-slate-500 border border-slate-200 rounded-lg hover:bg-slate-50 transition">
            <RefreshCw className="w-3.5 h-3.5" />
            {lastRefresh?.toLocaleTimeString('it-IT',{hour:'2-digit',minute:'2-digit',second:'2-digit'})}
          </button>
        )}
      </div>

      {/* Operative legend */}
      {mode === 'operativo' && tavoli.length > 0 && (
        <div className="flex items-center gap-3 flex-wrap text-xs text-slate-600">
          {STATI.map(s => (
            <div key={s} className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-full" style={{ background: SC[s].dot }} />
              {SC[s].label} <span className="font-bold text-slate-900">{counts[s]}</span>
            </div>
          ))}
        </div>
      )}

      {/* Canvas + EditorPanel */}
      {salaId ? (
        <div className="flex gap-4 items-start">
          <div className="flex-1 min-w-0 overflow-auto rounded-xl border border-slate-200">
            {loading ? (
              <div className="flex items-center justify-center h-40 text-slate-400 text-sm">Caricamento...</div>
            ) : (
              <div
                ref={canvasRef}
                style={{
                  width: CW, height: CH, position: 'relative',
                  backgroundColor: '#f8fafc',
                  backgroundImage: 'radial-gradient(circle, #cbd5e1 1px, transparent 1px)',
                  backgroundSize: '24px 24px',
                  cursor: tool === 'drawSala' ? 'crosshair' : 'default',
                }}
                onClick={tool === 'drawSala' ? onCanvasClick : undefined}
                onMouseMove={tool === 'drawSala' ? (e) => {
                  if (!canvasRef.current) return
                  const r = canvasRef.current.getBoundingClientRect()
                  setMousePos({ x: e.clientX - r.left, y: e.clientY - r.top })
                } : undefined}
                onMouseLeave={() => setMousePos(null)}
              >
                {/* Background planimetria */}
                {salaSel?.sfondo_url && (
                  <img src={salaSel.sfondo_url} alt="" style={{ position:'absolute', inset:0, width:'100%', height:'100%', objectFit:'contain', opacity:0.25, pointerEvents:'none' }} />
                )}

                {/* SVG: polygon + draw preview */}
                <svg style={{ position:'absolute', inset:0, width:CW, height:CH, pointerEvents:'none', zIndex:1 }}>
                  {/* Saved polygon */}
                  {salaSel?.punti_poligono && salaSel.punti_poligono.length >= 3 && (
                    <>
                      <polygon
                        points={salaSel.punti_poligono.map(p=>`${p.x},${p.y}`).join(' ')}
                        fill={salaSel.colore + '18'} stroke={salaSel.colore} strokeWidth={2} />
                      {/* Vertex handles in editor */}
                      {mode === 'editor' && tool !== 'drawSala' && salaSel.punti_poligono.map((p,i) => (
                        <circle key={i} cx={p.x} cy={p.y} r={6}
                          fill={salaSel.colore} stroke="white" strokeWidth={2}
                          style={{ cursor:'grab', pointerEvents:'auto' }}
                          onMouseDown={e => startVertexDrag(e, i)} />
                      ))}
                    </>
                  )}
                  {/* Draw preview */}
                  {tool === 'drawSala' && drawVerts.length > 0 && (
                    <>
                      {drawVerts.length >= 3 && (
                        <polygon points={drawVerts.map(p=>`${p.x},${p.y}`).join(' ')}
                          fill={(salaSel?.colore ?? '#94a3b8') + '14'} stroke={salaSel?.colore ?? '#94a3b8'} strokeWidth={1.5} strokeDasharray="5 3" />
                      )}
                      {mousePos && (
                        <line x1={drawVerts[drawVerts.length-1].x} y1={drawVerts[drawVerts.length-1].y}
                          x2={mousePos.x} y2={mousePos.y}
                          stroke={salaSel?.colore ?? '#94a3b8'} strokeWidth={1.5} strokeDasharray="4 4" />
                      )}
                      {drawVerts.map((p,i) => (
                        <circle key={i} cx={p.x} cy={p.y} r={i===0?8:5}
                          fill={i===0?(salaSel?.colore??'#94a3b8'):'white'}
                          stroke={salaSel?.colore ?? '#94a3b8'} strokeWidth={2}
                          style={{ cursor: i===0&&drawVerts.length>=3?'pointer':'default', pointerEvents: i===0?'auto':'none' }}
                          onClick={i===0&&drawVerts.length>=3?closePolygon:undefined} />
                      ))}
                    </>
                  )}
                </svg>

                {/* Empty state */}
                {tavoli.length === 0 && tool === 'select' && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-slate-400 pointer-events-none" style={{ zIndex:0 }}>
                    <LayoutGrid className="w-14 h-14 opacity-10" />
                    <p className="text-sm">Nessun tavolo — clicca «Tavolo» per aggiungerne uno</p>
                  </div>
                )}

                {/* Tables */}
                {tavoli.map(t => {
                  const st = statiMap[t.id] ?? null
                  const isUnito = gruppen.has(t.unione_gruppo ?? '') && !!t.unione_gruppo
                  const timerStr = mode === 'operativo' ? elapsed(st?.ora_apertura ?? null) : null
                  return (
                    <TavoloShape key={t.id} t={t} st={st} mode={mode}
                      selected={selId === t.id} isUnito={isUnito} timerStr={timerStr}
                      divRef={el => { tableRefs.current[t.id] = el }}
                      onMouseDown={mode==='editor'&&tool==='select' ? (e) => { e.stopPropagation(); startTableDrag(e,t) } : undefined}
                      onRotateStart={mode==='editor' ? (e) => startRotate(e,t) : undefined}
                      onClick={mode==='operativo' ? () => setOperModal(t) : undefined}
                    />
                  )
                })}
              </div>
            )}
          </div>

          {/* Editor panel */}
          {mode === 'editor' && selTavolo && (
            <EditorPanel
              t={selTavolo} onChange={patchSel}
              onDelete={() => deleteTavolo(selTavolo.id)}
              onDuplicate={() => duplicateTavolo(selTavolo)}
              onClose={() => setSelId(null)}
            />
          )}
        </div>
      ) : (
        !loading && sedeId && (
          <div className="text-center py-20 text-slate-400 text-sm">
            Crea una sala per iniziare.
          </div>
        )
      )}

      {/* Modals */}
      {showAddT && <AddTavoloModal n={`T${tavoli.length+1}`} onAdd={addTavolo} onClose={() => setShowAddT(false)} />}
      {salaModal && (
        <SalaModal
          sala={salaModal.sala} isNew={salaModal.isNew} sedeId={sedeId}
          onSave={d => saveSala(d, salaModal.isNew, salaModal.isNew ? undefined : (salaModal.sala as Sala).id)}
          onClose={() => setSalaModal(null)}
        />
      )}
      {operModal && (
        <OperModal t={operModal} st={statiMap[operModal.id] ?? null}
          onClose={() => setOperModal(null)}
          onSave={(s,n,c,cam,apri) => updateStato(operModal.id,s,n,c,cam,apri)} />
      )}
    </div>
  )
}
