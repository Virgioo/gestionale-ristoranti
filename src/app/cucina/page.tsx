'use client'

import React, { useEffect, useState, useCallback, useRef } from 'react'
import { queryDB, updateDB, insertDB } from '@/lib/api'
import { Settings, RefreshCw, X, ChefHat, Eye, EyeOff, Check } from 'lucide-react'
import toast, { Toaster } from 'react-hot-toast'

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
  note:          string | null
  cameriere:     string | null
  righe:         RigaDB[]
  inviata_at:    string | null
  created_at:    string
  stato:         string
}
interface KDSCard {
  comandaId:  string
  tavoloNome: string
  cameriere:  string | null
  piatti:     { nome: string; quantita: number; note: string }[]
  notaGen:    string | null
  timestamp:  string
}

// ─── Config ───────────────────────────────────────────────────────────────────
const CATS = [
  { key: 'antipasti', label: 'Antipasti', bg: '#D97706', dark: '#92400E' },
  { key: 'primi',     label: 'Primi',     bg: '#2563EB', dark: '#1E3A8A' },
  { key: 'secondi',   label: 'Secondi',   bg: '#DC2626', dark: '#7F1D1D' },
  { key: 'dolci',     label: 'Dolci',     bg: '#7C3AED', dark: '#4C1D95' },
] as const
type CatKey = typeof CATS[number]['key']
const KDS_CATS = new Set<string>(CATS.map(c => c.key))

const DEFAULT_PIN = '1234'
const PIN_KEY     = 'kds_pin'
const AUTH_KEY    = 'kds_auth'
const TWO_HOURS   = 2 * 60 * 60 * 1000

// ─── Audio beep ───────────────────────────────────────────────────────────────
function playBeep() {
  try {
    const ctx  = new AudioContext()
    const osc  = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.type = 'sine'
    // Two-tone: short high then lower
    osc.frequency.setValueAtTime(1200, ctx.currentTime)
    osc.frequency.setValueAtTime(900, ctx.currentTime + 0.12)
    gain.gain.setValueAtTime(0, ctx.currentTime)
    gain.gain.linearRampToValueAtTime(0.5, ctx.currentTime + 0.01)
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.45)
    osc.start(ctx.currentTime)
    osc.stop(ctx.currentTime + 0.45)
    ctx.close()
  } catch {}
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function elapsedMs(iso: string): number {
  return Date.now() - new Date(iso).getTime()
}
function fmtElapsed(iso: string): string {
  const ms  = elapsedMs(iso)
  const min = Math.floor(ms / 60_000)
  const sec = Math.floor((ms % 60_000) / 1_000)
  return `${min}:${String(sec).padStart(2, '0')}`
}
function timerColor(iso: string): string {
  const min = elapsedMs(iso) / 60_000
  if (min >= 10) return '#EF4444'
  if (min >= 5)  return '#F59E0B'
  return '#22C55E'
}

// ─── PIN Screen ───────────────────────────────────────────────────────────────
function PinScreen({ onAuth }: { onAuth: () => void }) {
  const [digits, setDigits] = useState('')
  const [shake,  setShake]  = useState(false)
  const [show,   setShow]   = useState(false)
  const pinLen = (localStorage.getItem(PIN_KEY) ?? DEFAULT_PIN).length

  function press(d: string) {
    if (digits.length >= 6) return
    const next = digits + d
    setDigits(next)
    const pin = localStorage.getItem(PIN_KEY) ?? DEFAULT_PIN
    if (next.length === pin.length) {
      if (next === pin) { sessionStorage.setItem(AUTH_KEY, '1'); onAuth() }
      else { setShake(true); setTimeout(() => { setDigits(''); setShake(false) }, 600) }
    }
  }

  const PAD = ['1','2','3','4','5','6','7','8','9','','0','⌫']
  const S: React.CSSProperties = {
    background: '#000', minHeight: '100vh',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  }
  return (
    <div style={S}>
      <div style={{ textAlign: 'center', userSelect: 'none' }}>
        <ChefHat size={56} color="#10b981" style={{ margin: '0 auto 12px' }} />
        <p style={{ color: '#f9fafb', fontWeight: 900, fontSize: 28, letterSpacing: 4, marginBottom: 4 }}>CUCINA</p>
        <p style={{ color: '#6b7280', fontSize: 15, marginBottom: 40 }}>Kitchen Display System</p>

        <div style={{ display: 'flex', gap: 14, justifyContent: 'center', marginBottom: 40, alignItems: 'center' }}>
          {Array.from({ length: pinLen }).map((_, i) => (
            <div key={i} style={{
              width: 22, height: 22, borderRadius: '50%',
              background: digits.length > i ? '#10b981' : '#374151',
              transition: 'background 0.1s',
              transform: shake ? `translateX(${(i % 2 === 0 ? -6 : 6) * 1}px)` : 'none',
            }} />
          ))}
          <button onClick={() => setShow(s => !s)} style={{ background: 'none', border: 'none', cursor: 'pointer', marginLeft: 8 }}>
            {show ? <EyeOff size={18} color="#6b7280" /> : <Eye size={18} color="#6b7280" />}
          </button>
        </div>
        {show && digits && (
          <p style={{ color: '#6b7280', fontSize: 24, fontFamily: 'monospace', marginBottom: 20, letterSpacing: 10 }}>{digits}</p>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14, maxWidth: 300, margin: '0 auto' }}>
          {PAD.map((d, i) => (
            <button key={i}
              onClick={() => { if (d === '⌫') setDigits(p => p.slice(0,-1)); else if (d) press(d) }}
              style={{
                height: 86, fontSize: d === '⌫' ? 26 : 32, fontWeight: 900,
                background: d === '' ? 'transparent' : '#111',
                color: d === '⌫' ? '#9ca3af' : '#f9fafb',
                border: d === '' ? 'none' : '1px solid #333',
                borderRadius: 14, cursor: d === '' ? 'default' : 'pointer',
              }}
              onMouseDown={e => { if (d) (e.currentTarget.style.background = '#222') }}
              onMouseUp={e =>   { (e.currentTarget.style.background = d === '' ? 'transparent' : '#111') }}
            >{d}</button>
          ))}
        </div>
        <p style={{ color: '#374151', fontSize: 13, marginTop: 28 }}>PIN default: 1234</p>
      </div>
    </div>
  )
}

// ─── Settings Modal ───────────────────────────────────────────────────────────
function SettingsModal({ onClose }: { onClose: () => void }) {
  const [oldPin, setOldPin]   = useState('')
  const [newPin, setNewPin]   = useState('')
  const [confirm, setConfirm] = useState('')
  const [msg, setMsg]         = useState('')

  function savePin() {
    const cur = localStorage.getItem(PIN_KEY) ?? DEFAULT_PIN
    if (oldPin !== cur)        { setMsg('PIN attuale errato'); return }
    if (newPin.length < 4)     { setMsg('Minimo 4 cifre'); return }
    if (!/^\d+$/.test(newPin)) { setMsg('Solo numeri'); return }
    if (newPin !== confirm)    { setMsg('I PIN non coincidono'); return }
    localStorage.setItem(PIN_KEY, newPin)
    setMsg('✓ PIN salvato')
    setTimeout(onClose, 800)
  }

  const inp: React.CSSProperties = {
    background: '#111', border: '1px solid #333', borderRadius: 8, color: '#f9fafb',
    padding: '12px 14px', fontSize: 18, width: '100%', boxSizing: 'border-box',
    outline: 'none', letterSpacing: 8, fontFamily: 'monospace',
  }
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200 }}
      onClick={onClose}>
      <div style={{ background: '#111', border: '1px solid #333', borderRadius: 20, padding: 36, width: 360 }}
        onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 28 }}>
          <span style={{ color: '#fff', fontWeight: 900, fontSize: 18 }}>Impostazioni KDS</span>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><X size={22} color="#6b7280" /></button>
        </div>
        {['PIN attuale', 'Nuovo PIN', 'Conferma'].map((label, i) => (
          <div key={label} style={{ marginBottom: 16 }}>
            <label style={{ color: '#9ca3af', fontSize: 13, display: 'block', marginBottom: 6 }}>{label}</label>
            <input type="password" value={[oldPin, newPin, confirm][i]}
              onChange={e => [setOldPin, setNewPin, setConfirm][i](e.target.value.replace(/\D/g,''))}
              style={inp} maxLength={8} />
          </div>
        ))}
        {msg && <p style={{ color: msg.startsWith('✓') ? '#10b981' : '#ef4444', fontSize: 14, marginBottom: 12 }}>{msg}</p>}
        <button onClick={savePin} style={{ width: '100%', padding: '14px 0', background: '#10b981', color: '#fff', border: 'none', borderRadius: 10, fontWeight: 900, fontSize: 16, cursor: 'pointer', marginBottom: 10 }}>
          Salva PIN
        </button>
        <button onClick={() => { sessionStorage.removeItem(AUTH_KEY); window.location.reload() }}
          style={{ width: '100%', padding: '12px 0', background: '#1f2937', color: '#9ca3af', border: 'none', borderRadius: 10, fontSize: 14, cursor: 'pointer' }}>
          Blocca schermo
        </button>
      </div>
    </div>
  )
}

// ─── KDS Card ─────────────────────────────────────────────────────────────────
function KDSCardEl({ card, exiting, onPronto }: {
  card: KDSCard
  exiting: boolean
  onPronto: () => void
}) {
  const color = timerColor(card.timestamp)
  const elapsed = fmtElapsed(card.timestamp)
  const [blink, setBlink] = useState(true)

  useEffect(() => {
    const id = setInterval(() => setBlink(b => !b), 600)
    return () => clearInterval(id)
  }, [])

  const isLate = elapsedMs(card.timestamp) / 60_000 >= 10

  return (
    <div style={{
      background: '#fff', borderRadius: 14,
      overflow: 'hidden', boxShadow: '0 4px 20px rgba(0,0,0,0.35)',
      transition: 'transform 0.35s ease, opacity 0.35s ease',
      transform: exiting ? 'translateX(110%) scale(0.9)' : 'none',
      opacity: exiting ? 0 : 1,
      flexShrink: 0,
    }}>
      {/* Card header */}
      <div style={{ padding: '14px 18px', borderBottom: '2px solid #f3f4f6', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <div style={{ color: '#000', fontWeight: 900, fontSize: 28, lineHeight: 1 }}>{card.tavoloNome}</div>
          {card.cameriere && <div style={{ color: '#6b7280', fontSize: 14, marginTop: 3, fontWeight: 600 }}>{card.cameriere}</div>}
        </div>
        {/* Timer gigante */}
        <div style={{
          color: isLate && !blink ? '#ef4444' : color,
          fontWeight: 900, fontSize: 36, fontFamily: 'monospace', lineHeight: 1,
          textAlign: 'right', transition: 'color 0.3s',
        }}>
          {elapsed}
        </div>
      </div>

      {/* Piatti */}
      <div style={{ padding: '14px 18px' }}>
        {card.piatti.map((p, i) => (
          <div key={i} style={{ marginBottom: i < card.piatti.length - 1 ? 12 : 0 }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
              <span style={{ color: '#000', fontWeight: 900, fontSize: p.quantita > 1 ? 30 : 0, lineHeight: 1, minWidth: p.quantita > 1 ? 'auto' : 0 }}>
                {p.quantita > 1 && `${p.quantita}×`}
              </span>
              <span style={{ color: '#000', fontWeight: 700, fontSize: 22, lineHeight: 1.2 }}>{p.nome}</span>
            </div>
            {p.note && (
              <p style={{ color: '#6b7280', fontSize: 15, marginTop: 4, marginLeft: p.quantita > 1 ? 44 : 0, fontStyle: 'italic' }}>
                📝 {p.note}
              </p>
            )}
          </div>
        ))}
        {card.notaGen && (
          <div style={{ background: '#fefce8', border: '1px solid #f59e0b', borderRadius: 8, padding: '10px 14px', marginTop: 12 }}>
            <p style={{ color: '#78350f', fontWeight: 700, fontSize: 15, margin: 0 }}>⚠️ {card.notaGen}</p>
          </div>
        )}
      </div>

      {/* PRONTO */}
      <div style={{ padding: '0 18px 18px' }}>
        <button
          onClick={onPronto}
          style={{
            width: '100%', minHeight: 64,
            background: '#16a34a', color: '#fff',
            border: 'none', borderRadius: 10,
            fontWeight: 900, fontSize: 24, cursor: 'pointer',
            letterSpacing: 3, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
            boxShadow: '0 4px 12px rgba(22,163,74,0.4)',
            transition: 'background 0.1s, transform 0.1s',
          }}
          onMouseDown={e => { e.currentTarget.style.transform = 'scale(0.97)'; e.currentTarget.style.background = '#15803d' }}
          onMouseUp={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.background = '#16a34a' }}
        >
          <Check size={28} strokeWidth={3} />
          PRONTO
        </button>
      </div>
    </div>
  )
}

// ─── Real-time clock ──────────────────────────────────────────────────────────
function Clock() {
  const [now, setNow] = useState('')
  useEffect(() => {
    const tick = () => setNow(new Date().toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit', second: '2-digit' }))
    tick()
    const id = setInterval(tick, 1_000)
    return () => clearInterval(id)
  }, [])
  return (
    <span style={{ fontFamily: 'monospace', fontWeight: 900, fontSize: 32, color: '#fff', letterSpacing: 2 }}>
      {now}
    </span>
  )
}

// ─── KDS Display ──────────────────────────────────────────────────────────────
function KDSDisplay() {
  const [comande,      setComande]      = useState<ComandaDB[]>([])
  const [pronti,       setPronti]       = useState<Set<string>>(new Set())
  const [exiting,      setExiting]      = useState<Set<string>>(new Set())
  const [loading,      setLoading]      = useState(true)
  const [settOpen,     setSettOpen]     = useState(false)
  const [countdown,    setCountdown]    = useState(10)
  const [tavoloPronto, setTavoloPronto] = useState<string | null>(null)

  const knownIds  = useRef<Set<string>>(new Set())
  const firstLoad = useRef(true)
  const counterRef= useRef<ReturnType<typeof setInterval> | null>(null)

  const fetchData = useCallback(async () => {
    try {
      const raw = await queryDB<ComandaDB>('comande', {
        select: 'id,tavolo_nome,numero_tavolo,note,cameriere,righe,inviata_at,created_at,stato',
        filters: [
          { fn: 'neq', args: ['stato', 'completata'] },
        ],
        order: { col: 'created_at', asc: true },
        limit: 200,
      })

      const now  = Date.now()
      const data = raw
        .map(c => ({
          ...c,
          righe:       (typeof c.righe === 'string' ? JSON.parse(c.righe) : c.righe) as RigaDB[],
          tavolo_nome: c.tavolo_nome ?? c.numero_tavolo ?? 'T?',
        }))
        // Nascondi comande più vecchie di 2 ore
        .filter(c => now - new Date(c.inviata_at ?? c.created_at).getTime() < TWO_HOURS)

      // Beep per nuove comande (non al primo caricamento)
      if (!firstLoad.current) {
        const newOnes = data.filter(c => !knownIds.current.has(c.id))
        if (newOnes.length > 0) playBeep()
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

  // Countdown UI
  useEffect(() => {
    if (counterRef.current) clearInterval(counterRef.current)
    setCountdown(10)
    counterRef.current = setInterval(() => {
      setCountdown(c => {
        if (c <= 1) { fetchData(); return 10 }
        return c - 1
      })
    }, 1_000)
    return () => { if (counterRef.current) clearInterval(counterRef.current) }
  }, [fetchData])

  async function marcaPronto(comandaId: string, catKey: string, tavoloNome: string) {
    const cardKey = `${comandaId}:${catKey}`

    // Animazione uscita
    setExiting(e => new Set([...e, cardKey]))

    setTimeout(async () => {
      setExiting(e => { const n = new Set(e); n.delete(cardKey); return n })

      const newPronti = new Set([...pronti, cardKey])
      setPronti(newPronti)

      // Controlla se tutte le categorie di questa comanda sono pronte
      const comanda = comande.find(c => c.id === comandaId)
      if (comanda) {
        const catsInComanda = [...new Set(comanda.righe.map(r => r.categoria).filter(c => KDS_CATS.has(c)))]
        const allDone = catsInComanda.every(cat => newPronti.has(`${comandaId}:${cat}`))
        if (allDone) {
          // Banner lampeggiante
          setTavoloPronto(tavoloNome)
          setTimeout(() => setTavoloPronto(null), 6_000)

          try {
            await updateDB('comande', { stato: 'completata', completata_at: new Date().toISOString() }, { id: comandaId })
            insertDB('notifiche', {
              titolo:   `Tavolo ${tavoloNome} pronto`,
              messaggio:`Tutti i piatti del ${tavoloNome} sono pronti — avvisare la sala`,
              tipo:     'prenotazione',
              letta:    false,
            }).catch(() => {})
            setComande(prev => prev.filter(c => c.id !== comandaId))
          } catch {}
        }
      }
    }, 380)
  }

  function buildCards(catKey: string): KDSCard[] {
    return comande
      .filter(c => !CATS.every(cat => pronti.has(`${c.id}:${cat.key}`)))
      .flatMap(c => {
        const key     = `${c.id}:${catKey}`
        if (pronti.has(key)) return []
        const piatti  = c.righe.filter(r => r.categoria === catKey)
        if (!piatti.length) return []
        return [{
          comandaId:  c.id,
          tavoloNome: c.tavolo_nome ?? 'T?',
          cameriere:  c.cameriere,
          piatti:     piatti.map(p => ({ nome: p.piatto_nome, quantita: p.quantita, note: p.note ?? '' })),
          notaGen:    c.note,
          timestamp:  c.inviata_at ?? c.created_at,
        }]
      })
  }

  const totaleAttesa = comande.filter(c =>
    CATS.some(cat => !pronti.has(`${c.id}:${cat.key}`) && c.righe.some(r => r.categoria === cat.key))
  ).length

  return (
    <div style={{ background: '#000', height: '100vh', display: 'flex', flexDirection: 'column', fontFamily: "'Inter', system-ui, sans-serif", overflow: 'hidden' }}>

      {/* ── Header ── */}
      <div style={{ background: '#111', borderBottom: '2px solid #222', padding: '0 24px', height: 64, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
        {/* Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <ChefHat size={32} color="#10b981" />
          <span style={{ fontWeight: 900, fontSize: 24, letterSpacing: 4, color: '#fff' }}>CUCINA</span>
        </div>

        {/* Orologio */}
        <Clock />

        {/* Destra: contatore + controlli */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
          <div style={{ textAlign: 'right' }}>
            <div style={{
              color: totaleAttesa > 0 ? '#ef4444' : '#10b981',
              fontWeight: 900, fontSize: 32, lineHeight: 1,
            }}>
              {totaleAttesa}
            </div>
            <div style={{ color: '#6b7280', fontSize: 12, fontWeight: 700 }}>
              {totaleAttesa === 1 ? 'comanda in attesa' : 'comande in attesa'}
            </div>
          </div>

          {/* Countdown ring */}
          <div style={{ position: 'relative', width: 44, height: 44 }}>
            <svg viewBox="0 0 44 44" style={{ width: 44, height: 44, transform: 'rotate(-90deg)' }}>
              <circle cx="22" cy="22" r="18" fill="none" stroke="#222" strokeWidth="4" />
              <circle cx="22" cy="22" r="18" fill="none" stroke="#10b981" strokeWidth="4"
                strokeDasharray={`${113.1 * (countdown / 10)} 113.1`}
                style={{ transition: 'stroke-dasharray 0.9s linear' }} />
            </svg>
            <span style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 900, color: '#9ca3af' }}>
              {countdown}
            </span>
          </div>

          <button onClick={fetchData}
            style={{ background: '#1f2937', border: '1px solid #333', borderRadius: 10, padding: '8px 12px', cursor: 'pointer', color: '#9ca3af', display: 'flex', alignItems: 'center' }}>
            <RefreshCw size={20} />
          </button>
          <button onClick={() => setSettOpen(true)}
            style={{ background: '#1f2937', border: '1px solid #333', borderRadius: 10, padding: '8px 12px', cursor: 'pointer', color: '#9ca3af', display: 'flex', alignItems: 'center' }}>
            <Settings size={20} />
          </button>
        </div>
      </div>

      {/* ── 4 Colonne ── */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        {CATS.map((cat, idx) => {
          const cards = buildCards(cat.key)
          return (
            <div key={cat.key} style={{
              flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden',
              background: cat.bg,
              borderRight: idx < CATS.length - 1 ? '3px solid #000' : 'none',
            }}>
              {/* Intestazione colonna */}
              <div style={{ background: cat.dark, padding: '14px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
                <span style={{ color: '#fff', fontWeight: 900, fontSize: 20, letterSpacing: 3, textTransform: 'uppercase' }}>
                  {cat.label}
                </span>
                {cards.length > 0 && (
                  <span style={{
                    background: '#fff', color: cat.dark, borderRadius: '50%',
                    width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontWeight: 900, fontSize: 18,
                  }}>
                    {cards.length}
                  </span>
                )}
              </div>

              {/* Area cards */}
              <div style={{ flex: 1, overflowY: 'auto', padding: 14, display: 'flex', flexDirection: 'column', gap: 12 }}>
                {loading && cards.length === 0 && (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 1 }}>
                    <RefreshCw size={32} color="rgba(255,255,255,0.4)" style={{ animation: 'spin 1s linear infinite' }} />
                  </div>
                )}
                {!loading && cards.length === 0 && (
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'rgba(255,255,255,0.5)' }}>
                    <Check size={72} strokeWidth={3} />
                    <p style={{ fontSize: 28, fontWeight: 900, marginTop: 16, letterSpacing: 2, textTransform: 'uppercase' }}>Tutto evaso</p>
                  </div>
                )}
                {cards.map(card => {
                  const ek = `${card.comandaId}:${cat.key}`
                  return (
                    <KDSCardEl
                      key={ek}
                      card={card}
                      exiting={exiting.has(ek)}
                      onPronto={() => marcaPronto(card.comandaId, cat.key, card.tavoloNome)}
                    />
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>

      {/* ── Banner "TAVOLO PRONTO" ── */}
      {tavoloPronto && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, zIndex: 300,
          background: '#16a34a', padding: '22px 40px',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 20,
          animation: 'prontoAnim 0.6s ease-in-out infinite',
          boxShadow: '0 8px 40px rgba(22,163,74,0.6)',
        }}>
          <Check size={48} color="#fff" strokeWidth={3} />
          <span style={{ color: '#fff', fontWeight: 900, fontSize: 36, letterSpacing: 3, textTransform: 'uppercase' }}>
            TAVOLO {tavoloPronto} PRONTO — AVVISARE LA SALA
          </span>
          <Check size={48} color="#fff" strokeWidth={3} />
        </div>
      )}

      {settOpen && <SettingsModal onClose={() => setSettOpen(false)} />}

      <Toaster position="bottom-center" toastOptions={{ style: { fontWeight: 700, fontSize: 16 } }} />

      <style>{`
        @keyframes spin { to { transform: rotate(360deg) } }
        @keyframes prontoAnim {
          0%, 100% { background: #16a34a; }
          50%       { background: #166534; }
        }
        ::-webkit-scrollbar { width: 5px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.2); border-radius: 3px; }
        * { box-sizing: border-box; }
      `}</style>
    </div>
  )
}

// ─── Root (PIN gate) ──────────────────────────────────────────────────────────
export default function CucinaPage() {
  const [authed, setAuthed] = useState<boolean | null>(null)
  useEffect(() => { setAuthed(sessionStorage.getItem(AUTH_KEY) === '1') }, [])
  if (authed === null) return <div style={{ background: '#000', minHeight: '100vh' }} />
  if (!authed) return <PinScreen onAuth={() => setAuthed(true)} />
  return <KDSDisplay />
}
