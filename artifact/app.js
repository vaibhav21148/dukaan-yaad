/* Dukaan Yaad as a Claude Artifact.
   Speech: Claude `dictation`. Understanding + Poochho: Claude `sample`. Storage: Claude `db` (private per person).
   Every capability is optional: without it the page falls back to typing, the on-device parser,
   local answers and browser storage, so it still works end to end. */
(function () {
  'use strict';
  const D = window.DY;
  const $ = (s) => document.querySelector(s);
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const rs = (n) => '₹' + Math.round(Number(n) || 0).toLocaleString('en-IN');
  const LANGS = ['hi', 'en', 'mr', 'gu'];
  const LANG_NAMES = { hi: 'Hindi / Hinglish', en: 'English', mr: 'मराठी', gu: 'ગુજરાતી' };
  const DICT_LANG = { hi: 'hi', en: 'en', mr: 'mr', gu: 'gu' };

  // Artifact-only copy (the rest comes from the app's i18n files).
  const EXTRA = {
    hi: { privacy: 'Aapka hisaab sirf aapke Claude account mein save hota hai. Sirf aap dekh sakte ho.', privacyLocal: 'Aapka hisaab is browser mein save hai. Claude mein sign in karke kholo to har jagah milega.', noDict: 'Is browser mein bolna nahi chalega. Chrome mein kholo, ya likh kar daalo.', claudeChip: 'Claude AI', micChip: 'Claude mic', loading: 'Hisaab khul raha hai...', saveFail: 'Save nahi hua. Internet check karo, dobara koshish hogi.' },
    en: { privacy: 'Your ledger is saved in your Claude account. Only you can see it.', privacyLocal: 'Your ledger is saved in this browser. Sign in to Claude to keep it everywhere.', noDict: 'Speaking is not available in this browser. Open it in Chrome, or type instead.', claudeChip: 'Claude AI', micChip: 'Claude mic', loading: 'Opening your ledger...', saveFail: 'Could not save. Check the internet; it will try again.' },
    mr: { privacy: 'तुमचा हिशोब फक्त तुमच्या Claude खात्यात जतन होतो. फक्त तुम्ही पाहू शकता.', privacyLocal: 'तुमचा हिशोब या ब्राउझरमध्ये जतन आहे. सगळीकडे मिळण्यासाठी Claude मध्ये साइन इन करा.', noDict: 'या ब्राउझरमध्ये बोलणे चालणार नाही. Chrome मध्ये उघडा, किंवा लिहून टाका.', claudeChip: 'Claude AI', micChip: 'Claude माइक', loading: 'हिशोब उघडत आहे...', saveFail: 'जतन झाले नाही. इंटरनेट तपासा, पुन्हा प्रयत्न होईल.' },
    gu: { privacy: 'તમારો હિસાબ ફક્ત તમારા Claude એકાઉન્ટમાં સચવાય છે. ફક્ત તમે જોઈ શકો.', privacyLocal: 'તમારો હિસાબ આ બ્રાઉઝરમાં સચવાયો છે. બધે મેળવવા Claude માં સાઇન ઇન કરો.', noDict: 'આ બ્રાઉઝરમાં બોલવાનું નહીં ચાલે. Chrome માં ખોલો, અથવા લખીને નાખો.', claudeChip: 'Claude AI', micChip: 'Claude માઇક', loading: 'હિસાબ ખુલી રહ્યો છે...', saveFail: 'સચવાયું નહીં. ઇન્ટરનેટ તપાસો, ફરી પ્રયત્ન થશે.' },
  };

  // ---------------- state ----------------
  const S = {
    ready: false,
    lang: null,
    ledger: D.emptyLedger(),
    draft: null, // {text, entries, by, stt}
    tab: 'home',
    sub: 'sup',
    voice: 'idle',
    voiceFor: 'note',
    partial: '',
    heard: '',
    typing: false,
    busy: false,
    status: '',
    toast: null,
    answer: '',
    askBusy: false,
    question: '',
    editing: new Set(),
    hist: null,
    openNote: null,
    showSettings: false,
    wipeAsk: false,
    caps: { dict: null, sample: null, tts: null, db: null, user: null },
    dictNoLang: false,
    dictOff: false,
    store: 'local',
  };
  const today = () => D.todayIso();
  // claude.use() resolves null when a capability is unavailable; outside a viewer there is no window.claude at all.
  const use = (name) => (window.claude && typeof window.claude.use === 'function' ? Promise.resolve(window.claude.use(name)).catch(() => null) : Promise.resolve(null));

  function t(key, vars) {
    const pick = (lang) => key.split('.').reduce((o, k) => (o && typeof o === 'object' ? o[k] : undefined), D.I18N[lang]);
    let s = pick(S.lang || 'hi');
    if (typeof s !== 'string') s = pick('hi');
    if (typeof s !== 'string') return key;
    if (vars) for (const k in vars) s = s.split('{{' + k + '}}').join(vars[k]);
    return s;
  }
  const x = (key) => (EXTRA[S.lang || 'hi'] || EXTRA.hi)[key];
  function fmtDate(d) {
    if (!d) return '';
    const short = new Date(d + 'T00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
    if (d < today()) return t('date.late', { d: short });
    if (d === today()) return t('date.today');
    if (d === D.addDaysIso(today(), 1)) return t('date.tomorrow');
    return short;
  }

  // ---------------- storage: Claude db, else browser ----------------
  let refs = null; // {ledger, prefs, draft}
  const LS = 'dukaan-yaad-artifact';
  function lsGet() {
    try {
      return JSON.parse(localStorage.getItem(LS) || 'null');
    } catch (e) {
      return null;
    }
  }
  function lsSet(v) {
    try {
      localStorage.setItem(LS, JSON.stringify(v));
    } catch (e) {
      /* storage blocked: the page still works for this visit */
    }
  }
  const writing = {};
  const pending = {};
  function persist(kind, value) {
    if (!refs) {
      const all = lsGet() || {};
      all[kind] = value;
      lsSet(all);
      return;
    }
    // one write at a time per doc; keep only the latest value
    pending[kind] = value;
    if (writing[kind]) return;
    const flush = async () => {
      writing[kind] = true;
      while (pending[kind] !== undefined) {
        const v = pending[kind];
        pending[kind] = undefined;
        try {
          if (v === null) await refs[kind].delete();
          else await refs[kind].set(kind === 'draft' ? { d: v } : v);
        } catch (e) {
          if (kind === 'ledger') setStatus(x('saveFail'));
          if (pending[kind] === undefined) pending[kind] = v;
          await new Promise((r) => setTimeout(r, 3000));
        }
      }
      writing[kind] = false;
    };
    flush();
  }
  const saveLedger = () => persist('ledger', S.ledger);
  const saveDraft = () => persist('draft', S.draft);
  const savePrefs = () => persist('prefs', { lang: S.lang });

  async function loadStore() {
    const [user, db] = await Promise.all([use('user'), use('db')]);
    S.caps.user = user;
    S.caps.db = db;
    let id = null;
    try {
      id = user ? await user.id() : null;
    } catch (e) {
      id = null;
    }
    if (db && id) {
      const col = db.collection('data/users/' + id);
      refs = { ledger: col.doc('ledger'), prefs: col.doc('prefs'), draft: col.doc('draft') };
      const timeout = new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), 10000));
      try {
        const [l, p, d] = await Promise.race([Promise.all([refs.ledger.get(), refs.prefs.get(), refs.draft.get()]), timeout]);
        if (l.exists) S.ledger = { ...D.emptyLedger(), ...l.data() };
        if (p.exists) S.lang = p.data().lang || null;
        if (d.exists) S.draft = d.data().d || null;
        S.store = 'claude';
        return;
      } catch (e) {
        refs = null;
      }
    }
    const all = lsGet() || {};
    if (all.ledger) S.ledger = { ...D.emptyLedger(), ...all.ledger };
    if (all.prefs) S.lang = all.prefs.lang || null;
    if (all.draft) S.draft = all.draft;
    S.store = 'local';
  }

  // ---------------- capabilities ----------------
  async function loadCaps() {
    const [dict, sample, tts] = await Promise.all(['dictation', 'sample', 'tts'].map(use));
    S.caps.dict = dict;
    S.caps.sample = sample;
    S.caps.tts = tts;
    if (dict) {
      dict.onPartial(({ text }) => {
        S.partial = (S.heard + ' ' + (text || '')).trim();
        renderTalk();
      });
      dict.onFinal(({ text }) => {
        S.heard = (S.heard + text).trim();
        S.partial = S.heard;
        renderTalk();
      });
      dict.onState(({ state, reason }) => {
        if (state === 'listening' || state === 'starting') S.voice = 'listening';
        else if (state === 'finishing') S.voice = 'thinking';
        else {
          S.voice = 'idle';
          if (reason === 'not_granted') {
            S.dictOff = true;
            setStatus(t('mic.noPermission'));
            S.typing = true;
          } else if (reason === 'unavailable') {
            if (!S.dictNoLang) S.dictNoLang = true;
            else {
              S.dictOff = true;
              setStatus(x('noDict'));
              S.typing = true;
            }
          } else if (reason === 'rate_limited' || reason === 'upstream_error') setStatus(t('mic.failed'));
          finishDictation();
        }
        render();
      });
    }
    render();
  }

  function micTap(target) {
    const d = S.caps.dict;
    if (!d || S.dictOff) {
      setStatus(x('noDict'));
      S.typing = true;
      render();
      return;
    }
    if (S.voice === 'listening') {
      d.stop().catch(() => {});
      return;
    }
    if (S.voice !== 'idle' || S.busy) return;
    S.voiceFor = target;
    S.heard = '';
    S.partial = '';
    setStatus('');
    // start() must run synchronously inside the click
    const opts = S.dictNoLang ? undefined : { language: DICT_LANG[S.lang || 'hi'] };
    d.start(opts).catch((e) => {
      const code = e && e.code;
      if (code === 'not_granted') {
        S.dictOff = true;
        setStatus(t('mic.noPermission'));
        S.typing = true;
      } else if (code === 'unavailable') {
        if (!S.dictNoLang) {
          S.dictNoLang = true;
          setStatus(t('mic.failed'));
        } else {
          S.dictOff = true;
          setStatus(x('noDict'));
          S.typing = true;
        }
      } else if (code !== 'stopped' && code !== 'dismissed') setStatus(t('mic.failed'));
      S.voice = 'idle';
      render();
    });
    S.voice = 'listening';
    render();
  }

  function finishDictation() {
    const text = S.heard.trim();
    S.heard = '';
    S.partial = '';
    if (!text) return;
    if (S.voiceFor === 'ask') {
      S.question = text;
      doAsk(text);
    } else understandNote(text, 'claude-dictation');
  }

  // ---------------- understanding ----------------
  const knownParties = () => S.ledger.parties.map((p) => ({ name: p.name, aliases: p.aliases, side: D.ledger.partySide(S.ledger.entries, p.id) }));

  async function understandNote(text, stt) {
    const clean = text.trim();
    if (!clean) return setStatus(t('type.empty'));
    S.busy = true;
    setStatus('');
    render();
    const lang = S.lang || 'hi';
    let entries = null;
    let by = 'offline';
    if (S.caps.sample) {
      try {
        const names = [...new Set(S.ledger.parties.flatMap((p) => [p.name, ...p.aliases]))].slice(0, 120);
        const prompt = D.extractPrompt(clean, names, today(), lang) + '\nReturn only the JSON object.';
        const raw = await S.caps.sample.json(prompt, { modelTier: 'default' });
        entries = D.validateEntries(raw);
        by = 'anthropic';
      } catch (e) {
        if (e && e.code === 'not_granted') S.caps.sample = null;
        entries = null;
        setStatus(t('status.aiFailed'));
      }
    }
    if (!entries) entries = D.parseOffline(clean, { today: today(), lang, parties: knownParties() });
    const fresh = D.toDrafts(entries, clean, S.ledger.parties, lang, D.sidesOf(S.ledger));
    if (S.draft) S.draft = { ...S.draft, text: S.draft.text + ' ' + clean, entries: [...S.draft.entries, ...fresh], offline: S.draft.offline || by === 'offline' };
    else S.draft = { text: clean, entries: fresh, by, stt, offline: by === 'offline' };
    S.busy = false;
    S.typing = false;
    S.tab = 'home';
    const ta = $('#typed');
    if (ta) ta.value = '';
    saveDraft();
    render();
  }

  async function doAsk(q) {
    const question = (q || '').trim();
    if (!question) return;
    S.askBusy = true;
    S.answer = '';
    render();
    const snap = D.ledger.snapshot(S.ledger.entries, S.ledger.parties, today());
    const lang = S.lang || 'hi';
    let answer = null;
    if (S.caps.sample) {
      try {
        const r = await S.caps.sample.json(D.askPrompt(question, snap, lang), { modelTier: 'quick' });
        if (r && typeof r.answer === 'string' && r.answer.trim() && D.answerIsGrounded(r.answer, snap)) answer = r.answer.trim();
      } catch (e) {
        if (e && e.code === 'not_granted') S.caps.sample = null;
      }
    }
    S.answer = answer || D.answerLocal(question, snap, lang);
    S.askBusy = false;
    render();
  }

  // ---------------- actions ----------------
  let toastTimer = null;
  function toast(text, undoLedger) {
    S.toast = { text, undo: undoLedger || null, left: 10 };
    clearInterval(toastTimer);
    toastTimer = setInterval(() => {
      if (!S.toast) return clearInterval(toastTimer);
      S.toast.left -= 1;
      if (S.toast.left <= 0) {
        S.toast = null;
        clearInterval(toastTimer);
      }
      renderToast();
    }, 1000);
    renderToast();
  }
  function setStatus(s) {
    S.status = s || '';
  }
  function setLedger(next, msg) {
    const prev = S.ledger;
    S.ledger = next;
    saveLedger();
    if (msg) toast(msg, prev);
    render();
  }

  function tryExample() {
    const lang = S.lang || 'hi';
    S.ledger = D.withDemo(S.ledger, lang, today());
    saveLedger();
    const ex = D.demoExtraction(lang, today());
    S.draft = { text: ex.text, entries: D.toDrafts(ex.entries, ex.text, S.ledger.parties, lang, D.sidesOf(S.ledger)), by: 'demo', stt: null, offline: false };
    saveDraft();
    S.showSettings = false;
    S.tab = 'home';
    setStatus(t('example.loaded'));
    render();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function saveDraftToLedger() {
    if (!S.draft) return;
    const next = D.applySave(S.ledger, { text: S.draft.text, entries: S.draft.entries, by: S.draft.by, stt: S.draft.stt, lang: S.lang || 'hi', demo: S.draft.by === 'demo' });
    S.draft = null;
    S.editing.clear();
    saveDraft();
    setStatus('');
    setLedger(next, t('toast.saved'));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function updateEntry(i, patch) {
    const d = S.draft;
    let e = { ...d.entries[i], ...patch };
    if ('party' in patch || 'type' in patch) e = D.resolveParty({ ...e, forceNew: false }, S.ledger.parties, S.lang || 'hi', D.sidesOf(S.ledger));
    if ('amount' in patch && patch.amount != null && e.unclear && /kitna|kitne|how much|किती|કેટલ|rakam|amount|रक्कम|રકમ/i.test(e.unclear)) e.unclear = null;
    d.entries = d.entries.map((x2, j) => (j === i ? e : x2));
    saveDraft();
  }

  // ---------------- rendering ----------------
  const ICON = {
    mic: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 14a3 3 0 0 0 3-3V5a3 3 0 0 0-6 0v6a3 3 0 0 0 3 3zm5-3a5 5 0 0 1-10 0H5a7 7 0 0 0 6 6.92V21h2v-3.08A7 7 0 0 0 19 11h-2z"/></svg>',
    stop: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect fill="currentColor" x="6" y="6" width="12" height="12" rx="2"/></svg>',
    gear: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M19.14 12.94a7.07 7.07 0 0 0 0-1.88l2.03-1.58a.49.49 0 0 0 .12-.62l-1.92-3.32a.49.49 0 0 0-.6-.22l-2.39.96a7.03 7.03 0 0 0-1.62-.94l-.36-2.54a.48.48 0 0 0-.48-.4h-3.84a.48.48 0 0 0-.48.4l-.36 2.54a7.03 7.03 0 0 0-1.62.94l-2.39-.96a.49.49 0 0 0-.6.22L2.71 8.86a.48.48 0 0 0 .12.62l2.03 1.58a7.2 7.2 0 0 0 0 1.88l-2.03 1.58a.49.49 0 0 0-.12.62l1.92 3.32c.12.22.38.3.6.22l2.39-.96c.5.38 1.04.7 1.62.94l.36 2.54c.05.24.25.4.48.4h3.84c.24 0 .44-.16.48-.4l.36-2.54a7.03 7.03 0 0 0 1.62-.94l2.39.96c.22.08.48 0 .6-.22l1.92-3.32a.49.49 0 0 0-.12-.62l-2.03-1.58zM12 15.6A3.6 3.6 0 1 1 12 8.4a3.6 3.6 0 0 1 0 7.2z"/></svg>',
    keys: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M20 5H4a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2zm-9 3h2v2h-2V8zm0 3h2v2h-2v-2zM8 8h2v2H8V8zm0 3h2v2H8v-2zM5 8h2v2H5V8zm0 3h2v2H5v-2zm11 5H8v-2h8v2zm0-3h-2v-2h2v2zm0-3h-2V8h2v2zm3 3h-2v-2h2v2zm0-3h-2V8h2v2z"/></svg>',
    close: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M19 6.41 17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>',
    speaker: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M3 10v4h4l5 5V5L7 10H3zm13.5 2A4.5 4.5 0 0 0 14 7.97v8.05A4.48 4.48 0 0 0 16.5 12z"/></svg>',
  };

  function micButton(target, small) {
    const active = S.voiceFor === target ? S.voice : 'idle';
    const busy = active === 'thinking' || (target === 'note' && S.busy) || (target === 'ask' && S.askBusy);
    const label = active === 'listening' ? t('mic.stop') : target === 'ask' ? t('ask.micLabel') : S.draft ? t('review.addMore') : t('mic.start');
    return `<button type="button" class="mic ${small ? 'mic-sm' : ''} ${active === 'listening' ? 'on' : ''} ${busy ? 'busy' : ''} ${!S.caps.dict || S.dictOff ? 'off' : ''}" data-act="mic" data-target="${target}" aria-label="${esc(label)}" aria-pressed="${active === 'listening'}">${active === 'listening' ? ICON.stop : ICON.mic}</button>`;
  }

  function header() {
    const ent = S.ledger.entries;
    const sups = D.ledger.supplierDues(ent, S.ledger.parties);
    const cus = D.ledger.customerCredit(ent, S.ledger.parties);
    return `<header class="masthead"><div class="wrap">
      <div class="bar"><span class="brand">${esc(t('app.name'))}</span>
        <div class="chips">
          <span class="chip ${S.caps.dict && !S.dictOff ? '' : 'quiet'}">${esc(S.caps.dict && !S.dictOff ? x('micChip') : t('chip.typing'))}</span>
          <span class="chip ${S.caps.sample ? '' : 'quiet'}">${esc(S.caps.sample ? x('claudeChip') : t('chip.offlineMode'))}</span>
          <button type="button" class="icon-btn" data-act="settings" aria-label="${esc(t('settings.open'))}">${ICON.gear}</button>
        </div></div>
      <dl class="totals"><div><dt>${esc(t('totals.milna'))}</dt><dd>${rs(D.ledger.total(cus))}</dd></div><div><dt>${esc(t('totals.dena'))}</dt><dd>${rs(D.ledger.total(sups))}</dd></div></dl>
    </div></header>`;
  }

  function talkInner() {
    const v = S.voiceFor === 'note' ? S.voice : 'idle';
    const state = v === 'listening' ? t('mic.listening') : v === 'thinking' || S.busy ? t('mic.thinking') : S.draft ? t('mic.more') : t('mic.idle');
    const noMic = !S.caps.dict || S.dictOff;
    return `<div class="talk-main">${micButton('note', !!S.draft)}<p class="mic-state" aria-live="polite">${esc(noMic && !S.draft ? t('type.open') : state)}</p></div>
      <p class="partial" aria-live="polite">${esc(S.voiceFor === 'note' ? S.partial : '')}</p>
      ${!S.ledger.entries.length && !S.draft && !S.partial ? `<p class="hint">${esc(t('mic.hint'))}</p>` : ''}`;
  }
  function renderTalk() {
    const el = $('#talk');
    if (el) el.innerHTML = talkInner();
  }

  function talk() {
    return `<section class="talk ${S.draft ? 'compact' : ''}"><div id="talk" class="talk-box">${talkInner()}</div>
      <div class="acts center">
        <button type="button" class="text-btn" data-act="toggleType" aria-expanded="${S.typing}">${ICON.keys} ${esc(S.typing ? t('type.close') : t('type.open'))}</button>
        ${!S.draft ? `<button type="button" class="text-btn" data-act="example">${esc(t('example.try'))}</button>` : ''}
      </div>
      <form class="typed" id="typedForm" ${S.typing ? '' : 'hidden'}><textarea id="typed" placeholder="${esc(t('type.placeholder'))}" aria-label="${esc(t('type.open'))}"></textarea><button type="submit" class="btn" ${S.busy ? 'disabled' : ''}>${esc(t('type.go'))}</button></form>
    </section>`;
  }

  function review() {
    const d = S.draft;
    const byId = new Map(S.ledger.parties.map((p) => [p.id, p]));
    const unresolved = d.entries.some((e) => e.choices && e.choices.length);
    const cards = d.entries
      .map((e, i) => {
        const doubt = [e.choiceQuestion, e.unclear].filter(Boolean).join(' ');
        const open = S.editing.has(e.key) || (!!e.unclear && !e.choices);
        const linked = e.partyId ? byId.get(e.partyId) : null;
        const opts = ['supplier_due', 'supplier_paid', 'credit_given', 'credit_received', 'reorder', 'pending_order'].map((k) => `<option value="${k}" ${k === e.type ? 'selected' : ''}>${esc(t('types.' + k))}</option>`).join('');
        return `<div class="card entry ${doubt ? 'has-doubt' : ''}" data-i="${i}">
          <div class="row"><span class="tag">${esc(t('types.' + e.type))}</span><div class="acts m0">
            <button type="button" class="small" data-act="edit" data-i="${i}" aria-expanded="${open}">${esc(open ? t('review.doneEdit') : t('review.edit'))}</button>
            <button type="button" class="small" data-act="del" data-i="${i}" aria-label="${esc(t('review.removeLabel'))}">${esc(t('review.remove'))}</button></div></div>
          ${
            open
              ? `<div class="grid">
            <label>${esc(t('review.fields.type'))}<select data-f="type" data-i="${i}">${opts}</select></label>
            <label>${esc(t('review.fields.party'))}<input data-f="party" data-i="${i}" value="${esc(e.party)}" placeholder="${esc(t('review.fields.who'))}" autocomplete="off"></label>
            <label>${esc(t('review.fields.amount'))}<input data-f="amount" data-i="${i}" inputmode="numeric" value="${e.amount ?? ''}" placeholder="-"></label>
            <label>${esc(t('review.fields.due'))}<input data-f="due" data-i="${i}" type="date" value="${e.due || ''}"></label>
            <label class="full">${esc(t('review.fields.item'))}<input data-f="item" data-i="${i}" value="${esc(e.item)}" placeholder="-" autocomplete="off"></label></div>`
              : `<div class="summary"><div class="row"><b class="sum-name">${esc(e.party || e.item || '?')}</b>${e.amount != null ? `<span class="amt">${rs(e.amount)}</span>` : ''}</div>
            ${e.party && e.item ? `<div>${esc(e.item)}</div>` : ''}${e.due ? `<span class="tag ${e.due < today() ? 'late' : ''}">${esc(fmtDate(e.due))}</span>` : ''}</div>`
          }
          ${linked && !e.choices ? `<div class="linked">${esc(t('review.linked', { name: linked.name }))}</div>` : ''}
          ${
            doubt
              ? `<div class="doubt"><b>${esc(t('review.shak'))}:</b> ${esc(doubt)}${
                  e.choices
                    ? `<div class="acts">${e.choices.map((c) => `<button type="button" class="small" data-act="pick" data-i="${i}" data-pid="${esc(c.partyId)}">${esc(c.name)}</button>`).join('')}<button type="button" class="small" data-act="pick" data-i="${i}" data-pid="${D.NEW_PARTY}">${esc(t('review.newPerson'))}</button></div>`
                    : ''
                }</div>`
              : ''
          }
          ${e.quote ? `<div class="quote">“${esc(e.quote)}”</div>` : ''}</div>`;
      })
      .join('');
    return `<section class="review" aria-labelledby="h-review">
      <h2 id="h-review">${esc(t('review.title'))}</h2><p class="note-s">${esc(t('review.hint'))}</p>
      <div class="note-card"><div class="note-meta"><span>${esc(t('review.noteText'))}</span><span>${esc(t('review.by.' + d.by))}</span></div><div>${esc(d.text)}</div></div>
      ${d.offline && S.caps.sample ? `<div class="dlg"><p>${esc(t('review.reonlineHint'))}</p><div class="acts"><button type="button" class="small sel" data-act="reonline" ${S.busy ? 'disabled' : ''}>${esc(t('review.reonline'))}</button></div></div>` : ''}
      ${d.entries.length ? cards : `<p class="empty">${esc(t('review.none'))}</p>`}
      ${unresolved ? `<p class="status warn">${esc(t('review.chooseFirst'))}</p>` : ''}
      <button type="button" class="save" data-act="save" ${S.busy || unresolved ? 'disabled' : ''}>${esc(t('review.save'))}</button>
      <button type="button" class="wide" data-act="discard">${esc(t('review.discard'))}</button></section>`;
  }

  function home() {
    const k = D.ledger.kalKaKaam(S.ledger.entries, S.ledger.parties, today());
    const nothing = !k.pay.length && !k.reorder.length && !k.orders.length;
    let h = `<section aria-labelledby="h-kal"><h2 id="h-kal">${esc(t('home.kal'))}</h2>`;
    if (nothing) h += `<p class="empty">${esc(S.ledger.entries.length ? t('home.nothing') : t('home.noPay'))}</p>`;
    h += k.pay.map((x2) => `<div class="card row"><div><b>${esc(t('home.payTo', { name: x2.name }))}</b><br><span class="tag ${x2.due && x2.due < today() ? 'late' : ''}">${esc(fmtDate(x2.due))}</span></div><span class="amt">${rs(x2.bal)}</span></div>`).join('');
    if (!k.pay.length && !nothing) h += `<p class="empty">${esc(t('home.noPay'))}</p>`;
    if (k.reorder.length) h += `<div class="card"><b>${esc(t('home.reorder', { count: k.reorder.length }))}</b><div class="items">${esc(k.reorder.map((i) => i.item).join(', '))}</div></div>`;
    h += k.orders.map((o) => `<div class="card row"><div><b>${esc(t('home.orderOf', { name: o.name || '?' }))}</b>${o.item ? ': ' + esc(o.item) : ''}<br>${o.due ? `<span class="tag">${esc(fmtDate(o.due))}</span>` : `<span class="note-s">${esc(t('home.noDate'))}</span>`}</div></div>`).join('');
    h += `</section><section aria-labelledby="h-notes"><h2 id="h-notes">${esc(t('home.notes'))}</h2>`;
    const notes = [...S.ledger.notes].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 8);
    if (!notes.length) h += `<p class="empty">${esc(t('home.noNotes'))}</p>`;
    h += notes
      .map((n) => {
        const isOpen = S.openNote === n.id;
        const list = isOpen ? S.ledger.entries.filter((e) => e.noteId === n.id) : [];
        return `<div class="card"><button type="button" class="linkish" data-act="note" data-id="${esc(n.id)}" aria-expanded="${isOpen}">
          <span class="note-meta"><span>${esc(new Date(n.createdAt).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' }))}</span><span>${esc(t('home.entries', { count: n.entryIds.length }))}</span></span>
          <span class="note-text">${esc(n.text)}</span></button>
          ${isOpen ? `<ul class="mini">${list.map((e) => `<li><span class="tag">${esc(t('types.' + e.type))}</span> ${esc(e.party || '')} ${esc(e.item || '')} ${e.amount != null ? rs(e.amount) : ''}${e.status === 'done' ? ' ✓' : ''}</li>`).join('')}</ul>` : ''}</div>`;
      })
      .join('');
    return h + '</section>';
  }

  function khata() {
    const ent = S.ledger.entries;
    const ps = S.ledger.parties;
    const tabs = ['sup', 'cus', 'maal', 'ord'].map((s) => `<button type="button" aria-pressed="${S.sub === s}" data-act="sub" data-sub="${s}">${esc(t('khata.tabs.' + s))}</button>`).join('');
    const nameBtn = (b) => (b.partyId ? `<button type="button" class="linkish name" data-act="hist" data-key="${esc(b.key)}" aria-expanded="${S.hist === b.key}">${esc(b.name)}</button>` : `<b>${esc(b.name)}</b>`);
    const hist = (b) =>
      S.hist === b.key && b.partyId
        ? `<div class="history"><div class="note-s">${esc(t('khata.history', { name: b.name }))}</div><ul class="mini">${D.ledger
            .partyHistory(ent, b.partyId)
            .map((e) => `<li><span class="note-s">${esc(new Date(e.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }))}</span> <span class="tag">${esc(t('types.' + e.type))}</span> ${e.amount != null ? rs(e.amount) : ''} ${esc(e.item || '')}</li>`)
            .join('')}</ul></div>`
        : '';
    let body = '';
    if (S.sub === 'sup') {
      const l = D.ledger.supplierDues(ent, ps);
      body = l.length
        ? l.map((b) => `<div class="card"><div class="row"><div>${nameBtn(b)}${b.due ? `<br><span class="tag ${b.due < today() ? 'late' : ''}">${esc(fmtDate(b.due))}</span>` : ''}</div><div class="row"><span class="amt">${rs(b.bal)}</span><button type="button" class="small" data-act="paid" data-key="${esc(b.key)}">${esc(t('khata.paid'))}</button></div></div>${hist(b)}</div>`).join('')
        : `<p class="empty">${esc(t('khata.noSup'))}</p>`;
    } else if (S.sub === 'cus') {
      const l = D.ledger.customerCredit(ent, ps);
      body = l.length
        ? l.map((b) => `<div class="card"><div class="row">${nameBtn(b)}<div class="row"><span class="amt">${rs(b.bal)}</span><button type="button" class="small" data-act="settle" data-key="${esc(b.key)}">${esc(t('khata.settle'))}</button></div></div>${hist(b)}</div>`).join('')
        : `<p class="empty">${esc(t('khata.noCus'))}</p>`;
    } else if (S.sub === 'maal') {
      const g = D.ledger.groupBySupplier(D.ledger.openReorders(ent, ps));
      body = g.length
        ? g.map((grp) => `<div class="group"><h3>${esc(grp.supplier || t('khata.noSupplier'))}</h3>${grp.items.map((i) => `<div class="card row"><b>${esc(i.item)}</b><button type="button" class="small" data-act="done" data-ids="${esc(i.ids.join(','))}">${esc(t('khata.gotIt'))}</button></div>`).join('')}</div>`).join('')
        : `<p class="empty">${esc(t('khata.noMaal'))}</p>`;
    } else {
      const o = D.ledger.openOrders(ent, ps);
      body = o.length
        ? o.map((e) => `<div class="card row"><div><b>${esc(e.name || '?')}</b>${e.item ? ': ' + esc(e.item) : ''}${e.amount ? ' · ' + rs(e.amount) : ''}${e.due ? `<br><span class="tag ${e.due < today() ? 'late' : ''}">${esc(fmtDate(e.due))}</span>` : ''}</div><button type="button" class="small" data-act="done" data-ids="${esc(e.id)}">${esc(t('khata.done'))}</button></div>`).join('')
        : `<p class="empty">${esc(t('khata.noOrd'))}</p>`;
    }
    return `<section aria-labelledby="h-khata"><h2 id="h-khata">${esc(t('khata.title'))}</h2><div class="subtabs" role="group" aria-label="${esc(t('khata.groupLabel'))}">${tabs}</div><div class="list">${body}</div></section>`;
  }

  function ask() {
    const v = S.voiceFor === 'ask' ? S.voice : 'idle';
    const ex = ['ex1', 'ex2', 'ex3', 'ex4'].map((k) => `<button type="button" class="small" data-act="askEx" data-q="${esc(t('ask.' + k))}">${esc(t('ask.' + k))}</button>`).join('');
    return `<section aria-labelledby="h-ask"><h2 id="h-ask">${esc(t('ask.title'))}</h2><p class="note-s">${esc(t('ask.hint'))}</p>
      <div class="ask-card"><div class="ask-mic">${micButton('ask', true)}<span class="note-s" aria-live="polite">${esc(v === 'listening' ? S.partial || t('mic.listening') : v === 'thinking' ? t('mic.thinking') : t('ask.micLabel'))}</span></div>
      <form class="ask-form" id="askForm"><input id="q" value="${esc(S.question)}" placeholder="${esc(t('ask.placeholder'))}" aria-label="${esc(t('ask.placeholder'))}" enterkeyhint="search"><button type="submit" class="small sel" ${S.askBusy ? 'disabled' : ''}>${esc(t('ask.go'))}</button></form></div>
      <div aria-live="polite">${S.askBusy ? `<p class="empty">${esc(t('ask.thinking'))}</p>` : ''}${
        S.answer && !S.askBusy ? `<div class="ans"><div class="ans-text">${esc(S.answer)}</div>${S.caps.tts ? `<button type="button" class="small" data-act="speak">${ICON.speaker} ${esc(t('ask.speak'))}</button>` : ''}</div>` : ''
      }</div>
      <div class="examples"><div class="note-s">${esc(t('ask.examples'))}</div><div class="acts">${ex}</div></div></section>`;
  }

  function settings() {
    const hasDemo = S.ledger.entries.some((e) => e.demo);
    return `<div class="settings" role="dialog" aria-modal="true" aria-labelledby="h-settings"><div class="wrap">
      <div class="row settings-top"><h2 id="h-settings">${esc(t('settings.title'))}</h2><button type="button" class="icon-btn" data-act="closeSettings" aria-label="${esc(t('settings.close'))}">${ICON.close}</button></div>
      <div class="card"><label class="field" for="langSel">${esc(t('settings.lang'))}<select id="langSel">${LANGS.map((l) => `<option value="${l}" ${l === S.lang ? 'selected' : ''}>${esc(LANG_NAMES[l])}</option>`).join('')}</select></label></div>
      <h3>${esc(t('settings.demo'))}</h3>
      <div class="card acts"><button type="button" class="small" data-act="example">${esc(t('settings.demoLoad'))}</button>${hasDemo ? `<button type="button" class="small" data-act="clearDemo">${esc(t('settings.demoClear'))}</button>` : ''}</div>
      <div class="card"><p><b>${esc(S.store === 'claude' ? x('privacy') : x('privacyLocal'))}</b></p>
      ${
        !S.wipeAsk
          ? `<div class="acts"><button type="button" class="small" data-act="wipe">${esc(t('settings.wipe'))}</button></div>`
          : `<div class="dlg" role="alert">${esc(t('settings.wipeConfirm'))}<div class="acts"><button type="button" class="danger" data-act="wipeYes">${esc(t('settings.wipeYes'))}</button><button type="button" class="small" data-act="wipeNo">${esc(t('settings.wipeNo'))}</button></div></div>`
      }</div>
      <p class="note-s center">${esc(t('settings.about'))}</p></div></div>`;
  }

  function onboard() {
    return `<main class="onboard"><div class="wrap"><p class="brand">Dukaan Yaad</p><h1>Bolo, hisaab yaad rahega</h1>
      <h2>Bhasha chuno / Choose language</h2><div class="lang-grid">${LANGS.map((l) => `<button type="button" class="lang-btn" data-act="lang" data-lang="${l}">${esc(LANG_NAMES[l])}</button>`).join('')}</div></div></main>`;
  }

  function renderToast() {
    const el = $('#toast');
    if (!el) return;
    if (!S.toast) {
      el.hidden = true;
      el.innerHTML = '';
      return;
    }
    el.hidden = false;
    el.innerHTML = `<span>${esc(S.toast.text)}</span>${S.toast.undo ? `<button type="button" class="small" data-act="undo">${esc(t('toast.undo'))} (${S.toast.left})</button>` : ''}`;
  }

  function render() {
    const root = $('#app');
    if (!S.ready) {
      root.innerHTML = `<main class="loading"><p>${esc(x('loading'))}</p></main>`;
      return;
    }
    document.documentElement.lang = { hi: 'hi-Latn', en: 'en-IN', mr: 'mr', gu: 'gu' }[S.lang || 'hi'];
    if (!S.lang) {
      root.innerHTML = onboard();
      return;
    }
    const typedVal = $('#typed') ? $('#typed').value : '';
    let main = '';
    if (S.tab === 'home') main = talk() + (S.status ? `<div class="status" role="status">${esc(S.status)}</div>` : '') + (S.draft ? review() : home());
    else main = (S.status ? `<div class="status" role="status">${esc(S.status)}</div>` : '') + (S.tab === 'khata' ? khata() : ask());
    root.innerHTML = `${header()}<main class="page" id="main"><div class="wrap">${main}</div></main>
      <nav aria-label="Main"><div class="wrap">${['home', 'khata', 'ask'].map((k) => `<button type="button" data-act="tab" data-tab="${k}" ${S.tab === k ? 'aria-current="page"' : ''}>${esc(t('nav.' + k))}</button>`).join('')}</div></nav>
      <div class="toast" id="toast" role="status" aria-live="polite" hidden></div>${S.showSettings ? settings() : ''}`;
    if ($('#typed')) $('#typed').value = typedVal;
    renderToast();
  }

  // ---------------- events ----------------
  const balanceByKey = (kind, key) => (kind === 'sup' ? D.ledger.supplierDues : D.ledger.customerCredit)(S.ledger.entries, S.ledger.parties).find((b) => b.key === key);

  document.addEventListener('click', (ev) => {
    const b = ev.target.closest('[data-act]');
    if (!b) return;
    const act = b.dataset.act;
    const i = b.dataset.i != null ? Number(b.dataset.i) : null;
    switch (act) {
      case 'mic':
        return micTap(b.dataset.target); // synchronous: dictation needs the click
      case 'lang':
        S.lang = b.dataset.lang;
        savePrefs();
        return render();
      case 'tab':
        if (S.voice === 'listening' && S.caps.dict) S.caps.dict.stop().catch(() => {});
        S.tab = b.dataset.tab;
        setStatus('');
        render();
        return window.scrollTo({ top: 0 });
      case 'toggleType':
        S.typing = !S.typing;
        render();
        if (S.typing && $('#typed')) $('#typed').focus();
        return;
      case 'example':
        return tryExample();
      case 'settings':
        S.showSettings = true;
        return render();
      case 'closeSettings':
        S.showSettings = false;
        S.wipeAsk = false;
        return render();
      case 'edit': {
        const k = S.draft.entries[i].key;
        if (S.editing.has(k)) S.editing.delete(k);
        else S.editing.add(k);
        return render();
      }
      case 'del':
        S.draft.entries = S.draft.entries.filter((_, j) => j !== i);
        saveDraft();
        return render();
      case 'pick':
        S.draft.entries = S.draft.entries.map((e, j) => (j === i ? D.chooseParty(e, b.dataset.pid, S.ledger.parties) : e));
        saveDraft();
        return render();
      case 'save':
        return saveDraftToLedger();
      case 'discard':
        S.draft = null;
        S.editing.clear();
        saveDraft();
        setStatus(t('toast.discarded'));
        return render();
      case 'reonline':
        if (S.draft) {
          const text = S.draft.text;
          S.draft = null;
          return understandNote(text, null);
        }
        return;
      case 'note':
        S.openNote = S.openNote === b.dataset.id ? null : b.dataset.id;
        return render();
      case 'sub':
        S.sub = b.dataset.sub;
        return render();
      case 'hist':
        S.hist = S.hist === b.dataset.key ? null : b.dataset.key;
        return render();
      case 'paid': {
        const bal = balanceByKey('sup', b.dataset.key);
        if (bal) setLedger(D.addButtonEntry(S.ledger, 'supplier_paid', bal, 'Paid'), t('toast.paid'));
        return;
      }
      case 'settle': {
        const bal = balanceByKey('cus', b.dataset.key);
        if (bal) setLedger(D.addButtonEntry(S.ledger, 'credit_received', bal, 'Mil gaya'), t('toast.settled'));
        return;
      }
      case 'done':
        return setLedger(D.markDone(S.ledger, b.dataset.ids.split(',')), t('toast.done'));
      case 'undo':
        if (S.toast && S.toast.undo) {
          S.ledger = S.toast.undo;
          saveLedger();
          S.toast = { text: t('toast.undone'), undo: null, left: 4 };
          render();
        }
        return;
      case 'askEx':
        S.question = b.dataset.q;
        return doAsk(b.dataset.q);
      case 'speak':
        if (S.caps.tts && S.answer) S.caps.tts.speak(S.answer).catch(() => {});
        return;
      case 'clearDemo':
        S.ledger = D.withoutDemo(S.ledger);
        if (S.draft && S.draft.by === 'demo') {
          S.draft = null;
          saveDraft();
        }
        saveLedger();
        toast(t('toast.demoCleared'));
        return render();
      case 'wipe':
        S.wipeAsk = true;
        return render();
      case 'wipeNo':
        S.wipeAsk = false;
        return render();
      case 'wipeYes':
        S.ledger = D.emptyLedger();
        S.draft = null;
        S.wipeAsk = false;
        S.showSettings = false;
        saveLedger();
        saveDraft();
        toast(t('toast.wiped'));
        return render();
    }
  });

  document.addEventListener('change', (ev) => {
    const el = ev.target;
    if (el.id === 'langSel') {
      S.lang = el.value;
      savePrefs();
      return render();
    }
    if (el.dataset && el.dataset.f && S.draft) {
      const i = Number(el.dataset.i);
      const f = el.dataset.f;
      let v = el.value;
      if (f === 'amount') v = v.replace(/[^\d.]/g, '') === '' ? null : Number(v.replace(/[^\d.]/g, ''));
      else v = v || null;
      updateEntry(i, { [f]: v });
      render();
    }
  });

  document.addEventListener('submit', (ev) => {
    ev.preventDefault();
    if (ev.target.id === 'typedForm') understandNote($('#typed').value, null);
    if (ev.target.id === 'askForm') {
      S.question = $('#q').value;
      doAsk(S.question);
    }
  });

  // ---------------- boot ----------------
  render();
  loadStore().then(() => {
    S.ready = true;
    render();
    loadCaps();
  });
})();
