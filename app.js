(function () {
  'use strict';

  var STORE_KEY = 'linkedout.v1';
  var SEED = window.LINKEDOUT_SEED || [];
  var HOUR = 3600 * 1000;

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

  // Kantoortaal en wat je ook gewoon kunt zeggen. Langste termen eerst gematcht.
  var NEP = [
    ['trots om aan te kondigen', 'ik heb nieuws'],
    ['dankbaar voor de kansen', 'bedankt'],
    ['stip op de horizon', 'doel'],
    ['laaghangend fruit', 'het makkelijke werk'],
    ['on the same page', 'het eens'],
    ['nieuwe uitdaging', 'iets anders'],
    ['out of the box', 'anders'],
    ['kort schakelen', 'even bellen'],
    ['in je kracht', 'goed in je vel'],
    ['eigenaarschap', 'verantwoordelijkheid'],
    ['terugkoppelen', 'laten weten'],
    ['meenemen in', 'vertellen over'],
    ['een stukje', 'weglaten'],
    ['touch base', 'bijpraten'],
    ['aanvliegen', 'aanpakken'],
    ['commitment', 'toezegging'],
    ['leermoment', 'fout'],
    ['quick win', 'snel resultaat'],
    ['deep dive', 'goed kijken'],
    ['proactief', 'uit jezelf'],
    ['uitrollen', 'invoeren'],
    ['synergie', 'samenwerken'],
    ['thrilled', 'blij'],
    ['humbled', 'blij'],
    ['alignen', 'afstemmen'],
    ['sparren', 'overleggen'],
    ['journey', 'tijd'],
    ['passie', 'zin'],
    ['borgen', 'vastleggen'],
  ];

  var ALIAS_A = ['Vermoeide', 'Eerlijke', 'Nuchtere', 'Opgeluchte', 'Kritische', 'Ontwaakte', 'Uitgecheckte', 'Dwarse', 'Zachte', 'Onverbloemde', 'Uitgeruste', 'Rustige'];
  var ALIAS_B = ['Projectleider', 'Teamleider', 'Stagiair', 'Consultant', 'Planner', 'Developer', 'Recruiter', 'Officemanager', 'Beleidsmedewerker', 'Accountmanager', 'Verpleegkundige', 'Docent', 'Monteur', 'Jurist'];

  // ---------- Opslag (alleen dit apparaat) ----------

  function load() {
    try {
      var raw = window.localStorage.getItem(STORE_KEY);
      if (raw) {
        var d = JSON.parse(raw);
        if (d && typeof d === 'object') return d;
      }
    } catch (e) { /* geen opslag beschikbaar: de app werkt dan zonder */ }
    return {};
  }

  function save() {
    try {
      window.localStorage.setItem(STORE_KEY, JSON.stringify(state));
      return true;
    } catch (e) {
      return false;
    }
  }

  function pick(list) { return list[Math.floor(Math.random() * list.length)]; }
  function newAlias() { return pick(ALIAS_A) + ' ' + pick(ALIAS_B); }

  var stored = load();
  var state = {
    me: typeof stored.me === 'string' && stored.me ? stored.me : newAlias(),
    posts: Array.isArray(stored.posts) ? stored.posts.filter(function (p) { return p && TYPES[p.type] && p.data; }) : [],
    mine: stored.mine && typeof stored.mine === 'object' ? stored.mine : {},
  };

  var now = Date.now();
  var seedPosts = SEED.map(function (s) {
    return { id: s.id, type: s.type, author: s.author, createdAt: now - s.ago * HOUR, data: s.data, reactions: s.reactions, example: true };
  });

  var ui = { type: 'vertrek', filter: 'alles', sort: 'nieuw', drafts: {}, fresh: null };

  // ---------- Hulpjes ----------

  function $(id) { return document.getElementById(id); }

  function h(tag, attrs) {
    var el = document.createElement(tag);
    if (attrs) {
      Object.keys(attrs).forEach(function (k) {
        var v = attrs[k];
        if (v == null || v === false) return;
        if (k === 'class') el.className = v;
        else if (k.slice(0, 2) === 'on') el.addEventListener(k.slice(2), v);
        else if (v === true) el.setAttribute(k, '');
        else el.setAttribute(k, v);
      });
    }
    for (var i = 2; i < arguments.length; i++) append(el, arguments[i]);
    return el;
  }

  function append(el, kid) {
    if (kid == null || kid === false) return;
    if (Array.isArray(kid)) { kid.forEach(function (k) { append(el, k); }); return; }
    el.appendChild(kid.nodeType ? kid : document.createTextNode(String(kid)));
  }

  function num(n) {
    return Number(n).toLocaleString('nl-NL', { maximumFractionDigits: 1 });
  }

  function relTime(ts) {
    var diff = Date.now() - ts;
    var min = Math.floor(diff / 60000);
    if (min < 1) return 'zojuist';
    if (min < 60) return min + ' min geleden';
    var hrs = Math.floor(min / 60);
    if (hrs < 24) return hrs + ' uur geleden';
    var days = Math.floor(hrs / 24);
    if (days === 1) return 'gisteren';
    if (days < 7) return days + ' dagen geleden';
    return new Date(ts).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' });
  }

  function meetingHours(p) {
    return (Number(p.data.mensen) || 0) * (Number(p.data.minuten) || 0) / 60;
  }

  function allPosts() { return state.posts.concat(seedPosts); }

  function count(p, r) {
    var base = (p.reactions && p.reactions[r]) || 0;
    var mine = state.mine[p.id] && state.mine[p.id][r] ? 1 : 0;
    return base + mine;
  }

  // ---------- Nep-detector ----------

  function detectNep(text) {
    var work = ' ' + text.toLowerCase() + ' ';
    var hits = [];
    NEP.forEach(function (pair) {
      var term = pair[0];
      var re = new RegExp('([^a-zà-ÿ])' + term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '(?![a-zà-ÿ])', 'g');
      if (re.test(work)) {
        hits.push({ term: term, plain: pair[1] });
        work = work.replace(re, '$1 ');
      }
    });
    return hits;
  }

  function renderNep() {
    var box = $('nep');
    var text = FORMS[ui.type].filter(function (f) {
      return (f.kind === 'area' || f.kind === 'text') && f.nep !== false;
    }).map(function (f) {
      var el = $('f-' + ui.type + '-' + f.id);
      return el ? el.value : '';
    }).join(' \n ');

    var hits = detectNep(text);
    var level = Math.min(5, hits.length);
    var msg = !text.trim() ? 'Leest mee terwijl je typt.'
      : level === 0 ? 'Klinkt als een mens.'
      : level <= 2 ? 'Er sluipt kantoortaal in.'
      : 'Dit kan zo op dat andere netwerk.';

    box.textContent = '';
    var bar = h('span', { class: 'nep-bar', 'aria-hidden': 'true' });
    for (var i = 0; i < 5; i++) bar.appendChild(h('span', { class: i < level ? 'on' : '' }));
    box.appendChild(h('div', { class: 'nep-head' },
      h('span', { class: 'nep-title' }, 'Nep-detector'), bar, h('span', { class: 'nep-msg' }, msg)));
    if (hits.length) {
      box.appendChild(h('ul', { class: 'nep-hits' }, hits.map(function (hit) {
        return h('li', null, h('s', null, hit.term), ' → ' + hit.plain);
      })));
    }
  }

  // ---------- Schrijfvak ----------

  function renderTabs() {
    var box = $('typeTabs');
    box.textContent = '';
    Object.keys(TYPES).forEach(function (t) {
      box.appendChild(h('button', {
        type: 'button', class: 'chip', 'aria-pressed': String(ui.type === t),
        onclick: function () { if (ui.type !== t) { ui.type = t; $('status').textContent = ''; renderComposer(); } },
      }, TYPES[t].label));
    });
  }

  function draft() {
    if (!ui.drafts[ui.type]) ui.drafts[ui.type] = {};
    return ui.drafts[ui.type];
  }

  function renderField(f) {
    var id = 'f-' + ui.type + '-' + f.id;
    var value = draft()[f.id];
    var labelKids = [f.label, f.required ? null : h('span', { class: 'optional' }, ' (mag leeg)')];
    var keep = function (e) { draft()[f.id] = e.target.value; clearError(f); renderNep(); };
    var control;

    if (f.kind === 'score') {
      var row = h('div', { class: 'score-row' }, h('span', { class: 'score-end' }, 'zwaar'));
      for (var n = 1; n <= 5; n++) {
        row.appendChild(h('label', { class: 'score-opt' },
          h('input', {
            type: 'radio', name: id, id: id + '-' + n, value: String(n),
            checked: String(value) === String(n),
            'aria-label': n + ' van 5',
            onchange: keep,
          }),
          h('span', { 'aria-hidden': 'true' }, String(n))));
      }
      row.appendChild(h('span', { class: 'score-end' }, 'top'));
      return h('fieldset', { class: 'field', id: id, 'data-field': f.id },
        h('legend', null, labelKids), row, h('p', { class: 'error', id: id + '-err', hidden: true }));
    }

    if (f.kind === 'select') {
      control = h('select', { id: id, onchange: keep },
        h('option', { value: '' }, 'Kies'),
        f.options.map(function (o) { return h('option', { value: o }, o); }));
      control.value = value || '';
    } else if (f.kind === 'area') {
      control = h('textarea', { id: id, rows: String(f.rows || 3), maxlength: String(f.max), placeholder: f.placeholder, oninput: keep });
      control.value = value || '';
    } else {
      control = h('input', {
        id: id, type: f.kind === 'number' ? 'number' : 'text', inputmode: f.kind === 'number' ? 'numeric' : null,
        min: f.min, max: f.kind === 'number' ? f.max : null, maxlength: f.kind === 'text' ? String(f.max) : null,
        placeholder: f.placeholder, autocomplete: 'off', oninput: keep,
      });
      control.value = value || '';
    }

    return h('div', { class: 'field' + (f.half ? ' half' : ''), 'data-field': f.id },
      h('label', { for: id }, labelKids),
      control,
      f.hint ? h('p', { class: 'hint' }, f.hint) : null,
      h('p', { class: 'error', id: id + '-err', hidden: true }));
  }

  function renderComposer() {
    renderTabs();
    var box = $('fields');
    box.textContent = '';
    FORMS[ui.type].forEach(function (f) { box.appendChild(renderField(f)); });
    $('submitBtn').textContent = TYPES[ui.type].cta;
    renderNep();
  }

  function setError(f, msg) {
    var id = 'f-' + ui.type + '-' + f.id;
    var err = $(id + '-err');
    err.textContent = msg;
    err.hidden = false;
    var el = $(id);
    if (el && f.kind !== 'score') { el.setAttribute('aria-invalid', 'true'); el.setAttribute('aria-describedby', id + '-err'); }
  }

  function clearError(f) {
    var id = 'f-' + ui.type + '-' + f.id;
    var err = $(id + '-err');
    if (err) { err.textContent = ''; err.hidden = true; }
    var el = $(id);
    if (el) { el.removeAttribute('aria-invalid'); el.removeAttribute('aria-describedby'); }
  }

  function readForm() {
    var data = {};
    var firstBad = null;
    FORMS[ui.type].forEach(function (f) {
      clearError(f);
      var raw = draft()[f.id];
      var val = raw == null ? '' : String(raw).trim();
      var msg = '';
      if (!val) {
        if (f.required) msg = f.kind === 'score' ? 'Kies een cijfer van 1 tot 5.' : f.kind === 'select' ? 'Kies er één.' : 'Vul dit nog in.';
      } else if (f.kind === 'number') {
        var n = Number(val);
        if (!isFinite(n) || Math.round(n) !== n || n < f.min || n > f.max) msg = 'Vul een heel getal in van ' + f.min + ' tot ' + f.max + '.';
        else val = n;
      } else if (f.kind === 'score') {
        val = Number(val);
      } else if (f.max && val.length > f.max) {
        msg = 'Maximaal ' + f.max + ' tekens.';
      }
      if (msg) {
        setError(f, msg);
        if (!firstBad) firstBad = f;
      } else if (val !== '') {
        data[f.id] = val;
      }
    });
    if (firstBad) {
      var id = 'f-' + ui.type + '-' + firstBad.id;
      var target = firstBad.kind === 'score' ? $(id + '-1') : $(id);
      if (target) target.focus();
      return null;
    }
    return data;
  }

  function onSubmit(e) {
    e.preventDefault();
    var data = readForm();
    if (!data) { $('status').textContent = 'Nog niet geplaatst. Kijk even bij de rode regels.'; return; }
    var post = {
      id: 'u' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      type: ui.type, author: state.me, createdAt: Date.now(), data: data,
    };
    state.posts.unshift(post);
    var ok = save();
    ui.drafts[ui.type] = {};
    ui.fresh = post.id;
    if (ui.filter !== 'alles' && ui.filter !== post.type) ui.filter = 'alles';
    ui.sort = 'nieuw';
    $('sortSelect').value = 'nieuw';
    renderComposer();
    renderFilters();
    renderFeed();
    renderStats();
    $('status').textContent = ok
      ? 'Geplaatst. Je post staat bovenaan de feed.'
      : 'Geplaatst, maar opslaan op dit apparaat lukte niet. Na herladen is je post weg.';
    var card = document.querySelector('[data-post="' + post.id + '"]');
    if (card && card.scrollIntoView) {
      var calm = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      card.scrollIntoView({ behavior: calm ? 'auto' : 'smooth', block: 'center' });
    }
  }

  // ---------- Feed ----------

  function renderFilters() {
    var box = $('filters');
    box.textContent = '';
    [['alles', 'Alles']].concat(Object.keys(TYPES).map(function (t) { return [t, TYPES[t].label]; })).forEach(function (pair) {
      box.appendChild(h('button', {
        type: 'button', class: 'chip', 'aria-pressed': String(ui.filter === pair[0]),
        onclick: function () { ui.filter = pair[0]; ui.fresh = null; renderFilters(); renderFeed(); },
      }, pair[1]));
    });
  }

  function pair(label, node) {
    return h('div', { class: 'pair' }, h('span', { class: 'pair-label' }, label), node);
  }

  function renderBody(p) {
    var d = p.data;
    if (p.type === 'vertrek') {
      return [
        h('p', { class: 'post-context' }, 'Vertrok bij ' + d.waar + (d.functie ? ', als ' + d.functie : '')),
        pair('Wat ik zei', h('p', { class: 'said' }, d.zei)),
        pair('Wat echt was', h('p', { class: 'real' }, h('span', { class: 'marker' }, d.echt))),
      ];
    }
    if (p.type === 'meeting') {
      return [
        h('dl', { class: 'receipt' },
          h('dt', null, 'Onderwerp'), h('dd', null, d.onderwerp),
          h('dt', null, 'Aanwezig'), h('dd', null, num(d.mensen) + ' mensen'),
          h('dt', null, 'Duur'), h('dd', null, num(d.minuten) + ' min'),
          h('dt', null, 'Had kunnen zijn'), h('dd', null, d.alt),
          h('dt', { class: 'total' }, 'Verspild'), h('dd', { class: 'total' }, num(meetingHours(p)) + ' mensuren')),
        d.tekst ? h('p', { class: 'post-text' }, d.tekst) : null,
      ];
    }
    if (p.type === 'mens') {
      var pips = h('span', { class: 'pips', 'aria-hidden': 'true' });
      for (var i = 1; i <= 5; i++) pips.appendChild(h('span', { class: i <= d.score ? 'on' : '' }));
      return [
        h('div', { class: 'score-line' },
          h('span', { class: 'post-context' }, 'Over een ' + d.rol + (d.context ? ' bij ' + d.context : '')),
          h('span', { class: 'score-line' }, pips, h('span', { class: 'score-num' }, d.score + ' van 5'))),
        h('p', { class: 'post-text' }, d.tekst),
      ];
    }
    if (p.type === 'irritant') {
      return [
        pair('We vinden normaal', h('p', { class: 'post-text' }, d.ding)),
        d.beter ? pair('Liever', h('p', { class: 'real' }, h('span', { class: 'marker' }, d.beter))) : null,
      ];
    }
    return [h('p', { class: 'post-text' }, d.tekst)];
  }

  function renderReactions(p) {
    return h('div', { class: 'reactions' }, REACTIONS.map(function (r) {
      var on = !!(state.mine[p.id] && state.mine[p.id][r.id]);
      var n = h('span', { class: 'n' }, num(count(p, r.id)));
      var btn = h('button', { type: 'button', class: 'react', 'aria-pressed': String(on) }, r.label, n);
      btn.addEventListener('click', function () {
        var mine = state.mine[p.id] || (state.mine[p.id] = {});
        if (mine[r.id]) delete mine[r.id]; else mine[r.id] = true;
        if (!Object.keys(mine).length) delete state.mine[p.id];
        save();
        btn.setAttribute('aria-pressed', String(!!(state.mine[p.id] && state.mine[p.id][r.id])));
        n.textContent = num(count(p, r.id));
      });
      return btn;
    }));
  }

  function renderOwnActions(p) {
    var box = h('div', { class: 'own-actions' });
    function idle() {
      box.textContent = '';
      box.appendChild(h('button', { type: 'button', class: 'btn btn-quiet', onclick: ask }, 'Verwijder'));
    }
    function ask() {
      box.textContent = '';
      var yes = h('button', { type: 'button', class: 'btn btn-quiet btn-danger', onclick: remove }, 'Ja, verwijder');
      box.appendChild(h('span', null, 'Zeker weten?'));
      box.appendChild(yes);
      box.appendChild(h('button', { type: 'button', class: 'btn btn-quiet', onclick: idle }, 'Nee'));
      yes.focus();
    }
    function remove() {
      state.posts = state.posts.filter(function (x) { return x.id !== p.id; });
      delete state.mine[p.id];
      save();
      renderFeed();
      renderStats();
      $('status').textContent = 'Post verwijderd.';
    }
    idle();
    return box;
  }

  function renderPost(p) {
    return h('li', { class: 'post' + (ui.fresh === p.id ? ' fresh' : ''), 'data-post': p.id },
      h('div', { class: 'post-head' },
        h('span', { class: 'post-type' }, TYPES[p.type].label),
        h('span', { class: 'post-meta' }, p.author + ' · ' + relTime(p.createdAt)),
        p.example ? h('span', { class: 'tag' }, 'voorbeeld') : null),
      h('div', { class: 'post-body' }, renderBody(p)),
      h('div', { class: 'post-foot' }, renderReactions(p), p.example ? null : renderOwnActions(p)));
  }

  function renderFeed() {
    var list = allPosts().filter(function (p) { return ui.filter === 'alles' || p.type === ui.filter; });
    list.sort(function (a, b) {
      if (ui.sort === 'herkenbaar') {
        var d = count(b, 'herkenbaar') - count(a, 'herkenbaar');
        if (d) return d;
      }
      return b.createdAt - a.createdAt;
    });
    var feed = $('feed');
    feed.textContent = '';
    if (!list.length) {
      feed.appendChild(h('li', { class: 'empty' }, 'Hier staat nog niets. Kies hierboven een soort post en schrijf de eerste.'));
      return;
    }
    list.forEach(function (p) { feed.appendChild(renderPost(p)); });
  }

  function renderStats() {
    var meetings = allPosts().filter(function (p) { return p.type === 'meeting'; });
    var total = meetings.reduce(function (sum, p) { return sum + meetingHours(p); }, 0);
    $('wasteHours').textContent = num(total);
    $('wasteNote').textContent = meetings.length
      ? 'Opgeteld over ' + meetings.length + (meetings.length === 1 ? ' meeting' : ' meetings') + ': aantal mensen keer de duur.'
      : 'Nog geen meetings gemeld.';
  }

  function renderAlias() { $('aliasName').textContent = state.me; }

  // ---------- Start ----------

  function start() {
    renderAlias();
    renderComposer();
    renderFilters();
    renderFeed();
    renderStats();

    $('composerForm').addEventListener('submit', onSubmit);
    $('sortSelect').addEventListener('change', function (e) { ui.sort = e.target.value; ui.fresh = null; renderFeed(); });
    $('aliasBtn').addEventListener('click', function () {
      var next = newAlias();
      while (next === state.me) next = newAlias();
      state.me = next;
      save();
      renderAlias();
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();
