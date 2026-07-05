'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { queryDB } from '@/lib/api'

interface ClienteDB {
  id: string
  nome: string
  cognome: string
  email: string | null
  telefono: string | null
  tier: string | null
  allergie: string | null
  ultima_visita: string | null
  visite_totali: number
  spesa_totale: number
  a_rischio: boolean
  whatsapp_attivo: boolean
}

const TIER_COLORS: Record<string, string> = {
  Diamante: 'bg-purple-100 text-purple-700',
  Platinum: 'bg-slate-100 text-slate-700',
  Gold: 'bg-yellow-100 text-yellow-700',
}

function TierBadge({ tier }: { tier: string | null }) {
  if (!tier) return null
  return (
    <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${TIER_COLORS[tier] ?? 'bg-gray-100 text-gray-600'}`}>
      {tier}
    </span>
  )
}

function euro(n: number) {
  return new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n)
}

function fmtDate(d: string | null) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit', year: '2-digit' })
}

export default function ClientiPage() {
  const [clienti, setClienti] = useState<ClienteDB[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filtroTier, setFiltroTier] = useState<string>('tutti')

  useEffect(() => {
    setLoading(true)
    const t = setTimeout(async () => {
      const filters: { fn: string; args: unknown[] }[] = []
      if (filtroTier !== 'tutti') filters.push({ fn: 'eq', args: ['tier', filtroTier] })
      if (search.length > 1) filters.push({ fn: 'or', args: [`nome.ilike.%${search}%,cognome.ilike.%${search}%,email.ilike.%${search}%,telefono.ilike.%${search}%`] })
      const data = await queryDB<ClienteDB>('clienti', {
        select: 'id,nome,cognome,email,telefono,tier,allergie,ultima_visita,visite_totali,spesa_totale,a_rischio,whatsapp_attivo',
        filters,
        order: { col: 'cognome' },
        limit: 100,
      })
      setClienti(data)
      setLoading(false)
    }, 300)
    return () => clearTimeout(t)
  }, [search, filtroTier])

  const tierOptions = ['tutti', 'Diamante', 'Platinum', 'Gold']

  return (
    <div className="p-5 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-base font-semibold text-slate-900">Clienti</h1>
          <p className="text-xs text-slate-500">{clienti.length} clienti trovati</p>
        </div>
      </div>

      {/* Filtri */}
      <div className="flex gap-2 flex-wrap items-center">
        <input
          type="text"
          placeholder="Cerca nome, email, telefono..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 min-w-48 px-3 py-1.5 rounded-md border border-slate-300 text-xs focus:outline-none focus:ring-2 focus:ring-orange-400"
        />
        <div className="flex gap-1.5">
          {tierOptions.map((t) => (
            <button
              key={t}
              onClick={() => setFiltroTier(t)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium border transition ${
                filtroTier === t
                  ? 'bg-orange-500 text-white border-orange-500'
                  : 'bg-white text-slate-600 border-slate-300 hover:border-orange-300'
              }`}
            >
              {t === 'tutti' ? 'Tutti' : t}
            </button>
          ))}
        </div>
      </div>

      {/* Tabella */}
      <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50">
                <th className="text-left px-4 py-2.5 font-medium text-slate-600">Cliente</th>
                <th className="text-left px-4 py-2.5 font-medium text-slate-600">Contatti</th>
                <th className="text-left px-4 py-2.5 font-medium text-slate-600">Tier</th>
                <th className="text-left px-4 py-2.5 font-medium text-slate-600">Visite</th>
                <th className="text-left px-4 py-2.5 font-medium text-slate-600">Spesa tot.</th>
                <th className="text-left px-4 py-2.5 font-medium text-slate-600">Ultima visita</th>
                <th className="px-4 py-2.5"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {loading ? (
                [...Array(6)].map((_, i) => (
                  <tr key={i}>
                    <td colSpan={7} className="px-4 py-2.5">
                      <div className="h-3.5 bg-slate-100 rounded animate-pulse" />
                    </td>
                  </tr>
                ))
              ) : clienti.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-slate-400 text-xs">
                    Nessun cliente trovato
                  </td>
                </tr>
              ) : clienti.map((c) => (
                <tr key={c.id} className="hover:bg-slate-50 transition">
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-2.5">
                      <div className="w-7 h-7 rounded-full bg-orange-100 flex items-center justify-center text-orange-600 font-semibold text-[10px] shrink-0">
                        {c.nome[0]}{c.cognome[0]}
                      </div>
                      <div>
                        <p className="font-medium text-slate-900">{c.nome} {c.cognome}</p>
                        {c.allergie && (
                          <p className="text-[10px] text-red-500">⚠️ {c.allergie}</p>
                        )}
                        {c.a_rischio && (
                          <p className="text-[10px] text-amber-600">● a rischio</p>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-2.5 text-slate-600">
                    <p>{c.email ?? '—'}</p>
                    <p className="text-slate-400">{c.telefono ?? ''}{c.whatsapp_attivo ? ' 💬' : ''}</p>
                  </td>
                  <td className="px-4 py-2.5">
                    <TierBadge tier={c.tier} />
                  </td>
                  <td className="px-4 py-2.5 text-slate-700 font-medium">{c.visite_totali}</td>
                  <td className="px-4 py-2.5 text-slate-700">{euro(c.spesa_totale)}</td>
                  <td className="px-4 py-2.5 text-slate-500">{fmtDate(c.ultima_visita)}</td>
                  <td className="px-4 py-2.5">
                    <Link href={`/clienti/${c.id}`} className="text-orange-500 hover:text-orange-600 font-medium">
                      Dettaglio →
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
