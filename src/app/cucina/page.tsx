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
  stato:         string
}

// ─── Config ───────────────────────────────────────────────────────────────────
const CATS = [
  { key: 'antipasti', label: 'ANTIPASTI', color: '#F59E0B' },
  { key: 'primi',     label: 'PRIMI',     color: '#3B82F6' },
  { key: 'secondi',   label: 'SECONDI',   color: '#EF4444' },
  { key: 'dolci',     label: 'DOLCI',     color: '#8B5CF6' },
] as const
type CatKey = typeof CATS[number]['key']
const CAT_KEYS = new Set<string>(CATS.map(c => c.key))

const TWO_HOURS = 2 * 60 * 60 * 1000

// ─── Audio ────────────────────────────────────────────────────────────────────
function playDoubleBeep() {
  try {
    const ctx = new AudioContext()
    ;[0, 0.22].forEach(t => {
      const osc  = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.type = 'sine'
      osc.frequency.value = 1100
      gain.gain.setValueAtTime(0, ctx.currentTime + t)
      gain.gain.linearRampToValueAtTime(0.55, ctx.currentTime + t + 0.01)
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + t + 0.18)
      osc.start(ctx.currentTime + t)
      osc.stop(ctx.currentTime + t + 0.18)
    })
    setTimeout(() => ctx.close(), 1200)
  } catch {}
}

function playNewOrderBeep() {
  try {
    const ctx = new AudioContext()
    const osc  = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.type = 'sine'
    osc.frequency.setValueAtTime(880, ctx.currentTime)
    osc.frequency.setValueAtTime(660, ctx.currentTime + 0.12)
    gain.gain.setValueAtTime(0, ctx.currentTime)
    gain.gain.linearRampToValueAtTime(0.4, ctx.currentTime + 0.01)
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4)
    osc.start(ctx.currentTime)
    osc.stop(ctx.currentTime + 0.4)
    setTimeout(() => ctx.close(), 800)
  } catch {}
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function elapsedMin(iso: string): number {
  return (Date.now() - new Date(iso).getTime()) / 60_000
}
function fmtElapsed(iso: string): string {
  const ms  = Date.now() - new Date(iso).getTime()
  const min = Math.floor(ms / 60_000)
  const sec = Math.floor((ms % 60_000) / 1_000)
  return `${min}:${String(sec).padStart(2, '0')}`
}
function fmtArrival(iso: string): string {
  return new Date(iso).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })
}

// ─── Real-time clock ──────────────────────────────────────────────────────────
function Clock() {
  const [t, setT] = useState('')
  useEffect(() => {
    const tick = () => setT(new Date().toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit', second: '2-digit' }))
    tick()
    const id = setInterval(tick, 1_000)
    return () => clearInterval(id)
  }, [])
  return (
    <span style={{ fontFamily: 'monospace', fontWeight: 900, fontSize: 36, color: '#ffffff', letterSpacing: 5, lineHeight: 1 }}>
      {t}
    </span>
  )
}

// ─── Timer badge ──────────────────────────────────────────────────────────────
function TimerBadge({ iso }: { iso: string }) {
  const [, tick]  = useState(0)
  const [blink, setBlink] = useState(true)
  useEffect(() => {
    const id1 = setInterval(() => tick(n => n + 1), 1_000)
    const id2 = setInterval(() => setBlink(b => !b), 500)
    return () => { clearInterval(id1); clearInterval(id2) }
  }, [])

  const min     = elapsedMin(iso)
  const elapsed = fmtElapsed(iso)

  let color  = '#22c55e'
  let bg     = 'rgba(34,197,94,0.08)'
  let border = 'rgba(34,197,94,0.3)'
  let shouldBlink = false

  if (min >= 15) { color = '#fff'; bg = '#7f1d1d'; border = '#ef4444'; shouldBlink = true }
  else if (min >= 10) { color = '#ef4444'; bg = 'rgba(239,68,68,0.1)'; border = 'rgba(239,68,68,0.4)' }
  else if (min >= 5)  { color = '#f59e0b'; bg = 'rgba(245,158,11,0.1)'; border = 'rgba(245,158,11,0.4)' }

  return (
    <div style={{
      background: bg, border: `1px solid ${border}`, borderRadius: 6,
      padding: '4px 10px',
      opacity: shouldBlink ? (blink ? 1 : 0.25) : 1,
    }}>
      <span style={{ color, fontFamily: 'monospace', fontWeight: 900, fontSize: 18, lineHeight: 1 }}>
        {elapsed}
      </span>
    </div>
  )
}

// ─── KDS Card ─────────────────────────────────────────────────────────────────
interface CardData {
  comandaId:  string
  tavoloNome: string
  cameriere:  string | null
  piatti:     RigaDB[]
  nota:       string | null
  timestamp:  string
  allDone:    boolean
}
function KDSCard({ card, catKey, catColor, dishDone, onDishDone }: {
  card:       CardData
  catKey:     CatKey
  catColor:   string
  dishDone:   Set<string>
  onDishDone: (key: string) => void
}) {
  const [blink, setBlink] = useState(true)
  useEffect(() => {
    const id = setInterval(() => setBlink(b => !b), 550)
    return () => clearInterval(id)
  }, [])

  const { comandaId, tavoloNome, cameriere, piatti, nota, timestamp, allDone } = card

  return (
    <div style={{
      background:   allDone ? '#0d2b1a' : '#141414',
      borderLeft:   `4px solid ${allDone ? '#22c55e' : catColor}`,
      borderRadius: 6,
      overflow:     'hidden',
      transition:   'background 0.6s ease, border-color 0.6s ease',
    }}>
      {allDone ? (
        <div style={{ padding: '18px 16px', textAlign: 'center' }}>
          <div style={{
            color: '#4ade80', fontWeight: 900, fontSize: 18, letterSpacing: 3,
            opacity: blink ? 1 : 0.15,
          }}>
            ✓ PRONTO — AVVISARE SALA
          </div>
          <div style={{ color: '#166534', fontSize: 13, fontWeight: 700, marginTop: 6 }}>
            {tavoloNome}
          </div>
        </div>
      ) : (
        <>
          {/* Header */}
          <div style={{ padding: '11px 14px 7px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
              <span style={{ color: '#ffffff', fontWeight: 900, fontSize: 28, lineHeight: 1 }}>
                {tavoloNome}
              </span>
              {cameriere && (
                <span style={{ color: '#4b5563', fontSize: 12, fontWeight: 600, letterSpacing: 0.5 }}>
                  {cameriere}
                </span>
              )}
            </div>
            <TimerBadge iso={timestamp} />
          </div>

          {/* Dishes */}
          <div style={{ padding: '2px 14px 0' }}>
            {piatti.map((p, i) => {
              const dishKey = `${comandaId}:${catKey}:${i}`
              const done    = dishDone.has(dishKey)
              return (
                <div key={i} style={{ borderTop: i > 0 ? '1px solid #1f1f1f' : 'none' }}>
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    padding: '9px 0',
                    opacity: done ? 0.3 : 1, transition: 'opacity 0.25s',
                  }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, flexWrap: 'wrap' }}>
                        {p.quantita > 1 && (
                          <span style={{
                            color: done ? '#374151' : catColor,
                            fontWeight: 900, fontSize: 20, lineHeight: 1,
                            textDecoration: done ? 'line-through' : 'none',
                          }}>
                            {p.quantita}×
                          </span>
                        )}
                        <span style={{
                          color: done ? '#374151' : '#f3f4f6',
                          fontWeight: 700, fontSize: 16, lineHeight: 1.3,
                          textDecoration: done ? 'line-through' : 'none',
                        }}>
                          {p.piatto_nome}
                        </span>
                      </div>
                      {p.note && !done && (
                        <div style={{ color: '#6b7280', fontSize: 12, fontStyle: 'italic', marginTop: 3, paddingLeft: p.quantita > 1 ? 28 : 0 }}>
                          {p.note}
                        </div>
                      )}
                    </div>
                    <button
                      onClick={() => { if (!done) onDishDone(dishKey) }}
                      style={{
                        width: 44, height: 44, flexShrink: 0,
                        background: done ? '#1f2937' : catColor,
                        color: done ? '#374151' : '#000',
                        border: 'none', borderRadius: 6,
                        fontWeight: 900, fontSize: 20, cursor: done ? 'default' : 'pointer',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        transition: 'background 0.2s, transform 0.1s',
                      }}
                      onMouseDown={e => { if (!done) e.currentTarget.style.transform = 'scale(0.93)' }}
                      onMouseUp={e => { e.currentTarget.style.transform = 'scale(1)' }}
                    >
                      ✓
                    </button>
                  </div>
                </div>
              )
            })}
          </div>

          {/* Footer */}
          <div style={{ padding: '6px 14px 10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 2 }}>
            {nota ? (
              <span style={{ color: '#b45309', fontSize: 11, fontStyle: 'italic', flex: 1, marginRight: 8 }}>⚠ {nota}</span>
            ) : <span />}
            <span style={{ color: '#1f2937', fontSize: 11, fontWeight: 600, flexShrink: 0 }}>
              {fmtArrival(timestamp)}
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
  const [cardsDone,    setCardsDone]    = useState<Set<string>>(new Set()) // comandaId:catKey
  const [cardsRemoved, setCardsRemoved] = useState<Set<string>>(new Set())
  const [countdown,    setCountdown]    = useState(10)

  const knownIds  = useRef<Set<string>>(new Set())
  const firstLoad = useRef(true)
  const timerRef  = useRef<ReturnType<typeof setInterval> | null>(null)

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
        if (newOnes.length > 0) playNewOrderBeep()
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
    // dishKey format: "comandaId:catKey:dishIdx"
    const parts     = dishKey.split(':')
    const comandaId = parts[0]
    const catKey    = parts[1]

    const newDishDone = new Set([...dishDone, dishKey])
    setDishDone(newDishDone)

    const comanda = comande.find(c => c.id === comandaId)
    if (!comanda) return

    // All dishes of this card (comanda+category) done?
    const dishKeysInCard = comanda.righe
      .filter(r => r.categoria === catKey)
      .map((_, i) => `${comandaId}:${catKey}:${i}`)

    const allInCardDone = dishKeysInCard.every(k => newDishDone.has(k))
    if (!allInCardDone) return

    // ── All dishes in this card are done ──
    const cardKey     = `${comandaId}:${catKey}`
    const newCardsDone = new Set([...cardsDone, cardKey])
    setCardsDone(newCardsDone)
    playDoubleBeep()

    // Check if ALL categories of this comanda are done → mark completata in DB
    const allCatsInComanda = [...new Set(
      comanda.righe.map(r => r.categoria).filter(c => CAT_KEYS.has(c))
    )]
    const allCatsDone = allCatsInComanda.every(cat => {
      const ck = `${comandaId}:${cat}`
      return newCardsDone.has(ck) || cardsRemoved.has(ck)
    })
    if (allCatsDone) {
      updateDB('comande',
        { stato: 'completata', completata_at: new Date().toISOString() },
        { id: comandaId }
      ).catch(() => {})
    }

    // After 10s green state: hide card
    setTimeout(() => {
      setCardsDone(prev  => { const n = new Set(prev);  n.delete(cardKey); return n })
      setCardsRemoved(prev => new Set([...prev, cardKey]))
      setDishDone(prev => {
        const n = new Set(prev)
        dishKeysInCard.forEach(k => n.delete(k))
        return n
      })
    }, 10_000)
  }

  function buildCards(catKey: CatKey): CardData[] {
    return comande.flatMap(c => {
      const piatti = c.righe.filter(r => r.categoria === catKey)
      if (!piatti.length) return []
      const cardKey = `${c.id}:${catKey}`
      if (cardsRemoved.has(cardKey)) return []
      return [{
        comandaId:  c.id,
        tavoloNome: c.tavolo_nome ?? 'T?',
        cameriere:  c.cameriere,
        piatti,
        nota:       c.note,
        timestamp:  c.inviata_at ?? c.created_at,
        allDone:    cardsDone.has(cardKey),
      }]
    })
  }

  const totaleAttesa = comande.filter(c =>
    CATS.some(cat => {
      const ck = `${c.id}:${cat.key}`
      return c.righe.some(r => r.categoria === cat.key)
        && !cardsDone.has(ck)
        && !cardsRemoved.has(ck)
    })
  ).length

  return (
    <div style={{
      background: '#000000', height: '100vh',
      display: 'flex', flexDirection: 'column',
      fontFamily: "'Inter', system-ui, -apple-system, sans-serif",
      overflow: 'hidden', userSelect: 'none',
    }}>

      {/* ── Header ── */}
      <div style={{
        height: 58, background: '#080808',
        borderBottom: '1px solid #1c1c1c',
        display: 'flex', alignItems: 'center',
        padding: '0 20px', flexShrink: 0,
        justifyContent: 'space-between',
      }}>
        {/* Left: logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 180 }}>
          <div style={{ width: 8, height: 28, background: '#22c55e', borderRadius: 2 }} />
          <span style={{ color: '#ffffff', fontWeight: 900, fontSize: 18, letterSpacing: 8, textTransform: 'uppercase' }}>
            CUCINA
          </span>
        </div>

        {/* Center: clock */}
        <Clock />

        {/* Right: counter + ring */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, minWidth: 180, justifyContent: 'flex-end' }}>
          <div>
            <span style={{
              color: totaleAttesa > 0 ? '#ef4444' : '#22c55e',
              fontWeight: 900, fontSize: 30, lineHeight: 1,
            }}>
              {totaleAttesa}
            </span>
            <span style={{ color: '#2d2d2d', fontSize: 11, fontWeight: 700, marginLeft: 5 }}>
              {totaleAttesa === 1 ? 'COMANDA' : 'COMANDE'}
            </span>
          </div>
          {/* Countdown ring */}
          <div style={{ position: 'relative', width: 34, height: 34 }}>
            <svg viewBox="0 0 34 34" style={{ width: 34, height: 34, transform: 'rotate(-90deg)' }}>
              <circle cx="17" cy="17" r="13" fill="none" stroke="#1a1a1a" strokeWidth="3" />
              <circle cx="17" cy="17" r="13" fill="none" stroke="#1f3a1f" strokeWidth="3"
                strokeDasharray={`${81.68 * countdown / 10} 81.68`}
                style={{ transition: 'stroke-dasharray 0.9s linear' }} />
            </svg>
            <span style={{
              position: 'absolute', inset: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: '#2d2d2d', fontSize: 10, fontWeight: 900,
            }}>
              {countdown}
            </span>
          </div>
        </div>
      </div>

      {/* ── 4 Columns ── */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        {CATS.map((cat, idx) => {
          const cards = buildCards(cat.key as CatKey)
          const pending = cards.filter(c => !c.allDone).length

          return (
            <React.Fragment key={cat.key}>
              {idx > 0 && (
                <div style={{ width: 1, background: '#1a1a1a', flexShrink: 0 }} />
              )}
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0 }}>

                {/* Column header */}
                <div style={{
                  background: '#0a0a0a',
                  borderBottom: `2px solid ${cat.color}`,
                  padding: '9px 14px',
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  flexShrink: 0,
                }}>
                  <span style={{
                    color: cat.color, fontWeight: 900,
                    fontSize: 13, letterSpacing: 4,
                  }}>
                    {cat.label}
                  </span>
                  {pending > 0 && (
                    <span style={{
                      background: cat.color, color: '#000',
                      fontWeight: 900, fontSize: 12,
                      borderRadius: 99, padding: '2px 9px',
                      lineHeight: '18px', display: 'inline-block',
                    }}>
                      {pending}
                    </span>
                  )}
                </div>

                {/* Cards area */}
                <div style={{ flex: 1, overflowY: 'auto', padding: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {loading && cards.length === 0 && (
                    <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <span style={{ color: '#1f1f1f', fontSize: 12, letterSpacing: 2 }}>CARICAMENTO</span>
                    </div>
                  )}
                  {!loading && cards.length === 0 && (
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10, paddingTop: 40 }}>
                      <div style={{ color: '#1a1a1a', fontSize: 40, lineHeight: 1 }}>✓</div>
                      <span style={{ color: '#1f1f1f', fontSize: 11, fontWeight: 900, letterSpacing: 4 }}>TUTTO EVASO</span>
                    </div>
                  )}
                  {cards.map(card => (
                    <KDSCard
                      key={`${card.comandaId}:${cat.key}`}
                      card={card}
                      catKey={cat.key as CatKey}
                      catColor={cat.color}
                      dishDone={dishDone}
                      onDishDone={handleDishDone}
                    />
                  ))}
                </div>
              </div>
            </React.Fragment>
          )
        })}
      </div>

      <style>{`
        * { box-sizing: border-box; margin: 0; padding: 0; }
        ::-webkit-scrollbar { width: 3px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: #1f1f1f; border-radius: 2px; }
        ::-webkit-scrollbar-thumb:hover { background: #2a2a2a; }
      `}</style>
    </div>
  )
}
