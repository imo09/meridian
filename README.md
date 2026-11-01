# Meridian by nautargo

Pianificazione e controllo progetti con la logica di Oracle Primavera P6, il meglio di MS Project e funzioni proprie. Versione 1.0 (prima versione completa), pubblicata su **meridian.nautargo.com**.

## Cosa contiene

1. **Portafoglio**: EPS con nodi BASE, CURR, BKG; KPI; programmi correnti con scostamento sulla fine, SPI, CPI ed EAC; ciclo di aggiornamento; copie e scenari.
2. **Struttura**: EPS e OBS, progetto e WBS, calendari (settimana tipo, festività italiane, chiusure, vista mensile), risorse e ruoli, codici e UDF, curve e conti di costo (CBS), financial periods, registro tavole con revisioni.
3. **Attività e Gantt**: tabella configurabile (ogni campo, anche UDF e codici, è una colonna), filtri, raggruppamenti, Gantt con baseline, legami e linea di avanzamento, reticolo con zoom semantico, minimappa e raggruppamento WBS, pannello dettagli (generale, stato, risorse, legami, costi, codici, passi, tavole, note).
4. **Motore CPM** (nel browser): passaggio in avanti e all'indietro, calendari multipli, legami FS/SS/FF/SF con lag, vincoli, data date, Retained Logic e Progress Override, LOE e WBS Summary, total e free float, Longest Path, **percorsi critici multipli** separati per catene indipendenti, sub-critiche, driver di ogni attività con frase esplicativa, margine sul secondo vincolo.
5. **Ricalcolo**: manuale con F9 (badge "Da ricalcolare") oppure **Anteprima** da confermare tutto o niente, con elenco delle attività spostate, delta sulla fine, cambio del percorso critico, storico versioni e segnalazione dei conflitti tra utenti (anche tra schede del browser).
6. **Modalità Traccia**: catena all'indietro e in avanti con livelli, quasi spingenti, filtro verso una milestone, leve, modifiche in anteprima, export della catena in Excel.
7. **Schedulazione**: parametri, log cliccabile, percorsi critici, 14 controlli di qualità sul modello DCMA (compreso il Critical Path Test), storico versioni confrontabili.
8. **Risorse**: profilo di utilizzo multiprogetto, sovrallocazioni, assegnazioni, simulazioni di risoluzione e livellamento entro il float su copia BKG.
9. **Costi**: righe di costo per attività (impresa, lavoro, materiale, unità di misura, quantità, prezzo), avanzamento a quantità, aggregazioni per WBS, impresa, materiale, conto e natura, curve economiche, curve dei materiali, cash flow per periodo, contratto e varianti, regola anti doppio conteggio.
10. **Avanzamento**: ciclo in 6 passi, inserimento con validazione, approvazioni da campo (Bozza, Inviato, Approvato, Respinto), finestra temporale, proposte dal tablet, note e foto, coda offline, storicizzazione del periodo.
11. **Baseline ed EV**: baseline assegnate, 12 indici con formula, frase, semaforo e azione, curve con valori sul grafico, andamento di SPI e CPI per periodo, matrice di lettura, Earned Schedule, confronti A contro B (programmi e periodi), issue, rischi, soglie.
12. **Scambio dati**: export Excel della vista e modello completo, CSV, XER e XML di P6, XML di MS Project, PDF e immagini; import guidato di XER, XML di MS Project, Excel e CSV con mappatura, errori per cella, simulazione a vuoto e report; incolla da Excel.
13. **Icone i**: catalogo unico con cosa fa, cosa impatta, quando usarlo e link alla Guida P6 (inclusa in `guida/` con ancore stabili), modalità guida.
14. **Telefono**: sola lettura con Sintesi, Programma e Controllo. **Tablet**: modulo da campo con controlli prima dell'invio.
15. **Amministrazione**: utenti, ruoli e permessi via OBS, impostazioni di calcolo, soglie DCMA, finestre di inserimento, backup e ripristino.

Il dataset dimostrativo (ED-A Edificio A, PK-B, VA-C) riproduce i valori dei mockup: data date 31/10/26, fine prevista 14/10/27 contro baseline 30/09/27 (-10 g), BAC 4.800,00 k€, PV 1.200,00, EV 960,00, AC 1.104,00, SPI 0,80, CPI 0,87.

## Architettura

1. **Web app statica** (HTML, CSS, JavaScript senza dipendenze né build): un codice per PC, tablet e telefono.
2. **PWA installabile** con service worker per l'uso offline; font inclusi.
3. **Dati nel browser** (localStorage) con backup e ripristino JSON. La sincronizzazione su server e la multiutenza reale sono il passo successivo.

## Pubblicazione

1. GitHub Pages serve la radice del ramo pubblicato; il file `CNAME` punta a `meridian.nautargo.com`.
2. Dopo ogni modifica: `python3 tools/build.py` aggiorna `sw.js` e lo zip portable in `download/`.

## Versione portable

Scarica `download/meridian-portable.zip`, estrai e apri `meridian/index.html`: funziona senza installazione e senza connessione.

## Decisioni aperte e sviluppi

Vedi [docs/backlog.md](docs/backlog.md): decisioni da prendere e aggiunte possibili per categoria.

## Note

Primavera e MS Project sono marchi dei rispettivi proprietari; Meridian non è affiliato. Il nome è in attesa della verifica dei marchi.
