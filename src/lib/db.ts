import Dexie, { type Table } from 'dexie'

export interface PrenotazioneOffline {
  id?: number
  sync_id?: string
  cliente_id: string
  sede_id: string
  data: string
  ora: string
  persone: number
  animali: number
  stato: string
  note?: string
  tavolo?: string
  created_at: Date
  synced: boolean
}

export interface ComandaOffline {
  id?: number
  sync_id?: string
  sede_id: string
  tavolo: string
  stato: string
  totale: number
  note?: string
  created_at: Date
  synced: boolean
}

export interface CacheCliente {
  id: string
  nome: string
  cognome: string
  email?: string
  telefono?: string
  vip: boolean
  visite_totali: number
  cached_at: Date
}

export interface CacheMenu {
  id: string
  sede_id: string
  nome: string
  descrizione?: string
  prezzo: number
  categoria: string
  disponibile: boolean
  adatto_cani: boolean
  cached_at: Date
}

class GestionaleDB extends Dexie {
  prenotazioni_offline!: Table<PrenotazioneOffline>
  comande_offline!: Table<ComandaOffline>
  cache_clienti!: Table<CacheCliente>
  cache_menu!: Table<CacheMenu>

  constructor() {
    super('gestionale_ristoranti')
    this.version(1).stores({
      prenotazioni_offline: '++id, sync_id, sede_id, data, synced',
      comande_offline: '++id, sync_id, sede_id, tavolo, synced',
      cache_clienti: 'id, nome, cognome, vip',
      cache_menu: 'id, sede_id, categoria, disponibile',
    })
  }
}

export const db = typeof window !== 'undefined' ? new GestionaleDB() : null as unknown as GestionaleDB
