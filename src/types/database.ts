export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

// ── Row shapes ──────────────────────────────────────────────────────────────
interface SedeRow {
  id: string; nome: string; indirizzo: string; citta: string
  telefono: string | null; email: string | null
  coperti_totali?: number; capienza?: number
  attiva: boolean; created_at: string
}
interface ClienteRow {
  id: string; nome: string; cognome: string; email: string | null
  telefono: string | null; data_nascita: string | null; note: string | null
  vip: boolean; allergie: string[] | null; preferenze: string | null
  visite_totali: number; ultimo_accesso: string | null; sede_id: string | null; created_at: string
}
interface AnimaleRow {
  id: string; cliente_id: string; nome: string; razza: string | null
  taglia: 'piccola' | 'media' | 'grande'; note: string | null; created_at: string
}
interface VisitaRow {
  id: string; cliente_id: string; sede_id: string; data: string
  persone: number; animali: number; spesa_totale: number; note: string | null; created_at: string
}
interface PrenotazioneRow {
  id: string; cliente_id: string | null; sede_id: string; data: string; ora: string
  persone: number; animali: number
  stato: 'confermata' | 'in_attesa' | 'cancellata' | 'completata' | 'no_show'
  note: string | null; tavolo: string | null; created_at: string
}
interface ComandaRow {
  id: string; sede_id: string; prenotazione_id: string | null; tavolo: string
  stato: 'aperta' | 'in_preparazione' | 'pronta' | 'servita' | 'pagata'
  totale: number; note: string | null; created_at: string; updated_at: string
}
interface RigaComandaRow {
  id: string; comanda_id: string; menu_item_id: string; quantita: number
  prezzo_unitario: number; note: string | null; created_at: string
}
interface StaffRow {
  id: string; sede_id: string; nome: string; cognome: string
  ruolo: 'manager' | 'cameriere' | 'cuoco' | 'receptionist' | 'barista'
  email: string; telefono: string | null; attivo: boolean; created_at: string
}
interface TurnoRow {
  id: string; staff_id: string; sede_id: string; data: string
  ora_inizio: string; ora_fine: string; tipo: 'pranzo' | 'cena' | 'full'
  note: string | null; created_at: string
}
interface CampagnaRow {
  id: string; sede_id: string; nome: string; tipo: 'email' | 'sms' | 'push' | 'social'
  stato: 'bozza' | 'programmata' | 'inviata' | 'completata'; messaggio: string
  data_invio: string | null; destinatari: number; aperture: number; click: number; created_at: string
}
interface NotaRow {
  id: string; cliente_id: string; staff_id: string | null; testo: string; created_at: string
}
interface NotificaRow {
  id: string; sede_id: string
  tipo: 'prenotazione' | 'comanda' | 'alert' | 'sistema' | 'marketing'
  titolo: string; messaggio: string; letta: boolean; link: string | null; created_at: string
}
interface EventoRow {
  id: string; sede_id: string; nome: string; descrizione: string | null
  data_inizio: string; data_fine: string; capienza_max: number; prezzo: number | null
  stato: 'programmato' | 'attivo' | 'cancellato' | 'completato'; created_at: string
}
interface MenuItemRow {
  id: string; sede_id: string; nome: string; descrizione: string | null
  prezzo: number; categoria: string; disponibile: boolean; allergeni: string[] | null
  adatto_cani: boolean; immagine_url: string | null; created_at: string
}

// ── Database schema ──────────────────────────────────────────────────────────
export interface Database {
  public: {
    Tables: {
      sedi: { Row: SedeRow; Insert: Omit<SedeRow, 'id' | 'created_at'>; Update: Partial<SedeRow>; Relationships: [] }
      clienti: { Row: ClienteRow; Insert: Omit<ClienteRow, 'id' | 'created_at' | 'visite_totali'>; Update: Partial<ClienteRow>; Relationships: [] }
      animali: { Row: AnimaleRow; Insert: Omit<AnimaleRow, 'id' | 'created_at'>; Update: Partial<AnimaleRow>; Relationships: [] }
      visite: { Row: VisitaRow; Insert: Omit<VisitaRow, 'id' | 'created_at'>; Update: Partial<VisitaRow>; Relationships: [] }
      prenotazioni: { Row: PrenotazioneRow; Insert: Omit<PrenotazioneRow, 'id' | 'created_at'>; Update: Partial<PrenotazioneRow>; Relationships: [] }
      comande: { Row: ComandaRow; Insert: Omit<ComandaRow, 'id' | 'created_at' | 'updated_at'>; Update: Partial<ComandaRow>; Relationships: [] }
      righe_comanda: { Row: RigaComandaRow; Insert: Omit<RigaComandaRow, 'id' | 'created_at'>; Update: Partial<RigaComandaRow>; Relationships: [] }
      staff: { Row: StaffRow; Insert: Omit<StaffRow, 'id' | 'created_at'>; Update: Partial<StaffRow>; Relationships: [] }
      turni: { Row: TurnoRow; Insert: Omit<TurnoRow, 'id' | 'created_at'>; Update: Partial<TurnoRow>; Relationships: [] }
      campagne: { Row: CampagnaRow; Insert: Omit<CampagnaRow, 'id' | 'created_at'>; Update: Partial<CampagnaRow>; Relationships: [] }
      note: { Row: NotaRow; Insert: Omit<NotaRow, 'id' | 'created_at'>; Update: Partial<NotaRow>; Relationships: [] }
      notifiche: { Row: NotificaRow; Insert: Omit<NotificaRow, 'id' | 'created_at'>; Update: Partial<NotificaRow>; Relationships: [] }
      eventi: { Row: EventoRow; Insert: Omit<EventoRow, 'id' | 'created_at'>; Update: Partial<EventoRow>; Relationships: [] }
      menu: { Row: MenuItemRow; Insert: Omit<MenuItemRow, 'id' | 'created_at'>; Update: Partial<MenuItemRow>; Relationships: [] }
    }
    Views: Record<string, never>
    Functions: Record<string, never>
    Enums: Record<string, never>
  }
}

// Convenience exports
export type Sede = SedeRow
export type Cliente = ClienteRow
export type Animale = AnimaleRow
export type Visita = VisitaRow
export type Prenotazione = PrenotazioneRow
export type Comanda = ComandaRow
export type RigaComanda = RigaComandaRow
export type StaffMember = StaffRow
export type Turno = TurnoRow
export type Campagna = CampagnaRow
export type Nota = NotaRow
export type Notifica = NotificaRow
export type Evento = EventoRow
export type MenuItem = MenuItemRow
