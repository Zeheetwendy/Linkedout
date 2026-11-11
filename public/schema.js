// Gedeeld door de browser en de server: soorten posts, hun velden en de controles daarop.
// Eén bron, zodat de server nooit iets accepteert wat het formulier niet toestaat.
(function (root) {
  'use strict';

  var TYPES = {
    vertrek: { label: 'Vertrek', cta: 'Plaats je vertrek' },
    meeting: { label: 'Zinloze meeting', cta: 'Plaats de meeting' },
    mens: { label: 'Mens-review', cta: 'Plaats je review' },
    tip: { label: 'Echt-tip', cta: 'Plaats je tip' },
    irritant: { label: 'Bloedirritant', cta: 'Plaats je ergernis' },
  };

  var REACTIONS = [
    { id: 'herkenbaar', label: 'Herkenbaar' },
    { id: 'au', label: 'Au' },
    { id: 'respect', label: 'Respect' },
  ];

  var FORMS = {
    vertrek: [
      { id: 'waar', label: 'Bij welk bedrijf of soort bedrijf?', kind: 'text', max: 60, required: true, half: true, placeholder: 'Bijv. een verzekeraar' },
      { id: 'functie', label: 'Als wat?', kind: 'text', max: 60, half: true, placeholder: 'Bijv. teamleider' },
      { id: 'zei', label: 'Wat je zei bij je afscheid', kind: 'area', max: 240, rows: 2, required: true, nep: false, placeholder: 'Bijv. "Ik ben toe aan een nieuwe uitdaging."' },
      { id: 'echt', label: 'Wat er echt speelde', kind: 'area', max: 600, rows: 4, required: true },
    ],
    meeting: [
      { id: 'onderwerp', label: 'Waar ging het over?', kind: 'text', max: 80, required: true, placeholder: 'Bijv. voorbespreking van de kwartaalreview' },
      { id: 'mensen', label: 'Aantal mensen', kind: 'number', min: 2, max: 500, required: true, half: true },
      { id: 'minuten', label: 'Duur in minuten', kind: 'number', min: 5, max: 600, required: true, half: true },
      { id: 'alt', label: 'Wat het had kunnen zijn', kind: 'select', required: true, options: ['een mail', 'een appje', 'vijf minuten bij de koffie', 'helemaal niets'] },
      { id: 'tekst', label: 'Wat gebeurde er?', kind: 'area', max: 400, rows: 3 },
    ],
    mens: [
      { id: 'rol', label: 'Wie was het voor jou?', kind: 'select', required: true, half: true, options: ['leidinggevende', 'collega', 'directeur', 'HR-medewerker', 'recruiter', 'klant', 'stagebegeleider'] },
      { id: 'context', label: 'Soort werkplek', kind: 'text', max: 60, half: true, placeholder: 'Bijv. een gemeente' },
      { id: 'score', label: 'Hoe was het om met diegene te werken?', kind: 'score', required: true },
      { id: 'tekst', label: 'Wat deed diegene, en wat deed dat met jou?', kind: 'area', max: 600, rows: 4, required: true, hint: 'Zonder naam. Beschrijf gedrag dat je zelf meemaakte.' },
    ],
    tip: [
      { id: 'tekst', label: 'Je tip', kind: 'area', max: 400, rows: 3, required: true, placeholder: 'Bijv. zeg hardop "ik snap dit niet".' },
    ],
    irritant: [
      { id: 'ding', label: 'Wat vinden we normaal?', kind: 'area', max: 240, rows: 2, required: true, placeholder: 'Bijv. een mail op vrijdag om 16:45 met "even snel".' },
      { id: 'beter', label: 'Wat zou je liever zien?', kind: 'area', max: 240, rows: 2 },
    ],
  };

  var ALIAS_MIN = 3;
  var ALIAS_MAX = 30;
  var PASSWORD_MIN = 10;
  var PASSWORD_MAX = 200;

  function plain(raw) {
    return typeof raw === 'string' || typeof raw === 'number' ? String(raw).trim() : '';
  }

  // Geeft { value } of { error } terug. Een leeg, niet-verplicht veld geeft { value: undefined }.
  function validateField(f, raw) {
    var val = plain(raw);
    if (!val) {
      if (!f.required) return { value: undefined };
      return { error: f.kind === 'score' ? 'Kies een cijfer van 1 tot 5.' : f.kind === 'select' ? 'Kies er één.' : 'Vul dit nog in.' };
    }
    if (f.kind === 'number' || f.kind === 'score') {
      var min = f.kind === 'score' ? 1 : f.min;
      var max = f.kind === 'score' ? 5 : f.max;
      var n = Number(val);
      if (!isFinite(n) || Math.round(n) !== n || n < min || n > max) {
        return { error: 'Vul een heel getal in van ' + min + ' tot ' + max + '.' };
      }
      return { value: n };
    }
    if (f.kind === 'select') {
      return f.options.indexOf(val) === -1 ? { error: 'Kies er één.' } : { value: val };
    }
    if (val.length > f.max) return { error: 'Maximaal ' + f.max + ' tekens.' };
    return { value: val };
  }

  // Geeft { data } terug als alles klopt, anders { errors: { veld: melding } }.
  function validatePost(type, raw) {
    var fields = Object.prototype.hasOwnProperty.call(FORMS, type) ? FORMS[type] : null;
    if (!fields) return { errors: { type: 'Onbekende soort post.' } };
    var input = raw && typeof raw === 'object' ? raw : {};
    var data = {};
    var errors = {};
    var bad = false;
    fields.forEach(function (f) {
      var res = validateField(f, input[f.id]);
      if (res.error) { errors[f.id] = res.error; bad = true; }
      else if (res.value !== undefined) data[f.id] = res.value;
    });
    return bad ? { errors: errors } : { data: data };
  }

  function validateAlias(raw) {
    var val = typeof raw === 'string' ? raw.trim().replace(/\s+/g, ' ') : '';
    if (val.length < ALIAS_MIN || val.length > ALIAS_MAX) {
      return { error: 'Kies een schuilnaam van ' + ALIAS_MIN + ' tot ' + ALIAS_MAX + ' tekens.' };
    }
    if (!/^[A-Za-zÀ-ÖØ-öø-ÿ0-9][A-Za-zÀ-ÖØ-öø-ÿ0-9 '-]*$/.test(val)) {
      return { error: 'Gebruik alleen letters, cijfers, spaties en streepjes.' };
    }
    return { value: val };
  }

  function validatePassword(raw) {
    var val = typeof raw === 'string' ? raw : '';
    if (val.length < PASSWORD_MIN) return { error: 'Kies een wachtwoord van minstens ' + PASSWORD_MIN + ' tekens.' };
    if (val.length > PASSWORD_MAX) return { error: 'Maximaal ' + PASSWORD_MAX + ' tekens.' };
    return { value: val };
  }

  var api = {
    TYPES: TYPES,
    REACTIONS: REACTIONS,
    FORMS: FORMS,
    validateField: validateField,
    validatePost: validatePost,
    validateAlias: validateAlias,
    validatePassword: validatePassword,
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.LINKEDOUT_SCHEMA = api;
})(typeof window !== 'undefined' ? window : globalThis);
