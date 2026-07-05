import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const envRaw = readFileSync(join(__dirname, '..', '.env.local'), 'utf-8')
const env = Object.fromEntries(
  envRaw.split('\n').filter(l => l.includes('=')).map(l => {
    const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]
  })
)

const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY)

const TODAY = '2026-06-29' // data fissa

function ok(label, n) { console.log(`  ✓ ${label}: ${n} record`) }

async function cleanup() {
  console.log('Pulizia tabelle...')
  const tables = ['notifiche','note','campagne','visite','prenotazioni','animali','clienti','sedi']
  for (const t of tables) {
    const { error } = await supabase.from(t).delete().neq('id', '00000000-0000-0000-0000-000000000000')
    if (error) console.error(`  WARN cleanup ${t}:`, error.message)
    else console.log(`  cleared ${t}`)
  }
}

async function main() {
  console.log('\n=== Seed Scogliera Group — ' + TODAY + ' ===\n')
  await cleanup()
  console.log()

  // ── 1. SEDI ────────────────────────────────────────────────────────────────
  console.log('Sedi...')
  const { data: sedi, error: sediErr } = await supabase.from('sedi').insert([
    { nome: 'Scogliera di Rimini',           tipo: 'Mare',     indirizzo: 'Viale Principe di Piemonte 15', citta: 'Rimini',            cap: '47921', telefono: '+39 0541 221890', email: 'rimini@scoglieragroup.it',    orari_pranzo: '12:30-15:00', orari_cena: '19:30-23:00', coperti_totali: 80, posti_prive: 12, pet_friendly: true,  colore_hex: '#f97316', attiva: true },
    { nome: 'Scogliera di Riccione',         tipo: 'Mare',     indirizzo: 'Viale Ceccarini 22',           citta: 'Riccione',          cap: '47838', telefono: '+39 0541 221891', email: 'riccione@scoglieragroup.it',  orari_pranzo: '12:00-15:30', orari_cena: '19:00-23:30', coperti_totali: 50, posti_prive:  8, pet_friendly: true,  colore_hex: '#3b82f6', attiva: true },
    { nome: 'Scogliera di Cattolica',        tipo: 'Mare',     indirizzo: 'Piazza 1 Maggio 8',            citta: 'Cattolica',         cap: '47841', telefono: '+39 0541 221892', email: 'cattolica@scoglieragroup.it', orari_pranzo: '12:30-15:00', orari_cena: '20:00-23:00', coperti_totali: 65, posti_prive: 10, pet_friendly: true,  colore_hex: '#10b981', attiva: true },
    { nome: 'Scogliera di Pesaro',           tipo: 'Mare',     indirizzo: 'Viale Trieste 44',             citta: 'Pesaro',            cap: '61121', telefono: '+39 0721 221893', email: 'pesaro@scoglieragroup.it',    orari_pranzo: '12:30-14:30', orari_cena: '20:00-22:30', coperti_totali: 45, posti_prive:  6, pet_friendly: false, colore_hex: '#8b5cf6', attiva: true },
    { nome: "Scogliera di Cortina d'Ampezzo", tipo: 'Montagna', indirizzo: 'Corso Italia 112',            citta: "Cortina d'Ampezzo", cap: '32043', telefono: '+39 0436 221894', email: 'cortina@scoglieragroup.it',   orari_pranzo: '12:00-15:00', orari_cena: '19:30-23:30', coperti_totali: 70, posti_prive: 14, pet_friendly: true,  colore_hex: '#ec4899', attiva: true },
  ]).select('id, nome')
  if (sediErr) { console.error('ERRORE sedi:', sediErr.message); process.exit(1) }
  ok('sedi', sedi.length)
  const [s1, s2, s3, s4, s5] = sedi.map(s => s.id)

  // ── 2. CLIENTI VIP ────────────────────────────────────────────────────────
  console.log('\nClienti VIP...')
  const { data: clienti, error: clientiErr } = await supabase.from('clienti').insert([
    { nome: 'Marco',      cognome: 'Ferretti',  email: 'marco.ferretti@gmail.com',       telefono: '+39 335 1234567', whatsapp_attivo: true,  sede_principale_id: s1, tier: 'Platinum', preferenze_tavolo: 'terrazza', allergie: null,       bevande_preferite: 'Sangiovese, Champagne',               data_nascita: '1975-03-14', ultima_visita: '2026-06-12', visite_totali: 48, spesa_totale: 8640.00,  scontrino_medio: 180.00, fonte_acquisizione: 'passaparola', note_interne: 'Cliente storico. Porta labrador Briciola.',         attivo: true, a_rischio: false },
    { nome: 'Valentina',  cognome: 'Esposito',  email: 'v.esposito@libero.it',           telefono: '+39 347 9876543', whatsapp_attivo: true,  sede_principale_id: s1, tier: 'Diamante', preferenze_tavolo: 'prive',    allergie: 'glutine',  bevande_preferite: 'Prosecco, Acqua naturale',            data_nascita: '1982-07-22', ultima_visita: '2026-06-25', visite_totali: 94, spesa_totale: 24180.00, scontrino_medio: 257.00, fonte_acquisizione: 'social',      note_interne: 'CELIACA ACCERTATA. Festeggia anniversario da noi.',    attivo: true, a_rischio: false },
    { nome: 'Alessandro', cognome: 'Conti',     email: 'alex.conti@hotmail.com',         telefono: '+39 366 5557891', whatsapp_attivo: false, sede_principale_id: s3, tier: 'Gold',     preferenze_tavolo: 'esterno',  allergie: null,       bevande_preferite: 'Verdicchio, Birra artigianale',       data_nascita: '1980-11-05', ultima_visita: '2026-06-08', visite_totali: 21, spesa_totale: 3150.00,  scontrino_medio: 150.00, fonte_acquisizione: 'booking',     note_interne: 'Porta golden retriever Zeus. Estate a Cattolica.',     attivo: true, a_rischio: false },
    { nome: 'Francesca',  cognome: 'Rossi',     email: 'francesca.rossi@email.it',       telefono: '+39 349 2223344', whatsapp_attivo: true,  sede_principale_id: s2, tier: 'Gold',     preferenze_tavolo: 'sala',     allergie: 'crostacei',bevande_preferite: 'Vermentino, Pignoletto',              data_nascita: '1978-05-30', ultima_visita: '2026-06-18', visite_totali: 35, spesa_totale: 4900.00,  scontrino_medio: 140.00, fonte_acquisizione: 'passaparola', note_interne: 'ALLERGIA CROSTACEI - avvisare cucina sempre.',          attivo: true, a_rischio: false },
    { nome: 'Gianluca',   cognome: 'Bianchi',   email: 'g.bianchi@gmail.com',            telefono: '+39 338 4445566', whatsapp_attivo: true,  sede_principale_id: s1, tier: 'Platinum', preferenze_tavolo: 'terrazza', allergie: null,       bevande_preferite: 'Barolo, Negroni',                     data_nascita: '1971-09-17', ultima_visita: '2026-06-15', visite_totali: 67, spesa_totale: 15410.00, scontrino_medio: 230.00, fonte_acquisizione: 'passaparola', note_interne: 'Imprenditore. Porta barboncino Luna. Compleanno 2 lug.', attivo: true, a_rischio: false },
    { nome: 'Sofia',      cognome: 'Marini',    email: 'sofia.marini@outlook.com',       telefono: '+39 320 7778899', whatsapp_attivo: true,  sede_principale_id: s5, tier: 'Gold',     preferenze_tavolo: 'sala',     allergie: null,       bevande_preferite: 'Aperol Spritz, Pignoletto',           data_nascita: '1990-02-14', ultima_visita: '2026-06-05', visite_totali: 13, spesa_totale: 1280.00,  scontrino_medio: 98.00,  fonte_acquisizione: 'instagram',   note_interne: 'Food blogger 18k follower. Foto autorizzate.',           attivo: true, a_rischio: false },
    { nome: 'Roberto',    cognome: 'Colombo',   email: 'roberto.colombo@studiolegale.it',telefono: '+39 335 0001122', whatsapp_attivo: false, sede_principale_id: s4, tier: 'Gold',     preferenze_tavolo: 'prive',    allergie: null,       bevande_preferite: 'Amarone, Whisky Talisker',            data_nascita: '1965-12-03', ultima_visita: '2026-06-05', visite_totali: 29, spesa_totale: 6670.00,  scontrino_medio: 230.00, fonte_acquisizione: 'passaparola', note_interne: 'Avvocato. Paga in contanti. Ricevuta cartacea sempre.',  attivo: true, a_rischio: false },
    { nome: 'Elena',      cognome: 'Ricci',     email: 'elena.ricci@gmail.com',          telefono: '+39 347 3334455', whatsapp_attivo: true,  sede_principale_id: s1, tier: 'Diamante', preferenze_tavolo: 'terrazza', allergie: 'lattosio', bevande_preferite: 'Champagne Blanc de Blancs',           data_nascita: '1985-04-28', ultima_visita: '2026-06-22', visite_totali: 116, spesa_totale: 32540.00, scontrino_medio: 281.00, fonte_acquisizione: 'evento',      note_interne: 'Cliente più fedele. Porta Rex (pastore). NO LATTOSIO.', attivo: true, a_rischio: false },
    { nome: 'Davide',     cognome: 'Greco',     email: 'davide.greco@tin.it',            telefono: '+39 329 6667788', whatsapp_attivo: false, sede_principale_id: s2, tier: 'Gold',     preferenze_tavolo: 'sala',     allergie: null,       bevande_preferite: 'Birra, Coca-Cola',                    data_nascita: '1995-08-11', ultima_visita: '2026-03-10', visite_totali:  5, spesa_totale:  340.00,  scontrino_medio:  68.00, fonte_acquisizione: 'google',      note_interne: 'Inattivo 111 gg. In fase di fidelizzazione.',           attivo: true, a_rischio: true  },
    { nome: 'Chiara',     cognome: 'Lombardi',  email: 'chiara.lombardi@gmail.com',      telefono: '+39 333 9990011', whatsapp_attivo: true,  sede_principale_id: s3, tier: 'Gold',     preferenze_tavolo: 'esterno',  allergie: null,       bevande_preferite: 'Rose di Provence, Pignoletto',        data_nascita: '1987-06-19', ultima_visita: '2026-06-15', visite_totali: 18, spesa_totale: 2340.00,  scontrino_medio: 130.00, fonte_acquisizione: 'tripadvisor', note_interne: 'Frequenta Cattolica con gruppo amiche.',                 attivo: true, a_rischio: false },
    { nome: 'Antonio',    cognome: 'De Luca',   email: 'antonio.deluca@mediaset.it',     telefono: '+39 348 1112233', whatsapp_attivo: true,  sede_principale_id: s1, tier: 'Platinum', preferenze_tavolo: 'prive',    allergie: null,       bevande_preferite: 'Sassicaia, Gin Tonic',                data_nascita: '1969-01-08', ultima_visita: '2026-06-20', visite_totali: 55, spesa_totale: 14850.00, scontrino_medio: 270.00, fonte_acquisizione: 'evento',      note_interne: 'Giornalista TV. Ospiti VIP. Discrezione assoluta.',     attivo: true, a_rischio: false },
    { nome: 'Isabella',   cognome: 'Gallo',     email: 'isa.gallo@yahoo.it',             telefono: '+39 393 4445566', whatsapp_attivo: true,  sede_principale_id: s5, tier: 'Gold',     preferenze_tavolo: 'esterno',  allergie: 'noci',     bevande_preferite: 'Prosecco, Grappa di Cortina',         data_nascita: '1992-10-25', ultima_visita: '2026-06-05', visite_totali:  9, spesa_totale: 1080.00,  scontrino_medio: 120.00, fonte_acquisizione: 'facebook',    note_interne: 'ALLERGIA NOCI. Porta beagle Stella.',                   attivo: true, a_rischio: false },
  ]).select('id')
  if (clientiErr) { console.error('ERRORE clienti:', clientiErr.message); process.exit(1) }
  ok('clienti VIP', clienti.length)
  const [c1,c2,c3,c4,c5,c6,c7,c8,c9,c10,c11,c12] = clienti.map(c => c.id)

  // ── 3. ANIMALI ────────────────────────────────────────────────────────────
  console.log('\nAnimali...')
  const { data: animali, error: animaliErr } = await supabase.from('animali').insert([
    { cliente_id: c1,  nome: 'Briciola', razza: 'Labrador Retriever', genere: 'F', eta_anni: 4, allergie: null,   piatti_preferiti: 'Pollo bollito, Riso in bianco',    note_staff: 'Calma, sta sotto il tavolo. Ciotola piccola.',               attivo: true },
    { cliente_id: c3,  nome: 'Zeus',     razza: 'Golden Retriever',   genere: 'M', eta_anni: 6, allergie: null,   piatti_preferiti: 'Manzo magro bollito, Verdure cotte',note_staff: 'Taglia grande. Porta tappetino. Ciotola grande.',             attivo: true },
    { cliente_id: c5,  nome: 'Luna',     razza: 'Barboncino Toy',     genere: 'F', eta_anni: 3, allergie: 'pollo',piatti_preferiti: 'Merluzzo al vapore, Carote',        note_staff: 'ATTENZIONE allergia al pollo! Piccola, sta in braccio.',      attivo: true },
    { cliente_id: c8,  nome: 'Rex',      razza: 'Pastore Tedesco',    genere: 'M', eta_anni: 5, allergie: null,   piatti_preferiti: 'Manzo bollito, Riso bianco',        note_staff: 'Taglia grande ma educatissimo. Angolo ringhiera terrazza.',  attivo: true },
    { cliente_id: c12, nome: 'Stella',   razza: 'Beagle',             genere: 'F', eta_anni: 2, allergie: 'noci', piatti_preferiti: 'Pollo, Zucchine bollite',           note_staff: 'ATTENZIONE allergia noci come proprietaria. Vivace.',        attivo: true },
  ]).select('id')
  if (animaliErr) console.error('ERRORE animali:', animaliErr.message)
  else ok('animali', animali.length)
  const [a1,a2,a3,a4,a5] = (animali ?? []).map(a => a.id)

  // ── 4. PRENOTAZIONI ───────────────────────────────────────────────────────
  // 7 prenotazioni per OGGI (2026-06-29) + prenotazioni storiche completate
  console.log('\nPrenotazioni...')
  const { data: pren, error: prenErr } = await supabase.from('prenotazioni').insert([
    // ── OGGI 2026-06-29 ─ 7 prenotazioni ──
    { sede_id: s1, cliente_id: c8,  nome_ospite: 'Elena Ricci',        telefono_ospite: '+39 347 3334455', data_prenotazione: TODAY, ora_arrivo: '12:30', coperti: 2, tipo_tavolo: 'terrazza', stato: 'confermata',  note_speciali: 'Pranzo estivo. Rex viene.',                allergie_comunicare: 'lattosio',   con_animale: true,  animale_id: a4, origine: 'whatsapp' },
    { sede_id: s1, cliente_id: c1,  nome_ospite: 'Marco Ferretti',     telefono_ospite: '+39 335 1234567', data_prenotazione: TODAY, ora_arrivo: '20:00', coperti: 4, tipo_tavolo: 'terrazza', stato: 'confermata',  note_speciali: 'Cena con soci. Briciola col solito posto.',                                    con_animale: true,  animale_id: a1, origine: 'telefono' },
    { sede_id: s1, cliente_id: c11, nome_ospite: 'Antonio De Luca',    telefono_ospite: '+39 348 1112233', data_prenotazione: TODAY, ora_arrivo: '20:30', coperti: 5, tipo_tavolo: 'prive',    stato: 'confermata',  note_speciali: 'Ospiti importanti. Prive principale.',                                         con_animale: false,                  origine: 'telefono' },
    { sede_id: s1, cliente_id: c2,  nome_ospite: 'Valentina Esposito', telefono_ospite: '+39 347 9876543', data_prenotazione: TODAY, ora_arrivo: '21:00', coperti: 2, tipo_tavolo: 'prive',    stato: 'confermata',  note_speciali: 'Menu gluten-free completo.',               allergie_comunicare: 'glutine',     con_animale: false,                  origine: 'whatsapp' },
    { sede_id: s2, cliente_id: c4,  nome_ospite: 'Francesca Rossi',    telefono_ospite: '+39 349 2223344', data_prenotazione: TODAY, ora_arrivo: '13:00', coperti: 3, tipo_tavolo: 'sala',     stato: 'confermata',  note_speciali: 'Pranzo business. NO crostacei.',           allergie_comunicare: 'crostacei',   con_animale: false,                  origine: 'app' },
    { sede_id: s3, cliente_id: c10, nome_ospite: 'Chiara Lombardi',    telefono_ospite: '+39 333 9990011', data_prenotazione: TODAY, ora_arrivo: '20:30', coperti: 4, tipo_tavolo: 'esterno',  stato: 'in_attesa',   note_speciali: 'Gruppo amiche. Attesa conferma.',                                              con_animale: false,                  origine: 'tripadvisor' },
    { sede_id: s4, cliente_id: c7,  nome_ospite: 'Roberto Colombo',    telefono_ospite: '+39 335 0001122', data_prenotazione: TODAY, ora_arrivo: '21:00', coperti: 2, tipo_tavolo: 'prive',    stato: 'confermata',  note_speciali: 'Riunione riservata. Ricevuta cartacea.',                                       con_animale: false,                  origine: 'telefono' },

    // ── DOMANI e prossimi giorni ──
    { sede_id: s1, cliente_id: c5,  nome_ospite: 'Gianluca Bianchi',   telefono_ospite: '+39 338 4445566', data_prenotazione: '2026-07-02', ora_arrivo: '20:30', coperti: 6, tipo_tavolo: 'terrazza', stato: 'confermata',  note_speciali: 'COMPLEANNO - torta con candeline.',     con_animale: true,  animale_id: a3, occasione_speciale: 'compleanno', origine: 'telefono' },
    { sede_id: s5, cliente_id: c6,  nome_ospite: 'Sofia Marini',       telefono_ospite: '+39 320 7778899', data_prenotazione: '2026-07-04', ora_arrivo: '12:30', coperti: 2, tipo_tavolo: 'esterno',  stato: 'in_attesa',   note_speciali: 'Food blogger - possibile recensione.',  con_animale: false,                  origine: 'instagram' },
    { sede_id: s1, cliente_id: c8,  nome_ospite: 'Elena Ricci',        telefono_ospite: '+39 347 3334455', data_prenotazione: '2026-07-05', ora_arrivo: '20:00', coperti: 4, tipo_tavolo: 'terrazza', stato: 'confermata',  note_speciali: 'NO lattosio. Rex viene con noi.',       allergie_comunicare: 'lattosio', con_animale: true, animale_id: a4, origine: 'whatsapp' },

    // ── STORICO GIUGNO completate ──
    { sede_id: s1, cliente_id: c2,  nome_ospite: 'Valentina Esposito', telefono_ospite: '+39 347 9876543', data_prenotazione: '2026-06-25', ora_arrivo: '20:30', coperti: 2, tipo_tavolo: 'prive',    stato: 'completata', allergie_comunicare: 'glutine',    con_animale: false, occasione_speciale: 'cena romantica', origine: 'whatsapp' },
    { sede_id: s1, cliente_id: c11, nome_ospite: 'Antonio De Luca',    telefono_ospite: '+39 348 1112233', data_prenotazione: '2026-06-20', ora_arrivo: '21:00', coperti: 5, tipo_tavolo: 'prive',    stato: 'completata', note_speciali: 'Ospiti VIP - discrezione',              con_animale: false, origine: 'telefono' },
    { sede_id: s1, cliente_id: c8,  nome_ospite: 'Elena Ricci',        telefono_ospite: '+39 347 3334455', data_prenotazione: '2026-06-22', ora_arrivo: '20:00', coperti: 2, tipo_tavolo: 'terrazza', stato: 'completata', allergie_comunicare: 'lattosio',   con_animale: true,  animale_id: a4, origine: 'telefono' },
    { sede_id: s2, cliente_id: c4,  nome_ospite: 'Francesca Rossi',    telefono_ospite: '+39 349 2223344', data_prenotazione: '2026-06-18', ora_arrivo: '13:00', coperti: 3, tipo_tavolo: 'sala',     stato: 'completata', allergie_comunicare: 'crostacei',  con_animale: false, origine: 'app' },
    { sede_id: s1, cliente_id: c5,  nome_ospite: 'Gianluca Bianchi',   telefono_ospite: '+39 338 4445566', data_prenotazione: '2026-06-15', ora_arrivo: '20:30', coperti: 4, tipo_tavolo: 'terrazza', stato: 'completata',                                            con_animale: true,  animale_id: a3, origine: 'telefono' },
    { sede_id: s3, cliente_id: c10, nome_ospite: 'Chiara Lombardi',    telefono_ospite: '+39 333 9990011', data_prenotazione: '2026-06-15', ora_arrivo: '20:30', coperti: 5, tipo_tavolo: 'esterno',  stato: 'completata', note_speciali: 'Gruppo amiche',                        con_animale: false, origine: 'tripadvisor' },
    { sede_id: s5, cliente_id: c12, nome_ospite: 'Isabella Gallo',     telefono_ospite: '+39 393 4445566', data_prenotazione: '2026-06-10', ora_arrivo: '20:00', coperti: 2, tipo_tavolo: 'esterno',  stato: 'completata', allergie_comunicare: 'noci',       con_animale: true,  animale_id: a5, origine: 'facebook' },
    { sede_id: s1, cliente_id: c1,  nome_ospite: 'Marco Ferretti',     telefono_ospite: '+39 335 1234567', data_prenotazione: '2026-06-12', ora_arrivo: '20:00', coperti: 4, tipo_tavolo: 'terrazza', stato: 'completata',                                            con_animale: true,  animale_id: a1, origine: 'telefono' },
    { sede_id: s3, cliente_id: c3,  nome_ospite: 'Alessandro Conti',   telefono_ospite: '+39 366 5557891', data_prenotazione: '2026-06-08', ora_arrivo: '20:00', coperti: 2, tipo_tavolo: 'esterno',  stato: 'completata',                                            con_animale: true,  animale_id: a2, origine: 'booking' },
    { sede_id: s4, cliente_id: c7,  nome_ospite: 'Roberto Colombo',    telefono_ospite: '+39 335 0001122', data_prenotazione: '2026-06-05', ora_arrivo: '21:00', coperti: 2, tipo_tavolo: 'prive',    stato: 'completata',                                            con_animale: false, origine: 'telefono' },
    { sede_id: s2, cliente_id: null, nome_ospite: 'Turista Anonimo',   telefono_ospite: '+39 800 000001',  data_prenotazione: '2026-06-12', ora_arrivo: '20:30', coperti: 4, tipo_tavolo: 'sala',     stato: 'no_show',                                               con_animale: false, origine: 'booking' },
    { sede_id: s1, cliente_id: c2,  nome_ospite: 'Valentina Esposito', telefono_ospite: '+39 347 9876543', data_prenotazione: '2026-06-01', ora_arrivo: '21:00', coperti: 2, tipo_tavolo: 'prive',    stato: 'completata', allergie_comunicare: 'glutine',    con_animale: false, occasione_speciale: 'anniversario', origine: 'whatsapp' },
    // storico maggio
    { sede_id: s1, cliente_id: c1,  nome_ospite: 'Marco Ferretti',     telefono_ospite: '+39 335 1234567', data_prenotazione: '2026-05-25', ora_arrivo: '20:00', coperti: 4, tipo_tavolo: 'terrazza', stato: 'completata',                                            con_animale: true,  animale_id: a1, origine: 'telefono' },
    { sede_id: s1, cliente_id: c11, nome_ospite: 'Antonio De Luca',    telefono_ospite: '+39 348 1112233', data_prenotazione: '2026-05-10', ora_arrivo: '21:00', coperti: 8, tipo_tavolo: 'prive',    stato: 'completata', occasione_speciale: 'evento corporate',                con_animale: false, origine: 'telefono' },
  ]).select('id')
  if (prenErr) console.error('ERRORE prenotazioni:', prenErr.message, prenErr.details)
  else ok('prenotazioni', pren.length)

  // ── 5. VISITE (giugno 2026 + storia) ─────────────────────────────────────
  console.log('\nVisite...')
  const { data: visite, error: visiteErr } = await supabase.from('visite').insert([
    // ── Giugno 2026 (revenue mese corrente) ──
    { cliente_id: c2,  sede_id: s1, data_visita: '2026-06-25', servizio: 'cena',   coperti: 2, tipo_tavolo: 'prive',    importo:  490.00, con_animale: false,              note: 'Menu degustazione gluten-free. Sassicaia 2019.' },
    { cliente_id: c11, sede_id: s1, data_visita: '2026-06-20', servizio: 'cena',   coperti: 5, tipo_tavolo: 'prive',    importo: 1380.00, con_animale: false,              note: 'Ospiti importanti. Barolo e Champagne.' },
    { cliente_id: c8,  sede_id: s1, data_visita: '2026-06-22', servizio: 'cena',   coperti: 2, tipo_tavolo: 'terrazza', importo:  340.00, con_animale: true, animale_id: a4,note: 'Bistecca e crudi. Rex con manzo bollito.' },
    { cliente_id: c5,  sede_id: s1, data_visita: '2026-06-15', servizio: 'cena',   coperti: 4, tipo_tavolo: 'terrazza', importo:  870.00, con_animale: true, animale_id: a3,note: 'Pre-compleanno. Sassicaia 2018. Luna con merluzzo.' },
    { cliente_id: c4,  sede_id: s2, data_visita: '2026-06-18', servizio: 'pranzo', coperti: 3, tipo_tavolo: 'sala',     importo:  195.00, con_animale: false,              note: 'Pranzo lavoro. No crostacei rispettato.' },
    { cliente_id: c1,  sede_id: s1, data_visita: '2026-06-12', servizio: 'cena',   coperti: 4, tipo_tavolo: 'terrazza', importo:  540.00, con_animale: true, animale_id: a1,note: 'Cena soci. Briciola bravissima.' },
    { cliente_id: c10, sede_id: s3, data_visita: '2026-06-15', servizio: 'cena',   coperti: 5, tipo_tavolo: 'esterno',  importo:  465.00, con_animale: false,              note: 'Gruppo amiche. Pesce fresco adriatico.' },
    { cliente_id: c7,  sede_id: s4, data_visita: '2026-06-05', servizio: 'cena',   coperti: 2, tipo_tavolo: 'prive',    importo:  380.00, con_animale: false,              note: 'Riunione. Cash. Ricevuta cartacea.' },
    { cliente_id: c12, sede_id: s5, data_visita: '2026-06-05', servizio: 'cena',   coperti: 2, tipo_tavolo: 'esterno',  importo:  165.00, con_animale: true, animale_id: a5,note: 'Cena romantica. Stella con pollo e zucchine.' },
    { cliente_id: c3,  sede_id: s3, data_visita: '2026-06-08', servizio: 'cena',   coperti: 2, tipo_tavolo: 'esterno',  importo:  230.00, con_animale: true, animale_id: a2,note: 'Zeus manzo bollito.' },
    { cliente_id: c2,  sede_id: s1, data_visita: '2026-06-01', servizio: 'cena',   coperti: 2, tipo_tavolo: 'prive',    importo:  480.00, con_animale: false,              note: 'Anniversario. Menu degustazione completo.' },
    // ── Maggio 2026 (mese precedente per trend) ──
    { cliente_id: c1,  sede_id: s1, data_visita: '2026-05-25', servizio: 'cena',   coperti: 4, tipo_tavolo: 'terrazza', importo:  520.00, con_animale: true, animale_id: a1,note: 'Cena con soci. Briciola premiata.' },
    { cliente_id: c11, sede_id: s1, data_visita: '2026-05-10', servizio: 'cena',   coperti: 8, tipo_tavolo: 'prive',    importo: 2180.00, con_animale: false,              note: 'Evento corporate. Chef personalizzato.' },
    { cliente_id: c6,  sede_id: s5, data_visita: '2026-05-18', servizio: 'pranzo', coperti: 3, tipo_tavolo: 'sala',     importo:  138.00, con_animale: false,              note: 'Blogger con amiche.' },
    { cliente_id: c2,  sede_id: s1, data_visita: '2026-05-05', servizio: 'cena',   coperti: 6, tipo_tavolo: 'prive',    importo: 1560.00, con_animale: false,              note: 'Cena famiglia. Tutto gluten-free.' },
    { cliente_id: c8,  sede_id: s1, data_visita: '2026-04-20', servizio: 'cena',   coperti: 3, tipo_tavolo: 'terrazza', importo:  415.00, con_animale: true, animale_id: a4,note: 'Rex sotto il tavolo tutta la serata.' },
  ]).select('id')
  if (visiteErr) console.error('ERRORE visite:', visiteErr.message)
  else ok('visite', visite.length)

  // ── 6. CAMPAGNE ───────────────────────────────────────────────────────────
  console.log('\nCampagne marketing...')
  const { data: camp, error: campErr } = await supabase.from('campagne').insert([
    { nome: 'Estate Scogliera 2026 - Apertura Terrazze', segmento_target: 'gold,platinum,diamante', sede_id: s1, canale: 'email',    stato: 'completata', messaggio: "Caro ospite VIP, è arrivata l'estate. Prenota la tua serata esclusiva in terrazza con menu degustazione e calice di benvenuto.", data_invio: '2026-06-01', totale_destinatari: 78, totale_inviati: 76, totale_risposti: 34, totale_convertiti: 22 },
    { nome: 'VIP Night Rimini - 15 luglio',              segmento_target: 'platinum,diamante',       sede_id: s1, canale: 'whatsapp', stato: 'attiva',     messaggio: "Sei invitato alla VIP Night del 15 luglio. Menu chef, vini in degustazione, tramonto sul mare. Posti limitati a 20 ospiti.", data_invio: '2026-06-20', totale_destinatari: 28, totale_inviati: 28, totale_risposti: 19, totale_convertiti: 14 },
    { nome: 'Ferragosto Pet-Friendly - Menu Cani',       segmento_target: 'tutti_con_animali',       sede_id: null, canale: 'email', stato: 'pianificata', messaggio: "Questa estate anche il tuo cane è benvenuto! Menu speciale: pollo bio, manzo scottato, riso bianco. In omaggio la ciotola griffata Scogliera Group.", data_invio: '2026-07-10', totale_destinatari: 45, totale_inviati: 0, totale_risposti: 0, totale_convertiti: 0 },
  ]).select('id')
  if (campErr) console.error('ERRORE campagne:', campErr.message)
  else ok('campagne', camp.length)

  // ── 7. NOTE OPERATIVE ─────────────────────────────────────────────────────
  console.log('\nNote operative...')
  const { data: note, error: noteErr } = await supabase.from('note').insert([
    { sede_id: s1, cliente_id: c2,   tipo: 'allergia',   testo: 'ALLERGIA CELIACA ACCERTATA - Valentina Esposito non può assumere glutine. Usare stoviglie dedicate e verificare con cucina prima del servizio.', priorita: 'urgente', risolta: false },
    { sede_id: s1, cliente_id: c8,   tipo: 'preferenza', testo: 'Elena Ricci porta sempre Rex (pastore tedesco, grande). Riservare tavolo terrazza fronte mare, angolo protetto. Ciotola acqua grande. NO lattosio in nessun piatto.',                   priorita: 'alta',    risolta: false },
    { sede_id: s4, cliente_id: c7,   tipo: 'operativa',  testo: 'Roberto Colombo paga sempre in contanti. Preparare ricevuta cartacea. Non fotografare il tavolo - privacy assoluta.',                                                                   priorita: 'alta',    risolta: false },
    { sede_id: s1, cliente_id: c11,  tipo: 'vip',        testo: 'Antonio De Luca (giornalista TV). Ospiti importanti stasera. Briefing staff 20:00. Prive principale riservato, massima discrezione.',                                                    priorita: 'alta',    risolta: false },
    { sede_id: s3, cliente_id: null, tipo: 'operativa',  testo: 'Sede Cattolica: frigo cibo cani da riordinare entro venerdì. Scorte pollo bio e manzo quasi esaurite. Contattare fornitore locale.',                                                      priorita: 'media',   risolta: false },
  ]).select('id')
  if (noteErr) console.error('ERRORE note:', noteErr.message)
  else ok('note operative', note.length)

  // ── 8. NOTIFICHE ──────────────────────────────────────────────────────────
  console.log('\nNotifiche...')
  const { data: notif, error: notifErr } = await supabase.from('notifiche').insert([
    { tipo: 'prenotazione',     titolo: 'Elena Ricci — pranzo oggi 12:30 (terrazza, 2 cop.)',    messaggio: 'Elena Ricci (Diamante) arriva a pranzo con Rex. NO LATTOSIO. Ciotola acqua grande. Tavolo terrazza angolo mare riservato.',                                    sede_id: s1, cliente_id: c8,  letta: false },
    { tipo: 'allergia',         titolo: 'GLUTINE — Esposito stasera ore 21 in prive',            messaggio: 'Valentina Esposito (Diamante) cena in prive. CELIACA ACCERTATA — stoviglie dedicate, comunicare a cucina adesso.',                                             sede_id: s1, cliente_id: c2,  letta: false },
    { tipo: 'prenotazione',     titolo: 'De Luca — prive 20:30, 5 ospiti VIP',                  messaggio: 'Antonio De Luca (Platinum) con ospiti importanti. Briefing staff ore 20:00. Prive principale pronto, discrezione assoluta.',                                   sede_id: s1, cliente_id: c11, letta: false },
    { tipo: 'rischio_abbandono',titolo: 'Cliente a rischio — Greco inattivo 111 giorni',        messaggio: 'Davide Greco (Gold) inattivo da 111 giorni (ultima visita 10/03/2026). Considerare campagna re-engagement.',                                                    sede_id: s2, cliente_id: c9,  letta: false },
    { tipo: 'compleanno',       titolo: 'Compleanno VIP — Bianchi il 2 luglio (prenotato)',     messaggio: 'Gianluca Bianchi (Platinum) compie gli anni il 2 luglio. Ha già prenotato terrazza per 6. Preparare torta con candeline.',                                      sede_id: s1, cliente_id: c5,  letta: false },
    { tipo: 'prenotazione',     titolo: '7 prenotazioni confermate per oggi ' + TODAY,          messaggio: '7 coperture oggi: Ricci 12:30 (terrazza), Ferretti 20:00 (terrazza), De Luca 20:30 (prive), Esposito 21:00 (prive), Rossi 13:00 Riccione, Lombardi 20:30 Cattolica, Colombo 21:00 Pesaro.', sede_id: null, cliente_id: null, letta: false },
    // già lette (storico)
    { tipo: 'anniversario',     titolo: 'Campagna "Estate 2026" — 22 conversioni (28%)',        messaggio: 'Campagna email chiusa con 22 prenotazioni confermate su 78 destinatari. Tasso ottimo per segmento VIP.',                                                        sede_id: s1, cliente_id: null, letta: true  },
    { tipo: 'prenotazione',     titolo: 'No-show registrato — 4 coperti persi (12 giugno)',     messaggio: 'Prenotazione del 12/06 non si è presentata. Considerare policy deposito anticipato.',                                                                           sede_id: s2, cliente_id: null, letta: true  },
  ]).select('id')
  if (notifErr) console.error('ERRORE notifiche:', notifErr.message)
  else ok('notifiche', notif.length)

  // ── RIEPILOGO ─────────────────────────────────────────────────────────────
  console.log('\n=== Seed completato! ===')
  console.log(`  Sedi:         ${sedi.length}`)
  console.log(`  Clienti VIP:  ${clienti.length}`)
  console.log(`  Animali:      ${(animali??[]).length}`)
  console.log(`  Prenotazioni: ${(pren??[]).length}  (7 per oggi ${TODAY})`)
  console.log(`  Visite:       ${(visite??[]).length} (11 in giugno 2026)`)
  console.log(`  Revenue giugno 2026: €${[490,1380,340,870,195,540,465,380,165,230,480].reduce((a,b)=>a+b,0).toLocaleString('it-IT')}`)
  console.log(`  Campagne:     ${(camp??[]).length}`)
  console.log(`  Note:         ${(note??[]).length}`)
  console.log(`  Notifiche:    ${(notif??[]).length}  (6 non lette)\n`)
}

main().catch(e => { console.error('\nErrore fatale:', e.message); process.exit(1) })
