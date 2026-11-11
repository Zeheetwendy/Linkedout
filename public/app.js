(function () {
  'use strict';

  var S = window.LINKEDOUT_SCHEMA;
  var TYPES = S.TYPES;
  var FORMS = S.FORMS;
  var REACTIONS = S.REACTIONS;
  var SEED = window.LINKEDOUT_SEED || [];
  var HOUR = 3600 * 1000;
  var PAGE = 20;

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

  var ui = {
    me: null,          // { id, alias, isAdmin } of null
    type: 'vertrek',   // soort post in het schrijfvak
    filter: 'alles',
    sort: 'nieuw',
    drafts: {},
    fresh: null,       // id van de post die net geplaatst is
    posts: [],
    hasMore: false,
  };

  var feedSeq = 0;

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
    var min = Math.floor((Date.now() - ts) / 60000);
    if (min < 1) return 'zojuist';
    if (min < 60) return min + ' min geleden';
    var hrs = Math.floor(min / 60);
    if (hrs < 24) return hrs + ' uur geleden';
    var days = Math.floor(hrs / 24);
    if (days === 1) return 'gisteren';
    if (days < 7) return days + ' dagen geleden';
    return new Date(ts).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' });
  }

  function shortDate(ts) {
    return new Date(ts).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' });
  }

  function meetingHours(p) {
    return (Number(p.data.mensen) || 0) * (Number(p.data.minuten) || 0) / 60;
  }

  function pick(list) { return list[Math.floor(Math.random() * list.length)]; }
  function newAlias() { return pick(ALIAS_A) + ' ' + pick(ALIAS_B); }

  // ---------- Praten met de server ----------

  function api(method, path, body) {
    var opts = { method: method, credentials: 'same-origin', headers: { 'X-Requested-With': 'linkedout' } };
    if (body !== undefined) {
      opts.headers['Content-Type'] = 'application/json';
      opts.body = JSON.stringify(body);
    }
    return fetch('/api' + path, opts).then(function (res) {
      return res.text().then(function (text) {
        var data = null;
        try { data = text ? JSON.parse(text) : null; } catch (e) { /* geen JSON: valt hieronder terug op een algemene melding */ }
        if (!res.ok) {
          var err = new Error((data && data.error) || 'Er ging iets mis. Probeer het opnieuw.');
          err.status = res.status;
          err.field = data && data.field;
          throw err;
        }
        return data;
      });
    }, function () {
      var err = new Error('De server is niet bereikbaar. Controleer je verbinding en probeer het opnieuw.');
      err.status = 0;
      throw err;
    });
  }

  // Sessie verlopen terwijl je bezig was: terug naar inloggen. Geeft true als dat het geval was.
  function loggedOut(err) {
    if (err.status !== 401 || !ui.me) return false;
    ui.me = null;
    showAuth('Je bent uitgelogd. Log opnieuw in om verder te gaan.');
    return true;
  }

  function busy(form, on) {
    var btn = form.querySelector('button[type="submit"]');
    if (btn) btn.disabled = on;
  }

  // ---------- Foutregels bij velden ----------

  function setError(id, msg) {
    var err = $(id + '-err');
    if (err) { err.textContent = msg; err.hidden = false; }
    var el = $(id);
    if (el && el.tagName !== 'FIELDSET') { el.setAttribute('aria-invalid', 'true'); el.setAttribute('aria-describedby', id + '-err'); }
  }

  function clearError(id) {
    var err = $(id + '-err');
    if (err) { err.textContent = ''; err.hidden = true; }
    var el = $(id);
    if (el) { el.removeAttribute('aria-invalid'); el.removeAttribute('aria-describedby'); }
  }

  // ---------- Inloggen en aanmelden ----------

  function setAuthTab(tab) {
    var register = tab === 'register';
    $('tabLogin').setAttribute('aria-pressed', String(!register));
    $('tabRegister').setAttribute('aria-pressed', String(register));
    $('loginForm').hidden = register;
    $('registerForm').hidden = !register;
  }

  function inviteFromAddress() {
    var m = /^#code=([A-Za-z0-9-]{4,20})$/.exec(window.location.hash);
    if (!m) return '';
    try { window.history.replaceState(null, '', window.location.pathname); } catch (e) { /* adres blijft dan staan, dat is niet erg */ }
    return m[1].toUpperCase();
  }

  function onLogin(e) {
    e.preventDefault();
    var form = $('loginForm');
    var alias = $('loginAlias').value.trim();
    var password = $('loginPassword').value;
    clearError('loginAlias');
    clearError('loginPassword');
    if (!alias) { setError('loginAlias', 'Vul je schuilnaam in.'); $('loginAlias').focus(); return; }
    if (!password) { setError('loginPassword', 'Vul je wachtwoord in.'); $('loginPassword').focus(); return; }
    $('loginStatus').textContent = 'Bezig met inloggen.';
    busy(form, true);
    api('POST', '/login', { alias: alias, password: password }).then(function (res) {
      $('loginPassword').value = '';
      $('loginStatus').textContent = '';
      enter(res.user);
    }).catch(function (err) {
      $('loginStatus').textContent = err.message;
    }).then(function () { busy(form, false); });
  }

  function onRegister(e) {
    e.preventDefault();
    var form = $('registerForm');
    var ids = { code: 'regCode', alias: 'regAlias', password: 'regPassword' };
    Object.keys(ids).forEach(function (k) { clearError(ids[k]); });

    var code = $('regCode').value.trim();
    var alias = S.validateAlias($('regAlias').value);
    var password = S.validatePassword($('regPassword').value);
    var first = null;
    if (!code) { setError('regCode', 'Vul de code uit je uitnodiging in.'); first = first || 'regCode'; }
    if (alias.error) { setError('regAlias', alias.error); first = first || 'regAlias'; }
    if (password.error) { setError('regPassword', password.error); first = first || 'regPassword'; }
    if (first) { $(first).focus(); $('registerStatus').textContent = ''; return; }

    $('registerStatus').textContent = 'Account maken.';
    busy(form, true);
    api('POST', '/register', { code: code, alias: alias.value, password: password.value }).then(function (res) {
      form.reset();
      $('registerStatus').textContent = '';
      enter(res.user);
      $('status').textContent = 'Welkom, ' + res.user.alias + '. Je account is gemaakt.';
    }).catch(function (err) {
      if (err.field && ids[err.field]) {
        setError(ids[err.field], err.message);
        $(ids[err.field]).focus();
        $('registerStatus').textContent = '';
      } else {
        $('registerStatus').textContent = err.message;
      }
    }).then(function () { busy(form, false); });
  }

  function onLogout() {
    $('logoutBtn').disabled = true;
    api('POST', '/logout').then(function () {
      ui.me = null;
      showAuth('');
    }).catch(function (err) {
      if (!loggedOut(err)) $('feedStatus').textContent = err.message;
    }).then(function () { $('logoutBtn').disabled = false; });
  }

  // ---------- Twee toestanden: buiten en binnen ----------

  function showAuth(message) {
    feedSeq++;
    ui.posts = [];
    ui.hasMore = false;
    ui.drafts = {};
    ui.fresh = null;
    ui.filter = 'alles';
    ui.sort = 'nieuw';
    $('sortSelect').value = 'nieuw';

    $('bootNotice').hidden = true;
    $('account').hidden = true;
    $('composer').hidden = true;
    $('waste').hidden = true;
    $('invitePanel').hidden = true;
    $('accountPanel').hidden = true;
    $('moreBtn').hidden = true;
    $('sortWrap').hidden = true;
    $('filters').hidden = true;
    $('authPanel').hidden = false;
    $('feedWrap').hidden = false;
    $('feedTitle').textContent = 'Zo ziet het er binnen uit';
    $('feedStatus').textContent = '';
    $('loginStatus').textContent = message || '';
    $('registerStatus').textContent = '';

    var code = inviteFromAddress();
    if (code) {
      $('regCode').value = code;
      setAuthTab('register');
    }
    renderFeed();
  }

  function enter(user) {
    ui.me = user;
    $('bootNotice').hidden = true;
    $('authPanel').hidden = true;
    $('account').hidden = false;
    $('aliasName').textContent = user.alias;
    $('composer').hidden = false;
    $('waste').hidden = false;
    $('accountPanel').hidden = false;
    $('invitePanel').hidden = !user.isAdmin;
    $('sortWrap').hidden = false;
    $('filters').hidden = false;
    $('feedWrap').hidden = false;
    $('feedTitle').textContent = 'De feed';
    $('status').textContent = '';
    $('inviteStatus').textContent = '';

    renderComposer();
    renderFilters();
    renderAccount();
    $('feed').textContent = '';
    loadFeed(true);
    loadStats();
    if (user.isAdmin) loadInvites();
  }

  // ---------- Nep-detector ----------

  function detectNep(text) {
    var work = ' ' + text.toLowerCase() + ' ';
    var hits = [];
    NEP.forEach(function (pair) {
      var re = new RegExp('([^a-zà-ÿ])' + pair[0].replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '(?![a-zà-ÿ])', 'g');
      if (re.test(work)) {
        hits.push({ term: pair[0], plain: pair[1] });
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

  function fieldId(f) { return 'f-' + ui.type + '-' + f.id; }

  function draft() {
    if (!ui.drafts[ui.type]) ui.drafts[ui.type] = {};
    return ui.drafts[ui.type];
  }

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

  function renderField(f) {
    var id = fieldId(f);
    var value = draft()[f.id];
    var labelKids = [f.label, f.required ? null : h('span', { class: 'optional' }, ' (mag leeg)')];
    var keep = function (e) { draft()[f.id] = e.target.value; clearError(id); renderNep(); };
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
      return h('fieldset', { class: 'field', id: id },
        h('legend', null, labelKids), row, h('p', { class: 'error', id: id + '-err', hidden: true }));
    }

    if (f.kind === 'select') {
      control = h('select', { id: id, onchange: keep },
        h('option', { value: '' }, 'Kies'),
        f.options.map(function (o) { return h('option', { value: o }, o); }));
    } else if (f.kind === 'area') {
      control = h('textarea', { id: id, rows: String(f.rows || 3), maxlength: String(f.max), placeholder: f.placeholder, oninput: keep });
    } else {
      control = h('input', {
        id: id, type: f.kind === 'number' ? 'number' : 'text', inputmode: f.kind === 'number' ? 'numeric' : null,
        min: f.min, max: f.kind === 'number' ? f.max : null, maxlength: f.kind === 'text' ? String(f.max) : null,
        placeholder: f.placeholder, autocomplete: 'off', oninput: keep,
      });
    }
    control.value = value || '';

    return h('div', { class: 'field' + (f.half ? ' half' : '') },
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

  function focusField(f) {
    var target = f.kind === 'score' ? $(fieldId(f) + '-1') : $(fieldId(f));
    if (target) target.focus();
  }

  function readForm() {
    var data = {};
    var firstBad = null;
    FORMS[ui.type].forEach(function (f) {
      clearError(fieldId(f));
      var res = S.validateField(f, draft()[f.id]);
      if (res.error) {
        setError(fieldId(f), res.error);
        if (!firstBad) firstBad = f;
      } else if (res.value !== undefined) {
        data[f.id] = res.value;
      }
    });
    if (firstBad) { focusField(firstBad); return null; }
    return data;
  }

  function onSubmit(e) {
    e.preventDefault();
    var form = $('composerForm');
    var type = ui.type;
    var data = readForm();
    if (!data) { $('status').textContent = 'Nog niet geplaatst. Kijk even bij de rode regels.'; return; }
    $('status').textContent = 'Bezig met plaatsen.';
    busy(form, true);
    api('POST', '/posts', { type: type, data: data }).then(function (res) {
      ui.drafts[type] = {};
      ui.fresh = res.post.id;
      if (ui.filter !== 'alles' && ui.filter !== type) ui.filter = 'alles';
      ui.sort = 'nieuw';
      $('sortSelect').value = 'nieuw';
      if (ui.type === type) renderComposer();
      renderFilters();
      $('status').textContent = 'Geplaatst. Je post staat bovenaan de feed.';
      loadStats();
      return loadFeed(true).then(function () {
        var card = document.querySelector('[data-post="' + res.post.id + '"]');
        if (card && card.scrollIntoView) {
          var calm = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
          card.scrollIntoView({ behavior: calm ? 'auto' : 'smooth', block: 'center' });
        }
      });
    }).catch(function (err) {
      if (loggedOut(err)) return;
      var field = err.field && FORMS[type].filter(function (f) { return f.id === err.field; })[0];
      if (field && ui.type === type) {
        setError(fieldId(field), err.message);
        focusField(field);
        $('status').textContent = 'Nog niet geplaatst. Kijk even bij de rode regel.';
      } else {
        $('status').textContent = 'Nog niet geplaatst. ' + err.message;
      }
    }).then(function () { busy(form, false); });
  }

  // ---------- Feed ----------

  function examplePosts() {
    var now = Date.now();
    return SEED.map(function (s) {
      return { id: s.id, type: s.type, author: s.author, createdAt: now - s.ago * HOUR, data: s.data, reactions: s.reactions, mine: [], example: true };
    });
  }

  function loadFeed(reset) {
    var seq = ++feedSeq;
    var query = '?limit=' + PAGE + '&offset=' + (reset ? 0 : ui.posts.length) + '&sort=' + ui.sort;
    if (ui.filter === 'gemeld') query += '&reported=1';
    else if (ui.filter !== 'alles') query += '&type=' + ui.filter;
    $('moreBtn').disabled = true;
    if (reset && !ui.posts.length) $('feedStatus').textContent = 'Posts laden.';
    return api('GET', '/posts' + query).then(function (res) {
      if (seq !== feedSeq) return;
      if (reset) {
        ui.posts = res.posts;
      } else {
        var have = {};
        ui.posts.forEach(function (p) { have[p.id] = true; });
        ui.posts = ui.posts.concat(res.posts.filter(function (p) { return !have[p.id]; }));
      }
      ui.hasMore = res.hasMore;
      $('feedStatus').textContent = '';
      renderFeed();
    }).catch(function (err) {
      if (seq !== feedSeq || loggedOut(err)) return;
      $('feedStatus').textContent = err.message;
    }).then(function () { $('moreBtn').disabled = false; });
  }

  function loadStats() {
    api('GET', '/stats').then(function (res) {
      $('wasteHours').textContent = num(res.meetingHours);
      $('wasteNote').textContent = res.meetingCount
        ? 'Opgeteld over ' + res.meetingCount + (res.meetingCount === 1 ? ' meeting' : ' meetings') + ': aantal mensen keer de duur.'
        : 'Nog geen meetings gemeld.';
    }).catch(function (err) {
      if (!loggedOut(err)) $('wasteNote').textContent = 'De teller laden lukte niet.';
    });
  }

  function renderFilters() {
    var box = $('filters');
    box.textContent = '';
    var items = [['alles', 'Alles']].concat(Object.keys(TYPES).map(function (t) { return [t, TYPES[t].label]; }));
    if (ui.me && ui.me.isAdmin) items.push(['gemeld', 'Gemeld']);
    items.forEach(function (item) {
      box.appendChild(h('button', {
        type: 'button', class: 'chip', 'aria-pressed': String(ui.filter === item[0]),
        onclick: function () {
          ui.filter = item[0];
          ui.fresh = null;
          ui.posts = [];
          $('feed').textContent = '';
          renderFilters();
          loadFeed(true);
        },
      }, item[1]));
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
    var box = h('div', { class: 'reactions' });
    REACTIONS.forEach(function (r, index) {
      var count = h('span', { class: 'n' }, num((p.reactions && p.reactions[r.id]) || 0));
      if (p.example) {
        box.appendChild(h('span', { class: 'react is-static' }, r.label, count));
        return;
      }
      var on = p.mine.indexOf(r.id) !== -1;
      var btn = h('button', { type: 'button', class: 'react', 'aria-pressed': String(on) }, r.label, count);
      btn.addEventListener('click', function () {
        btn.disabled = true;
        api('PUT', '/posts/' + p.id + '/reactions/' + r.id, { on: !on }).then(function (res) {
          p.reactions = res.reactions;
          p.mine = res.mine;
          var next = renderReactions(p);
          box.replaceWith(next);
          next.children[index].focus();
        }).catch(function (err) {
          btn.disabled = false;
          if (!loggedOut(err)) $('feedStatus').textContent = err.message;
        });
      });
      box.appendChild(btn);
    });
    return box;
  }

  function removeFromFeed(p, message) {
    ui.posts = ui.posts.filter(function (x) { return x.id !== p.id; });
    renderFeed();
    loadStats();
    $('feedStatus').textContent = message;
  }

  function renderActions(p) {
    var box = h('div', { class: 'own-actions' });
    var canDelete = p.own || ui.me.isAdmin;

    function fail(err) {
      if (loggedOut(err)) return;
      if (err.status === 404) { removeFromFeed(p, 'Deze post was al verwijderd.'); return; }
      idle();
      $('feedStatus').textContent = err.message;
    }

    function confirmStep(question, yesLabel, danger, action) {
      box.textContent = '';
      var yes = h('button', { type: 'button', class: 'btn btn-quiet' + (danger ? ' btn-danger' : ''), onclick: function () { yes.disabled = true; action(); } }, yesLabel);
      box.appendChild(h('span', null, question));
      box.appendChild(yes);
      box.appendChild(h('button', { type: 'button', class: 'btn btn-quiet', onclick: idle }, 'Nee'));
      yes.focus();
    }

    function idle() {
      box.textContent = '';
      if (ui.me.isAdmin && p.reports > 0) {
        box.appendChild(h('span', { class: 'tag tag-alert' }, p.reports + (p.reports === 1 ? ' melding' : ' meldingen')));
        box.appendChild(h('button', {
          type: 'button', class: 'btn btn-quiet',
          onclick: function () {
            confirmStep('Meldingen wissen en de post laten staan?', 'Ja, wis', false, function () {
              api('DELETE', '/posts/' + p.id + '/reports').then(function () {
                p.reports = 0;
                if (ui.filter === 'gemeld') removeFromFeed(p, 'Meldingen gewist. De post blijft staan.');
                else { idle(); $('feedStatus').textContent = 'Meldingen gewist.'; }
              }).catch(fail);
            });
          },
        }, 'Wis meldingen'));
      }
      if (!p.own) {
        if (p.reported) {
          box.appendChild(h('span', { class: 'muted' }, 'Gemeld bij de beheerder'));
        } else {
          box.appendChild(h('button', {
            type: 'button', class: 'btn btn-quiet',
            onclick: function () {
              confirmStep('Melden bij de beheerder?', 'Ja, meld', false, function () {
                api('POST', '/posts/' + p.id + '/report').then(function () {
                  p.reported = true;
                  if (ui.me.isAdmin) p.reports = (p.reports || 0) + 1;
                  idle();
                }).catch(fail);
              });
            },
          }, 'Meld'));
        }
      }
      if (canDelete) {
        box.appendChild(h('button', {
          type: 'button', class: 'btn btn-quiet',
          onclick: function () {
            confirmStep(p.own ? 'Je post verwijderen?' : 'Deze post van ' + p.author + ' verwijderen?', 'Ja, verwijder', true, function () {
              api('DELETE', '/posts/' + p.id).then(function () { removeFromFeed(p, 'Post verwijderd.'); }).catch(fail);
            });
          },
        }, 'Verwijder'));
      }
    }

    idle();
    return box;
  }

  function renderPost(p) {
    return h('li', { class: 'post' + (ui.fresh === p.id ? ' fresh' : ''), 'data-post': p.id },
      h('div', { class: 'post-head' },
        h('span', { class: 'post-type' }, TYPES[p.type] ? TYPES[p.type].label : 'Post'),
        h('span', { class: 'post-meta' }, p.author + ' · ' + relTime(p.createdAt)),
        p.example ? h('span', { class: 'tag' }, 'voorbeeld') : null,
        p.own ? h('span', { class: 'tag' }, 'van jou') : null),
      h('div', { class: 'post-body' }, renderBody(p)),
      h('div', { class: 'post-foot' }, renderReactions(p), p.example ? null : renderActions(p)));
  }

  function renderFeed() {
    var feed = $('feed');
    var list = ui.me ? ui.posts : examplePosts();
    feed.textContent = '';
    $('moreBtn').hidden = !(ui.me && ui.hasMore);
    if (!list.length) {
      feed.appendChild(h('li', { class: 'empty' },
        ui.filter === 'gemeld' ? 'Er zijn geen gemelde posts.'
          : ui.filter === 'alles' ? 'Hier staat nog niets. Schrijf hierboven de eerste post.'
          : 'In deze soort staat nog niets. Schrijf hierboven de eerste.'));
      return;
    }
    list.forEach(function (p) {
      // Een post in een soort die deze versie niet kent, wordt overgeslagen in plaats van de pagina te breken.
      if (TYPES[p.type]) feed.appendChild(renderPost(p));
    });
  }

  // ---------- Uitnodigen (beheerder) ----------

  function inviteLink(code) { return window.location.origin + '/#code=' + code; }

  function renderInvites(invites) {
    var list = $('inviteList');
    list.textContent = '';
    invites.forEach(function (inv) {
      list.appendChild(h('li', null,
        h('code', { class: 'invite-code' }, inv.code),
        h('span', { class: 'muted' }, 'geldig tot ' + shortDate(inv.expiresAt)),
        h('button', {
          type: 'button', class: 'btn btn-quiet',
          onclick: function () {
            var done = function (ok) {
              $('inviteStatus').textContent = ok
                ? 'Link gekopieerd. Stuur hem naar één persoon.'
                : 'Kopiëren lukte niet. Selecteer de code en stuur die zelf door.';
            };
            if (navigator.clipboard && navigator.clipboard.writeText) {
              navigator.clipboard.writeText(inviteLink(inv.code)).then(function () { done(true); }, function () { done(false); });
            } else {
              done(false);
            }
          },
        }, 'Kopieer link')));
    });
  }

  function loadInvites() {
    api('GET', '/invites').then(function (res) { renderInvites(res.invites); }).catch(function (err) {
      if (!loggedOut(err)) $('inviteStatus').textContent = err.message;
    });
  }

  function onInvite() {
    $('inviteBtn').disabled = true;
    api('POST', '/invites').then(function () {
      $('inviteStatus').textContent = 'Uitnodiging gemaakt.';
      loadInvites();
    }).catch(function (err) {
      if (!loggedOut(err)) $('inviteStatus').textContent = err.message;
    }).then(function () { $('inviteBtn').disabled = false; });
  }

  // ---------- Account verwijderen ----------

  function renderAccount() {
    var box = $('accountActions');

    function idle() {
      box.textContent = '';
      box.appendChild(h('button', { type: 'button', class: 'btn btn-quiet', onclick: ask }, 'Verwijder mijn account'));
    }

    function ask() {
      box.textContent = '';
      var input = h('input', { type: 'password', id: 'delPassword', autocomplete: 'current-password', maxlength: '200' });
      var yes = h('button', { type: 'submit', class: 'btn btn-quiet btn-danger' }, 'Ja, verwijder alles');
      var form = h('form', { class: 'form', novalidate: true },
        h('p', { class: 'hint' }, 'Je account, al je posts en al je reacties worden verwijderd. Dit kan niet terug.'),
        h('div', { class: 'field' },
          h('label', { for: 'delPassword' }, 'Je wachtwoord, ter controle'),
          input,
          h('p', { class: 'error', id: 'delPassword-err', hidden: true })),
        h('div', { class: 'own-actions' }, yes, h('button', { type: 'button', class: 'btn btn-quiet', onclick: idle }, 'Annuleer')));
      form.addEventListener('submit', function (e) {
        e.preventDefault();
        clearError('delPassword');
        if (!input.value) { setError('delPassword', 'Vul je wachtwoord in.'); input.focus(); return; }
        yes.disabled = true;
        api('POST', '/me/delete', { password: input.value }).then(function () {
          ui.me = null;
          showAuth('Je account en al je posts zijn verwijderd.');
        }).catch(function (err) {
          if (loggedOut(err)) return;
          yes.disabled = false;
          setError('delPassword', err.message);
          input.focus();
        });
      });
      box.appendChild(form);
      input.focus();
    }

    idle();
  }

  // ---------- Start ----------

  function boot() {
    var notice = $('bootNotice');
    notice.hidden = false;
    notice.textContent = 'Even laden.';
    api('GET', '/me').then(function (res) {
      if (res && res.user) enter(res.user);
      else showAuth('');
    }).catch(function (err) {
      notice.textContent = '';
      notice.appendChild(document.createTextNode(err.message + ' '));
      notice.appendChild(h('button', { type: 'button', class: 'btn btn-quiet', onclick: boot }, 'Probeer opnieuw'));
    });
  }

  function start() {
    $('tabLogin').addEventListener('click', function () { setAuthTab('login'); });
    $('tabRegister').addEventListener('click', function () { setAuthTab('register'); });
    $('loginForm').addEventListener('submit', onLogin);
    $('registerForm').addEventListener('submit', onRegister);
    $('regAliasBtn').addEventListener('click', function () {
      $('regAlias').value = newAlias();
      clearError('regAlias');
    });
    $('logoutBtn').addEventListener('click', onLogout);
    $('composerForm').addEventListener('submit', onSubmit);
    $('sortSelect').addEventListener('change', function (e) {
      ui.sort = e.target.value;
      ui.fresh = null;
      loadFeed(true);
    });
    $('moreBtn').addEventListener('click', function () { loadFeed(false); });
    $('inviteBtn').addEventListener('click', onInvite);
    boot();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();
