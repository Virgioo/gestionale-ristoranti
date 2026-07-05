'use client'

import { useEffect, useState, useCallback, useMemo, useRef } from 'react'
import { queryDB, insertDB, updateDB, upsertDB } from '@/lib/api'
import { formatEuro } from '@/lib/utils'
import { getDB, generateId } from '@/lib/db-comande'
import type { ComandaLocal, RigaLocal } from '@/lib/db-comande'
import toast from 'react-hot-toast'
import {
  WifiOff, ChevronLeft, ChevronRight, Plus, Minus, Send, ClipboardList,
  CheckCircle2, RotateCcw, X, Clock, Moon, Sun, Search,
  Printer, UtensilsCrossed, AlertTriangle, User, UserCheck,
} from 'lucide-react'

// ─── Types ────────────────────────────────────────────────────────────────────
type StatoTavolo = 'libero' | 'occupato' | 'prenotato' | 'conto' | 'bloccato' | 'riservato'
type Fase        = 'selezione' | 'comanda' | 'riepilogo'

interface Sala     { id: string; nome: string; colore: string | null; ordine: number }
interface Tavolo   {
  id: string; nome: string; capienza: number; sala_id: string | null
  pos_x: number | null; pos_y: number | null
  larghezza: number | null; altezza: number | null
  rotazione: number | null; forma: string | null
}
interface StatoRec { tavolo_id: string; stato: StatoTavolo; ora_apertura: string | null; cameriere_assegnato: string | null; coperti_effettivi: number | null }
interface TavoloExt  extends Tavolo { sala: Sala | null; statoInfo: StatoRec | null }
interface MenuItem {
  id: string; nome: string; descrizione: string | null
  prezzo: number; categoria: string; disponibile?: boolean; allergeni?: string[] | null
}
interface RigaOrdine { localId: string; piatto: MenuItem; quantita: number; note: string; inviata: boolean }
interface ClienteVip { id: string; nome: string; cognome: string; tier: string | null; allergie: string | null }
interface ComandaDB {
  id: string
  righe: Array<{ piatto_id?: string; piatto_nome: string; categoria: string; prezzo: number; quantita: number; note: string | null }>
  cameriere: string | null
  note: string | null
}

// ─── Constants ────────────────────────────────────────────────────────────────
const CAT_LABELS: Record<string, string> = {
  antipasti: 'Antipasti', primi: 'Primi', secondi: 'Secondi',
  dolci: 'Dolci', bevande: 'Bevande', vini: 'Vini', menu_cani: '🐕 Cani',
}
const CAT_ORDER = ['antipasti', 'primi', 'secondi', 'dolci', 'bevande', 'vini', 'menu_cani']

const STATO_CFG: Record<StatoTavolo, { label: string; bg: string; text: string; border: string; dot: string }> = {
  libero:    { label: 'Libero',    bg: 'bg-emerald-50',  text: 'text-emerald-700', border: 'border-emerald-300', dot: 'bg-emerald-500'  },
  occupato:  { label: 'Occupato',  bg: 'bg-red-50',      text: 'text-red-700',     border: 'border-red-400',     dot: 'bg-red-500'      },
  prenotato: { label: 'Prenotato', bg: 'bg-blue-50',     text: 'text-blue-700',    border: 'border-blue-300',    dot: 'bg-blue-500'     },
  conto:     { label: 'Conto',     bg: 'bg-amber-50',    text: 'text-amber-700',   border: 'border-amber-300',   dot: 'bg-amber-500'    },
  bloccato:  { label: 'Bloccato',  bg: 'bg-gray-100',    text: 'text-gray-500',    border: 'border-gray-300',    dot: 'bg-gray-400'     },
  riservato: { label: 'Riservato', bg: 'bg-purple-50',   text: 'text-purple-700',  border: 'border-purple-300',  dot: 'bg-purple-500'   },
}

// Hex colors for the SVG-style map canvas (can't use Tailwind in inline styles)
const SC_HEX: Record<StatoTavolo, { bg: string; fg: string; border: string; dot: string }> = {
  libero:    { bg: '#dcfce7', fg: '#166534', border: '#86efac', dot: '#4ade80' },
  occupato:  { bg: '#fee2e2', fg: '#991b1b', border: '#fca5a5', dot: '#f87171' },
  prenotato: { bg: '#fef3c7', fg: '#92400e', border: '#fcd34d', dot: '#fbbf24' },
  conto:     { bg: '#dbeafe', fg: '#1e40af', border: '#93c5fd', dot: '#60a5fa' },
  bloccato:  { bg: '#f1f5f9', fg: '#475569', border: '#e2e8f0', dot: '#94a3b8' },
  riservato: { bg: '#f3e8ff', fg: '#6b21a8', border: '#c084fc', dot: '#a855f7' },
}

const MOCK_MENU: MenuItem[] = [
  { id: 'm1',  nome: 'Crudo di mare misto',              descrizione: 'Gamberi, scampi, ostriche, capesante',     prezzo: 28, categoria: 'antipasti', allergeni: ['crostacei','molluschi']         },
  { id: 'm2',  nome: 'Carpaccio di tonno rosso',          descrizione: 'Bottarga, rucola, capperi',                prezzo: 22, categoria: 'antipasti', allergeni: ['pesce']                         },
  { id: 'm3',  nome: 'Polpo alla brace',                  descrizione: 'Insalata di patate, olive taggiasche',     prezzo: 18, categoria: 'antipasti', allergeni: ['molluschi']                      },
  { id: 'm4',  nome: 'Burrata con alici marinate',        descrizione: 'Burrata pugliese DOP, olio al basilico',   prezzo: 16, categoria: 'antipasti', allergeni: ['lattosio','pesce']               },
  { id: 'm5',  nome: 'Frittura di paranza',               descrizione: 'Calamari, gamberi, alici, zucchine',       prezzo: 20, categoria: 'antipasti', allergeni: ['glutine','pesce','crostacei']    },
  { id: 'm6',  nome: 'Strozzapreti al ragù di scorfano',  descrizione: 'Pasta fresca, pomodorini',                 prezzo: 18, categoria: 'primi',     allergeni: ['glutine','pesce']               },
  { id: 'm7',  nome: 'Tagliolini al granchio blu',        descrizione: 'Granchio blu adriatico, San Marzano',      prezzo: 24, categoria: 'primi',     allergeni: ['glutine','crostacei']           },
  { id: 'm8',  nome: 'Risotto allo scoglio',              descrizione: 'Vongole, cozze, gamberi, scampi',          prezzo: 22, categoria: 'primi',     allergeni: ['molluschi','crostacei']         },
  { id: 'm9',  nome: 'Spaghetti alle vongole veraci',     descrizione: 'Aglio, olio, peperoncino',                 prezzo: 19, categoria: 'primi',     allergeni: ['glutine','molluschi']           },
  { id: 'm10', nome: 'Branzino alla griglia',             descrizione: 'Branzino adriatico, erbe aromatiche',      prezzo: 32, categoria: 'secondi',   allergeni: ['pesce']                         },
  { id: 'm11', nome: 'Filetto di manzo Chianina',         descrizione: '300g, rosmarino, patate al forno',         prezzo: 38, categoria: 'secondi',   allergeni: null                              },
  { id: 'm12', nome: 'Astice alla catalana',              descrizione: 'Astice 600g, pomodori, cipolla di Tropea', prezzo: 45, categoria: 'secondi',   allergeni: ['crostacei']                     },
  { id: 'm13', nome: 'Tiramisù artigianale',              descrizione: 'Mascarpone, savoiardi, caffè, cacao',      prezzo: 9,  categoria: 'dolci',     allergeni: ['uova','lattosio','glutine']      },
  { id: 'm14', nome: 'Panna cotta ai frutti rossi',       descrizione: 'Vaniglia bourbon, coulis lamponi',         prezzo: 8,  categoria: 'dolci',     allergeni: ['lattosio']                      },
  { id: 'm15', nome: 'Sorbetto al limone',                descrizione: 'Limoni IGP di Amalfi',                     prezzo: 7,  categoria: 'dolci',     allergeni: null                              },
  { id: 'm16', nome: 'Acqua naturale 75cl',               descrizione: null,                                       prezzo: 3,  categoria: 'bevande',   allergeni: null                              },
  { id: 'm17', nome: 'Acqua frizzante 75cl',              descrizione: null,                                       prezzo: 3,  categoria: 'bevande',   allergeni: null                              },
  { id: 'm18', nome: 'Coca-Cola 33cl',                    descrizione: null,                                       prezzo: 4,  categoria: 'bevande',   allergeni: null                              },
  { id: 'm19', nome: 'Birra artigianale 33cl',            descrizione: 'Birrificio Adriatico',                     prezzo: 5,  categoria: 'bevande',   allergeni: ['glutine']                       },
  { id: 'm20', nome: 'Prosecco Valdobbiadene DOCG 75cl',  descrizione: 'Aperitivo o dessert',                      prezzo: 28, categoria: 'vini',      allergeni: ['solfiti']                       },
  { id: 'm21', nome: 'Sangiovese DOC 75cl',               descrizione: 'Rosso della casa',                         prezzo: 18, categoria: 'vini',      allergeni: ['solfiti']                       },
  { id: 'm22', nome: 'Pinot Grigio IGT 75cl',             descrizione: 'Bianco leggero',                           prezzo: 16, categoria: 'vini',      allergeni: ['solfiti']                       },
  { id: 'm23', nome: 'Bistecchine di pollo al vapore 🐕', descrizione: 'Senza sale né spezie',                     prezzo: 8,  categoria: 'menu_cani', allergeni: null                              },
  { id: 'm24', nome: 'Manzo bollito con carote 🐕',       descrizione: 'Senza condimenti',                         prezzo: 9,  categoria: 'menu_cani', allergeni: null                              },
]

// ─── Helpers ──────────────────────────────────────────────────────────────────
function elapsed(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime()
  const h  = Math.floor(ms / 3_600_000)
  const m  = Math.floor((ms % 3_600_000) / 60_000)
  return h > 0 ? `${h}h ${m}m` : `${m}m`
}

function useOnline() {
  const [online, setOnline] = useState(true)
  useEffect(() => {
    setOnline(navigator.onLine)
    const on = () => setOnline(true), off = () => setOnline(false)
    window.addEventListener('online', on)
    window.addEventListener('offline', off)
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off) }
  }, [])
  return online
}

async function doSyncPending(): Promise<number> {
  const db = getDB()
  const pending = await db.comande.where('sincronizzata').equals(0).toArray()
  let synced = 0
  for (const c of pending) {
    try {
      await insertDB('comande', {
        id: c.id, tavolo_id: c.tavolo_id, tavolo_nome: c.tavolo_nome,
        numero_tavolo: c.tavolo_nome, cameriere: c.cameriere, stato: 'inviata',
        note: c.note, totale: c.totale, righe: c.righe, coperti: 0,
        created_at: c.created_at, inviata_at: new Date().toISOString(),
      })
      if (c.tavolo_id) {
        await upsertDB('stato_tavoli', {
          tavolo_id: c.tavolo_id, stato: 'occupato',
          ora_apertura: c.created_at, cameriere_assegnato: c.cameriere,
        }, 'tavolo_id')
      }
      await db.comande.update(c.id, { sincronizzata: 1, stato: 'sincronizzata' })
      synced++
    } catch {}
  }
  return synced
}

// ─── Theme ────────────────────────────────────────────────────────────────────
function mkTheme(dark: boolean) {
  return dark ? {
    page:      'bg-gray-950 text-white',
    card:      'bg-gray-800 border-gray-700',
    header:    'bg-gray-900 border-gray-800',
    catPanel:  'bg-gray-900 border-gray-800',
    catActive: 'bg-emerald-700 text-white',
    catInact:  'bg-gray-800 text-gray-300 hover:bg-gray-700',
    dish:      'bg-gray-800 border-gray-700',
    dishSel:   'bg-gray-800 border-emerald-500',
    orderPanel:'bg-gray-900 border-gray-800',
    input:     'bg-gray-700 border-gray-600 text-white placeholder-gray-400 focus:ring-emerald-500',
    muted:     'text-gray-400',
    sub:       'text-gray-300',
    btn:       'bg-gray-700 hover:bg-gray-600 text-white',
    divider:   'divide-gray-700',
    sep:       'border-gray-700',
    mapBg:     '#0f172a',
    mapBorder: '#334155',
  } : {
    page:      'bg-slate-100 text-slate-900',
    card:      'bg-white border-slate-200',
    header:    'bg-white border-slate-200',
    catPanel:  'bg-white border-slate-200',
    catActive: 'bg-emerald-600 text-white',
    catInact:  'bg-slate-100 text-slate-600 hover:bg-slate-200',
    dish:      'bg-white border-slate-200',
    dishSel:   'bg-white border-emerald-400',
    orderPanel:'bg-white border-slate-200',
    input:     'bg-white border-slate-300 text-slate-900 placeholder-slate-400 focus:ring-emerald-400',
    muted:     'text-slate-500',
    sub:       'text-slate-700',
    btn:       'bg-slate-100 hover:bg-slate-200 text-slate-700',
    divider:   'divide-slate-100',
    sep:       'border-slate-200',
    mapBg:     '#f8fafc',
    mapBorder: '#e2e8f0',
  }
}

// ─── Map Canvas (posiziona tavoli alle coordinate reali) ──────────────────────
const CANVAS_W = 1000
const CANVAS_H = 680

function MapCanvas({ tavoli, onSelect, mapBg, mapBorder }: {
  tavoli: TavoloExt[]
  onSelect: (t: TavoloExt) => void
  mapBg: string
  mapBorder: string
}) {
  const [scale, setScale] = useState(1)
  const obsRef = useRef<ResizeObserver | null>(null)

  const setContainer = useCallback((el: HTMLDivElement | null) => {
    if (obsRef.current) { obsRef.current.disconnect(); obsRef.current = null }
    if (!el) return
    const update = () => setScale(Math.min(el.offsetWidth / CANVAS_W, 1))
    update()
    const obs = new ResizeObserver(update)
    obs.observe(el)
    obsRef.current = obs
  }, [])

  const canvasH = Math.max(Math.round(CANVAS_H * scale), 100)

  return (
    <div ref={setContainer} style={{ width: '100%', position: 'relative', overflow: 'hidden', height: canvasH }}>
      <div style={{
        width: CANVAS_W, height: CANVAS_H, position: 'absolute', top: 0, left: 0,
        transform: `scale(${scale})`, transformOrigin: 'top left',
        background: mapBg, borderRadius: 12, border: `1px solid ${mapBorder}`,
      }}>
        {tavoli.map(t => {
          const stato = t.statoInfo?.stato ?? 'libero'
          const col   = SC_HEX[stato]
          const w     = t.larghezza ?? 80
          const h     = t.altezza ?? ((t.forma === 'rotondo' || t.forma === 'quadrato') ? w : Math.round(w * 0.72))
          const isCirc = t.forma === 'rotondo' || t.forma === 'ovale'
          return (
            <button
              key={t.id}
              title={`${t.nome} — ${stato}`}
              onClick={() => onSelect(t)}
              style={{
                position: 'absolute', left: t.pos_x ?? 40, top: t.pos_y ?? 40,
                width: w, height: h,
                borderRadius: isCirc ? '50%' : 8,
                transform: `rotate(${t.rotazione ?? 0}deg)`,
                transformOrigin: 'center',
                background: col.bg, border: `2px solid ${col.border}`,
                display: 'flex', flexDirection: 'column', alignItems: 'center',
                justifyContent: 'center', gap: 2, cursor: 'pointer', zIndex: 2,
                boxShadow: '0 1px 4px rgba(0,0,0,0.08)', transition: 'box-shadow 0.12s',
              }}
            >
              <span style={{ fontSize: 10, fontWeight: 700, color: col.fg, lineHeight: 1.2, padding: '0 3px', textAlign: 'center', wordBreak: 'break-word' }}>
                {t.nome}
              </span>
              <span style={{ width: 5, height: 5, borderRadius: '50%', background: col.dot, flexShrink: 0 }} />
              {stato === 'occupato' && t.statoInfo?.ora_apertura && (
                <span style={{ fontSize: 8, fontWeight: 700, color: col.fg }}>{elapsed(t.statoInfo.ora_apertura)}</span>
              )}
              {stato === 'occupato' && t.statoInfo?.cameriere_assegnato && (
                <span style={{ fontSize: 8, color: col.fg, opacity: 0.7, overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: w - 8, whiteSpace: 'nowrap', padding: '0 2px' }}>
                  {t.statoInfo.cameriere_assegnato}
                </span>
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}

// ─── Component ────────────────────────────────────────────────────────────────
export default function ComandeProPage() {
  const isOnline = useOnline()

  // UI
  const [dark,          setDark]        = useState(false)
  const [fase,          setFase]        = useState<Fase>('selezione')
  const [loading,       setLoading]     = useState(true)

  // Data
  const [sale,          setSale]        = useState<Sala[]>([])
  const [tavoli,        setTavoli]      = useState<TavoloExt[]>([])
  const [menuItems,     setMenuItems]   = useState<MenuItem[]>(MOCK_MENU)
  const [salaFiltro,    setSalaFiltro]  = useState<string>('all')

  // Tavolo selezionato
  const [tavoloSel,     setTavoloSel]   = useState<TavoloExt | null>(null)

  // Cliente VIP
  const [clienteVip,    setClienteVip]  = useState<ClienteVip | null>(null)
  const [clienteQuery,  setClienteQuery]= useState('')
  const [clienteRes,    setClienteRes]  = useState<ClienteVip[]>([])
  const [clienteOpen,   setClienteOpen] = useState(false)

  // Ordine
  const [righe,         setRighe]       = useState<RigaOrdine[]>([])
  const [catSel,        setCatSel]      = useState('antipasti')
  const [notaOpen,      setNotaOpen]    = useState<string | null>(null)

  // Riepilogo
  const [cameriere,     setCameriere]   = useState('')
  const [noteGen,       setNoteGen]     = useState('')
  const [inviando,      setInviando]    = useState(false)
  const [pendingCount,  setPendingCount]= useState(0)

  const th          = useMemo(() => mkTheme(dark), [dark])
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // ── Load ─────────────────────────────────────────────────────────────────────
  useEffect(() => { loadData(); refreshPending() }, [])

  useEffect(() => {
    if (!isOnline) return
    doSyncPending().then(n => {
      if (n > 0) { toast.success(`${n} comand${n === 1 ? 'a' : 'e'} sincronizzat${n === 1 ? 'a' : 'e'}`); refreshPending() }
    })
  }, [isOnline])

  async function loadData() {
    setLoading(true)
    try {
      const [resS, resT, resSt, resM] = await Promise.allSettled([
        queryDB<Sala>('sale',        { select: 'id,nome,colore,ordine', order: { col: 'ordine' } }),
        queryDB<Tavolo>('tavoli',    { select: 'id,nome,capienza,sala_id,pos_x,pos_y,larghezza,altezza,rotazione,forma', order: { col: 'nome' } }),
        queryDB<StatoRec>('stato_tavoli', { select: 'tavolo_id,stato,ora_apertura,cameriere_assegnato,coperti_effettivi' }),
        queryDB<MenuItem>('menu',    { select: 'id,nome,descrizione,prezzo,categoria,disponibile,allergeni', order: { col: 'categoria' } }),
      ])

      const saleList   = resS.status  === 'fulfilled' ? resS.value  : []
      const tavoliList = resT.status  === 'fulfilled' ? resT.value  : []
      const statiList  = resSt.status === 'fulfilled' ? resSt.value : []
      const menuList   = resM.status  === 'fulfilled' && resM.value.length > 0 ? resM.value : MOCK_MENU

      setSale(saleList)
      setMenuItems(menuList)

      const statiMap = new Map(statiList.map(s => [s.tavolo_id, s]))
      const saleMap  = new Map(saleList.map(s => [s.id, s]))

      const joined: TavoloExt[] = tavoliList.map(t => ({
        ...t,
        sala:      t.sala_id ? (saleMap.get(t.sala_id) ?? null) : null,
        statoInfo: statiMap.get(t.id) ?? null,
      }))

      setTavoli(joined)
      const firstCat = menuList.find(m => CAT_ORDER.includes(m.categoria))?.categoria ?? 'antipasti'
      setCatSel(firstCat)
    } finally {
      setLoading(false)
    }
  }

  async function refreshPending() {
    try {
      const db = getDB()
      const c = await db.comande.where('sincronizzata').equals(0).count()
      setPendingCount(c)
    } catch {}
  }

  // ── Cliente VIP ───────────────────────────────────────────────────────────────
  function onClienteInput(q: string) {
    setClienteQuery(q)
    if (searchTimer.current) clearTimeout(searchTimer.current)
    if (q.trim().length < 2) { setClienteRes([]); return }
    searchTimer.current = setTimeout(async () => {
      try {
        const res = await queryDB<ClienteVip>('clienti', {
          select: 'id,nome,cognome,tier,allergie',
          filters: [{ fn: 'ilike', args: ['nome', `%${q}%`] }],
          limit: 6,
        })
        setClienteRes(res)
      } catch {}
    }, 280)
  }

  function selezionaCliente(c: ClienteVip) {
    setClienteVip(c)
    setClienteQuery(`${c.nome} ${c.cognome}`)
    setClienteRes([])
    setClienteOpen(false)
  }

  // ── Allergie ──────────────────────────────────────────────────────────────────
  const allergieParsed = useMemo(() => {
    if (!clienteVip?.allergie) return []
    return clienteVip.allergie.split(',').map(a => a.trim().toLowerCase()).filter(Boolean)
  }, [clienteVip])

  function piattoARischio(p: MenuItem): boolean {
    if (!allergieParsed.length || !p.allergeni?.length) return false
    return p.allergeni.some(a => allergieParsed.includes(a.toLowerCase()))
  }

  // ── Ordine ────────────────────────────────────────────────────────────────────
  function getQty(id: string) {
    return righe.filter(r => r.piatto.id === id && !r.inviata).reduce((s, r) => s + r.quantita, 0)
  }

  function aggiungi(piatto: MenuItem) {
    setRighe(prev => {
      const ex = prev.find(r => r.piatto.id === piatto.id && !r.inviata)
      if (ex) return prev.map(r => r.localId === ex.localId ? { ...r, quantita: r.quantita + 1 } : r)
      return [...prev, { localId: generateId(), piatto, quantita: 1, note: '', inviata: false }]
    })
  }

  function rimuovi(localId: string) {
    setRighe(prev => {
      const ex = prev.find(r => r.localId === localId)
      if (!ex || ex.inviata) return prev
      if (ex.quantita <= 1) return prev.filter(r => r.localId !== localId)
      return prev.map(r => r.localId === localId ? { ...r, quantita: r.quantita - 1 } : r)
    })
  }

  function setNota(localId: string, nota: string) {
    setRighe(prev => prev.map(r => r.localId === localId ? { ...r, note: nota } : r))
  }

  const righeNuove   = righe.filter(r => !r.inviata)
  const righeInviate = righe.filter(r =>  r.inviata)
  const totaleNuove  = righeNuove.reduce((s, r) => s + r.piatto.prezzo * r.quantita, 0)
  const totaleTutto  = righe.reduce((s, r) => s + r.piatto.prezzo * r.quantita, 0)
  const pezziNuovi   = righeNuove.reduce((s, r) => s + r.quantita, 0)
  const pezziTotali  = righe.reduce((s, r) => s + r.quantita, 0)

  const catDisp      = CAT_ORDER.filter(c => menuItems.some(m => m.categoria === c))
  const piattiInCat  = menuItems.filter(m => m.categoria === catSel && m.disponibile !== false)

  // ── Tavolo ────────────────────────────────────────────────────────────────────
  async function selezionaTavolo(t: TavoloExt) {
    setTavoloSel(t)
    setCameriere(t.statoInfo?.cameriere_assegnato ?? '')
    setNoteGen('')

    // Se occupato, ripristina le righe già inviate da Supabase
    if (t.statoInfo?.stato === 'occupato') {
      try {
        const comande = await queryDB<ComandaDB>('comande', {
          select: 'id,righe,cameriere,note',
          filters: [
            { fn: 'eq',  args: ['tavolo_id', t.id] },
            { fn: 'is',  args: ['completata_at', null] },
          ],
          order: { col: 'created_at', asc: false },
          limit: 10,
        })
        if (comande.length > 0) {
          const ripristinate: RigaOrdine[] = comande.flatMap(c =>
            (c.righe ?? []).map(r => ({
              localId: generateId(),
              piatto: {
                id:          r.piatto_id ?? generateId(),
                nome:        r.piatto_nome,
                prezzo:      r.prezzo ?? 0,
                categoria:   r.categoria ?? 'altro',
                descrizione: null,
                allergeni:   null,
              },
              quantita: r.quantita,
              note:     r.note ?? '',
              inviata:  true,
            }))
          )
          setRighe(ripristinate)
          if (!t.statoInfo?.cameriere_assegnato && comande[0].cameriere) {
            setCameriere(comande[0].cameriere)
          }
          setNoteGen(comande[0].note ?? '')
        } else {
          setRighe([])
        }
      } catch {
        setRighe([])
      }
    } else {
      setRighe([])
    }

    setFase('comanda')
  }

  // ── Manda in cucina ───────────────────────────────────────────────────────────
  const mandaInCucina = useCallback(async () => {
    if (!tavoloSel || righeNuove.length === 0) return
    setInviando(true)

    const comanda: ComandaLocal = {
      id:           generateId(),
      tavolo_id:    tavoloSel.id,
      tavolo_nome:  tavoloSel.nome,
      cameriere:    cameriere || null,
      stato:        'inviata',
      note:         noteGen || null,
      totale:       totaleNuove,
      righe: righeNuove.map(r => ({
        piatto_id:   r.piatto.id,
        piatto_nome: r.piatto.nome,
        categoria:   r.piatto.categoria,
        prezzo:      r.piatto.prezzo,
        quantita:    r.quantita,
        note:        r.note,
      })) satisfies RigaLocal[],
      created_at:    new Date().toISOString(),
      sincronizzata: 0,
    }

    try {
      const db = getDB()
      await db.comande.add(comanda)
    } catch {
      toast.error('Errore salvataggio locale')
      setInviando(false)
      return
    }

    if (isOnline) {
      // ① Salva comanda su Supabase (errore non blocca ②)
      try {
        console.log('[comande] INSERT comanda →', comanda.id, 'tavolo:', comanda.tavolo_nome)
        await insertDB('comande', {
          id: comanda.id, tavolo_id: comanda.tavolo_id, tavolo_nome: comanda.tavolo_nome,
          numero_tavolo: comanda.tavolo_nome, cameriere: comanda.cameriere,
          stato: 'inviata', note: comanda.note, totale: comanda.totale,
          righe: comanda.righe, coperti: tavoloSel.capienza ?? 0,
          created_at: comanda.created_at, inviata_at: new Date().toISOString(),
        })
        const db = getDB()
        await db.comande.update(comanda.id, { sincronizzata: 1, stato: 'sincronizzata' })
        console.log('[comande] ✅ comanda sincronizzata:', comanda.id)
      } catch (e) {
        console.error('[comande] ❌ insert comanda fallito (stato_tavoli verrà aggiornato lo stesso):', e)
      }

      // ② Segna tavolo come occupato — indipendente da ① (sempre eseguito se online)
      if (comanda.tavolo_id) {
        try {
          const payload = {
            tavolo_id:           comanda.tavolo_id,
            stato:               'occupato',
            ora_apertura:        comanda.created_at,
            cameriere_assegnato: comanda.cameriere ?? null,
          }
          console.log('[comande] UPSERT stato_tavoli →', payload)
          const res = await upsertDB('stato_tavoli', payload, 'tavolo_id')
          console.log('[comande] ✅ stato_tavoli occupato:', res)
        } catch (e) {
          console.error('[comande] ❌ upsert stato_tavoli fallito:', e)
        }
      }
    }

    setRighe(prev => prev.map(r => r.inviata ? r : { ...r, inviata: true }))
    await refreshPending()
    toast.success(`${pezziNuovi} pezzi mandati in cucina${!isOnline ? ' (offline)' : ''}`)
    setInviando(false)
  }, [tavoloSel, righeNuove, cameriere, noteGen, totaleNuove, pezziNuovi, isOnline])

  // ── Chiudi tavolo ─────────────────────────────────────────────────────────────
  async function chiudiTavolo() {
    if (tavoloSel) {
      try {
        await updateDB('stato_tavoli',
          { stato: 'libero', ora_apertura: null, cameriere_assegnato: null, coperti_effettivi: null },
          { tavolo_id: tavoloSel.id }
        )
        // Marca le comande del tavolo come completate
        await updateDB('comande',
          { completata_at: new Date().toISOString() },
          { tavolo_id: tavoloSel.id }
        )
        toast.success(`${tavoloSel.nome} liberato`)
      } catch { toast.error('Errore aggiornamento tavolo') }
    }
    reset()
    loadData()
  }

  function reset() {
    setRighe([]); setTavoloSel(null); setClienteVip(null)
    setClienteQuery(''); setCameriere(''); setNoteGen('')
    setFase('selezione')
  }

  // ── Derived ───────────────────────────────────────────────────────────────────
  const tavoliFiltrati = salaFiltro === 'all' ? tavoli : tavoli.filter(t => t.sala_id === salaFiltro)
  const nLiberi   = tavoliFiltrati.filter(t => !t.statoInfo || t.statoInfo.stato === 'libero').length
  const nOccupati = tavoliFiltrati.filter(t => t.statoInfo?.stato === 'occupato').length

  /* ═══════════════════════════════════════════════════════════════════════════
     RENDER
  ═══════════════════════════════════════════════════════════════════════════ */
  return (
    <div className={`min-h-screen flex flex-col ${th.page}`}>

      {/* ── Print styles: solo .print-receipt è visibile in stampa ── */}
      <style>{`
        @media print {
          body > * { display: none !important; }
          .print-receipt { display: block !important; position: fixed; inset: 0; z-index: 99999; background: #fff; padding: 16px 24px; }
          @page { margin: 0.8cm; size: 80mm auto; }
        }
        .print-receipt { display: none; }
      `}</style>

      {/* ── Pre-conto professionale (solo in stampa) ── */}
      <div className="print-receipt" style={{ fontFamily: '"Courier New", monospace', fontSize: 12, color: '#000', maxWidth: 320, margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: 12 }}>
          <div style={{ fontSize: 24, fontWeight: 900, letterSpacing: 3 }}>SCOGLIERA</div>
          <div style={{ fontSize: 10, color: '#555', marginBottom: 6 }}>Ristorante di Mare</div>
          <div style={{ borderTop: '1px dashed #000', margin: '8px 0' }} />
          <div style={{ fontSize: 10 }}>
            {new Date().toLocaleString('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
          </div>
          <div style={{ fontSize: 14, fontWeight: 700, marginTop: 4 }}>
            {tavoloSel?.nome ?? '—'}
            {clienteVip ? ` — ${clienteVip.nome} ${clienteVip.cognome}` : ''}
          </div>
          {cameriere && <div style={{ fontSize: 10, color: '#444', marginTop: 2 }}>Cameriere: {cameriere}</div>}
        </div>

        <div style={{ borderTop: '1px solid #000', paddingTop: 8, marginBottom: 8 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9, fontWeight: 700, borderBottom: '1px dashed #bbb', paddingBottom: 4, marginBottom: 6 }}>
            <span>DESCRIZIONE</span><span>IMPORTO</span>
          </div>
          {righe.map(r => (
            <div key={r.localId} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4, fontSize: 11 }}>
              <span style={{ flex: 1, paddingRight: 8 }}>
                {r.quantita}× {r.piatto.nome}
                {r.note ? <span style={{ fontSize: 9, color: '#666' }}><br />  ↳ {r.note}</span> : null}
              </span>
              <span style={{ flexShrink: 0, fontWeight: 600 }}>{formatEuro(r.piatto.prezzo * r.quantita)}</span>
            </div>
          ))}
        </div>

        <div style={{ borderTop: '2px solid #000', paddingTop: 10, marginBottom: 14 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 17, fontWeight: 900 }}>
            <span>TOTALE</span>
            <span>{formatEuro(totaleTutto)}</span>
          </div>
          {noteGen && <div style={{ fontSize: 10, color: '#444', marginTop: 6 }}>Note: {noteGen}</div>}
        </div>

        <div style={{ textAlign: 'center', borderTop: '1px dashed #000', paddingTop: 10, fontSize: 10, color: '#666' }}>
          <div style={{ fontWeight: 600 }}>Grazie per averci scelto!</div>
          <div style={{ marginTop: 2 }}>Vi aspettiamo presto</div>
        </div>
      </div>

      {/* ── Banner offline ── */}
      {!isOnline && (
        <div className="bg-amber-500 text-white px-4 py-2.5 flex items-center gap-2 text-sm font-semibold z-50">
          <WifiOff className="w-4 h-4 shrink-0" />
          Modalità offline — comande salvate localmente, sincronizzazione automatica al ritorno
        </div>
      )}

      {/* ════════════════════ HEADER ════════════════════ */}
      <header className={`sticky top-0 z-40 border-b ${th.header}`}>
        <div className="flex items-center gap-2 px-3 py-2 min-h-[52px]">
          {fase !== 'selezione' && (
            <button onClick={() => fase === 'riepilogo' ? setFase('comanda') : reset()}
              className={`w-11 h-11 rounded-xl flex items-center justify-center transition active:scale-90 ${th.btn}`}>
              <ChevronLeft className="w-5 h-5" />
            </button>
          )}

          <div className="flex items-center gap-2 flex-1 min-w-0">
            <ClipboardList className="w-5 h-5 text-emerald-500 shrink-0" />
            <div className="min-w-0">
              <p className="font-bold text-base leading-tight truncate">
                {fase === 'selezione' && 'Comande'}
                {fase === 'comanda'   && tavoloSel?.nome}
                {fase === 'riepilogo' && `Riepilogo — ${tavoloSel?.nome}`}
              </p>
              {fase !== 'selezione' && (
                <p className={`text-xs leading-tight ${th.muted}`}>
                  {tavoloSel?.sala?.nome}
                  {clienteVip && ` · ${clienteVip.nome} ${clienteVip.cognome}`}
                  {allergieParsed.length > 0 && (
                    <span className="ml-1.5 text-red-500 font-bold">⚠️ {allergieParsed.join(', ')}</span>
                  )}
                </p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {pendingCount > 0 && (
              <div className="flex items-center gap-1 bg-amber-500 text-white text-xs font-bold px-2.5 py-1.5 rounded-full">
                <Clock className="w-3.5 h-3.5" />{pendingCount}
              </div>
            )}
            {fase === 'comanda' && righeNuove.length > 0 && (
              <button onClick={() => setFase('riepilogo')}
                className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white px-3.5 py-2 rounded-xl text-sm font-bold transition active:scale-95">
                {pezziNuovi} · {formatEuro(totaleNuove)}
                <ChevronRight className="w-4 h-4" />
              </button>
            )}
            <button onClick={() => setDark(d => !d)}
              title={dark ? 'Modalità chiara' : 'Modalità scura (cucina)'}
              className={`w-11 h-11 rounded-xl flex items-center justify-center transition active:scale-90 ${th.btn}`}>
              {dark ? <Sun className="w-5 h-5 text-yellow-400" /> : <Moon className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </header>

      {/* ════════════════════ STEP 1: SELEZIONE TAVOLO ════════════════════ */}
      {fase === 'selezione' && (
        <main className="flex-1 overflow-auto p-3">
          {loading ? (
            <div className="flex items-center justify-center py-24">
              <RotateCcw className="w-7 h-7 animate-spin text-emerald-500" />
            </div>
          ) : tavoli.length === 0 ? (
            /* ── Empty state ── */
            <div className="flex flex-col items-center justify-center py-24 text-center px-6">
              <UtensilsCrossed className={`w-16 h-16 mb-4 opacity-20 ${th.muted}`} />
              <p className="font-bold text-lg mb-1">Nessun tavolo configurato</p>
              <p className={`text-sm ${th.muted}`}>Vai su <strong>Disposizione tavoli</strong> per crearli</p>
            </div>
          ) : (
            <div className="max-w-6xl mx-auto space-y-4">

              {/* Top bar: stats + VIP search */}
              <div className="flex flex-col sm:flex-row gap-3">
                <div className={`flex items-center gap-4 px-4 py-3 rounded-xl border text-sm shrink-0 ${th.card}`}>
                  <div className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                    <span className={th.muted}>{nLiberi} liberi</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-red-500" />
                    <span className={th.muted}>{nOccupati} occupati</span>
                  </div>
                  <button onClick={loadData} className={`${th.muted} hover:text-emerald-500 transition`}>
                    <RotateCcw className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* Cliente VIP search */}
                <div className="flex-1 relative">
                  <div className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border ${th.card}`}>
                    <Search className={`w-4 h-4 shrink-0 ${th.muted}`} />
                    <input
                      value={clienteQuery}
                      onChange={e => { onClienteInput(e.target.value); setClienteOpen(true) }}
                      onFocus={() => setClienteOpen(true)}
                      onBlur={() => setTimeout(() => setClienteOpen(false), 180)}
                      placeholder="Cerca cliente VIP (opzionale)..."
                      className="flex-1 bg-transparent outline-none text-sm min-w-0"
                    />
                    {clienteVip && (
                      <button onClick={() => { setClienteVip(null); setClienteQuery('') }}>
                        <X className={`w-4 h-4 ${th.muted} hover:text-red-500 transition`} />
                      </button>
                    )}
                  </div>
                  {clienteOpen && clienteRes.length > 0 && (
                    <div className={`absolute top-full left-0 right-0 mt-1 rounded-xl border shadow-xl overflow-hidden z-50 ${th.card}`}>
                      {clienteRes.map(c => (
                        <button key={c.id} onMouseDown={() => selezionaCliente(c)}
                          className={`w-full text-left px-4 py-3 flex items-center gap-3 hover:bg-emerald-50 transition border-b last:border-b-0 ${th.sep}`}>
                          <UserCheck className="w-4 h-4 text-emerald-500 shrink-0" />
                          <div className="min-w-0">
                            <p className="font-semibold text-sm">{c.nome} {c.cognome}</p>
                            {c.tier     && <p className={`text-xs ${th.muted}`}>{c.tier}</p>}
                            {c.allergie && <p className="text-xs text-red-500 font-medium">⚠️ {c.allergie}</p>}
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Cliente VIP badge */}
              {clienteVip && (
                <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30">
                  <UserCheck className="w-5 h-5 text-emerald-500 shrink-0" />
                  <div>
                    <p className="font-semibold text-sm text-emerald-700">{clienteVip.nome} {clienteVip.cognome}
                      {clienteVip.tier && <span className={`ml-2 text-xs font-normal ${th.muted}`}>{clienteVip.tier}</span>}
                    </p>
                    {clienteVip.allergie && (
                      <p className="text-xs text-red-600 font-semibold mt-0.5">⚠️ Allergie: {clienteVip.allergie}</p>
                    )}
                  </div>
                  <button onClick={() => { setClienteVip(null); setClienteQuery('') }} className="ml-auto">
                    <X className={`w-4 h-4 ${th.muted}`} />
                  </button>
                </div>
              )}

              {/* Tabs sale */}
              {sale.length > 0 && (
                <div className="flex gap-2 overflow-x-auto pb-0.5">
                  <button onClick={() => setSalaFiltro('all')}
                    className={`px-4 py-2.5 rounded-xl text-sm font-semibold whitespace-nowrap transition min-h-[44px] ${salaFiltro === 'all' ? th.catActive : th.catInact}`}>
                    Tutte le sale
                  </button>
                  {sale.map(s => (
                    <button key={s.id} onClick={() => setSalaFiltro(s.id)}
                      className={`px-4 py-2.5 rounded-xl text-sm font-semibold whitespace-nowrap transition min-h-[44px] ${salaFiltro === s.id ? th.catActive : th.catInact}`}>
                      {s.nome}
                    </button>
                  ))}
                </div>
              )}

              {/* ── Mappa tavoli ── */}
              {salaFiltro === 'all' ? (
                sale.length > 0 ? (
                  sale.map(s => {
                    const tavoliSala = tavoli.filter(t => t.sala_id === s.id)
                    if (tavoliSala.length === 0) return null
                    return (
                      <div key={s.id}>
                        <p className={`text-xs font-bold uppercase tracking-wider mb-2 ${th.muted}`}
                          style={{ borderLeft: `3px solid ${s.colore ?? '#94a3b8'}`, paddingLeft: 8 }}>
                          {s.nome}
                        </p>
                        <MapCanvas tavoli={tavoliSala} onSelect={selezionaTavolo} mapBg={th.mapBg} mapBorder={th.mapBorder} />
                      </div>
                    )
                  })
                ) : (
                  <MapCanvas tavoli={tavoli} onSelect={selezionaTavolo} mapBg={th.mapBg} mapBorder={th.mapBorder} />
                )
              ) : (
                <MapCanvas tavoli={tavoliFiltrati} onSelect={selezionaTavolo} mapBg={th.mapBg} mapBorder={th.mapBorder} />
              )}
            </div>
          )}
        </main>
      )}

      {/* ════════════════════ STEP 2: COMANDA ════════════════════ */}
      {fase === 'comanda' && (
        <div className="flex-1 flex overflow-hidden" style={{ height: 'calc(100vh - 52px)' }}>

          {/* LEFT: categorie + piatti */}
          <div className="flex-1 flex overflow-hidden">

            {/* Sidebar categorie */}
            <nav className={`w-36 flex-shrink-0 flex flex-col overflow-y-auto border-r ${th.catPanel}`}>
              {allergieParsed.length > 0 && (
                <div className="mx-2 mt-2 px-2 py-1.5 rounded-lg bg-red-600 text-white text-[10px] font-bold leading-tight">
                  <AlertTriangle className="w-3 h-3 inline mr-0.5" />
                  {allergieParsed.join(', ')}
                </div>
              )}
              <div className="py-2 px-2 space-y-1 flex-1">
                {catDisp.map(c => (
                  <button key={c} onClick={() => setCatSel(c)}
                    className={`w-full text-left px-3 py-3 rounded-xl text-xs font-semibold transition leading-tight min-h-[44px] flex items-center ${catSel === c ? th.catActive : th.catInact}`}>
                    {CAT_LABELS[c] ?? c}
                  </button>
                ))}
              </div>
            </nav>

            {/* Griglia piatti */}
            <div className="flex-1 overflow-y-auto p-3">
              {allergieParsed.length > 0 && (
                <div className="mb-3 flex items-center gap-2 px-4 py-3 rounded-xl bg-red-600 text-white text-sm font-semibold">
                  <AlertTriangle className="w-5 h-5 shrink-0" />
                  <span>Allergie: <strong>{allergieParsed.join(', ')}</strong> — piatti a rischio evidenziati</span>
                </div>
              )}
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
                {piattiInCat.map(piatto => {
                  const qty     = getQty(piatto.id)
                  const rischio = piattoARischio(piatto)
                  const rigaLoc = righe.find(r => r.piatto.id === piatto.id && !r.inviata)
                  const inviatoG = righe.some(r => r.piatto.id === piatto.id && r.inviata)
                  return (
                    <div key={piatto.id}
                      className={[
                        'rounded-2xl border-2 shadow-sm overflow-hidden transition-all',
                        rischio
                          ? 'border-red-500'
                          : qty > 0
                            ? (dark ? 'border-emerald-500' : 'border-emerald-400')
                            : (dark ? 'border-gray-700' : 'border-slate-200'),
                        dark ? 'bg-gray-800' : 'bg-white',
                      ].join(' ')}>
                      <div className="p-3 flex items-start gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start gap-1">
                            {rischio && <AlertTriangle className="w-3.5 h-3.5 text-red-500 shrink-0 mt-0.5" />}
                            <p className={`font-bold text-sm leading-tight ${rischio ? 'text-red-500' : (dark ? 'text-white' : 'text-slate-900')}`}>
                              {piatto.nome}
                            </p>
                          </div>
                          {piatto.descrizione && (
                            <p className={`text-[11px] mt-0.5 line-clamp-2 ${th.muted}`}>{piatto.descrizione}</p>
                          )}
                          {rischio && piatto.allergeni && (
                            <p className="text-[10px] text-red-500 mt-0.5 font-semibold">⚠️ {piatto.allergeni.join(', ')}</p>
                          )}
                          {inviatoG && (
                            <p className="text-[10px] text-emerald-500 mt-0.5 flex items-center gap-0.5 font-medium">
                              <CheckCircle2 className="w-3 h-3" /> in cucina
                            </p>
                          )}
                          <p className="text-emerald-500 font-bold text-base mt-1">{formatEuro(piatto.prezzo)}</p>
                        </div>

                        <div className="flex flex-col items-end gap-1.5 shrink-0">
                          {qty === 0 ? (
                            <button onClick={() => aggiungi(piatto)}
                              className="w-12 h-12 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl flex items-center justify-center active:scale-90 transition shadow">
                              <Plus className="w-6 h-6" />
                            </button>
                          ) : (
                            <div className="flex items-center gap-1">
                              <button onClick={() => rigaLoc && rimuovi(rigaLoc.localId)}
                                className={`w-11 h-11 rounded-xl flex items-center justify-center active:scale-90 transition ${th.btn}`}>
                                <Minus className="w-5 h-5" />
                              </button>
                              <span className="text-xl font-bold text-emerald-500 w-7 text-center">{qty}</span>
                              <button onClick={() => aggiungi(piatto)}
                                className="w-11 h-11 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl flex items-center justify-center active:scale-90 transition">
                                <Plus className="w-5 h-5" />
                              </button>
                            </div>
                          )}
                          {qty > 0 && rigaLoc && (
                            <button
                              onClick={() => setNotaOpen(notaOpen === rigaLoc.localId ? null : rigaLoc.localId)}
                              className={`text-[10px] transition ${notaOpen === rigaLoc.localId ? 'text-emerald-500' : th.muted}`}>
                              {notaOpen === rigaLoc.localId ? '− nota' : '+ nota'}
                            </button>
                          )}
                        </div>
                      </div>

                      {rigaLoc && notaOpen === rigaLoc.localId && (
                        <div className="px-3 pb-3">
                          <input autoFocus
                            placeholder="Es. senza aglio, cottura media..."
                            value={rigaLoc.note}
                            onChange={e => setNota(rigaLoc.localId, e.target.value)}
                            className={`w-full px-3 py-2 text-sm border rounded-xl outline-none focus:ring-2 transition ${th.input}`}
                          />
                        </div>
                      )}
                    </div>
                  )
                })}
                {piattiInCat.length === 0 && (
                  <p className={`col-span-full text-center py-12 text-sm ${th.muted}`}>Nessun piatto disponibile</p>
                )}
              </div>
            </div>
          </div>

          {/* RIGHT: ordine */}
          <div className={`w-72 flex-shrink-0 flex flex-col border-l ${th.orderPanel}`}>
            <div className={`px-3 py-2.5 border-b ${th.sep} flex items-center justify-between`}>
              <p className="font-bold text-sm">Ordine</p>
              <p className={`text-xs ${th.muted}`}>{pezziTotali} pz · {formatEuro(totaleTutto)}</p>
            </div>

            <div className={`flex-1 overflow-y-auto divide-y ${th.divider}`}>
              {righeNuove.map(r => (
                <div key={r.localId} className="px-3 py-2.5 flex items-start gap-2">
                  <div className="flex-1 min-w-0">
                    <p className={`text-xs font-semibold leading-tight ${dark ? 'text-white' : 'text-slate-800'}`}>{r.piatto.nome}</p>
                    {r.note && <p className={`text-[10px] ${th.muted} mt-0.5`}>📝 {r.note}</p>}
                    <p className="text-xs text-emerald-500 font-bold mt-0.5">{formatEuro(r.piatto.prezzo * r.quantita)}</p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button onClick={() => rimuovi(r.localId)}
                      className={`w-8 h-8 rounded-lg flex items-center justify-center transition hover:bg-red-100 hover:text-red-500 ${th.btn}`}>
                      <Minus className="w-3.5 h-3.5" />
                    </button>
                    <span className="text-sm font-bold text-emerald-500 w-5 text-center">{r.quantita}</span>
                    <button onClick={() => aggiungi(r.piatto)}
                      className="w-8 h-8 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg flex items-center justify-center transition">
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}

              {righeInviate.length > 0 && (
                <>
                  <div className={`px-3 py-1.5 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide ${th.muted}`}>
                    <CheckCircle2 className="w-3 h-3 text-emerald-500" />In cucina
                  </div>
                  {righeInviate.map(r => (
                    <div key={r.localId} className="px-3 py-2 flex justify-between items-center opacity-50">
                      <p className={`text-xs ${dark ? 'text-white' : 'text-slate-700'}`}>{r.quantita}× {r.piatto.nome}</p>
                      <p className={`text-xs font-bold ${th.muted}`}>{formatEuro(r.piatto.prezzo * r.quantita)}</p>
                    </div>
                  ))}
                </>
              )}

              {righe.length === 0 && (
                <div className={`flex flex-col items-center justify-center py-12 text-xs text-center ${th.muted}`}>
                  <UtensilsCrossed className="w-8 h-8 mb-2 opacity-30" />
                  Nessun piatto selezionato
                </div>
              )}
            </div>

            <div className={`border-t ${th.sep} p-3 space-y-2`}>
              <div className="flex justify-between items-center">
                <span className={`text-xs font-semibold ${th.muted}`}>Nuovi</span>
                <span className="text-lg font-bold text-emerald-500">{formatEuro(totaleNuove)}</span>
              </div>
              <button onClick={mandaInCucina} disabled={inviando || righeNuove.length === 0}
                className="w-full py-3.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-xl text-sm font-bold flex items-center justify-center gap-2 active:scale-95 transition shadow">
                {inviando
                  ? <><RotateCcw className="w-4 h-4 animate-spin" /> Invio...</>
                  : <><Send className="w-4 h-4" /> Manda in cucina{!isOnline ? ' (offline)' : ''}</>
                }
              </button>
              <button onClick={() => setFase('riepilogo')} disabled={righe.length === 0}
                className={`w-full py-3 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 transition disabled:opacity-40 ${th.btn}`}>
                <ClipboardList className="w-4 h-4" />Vai al riepilogo
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ════════════════════ STEP 3: RIEPILOGO ════════════════════ */}
      {fase === 'riepilogo' && (
        <main className="flex-1 overflow-auto p-4">
          <div className="max-w-2xl mx-auto space-y-4">

            {/* Lista ordine */}
            <div className={`rounded-2xl border overflow-hidden shadow-sm ${th.card}`}>
              <div className={`px-5 py-3 border-b ${th.sep}`}>
                <p className="font-bold">Riepilogo comanda</p>
                <p className={`text-xs ${th.muted}`}>
                  {tavoloSel?.nome}
                  {clienteVip ? ` · ${clienteVip.nome} ${clienteVip.cognome}` : ''}
                  {' · '}{pezziTotali} pezzi · {formatEuro(totaleTutto)}
                </p>
              </div>

              {righeInviate.length > 0 && (
                <div className={`px-5 py-2 flex items-center gap-1.5 text-xs font-semibold text-emerald-600 border-b ${th.sep}`}>
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  {righeInviate.reduce((s, r) => s + r.quantita, 0)} pezzi già in cucina
                </div>
              )}

              <div className={`divide-y ${th.divider}`}>
                {righe.map(r => (
                  <div key={r.localId} className={`flex items-start gap-4 px-5 py-4 ${r.inviata ? 'opacity-60' : ''}`}>
                    <div className="flex items-center gap-2 shrink-0">
                      {!r.inviata ? (
                        <>
                          <button onClick={() => rimuovi(r.localId)}
                            className={`w-9 h-9 rounded-xl flex items-center justify-center transition ${th.btn}`}>
                            <Minus className="w-4 h-4" />
                          </button>
                          <span className="text-lg font-bold text-emerald-500 w-6 text-center">{r.quantita}</span>
                          <button onClick={() => aggiungi(r.piatto)}
                            className={`w-9 h-9 rounded-xl flex items-center justify-center transition ${th.btn}`}>
                            <Plus className="w-4 h-4" />
                          </button>
                        </>
                      ) : (
                        <div className="flex items-center gap-2 pl-1">
                          <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                          <span className={`text-lg font-bold w-6 text-center ${th.sub}`}>{r.quantita}</span>
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm">{r.piatto.nome}</p>
                      {r.note && <p className="text-xs text-blue-500 mt-0.5">📝 {r.note}</p>}
                      {r.inviata && <p className="text-xs text-emerald-500 mt-0.5">✓ inviato in cucina</p>}
                    </div>
                    <div className="text-right shrink-0">
                      <p className="font-bold">{formatEuro(r.piatto.prezzo * r.quantita)}</p>
                      <p className={`text-[10px] ${th.muted}`}>{formatEuro(r.piatto.prezzo)} × {r.quantita}</p>
                    </div>
                  </div>
                ))}
              </div>

              <div className={`px-5 py-4 border-t ${th.sep} flex justify-between items-center`}>
                <span className="font-bold text-sm">Totale</span>
                <span className="text-2xl font-bold text-emerald-500">{formatEuro(totaleTutto)}</span>
              </div>
            </div>

            {/* Cameriere + Note */}
            <div className={`rounded-2xl border p-4 shadow-sm space-y-3 ${th.card}`}>
              <div>
                <label className={`text-sm font-medium block mb-1.5 ${th.sub}`}>Cameriere</label>
                <div className="relative">
                  <User className={`absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 ${th.muted}`} />
                  <input value={cameriere} onChange={e => setCameriere(e.target.value)}
                    placeholder="Nome cameriere..."
                    className={`w-full pl-9 pr-4 py-3 text-sm border rounded-xl outline-none focus:ring-2 transition ${th.input}`}
                  />
                </div>
              </div>
              <div>
                <label className={`text-sm font-medium block mb-1.5 ${th.sub}`}>Note cucina</label>
                <textarea rows={2} value={noteGen} onChange={e => setNoteGen(e.target.value)}
                  placeholder="Allergie, preferenze, urgenza..."
                  className={`w-full px-3 py-2.5 text-sm border rounded-xl outline-none focus:ring-2 resize-none transition ${th.input}`}
                />
              </div>
            </div>

            {!isOnline && (
              <div className="flex items-center gap-2 px-4 py-3 bg-amber-500/10 border border-amber-500/30 rounded-xl text-amber-600 text-sm">
                <WifiOff className="w-4 h-4 shrink-0" />
                Offline — le comande sono salvate localmente
              </div>
            )}

            {/* Azioni */}
            <div className="space-y-3">
              {righeNuove.length > 0 && (
                <button onClick={mandaInCucina} disabled={inviando}
                  className="w-full py-4 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-2xl text-base font-bold flex items-center justify-center gap-2 active:scale-95 transition shadow-lg">
                  {inviando
                    ? <><RotateCcw className="w-5 h-5 animate-spin" /> Invio...</>
                    : <><Send className="w-5 h-5" /> Invia in cucina ({pezziNuovi} pezzi — {formatEuro(totaleNuove)})</>
                  }
                </button>
              )}

              <div className="grid grid-cols-3 gap-3">
                <button onClick={() => window.print()}
                  className={`py-4 rounded-2xl text-sm font-bold flex items-center justify-center gap-2 active:scale-95 transition border ${th.card} ${th.muted} hover:border-slate-400`}>
                  <Printer className="w-5 h-5" />Pre-conto
                </button>
                <button onClick={() => setFase('comanda')}
                  className={`py-4 rounded-2xl text-sm font-bold flex items-center justify-center gap-2 active:scale-95 transition border ${th.card} ${th.muted} hover:border-slate-400`}>
                  <UtensilsCrossed className="w-5 h-5" />Continua
                </button>
                <button onClick={chiudiTavolo}
                  className="py-4 bg-red-600 hover:bg-red-700 text-white rounded-2xl text-sm font-bold flex items-center justify-center gap-2 active:scale-95 transition shadow">
                  <CheckCircle2 className="w-5 h-5" />Chiudi
                </button>
              </div>
            </div>

            <button onClick={reset} className={`w-full py-3 text-sm text-center transition ${th.muted} hover:text-emerald-500`}>
              ← Torna alla selezione tavoli
            </button>
          </div>
        </main>
      )}
    </div>
  )
}
