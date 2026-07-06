'use client'

import React, { useEffect, useState, useCallback, useRef } from 'react'
import { queryDB, updateDB } from '@/lib/api'

// ─── Types ────────────────────────────────────────────────────────────────────
interface RigaDB {
  piatto_nome: string
  categoria:   string
  quantita:    number
  note:        string | null
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
const CAT_ORDER = ['antipasti', 'primi', 'secondi', 'dolci']
const TWO_HOURS = 2 * 60 * 60 * 1000

// ─── Audio ────────────────────────────────────────────────────────────────────
function playDoubleBeep() {
  try {
    const ctx = new AudioContext()
    ;[0, 0.22].forEach(offset => {
      const osc  = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.connect(gain); gain.connect(ctx.destination)
      osc.type = 'sine'; osc.frequency.value = 1050
      gain.gain.setValueAtTime(0, ctx.currentTime + offset)
      gain.gain.linearRampToValueAtTime(0.5, ctx.currentTime + offset + 0.01)
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + offset + 0.18)
      osc.start(ctx.currentTime + offset)
      osc.stop(ctx.currentTime + offset + 0.18)
    })
    setTimeout(() => ctx.close(), 1000)
  } catch {}
}

function playNewBeep() {
  try {
    const ctx = new AudioContext()
    const osc  = ctx.createOscillator()
    const gain = ctx.createGain()
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
function elapsedMin(iso: string) {
  return (Date.now() - new Date(iso).getTime()) / 60_000
}
function fmtElapsed(iso: string) {
  const ms  = Date.now() - new Date(iso).getTime()
  const min = Math.floor(ms / 60_000)
  const sec = Math.floor((ms % 60_000) / 1_000)
  return `${min}:${String(sec).padStart(2, '0')}`
}
function fmtArrival(iso: string) {
  return new Date(iso).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })
}
function urgency(iso: string): { color: string; blink: boolean; label: string } {
  const m = elapsedMin(iso)
  if (m >= 12) return { color: '#ef4444', blink: true,  label: 'URGENTE' }
  if (m >= 8)  return { color: '#f59e0b', blink: false, label: 'ATTENZIONE' }
  if (m >= 3)  return { color: '#4b5563', blink: false, label: '' }
  return               { color: '#22c55e', blink: false, label: 'NUOVO' }
}

// ─── Clock ────────────────────────────────────────────────────────────────────
function Clock() {
  const [t, setT] = useState('')
  useEffect(() => {
    const tick = () => setT(new Date().toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit', second: '2-digit' }))
    tick()
    const id = setInterval(tick, 1_000)
    return () => clearInterval(id)
  }, [])
  return (
    <span style={{ fontFamily: 'monospace', fontWeight: 900, fontSize: 34, color: '#fff', letterSpacing: 4, lineHeight: 1 }}>
      {t}
    </span>
  )
}

// ─── Live timer inside card ───────────────────────────────────────────────────
function LiveTimer({ iso }: { iso: string }) {
  const [, tick] = useState(0)
  useEffect(() => {
    const id = setInterval(() => tick(n => n + 1), 1_000)
    return () => clearInterval(id)
  }, [])
  const m = elapsedMin(iso)
  let color = '#22c55e'
  if (m >= 12) color = '#ef4444'
  else if (m >= 8) color = '#f59e0b'
  else if (m >= 3) color = '#6b7280'
  return (
    <span style={{ fontFamily: 'monospace', fontWeight: 900, fontSize: 22, color, letterSpacing: 1, lineHeight: 1 }}>
      {fmtElapsed(iso)}
    </span>
  )
}

// ─── Table Card ───────────────────────────────────────────────────────────────
function TableCard({ comanda, dishDone, onDishDone, isDone, blink }: {
  comanda:    ComandaDB
  dishDone:   Set<string>
  onDishDone: (key: string) => void
  isDone:     boolean
  blink:      boolean
}) {
  const ts   = comanda.inviata_at ?? comanda.created_at
  const urg  = urgency(ts)
  const borderColor = isDone
    ? '#22c55e'
    : urg.blink ? (blink ? '#ef4444' : '#5a0a0a') : urg.color

  // Group dishes by category (in CAT_ORDER, then unknown)
  const grouped: Record<string, { riga: RigaDB; idx: number }[]> = {}
  comanda.righe.forEach((r, idx) => {
    const cat = r.categoria ?? 'altro'
    if (!grouped[cat]) grouped[cat] = []
    grouped[cat].push({ riga: r, idx })
  })
  const orderedCats = [
    ...CAT_ORDER.filter(c => grouped[c]),
    ...Object.keys(grouped).filter(c => !CAT_ORDER.includes(c)),
  ]

  const allDishKeys  = comanda.righe.map((_, i) => `${comanda.id}:${i}`)
  const doneDishKeys = allDishKeys.filter(k => dishDone.has(k))
  const progress     = allDishKeys.length > 0 ? doneDishKeys.length / allDishKeys.length : 0

  return (
    <div style={{
      background:   isDone ? '#0a1f12' : '#141414',
      borderLeft:   `3px solid ${borderColor}`,
      borderRadius: 8,
      overflow:     'hidden',
      display:      'flex',
      flexDirection:'column',
      transition:   'background 0.5s ease',
    }}>
      {isDone ? (
        /* ── Done state ── */
        <div style={{ padding: '22px 20px', textAlign: 'center' }}>
          <div style={{
            color: '#4ade80', fontWeight: 900, fontSize: 19,
            letterSpacing: 3, opacity: blink ? 1 : 0.12,
            transition: 'opacity 0.15s',
          }}>
            ✓ PRONTO — AVVISARE SALA
          </div>
          <div style={{ color: '#166534', fontWeight: 700, fontSize: 15, marginTop: 8 }}>
            {comanda.tavolo_nome ?? comanda.numero_tavolo ?? 'Tavolo'}
          </div>
        </div>
      ) : (
        <>
          {/* ── Header ── */}
          <div style={{ padding: '13px 16px 10px', borderBottom: '1px solid #1f1f1f' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <div style={{ color: '#fff', fontWeight: 900, fontSize: 26, lineHeight: 1, letterSpacing: 1 }}>
                  {(comanda.tavolo_nome ?? comanda.numero_tavolo ?? 'TAVOLO').toUpperCase()}
                </div>
                {comanda.cameriere && (
                  <div style={{ color: '#4b5563', fontSize: 12, fontWeight: 600, marginTop: 4, letterSpacing: 0.5 }}>
                    {comanda.cameriere}
                  </div>
                )}
              </div>
              <div style={{ textAlign: 'right' }}>
                <LiveTimer iso={ts} />
                {urg.label && (
                  <div style={{ color: urg.color, fontSize: 10, fontWeight: 900, letterSpacing: 2, marginTop: 4, textAlign: 'right' }}>
                    {urg.label}
                  </div>
                )}
              </div>
            </div>

            {/* Progress bar */}
            {allDishKeys.length > 0 && (
              <div style={{ height: 3, background: '#1f1f1f', borderRadius: 2, marginTop: 10, overflow: 'hidden' }}>
                <div style={{
                  height: '100%', background: progress === 1 ? '#22c55e' : '#3b82f6',
                  width: `${progress * 100}%`, borderRadius: 2,
                  transition: 'width 0.3s ease',
                }} />
              </div>
            )}
          </div>

          {/* ── Dishes grouped by category ── */}
          <div style={{ flex: 1, padding: '4px 0' }}>
            {orderedCats.map((cat, ci) => {
              const cfg    = CAT_CONFIG[cat] ?? { label: cat.toUpperCase(), color: '#6b7280' }
              const dishes = grouped[cat]
              return (
                <div key={cat} style={{ borderTop: ci > 0 ? '1px solid #1a1a1a' : 'none' }}>
                  {/* Category badge */}
                  <div style={{ padding: '7px 16px 4px', display: 'flex', alignItems: 'center', gap: 6 }}>
                    <div style={{
                      width: 6, height: 6, borderRadius: '50%',
                      background: cfg.color, flexShrink: 0,
                    }} />
                    <span style={{ color: cfg.color, fontSize: 10, fontWeight: 900, letterSpacing: 3 }}>
                      {cfg.label}
                    </span>
                  </div>

                  {/* Dish rows */}
                  {dishes.map(({ riga, idx }) => {
                    const dishKey = `${comanda.id}:${idx}`
                    const done    = dishDone.has(dishKey)
                    return (
                      <div key={idx} style={{
                        display: 'flex', alignItems: 'center', gap: 10,
                        padding: '7px 16px',
                        opacity: done ? 0.28 : 1,
                        transition: 'opacity 0.25s',
                      }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, flexWrap: 'wrap' }}>
                            {riga.quantita > 1 && (
                              <span style={{
                                color: done ? '#374151' : cfg.color,
                                fontWeight: 900, fontSize: 18, lineHeight: 1,
                                textDecoration: done ? 'line-through' : 'none',
                              }}>
                                {riga.quantita}×
                              </span>
                            )}
                            <span style={{
                              color: done ? '#374151' : '#e5e7eb',
                              fontWeight: 700, fontSize: 15, lineHeight: 1.35,
                              textDecoration: done ? 'line-through' : 'none',
                            }}>
                              {riga.piatto_nome}
                            </span>
                          </div>
                          {riga.note && !done && (
                            <div style={{ color: '#4b5563', fontSize: 11, fontStyle: 'italic', marginTop: 2, paddingLeft: riga.quantita > 1 ? 26 : 0 }}>
                              {riga.note}
                            </div>
                          )}
                        </div>
                        <button
                          onClick={() => { if (!done) onDishDone(dishKey) }}
                          style={{
                            width: 44, height: 44, flexShrink: 0,
                            background: done ? '#1a1a1a' : cfg.color,
                            color: done ? '#2a2a2a' : '#000',
                            border: 'none', borderRadius: 6,
                            fontWeight: 900, fontSize: 19,
                            cursor: done ? 'default' : 'pointer',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            transition: 'background 0.2s, transform 0.1s',
                          }}
                          onMouseDown={e => { if (!done) e.currentTarget.style.transform = 'scale(0.92)' }}
                          onMouseUp={e =>   { e.currentTarget.style.transform = 'scale(1)' }}
                        >
                          ✓
                        </button>
                      </div>
                    )
                  })}
                </div>
              )
            })}

            {/* General note */}
            {comanda.note && (
              <div style={{ padding: '6px 16px 4px', borderTop: '1px solid #1a1a1a' }}>
                <span style={{ color: '#92400e', fontSize: 11, fontStyle: 'italic' }}>⚠ {comanda.note}</span>
              </div>
            )}
          </div>

          {/* ── Footer ── */}
          <div style={{ padding: '7px 16px', borderTop: '1px solid #1a1a1a', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ color: '#1f2937', fontSize: 10, fontWeight: 600, letterSpacing: 1 }}>
              {doneDishKeys.length}/{allDishKeys.length} piatti pronti
            </span>
            <span style={{ color: '#1f2937', fontSize: 10, fontWeight: 600 }}>
              Arrivo {fmtArrival(ts)}
            </span>
          </div>
        </>
      )}
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function CucinaPage() {
  const [comande,      setComande]      = useState<ComandaDB[]>([])
  const [loading,      setLoading]      = useState(true)
  const [dishDone,     setDishDone]     = useState<Set<string>>(new Set())
  const [cardsDone,    setCardsDone]    = useState<Set<string>>(new Set())
  const [cardsRemoved, setCardsRemoved] = useState<Set<string>>(new Set())
  const [countdown,    setCountdown]    = useState(10)
  const [blink,        setBlink]        = useState(true)

  const knownIds  = useRef<Set<string>>(new Set())
  const firstLoad = useRef(true)
  const timerRef  = useRef<ReturnType<typeof setInterval> | null>(null)

  // Global blink tick (used for urgent cards + done cards)
  useEffect(() => {
    const id = setInterval(() => setBlink(b => !b), 550)
    return () => clearInterval(id)
  }, [])

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

  useEffect(() => {
    fetchData()
    const id = setInterval(fetchData, 10_000)
    return () => clearInterval(id)
  }, [fetchData])

  // Countdown ring
  useEffect(() => {
    if (timerRef.current) clearInterval(timerRef.current)
    setCountdown(10)
    timerRef.current = setInterval(() => {
      setCountdown(c => { if (c <= 1) { fetchData(); return 10 } return c - 1 })
    }, 1_000)
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [fetchData])

  function handleDishDone(dishKey: string) {
    const comandaId  = dishKey.split(':')[0]
    const newDishDone = new Set([...dishDone, dishKey])
    setDishDone(newDishDone)

    const comanda = comande.find(c => c.id === comandaId)
    if (!comanda) return

    const allDishKeys = comanda.righe.map((_, i) => `${comandaId}:${i}`)
    const allDone     = allDishKeys.every(k => newDishDone.has(k))
    if (!allDone) return

    // ── All dishes done ──
    setCardsDone(prev => new Set([...prev, comandaId]))
    playDoubleBeep()

    updateDB('comande',
      { stato: 'completata', completata_at: new Date().toISOString() },
      { id: comandaId }
    ).catch(() => {})

    // Disappear after 8s
    setTimeout(() => {
      setCardsDone(prev    => { const n = new Set(prev); n.delete(comandaId); return n })
      setCardsRemoved(prev => new Set([...prev, comandaId]))
      setDishDone(prev => {
        const n = new Set(prev)
        allDishKeys.forEach(k => n.delete(k))
        return n
      })
    }, 8_000)
  }

  // Visible comande: not removed, sorted oldest first (already from DB order)
  const visible = comande.filter(c => !cardsRemoved.has(c.id))
  const totaleAttesa = visible.filter(c => !cardsDone.has(c.id)).length

  return (
    <div style={{
      background: '#000', height: '100vh',
      display: 'flex', flexDirection: 'column',
      fontFamily: "'Inter', system-ui, -apple-system, sans-serif",
      overflow: 'hidden', userSelect: 'none',
    }}>

      {/* ── Header ── */}
      <div style={{
        height: 56, background: '#080808',
        borderBottom: '1px solid #1a1a1a',
        display: 'flex', alignItems: 'center',
        padding: '0 20px', flexShrink: 0,
        justifyContent: 'space-between',
      }}>
        {/* Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 160 }}>
          <div style={{ width: 3, height: 26, background: '#22c55e', borderRadius: 2 }} />
          <span style={{ color: '#fff', fontWeight: 900, fontSize: 17, letterSpacing: 7 }}>CUCINA</span>
        </div>

        {/* Clock */}
        <Clock />

        {/* Counter + ring */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 160, justifyContent: 'flex-end' }}>
          <div>
            <span style={{ color: totaleAttesa > 0 ? '#ef4444' : '#22c55e', fontWeight: 900, fontSize: 28, lineHeight: 1 }}>
              {totaleAttesa}
            </span>
            <span style={{ color: '#2d2d2d', fontSize: 11, fontWeight: 700, marginLeft: 5 }}>
              {totaleAttesa === 1 ? 'TAVOLO' : 'TAVOLI'}
            </span>
          </div>
          <div style={{ position: 'relative', width: 32, height: 32 }}>
            <svg viewBox="0 0 32 32" style={{ width: 32, height: 32, transform: 'rotate(-90deg)' }}>
              <circle cx="16" cy="16" r="12" fill="none" stroke="#1a1a1a" strokeWidth="2.5" />
              <circle cx="16" cy="16" r="12" fill="none" stroke="#1f3a1f" strokeWidth="2.5"
                strokeDasharray={`${75.4 * countdown / 10} 75.4`}
                style={{ transition: 'stroke-dasharray 0.9s linear' }} />
            </svg>
            <span style={{
              position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: '#2a2a2a', fontSize: 10, fontWeight: 900,
            }}>{countdown}</span>
          </div>
        </div>
      </div>

      {/* ── Grid ── */}
      <div style={{ flex: 1, overflowY: 'auto', padding: 12 }}>
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
            gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))',
            gap: 10,
            alignContent: 'start',
          }}>
            {visible.map(c => (
              <TableCard
                key={c.id}
                comanda={c}
                dishDone={dishDone}
                onDishDone={handleDishDone}
                isDone={cardsDone.has(c.id)}
                blink={blink}
              />
            ))}
          </div>
        )}
      </div>

      <style>{`
        * { box-sizing: border-box; margin: 0; padding: 0; }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: #1f1f1f; border-radius: 2px; }
      `}</style>
    </div>
  )
}
