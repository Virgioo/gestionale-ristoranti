'use client'

import { useState, useEffect } from 'react'
import { Package, Plus, AlertTriangle, X, Edit2, Check, Trash2, Terminal, Flame } from 'lucide-react'
import { queryDB, insertDB, updateDB, deleteDB } from '@/lib/api'
import { formatEuro } from '@/lib/utils'

// ─── Types ───────────────────────────────────────────────────────────────────
interface Categoria {
  id: string; nome: string; colore: string; icona: string; ordine: number
}
interface Prodotto {
  id: string; categoria_id: string | null; nome: string; unita: string
  qta_attuale: number; qta_minima: number; qta_massima: number | null
  fornitore: string | null; prezzo_unitario: number | null; note: string | null
  categorie_economato?: { nome: string; colore: string; icona: string } | null
}
interface PrenRow { coperti: number; stato: string }
interface RigaAttiva { piatto_nome: string; categoria: string; quantita: number; tempo_prep?: number }
interface ComandaAttiva { id: string; tavolo_nome: string | null; numero_tavolo: string | null; righe: RigaAttiva[]; inviata_at: string | null; created_at: string }

// ─── Helpers ─────────────────────────────────────────────────────────────────
const UNITA = ['pz', 'kg', 'g', 'l', 'cl', 'ml', 'bottiglie', 'casse', 'confezioni', 'rotoli', 'tovaglioli']

function sottoscorta(p: Prodotto) { return p.qta_attuale < p.qta_minima }

function scorteLabel(p: Prodotto): string {
  if (p.qta_attuale <= 0) return 'Esaurito'
  if (sottoscorta(p)) return 'Sotto scorta'
  return 'OK'
}

// ─── Modals ──────────────────────────────────────────────────────────────────
function AddCategoriaModal({ onSave, onClose }: {
  onSave: (d: Partial<Categoria>) => void; onClose: () => void
}) {
  const [nome, setNome]     = useState('')
  const [icona, setIcona]   = useState('📦')
  const [colore, setColore] = useState('#94a3b8')
  const ICONS = ['📦','🍷','🥂','🍽️','🥩','🌿','🧴','🪣','🫙','🧀','🐟','🍰']
  const COLORS = ['#94a3b8','#f97316','#10b981','#3b82f6','#a855f7','#ec4899','#f59e0b','#14b8a6','#ef4444','#84cc16']

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl p-6 w-80" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-slate-900">Nuova categoria</h3>
          <button onClick={onClose}><X className="w-4 h-4 text-slate-400" /></button>
        </div>
        <div className="space-y-4">
          <div>
            <label className="text-xs text-slate-500">Nome categoria</label>
            <input autoFocus value={nome} onChange={e => setNome(e.target.value)} placeholder="es. Spezie"
              className="w-full mt-1 px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-orange-400" />
          </div>
          <div>
            <label className="text-xs text-slate-500">Icona</label>
            <div className="flex gap-2 mt-1 flex-wrap">
              {ICONS.map(ic => (
                <button key={ic} type="button" onClick={() => setIcona(ic)}
                  className={`w-8 h-8 text-lg rounded-lg border-2 transition ${icona === ic ? 'border-orange-500 bg-orange-50' : 'border-slate-200'}`}>{ic}</button>
              ))}
            </div>
          </div>
          <div>
            <label className="text-xs text-slate-500">Colore</label>
            <div className="flex gap-2 mt-1 flex-wrap">
              {COLORS.map(c => (
                <button key={c} type="button" onClick={() => setColore(c)}
                  style={{ background: c }}
                  className={`w-7 h-7 rounded-full border-2 transition ${colore === c ? 'border-slate-800 scale-110' : 'border-white'}`} />
              ))}
            </div>
          </div>
          <div className="flex gap-2 pt-1">
            <button onClick={onClose} className="flex-1 py-2 text-sm border border-slate-200 rounded-xl text-slate-600 hover:bg-slate-50">Annulla</button>
            <button onClick={() => { if (nome.trim()) onSave({ nome: nome.trim(), icona, colore }) }}
              className="flex-1 py-2 text-sm bg-orange-500 text-white rounded-xl hover:bg-orange-600">Crea</button>
          </div>
        </div>
      </div>
    </div>
  )
}

function ProdottoModal({ prodotto, categorie, onSave, onClose }: {
  prodotto?: Prodotto | null; categorie: Categoria[]
  onSave: (d: Partial<Prodotto>) => void; onClose: () => void
}) {
  const isEdit = !!prodotto
  const [form, setForm] = useState<Partial<Prodotto>>(prodotto ?? {
    nome: '', unita: 'pz', qta_attuale: 0, qta_minima: 5, qta_massima: null,
    fornitore: '', prezzo_unitario: null, note: '', categoria_id: categorie[0]?.id ?? null,
  })

  function set(k: keyof Prodotto, v: unknown) { setForm(prev => ({ ...prev, [k]: v })) }
  const inp = 'w-full mt-1 px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-orange-400'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-slate-900">{isEdit ? 'Modifica prodotto' : 'Nuovo prodotto'}</h3>
          <button onClick={onClose}><X className="w-4 h-4 text-slate-400" /></button>
        </div>
        <div className="space-y-3">
          <div>
            <label className="text-xs text-slate-500">Nome prodotto *</label>
            <input autoFocus value={form.nome ?? ''} onChange={e => set('nome', e.target.value)} placeholder="es. Vino Sangiovese DOC" className={inp} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-slate-500">Categoria</label>
              <select value={form.categoria_id ?? ''} onChange={e => set('categoria_id', e.target.value || null)} className={inp}>
                <option value="">— Nessuna —</option>
                {categorie.map(c => <option key={c.id} value={c.id}>{c.icona} {c.nome}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-slate-500">Unità di misura</label>
              <select value={form.unita ?? 'pz'} onChange={e => set('unita', e.target.value)} className={inp}>
                {UNITA.map(u => <option key={u} value={u}>{u}</option>)}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div>
              <label className="text-xs text-slate-500">Qta attuale</label>
              <input type="number" min={0} value={form.qta_attuale ?? 0} onChange={e => set('qta_attuale', parseFloat(e.target.value)||0)} className={inp} />
            </div>
            <div>
              <label className="text-xs text-slate-500">Qta minima ⚠️</label>
              <input type="number" min={0} value={form.qta_minima ?? 0} onChange={e => set('qta_minima', parseFloat(e.target.value)||0)} className={inp} />
            </div>
            <div>
              <label className="text-xs text-slate-500">Qta massima</label>
              <input type="number" min={0} value={form.qta_massima ?? ''} placeholder="—" onChange={e => set('qta_massima', e.target.value ? parseFloat(e.target.value) : null)} className={inp} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-slate-500">Fornitore</label>
              <input value={form.fornitore ?? ''} onChange={e => set('fornitore', e.target.value)} placeholder="Nome fornitore" className={inp} />
            </div>
            <div>
              <label className="text-xs text-slate-500">Prezzo unitario (€)</label>
              <input type="number" min={0} step={0.01} value={form.prezzo_unitario ?? ''} placeholder="0.00" onChange={e => set('prezzo_unitario', e.target.value ? parseFloat(e.target.value) : null)} className={inp} />
            </div>
          </div>
          <div>
            <label className="text-xs text-slate-500">Note</label>
            <textarea value={form.note ?? ''} onChange={e => set('note', e.target.value)} rows={2} className="w-full mt-1 px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-orange-400 resize-none" />
          </div>
        </div>
        <div className="flex gap-2 mt-5">
          <button onClick={onClose} className="flex-1 py-2.5 text-sm border border-slate-200 rounded-xl text-slate-600 hover:bg-slate-50">Annulla</button>
          <button onClick={() => { if (form.nome?.trim()) onSave(form) }}
            className="flex-1 py-2.5 text-sm bg-orange-500 text-white rounded-xl hover:bg-orange-600">
            {isEdit ? 'Salva modifiche' : 'Aggiungi'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Inline qty editor ───────────────────────────────────────────────────────
function QtyEditor({ p, onSave }: { p: Prodotto; onSave: (qty: number) => void }) {
  const [editing, setEditing] = useState(false)
  const [val, setVal]         = useState(String(p.qta_attuale))

  if (!editing) return (
    <button onClick={() => setEditing(true)}
      className="font-semibold text-slate-800 hover:text-orange-500 transition text-sm"
      title="Clicca per modificare quantità">
      {p.qta_attuale} {p.unita}
    </button>
  )
  return (
    <div className="flex items-center gap-1">
      <input autoFocus type="number" min={0} value={val} onChange={e => setVal(e.target.value)}
        className="w-20 px-2 py-0.5 text-sm border border-orange-400 rounded focus:outline-none" />
      <button onClick={() => { onSave(parseFloat(val)||0); setEditing(false) }} className="text-green-500 hover:text-green-600"><Check className="w-4 h-4" /></button>
      <button onClick={() => setEditing(false)} className="text-slate-400 hover:text-slate-600"><X className="w-4 h-4" /></button>
    </div>
  )
}

// ═════════════════════════════════════════════════════════════════════════════
export default function EconomatoPage() {
  const [categorie,  setCategorie]  = useState<Categoria[]>([])
  const [prodotti,   setProdotti]   = useState<Prodotto[]>([])
  const [prenOggi,   setPrenOggi]   = useState<PrenRow[]>([])
  const [catSel,       setCatSel]       = useState<string>('tutti')
  const [showAddCat,   setShowAddCat]   = useState(false)
  const [prodModal,    setProdModal]    = useState<{ prod?: Prodotto } | null>(null)
  const [comandeAttive, setComandeAttive] = useState<ComandaAttiva[]>([])
  const [loading,      setLoading]      = useState(true)
  const [error,        setError]        = useState<string | null>(null)
  const [tableMissing, setTableMissing] = useState(false)

  useEffect(() => {
    load()
    const oggi = new Date().toISOString().split('T')[0]
    queryDB<PrenRow>('prenotazioni', {
      select: 'coperti,stato',
      filters: [
        { fn: 'eq',  args: ['data_prenotazione', oggi] },
        { fn: 'neq', args: ['stato', 'cancellata'] },
        { fn: 'neq', args: ['stato', 'no_show'] },
      ],
    }).then(r => setPrenOggi(r))

    // Uscite in tempo reale: comande attive
    function fetchAttive() {
      queryDB<ComandaAttiva>('comande', {
        select: 'id,tavolo_nome,numero_tavolo,righe,inviata_at,created_at',
        filters: [{ fn: 'neq', args: ['stato', 'completata'] }],
        limit: 100,
      }).then(rows => {
        setComandeAttive(rows.map(c => ({
          ...c,
          righe: (typeof c.righe === 'string' ? JSON.parse(c.righe) : c.righe) as RigaAttiva[],
        })))
      }).catch(() => {})
    }
    fetchAttive()
    const id = setInterval(fetchAttive, 15_000)
    return () => clearInterval(id)
  }, [])

  async function load() {
    setLoading(true)
    try {
      const [cat, prod] = await Promise.all([
        queryDB<Categoria>('categorie_economato', { select: 'id,nome,colore,icona,ordine', order: { col: 'ordine' } }),
        queryDB<Prodotto>('prodotti_economato', {
          select: 'id,categoria_id,nome,unita,qta_attuale,qta_minima,qta_massima,fornitore,prezzo_unitario,note,categorie_economato(nome,colore,icona)',
          order: { col: 'nome' },
        }),
      ])
      setTableMissing(false)
      setCategorie(cat)
      setProdotti(prod)
    } catch (err) {
      const msg = (err as Error).message ?? ''
      if (msg.includes('does not exist') || msg.includes('relation') || msg.includes('42P01')) {
        setTableMissing(true)
      } else {
        setError(msg)
      }
    }
    finally { setLoading(false) }
  }

  async function addCategoria(d: Partial<Categoria>) {
    try {
      const rows = await insertDB<Categoria>('categorie_economato', { ...d, ordine: categorie.length + 1 })
      setCategorie(prev => [...prev, rows[0]]); setShowAddCat(false)
    } catch (err) { setError((err as Error).message) }
  }

  async function addProdotto(d: Partial<Prodotto>) {
    try {
      const rows = await insertDB<Prodotto>('prodotti_economato', d)
      setProdotti(prev => [...prev, rows[0]]); setProdModal(null)
      await load()
    } catch (err) { setError((err as Error).message) }
  }

  async function editProdotto(id: string, d: Partial<Prodotto>) {
    try {
      await updateDB('prodotti_economato', d, { id })
      setProdModal(null); await load()
    } catch (err) { setError((err as Error).message) }
  }

  async function deleteProdotto(id: string) {
    if (!confirm('Eliminare questo prodotto?')) return
    try {
      await deleteDB('prodotti_economato', { id })
      setProdotti(prev => prev.filter(p => p.id !== id))
    } catch (err) { setError((err as Error).message) }
  }

  async function updateQty(id: string, qta: number) {
    try {
      await updateDB('prodotti_economato', { qta_attuale: qta }, { id })
      setProdotti(prev => prev.map(p => p.id === id ? { ...p, qta_attuale: qta } : p))
    } catch (err) { setError((err as Error).message) }
  }

  // Fabbisogno giornaliero
  const copertiOggi = prenOggi.reduce((s, p) => s + (p.coperti ?? 0), 0)

  // Uscite in tempo reale: aggrega righe per categoria
  const usciteRealtime = (() => {
    const map: Record<string, { piatto_nome: string; quantita: number; tavoli: string[] }[]> = {}
    for (const c of comandeAttive) {
      const tavolo = c.tavolo_nome ?? c.numero_tavolo ?? 'T?'
      for (const r of c.righe) {
        const cat = r.categoria ?? 'altro'
        if (!map[cat]) map[cat] = []
        const existing = map[cat].find(e => e.piatto_nome === r.piatto_nome)
        if (existing) {
          existing.quantita += r.quantita
          if (!existing.tavoli.includes(tavolo)) existing.tavoli.push(tavolo)
        } else {
          map[cat].push({ piatto_nome: r.piatto_nome, quantita: r.quantita, tavoli: [tavolo] })
        }
      }
    }
    return map
  })()

  const filtered = catSel === 'tutti'
    ? prodotti
    : catSel === 'alert'
      ? prodotti.filter(p => sottoscorta(p))
      : prodotti.filter(p => p.categoria_id === catSel)

  const alertCount = prodotti.filter(p => sottoscorta(p)).length

  const valoreMagazzino = prodotti.reduce((s, p) =>
    s + p.qta_attuale * (p.prezzo_unitario ?? 0), 0)

  return (
    <div className="p-6 space-y-5 max-w-7xl">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-emerald-600 flex items-center justify-center shrink-0">
            <Package className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900">Economato</h1>
            <p className="text-slate-500 text-xs">Gestione scorte e magazzino</p>
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setShowAddCat(true)}
            className="flex items-center gap-1.5 px-3 py-2 text-xs border border-dashed border-slate-300 text-slate-500 rounded-xl hover:border-emerald-400 hover:text-emerald-600 transition">
            <Plus className="w-3.5 h-3.5" /> Categoria
          </button>
          <button onClick={() => setProdModal({})}
            className="flex items-center gap-1.5 px-3 py-2 text-xs bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 transition">
            <Plus className="w-3.5 h-3.5" /> Prodotto
          </button>
        </div>
      </div>

      {tableMissing && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-5">
          <div className="flex items-start gap-3">
            <Terminal className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-amber-800 mb-1">Tabelle economato non trovate</p>
              <p className="text-xs text-amber-700 mb-3">
                Esegui la migrazione SQL nel <strong>Supabase Dashboard → SQL Editor</strong> per attivare questo modulo.
              </p>
              <pre className="bg-amber-100 border border-amber-200 rounded-lg p-3 text-[10px] text-amber-900 overflow-x-auto whitespace-pre-wrap leading-relaxed">
{`-- Incolla nel SQL Editor di Supabase Dashboard:
-- File: supabase/migrations/20260703_create_economato.sql`}
              </pre>
              <button onClick={load} className="mt-3 text-xs text-amber-700 font-medium hover:underline">
                Riprova dopo la migrazione →
              </button>
            </div>
          </div>
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-sm text-red-700 flex justify-between">
          {error}<button onClick={() => setError(null)}><X className="w-4 h-4" /></button>
        </div>
      )}

      {/* KPI row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <p className="text-xs text-slate-500">Prodotti totali</p>
          <p className="text-2xl font-bold text-slate-900 mt-1">{prodotti.length}</p>
        </div>
        <div className={`rounded-xl border p-4 ${alertCount > 0 ? 'bg-red-50 border-red-200' : 'bg-white border-slate-200'}`}>
          <p className="text-xs text-slate-500">Sotto scorta</p>
          <p className={`text-2xl font-bold mt-1 ${alertCount > 0 ? 'text-red-600' : 'text-slate-900'}`}>{alertCount}</p>
          {alertCount > 0 && <p className="text-[10px] text-red-500 mt-0.5">Richiede attenzione</p>}
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <p className="text-xs text-slate-500">Valore magazzino</p>
          <p className="text-2xl font-bold text-emerald-600 mt-1">{formatEuro(valoreMagazzino)}</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <p className="text-xs text-slate-500">Coperti oggi</p>
          <p className="text-2xl font-bold text-blue-600 mt-1">{copertiOggi}</p>
          <p className="text-[10px] text-slate-400 mt-0.5">{prenOggi.length} prenotazioni</p>
        </div>
      </div>

      {/* Alert banner */}
      {alertCount > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-amber-800">{alertCount} prodott{alertCount === 1 ? 'o' : 'i'} sotto scorta minima</p>
            <p className="text-xs text-amber-700 mt-0.5">
              {prodotti.filter(sottoscorta).map(p => p.nome).join(', ')}
            </p>
          </div>
          <button onClick={() => setCatSel('alert')} className="ml-auto text-xs text-amber-700 font-medium hover:underline whitespace-nowrap">
            Vedi tutti →
          </button>
        </div>
      )}

      {/* Fabbisogno giornaliero */}
      {copertiOggi > 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
          <p className="text-sm font-semibold text-blue-800 mb-2">📋 Fabbisogno stimato oggi ({copertiOggi} coperti)</p>
          <div className="flex flex-wrap gap-3">
            {[
              { nome: 'Tovaglioli', stima: copertiOggi * 2 },
              { nome: 'Posate set', stima: copertiOggi },
              { nome: 'Bicchieri acqua', stima: copertiOggi },
              { nome: 'Bicchieri vino', stima: Math.round(copertiOggi * 1.5) },
              { nome: 'Bottiglie acqua', stima: Math.ceil(copertiOggi / 3) },
            ].map(f => (
              <div key={f.nome} className="bg-white rounded-lg px-3 py-2 border border-blue-100">
                <p className="text-[10px] text-blue-600">{f.nome}</p>
                <p className="text-sm font-bold text-blue-800">~{f.stima}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Uscite in tempo reale */}
      {Object.keys(usciteRealtime).length > 0 && (
        <div className="bg-orange-50 border border-orange-200 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <Flame className="w-4 h-4 text-orange-600" />
            <p className="text-sm font-semibold text-orange-800">
              Uscite in tempo reale — {comandeAttive.length} tavo{comandeAttive.length === 1 ? 'lo' : 'li'} attiv{comandeAttive.length === 1 ? 'o' : 'i'}
            </p>
            <span className="ml-auto text-[10px] text-orange-500 font-medium">aggiorna ogni 15s</span>
          </div>
          <div className="space-y-3">
            {['antipasti','primi','secondi','dolci','bevande','vini','menu_cani','altro']
              .filter(cat => usciteRealtime[cat]?.length)
              .map(cat => (
                <div key={cat}>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-orange-600 mb-1.5">{cat}</p>
                  <div className="flex flex-wrap gap-2">
                    {usciteRealtime[cat].map(item => (
                      <div key={item.piatto_nome} className="bg-white border border-orange-100 rounded-lg px-3 py-1.5 flex items-center gap-2 shadow-sm">
                        <span className="font-bold text-orange-700 text-sm">{item.quantita}×</span>
                        <span className="text-slate-700 text-sm font-medium">{item.piatto_nome}</span>
                        <span className="text-[10px] text-slate-400">{item.tavoli.join(', ')}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))
            }
          </div>
        </div>
      )}

      {/* Category filter tabs */}
      <div className="flex gap-2 flex-wrap">
        <button onClick={() => setCatSel('tutti')}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${catSel === 'tutti' ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
          Tutti ({prodotti.length})
        </button>
        {alertCount > 0 && (
          <button onClick={() => setCatSel('alert')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1 transition ${catSel === 'alert' ? 'bg-red-500 text-white' : 'bg-red-50 text-red-600 hover:bg-red-100 border border-red-200'}`}>
            <AlertTriangle className="w-3 h-3" /> Alert ({alertCount})
          </button>
        )}
        {categorie.map(c => {
          const cnt = prodotti.filter(p => p.categoria_id === c.id).length
          return (
            <button key={c.id} onClick={() => setCatSel(c.id)}
              style={catSel === c.id ? { background: c.colore, color: 'white' } : {}}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${catSel === c.id ? '' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
              {c.icona} {c.nome} ({cnt})
            </button>
          )
        })}
      </div>

      {/* Products table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        {loading ? (
          <div className="h-48 animate-pulse bg-slate-50 flex items-center justify-center text-slate-300 text-sm">Caricamento...</div>
        ) : filtered.length === 0 ? (
          <div className="py-16 text-center">
            <Package className="w-10 h-10 text-slate-200 mx-auto mb-3" />
            <p className="text-slate-400 text-sm">
              {catSel === 'alert' ? 'Nessun prodotto sotto scorta 🎉' : 'Nessun prodotto in questa categoria'}
            </p>
            <button onClick={() => setProdModal({})} className="mt-3 text-xs text-emerald-600 hover:underline">
              + Aggiungi prodotto
            </button>
          </div>
        ) : (
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100">
                {['Prodotto','Categoria','Qta attuale','Min/Max','Fornitore','Prezzo','Stato',''].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-[10px] uppercase tracking-wide font-medium text-slate-400">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filtered.map(p => {
                const stato = p.qta_attuale <= 0 ? 'esaurito' : sottoscorta(p) ? 'alert' : 'ok'
                return (
                  <tr key={p.id} className={`hover:bg-slate-50 transition ${sottoscorta(p) ? 'bg-red-50/40' : ''}`}>
                    <td className="px-4 py-3">
                      <p className="font-medium text-slate-800">{p.nome}</p>
                      {p.note && <p className="text-[10px] text-slate-400 mt-0.5 line-clamp-1">{p.note}</p>}
                    </td>
                    <td className="px-4 py-3">
                      {p.categorie_economato ? (
                        <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full font-medium"
                          style={{ background: p.categorie_economato.colore + '20', color: p.categorie_economato.colore }}>
                          {p.categorie_economato.icona} {p.categorie_economato.nome}
                        </span>
                      ) : <span className="text-slate-300">—</span>}
                    </td>
                    <td className="px-4 py-3">
                      <QtyEditor p={p} onSave={qty => updateQty(p.id, qty)} />
                    </td>
                    <td className="px-4 py-3 text-slate-500">
                      {p.qta_minima} / {p.qta_massima ?? '∞'} {p.unita}
                    </td>
                    <td className="px-4 py-3 text-slate-600">{p.fornitore ?? <span className="text-slate-300">—</span>}</td>
                    <td className="px-4 py-3 text-slate-600">{p.prezzo_unitario != null ? formatEuro(p.prezzo_unitario) : <span className="text-slate-300">—</span>}</td>
                    <td className="px-4 py-3">
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                        stato === 'esaurito' ? 'bg-red-100 text-red-700' :
                        stato === 'alert'    ? 'bg-amber-100 text-amber-700' :
                                              'bg-emerald-100 text-emerald-700'}`}>
                        {stato === 'esaurito' ? '🔴 Esaurito' : stato === 'alert' ? '⚠️ Scorta bassa' : '✅ OK'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <button onClick={() => setProdModal({ prod: p })} className="text-slate-400 hover:text-orange-500 transition">
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={() => deleteProdotto(p.id)} className="text-slate-400 hover:text-red-500 transition">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Modals */}
      {showAddCat && <AddCategoriaModal onSave={addCategoria} onClose={() => setShowAddCat(false)} />}
      {prodModal !== null && (
        <ProdottoModal
          prodotto={prodModal.prod}
          categorie={categorie}
          onSave={d => prodModal.prod ? editProdotto(prodModal.prod.id, d) : addProdotto(d)}
          onClose={() => setProdModal(null)}
        />
      )}
    </div>
  )
}
