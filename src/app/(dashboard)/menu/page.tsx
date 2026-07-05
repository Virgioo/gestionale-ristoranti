'use client'

import { useEffect, useState } from 'react'
import { queryDB, updateDB } from '@/lib/api'
import { formatEuro } from '@/lib/utils'
import toast from 'react-hot-toast'

interface MenuItem {
  id: string
  nome: string
  descrizione: string | null
  prezzo: number
  categoria: string
  disponibile: boolean
  allergeni: string[] | null
  adatto_cani: boolean
}

const MOCK_MENU: MenuItem[] = [
  { id: 'm1',  nome: 'Crudo di mare misto',            descrizione: 'Gamberi rossi, scampi, ostriche e capesante con limone e olio EVO',         prezzo: 28, categoria: 'antipasti', disponibile: true, allergeni: ['molluschi','crostacei'], adatto_cani: false },
  { id: 'm2',  nome: 'Carpaccio di tonno rosso',        descrizione: 'Tonno rosso, bottarga di muggine, rucola e capperi di Pantelleria',          prezzo: 22, categoria: 'antipasti', disponibile: true, allergeni: ['pesce'], adatto_cani: false },
  { id: 'm3',  nome: 'Polpo alla brace',                descrizione: 'Polpo verace su insalata di patate, olive taggiasche e prezzemolo',          prezzo: 18, categoria: 'antipasti', disponibile: true, allergeni: ['molluschi'], adatto_cani: false },
  { id: 'm4',  nome: 'Burrata con alici marinate',      descrizione: 'Burrata pugliese DOP, alici del Cantabrico e olio al basilico',              prezzo: 16, categoria: 'antipasti', disponibile: true, allergeni: ['latte','pesce'], adatto_cani: false },
  { id: 'm5',  nome: 'Frittura di paranza leggera',     descrizione: 'Calamari, gamberi, alici e zucchine pastellati',                             prezzo: 20, categoria: 'antipasti', disponibile: true, allergeni: ['pesce','glutine'], adatto_cani: false },
  { id: 'm6',  nome: 'Strozzapreti al ragù di scorfano', descrizione: 'Pasta fresca con ragù di scorfano e pomodorini',                            prezzo: 18, categoria: 'primi',    disponibile: true, allergeni: ['glutine','pesce'], adatto_cani: false },
  { id: 'm7',  nome: 'Tagliolini al granchio blu',       descrizione: 'Pasta fresca con granchio blu dell\'Adriatico e pomodoro San Marzano',       prezzo: 24, categoria: 'primi',    disponibile: true, allergeni: ['glutine','crostacei'], adatto_cani: false },
  { id: 'm8',  nome: 'Risotto allo scoglio',             descrizione: 'Carnaroli mantecato con vongole, cozze, gamberi e scampi',                  prezzo: 22, categoria: 'primi',    disponibile: true, allergeni: ['molluschi','crostacei'], adatto_cani: false },
  { id: 'm9',  nome: 'Spaghetti alle vongole veraci',    descrizione: 'Spaghetti di Gragnano, vongole veraci, aglio e peperoncino',                prezzo: 19, categoria: 'primi',    disponibile: true, allergeni: ['glutine','molluschi'], adatto_cani: false },
  { id: 'm10', nome: 'Branzino selvaggio alla griglia',  descrizione: 'Branzino dell\'Adriatico, erbe aromatiche, limone e olio EVO DOP',          prezzo: 32, categoria: 'secondi',  disponibile: true, allergeni: ['pesce'], adatto_cani: false },
  { id: 'm11', nome: 'Filetto di manzo Chianina',        descrizione: 'Filetto IGP 300g, rosmarino, aglio confit e patate al forno',               prezzo: 38, categoria: 'secondi',  disponibile: true, allergeni: null, adatto_cani: false },
  { id: 'm12', nome: 'Astice alla catalana',             descrizione: 'Astice bretone 600g con pomodori camone e cipolla rossa di Tropea',         prezzo: 45, categoria: 'secondi',  disponibile: true, allergeni: ['crostacei','glutine'], adatto_cani: false },
  { id: 'm13', nome: 'Tiramisù artigianale',             descrizione: 'Mascarpone, savoiardi, caffè espresso, uova fresche e cacao',               prezzo: 9,  categoria: 'dolci',    disponibile: true, allergeni: ['glutine','uova','latte'], adatto_cani: false },
  { id: 'm14', nome: 'Panna cotta ai frutti rossi',      descrizione: 'Panna cotta alla vaniglia bourbon con coulis di lamponi e more',            prezzo: 8,  categoria: 'dolci',    disponibile: true, allergeni: ['latte'], adatto_cani: false },
  { id: 'm15', nome: 'Sorbetto al limone di Amalfi',     descrizione: 'Sorbetto artigianale con limoni IGP servito in scorza di limone',           prezzo: 7,  categoria: 'dolci',    disponibile: true, allergeni: null, adatto_cani: false },
  { id: 'm16', nome: 'Verdicchio dei Castelli di Jesi DOC 75cl', descrizione: 'Bianco strutturato — abbinamento perfetto con pesce',               prezzo: 22, categoria: 'vini',     disponibile: true, allergeni: ['solfiti'], adatto_cani: false },
  { id: 'm17', nome: 'Trebbiano d\'Abruzzo DOC 75cl',    descrizione: 'Bianco fresco e sapido, produzione biologica',                              prezzo: 18, categoria: 'vini',     disponibile: true, allergeni: ['solfiti'], adatto_cani: false },
  { id: 'm18', nome: 'Montepulciano d\'Abruzzo DOC 75cl', descrizione: 'Rosso pieno e corposo, affinato 18 mesi in barriques',                    prezzo: 22, categoria: 'vini',     disponibile: true, allergeni: ['solfiti'], adatto_cani: false },
  { id: 'm19', nome: 'Prosecco Valdobbiadene DOCG 75cl', descrizione: 'Bollicine fini e persistenti — per aperitivo e dessert',                   prezzo: 28, categoria: 'vini',     disponibile: true, allergeni: ['solfiti'], adatto_cani: false },
  { id: 'm20', nome: 'Acqua minerale 75cl',               descrizione: null,                                                                        prezzo: 3,  categoria: 'bevande',  disponibile: true, allergeni: null, adatto_cani: false },
  { id: 'm21', nome: 'Acqua frizzante 75cl',              descrizione: null,                                                                        prezzo: 3,  categoria: 'bevande',  disponibile: true, allergeni: null, adatto_cani: false },
  { id: 'm22', nome: 'Bistecchine di pollo al vapore 🐕', descrizione: 'Pollo biologico al vapore, senza sale né spezie — per i tuoi amici a 4 zampe', prezzo: 8, categoria: 'menu_cani', disponibile: true, allergeni: null, adatto_cani: true },
  { id: 'm23', nome: 'Manzo bollito con carote 🐕',       descrizione: 'Manzo magro bollito con carote e zucchine, senza condimenti',              prezzo: 9,  categoria: 'menu_cani', disponibile: true, allergeni: null, adatto_cani: true },
  { id: 'm24', nome: 'Riso integrale con verdure 🐕',     descrizione: 'Riso integrale biologico, carote, zucchine e fagiolini — senza sale',     prezzo: 6,  categoria: 'menu_cani', disponibile: true, allergeni: null, adatto_cani: true },
]

export default function MenuPage() {
  const [items, setItems] = useState<MenuItem[]>([])
  const [loading, setLoading] = useState(true)
  const [isMock, setIsMock] = useState(false)
  const [categoria, setCategoria] = useState('tutte')
  const [soloCani, setSoloCani] = useState(false)

  useEffect(() => {
    async function load() {
      setLoading(true)
      try {
        const filters: { fn: string; args: unknown[] }[] = []
        if (categoria !== 'tutte') filters.push({ fn: 'eq', args: ['categoria', categoria] })
        if (soloCani) filters.push({ fn: 'eq', args: ['adatto_cani', true] })
        const data = await queryDB<MenuItem>('menu', { filters, order: { col: 'categoria' } })
        setItems(data)
        setIsMock(false)
      } catch {
        // Tabella 'menu' non presente nel DB — usa dati di esempio
        let data = MOCK_MENU
        if (categoria !== 'tutte') data = data.filter(i => i.categoria === categoria)
        if (soloCani) data = data.filter(i => i.adatto_cani)
        setItems(data)
        setIsMock(true)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [categoria, soloCani])

  async function toggleDisponibile(id: string, disponibile: boolean) {
    if (isMock) {
      setItems(prev => prev.map(i => i.id === id ? { ...i, disponibile } : i))
      toast.success(disponibile ? 'Articolo disponibile' : 'Articolo non disponibile')
      return
    }
    try {
      await updateDB('menu', { disponibile }, { id })
      setItems(prev => prev.map(i => i.id === id ? { ...i, disponibile } : i))
      toast.success(disponibile ? 'Articolo disponibile' : 'Articolo non disponibile')
    } catch {
      toast.error('Errore')
    }
  }

  const categorieDisponibili = ['tutte', ...Array.from(new Set(MOCK_MENU.map(i => i.categoria))).sort()]
  const categorie = isMock ? categorieDisponibili : ['tutte', ...Array.from(new Set(items.map(i => i.categoria))).sort()]
  const grouped = groupByCategoria(items)

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Menu</h1>
          <p className="text-slate-500 text-sm">{items.length} voci nel menu</p>
        </div>
        {isMock && (
          <span className="text-xs bg-amber-100 text-amber-700 px-3 py-1 rounded-full font-medium">
            Dati di esempio
          </span>
        )}
      </div>

      {/* Filtri */}
      <div className="flex gap-3 flex-wrap items-center">
        <div className="flex gap-2 flex-wrap">
          {categorie.map(c => (
            <button
              key={c}
              onClick={() => setCategoria(c)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition capitalize ${categoria === c ? 'bg-orange-500 text-white' : 'bg-white border border-slate-300 text-slate-600 hover:border-orange-300'}`}
            >
              {c.replace('_', ' ')}
            </button>
          ))}
        </div>
        <button
          onClick={() => setSoloCani(!soloCani)}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition ${soloCani ? 'bg-orange-500 text-white border-orange-500' : 'bg-white text-slate-600 border-slate-300 hover:border-orange-300'}`}
        >
          🐕 Solo dog-friendly
        </button>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => <div key={i} className="h-36 bg-slate-200 rounded-xl animate-pulse" />)}
        </div>
      ) : Object.entries(grouped).length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 p-12 text-center text-slate-400">Nessuna voce trovata</div>
      ) : Object.entries(grouped).map(([cat, voci]) => (
        <div key={cat}>
          <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-3 capitalize">{cat.replace('_', ' ')}</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
            {voci.map(item => (
              <div key={item.id} className={`bg-white rounded-xl border p-4 transition ${!item.disponibile ? 'opacity-60 border-slate-200' : 'border-slate-200 hover:border-orange-200'}`}>
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-slate-900">{item.nome}</p>
                      {item.adatto_cani && <span className="text-sm" title="Adatto ai cani">🐕</span>}
                    </div>
                    {item.descrizione && <p className="text-xs text-slate-500 mt-1 line-clamp-2">{item.descrizione}</p>}
                    {item.allergeni && item.allergeni.length > 0 && (
                      <p className="text-xs text-red-400 mt-1">⚠️ {item.allergeni.join(', ')}</p>
                    )}
                  </div>
                  <p className="text-lg font-bold text-orange-600 shrink-0">{formatEuro(item.prezzo)}</p>
                </div>
                <div className="flex items-center justify-between mt-3 pt-3 border-t border-slate-100">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${item.disponibile ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'}`}>
                    {item.disponibile ? 'Disponibile' : 'Non disponibile'}
                  </span>
                  <button
                    onClick={() => toggleDisponibile(item.id, !item.disponibile)}
                    className="text-xs text-orange-500 hover:underline"
                  >
                    {item.disponibile ? 'Nascondi' : 'Attiva'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

function groupByCategoria(items: MenuItem[]) {
  return items.reduce<Record<string, MenuItem[]>>((acc, item) => {
    if (!acc[item.categoria]) acc[item.categoria] = []
    acc[item.categoria].push(item)
    return acc
  }, {})
}
