import Dexie, { type Table } from 'dexie'

export interface RigaLocal {
  piatto_id: string
  piatto_nome: string
  categoria: string
  prezzo: number
  quantita: number
  note: string
}

export interface ComandaLocal {
  id: string               // UUID generato client-side
  tavolo_id: string | null
  tavolo_nome: string
  cameriere: string | null
  stato: 'bozza' | 'inviata' | 'sincronizzata'
  note: string | null
  totale: number
  righe: RigaLocal[]       // stored inline as JSON
  created_at: string       // ISO string
  sincronizzata: number    // 0=false, 1=true (IndexedDB non supporta boolean come indice)
}

class ComandeDatabase extends Dexie {
  comande!: Table<ComandaLocal, string>

  constructor() {
    super('gestionale-comande')
    this.version(1).stores({
      comande: 'id, stato, sincronizzata, created_at',
    })
  }
}

let _instance: ComandeDatabase | null = null

export function getDB(): ComandeDatabase {
  if (typeof window === 'undefined') throw new Error('Dexie solo client-side')
  if (!_instance) _instance = new ComandeDatabase()
  return _instance
}

export function generateId(): string {
  return crypto.randomUUID()
}
