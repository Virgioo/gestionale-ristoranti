'use client'

import React, { useEffect, useState, useCallback, useRef } from 'react'
import { queryDB, updateDB } from '@/lib/api'

// ─── Types ────────────────────────────────────────────────────────────────────
interface RigaDB {
  piatto_nome: string
  categoria:   string
  quantita:    number
  note:        string | null
  tempo_prep?: number
}
interface ComandaDB {
  id:            string
  tavolo_nome:   string | null
  numero_tavolo: string | null
  cameriere:     string | null
  note:          string | null
  righe:         RigaDB[]
  inviata_at:    string | null
  created_at:    string
}

// ─── Config ───────────────────────────────────────────────────────────────────
const CAT_CONFIG: Record<string, { label: string; color: string }> = {
  antipasti: { label: 'ANTIPASTI', color: '#F59E0B' },
  primi:     { label: 'PRIMI',     color: '#3B82F6' },
  secondi:   { label: 'SECONDI',  color: '#EF4444' },
  dolci:     { label: 'DOLCI',    color: '#8B5CF6' },
}
const CAT_ORDER   = ['antipasti', 'primi', 'secondi', 'dolci']
const TWO_HOURS   = 2 * 60 * 60 * 1000

const TEMPO_CAT_DEFAULT: Record<string, number> = {
  antipasti: 10, primi: 15, secondi: 20, dolci: 6, bevande: 2, vini: 2, menu_cani: 5,
}

type ViewMode = 'compact' | 'detail'

// ─── Audio ────────────────────────────────────────────────────────────────────
function playDoubleBeep() {
  try {
    const ctx = new AudioContext()
    ;[0, 0.22].forEach(offset => {
      const osc = ctx.createOscillator(), gain = ctx.createGain()
      osc.connect(gain); gain.connect(ctx.destination)
      osc.type = 'sine'; osc.frequency.value = 1050
      gain.gain.setValueAtTime(0, ctx.currentTime + offset)
      gain.gain.linearRampToValueAtTime(0.5, ctx.currentTime + offset + 0.01)
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + offset + 0.18)
      osc.start(ctx.currentTime + offset); osc.stop(ctx.currentTime + offset + 0.18)
    })
    setTimeout(() => ctx.close(), 1000)
  } catch {}
}
function playNewBeep() {
  try {
    const ctx = new AudioContext()
    const osc = ctx.createOscillator(), gain = ctx.createGain()
    osc.connect(gain); gain.connect(ctx.destination)
    osc.type = 'sine'
    osc.frequency.setValueAtTime(880, ctx.currentTime)
    osc.frequency.setValueAtTime(660, ctx.currentTime + 0.14)
    gain.gain.setValueAtTime(0, ctx.currentTime)
    gain.gain.linearRampToValueAtTime(0.35, ctx.currentTime + 0.01)
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.45)
    osc.start(ctx.currentTime); osc.stop(ctx.currentTime + 0.45)
    setTimeout(() => ctx.close(), 800)
  } catch {}
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function elapsedMin(iso: string)  { return (Date.now() - new Date(iso).getTime()) / 60_000 }
function fmtElapsed(iso: string)  {
  const ms = Date.now() - new Date(iso).getTime()
  return `${Math.floor(ms / 60_000)}:${String(Math.floor((ms % 60_000) / 1_000)).padStart(2, '0')}`
}
function fmtArrival(iso: string)  {
  return new Date(iso).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })
}
function urgency(iso: string): { color: string; blink: boolean; label: string } {
  const m = elapsedMin(iso)
  if (m >= 12) return { color: '#ef4444', blink: true,  label: 'URGENTE'    }
  if (m >= 8)  return { color: '#f59e0b', blink: false, label: 'ATTENZIONE' }
  if (m >= 3)  return { color: '#4b5563', blink: false, label: ''           }
  return               { color: '#22c55e', blink: false, label: 'NUOVO'     }
}
function timerColor(iso: string) {
  const m = elapsedMin(iso)
  if (m >= 12) return '#ef4444'
  if (m >= 8)  return '#f59e0b'
  if (m >= 3)  return '#9ca3af'
  return '#22c55e'
}
function rigaTempo(r: RigaDB): number {
  return r.tempo_prep ?? TEMPO_CAT_DEFAULT[r.categoria] ?? 10
}
function tempoStimato(comanda: ComandaDB): number {
  if (!comanda.righe.length) return 0
  return Math.max(...comanda.righe.map(rigaTempo))
}

// Returns dishKey of the next dish to activate after a category completes, or null
function findNextDishToActivate(comanda: ComandaDB, doneDishes: Set<string>): string | null {
  // For each cat in order, if all done → find first undone in next cat
  const cats = [...new Set(comanda.righe.map(r => r.categoria))]
  const orderedCats = [...CAT_ORDER.filter(c => cats.includes(c)), ...cats.filter(c => !CAT_ORDER.includes(c))]

  for (let ci = 0; ci < orderedCats.length - 1; ci++) {
    const cat = orderedCats[ci]
    const catDishes = comanda.righe.map((r, i) => ({ r, i })).filter(({ r }) => r.categoria === cat)
    if (catDishes.length === 0) continue
    const allDone = catDishes.every(({ i }) => doneDishes.has(`${comanda.id}:${i}`))
    if (!allDone) continue

    // This category is fully done — find first undone dish in next categories
    for (let nci = ci + 1; nci < orderedCats.length; nci++) {
      const nextCat = orderedCats[nci]
      const nextUndone = comanda.righe.map((r, i) => ({ r, i }))
        .filter(({ r, i }) => r.categoria === nextCat && !doneDishes.has(`${comanda.id}:${i}`))
      if (nextUndone.length > 0) return `${comanda.id}:${nextUndone[0].i}`
    }
  }
  return null
}

// ─── Clock ────────────────────────────────────────────────────────────────────
function Clock() {
  const [t, setT] = useState('')
  useEffect(() => {
    const tick = () => setT(new Date().toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit', second: '2-digit' }))
    tick(); const id = setInterval(tick, 1_000); return () => clearInterval(id)
  }, [])
  return <span style={{ fontFamily: 'monospace', fontWeight: 900, fontSize: 34, color: '#fff', letterSpacing: 4 }}>{t}</span>
}

// ─── Live timer (self-updating) ───────────────────────────────────────────────
function LiveTimer({ iso, size = 22 }: { iso: string; size?: number }) {
  const [, tick] = useState(0)
  useEffect(() => { const id = setInterval(() => tick(n => n + 1), 1_000); return () => clearInterval(id) }, [])
  return <span style={{ fontFamily: 'monospace', fontWeight: 900, fontSize: size, color: timerColor(iso), lineHeight: 1 }}>{fmtElapsed(iso)}</span>
}

// ─── Countdown timer for next dish ───────────────────────────────────────────
function LiveCountdown({ activatedAt, prepMin }: { activatedAt: number; prepMin: number }) {
  const [, tick] = useState(0)
  useEffect(() => { const id = setInterval(() => tick(n => n + 1), 1_000); return () => clearInterval(id) }, [])
  const remainMs = Math.max(0, activatedAt + prepMin * 60_000 - Date.now())
  if (remainMs === 0) return <span style={{ color: '#4ade80', fontSize: 9, fontWeight: 900, letterSpacing: 1 }}>INIZIA ORA!</span>
  const m = Math.floor(remainMs / 60_000)
  const s = Math.floor((remainMs % 60_000) / 1_000)
  return <span style={{ color: '#f59e0b', fontSize: 9, fontWeight: 900 }}>↻ {m}:{String(s).padStart(2, '0')}</span>
}

// ─── Time progress bar (self-updating) ───────────────────────────────────────
function TimeProgressBar({ comanda, style }: { comanda: ComandaDB; style?: React.CSSProperties }) {
  const [, tick] = useState(0)
  useEffect(() => { const id = setInterval(() => tick(n => n + 1), 5_000); return () => clearInterval(id) }, [])
  const ts = comanda.inviata_at ?? comanda.created_at
  const est = tempoStimato(comanda) * 60_000
  if (est <= 0) return null
  const pct  = Math.min(1, (Date.now() - new Date(ts).getTime()) / est)
  const color = pct >= 1 ? '#ef4444' : pct >= 0.8 ? '#f59e0b' : '#22c55e'
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, ...style }}>
      <div style={{ flex: 1, height: 3, background: '#111', borderRadius: 2, overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${pct * 100}%`, background: color, borderRadius: 2, transition: 'width 1s' }} />
      </div>
      <span style={{ color: '#374151', fontSize: 9, fontWeight: 700, flexShrink: 0 }}>⏱{tempoStimato(comanda)}'</span>
    </div>
  )
}

// ─── Shared: dish progress ────────────────────────────────────────────────────
function dishStats(comanda: ComandaDB, dishDone: Set<string>) {
  const total = comanda.righe.length
  const done  = comanda.righe.filter((_, i) => dishDone.has(`${comanda.id}:${i}`)).length
  return { total, done, pct: total > 0 ? done / total : 0 }
}

// ─── COMPACT CARD (132px) ─────────────────────────────────────────────────────
function CompactCard({ comanda, dishDone, isDone, blink, onExpand, onAllDone }: {
  comanda:   ComandaDB
  dishDone:  Set<string>
  isDone:    boolean
  blink:     boolean
  onExpand:  (id: string) => void
  onAllDone: (id: string) => void
}) {
  const ts   = comanda.inviata_at ?? comanda.created_at
  const urg  = urgency(ts)
  const { total, done, pct } = dishStats(comanda, dishDone)
  const borderColor = isDone ? '#22c55e' : urg.blink ? (blink ? '#ef4444' : '#3a0a0a') : urg.color
  const tavolo = (comanda.tavolo_nome ?? comanda.numero_tavolo ?? 'T?').toUpperCase()

  return (
    <div
      onClick={() => !isDone && onExpand(comanda.id)}
      style={{
        height: 132, background: isDone ? '#0a1f12' : '#141414',
        borderLeft: `3px solid ${borderColor}`, borderRadius: 8,
        cursor: isDone ? 'default' : 'pointer',
        display: 'flex', flexDirection: 'column',
        overflow: 'hidden', transition: 'background 0.4s ease',
        position: 'relative',
      }}
    >
      {isDone ? (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ color: '#4ade80', fontWeight: 900, fontSize: 12, letterSpacing: 2, opacity: blink ? 1 : 0.15 }}>
            ✓ PRONTO
          </div>
          <div style={{ color: '#166534', fontSize: 12, fontWeight: 700, marginTop: 4 }}>{tavolo}</div>
        </div>
      ) : (
        <>
          {/* Row 1: tavolo + timer */}
          <div style={{ padding: '8px 12px 2px', display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
            <span style={{ color: '#fff', fontWeight: 900, fontSize: 18, letterSpacing: 1, lineHeight: 1 }}>{tavolo}</span>
            <LiveTimer iso={ts} size={17} />
          </div>

          {/* Row 2: cameriere + urgency + estimated time */}
          <div style={{ padding: '0 12px 4px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ color: '#374151', fontSize: 11, fontWeight: 600 }}>{comanda.cameriere ?? ''}</span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              {urg.label && <span style={{ color: urg.color, fontSize: 9, fontWeight: 900, letterSpacing: 2 }}>{urg.label}</span>}
            </span>
          </div>

          {/* Row 3: dish progress bar */}
          <div style={{ padding: '0 12px 4px', display: 'flex', alignItems: 'center', gap: 7 }}>
            <div style={{ flex: 1, height: 4, background: '#1f1f1f', borderRadius: 2, overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${pct * 100}%`, background: pct === 1 ? '#22c55e' : '#3b82f6', borderRadius: 2, transition: 'width 0.3s' }} />
            </div>
            <span style={{ color: '#374151', fontSize: 10, fontWeight: 700, whiteSpace: 'nowrap' }}>{done}/{total}</span>
          </div>

          {/* Row 4: time progress bar */}
          <TimeProgressBar comanda={comanda} style={{ padding: '0 12px 5px' }} />

          {/* Row 5: TUTTO PRONTO button */}
          <button
            onClick={e => { e.stopPropagation(); onAllDone(comanda.id) }}
            style={{
              margin: '0 8px 8px', height: 28, flexShrink: 0,
              background: '#16a34a', color: '#fff',
              border: 'none', borderRadius: 5,
              fontWeight: 900, fontSize: 11, letterSpacing: 2, cursor: 'pointer',
              transition: 'background 0.1s, transform 0.1s',
            }}
            onMouseDown={e => { e.currentTarget.style.transform = 'scale(0.97)'; e.currentTarget.style.background = '#15803d' }}
            onMouseUp={e =>   { e.currentTarget.style.transform = 'scale(1)';   e.currentTarget.style.background = '#16a34a' }}
          >
            ✓ TUTTO PRONTO
          </button>
        </>
      )}
    </div>
  )
}

// ─── DETAIL CARD (inside modal or grid) ──────────────────────────────────────
function DetailCard({ comanda, dishDone, dishActivated, onDishDone, isDone, blink, onAllDone }: {
  comanda:       ComandaDB
  dishDone:      Set<string>
  dishActivated: Map<string, number>
  onDishDone:   (key: string) => void
  isDone:        boolean
  blink:         boolean
  onAllDone:     (id: string) => void
}) {
  const ts  = comanda.inviata_at ?? comanda.created_at
  const urg = urgency(ts)
  const { total, done, pct } = dishStats(comanda, dishDone)
  const borderColor = isDone ? '#22c55e' : urg.blink ? (blink ? '#ef4444' : '#5a0a0a') : urg.color
  const tavolo = (comanda.tavolo_nome ?? comanda.numero_tavolo ?? 'T?').toUpperCase()
  const est = tempoStimato(comanda)

  const grouped: Record<string, { riga: RigaDB; idx: number }[]> = {}
  comanda.righe.forEach((r, idx) => {
    const cat = r.categoria ?? 'altro'
    if (!grouped[cat]) grouped[cat] = []
    grouped[cat].push({ riga: r, idx })
  })
  const orderedCats = [...CAT_ORDER.filter(c => grouped[c]), ...Object.keys(grouped).filter(c => !CAT_ORDER.includes(c))]

  return (
    <div style={{
      background: isDone ? '#0a1f12' : '#141414',
      borderLeft: `3px solid ${borderColor}`,
      borderRadius: 8, overflow: 'hidden',
      transition: 'background 0.5s ease',
    }}>
      {isDone ? (
        <div style={{ padding: '28px 20px', textAlign: 'center' }}>
          <div style={{ color: '#4ade80', fontWeight: 900, fontSize: 20, letterSpacing: 3, opacity: blink ? 1 : 0.15 }}>
            ✓ PRONTO — AVVISARE SALA
          </div>
          <div style={{ color: '#166534', fontWeight: 700, fontSize: 14, marginTop: 8 }}>{tavolo}</div>
        </div>
      ) : (
        <>
          {/* Header */}
          <div style={{ padding: '13px 16px 10px', borderBottom: '1px solid #1f1f1f' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <div style={{ color: '#fff', fontWeight: 900, fontSize: 26, lineHeight: 1, letterSpacing: 1 }}>{tavolo}</div>
                {comanda.cameriere && <div style={{ color: '#4b5563', fontSize: 12, fontWeight: 600, marginTop: 4 }}>{comanda.cameriere}</div>}
              </div>
              <div style={{ textAlign: 'right' }}>
                <LiveTimer iso={ts} size={22} />
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 8, marginTop: 4 }}>
                  {est > 0 && <span style={{ color: '#374151', fontSize: 10, fontWeight: 600 }}>⏱ {est} min</span>}
                  {urg.label && <span style={{ color: urg.color, fontSize: 10, fontWeight: 900, letterSpacing: 2 }}>{urg.label}</span>}
                </div>
              </div>
            </div>

            {/* Dish completion bar */}
            <div style={{ height: 3, background: '#1f1f1f', borderRadius: 2, marginTop: 10, overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${pct * 100}%`, background: pct === 1 ? '#22c55e' : '#3b82f6', borderRadius: 2, transition: 'width 0.3s' }} />
            </div>

            {/* Time progress bar */}
            {est > 0 && <TimeProgressBar comanda={comanda} style={{ marginTop: 5 }} />}
          </div>

          {/* Dishes */}
          <div style={{ padding: '4px 0' }}>
            {orderedCats.map((cat, ci) => {
              const cfg    = CAT_CONFIG[cat] ?? { label: cat.toUpperCase(), color: '#6b7280' }
              const dishes = grouped[cat]
              return (
                <div key={cat} style={{ borderTop: ci > 0 ? '1px solid #1a1a1a' : 'none' }}>
                  <div style={{ padding: '7px 16px 3px', display: 'flex', alignItems: 'center', gap: 6 }}>
                    <div style={{ width: 6, height: 6, borderRadius: '50%', background: cfg.color, flexShrink: 0 }} />
                    <span style={{ color: cfg.color, fontSize: 10, fontWeight: 900, letterSpacing: 3 }}>{cfg.label}</span>
                  </div>
                  {dishes.map(({ riga, idx }) => {
                    const dishKey   = `${comanda.id}:${idx}`
                    const d         = dishDone.has(dishKey)
                    const activatedAt = dishActivated.get(dishKey)
                    const prepMin   = rigaTempo(riga)
                    return (
                      <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '7px 16px', opacity: d ? 0.28 : 1, transition: 'opacity 0.25s' }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, flexWrap: 'wrap' }}>
                            {riga.quantita > 1 && (
                              <span style={{ color: d ? '#374151' : cfg.color, fontWeight: 900, fontSize: 18, lineHeight: 1, textDecoration: d ? 'line-through' : 'none' }}>
                                {riga.quantita}×
                              </span>
                            )}
                            <span style={{ color: d ? '#374151' : '#e5e7eb', fontWeight: 700, fontSize: 15, lineHeight: 1.35, textDecoration: d ? 'line-through' : 'none' }}>
                              {riga.piatto_nome}
                            </span>
                            {/* Prep time badge */}
                            <span style={{ color: '#374151', fontSize: 9, fontWeight: 700, background: '#1a1a1a', borderRadius: 3, padding: '1px 5px', flexShrink: 0 }}>
                              {prepMin}'
                            </span>
                            {/* Countdown for activated dish */}
                            {!d && activatedAt && (
                              <LiveCountdown activatedAt={activatedAt} prepMin={prepMin} />
                            )}
                          </div>
                          {riga.note && !d && (
                            <div style={{ color: '#4b5563', fontSize: 11, fontStyle: 'italic', marginTop: 2, paddingLeft: riga.quantita > 1 ? 26 : 0 }}>
                              {riga.note}
                            </div>
                          )}
                        </div>
                        <button
                          onClick={() => { if (!d) onDishDone(dishKey) }}
                          style={{
                            width: 44, height: 44, flexShrink: 0,
                            background: d ? '#1a1a1a' : cfg.color,
                            color: d ? '#2a2a2a' : '#000',
                            border: 'none', borderRadius: 6,
                            fontWeight: 900, fontSize: 19, cursor: d ? 'default' : 'pointer',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            transition: 'background 0.2s, transform 0.1s',
                          }}
                          onMouseDown={e => { if (!d) e.currentTarget.style.transform = 'scale(0.92)' }}
                          onMouseUp={e =>   { e.currentTarget.style.transform = 'scale(1)' }}
                        >✓</button>
                      </div>
                    )
                  })}
                </div>
              )
            })}
            {comanda.note && (
              <div style={{ padding: '6px 16px', borderTop: '1px solid #1a1a1a' }}>
                <span style={{ color: '#92400e', fontSize: 11, fontStyle: 'italic' }}>⚠ {comanda.note}</span>
              </div>
            )}
          </div>

          {/* Footer */}
          <div style={{ padding: '8px 16px', borderTop: '1px solid #1a1a1a', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
            <span style={{ color: '#1f2937', fontSize: 10, fontWeight: 600 }}>{done}/{total} piatti pronti · arrivo {fmtArrival(ts)}</span>
            <button
              onClick={() => onAllDone(comanda.id)}
              style={{
                padding: '8px 18px', background: '#16a34a', color: '#fff',
                border: 'none', borderRadius: 6,
                fontWeight: 900, fontSize: 12, letterSpacing: 2, cursor: 'pointer',
                transition: 'background 0.1s, transform 0.1s', flexShrink: 0,
              }}
              onMouseDown={e => { e.currentTarget.style.transform = 'scale(0.97)'; e.currentTarget.style.background = '#15803d' }}
              onMouseUp={e =>   { e.currentTarget.style.transform = 'scale(1)'; e.currentTarget.style.background = '#16a34a' }}
            >✓ TUTTO PRONTO</button>
          </div>
        </>
      )}
    </div>
  )
}

// ─── DETAIL MODAL (overlay) ───────────────────────────────────────────────────
function DetailModal({ comanda, dishDone, dishActivated, onDishDone, isDone, blink, onClose, onAllDone }: {
  comanda:       ComandaDB
  dishDone:      Set<string>
  dishActivated: Map<string, number>
  onDishDone:   (key: string) => void
  isDone:        boolean
  blink:         boolean
  onClose:       () => void
  onAllDone:     (id: string) => void
}) {
  useEffect(() => {
    const fn = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', fn)
    return () => window.removeEventListener('keydown', fn)
  }, [onClose])

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 200,
        background: 'rgba(0,0,0,0.88)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 24,
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width: '100%', maxWidth: 560,
          maxHeight: '90vh', overflowY: 'auto',
          borderRadius: 12, position: 'relative',
        }}
      >
        <button
          onClick={onClose}
          style={{
            position: 'absolute', top: -14, right: -14, zIndex: 10,
            width: 36, height: 36, borderRadius: '50%',
            background: '#1f1f1f', border: '1px solid #333',
            color: '#9ca3af', fontWeight: 900, fontSize: 16,
            cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >✕</button>

        <DetailCard
          comanda={comanda} dishDone={dishDone} dishActivated={dishActivated}
          onDishDone={onDishDone} isDone={isDone} blink={blink}
          onAllDone={id => { onAllDone(id); onClose() }}
        />
      </div>
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function CucinaPage() {
  const [comande,       setComande]       = useState<ComandaDB[]>([])
  const [loading,       setLoading]       = useState(true)
  const [dishDone,      setDishDone]      = useState<Set<string>>(new Set())
  const [dishActivated, setDishActivated] = useState<Map<string, number>>(new Map())
  const [cardsDone,     setCardsDone]     = useState<Set<string>>(new Set())
  const [cardsRemoved,  setCardsRemoved]  = useState<Set<string>>(new Set())
  const [countdown,     setCountdown]     = useState(10)
  const [blink,         setBlink]         = useState(true)
  const [viewMode,      setViewMode]      = useState<ViewMode>('compact')
  const [expandedId,    setExpandedId]    = useState<string | null>(null)

  const knownIds  = useRef<Set<string>>(new Set())
  const firstLoad = useRef(true)
  const timerRef  = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => { const id = setInterval(() => setBlink(b => !b), 550); return () => clearInterval(id) }, [])

  const fetchData = useCallback(async () => {
    try {
      const raw = await queryDB<ComandaDB>('comande', {
        select:  'id,tavolo_nome,numero_tavolo,cameriere,note,righe,inviata_at,created_at,stato',
        filters: [{ fn: 'neq', args: ['stato', 'completata'] }],
        order:   { col: 'created_at', asc: true },
        limit:   200,
      })
      const now  = Date.now()
      const data = raw
        .map(c => ({
          ...c,
          righe:       (typeof c.righe === 'string' ? JSON.parse(c.righe) : c.righe) as RigaDB[],
          tavolo_nome: c.tavolo_nome ?? c.numero_tavolo ?? 'T?',
        }))
        .filter(c => now - new Date(c.inviata_at ?? c.created_at).getTime() < TWO_HOURS)
      if (!firstLoad.current) {
        const newOnes = data.filter(c => !knownIds.current.has(c.id))
        if (newOnes.length > 0) playNewBeep()
      }
      firstLoad.current = false
      data.forEach(c => knownIds.current.add(c.id))
      setComande(data)
    } catch {}
    finally { setLoading(false) }
  }, [])

  useEffect(() => { fetchData(); const id = setInterval(fetchData, 10_000); return () => clearInterval(id) }, [fetchData])

  useEffect(() => {
    if (timerRef.current) clearInterval(timerRef.current)
    setCountdown(10)
    timerRef.current = setInterval(() => setCountdown(c => { if (c <= 1) { fetchData(); return 10 } return c - 1 }), 1_000)
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [fetchData])

  function markAllDone(comandaId: string) {
    const comanda = comande.find(c => c.id === comandaId)
    if (!comanda || cardsDone.has(comandaId)) return

    const allDishKeys = comanda.righe.map((_, i) => `${comandaId}:${i}`)
    setDishDone(prev => new Set([...prev, ...allDishKeys]))
    setCardsDone(prev => new Set([...prev, comandaId]))
    setDishActivated(prev => {
      const n = new Map(prev); allDishKeys.forEach(k => n.delete(k)); return n
    })
    playDoubleBeep()

    updateDB('comande',
      { stato: 'completata', completata_at: new Date().toISOString() },
      { id: comandaId }
    ).catch(() => {})

    setTimeout(() => {
      setCardsDone(prev    => { const n = new Set(prev); n.delete(comandaId); return n })
      setCardsRemoved(prev => new Set([...prev, comandaId]))
      setDishDone(prev => { const n = new Set(prev); allDishKeys.forEach(k => n.delete(k)); return n })
    }, 8_000)
  }

  function handleDishDone(dishKey: string) {
    const comandaId   = dishKey.split(':')[0]
    const newDishDone = new Set([...dishDone, dishKey])
    setDishDone(newDishDone)

    const comanda = comande.find(c => c.id === comandaId)
    if (!comanda) return

    // Find next dish to activate countdown
    const nextKey = findNextDishToActivate(comanda, newDishDone)
    if (nextKey && !dishActivated.has(nextKey)) {
      setDishActivated(prev => new Map([...prev, [nextKey, Date.now()]]))
    }

    const allDishKeys = comanda.righe.map((_, i) => `${comandaId}:${i}`)
    if (!allDishKeys.every(k => newDishDone.has(k))) return

    // All dishes done
    setCardsDone(prev => new Set([...prev, comandaId]))
    playDoubleBeep()
    updateDB('comande', { stato: 'completata', completata_at: new Date().toISOString() }, { id: comandaId }).catch(() => {})
    setTimeout(() => {
      setCardsDone(prev    => { const n = new Set(prev); n.delete(comandaId); return n })
      setCardsRemoved(prev => new Set([...prev, comandaId]))
      setDishDone(prev => { const n = new Set(prev); allDishKeys.forEach(k => n.delete(k)); return n })
      setDishActivated(prev => { const n = new Map(prev); allDishKeys.forEach(k => n.delete(k)); return n })
      setExpandedId(id => id === comandaId ? null : id)
    }, 8_000)
  }

  const visible      = comande.filter(c => !cardsRemoved.has(c.id))
  const totaleAttesa = visible.filter(c => !cardsDone.has(c.id)).length
  const expandedComanda = expandedId ? visible.find(c => c.id === expandedId) : null

  return (
    <div style={{
      background: '#000', height: '100vh',
      display: 'flex', flexDirection: 'column',
      fontFamily: "'Inter', system-ui, -apple-system, sans-serif",
      overflow: 'hidden', userSelect: 'none',
    }}>

      {/* ── Header ── */}
      <div style={{
        height: 56, background: '#080808', borderBottom: '1px solid #1a1a1a',
        display: 'flex', alignItems: 'center', padding: '0 20px',
        flexShrink: 0, justifyContent: 'space-between',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 160 }}>
          <div style={{ width: 3, height: 26, background: '#22c55e', borderRadius: 2 }} />
          <span style={{ color: '#fff', fontWeight: 900, fontSize: 17, letterSpacing: 7 }}>CUCINA</span>
        </div>

        <Clock />

        <div style={{ display: 'flex', alignItems: 'center', gap: 14, minWidth: 160, justifyContent: 'flex-end' }}>
          <div>
            <span style={{ color: totaleAttesa > 0 ? '#ef4444' : '#22c55e', fontWeight: 900, fontSize: 26, lineHeight: 1 }}>
              {totaleAttesa}
            </span>
            <span style={{ color: '#2d2d2d', fontSize: 10, fontWeight: 700, marginLeft: 5 }}>
              {totaleAttesa === 1 ? 'TAVOLO' : 'TAVOLI'}
            </span>
          </div>

          {/* Countdown ring */}
          <div style={{ position: 'relative', width: 32, height: 32 }}>
            <svg viewBox="0 0 32 32" style={{ width: 32, height: 32, transform: 'rotate(-90deg)' }}>
              <circle cx="16" cy="16" r="12" fill="none" stroke="#1a1a1a" strokeWidth="2.5" />
              <circle cx="16" cy="16" r="12" fill="none" stroke="#1f3a1f" strokeWidth="2.5"
                strokeDasharray={`${75.4 * countdown / 10} 75.4`}
                style={{ transition: 'stroke-dasharray 0.9s linear' }} />
            </svg>
            <span style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#2a2a2a', fontSize: 10, fontWeight: 900 }}>{countdown}</span>
          </div>

          {/* View toggle */}
          <button
            onClick={() => setViewMode(m => m === 'compact' ? 'detail' : 'compact')}
            style={{
              background: '#1a1a1a', border: '1px solid #2a2a2a', borderRadius: 6,
              color: viewMode === 'compact' ? '#3b82f6' : '#6b7280',
              fontWeight: 700, fontSize: 11, letterSpacing: 2,
              padding: '6px 12px', cursor: 'pointer',
              transition: 'color 0.2s, border-color 0.2s',
            }}
          >
            {viewMode === 'compact' ? '⊞ DETTAGLIO' : '⊟ COMPATTA'}
          </button>
        </div>
      </div>

      {/* ── Grid ── */}
      <div style={{ flex: 1, overflowY: 'auto', padding: 10 }}>
        {loading && visible.length === 0 && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 200 }}>
            <span style={{ color: '#1f1f1f', fontSize: 13, letterSpacing: 3 }}>CARICAMENTO...</span>
          </div>
        )}
        {!loading && visible.length === 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '60vh', gap: 16 }}>
            <div style={{ color: '#1a1a1a', fontSize: 72, lineHeight: 1 }}>✓</div>
            <span style={{ color: '#1f1f1f', fontSize: 14, fontWeight: 900, letterSpacing: 5 }}>CUCINA LIBERA</span>
          </div>
        )}
        {visible.length > 0 && (
          <div style={{
            display: 'grid',
            gridTemplateColumns: viewMode === 'compact'
              ? 'repeat(auto-fill, minmax(220px, 1fr))'
              : 'repeat(auto-fill, minmax(340px, 1fr))',
            gap: viewMode === 'compact' ? 8 : 10,
            alignContent: 'start',
          }}>
            {visible.map(c => viewMode === 'compact' ? (
              <CompactCard
                key={c.id} comanda={c} dishDone={dishDone}
                isDone={cardsDone.has(c.id)} blink={blink}
                onExpand={setExpandedId} onAllDone={markAllDone}
              />
            ) : (
              <DetailCard
                key={c.id} comanda={c} dishDone={dishDone} dishActivated={dishActivated}
                onDishDone={handleDishDone}
                isDone={cardsDone.has(c.id)} blink={blink} onAllDone={markAllDone}
              />
            ))}
          </div>
        )}
      </div>

      {/* ── Modal overlay ── */}
      {expandedComanda && (
        <DetailModal
          comanda={expandedComanda} dishDone={dishDone} dishActivated={dishActivated}
          onDishDone={handleDishDone}
          isDone={cardsDone.has(expandedComanda.id)} blink={blink}
          onClose={() => setExpandedId(null)} onAllDone={markAllDone}
        />
      )}

      <style>{`
        * { box-sizing: border-box; margin: 0; padding: 0; }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: #1f1f1f; border-radius: 2px; }
      `}</style>
    </div>
  )
}
