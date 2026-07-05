'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase'
import { queryDB, countDB } from '@/lib/api'
import { isAdmin } from '@/lib/roles'
import { formatEuro } from '@/lib/utils'
import type { User } from '@supabase/supabase-js'
import {
  TrendingUp, TrendingDown, Users, CalendarCheck, Euro, Bell,
  MapPin, Star, AlertTriangle, Cake, LayoutGrid,
} from 'lucide-react'

/* ── tipi ─────────────────────────────────────────────────────────────────── */
interface PrenRow {
  id: string; nome_ospite: string; ora_arrivo: string
  coperti: number; tipo_tavolo: string | null; stato: string
  con_animale: boolean; allergie_comunicare: string | null
}
interface NotifRow { id: string; titolo: string; messaggio: string; tipo: string }
interface VisitaImporto { importo: number; sede_id: string | null; sedi: { nome: string } | null }
interface ClienteCompleanno { id: string; nome: string; cognome: string; data_nascita: string | null; tier: string | null }
interface ProdottoAlert { id: string; nome: string; qta_attuale: number; qta_minima: number }
interface StatoTavolo { stato: string }

interface Stats {
  prenOggi: number; prenIeri: number; clienti: number
  revMese: number; revMesePre: number; nonLette: number
}
interface AdminStats {
  revOggi: number; revSettimana: number
  topSede: string; topSedeRev: number
  clienteVip: string; clienteVipVisite: number
  tavoliOccupati: number; tavoliTotali: number
  prossimoCompleanno: { nome: string; giorniAl: number; tier: string } | null
  alertScorte: number
}

/* ── helpers ─────────────────────────────────────────────────────────────── */
function monthRange(offsetMonths = 0): [string, string] {
  const d = new Date()
  d.setDate(1); d.setMonth(d.getMonth() + offsetMonths)
  const start = d.toISOString().slice(0, 10)
  d.setMonth(d.getMonth() + 1)
  return [start, d.toISOString().slice(0, 10)]
}

function trend(curr: number, prev: number) {
  if (prev === 0) return null
  const pct = Math.round(((curr - prev) / prev) * 100)
  return { pct, up: pct >= 0 }
}

function nextBirthdayDays(dataNascita: string): number {
  const b = new Date(dataNascita + 'T12:00:00')
  const oggi = new Date()
  const next = new Date(oggi.getFullYear(), b.getMonth(), b.getDate())
  if (next < oggi) next.setFullYear(oggi.getFullYear() + 1)
  return Math.ceil((next.getTime() - oggi.getTime()) / 86_400_000)
}

/* ── costanti ────────────────────────────────────────────────────────────── */
const STATO_COLORS: Record<string, string> = {
  confermata: 'bg-green-100 text-green-800', in_attesa: 'bg-yellow-100 text-yellow-800',
  cancellata: 'bg-red-100 text-red-800',     completata: 'bg-gray-100 text-gray-600',
  no_show: 'bg-gray-100 text-gray-500',
}
const STATO_LABEL: Record<string, string> = {
  confermata: 'Confermata', in_attesa: 'In attesa',
  cancellata: 'Cancellata', completata: 'Completata', no_show: 'No show',
}
const TIPO_ICON: Record<string, string> = {
  allergia: '⚠️', compleanno: '🎂', anniversario: '🎉',
  prenotazione: '📅', rischio_abbandono: '🔴', vip_inattivo: '💤',
}

/* ════════════════════════════════════════════════════════════════════════════
   PAGINA
═══════════════════════════════════════════════════════════════════════════ */
export default function DashboardPage() {
  const [stats,        setStats]        = useState<Stats | null>(null)
  const [adminStats,   setAdminStats]   = useState<AdminStats | null>(null)
  const [prenotazioni, setPrenotazioni] = useState<PrenRow[]>([])
  const [notifiche,    setNotifiche]    = useState<NotifRow[]>([])
  const [user,         setUser]         = useState<User | null>(null)
  const [adminLoading, setAdminLoading] = useState(false)

  /* Recupera utente corrente */
  useEffect(() => {
    createClient().auth.getUser().then(({ data }) => setUser(data.user))
  }, [])

  /* Metriche base */
  useEffect(() => {
    async function load() {
      const oggi = new Date().toISOString().split('T')[0]
      const ieri = new Date(Date.now() - 86_400_000).toISOString().split('T')[0]
      const [mStart, mEnd] = monthRange(0)
      const [mpStart, mpEnd] = monthRange(-1)

      const [prenOggi, prenIeri, clienti, pren, notif, visiteM, visiteMp, nonLette] = await Promise.all([
        countDB('prenotazioni', [{ fn: 'eq', args: ['data_prenotazione', oggi] }]),
        countDB('prenotazioni', [{ fn: 'eq', args: ['data_prenotazione', ieri] }]),
        countDB('clienti'),
        queryDB<PrenRow>('prenotazioni', {
          select: 'id,nome_ospite,ora_arrivo,coperti,tipo_tavolo,stato,con_animale,allergie_comunicare',
          filters: [{ fn: 'eq', args: ['data_prenotazione', oggi] }],
          order: { col: 'ora_arrivo' }, limit: 8,
        }),
        queryDB<NotifRow>('notifiche', {
          select: 'id,titolo,messaggio,tipo',
          filters: [{ fn: 'eq', args: ['letta', false] }], limit: 5,
        }),
        queryDB<{ importo: number }>('visite', {
          select: 'importo',
          filters: [{ fn: 'gte', args: ['data_visita', mStart] }, { fn: 'lt', args: ['data_visita', mEnd] }],
        }),
        queryDB<{ importo: number }>('visite', {
          select: 'importo',
          filters: [{ fn: 'gte', args: ['data_visita', mpStart] }, { fn: 'lt', args: ['data_visita', mpEnd] }],
        }),
        countDB('notifiche', [{ fn: 'eq', args: ['letta', false] }]),
      ])

      const sum = (rows: { importo: number }[]) => rows.reduce((s, r) => s + (r.importo ?? 0), 0)
      setStats({ prenOggi, prenIeri, clienti, revMese: sum(visiteM), revMesePre: sum(visiteMp), nonLette })
      setPrenotazioni(pren)
      setNotifiche(notif)
    }
    load()
  }, [])

  /* Metriche admin */
  useEffect(() => {
    if (!user || !isAdmin(user)) return
    setAdminLoading(true)

    async function loadAdmin() {
      const oggi = new Date().toISOString().split('T')[0]
      const settimanafa = new Date(Date.now() - 7 * 86_400_000).toISOString().split('T')[0]

      const [visitOggi, visitSett, clientiCompleanno, tavoliAll, tavoliStato, alertScorte] =
        await Promise.all([
          queryDB<VisitaImporto>('visite', {
            select: 'importo,sede_id,sedi(nome)',
            filters: [{ fn: 'eq', args: ['data_visita', oggi] }],
          }),
          queryDB<VisitaImporto & { cliente_id: string; clienti: { nome: string; cognome: string } | null }>('visite', {
            select: 'importo,sede_id,cliente_id,sedi(nome),clienti(nome,cognome)',
            filters: [{ fn: 'gte', args: ['data_visita', settimanafa] }],
          }),
          queryDB<ClienteCompleanno>('clienti', {
            select: 'id,nome,cognome,data_nascita,tier',
            filters: [{ fn: 'not', args: ['data_nascita', 'is', null] }],
          }),
          queryDB<{ id: string }>('tavoli', { select: 'id', limit: 200 }),
          queryDB<StatoTavolo>('stato_tavoli', { select: 'stato', limit: 200 }),
          // Try-catch gestito nel componente
          countDB('prodotti_economato', []).catch(() => -1) as Promise<number>,
        ])

      /* Revenue oggi / settimana */
      const revOggi = visitOggi.reduce((s, v) => s + v.importo, 0)
      const revSettimana = visitSett.reduce((s, v) => s + v.importo, 0)

      /* Top sede della settimana */
      const sedeMap: Record<string, number> = {}
      for (const v of visitSett) {
        const nome = v.sedi?.nome ?? 'Sconosciuta'
        sedeMap[nome] = (sedeMap[nome] ?? 0) + v.importo
      }
      const topEntry = Object.entries(sedeMap).sort((a, b) => b[1] - a[1])[0]
      const topSede = topEntry?.[0] ?? '—'
      const topSedeRev = topEntry?.[1] ?? 0

      /* Cliente VIP più attivo (per visite nella settimana) */
      const clienteMap: Record<string, { nome: string; visite: number }> = {}
      for (const v of visitSett) {
        if (!v.cliente_id || !v.clienti) continue
        if (!clienteMap[v.cliente_id]) clienteMap[v.cliente_id] = { nome: `${v.clienti.nome} ${v.clienti.cognome}`, visite: 0 }
        clienteMap[v.cliente_id].visite += 1
      }
      const topCliente = Object.values(clienteMap).sort((a, b) => b.visite - a.visite)[0]

      /* Prossimo compleanno VIP */
      const conCompleanno = clientiCompleanno
        .filter(c => c.data_nascita)
        .map(c => ({ nome: `${c.nome} ${c.cognome}`, tier: c.tier ?? '', giorniAl: nextBirthdayDays(c.data_nascita!) }))
        .sort((a, b) => a.giorniAl - b.giorniAl)
      const prossimoCompleanno = conCompleanno[0] ?? null

      /* Tavoli occupati */
      const tavoliOccupati = tavoliStato.filter(t => t.stato === 'occupato').length
      const tavoliTotali = tavoliAll.length

      /* Alert scorte — se la tabella non esiste alertScorte = -1 */
      let alertScorteCount = 0
      if (alertScorte >= 0) {
        const prodotti = await queryDB<ProdottoAlert>('prodotti_economato', {
          select: 'id,nome,qta_attuale,qta_minima', limit: 200,
        }).catch(() => [] as ProdottoAlert[])
        alertScorteCount = prodotti.filter(p => p.qta_attuale < p.qta_minima).length
      }

      setAdminStats({
        revOggi, revSettimana, topSede, topSedeRev,
        clienteVip: topCliente?.nome ?? '—',
        clienteVipVisite: topCliente?.visite ?? 0,
        tavoliOccupati, tavoliTotali,
        prossimoCompleanno,
        alertScorte: alertScorteCount,
      })
      setAdminLoading(false)
    }
    loadAdmin()
  }, [user])

  /* ── card metriche base ─────────────────────────────────────────────────── */
  const cards = stats ? [
    {
      label: 'Prenotazioni oggi', value: stats.prenOggi, href: '/prenotazioni',
      icon: <CalendarCheck className="w-5 h-5 text-[#1D9E75]" />,
      t: trend(stats.prenOggi, stats.prenIeri), tLabel: 'vs ieri',
    },
    {
      label: 'Clienti registrati', value: stats.clienti, href: '/clienti',
      icon: <Users className="w-5 h-5 text-blue-500" />, t: null, tLabel: '',
    },
    {
      label: 'Revenue questo mese', value: formatEuro(stats.revMese), href: '/revenue',
      icon: <Euro className="w-5 h-5 text-purple-500" />,
      t: trend(stats.revMese, stats.revMesePre), tLabel: 'vs mese scorso',
    },
    {
      label: 'Notifiche non lette', value: stats.nonLette, href: '/notifiche',
      icon: <Bell className="w-5 h-5 text-orange-500" />, t: null, tLabel: '',
    },
  ] : []

  const oggi = new Date().toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
  const admin = isAdmin(user)

  return (
    <div className="p-6 space-y-5">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">Dashboard</h1>
        <p className="text-sm text-gray-500 mt-0.5 capitalize">{oggi}</p>
      </div>

      {/* 4 Metric Cards */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        {stats === null
          ? [...Array(4)].map((_, i) => (
              <div key={i} className="bg-white rounded-xl shadow-sm border border-gray-200 p-5 animate-pulse">
                <div className="h-4 bg-gray-100 rounded w-2/3 mb-3" /><div className="h-7 bg-gray-100 rounded w-1/2" />
              </div>
            ))
          : cards.map((c) => (
              <Link key={c.label} href={c.href}
                className="block bg-white rounded-xl shadow-sm border border-gray-200 p-5 hover:border-[#1D9E75] hover:shadow-md transition-all group cursor-pointer">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-sm text-gray-500 group-hover:text-gray-700 transition">{c.label}</p>
                  <div className="w-9 h-9 rounded-lg bg-gray-50 flex items-center justify-center group-hover:bg-[#1D9E75]/10 transition">{c.icon}</div>
                </div>
                <p className="text-2xl font-bold text-gray-900">{c.value}</p>
                {c.t !== null && (
                  <div className={`flex items-center gap-1 mt-1.5 text-xs font-medium ${c.t.up ? 'text-green-600' : 'text-red-500'}`}>
                    {c.t.up ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
                    <span>{c.t.up ? '+' : ''}{c.t.pct}% {c.tLabel}</span>
                  </div>
                )}
              </Link>
            ))}
      </div>

      {/* ── SEZIONE ADMIN ─────────────────────────────────────────────────────── */}
      {admin && (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-semibold text-gray-900">Vista proprietario</h2>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#1D9E75]/10 text-[#1D9E75] font-semibold">ADMIN</span>
          </div>

          {adminLoading ? (
            <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
              {[...Array(8)].map((_, i) => (
                <div key={i} className="bg-white rounded-xl border border-gray-200 p-4 animate-pulse">
                  <div className="h-3 bg-gray-100 rounded w-2/3 mb-2" /><div className="h-6 bg-gray-100 rounded w-1/2" />
                </div>
              ))}
            </div>
          ) : adminStats && (
            <>
              <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
                {/* Revenue oggi */}
                <Link href="/revenue" className="bg-white rounded-xl border border-gray-200 p-4 hover:border-[#1D9E75] hover:shadow-sm transition group">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xs text-gray-500">Revenue oggi</p>
                    <Euro className="w-4 h-4 text-purple-400 group-hover:text-[#1D9E75] transition" />
                  </div>
                  <p className="text-xl font-bold text-gray-900">{formatEuro(adminStats.revOggi)}</p>
                  <p className="text-[10px] text-gray-400 mt-1">giornata in corso</p>
                </Link>

                {/* Revenue settimana */}
                <Link href="/revenue" className="bg-white rounded-xl border border-gray-200 p-4 hover:border-[#1D9E75] hover:shadow-sm transition group">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xs text-gray-500">Revenue settimana</p>
                    <TrendingUp className="w-4 h-4 text-green-400 group-hover:text-[#1D9E75] transition" />
                  </div>
                  <p className="text-xl font-bold text-gray-900">{formatEuro(adminStats.revSettimana)}</p>
                  <p className="text-[10px] text-gray-400 mt-1">ultimi 7 giorni</p>
                </Link>

                {/* Top sede */}
                <Link href="/revenue" className="bg-white rounded-xl border border-gray-200 p-4 hover:border-[#1D9E75] hover:shadow-sm transition group">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xs text-gray-500">Top sede settimana</p>
                    <MapPin className="w-4 h-4 text-orange-400 group-hover:text-[#1D9E75] transition" />
                  </div>
                  <p className="text-sm font-bold text-gray-900 truncate">{adminStats.topSede.replace('Scogliera di ', '')}</p>
                  <p className="text-[10px] text-gray-400 mt-1">{formatEuro(adminStats.topSedeRev)}</p>
                </Link>

                {/* VIP più attivo */}
                <Link href="/clienti" className="bg-white rounded-xl border border-gray-200 p-4 hover:border-[#1D9E75] hover:shadow-sm transition group">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xs text-gray-500">VIP più attivo</p>
                    <Star className="w-4 h-4 text-yellow-400 group-hover:text-[#1D9E75] transition" />
                  </div>
                  <p className="text-sm font-bold text-gray-900 truncate">{adminStats.clienteVip === '—' ? 'Nessun dato' : adminStats.clienteVip}</p>
                  <p className="text-[10px] text-gray-400 mt-1">
                    {adminStats.clienteVipVisite > 0 ? `${adminStats.clienteVipVisite} visite questa settimana` : 'nessuna visita in settimana'}
                  </p>
                </Link>

                {/* % tavoli occupati */}
                <Link href="/tavoli" className="bg-white rounded-xl border border-gray-200 p-4 hover:border-[#1D9E75] hover:shadow-sm transition group">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xs text-gray-500">Tavoli occupati ora</p>
                    <LayoutGrid className="w-4 h-4 text-blue-400 group-hover:text-[#1D9E75] transition" />
                  </div>
                  {adminStats.tavoliTotali === 0 ? (
                    <p className="text-sm text-gray-400">Nessun tavolo configurato</p>
                  ) : (
                    <>
                      <p className="text-xl font-bold text-gray-900">
                        {Math.round((adminStats.tavoliOccupati / adminStats.tavoliTotali) * 100)}%
                      </p>
                      <p className="text-[10px] text-gray-400 mt-1">
                        {adminStats.tavoliOccupati}/{adminStats.tavoliTotali} tavoli
                      </p>
                    </>
                  )}
                </Link>

                {/* Prossimo compleanno */}
                <div className="bg-white rounded-xl border border-gray-200 p-4">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xs text-gray-500">Prossimo compleanno VIP</p>
                    <Cake className="w-4 h-4 text-pink-400" />
                  </div>
                  {adminStats.prossimoCompleanno ? (
                    <>
                      <p className="text-sm font-bold text-gray-900 truncate">{adminStats.prossimoCompleanno.nome}</p>
                      <p className="text-[10px] mt-1">
                        <span className={`font-semibold ${adminStats.prossimoCompleanno.giorniAl <= 3 ? 'text-pink-500' : 'text-gray-500'}`}>
                          {adminStats.prossimoCompleanno.giorniAl === 0
                            ? '🎂 Oggi!'
                            : adminStats.prossimoCompleanno.giorniAl === 1
                              ? 'Domani!'
                              : `tra ${adminStats.prossimoCompleanno.giorniAl} giorni`}
                        </span>
                        <span className="text-gray-400"> · {adminStats.prossimoCompleanno.tier}</span>
                      </p>
                    </>
                  ) : (
                    <p className="text-sm text-gray-400">Nessun dato</p>
                  )}
                </div>

                {/* Alert scorte */}
                <Link href="/economato"
                  className={`rounded-xl border p-4 hover:shadow-sm transition group ${adminStats.alertScorte > 0 ? 'bg-amber-50 border-amber-200 hover:border-amber-400' : 'bg-white border-gray-200 hover:border-[#1D9E75]'}`}>
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xs text-gray-500">Alert scorte</p>
                    <AlertTriangle className={`w-4 h-4 ${adminStats.alertScorte > 0 ? 'text-amber-500' : 'text-gray-300'}`} />
                  </div>
                  <p className={`text-xl font-bold ${adminStats.alertScorte > 0 ? 'text-amber-700' : 'text-gray-900'}`}>
                    {adminStats.alertScorte}
                  </p>
                  <p className="text-[10px] text-gray-400 mt-1">
                    {adminStats.alertScorte > 0 ? 'prodotti sotto scorta minima' : 'scorte nella norma'}
                  </p>
                </Link>

                {/* Placeholder per simmetria griglia */}
                <div className="hidden xl:block" />
              </div>
            </>
          )}
        </div>
      )}

      {/* 2-column grid */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        {/* Prenotazioni oggi */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="flex items-center justify-between px-5 py-3.5 border-b border-gray-100">
            <h2 className="text-sm font-semibold text-gray-900">Prenotazioni di oggi</h2>
            <a href="/prenotazioni" className="text-xs text-[#1D9E75] hover:underline font-medium">Vedi tutte →</a>
          </div>
          {prenotazioni.length === 0 && stats !== null ? (
            <p className="text-center text-gray-400 text-sm py-8">Nessuna prenotazione oggi</p>
          ) : (
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  {['Ora', 'Ospite', 'Cop.', 'Stato'].map(h => (
                    <th key={h} className="text-left px-4 py-2.5 text-[10px] uppercase tracking-wide font-medium text-gray-500">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {prenotazioni.map((p) => (
                  <tr key={p.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 font-semibold text-gray-900 whitespace-nowrap">{p.ora_arrivo?.slice(0, 5)}</td>
                    <td className="px-4 py-3">
                      <p className="font-medium text-gray-800">{p.nome_ospite}</p>
                      {p.allergie_comunicare && <p className="text-[10px] text-red-500">⚠️ {p.allergie_comunicare}</p>}
                    </td>
                    <td className="px-4 py-3 text-gray-600">{p.coperti}{p.con_animale ? ' 🐕' : ''}</td>
                    <td className="px-4 py-3">
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${STATO_COLORS[p.stato] ?? 'bg-gray-100 text-gray-600'}`}>
                        {STATO_LABEL[p.stato] ?? p.stato}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Notifiche non lette */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="flex items-center justify-between px-5 py-3.5 border-b border-gray-100">
            <h2 className="text-sm font-semibold text-gray-900">Notifiche non lette</h2>
            <a href="/notifiche" className="text-xs text-[#1D9E75] hover:underline font-medium">Vedi tutte →</a>
          </div>
          {notifiche.length === 0 && stats !== null ? (
            <p className="text-center text-gray-400 text-sm py-8">Nessuna notifica non letta</p>
          ) : (
            <div className="divide-y divide-gray-50">
              {notifiche.map((n) => (
                <div key={n.id} className="flex gap-3 px-5 py-3 hover:bg-gray-50 transition-colors">
                  <span className="text-sm mt-0.5 shrink-0">{TIPO_ICON[n.tipo] ?? '🔔'}</span>
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-gray-800 truncate">{n.titolo}</p>
                    <p className="text-[11px] text-gray-400 mt-0.5 line-clamp-2">{n.messaggio}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
