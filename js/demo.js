/* Meridian - dataset dimostrativo coerente (cantiere ED-A Edificio A, PK-B, VA-C).
   I dati sono di esempio: servono a provare l'app con un caso realistico. */
(function (M) {
  'use strict';
  const U = M.U, Cal = M.Cal;

  function A(code, name, wbs, o) { return Object.assign({ id: code, code, name, wbsId: wbs, type: 'task', od: 0, pct: 0, pctType: 'phys', durType: 'FDU', assign: [], costs: [], steps: [], codes: {}, udf: {}, drawings: [], notes: [] }, o || {}); }
  function R(pred, succ, type, lag) { return { id: pred + '>' + succ, pred, succ, type: type || 'FS', lag: lag || 0 }; }
  function L(company, desc, mat, um, qty, unit, o) { return Object.assign({ id: U.uid('c'), company, desc, mat, um, qty, unit, qtyDone: 0, actual: 0, dist: 'linear', kind: 'Materiale', cbs: '' }, o || {}); }
  function S(resId, upd, bud, act, rem, o) { return Object.assign({ id: U.uid('as'), resId, upd, bud, act: act || 0, rem: rem === undefined ? bud - (act || 0) : rem, curve: 'uniform' }, o || {}); }

  function calendars() {
    return [
      { id: 'cal5', name: '5x8 Italia 2026-27', type: 'global', week: [8, 8, 8, 8, 8, 0, 0], hoursDay: 8, recurring: Cal.italianRecurring.slice(), holidays: Cal.pasquette(2025, 2030).concat(['2026-08-10..2026-08-21', '2027-08-09..2027-08-20']), workdays: [], note: 'Calendario Global: ereditato da tutti i progetti' },
      { id: 'cal6', name: '6x8 Strutture', type: 'project', week: [8, 8, 8, 8, 8, 8, 0], hoursDay: 8, recurring: Cal.italianRecurring.slice(), holidays: Cal.pasquette(2025, 2030), workdays: [] },
      { id: 'cal7', name: '7x24 Maturazione getti', type: 'global', week: [24, 24, 24, 24, 24, 24, 24], hoursDay: 24, recurring: [], holidays: [], workdays: [] }
    ];
  }

  function edaWbs() {
    return [
      { id: 'W-EDA', code: 'ED-A', name: 'Edificio A', parent: null },
      { id: 'W-MIL', code: 'MIL', name: 'Milestone', parent: 'W-EDA' },
      { id: 'W-PROG', code: 'PROG', name: 'Progettazione', parent: 'W-EDA' },
      { id: 'W-APP', code: 'APP', name: 'Approvvigionamenti', parent: 'W-EDA' },
      { id: 'W-CIV', code: 'CIV', name: 'Opere civili', parent: 'W-EDA' },
      { id: 'W-SCA', code: 'SCA', name: 'Scavi', parent: 'W-CIV' },
      { id: 'W-FON', code: 'FON', name: 'Fondazioni', parent: 'W-CIV' },
      { id: 'W-STR', code: 'STR', name: 'Strutture', parent: 'W-CIV' },
      { id: 'W-IMP', code: 'IMP', name: 'Impianti', parent: 'W-EDA' },
      { id: 'W-FIN', code: 'FIN', name: 'Finiture e consegna', parent: 'W-EDA' },
      { id: 'W-EST', code: 'EST', name: 'Allacci e sistemazioni esterne', parent: 'W-EDA' },
      { id: 'W-GES', code: 'GES', name: 'Gestione', parent: 'W-EDA' }
    ];
  }

  /* programma corrente ED-A al 31/10/26 */
  function edaActivities() {
    const C = (ph, sub, area) => ({ PHAS: ph, SUB: sub || '', AREA: area || 'Lotto A' });
    return [
      A('M0000', 'Inizio lavori', 'W-MIL', { type: 'start', as: '2026-06-01', af: '2026-06-01', pct: 100, codes: C('GES', '', 'Lotto A') }),
      A('A1000', 'Progettazione esecutiva', 'W-PROG', { od: 40, as: '2026-06-01', af: '2026-07-24', pct: 100, codes: C('PROG'), costs: [L('Studio di progettazione', 'Progettazione esecutiva strutture e impianti', '', 'a corpo', 1, 250215, { kind: 'Servizio', qtyDone: 1, actual: 268000, cbs: 'CBS-01' })] }),
      A('A1010', 'Scavi e sbancamenti', 'W-SCA', { od: 25, as: '2026-07-27', af: '2026-09-18', pct: 100, codes: C('CIV', 'SUB-01'), assign: [S('r_esc', 16, 400, 480, 0)], costs: [L('SUB-01 Subappalto scavi', 'Scavo di sbancamento e trasporto a discarica', 'Terre e rocce da scavo', 'm³', 9800, 16.5, { kind: 'Subappalto', qtyDone: 9800, actual: 210000, withLabor: true, cbs: 'CBS-02' })] }),
      A('A1015', 'Fornitura acciaio B450C', 'W-APP', { od: 30, as: '2026-09-28', rd: 8, pct: 40, pctType: 'phys', codes: C('APP', 'FOR-02'), costs: [L('FOR-02 Fornitore acciaio', 'Barre e reti B450C per elevazione', 'Acciaio B450C', 't', 240, 962.9, { kind: 'Materiale', qtyDone: 96, actual: 104000, dist: 'linear', cbs: 'CBS-03' })], notes: [{ at: '2026-10-28T09:10:00Z', by: 'Acquisti', text: 'Consegna del secondo lotto confermata per l\'11/11.' }] }),
      A('A1020', 'Fondazioni', 'W-FON', { od: 40, as: '2026-09-21', rd: 12, pct: 70, codes: C('CIV', 'SUB-03'), drawings: ['T-STR001'], udf: { u_d10: 4, u_sem: 'Giallo' },
        steps: [{ name: 'Scavo a sezione obbligata', w: 20, pct: 100 }, { name: 'Magrone', w: 10, pct: 100 }, { name: 'Armatura', w: 30, pct: 100 }, { name: 'Casserature', w: 20, pct: 50 }, { name: 'Getto e disarmo', w: 20, pct: 0 }],
        assign: [S('r_carp', 64, 2560, 2240, 960, { storedAct: 600 }), S('r_gru', 8, 320, 240, 96, { storedAct: 64 }), S('r_cls', 21.25, 850, 640, 210, { curve: 'bell', storedAct: 160 })],
        costs: [L('SUB-03 Subappalto fondazioni', 'Pali trivellati e opere di fondazione a misura', 'Pali trivellati', 'm', 2400, 95, { kind: 'Subappalto', qtyDone: 1680, actual: 186540, withLabor: true, cbs: 'CBS-02' }), L('FOR-02 Fornitore acciaio', 'Acciaio di armatura per fondazioni', 'Acciaio B450C', 't', 70, 1100, { kind: 'Materiale', qtyDone: 60, actual: 66000, dist: 'start', cbs: 'CBS-03' })] }),
      A('A1025', 'Rinterri e drenaggi', 'W-FON', { od: 15, codes: C('CIV', 'SUB-01'), costs: [L('SUB-01 Subappalto scavi', 'Rinterri con materiale selezionato e drenaggi', 'Misto granulare', 'm³', 2600, 18, { kind: 'Subappalto', withLabor: true, cbs: 'CBS-02' })] }),
      A('A1030', 'Strutture in elevazione', 'W-STR', { od: 131, codes: C('CIV', ''), drawings: ['T-STR010', 'T-ARC100'], udf: { u_d10: 13, u_sem: 'Rosso' },
        assign: [S('r_carp', 72, 9432, 0, 9432), S('r_gru', 8, 1048, 0, 1048), S('r_ferr', 32, 4192, 0, 4192)],
        costs: [L('FOR-04 Fornitore calcestruzzo', 'Calcestruzzo C30/37 per elevazione', 'Calcestruzzo C30/37', 'm³', 2900, 112, { kind: 'Materiale', dist: 'linear', cbs: 'CBS-03' }), L('FOR-05 Prefabbricati', 'Solai prefabbricati predalles', 'Solai prefabbricati', 'm²', 6200, 48, { kind: 'Materiale', dist: 'bell', cbs: 'CBS-03' }), L('Impresa', 'Opere provvisionali, ponteggi e sicurezza', '', 'a corpo', 1, 373005, { kind: 'Spesa', cbs: 'CBS-06' })] }),
      A('A1035', 'Copertura e impermeabilizzazione', 'W-STR', { od: 25, codes: C('CIV', 'SUB-07'), costs: [L('SUB-07 Coperture', 'Copertura piana e impermeabilizzazione', 'Guaina bituminosa', 'm²', 1450, 62, { kind: 'Subappalto', withLabor: true, cbs: 'CBS-02' })] }),
      A('A1040', 'Impianti meccanici', 'W-IMP', { od: 63, cstr: { t: 'SNET', d: '2027-03-03' }, cstrNote: 'consegna macchine', codes: C('IMP', 'SUB-05'), drawings: ['T-IMPM01'], costs: [L('SUB-05 Impianti meccanici', 'Impianto di climatizzazione e idrico sanitario', '', 'a corpo', 1, 455000, { kind: 'Subappalto', withLabor: true, cbs: 'CBS-04' })] }),
      A('A1050', 'Impianti elettrici', 'W-IMP', { od: 65, codes: C('IMP', 'SUB-06'), drawings: ['T-IMPE01'], costs: [L('SUB-06 Impianti elettrici', 'Impianto elettrico e speciali', 'Cavi elettrici', 'm', 38000, 9.5, { kind: 'Subappalto', withLabor: true, cbs: 'CBS-04' })] }),
      A('A1060', 'Finiture interne', 'W-FIN', { od: 80, codes: C('FIN', 'SUB-08'), drawings: ['T-ARC100'], costs: [L('SUB-08 Finiture', 'Massetti, pavimenti, intonaci e tinteggiature', 'Pavimenti', 'm²', 5800, 52, { kind: 'Subappalto', withLabor: true, cbs: 'CBS-05' }), L('SUB-08 Finiture', 'Cartongessi e controsoffitti', 'Cartongesso', 'm²', 4200, 28, { kind: 'Subappalto', withLabor: true, cbs: 'CBS-05' })] }),
      A('A1062', 'Facciate e serramenti', 'W-FIN', { od: 60, codes: C('FIN', 'FOR-09'), costs: [L('FOR-09 Serramenti', 'Facciate continue e serramenti esterni', 'Serramenti', 'm²', 1300, 175, { kind: 'Materiale', dist: 'bell', cbs: 'CBS-05' })] }),
      A('A1065', 'Prove e messa in servizio impianti', 'W-IMP', { od: 15, codes: C('IMP', 'SUB-05'), costs: [L('SUB-05 Impianti meccanici', 'Prove, bilanciamento e messa in servizio', '', 'a corpo', 1, 38000, { kind: 'Subappalto', withLabor: true, cbs: 'CBS-04' })] }),
      A('A1070', 'Collaudi e consegna', 'W-FIN', { od: 10, codes: C('FIN'), costs: [L('Collaudatore', 'Collaudo statico e tecnico amministrativo', '', 'a corpo', 1, 30000, { kind: 'Servizio', cbs: 'CBS-06' })] }),
      A('A1080', 'Pratiche allacci con gli enti', 'W-EST', { od: 20, as: '2026-09-01', af: '2026-09-28', pct: 100, codes: C('EST', '', 'Esterno'), costs: [L('Enti', 'Oneri istruttori e pratiche', '', 'a corpo', 1, 10000, { kind: 'Spesa', qtyDone: 1, actual: 10400, cbs: 'CBS-06' })] }),
      A('A1085', 'Allaccio rete elettrica', 'W-EST', { od: 15, cstr: { t: 'SNET', d: '2027-08-06' }, cstrNote: 'data comunicata dal distributore', codes: C('EST', '', 'Esterno'), costs: [L('Distributore energia', 'Contributo di allaccio e cabina MT/BT', '', 'a corpo', 1, 25000, { kind: 'Spesa', dist: 'start', cbs: 'CBS-06' })] }),
      A('A1090', 'Sistemazioni esterne e parcheggi', 'W-EST', { od: 25, codes: C('EST', 'SUB-01', 'Esterno'), drawings: ['T-EST01'], costs: [L('SUB-01 Subappalto scavi', 'Pavimentazioni esterne, verde e parcheggi', 'Asfalto', 'm²', 3200, 42, { kind: 'Subappalto', withLabor: true, cbs: 'CBS-02' })] }),
      A('M1999', 'Fine lavori', 'W-MIL', { type: 'finish', codes: C('GES') }),
      A('A1900', 'Direzione lavori (LOE)', 'W-GES', { type: 'loe', as: '2026-06-01', pctType: 'dur', codes: C('GES'), assign: [S('r_capo', 8, 2768, 792, 1976, { storedAct: 616 })], costs: [L('Impresa', 'Spese generali di cantiere', '', 'mese', 17, 4500, { kind: 'Spesa', qtyDone: 5, actual: 23500, cbs: 'CBS-06' })] })
    ];
  }
  function edaRels() {
    return [
      R('M0000', 'A1000'), R('A1000', 'A1010'), R('A1000', 'A1015'), R('A1000', 'A1080'), R('A1010', 'A1020'), R('A1015', 'A1030'), R('A1020', 'A1030'), R('A1020', 'A1025'),
      R('A1030', 'A1035', 'SS', 100), R('A1030', 'A1040', 'SS', 70), R('A1030', 'A1050', 'SS', 80), R('A1030', 'A1060'), R('A1035', 'A1060'), R('A1030', 'A1062', 'SS', 95), R('A1062', 'A1060', 'FF', 0),
      R('A1040', 'A1065'), R('A1060', 'A1070'), R('A1065', 'A1070'), R('A1070', 'M1999'),
      R('A1080', 'A1085'), R('A1085', 'A1090'), R('A1025', 'A1090'), R('A1090', 'M1999'),
      R('M0000', 'A1900', 'SS', 0), R('A1900', 'M1999', 'FF', 0)
    ];
  }

  function pkbWbs() {
    return [
      { id: 'W-PKB', code: 'PK-B', name: 'Parcheggio interrato B', parent: null },
      { id: 'W-PMIL', code: 'MIL', name: 'Milestone', parent: 'W-PKB' },
      { id: 'W-POPC', code: 'OPC', name: 'Opere di contenimento e scavo', parent: 'W-PKB' },
      { id: 'W-PSTR', code: 'STR', name: 'Strutture', parent: 'W-PKB' },
      { id: 'W-PFIN', code: 'FIN', name: 'Impianti e finiture', parent: 'W-PKB' }
    ];
  }
  function pkbActivities() {
    const C = (ph, sub) => ({ PHAS: ph, SUB: sub || '', AREA: 'Lotto B' });
    return [
      A('B0000', 'Inizio lavori', 'W-PMIL', { type: 'start', as: '2026-03-02', af: '2026-03-02', pct: 100, codes: C('GES') }),
      A('B2010', 'Paratie e diaframmi', 'W-POPC', { od: 45, as: '2026-03-02', af: '2026-05-08', pct: 100, codes: C('CIV', 'SUB-11'), costs: [L('SUB-11 Paratie', 'Diaframmi in c.a. sp. 60 cm', 'Diaframmi', 'm²', 3100, 118, { kind: 'Subappalto', qtyDone: 3100, actual: 383000, withLabor: true })] }),
      A('B2020', 'Scavo e puntoni', 'W-POPC', { od: 40, as: '2026-05-11', af: '2026-07-31', pct: 100, codes: C('CIV', 'SUB-01'), costs: [L('SUB-01 Subappalto scavi', 'Scavo in presenza di paratie', 'Terre e rocce da scavo', 'm³', 18500, 13, { kind: 'Subappalto', qtyDone: 18500, actual: 258000, withLabor: true })] }),
      A('B2030', 'Platea di fondazione', 'W-PSTR', { od: 35, as: '2026-08-24', rd: 7, pct: 90, codes: C('CIV'), assign: [S('r_ferr', 24, 840, 700, 168)], costs: [L('FOR-04 Fornitore calcestruzzo', 'Calcestruzzo per platea', 'Calcestruzzo C30/37', 'm³', 2100, 112, { qtyDone: 1890, actual: 196000 })] }),
      A('B2040', 'Solette di copertura', 'W-PSTR', { od: 55, codes: C('CIV'), assign: [S('r_carp', 16, 880, 0, 880, { curve: 'uniform' })], costs: [L('FOR-04 Fornitore calcestruzzo', 'Calcestruzzo per solette', 'Calcestruzzo C30/37', 'm³', 1600, 112)] }),
      A('B2050', 'Impermeabilizzazioni e rinterri', 'W-PSTR', { od: 17, codes: C('CIV', 'SUB-07'), costs: [L('SUB-07 Coperture', 'Impermeabilizzazione estradosso', 'Guaina bituminosa', 'm²', 2400, 38, { kind: 'Subappalto', withLabor: true })] }),
      A('B2060', 'Impianti, segnaletica e finiture', 'W-PFIN', { od: 25, codes: C('IMP', 'SUB-06'), costs: [L('SUB-06 Impianti elettrici', 'Illuminazione, ventilazione e antincendio', '', 'a corpo', 1, 210000, { kind: 'Subappalto', withLabor: true })] }),
      A('B2999', 'Fine lavori', 'W-PMIL', { type: 'finish', codes: C('GES') })
    ];
  }
  function pkbRels() { return [R('B0000', 'B2010'), R('B2010', 'B2020'), R('B2020', 'B2030'), R('B2030', 'B2040'), R('B2040', 'B2050'), R('B2040', 'B2060', 'SS', 35), R('B2050', 'B2999'), R('B2060', 'B2999')]; }

  function vacWbs() {
    return [
      { id: 'W-VAC', code: 'VA-C', name: 'Viabilità di accesso C', parent: null },
      { id: 'W-VMIL', code: 'MIL', name: 'Milestone', parent: 'W-VAC' },
      { id: 'W-VSTR', code: 'STR', name: 'Corpo stradale', parent: 'W-VAC' },
      { id: 'W-VPAV', code: 'PAV', name: 'Pavimentazioni e segnaletica', parent: 'W-VAC' }
    ];
  }
  function vacActivities() {
    const C = (ph, sub) => ({ PHAS: ph, SUB: sub || '', AREA: 'Esterno' });
    return [
      A('C0000', 'Inizio lavori', 'W-VMIL', { type: 'start', as: '2026-07-01', af: '2026-07-01', pct: 100, codes: C('GES') }),
      A('C3010', 'Bonifica e scotico', 'W-VSTR', { od: 15, as: '2026-07-01', af: '2026-07-21', pct: 100, codes: C('CIV', 'SUB-01'), costs: [L('SUB-01 Subappalto scavi', 'Scotico e bonifica', 'Terre e rocce da scavo', 'm³', 4200, 12, { kind: 'Subappalto', qtyDone: 4200, actual: 49500, withLabor: true })] }),
      A('C3020', 'Rilevato e sottofondo', 'W-VSTR', { od: 30, as: '2026-07-22', af: '2026-09-25', pct: 100, codes: C('CIV', 'SUB-01'), costs: [L('SUB-01 Subappalto scavi', 'Rilevato in misto granulare', 'Misto granulare', 'm³', 7600, 19, { kind: 'Subappalto', qtyDone: 7600, actual: 141000, withLabor: true })] }),
      A('C3030', 'Sottoservizi e drenaggi', 'W-VSTR', { od: 25, as: '2026-09-28', rd: 6, pct: 76, codes: C('CIV', 'SUB-12'), costs: [L('SUB-12 Sottoservizi', 'Fognature, drenaggi e polifore', 'Tubazioni', 'm', 1800, 85, { kind: 'Subappalto', qtyDone: 1370, actual: 113500, withLabor: true })] }),
      A('C3040', 'Pavimentazione bituminosa', 'W-VPAV', { od: 18, codes: C('CIV', 'SUB-13'), costs: [L('SUB-13 Asfalti', 'Binder e tappeto di usura', 'Asfalto', 'm²', 9500, 16, { kind: 'Subappalto', withLabor: true })] }),
      A('C3050', 'Segnaletica e barriere', 'W-VPAV', { od: 7, codes: C('FIN', 'SUB-13'), costs: [L('SUB-13 Asfalti', 'Segnaletica orizzontale, verticale e barriere', '', 'a corpo', 1, 46000, { kind: 'Subappalto', withLabor: true })] }),
      A('C3999', 'Fine lavori', 'W-VMIL', { type: 'finish', codes: C('GES') })
    ];
  }
  function vacRels() { return [R('C0000', 'C3010'), R('C3010', 'C3020'), R('C3020', 'C3030'), R('C3030', 'C3040'), R('C3040', 'C3050'), R('C3050', 'C3999')]; }

  function project(o) {
    return Object.assign({
      rateType: 'Price/Unit', calId: 'cal5', periodsCal: 'Mensile 2026-27', defaults: { durType: 'FDU', pctType: 'phys', actType: 'task' },
      wbs: [], activities: [], rels: [], drawings: [], baselines: {}, versions: [], version: 1, dirty: false, sched: null,
      progress: [], proposals: [], issues: [], risks: [], thresholds: [], changes: [], periodHistory: [], layouts: [], notes: []
    }, o);
  }

  /* toglie l'avanzamento: serve per costruire la baseline */
  function strip(p) {
    p.activities.forEach((a) => {
      delete a.as; delete a.af; delete a.rd; a.pct = 0;
      (a.steps || []).forEach((s) => { s.pct = 0; });
      (a.assign || []).forEach((x) => { x.act = 0; x.rem = x.bud; });
      (a.costs || []).forEach((l) => { l.qtyDone = 0; l.actual = 0; });
    });
    return p;
  }

  function build() {
    const settings = {
      criticalMode: 'LP', tfThreshold: 0, subOn: true, subThreshold: 10, recalcMode: 'manual', lagCal: 'pred', oos: 'retained',
      guideMode: true, expert: true, window: { before: 5, after: 3 }, evTechnique: 'pct', eacMethod: 'cpi', systemDate: '',
      dcma: { logic: 5, leads: 0, lags: 5, fs: 90, hard: 5, highFloat: 44, highFloatPct: 5, negFloat: 0, highDur: 44, highDurPct: 5, invalid: 0, resources: 5, missed: 5, cpli: 0.95, bei: 0.95 },
      traceColors: { back: '#7a3fc4', fwd: '#0b7f86' }
    };
    const db = {
      meta: { app: 'Meridian', schema: 1, createdAt: U.nowStamp(), demo: true },
      settings,
      users: [
        { id: 'u1', name: 'Simo', role: 'admin', obs: 'o1', email: '' },
        { id: 'u2', name: 'Controllo costi', role: 'controller', obs: 'o4', email: '' },
        { id: 'u3', name: 'Capocantiere ED-A', role: 'field', obs: 'o5', email: '' },
        { id: 'u4', name: 'Direzione tecnica', role: 'viewer', obs: 'o2', email: '' }
      ],
      currentUser: 'u1',
      obs: [
        { id: 'o1', name: 'Impresa', parent: null }, { id: 'o2', name: 'Direzione tecnica', parent: 'o1' }, { id: 'o3', name: 'Planning e controllo', parent: 'o2' },
        { id: 'o4', name: 'Controllo costi', parent: 'o2' }, { id: 'o5', name: 'Cantiere Edificio A', parent: 'o2' }, { id: 'o6', name: 'Cantiere Parcheggio B', parent: 'o2' },
        { id: 'o9', name: 'Cantiere Viabilità C', parent: 'o2' }, { id: 'o7', name: 'Acquisti', parent: 'o1' }, { id: 'o8', name: 'Direzione lavori', parent: 'o1' }
      ],
      eps: [
        { id: 'e0', code: 'ENT', name: 'Enterprise', parent: null, kind: 'node' },
        { id: 'eA', code: 'ED-A', name: 'Edificio A', parent: 'e0', kind: 'node', obs: 'o5' },
        { id: 'eA_b', code: 'ED-A.BASE', name: 'BASE', parent: 'eA', kind: 'BASE' }, { id: 'eA_c', code: 'ED-A.CURR', name: 'CURR', parent: 'eA', kind: 'CURR' }, { id: 'eA_k', code: 'ED-A.BKG', name: 'BKG', parent: 'eA', kind: 'BKG' },
        { id: 'eB', code: 'PK-B', name: 'Parcheggio interrato B', parent: 'e0', kind: 'node', obs: 'o6' },
        { id: 'eB_b', code: 'PK-B.BASE', name: 'BASE', parent: 'eB', kind: 'BASE' }, { id: 'eB_c', code: 'PK-B.CURR', name: 'CURR', parent: 'eB', kind: 'CURR' }, { id: 'eB_k', code: 'PK-B.BKG', name: 'BKG', parent: 'eB', kind: 'BKG' },
        { id: 'eC', code: 'VA-C', name: 'Viabilità di accesso C', parent: 'e0', kind: 'node', obs: 'o9' },
        { id: 'eC_b', code: 'VA-C.BASE', name: 'BASE', parent: 'eC', kind: 'BASE' }, { id: 'eC_c', code: 'VA-C.CURR', name: 'CURR', parent: 'eC', kind: 'CURR' }, { id: 'eC_k', code: 'VA-C.BKG', name: 'BKG', parent: 'eC', kind: 'BKG' }
      ],
      calendars: calendars(),
      resources: [
        { id: 'g_lab', code: 'LAB', name: 'Manodopera (Labor)', group: true, parent: null },
        { id: 'r_carp', code: 'CARP', name: 'Squadra carpentieri', type: 'Labor', parent: 'g_lab', unit: 'h', price: 38.5, defUpd: 72, maxUpd: 80, calId: 'cal5', note: 'squadra fino a 10 persone', role: 'Carpentiere', autoActuals: false },
        { id: 'r_ferr', code: 'FERR', name: 'Squadra ferraioli', type: 'Labor', parent: 'g_lab', unit: 'h', price: 36, defUpd: 32, maxUpd: 40, calId: 'cal5', role: 'Ferraiolo' },
        { id: 'r_elet', code: 'ELET', name: 'Elettricisti', type: 'Labor', parent: 'g_lab', unit: 'h', price: 35, defUpd: 16, maxUpd: 24, calId: 'cal5', role: 'Elettricista' },
        { id: 'r_capo', code: 'CAPO', name: 'Capocantiere', type: 'Labor', parent: 'g_lab', unit: 'h', price: 45, defUpd: 8, maxUpd: 10, calId: 'cal5', role: 'Capocantiere', note: 'con straordinari fino a 10 h/g' },
        { id: 'g_nl', code: 'NL', name: 'Mezzi (Nonlabor)', group: true, parent: null },
        { id: 'r_gru', code: 'GRU', name: 'Gru a torre', type: 'Nonlabor', parent: 'g_nl', unit: 'h', price: 65, defUpd: 8, maxUpd: 8, calId: 'cal5' },
        { id: 'r_esc', code: 'ESC', name: 'Escavatore', type: 'Nonlabor', parent: 'g_nl', unit: 'h', price: 55, defUpd: 8, maxUpd: 16, calId: 'cal5' },
        { id: 'g_mat', code: 'MAT', name: 'Materiali (Material)', group: true, parent: null },
        { id: 'r_cls', code: 'CLS', name: 'Calcestruzzo C30/37', type: 'Material', parent: 'g_mat', unit: 'm³', price: 112, defUpd: 20, maxUpd: 0, calId: 'cal5' },
        { id: 'r_acc', code: 'ACC', name: 'Acciaio B450C', type: 'Material', parent: 'g_mat', unit: 't', price: 1050, defUpd: 0, maxUpd: 0, calId: 'cal5' }
      ],
      roles: [{ id: 'ro1', name: 'Carpentiere' }, { id: 'ro2', name: 'Ferraiolo' }, { id: 'ro3', name: 'Elettricista' }, { id: 'ro4', name: 'Capocantiere' }],
      codeTypes: [
        { id: 'PHAS', name: 'Fase', scope: 'global', values: [{ code: 'PROG', desc: 'Progettazione' }, { code: 'APP', desc: 'Approvvigionamenti' }, { code: 'CIV', desc: 'Opere civili' }, { code: 'IMP', desc: 'Impianti' }, { code: 'FIN', desc: 'Finiture' }, { code: 'EST', desc: 'Esterni' }, { code: 'GES', desc: 'Gestione' }] },
        { id: 'SUB', name: 'Fornitore', scope: 'global', values: [{ code: 'SUB-01', desc: 'Subappalto scavi' }, { code: 'SUB-03', desc: 'Subappalto fondazioni' }, { code: 'SUB-05', desc: 'Impianti meccanici' }, { code: 'SUB-06', desc: 'Impianti elettrici' }, { code: 'SUB-07', desc: 'Coperture' }, { code: 'SUB-08', desc: 'Finiture' }, { code: 'FOR-02', desc: 'Fornitore acciaio' }, { code: 'FOR-09', desc: 'Serramenti' }, { code: 'SUB-11', desc: 'Paratie' }, { code: 'SUB-12', desc: 'Sottoservizi' }, { code: 'SUB-13', desc: 'Asfalti' }] },
        { id: 'AREA', name: 'Area', scope: 'project', values: [{ code: 'Lotto A', desc: 'Lotto A' }, { code: 'Lotto B', desc: 'Lotto B' }, { code: 'Esterno', desc: 'Aree esterne' }] }
      ],
      udfTypes: [{ id: 'u_d10', name: 'Durata 10%', type: 'number', unit: 'g' }, { id: 'u_sem', name: 'Semaforo', type: 'indicator' }, { id: 'u_dl', name: 'Note DL', type: 'text' }],
      curves: [{ id: 'cv_cls', name: 'Getti con picco centrale', w: [3, 6, 10, 14, 17, 17, 14, 10, 6, 3] }],
      costAccounts: [
        { id: 'CBS-01', code: 'CBS-01', name: 'Progettazione e servizi tecnici' }, { id: 'CBS-02', code: 'CBS-02', name: 'Opere civili in subappalto' },
        { id: 'CBS-03', code: 'CBS-03', name: 'Materiali da costruzione' }, { id: 'CBS-04', code: 'CBS-04', name: 'Impianti' },
        { id: 'CBS-05', code: 'CBS-05', name: 'Finiture e involucro' }, { id: 'CBS-06', code: 'CBS-06', name: 'Oneri, spese generali e collaudi' }, { id: 'CBS-07', code: 'CBS-07', name: 'Manodopera e mezzi propri' }
      ],
      materials: [],
      periods: [],
      projects: [],
      activeProject: 'pA'
    };
    /* financial periods mensili giugno 2026 - dicembre 2027 */
    for (let k = U.monthKey(U.dnOf('2026-01-01')); k <= U.monthKey(U.dnOf('2027-12-01')); k++) {
      const s = U.monthStart(k);
      db.periods.push({ id: 'fp' + k, name: U.MONTHS_L[k % 12] + ' ' + Math.floor(k / 12), start: U.isoOf(s), end: U.isoOf(U.lastOfMonth(s)), stored: U.lastOfMonth(s) < U.dnOf('2026-10-01') });
    }

    const drawings = [
      { id: 'T-STR001', code: 'STR-001', title: 'Pianta fondazioni e pali', rev: 'C', date: '2026-09-15', link: '', history: [{ rev: 'A', date: '2026-05-20' }, { rev: 'B', date: '2026-07-10' }, { rev: 'C', date: '2026-09-15' }] },
      { id: 'T-STR010', code: 'STR-010', title: 'Carpenterie piano tipo', rev: 'B', date: '2026-10-20', link: '', history: [{ rev: 'A', date: '2026-06-30' }, { rev: 'B', date: '2026-10-20' }], changedAt: '2026-10-20' },
      { id: 'T-ARC100', code: 'ARC-100', title: 'Piante architettoniche', rev: 'D', date: '2026-09-30', link: '', history: [{ rev: 'C', date: '2026-07-15' }, { rev: 'D', date: '2026-09-30' }] },
      { id: 'T-IMPM01', code: 'IMP-M-01', title: 'Schema impianto meccanico', rev: 'A', date: '2026-10-10', link: '', history: [{ rev: 'A', date: '2026-10-10' }] },
      { id: 'T-IMPE01', code: 'IMP-E-01', title: 'Schema impianto elettrico', rev: 'A', date: '2026-10-12', link: '', history: [{ rev: 'A', date: '2026-10-12' }] },
      { id: 'T-EST01', code: 'EST-01', title: 'Sistemazioni esterne', rev: 'B', date: '2026-10-01', link: '', history: [{ rev: 'A', date: '2026-06-15' }, { rev: 'B', date: '2026-10-01' }] }
    ];

    const pA = project({ id: 'pA', code: 'ED-A_2026-10-31', name: 'Edificio A - programma corrente', work: 'ED-A', workName: 'Edificio A', epsId: 'eA_c', status: 'CURR', obsId: 'o5', plannedStart: '2026-06-01', mustFinish: '2027-09-30', dataDate: '2026-10-31', contractValue: 5300000, nextCutoff: '2026-11-30', wbs: edaWbs(), activities: edaActivities(), rels: edaRels(), drawings: U.clone(drawings), cycleStep: 3 });
    pA.issues = [
      { id: 'I-014', title: 'SPI 0,80 sotto soglia 0,90 su ED-A.CIV', prio: 'Alta', status: 'Aperto', owner: 'Direzione tecnica', source: 'soglia', created: '2026-10-31', actId: 'A1020' },
      { id: 'I-015', title: 'Total float negativo su ED-A', prio: 'Alta', status: 'Aperto', owner: 'Planner', source: 'soglia', created: '2026-10-31', actId: 'M1999' },
      { id: 'I-016', title: 'CPI 0,87 sotto soglia 0,95 su ED-A', prio: 'Media', status: 'Aperto', owner: 'Controllo costi', source: 'soglia', created: '2026-10-31' },
      { id: 'I-011', title: 'Ritardo consegna acciaio B450C', prio: 'Media', status: 'Aperto', owner: 'Acquisti', source: 'manuale', created: '2026-10-12', actId: 'A1015' },
      { id: 'I-012', title: 'Interferenza sottoservizi lato nord', prio: 'Bassa', status: 'Aperto', owner: 'Direzione lavori', source: 'manuale', created: '2026-09-02', actId: 'A1020' }
    ];
    pA.risks = [
      { id: 'R-03', title: 'Ritardo fornitura acciaio', type: 'minaccia', p: 4, i: 4, response: 'Mitigate', owner: 'Acquisti', note: 'Secondo fornitore qualificato in attesa di ordine.', acts: ['A1015', 'A1030'] },
      { id: 'R-05', title: 'Maltempo invernale sui getti', type: 'minaccia', p: 4, i: 3, response: 'Accept', owner: 'Cantiere', note: 'Additivi antigelo previsti nel prezzo.', acts: ['A1030'] },
      { id: 'R-07', title: 'Solai prefabbricati', type: 'opportunità', p: 3, i: 3, response: 'Exploit', owner: 'Direzione tecnica', note: 'Possibile riduzione di 8 g su A1030.', acts: ['A1030'] }
    ];
    pA.thresholds = [
      { id: 'th1', param: 'SPI', wbsId: 'W-CIV', op: '<', value: 0.9, prio: 'Alta', owner: 'Direzione tecnica' },
      { id: 'th2', param: 'TF', wbsId: 'W-EDA', op: '<', value: 0, prio: 'Alta', owner: 'Planner' },
      { id: 'th3', param: 'CPI', wbsId: 'W-EDA', op: '<', value: 0.95, prio: 'Media', owner: 'Controllo costi' }
    ];
    pA.changes = [
      { id: 'EX-01', type: 'Extra', title: 'Bonifica sottoservizi lato nord', amount: 32000, status: 'Approvata', date: '2026-09-20' },
      { id: 'V-01', type: 'Variante', title: 'Solai prefabbricati al posto del getto in opera', amount: -45000, status: 'Proposta', date: '2026-10-25' }
    ];
    pA.progress = [
      { id: 'pg1', actId: 'A1040', by: 'u3', at: '2026-10-31T16:20:00Z', status: 'Inviato', values: { started: true, as: '2026-11-05', pct: 0, rd: 63 }, note: 'Inizio previsto con le prime linee in centrale termica.', photos: [] },
      { id: 'pg2', actId: 'A1020', by: 'u3', at: '2026-10-31T15:05:00Z', status: 'Inviato', values: { started: true, as: '2026-09-21', pct: 70, rd: 12 }, note: 'Casserature al 50%, getto previsto il 10/11.', photos: [] }
    ];
    pA.proposals = [{ id: 'pr1', by: 'u3', at: '2026-10-30T11:00:00Z', status: 'Inviata', kind: 'durata', actId: 'A1025', text: 'Rinterri: proposta durata 12 g (mezzi aggiuntivi disponibili).', payload: { od: 12 } }];
    pA.notes = [{ at: '2026-10-31T17:40:00Z', by: 'Simo', period: 'fp' + U.monthKey(U.dnOf('2026-10-01')), text: 'Ottobre: rallentamento fondazioni per interferenza sottoservizi; distributore ha spostato l\'allaccio di 10 g.' }];
    pA.layouts = [
      { id: 'ly1', name: 'Lavoro - per WBS', cols: ['code', 'name', 'od', 'start', 'finish', 'tf', 'pct', 'driverPred', 'driverType', 'drivenCount'], group: 'wbs', filter: 'all' },
      { id: 'ly2', name: 'Revisione con totali', cols: ['code', 'name', 'od', 'start', 'finish', 'blFinish', 'varFinish', 'tf', 'budget', 'ev', 'ac'], group: 'wbs', filter: 'all' },
      { id: 'ly3', name: 'Stampa committente', cols: ['code', 'name', 'start', 'finish', 'blFinish', 'pct'], group: 'wbs', filter: 'all' }
    ];

    const pB = project({ id: 'pB', code: 'PK-B_2026-10-31', name: 'Parcheggio interrato B - programma corrente', work: 'PK-B', workName: 'Parcheggio interrato B', epsId: 'eB_c', status: 'CURR', obsId: 'o6', plannedStart: '2026-03-02', mustFinish: '', dataDate: '2026-10-31', contractValue: 2150000, nextCutoff: '2026-11-30', wbs: pkbWbs(), activities: pkbActivities(), rels: pkbRels(), cycleStep: 6 });
    const pC = project({ id: 'pC', code: 'VA-C_2026-10-31', name: 'Viabilità di accesso C - programma corrente', work: 'VA-C', workName: 'Viabilità di accesso C', epsId: 'eC_c', status: 'CURR', obsId: 'o9', plannedStart: '2026-07-01', mustFinish: '', dataDate: '2026-10-31', contractValue: 820000, nextCutoff: '2026-11-30', wbs: vacWbs(), activities: vacActivities(), rels: vacRels(), cycleStep: 6 });

    /* baseline: copie senza avanzamento, con le durate e le date contrattuali */
    const blA = strip(U.clone(pA));
    Object.assign(blA, { id: 'pA_bl', code: 'ED-A_BL01', name: 'Edificio A - baseline contrattuale', epsId: 'eA_b', status: 'BASE', dataDate: '2026-05-31', savedAt: '2026-05-29', issues: [], risks: [], progress: [], proposals: [], changes: [], notes: [], periodHistory: [], layouts: [], thresholds: [] });
    blA.activities.find((a) => a.id === 'A1085').cstr = { t: 'SNET', d: '2027-07-16' };
    blA.activities.find((a) => a.id === 'A1030').od = 127;
    const blB = strip(U.clone(pB));
    Object.assign(blB, { id: 'pB_bl', code: 'PK-B_BL01', name: 'Parcheggio interrato B - baseline', epsId: 'eB_b', status: 'BASE', dataDate: '2026-02-27', savedAt: '2026-02-25', issues: [], risks: [], progress: [], proposals: [], periodHistory: [], layouts: [] });
    [['B2010', 48], ['B2020', 59], ['B2030', 70], ['B2040', 48], ['B2050', 18], ['B2060', 25]].forEach(([id, od]) => { blB.activities.find((a) => a.id === id).od = od; });
    const blC = strip(U.clone(pC));
    blC.activities.find((a) => a.id === 'C3020').od = 44;
    Object.assign(blC, { id: 'pC_bl', code: 'VA-C_BL01', name: 'Viabilità di accesso C - baseline', epsId: 'eC_b', status: 'BASE', dataDate: '2026-06-30', savedAt: '2026-06-26', issues: [], risks: [], progress: [], proposals: [], periodHistory: [], layouts: [] });

    /* copia del cut-off precedente (30/09/26) */
    const sep = U.clone(pA);
    Object.assign(sep, { id: 'pA_0930', code: 'ED-A_2026-09-30', name: 'Edificio A - cut-off settembre', epsId: 'eA_k', status: 'BKG', dataDate: '2026-09-30', issues: [], progress: [], proposals: [], periodHistory: [], layouts: [], notes: [], changes: [] });
    (function () {
      const g = (id) => sep.activities.find((a) => a.id === id);
      g('A1085').cstr = { t: 'SNET', d: '2027-07-16' };
      Object.assign(g('A1020'), { rd: 28, pct: 15 });
      g('A1020').steps.forEach((s, i) => { s.pct = i === 0 ? 75 : 0; });
      g('A1020').assign.forEach((x) => { x.act = Math.round(x.act * 0.2); x.rem = x.bud - x.act; });
      g('A1020').costs.forEach((l) => { l.qtyDone = Math.round(l.qtyDone * 0.2); l.actual = Math.round(l.actual * 0.2); });
      Object.assign(g('A1015'), { rd: 28, pct: 5 });
      g('A1015').costs.forEach((l) => { l.qtyDone = 0; l.actual = 0; });
      const a19 = g('A1900'); a19.assign.forEach((x) => { x.act = 616; x.rem = x.bud - 616; }); a19.costs.forEach((l) => { l.qtyDone = 4; l.actual = 18500; });
    })();
    sep.savedAt = '2026-09-30';
    const scen = U.clone(pA);
    Object.assign(scen, { id: 'pA_sc', code: 'ED-A_scenario+10%', name: 'Edificio A - scenario durate +10%', epsId: 'eA_k', status: 'BKG', issues: [], progress: [], proposals: [], periodHistory: [], layouts: [], notes: [], changes: [], savedAt: '2026-10-18' });
    scen.activities.forEach((a) => { if (a.af || a.type === 'loe' || M.CPM.isMile(a)) return; if (a.as) a.rd = Math.round((a.rd || 0) * 1.1); else a.od = Math.round((a.od || 0) * 1.1); });

    pA.baselines = { project: 'pA_bl', primary: 'pA_bl', secondary: 'pA_0930', tertiary: '' };
    pB.baselines = { project: 'pB_bl', primary: 'pB_bl', secondary: '', tertiary: '' };
    pC.baselines = { project: 'pC_bl', primary: 'pC_bl', secondary: '', tertiary: '' };
    db.projects = [pA, pB, pC, blA, blB, blC, sep, scen];

    /* schedulazione iniziale di tutti i progetti */
    const opt = { criticalMode: settings.criticalMode, tfThreshold: settings.tfThreshold, subOn: settings.subOn, subThreshold: settings.subThreshold, lagCal: settings.lagCal, oos: settings.oos };
    db.projects.forEach((p) => { p.sched = M.CPM.schedule(p, db, opt); });
    const stamp = { pA: '2026-10-31T16:42:00Z', pB: '2026-10-31T10:15:00Z', pC: '2026-10-30T15:30:00Z', pA_bl: '2026-05-29T10:00:00Z', pB_bl: '2026-02-25T09:00:00Z', pC_bl: '2026-06-26T09:00:00Z', pA_0930: '2026-09-30T17:20:00Z', pA_sc: '2026-10-18T11:05:00Z' };
    db.projects.forEach((p) => { p.sched.ranAt = stamp[p.id]; p.sched.ranBy = 'Simo'; });

    /* storico di periodo (Store Period Performance) per le curve di EV e AC */
    const hist = (p, bl, trend) => {
      const out = [];
      trend.forEach(([end, spi, cpi]) => {
        const pv = M.Costs.plannedSpread(bl, bl.sched, db, U.dnOf(end));
        const ev = pv * spi; const ac = cpi ? ev / cpi : 0;
        out.push({ periodId: 'fp' + U.monthKey(U.dnOf(end)), end, pv: Math.round(pv), ev: Math.round(ev), ac: Math.round(ac), spi, cpi });
      });
      p.periodHistory = out;
    };
    hist(pA, blA, [['2026-06-30', 1.0, 0.99], ['2026-07-31', 0.99, 0.96], ['2026-08-31', 0.96, 0.93], ['2026-09-30', 0.9, 0.9]]);
    hist(pB, blB, [['2026-03-31', 1.0, 1.0], ['2026-04-30', 1.01, 0.99], ['2026-05-31', 1.02, 0.99], ['2026-06-30', 1.03, 0.98], ['2026-07-31', 1.04, 0.98], ['2026-08-31', 1.03, 0.98], ['2026-09-30', 1.03, 0.98]]);
    hist(pC, blC, [['2026-07-31', 1.0, 1.01], ['2026-08-31', 1.0, 1.02], ['2026-09-30', 1.0, 1.02]]);

    /* storico versioni */
    pA.versions = [
      { n: 1, at: '2026-06-30T17:00:00Z', by: 'Simo', note: 'Aggiornamento giugno', finish: '2027-09-30' },
      { n: 2, at: '2026-07-31T17:10:00Z', by: 'Simo', note: 'Aggiornamento luglio', finish: '2027-09-30' },
      { n: 3, at: '2026-08-31T16:55:00Z', by: 'Simo', note: 'Aggiornamento agosto', finish: '2027-10-01' },
      { n: 4, at: '2026-09-30T17:20:00Z', by: 'Simo', note: 'Aggiornamento settembre', finish: U.isoOf(sep.sched.finishDay) },
      { n: 5, at: '2026-10-31T16:42:00Z', by: 'Simo', note: 'Aggiornamento ottobre: fondazioni in ritardo, allaccio posticipato', finish: U.isoOf(pA.sched.finishDay), snap: snapOf(pA) }
    ];
    pA.version = 5;
    pB.versions = [{ n: 1, at: '2026-10-31T10:15:00Z', by: 'Simo', note: 'Aggiornamento ottobre', finish: U.isoOf(pB.sched.finishDay), snap: snapOf(pB) }];
    pC.versions = [{ n: 1, at: '2026-10-30T15:30:00Z', by: 'Simo', note: 'Aggiornamento ottobre', finish: U.isoOf(pC.sched.finishDay), snap: snapOf(pC) }];
    return db;
  }

  function snapOf(p) {
    const s = {};
    if (!p.sched || !p.sched.acts) return s;
    Object.keys(p.sched.acts).forEach((id) => { const r = p.sched.acts[id]; s[id] = [r.es, r.ef, r.tf, r.crit ? 1 : 0]; });
    return s;
  }

  M.Demo = { build, snapOf, strip };
})(window.M = window.M || {});
