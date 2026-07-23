'use client'

import { useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase'
import type { RealtimePostgresChangesPayload } from '@supabase/supabase-js'

type Row = Record<string, unknown>
type ChangeEvent = 'INSERT' | 'UPDATE' | 'DELETE' | '*'
type ChangeHandler = (payload: RealtimePostgresChangesPayload<Row>) => void

/**
 * Sottoscrive un canale Supabase Realtime su una tabella e richiama `onChange`
 * ad ogni evento. Richiede che la tabella sia aggiunta alla publication
 * `supabase_realtime` (vedi supabase/migrations/20260723_enable_realtime.sql).
 */
export function useRealtimeTable(
  channelName: string,
  table: string,
  onChange: ChangeHandler,
  opts?: { event?: ChangeEvent; filter?: string }
) {
  const handlerRef = useRef(onChange)
  useEffect(() => { handlerRef.current = onChange })

  const event = opts?.event ?? '*'
  const filter = opts?.filter

  useEffect(() => {
    const supabase = createClient()
    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        { event, schema: 'public', table, ...(filter ? { filter } : {}) },
        (payload: RealtimePostgresChangesPayload<Row>) => handlerRef.current(payload)
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [channelName, table, event, filter])
}
