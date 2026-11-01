# Meridian - decisioni aperte e sviluppi possibili

Elenco per categoria delle cose da decidere e delle aggiunte o modifiche possibili dopo la versione 1.0. Per ogni voce: cosa c'è oggi, cosa si propone, priorità indicativa (Alta, Media, Bassa).

Aggiornato al 01/11/2026.

## A. Decisioni prese

1. **Pubblicazione**: si pubblica unendo il ramo di sviluppo in `main` tramite PR; GitHub Pages serve `meridian.nautargo.com`.
2. **Dati condivisi tra persone**: per ora restano locali, nel browser di ogni dispositivo, con backup e ripristino JSON. Il server di sincronizzazione è rinviato (vedi sezione H).
3. **Scelte già applicate nella 1.0**: nome Meridian, logo variante A (M a tre barre con ago dorato), Tavola come registro con revisioni, web app installabile, import ed export anche in XML di MS Project.

## B. Decisioni da prendere

4. **Codice voce da elenco prezzi o computo nelle righe di costo**: oggi non esiste. Opzioni: (a) campo codice voce con descrizione e prezzo presi da un elenco prezzi importabile, (b) nessun campo.
5. **Nome e marchio**: "Meridian" è da verificare su TMview/EUIPO e UIBM, classi 9 e 42. Opzioni: (a) Meridian, (b) Meridian con qualificatore (es. Meridian Plan), (c) Diana, (d) altro.
6. **Uso previsto**: (a) interno, (b) prodotto commerciale. Cambia il peso della verifica marchi, della sicurezza e del server.
7. **Logo**: variante A applicata. Da confermare o rivedere: (a) A, (b) B, (c) C, (d) mix.
8. **Roadmap di chiusura dell'handover**: step 1 confronto P6 / MS Project / Meridian, step 2 semplificazione (Base ed Esperto), step 3 check PMBOK. Da decidere: (a) matrice come foglio di calcolo, (b) prima la struttura in chat; edizione PMBOK (a) 6a a 10 knowledge areas, (b) recente a domini di performance.
9. **Quando passare al server**: decidere la soglia (numero di utenti, primo progetto reale condiviso, richiesta di login) oltre la quale il locale non basta più.

## C. Storico, versioni e tracciabilità

10. **Log degli input per versione** (Alta): oggi ogni F9 o conferma crea una versione con autore, data, nota e date delle attività, ma non registra cosa è stato inserito. Proposta: un registro di ogni modifica con data e ora, utente, progetto, oggetto (attività, legame, risorsa, riga di costo, calendario), campo, valore prima e dopo, origine (manuale, incolla, import, approvazione da campo, Traccia, Global Change).
11. **"Cosa ha portato a questa versione"** (Alta): per ogni versione, l'elenco degli input confermati con quella F9 o anteprima, filtrabile per utente, attività e tipo di modifica, esportabile in Excel e PDF.
12. **Confronto tra due versioni qualsiasi** (Alta): oggi si confronta una versione solo con la corrente e solo sulle date. Proposta: scegliere A e B tra tutte le versioni, confrontare date, durate, legami, avanzamento, costi e percorso critico, e collegare ogni spostamento agli input che lo hanno causato (log più driver).
13. **Snapshot completo delle versioni** (Media): oggi la versione salva solo date, float e criticità. Proposta: salvare i dati completi o le differenze, così che si possa riaprire una versione.
14. **Ripristino di una versione** (Media): riaprire una versione passata come copia nel nodo BKG, senza toccare il corrente.
15. **Annulla multiplo con elenco** (Bassa): oggi Ctrl+Z annulla l'ultima modifica in modalità manuale. Proposta: elenco delle modifiche annullabili e Ripeti.
16. **Nota obbligatoria alla conferma** (Bassa): impostazione per rendere obbligatoria la nota di versione.

## D. Layout, viste e stampe

17. **Gestione dei layout** (Alta): oggi si salva un layout nuovo (colonne, raggruppamento, filtro) dalla finestra Colonne. Proposta: rinominare, duplicare, eliminare, ordinare i layout; salvare anche ordinamento, larghezze delle colonne, scala del tempo, barre visibili, opzioni del reticolo.
18. **Ambito dei layout** (Media): personale, di progetto o globale, come in P6; layout predefinito per ruolo.
19. **Filtri personalizzati** (Media): condizioni su qualsiasi campo con E/O, intervalli di date, salvabili e combinabili con il layout.
20. **Barre del Gantt personalizzate** (Media): come Bars di P6: quali date disegnare, colore, forma, etichette, filtro di applicazione.
21. **Stampe da viste predefinite** (Alta): programma per il committente (sommari e baseline), look-ahead da 2 a 4 settimane per il cantiere, percorso critico, attività del mese, report mensile di avanzamento con EV e scostamenti, registro tavole, issue e rischi.
22. **Stampe dai layout salvati** (Alta): ogni layout stampabile con il suo modello di pagina.
23. **Stampa di quanto a schermo** (Media): oggi "PDF della vista" usa la stampa del browser sulla pagina Attività. Proposta: stampa della vista corrente di qualsiasi modulo, con filtro e traccia attivi.
24. **Modello di pagina** (Alta): intestazione con logo, progetto, data date, versione e revisione; legenda; numero di pagina; spazio firme; formato e orientamento; adatta a N pagine in larghezza; interruzione di pagina per WBS; scala del tempo scelta per la stampa.
25. **Anteprima di stampa e PDF diretto** (Media): anteprima nell'app e PDF generato senza passare dalla finestra di stampa del browser.
26. **Pacchetto mensile** (Media): un unico PDF con sintesi, Gantt, percorso critico, EV, scostamenti, issue e rischi, generato a fine ciclo di aggiornamento.
27. **Export Excel con lo stile del layout** (Bassa): larghezze, colori dei raggruppamenti, colonne bloccate come a schermo.

## E. Pianificazione e calcolo

28. **Livellamento completo delle risorse** (Media): oggi è semplice, entro il float e su copia. Proposta: priorità, finestre di livellamento, più risorse insieme, confronto automatico.
29. **Global Change** (Media): regole Se / Allora / Altrimenti su più attività, con anteprima prima di applicare.
30. **Riempimento e modifica in blocco nella tabella** (Media): modifica diretta nelle celle, copia verso il basso, selezione multipla.
31. **Modifica dal Gantt** (Bassa): trascinamento di barre e legami su desktop, sempre in anteprima.
32. **Legami tra progetti** (Media): predecessori esterni e vista multiprogetto con percorso critico comune.
33. **Calendari orari e turni** (Bassa): fasce orarie, durate in ore, calendari delle risorse usati dalle attività Resource Dependent.
34. **Vincolo secondario ed Expected finish** (Bassa): come in P6.
35. **Analisi dei rischi sui tempi** (Bassa): durate a tre punti e simulazione Monte Carlo (P50, P80); la Guida la indica come prodotto dedicato, va deciso se farla dentro Meridian.

## F. Costi e controllo

36. **Elenco prezzi e computo** (dipende dalla voce 4): import di un elenco prezzi, collegamento delle righe di costo alle voci, avanzamento a misura per SAL.
37. **Prezzi variabili nel tempo** (Bassa): tariffe delle risorse con data di validità e più valute.
38. **Consuntivi da contabilità** (Media): import dei costi effettivi per conto (CBS) e periodo, con abbinamento alle righe di costo.
39. **EV e curve per WBS** (Media): oggi gli indici si filtrano per WBS, le curve no. Proposta: curve, Earned Schedule e andamento per periodo su ogni nodo WBS.
40. **Notifiche delle soglie** (Bassa): avviso al responsabile quando una soglia genera un issue (richiede il server per l'invio).

## G. Avanzamento e campo

41. **Foto in archivio dedicato** (Alta): oggi le foto sono ridotte e salvate insieme ai dati del browser, con il limite di circa 5 MB. Proposta: archivio IndexedDB, galleria per attività e periodo, data e posizione.
42. **Approvazione con firma** (Bassa): conferma dell'approvazione con nome, data e commento obbligatorio.
43. **Promemoria della finestra di inserimento** (Bassa): avviso al capocantiere quando la finestra si apre e si chiude.

## H. Dati, multiutenza e sicurezza

44. **Server di sincronizzazione** (rinviato, vedi voce 2): login, permessi veri per OBS, archivio comune, anteprime private, conflitti risolti sul server, storico condiviso.
45. **Archivio locale più capiente** (Media): passare da localStorage a IndexedDB per progetti con migliaia di attività e molte copie.
46. **Backup automatico** (Media): promemoria periodico o salvataggio automatico su file o cartella condivisa.
47. **Condivisione senza server** (Bassa): esportare e importare un singolo progetto (non tutto il database) per passarlo a un collega.

## I. Scambio dati

48. **Import dell'XML di P6** (Media): oggi solo export; per l'import si usa XER.
49. **Fedeltà XER** (Media): esportare anche step, UDF, codici delle risorse, baseline; verifica con import reale in P6.
50. **Eliminazione da Excel** (Bassa): colonna "Elimina questa riga" come in P6, con conferma.
51. **Collegamento delle tavole a un archivio documentale** (Bassa): link a SharePoint, Drive o Dropbox con revisione letta dal file.

## J. Interfaccia

52. **Prestazioni con migliaia di attività** (Alta): disegnare solo le righe visibili di tabella e Gantt.
53. **Modalità Base più spinta** (Media): step 2 della roadmap, meno campi e operazioni frequenti in pochi clic.
54. **Tema scuro e lingua inglese** (Bassa).
55. **Percorso guidato al primo avvio** (Bassa): breve tour dei moduli con le icone i.
56. **Ricerca globale** (Bassa): attività, tavole, risorse e issue da un unico campo.

## K. Qualità e verifica

57. **Test automatici del motore** (Alta): casi della Guida (esempio A-B-C-D di 50 giorni), legami SS e FF con lag, calendari diversi, vincoli, dati demo; da eseguire a ogni modifica.
58. **Verifiche su dispositivi e software reali** (Alta): Safari su iPad, Excel desktop, import reale in P6 e MS Project dei file esportati.
59. **Numero di versione e registro delle modifiche dell'app** (Bassa): versione visibile nell'app e changelog.
