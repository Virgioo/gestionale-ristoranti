'use client'

import { useEffect, useState } from 'react'
import { queryDB, updateDB } from '@/lib/api'
import { useAppStore } from '@/store'
import { formatDateTime } from '@/lib/utils'
import toast from 'react-hot-toast'

interface NotificaRow {
  id: string; tipo: string; titolo: string; messaggio: string
  letta: boolean; created_at: string
}

const TIPO_ICONS: Record<string, string> = {
  prenotazione: '📅',
  allergia: '⚠️',
  rischio_abbandono: '🔴',
  compleanno: '🎂',
  anniversario: '🎉',
  vip_inattivo: '💤',
  qr_nuovo: '📲',
}

export default function NotifichePage() {
  const [notifiche, setNotifiche] = useState<NotificaRow[]>([])
  const [loading, setLoading] = useState(true)
  const [soloNonLette, setSoloNonLette] = useState(false)
  const { setUnreadCount } = useAppStore()

  useEffect(() => {
    load()
  }, [soloNonLette])

  async function load() {
    setLoading(true)
    const filters: { fn: string; args: unknown[] }[] = []
    if (soloNonLette) filters.push({ fn: 'eq', args: ['letta', false] })
    const data = await queryDB<NotificaRow>('notifiche', {
      filters,
      order: { col: 'created_at', asc: false },
      limit: 50,
    })
    setNotifiche(data)
    setLoading(false)
  }

  async function segnaLetta(id: string) {
    await updateDB('notifiche', { letta: true }, { id })
    setNotifiche(prev => prev.map(n => n.id === id ? { ...n, letta: true } : n))
    const nonLette = notifiche.filter(n => !n.letta && n.id !== id).length
    setUnreadCount(nonLette)
  }

  async function segnaLettaTutte() {
    await updateDB('notifiche', { letta: true }, { letta: false })
    setNotifiche(prev => prev.map(n => ({ ...n, letta: true })))
    setUnreadCount(0)
    toast.success('Tutte le notifiche segnate come lette')
  }

  const nonLette = notifiche.filter(n => !n.letta).length

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Notifiche</h1>
          <p className="text-slate-500 text-sm">{nonLette} non lette</p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => setSoloNonLette(!soloNonLette)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition ${soloNonLette ? 'bg-orange-500 text-white border-orange-500' : 'bg-white text-slate-600 border-slate-300 hover:border-orange-300'}`}
          >
            Solo non lette
          </button>
          {nonLette > 0 && (
            <button onClick={segnaLettaTutte} className="px-3 py-1.5 rounded-lg text-xs font-medium text-orange-500 hover:underline">
              Segna tutte come lette
            </button>
          )}
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        {loading ? (
          <div className="divide-y divide-slate-50">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="px-5 py-4">
                <div className="h-4 bg-slate-200 rounded animate-pulse w-3/4 mb-2" />
                <div className="h-3 bg-slate-100 rounded animate-pulse w-1/2" />
              </div>
            ))}
          </div>
        ) : notifiche.length === 0 ? (
          <div className="px-5 py-12 text-center text-slate-400">
            <p className="text-4xl mb-3">🔔</p>
            <p>Nessuna notifica</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-50">
            {notifiche.map(n => (
              <div
                key={n.id}
                className={`px-5 py-4 flex items-start gap-4 transition ${!n.letta ? 'bg-orange-50/50' : 'hover:bg-slate-50'}`}
              >
                <span className="text-2xl shrink-0 mt-0.5">{TIPO_ICONS[n.tipo] ?? '🔔'}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className={`text-sm ${!n.letta ? 'font-semibold text-slate-900' : 'font-medium text-slate-700'}`}>
                        {n.titolo}
                        {!n.letta && <span className="ml-2 inline-block w-2 h-2 bg-orange-500 rounded-full" />}
                      </p>
                      <p className="text-sm text-slate-500 mt-0.5">{n.messaggio}</p>
                    </div>
                    <p className="text-xs text-slate-400 shrink-0">{formatDateTime(n.created_at)}</p>
                  </div>
                  {!n.letta && (
                    <button
                      onClick={() => segnaLetta(n.id)}
                      className="mt-2 text-xs text-orange-500 hover:underline"
                    >
                      Segna come letta
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
