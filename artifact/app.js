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
    hi: {
      privacy: 'Aapka hisaab sirf aapke Claude account mein save hota hai. Sirf aap dekh sakte ho.', privacyLocal: 'Aapka hisaab is browser mein save hai. Claude mein sign in karke kholo to har jagah milega.',
      noDict: 'Is browser mein bolna nahi chalega. Chrome mein kholo, ya likh kar daalo.', loading: 'Hisaab khul raha hai...', saveFail: 'Save nahi hua. Internet check karo, dobara koshish hogi.',
      introTitle: 'Din ke ant mein 1 minute bolo. Hisaab yaad rahega.', introSub: 'Supplier ka paisa, khatam maal, udhaar aur orders: bolkar note karo, app yaad rakhega.',
      step1: 'Bolo', step1d: 'Din ka hisaab apni bhasha mein', step2: 'Check karo', step2d: 'Har entry dekho, phir save', step3: 'Kal ka kaam', step3d: 'Kisko dena hai, kya mangwana hai',
      sayLike: 'Aise bolo', phrases: ['Ramesh ko 5000 dena hai Friday tak', 'Maggi aur Parle-G khatam', 'Sharma ji ka 200 udhaar'],
      tryExample: 'Example dekho', tryExampleSub: 'Bina bole poora app dekho', orType: 'ya likh kar daalo',
      found: '{{n}} entries mili', needChoice: '{{n}} mein aapko chunna hai', allGood: 'Sab saaf hai',
      kalEmpty: 'Kal ke liye kuch baaki nahi. Upar mic dabao aur aaj ka hisaab bolo.', limited: 'Bina AI', typingOnly: 'Sirf likh kar', chooseShort: 'Pehle naam chuno', tapToStop: 'Rukne ke liye dobara dabao',
    },
    en: {
      privacy: 'Your ledger is saved in your Claude account. Only you can see it.', privacyLocal: 'Your ledger is saved in this browser. Sign in to Claude to keep it everywhere.',
      noDict: 'Speaking is not available in this browser. Open it in Chrome, or type instead.', loading: 'Opening your ledger...', saveFail: 'Could not save. Check the internet; it will try again.',
      introTitle: 'Speak for a minute at closing time. Your shop remembers.', introSub: 'Supplier dues, items that ran out, customer credit and orders: say them once, the app keeps track.',
      step1: 'Speak', step1d: 'The day’s account, in your language', step2: 'Check', step2d: 'See every entry, then save', step3: 'Tomorrow’s work', step3d: 'Who to pay, what to reorder',
      sayLike: 'Try saying', phrases: ['Owe Ramesh 5000 by Friday', 'Maggi and Parle-G finished', 'Sharma took 200 on credit'],
      tryExample: 'See an example', tryExampleSub: 'Explore the whole app without speaking', orType: 'or type instead',
      found: '{{n}} entries found', needChoice: '{{n}} need your choice', allGood: 'All clear',
      kalEmpty: 'Nothing due for tomorrow. Tap the mic above and say today’s account.', limited: 'No AI', typingOnly: 'Typing only', chooseShort: 'Choose the name first', tapToStop: 'Tap again to stop',
    },
    mr: {
      privacy: 'तुमचा हिशोब फक्त तुमच्या Claude खात्यात जतन होतो. फक्त तुम्ही पाहू शकता.', privacyLocal: 'तुमचा हिशोब या ब्राउझरमध्ये जतन आहे. सगळीकडे मिळण्यासाठी Claude मध्ये साइन इन करा.',
      noDict: 'या ब्राउझरमध्ये बोलणे चालणार नाही. Chrome मध्ये उघडा, किंवा लिहून टाका.', loading: 'हिशोब उघडत आहे...', saveFail: 'जतन झाले नाही. इंटरनेट तपासा, पुन्हा प्रयत्न होईल.',
      introTitle: 'दिवसाअखेर 1 मिनिट बोला. हिशोब लक्षात राहील.', introSub: 'पुरवठादाराचे पैसे, संपलेला माल, उधार आणि ऑर्डर: एकदा बोला, अ‍ॅप लक्षात ठेवेल.',
      step1: 'बोला', step1d: 'दिवसाचा हिशोब तुमच्या भाषेत', step2: 'तपासा', step2d: 'प्रत्येक नोंद पहा, मग जतन करा', step3: 'उद्याचे काम', step3d: 'कोणाला द्यायचे, काय मागवायचे',
      sayLike: 'असे बोला', phrases: ['रमेशला 5000 द्यायचे आहेत शुक्रवारपर्यंत', 'साखर आणि तेल संपले', 'पाटील यांचे 300 उधार'],
      tryExample: 'उदाहरण पहा', tryExampleSub: 'न बोलता पूर्ण अ‍ॅप पहा', orType: 'किंवा लिहून टाका',
      found: '{{n}} नोंदी मिळाल्या', needChoice: '{{n}} मध्ये निवडायचे आहे', allGood: 'सगळे ठीक',
      kalEmpty: 'उद्यासाठी काही बाकी नाही. वर माइक दाबा आणि आजचा हिशोब बोला.', limited: 'AI शिवाय', typingOnly: 'फक्त लिहून', chooseShort: 'आधी नाव निवडा', tapToStop: 'थांबण्यासाठी पुन्हा दाबा',
    },
    gu: {
      privacy: 'તમારો હિસાબ ફક્ત તમારા Claude એકાઉન્ટમાં સચવાય છે. ફક્ત તમે જોઈ શકો.', privacyLocal: 'તમારો હિસાબ આ બ્રાઉઝરમાં સચવાયો છે. બધે મેળવવા Claude માં સાઇન ઇન કરો.',
      noDict: 'આ બ્રાઉઝરમાં બોલવાનું નહીં ચાલે. Chrome માં ખોલો, અથવા લખીને નાખો.', loading: 'હિસાબ ખુલી રહ્યો છે...', saveFail: 'સચવાયું નહીં. ઇન્ટરનેટ તપાસો, ફરી પ્રયત્ન થશે.',
      introTitle: 'દિવસના અંતે 1 મિનિટ બોલો. હિસાબ યાદ રહેશે.', introSub: 'સપ્લાયરના પૈસા, ખતમ માલ, ઉધાર અને ઓર્ડર: એકવાર બોલો, એપ યાદ રાખશે.',
      step1: 'બોલો', step1d: 'દિવસનો હિસાબ તમારી ભાષામાં', step2: 'તપાસો', step2d: 'દરેક એન્ટ્રી જુઓ, પછી સાચવો', step3: 'કાલનું કામ', step3d: 'કોને આપવાના, શું મંગાવવાનું',
      sayLike: 'આવું બોલો', phrases: ['રમેશભાઈને 5000 આપવાના છે શુક્રવાર સુધી', 'ખાંડ અને તેલ ખતમ', 'પટેલ ભાઈ 200 ઉધાર લઈ ગયા'],
      tryExample: 'ઉદાહરણ જુઓ', tryExampleSub: 'બોલ્યા વગર આખી એપ જુઓ', orType: 'અથવા લખીને નાખો',
      found: '{{n}} એન્ટ્રી મળી', needChoice: '{{n}} માં પસંદ કરવાનું છે', allGood: 'બધું બરાબર',
      kalEmpty: 'કાલ માટે કંઈ બાકી નથી. ઉપર માઇક દબાવો અને આજનો હિસાબ બોલો.', limited: 'AI વગર', typingOnly: 'ફક્ત લખીને', chooseShort: 'પહેલાં નામ પસંદ કરો', tapToStop: 'રોકવા માટે ફરી દબાવો',
    },
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
  const svg = (d) => `<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="${d}"/></svg>`;
  const ICON = {
    mic: svg('M12 14a3 3 0 0 0 3-3V5a3 3 0 0 0-6 0v6a3 3 0 0 0 3 3zm5-3a5 5 0 0 1-10 0H5a7 7 0 0 0 6 6.92V21h2v-3.08A7 7 0 0 0 19 11h-2z'),
    stop: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect fill="currentColor" x="6" y="6" width="12" height="12" rx="2"/></svg>',
    gear: svg('M19.14 12.94a7.07 7.07 0 0 0 0-1.88l2.03-1.58a.49.49 0 0 0 .12-.62l-1.92-3.32a.49.49 0 0 0-.6-.22l-2.39.96a7.03 7.03 0 0 0-1.62-.94l-.36-2.54a.48.48 0 0 0-.48-.4h-3.84a.48.48 0 0 0-.48.4l-.36 2.54a7.03 7.03 0 0 0-1.62.94l-2.39-.96a.49.49 0 0 0-.6.22L2.71 8.86a.48.48 0 0 0 .12.62l2.03 1.58a7.2 7.2 0 0 0 0 1.88l-2.03 1.58a.49.49 0 0 0-.12.62l1.92 3.32c.12.22.38.3.6.22l2.39-.96c.5.38 1.04.7 1.62.94l.36 2.54c.05.24.25.4.48.4h3.84c.24 0 .44-.16.48-.4l.36-2.54a7.03 7.03 0 0 0 1.62-.94l2.39.96c.22.08.48 0 .6-.22l1.92-3.32a.49.49 0 0 0-.12-.62l-2.03-1.58zM12 15.6A3.6 3.6 0 1 1 12 8.4a3.6 3.6 0 0 1 0 7.2z'),
    keys: svg('M20 5H4a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2zm-9 3h2v2h-2V8zm0 3h2v2h-2v-2zM8 8h2v2H8V8zm0 3h2v2H8v-2zM5 8h2v2H5V8zm0 3h2v2H5v-2zm11 5H8v-2h8v2zm0-3h-2v-2h2v2zm0-3h-2V8h2v2zm3 3h-2v-2h2v2zm0-3h-2V8h2v2z'),
    close: svg('M19 6.41 17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z'),
    speaker: svg('M3 10v4h4l5 5V5L7 10H3zm13.5 2A4.5 4.5 0 0 0 14 7.97v8.05A4.48 4.48 0 0 0 16.5 12zM14 3.23v2.06a7 7 0 0 1 0 13.42v2.06a9 9 0 0 0 0-17.54z'),
    today: svg('M19 3h-1V1h-2v2H8V1H6v2H5c-1.11 0-1.99.9-1.99 2L3 19a2 2 0 0 0 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H5V8h14v11zM7 10h5v5H7z'),
    book: svg('M21 5c-1.11-.35-2.33-.5-3.5-.5-1.95 0-4.05.4-5.5 1.5-1.45-1.1-3.55-1.5-5.5-1.5S2.45 4.9 1 6v14.65c0 .25.25.5.5.5.1 0 .15-.05.25-.05C3.1 20.45 5.05 20 6.5 20c1.95 0 4.05.4 5.5 1.5 1.35-.85 3.8-1.5 5.5-1.5 1.65 0 3.35.3 4.75 1.05.1.05.15.05.25.05.25 0 .5-.25.5-.5V6c-.6-.45-1.25-.75-2-1zm0 13.5c-1.1-.35-2.3-.5-3.5-.5-1.7 0-4.15.65-5.5 1.5V8c1.35-.85 3.8-1.5 5.5-1.5 1.2 0 2.4.15 3.5.5v11.5z'),
    ask: svg('M21 6h-2v9H6v2c0 .55.45 1 1 1h11l4 4V7c0-.55-.45-1-1-1zm-4 6V3c0-.55-.45-1-1-1H3c-.55 0-1 .45-1 1v14l4-4h10c.55 0 1-.45 1-1z'),
    truck: svg('M20 8h-3V4H3c-1.1 0-2 .9-2 2v11h2c0 1.66 1.34 3 3 3s3-1.34 3-3h6c0 1.66 1.34 3 3 3s3-1.34 3-3h2v-5l-3-4zM6 18.5c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zm13.5-9 1.96 2.5H17V9.5h2.5zm-1.5 9c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5z'),
    paid: svg('M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z'),
    person: svg('M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z'),
    moneyIn: svg('M20 5.41 18.59 4 7 15.59V9H5v10h10v-2H8.41z'),
    moneyOut: svg('M9 5v2h6.59L4 18.59 5.41 20 17 8.41V15h2V5z'),
    cart: svg('M7 18c-1.1 0-1.99.9-1.99 2S5.9 22 7 22s2-.9 2-2-.9-2-2-2zM1 2v2h2l3.6 7.59-1.35 2.45c-.16.28-.25.61-.25.96 0 1.1.9 2 2 2h12v-2H7.42c-.14 0-.25-.11-.25-.25l.03-.12.9-1.63h7.45c.75 0 1.41-.41 1.75-1.03l3.58-6.49A1.003 1.003 0 0 0 20 4H5.21l-.94-2H1zm16 16c-1.1 0-1.99.9-1.99 2s.89 2 1.99 2 2-.9 2-2-.9-2-2-2z'),
    bag: svg('M18 6h-2c0-2.21-1.79-4-4-4S8 3.79 8 6H6c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2zm-6-2c1.1 0 2 .9 2 2h-4c0-1.1.9-2 2-2zm6 16H6V8h2v2c0 .55.45 1 1 1s1-.45 1-1V8h4v2c0 .55.45 1 1 1s1-.45 1-1V8h2v12z'),
    pencil: svg('M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04a.996.996 0 0 0 0-1.41l-2.34-2.34a.996.996 0 0 0-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z'),
    trash: svg('M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z'),
    check: svg('M9 16.17 4.83 12l-1.42 1.42L9 19 21 7l-1.41-1.41z'),
    play: svg('M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 14.5v-9l6 4.5-6 4.5z'),
    help: svg('M11 18h2v-2h-2v2zm1-16C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm0-14c-2.21 0-4 1.79-4 4h2c0-1.1.9-2 2-2s2 .9 2 2c0 2-3 1.75-3 5h2c0-2.25 3-2.5 3-5 0-2.21-1.79-4-4-4z'),
    note: svg('M14 2H6c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z'),
  };
  const TYPE_ICON = { supplier_due: 'truck', supplier_paid: 'paid', credit_given: 'person', credit_received: 'moneyIn', reorder: 'cart', pending_order: 'bag' };
  const badge = (name, tone) => `<span class="ico ${tone || ''}">${ICON[name]}</span>`;

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
    // chips only when something is limited; a working app needs no status jargon
    const chips = [];
    if (!S.caps.dict || S.dictOff) chips.push(`<span class="chip quiet">${ICON.keys}${esc(x('typingOnly'))}</span>`);
    if (!S.caps.sample) chips.push(`<span class="chip quiet">${esc(x('limited'))}</span>`);
    return `<header class="masthead"><div class="wrap">
      <div class="bar"><span class="brand"><span class="brand-mark">${ICON.note}</span>${esc(t('app.name'))}</span>
        <div class="chips">${chips.join('')}<button type="button" class="icon-btn" data-act="settings" aria-label="${esc(t('settings.open'))}">${ICON.gear}</button></div></div>
      <dl class="totals">
        <div><dt>${badge('moneyIn', 'in')}${esc(t('totals.milna'))}</dt><dd>${rs(D.ledger.total(cus))}</dd></div>
        <div><dt>${badge('moneyOut', 'out')}${esc(t('totals.dena'))}</dt><dd>${rs(D.ledger.total(sups))}</dd></div>
      </dl></div></header>`;
  }

  function talkInner() {
    const v = S.voiceFor === 'note' ? S.voice : 'idle';
    const noMic = !S.caps.dict || S.dictOff;
    let state = v === 'listening' ? t('mic.listening') : v === 'thinking' || S.busy ? t('mic.thinking') : S.draft ? t('mic.more') : t('mic.idle');
    if (noMic && !S.draft && v === 'idle' && !S.busy) state = t('type.open');
    const sub = v === 'listening' ? x('tapToStop') : '';
    return `<div class="talk-main">${micButton('note', !!S.draft)}<div class="talk-text"><p class="mic-state" aria-live="polite">${esc(state)}</p>${sub ? `<p class="mic-sub">${esc(sub)}</p>` : ''}</div></div>
      <p class="partial" aria-live="polite">${esc(S.voiceFor === 'note' ? S.partial : '')}</p>`;
  }
  function renderTalk() {
    const el = $('#talk');
    if (el) el.innerHTML = talkInner();
  }

  function talk() {
    const fresh = !S.ledger.entries.length && !S.draft;
    const phrases = (x('phrases') || []).map((ph) => `<button type="button" class="phrase" data-act="phrase" data-text="${esc(ph)}">“${esc(ph)}”</button>`).join('');
    return `<section class="talk ${S.draft ? 'compact' : ''}"><div id="talk" class="talk-box">${talkInner()}</div>
      ${
        fresh && S.voice === 'idle'
          ? `<button type="button" class="example-card" data-act="example">${badge('play')}<span><b>${esc(x('tryExample'))}</b><span>${esc(x('tryExampleSub'))}</span></span></button>`
          : ''
      }
      ${
        fresh && !S.partial && S.voice === 'idle'
          ? `<div class="say-like"><p class="say-label">${esc(x('sayLike'))}</p><div class="phrases">${phrases}</div></div>`
          : ''
      }
      <div class="acts center">
        <button type="button" class="text-btn" data-act="toggleType" aria-expanded="${S.typing}">${ICON.keys} ${esc(S.typing ? t('type.close') : S.draft ? t('type.open') : x('orType'))}</button>
      </div>
      <form class="typed" id="typedForm" ${S.typing ? '' : 'hidden'}><textarea id="typed" placeholder="${esc(t('type.placeholder'))}" aria-label="${esc(t('type.open'))}"></textarea><button type="submit" class="btn" ${S.busy ? 'disabled' : ''}>${esc(t('type.go'))}</button></form>
    </section>`;
  }

  function steps() {
    return `<ol class="steps">${[1, 2, 3].map((n) => `<li><span class="step-n">${n}</span><span><b>${esc(x('step' + n))}</b><span>${esc(x('step' + n + 'd'))}</span></span></li>`).join('')}</ol>`;
  }

  function review() {
    const d = S.draft;
    const byId = new Map(S.ledger.parties.map((p) => [p.id, p]));
    const choiceCount = d.entries.filter((e) => e.choices && e.choices.length).length;
    const unresolved = choiceCount > 0;
    const cards = d.entries
      .map((e, i) => {
        const doubt = [e.choiceQuestion, e.unclear].filter(Boolean).join(' ');
        const open = S.editing.has(e.key) || (!!e.unclear && !e.choices);
        const linked = e.partyId ? byId.get(e.partyId) : null;
        const opts = ['supplier_due', 'supplier_paid', 'credit_given', 'credit_received', 'reorder', 'pending_order'].map((k) => `<option value="${k}" ${k === e.type ? 'selected' : ''}>${esc(t('types.' + k))}</option>`).join('');
        return `<div class="card entry ${doubt ? 'has-doubt' : ''}" data-i="${i}">
          <div class="entry-head">${badge(TYPE_ICON[e.type])}<span class="entry-type">${esc(t('types.' + e.type))}</span>
            <div class="entry-tools">
              <button type="button" class="tool" data-act="edit" data-i="${i}" aria-expanded="${open}" aria-label="${esc(open ? t('review.doneEdit') : t('review.edit'))}" title="${esc(open ? t('review.doneEdit') : t('review.edit'))}">${open ? ICON.check : ICON.pencil}</button>
              <button type="button" class="tool" data-act="del" data-i="${i}" aria-label="${esc(t('review.removeLabel'))}" title="${esc(t('review.remove'))}">${ICON.trash}</button></div></div>
          ${
            open
              ? `<div class="grid">
            <label>${esc(t('review.fields.type'))}<select data-f="type" data-i="${i}">${opts}</select></label>
            <label>${esc(t('review.fields.party'))}<input data-f="party" data-i="${i}" value="${esc(e.party)}" placeholder="${esc(t('review.fields.who'))}" autocomplete="off"></label>
            <label>${esc(t('review.fields.amount'))}<input data-f="amount" data-i="${i}" inputmode="numeric" value="${e.amount ?? ''}" placeholder="-"></label>
            <label>${esc(t('review.fields.due'))}<input data-f="due" data-i="${i}" type="date" value="${e.due || ''}"></label>
            <label class="full">${esc(t('review.fields.item'))}<input data-f="item" data-i="${i}" value="${esc(e.item)}" placeholder="-" autocomplete="off"></label></div>`
              : `<div class="summary"><div class="row"><b class="sum-name">${esc(e.party || e.item || '?')}</b>${e.amount != null ? `<span class="amt">${rs(e.amount)}</span>` : ''}</div>
            ${e.party && e.item ? `<div class="sum-item">${esc(e.item)}</div>` : ''}${e.due ? `<span class="tag ${e.due < today() ? 'late' : ''}">${ICON.today}${esc(fmtDate(e.due))}</span>` : ''}</div>`
          }
          ${linked && !e.choices ? `<div class="linked">${ICON.check}${esc(t('review.linked', { name: linked.name }))}</div>` : ''}
          ${
            doubt
              ? `<div class="doubt">${ICON.help}<div><p>${esc(doubt)}</p>${
                  e.choices
                    ? `<div class="acts">${e.choices.map((c) => `<button type="button" class="choice" data-act="pick" data-i="${i}" data-pid="${esc(c.partyId)}">${ICON.person}${esc(c.name)}</button>`).join('')}<button type="button" class="choice" data-act="pick" data-i="${i}" data-pid="${D.NEW_PARTY}">+ ${esc(t('review.newPerson'))}</button></div>`
                    : ''
                }</div></div>`
              : ''
          }
          ${e.quote ? `<div class="quote">“${esc(e.quote)}”</div>` : ''}</div>`;
      })
      .join('');
    const summary = d.entries.length ? `${x('found').replace('{{n}}', d.entries.length)}${unresolved ? ' · ' + x('needChoice').replace('{{n}}', choiceCount) : ''}` : '';
    return `<section class="review" aria-labelledby="h-review">
      <div class="review-head"><h2 id="h-review">${esc(t('review.title'))}</h2>${summary ? `<p class="review-count ${unresolved ? 'warn' : ''}">${esc(summary)}</p>` : ''}</div>
      <div class="note-card">${badge('mic')}<div><div class="note-meta"><span>${esc(t('review.noteText'))}</span><span>${esc(t('review.by.' + d.by))}</span></div><div>${esc(d.text)}</div></div></div>
      ${d.offline && S.caps.sample ? `<div class="dlg"><p>${esc(t('review.reonlineHint'))}</p><div class="acts"><button type="button" class="small sel" data-act="reonline" ${S.busy ? 'disabled' : ''}>${esc(t('review.reonline'))}</button></div></div>` : ''}
      ${d.entries.length ? cards : `<p class="empty">${esc(t('review.none'))}</p>`}
      <div class="savebar"><div class="wrap">
        <button type="button" class="ghost-btn" data-act="discard">${esc(t('review.discard'))}</button>
        <button type="button" class="save" data-act="save" ${S.busy || unresolved || !d.entries.length ? 'disabled' : ''}>${ICON.check}${esc(unresolved ? x('chooseShort') : t('review.save'))}</button>
      </div></div></section>`;
  }

  function row(icon, tone, title, meta, right) {
    return `<div class="card line">${badge(icon, tone)}<div class="line-main"><b>${title}</b>${meta ? `<div class="line-meta">${meta}</div>` : ''}</div>${right ? `<div class="line-right">${right}</div>` : ''}</div>`;
  }

  function home() {
    const k = D.ledger.kalKaKaam(S.ledger.entries, S.ledger.parties, today());
    const nothing = !k.pay.length && !k.reorder.length && !k.orders.length;
    let h = '';
    if (!S.ledger.entries.length) h += `<section aria-label="${esc(x('step1'))}">${steps()}</section>`;
    h += `<section aria-labelledby="h-kal"><h2 id="h-kal">${ICON.today}${esc(t('home.kal'))}</h2>`;
    if (nothing) h += `<p class="empty">${esc(x('kalEmpty'))}</p>`;
    h += k.pay.map((b) => row('truck', b.due && b.due < today() ? 'late' : '', esc(t('home.payTo', { name: b.name })), `<span class="tag ${b.due && b.due < today() ? 'late' : ''}">${esc(fmtDate(b.due))}</span>`, `<span class="amt">${rs(b.bal)}</span>`)).join('');
    if (k.reorder.length) h += row('cart', '', esc(t('home.reorder', { count: k.reorder.length })), esc(k.reorder.map((i) => i.item).join(', ')), '');
    h += k.orders.map((o) => row('bag', '', `${esc(t('home.orderOf', { name: o.name || '?' }))}`, `${o.item ? esc(o.item) + ' · ' : ''}${o.due ? esc(fmtDate(o.due)) : esc(t('home.noDate'))}`, '')).join('');
    h += `</section>`;
    const notes = [...S.ledger.notes].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 8);
    if (notes.length) {
      h += `<section aria-labelledby="h-notes"><h2 id="h-notes">${ICON.note}${esc(t('home.notes'))}</h2>`;
      h += notes
        .map((n) => {
          const isOpen = S.openNote === n.id;
          const list = isOpen ? S.ledger.entries.filter((e) => e.noteId === n.id) : [];
          return `<div class="card"><button type="button" class="linkish" data-act="note" data-id="${esc(n.id)}" aria-expanded="${isOpen}">
            <span class="note-meta"><span>${esc(new Date(n.createdAt).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' }))}</span><span>${esc(t('home.entries', { count: n.entryIds.length }))}</span></span>
            <span class="note-text">${esc(n.text)}</span></button>
            ${isOpen ? `<ul class="mini">${list.map((e) => `<li>${badge(TYPE_ICON[e.type], 'xs')} ${esc(e.party || '')} ${esc(e.item || '')} ${e.amount != null ? rs(e.amount) : ''}${e.status === 'done' ? ' ✓' : ''}</li>`).join('')}</ul>` : ''}</div>`;
        })
        .join('');
      h += '</section>';
    }
    return h;
  }

  function khata() {
    const ent = S.ledger.entries;
    const ps = S.ledger.parties;
    const sups = D.ledger.supplierDues(ent, ps);
    const cus = D.ledger.customerCredit(ent, ps);
    const reo = D.ledger.openReorders(ent, ps);
    const ord = D.ledger.openOrders(ent, ps);
    const counts = { sup: sups.length, cus: cus.length, maal: reo.length, ord: ord.length };
    const icons = { sup: 'truck', cus: 'person', maal: 'cart', ord: 'bag' };
    const tabs = ['sup', 'cus', 'maal', 'ord'].map((s) => `<button type="button" aria-pressed="${S.sub === s}" data-act="sub" data-sub="${s}">${ICON[icons[s]]}<span>${esc(t('khata.tabs.' + s))}</span>${counts[s] ? `<span class="count">${counts[s]}</span>` : ''}</button>`).join('');
    const nameBtn = (b) => (b.partyId ? `<button type="button" class="linkish name" data-act="hist" data-key="${esc(b.key)}" aria-expanded="${S.hist === b.key}">${esc(b.name)}</button>` : esc(b.name));
    const hist = (b) =>
      S.hist === b.key && b.partyId
        ? `<div class="history"><div class="note-s">${esc(t('khata.history', { name: b.name }))}</div><ul class="mini">${D.ledger
            .partyHistory(ent, b.partyId)
            .map((e) => `<li>${badge(TYPE_ICON[e.type], 'xs')} <span class="note-s">${esc(new Date(e.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }))}</span> ${e.amount != null ? rs(e.amount) : ''} ${esc(e.item || '')}</li>`)
            .join('')}</ul></div>`
        : '';
    const act = (name, key, label, icon) => `<button type="button" class="act-btn" data-act="${name}" ${key}>${ICON[icon]}${esc(label)}</button>`;
    let body = '';
    if (S.sub === 'sup')
      body = sups.length
        ? sups.map((b) => row('truck', b.due && b.due < today() ? 'late' : '', nameBtn(b), b.due ? `<span class="tag ${b.due < today() ? 'late' : ''}">${esc(fmtDate(b.due))}</span>` : '', `<span class="amt">${rs(b.bal)}</span>${act('paid', `data-key="${esc(b.key)}"`, t('khata.paid'), 'check')}`) + hist(b)).join('')
        : `<p class="empty">${esc(t('khata.noSup'))}</p>`;
    else if (S.sub === 'cus')
      body = cus.length
        ? cus.map((b) => row('person', '', nameBtn(b), '', `<span class="amt">${rs(b.bal)}</span>${act('settle', `data-key="${esc(b.key)}"`, t('khata.settle'), 'moneyIn')}`) + hist(b)).join('')
        : `<p class="empty">${esc(t('khata.noCus'))}</p>`;
    else if (S.sub === 'maal') {
      const g = D.ledger.groupBySupplier(reo);
      body = g.length
        ? g.map((grp) => `<div class="group"><h3>${ICON.truck}${esc(grp.supplier || t('khata.noSupplier'))}</h3>${grp.items.map((i) => row('cart', '', esc(i.item), '', act('done', `data-ids="${esc(i.ids.join(','))}"`, t('khata.gotIt'), 'check'))).join('')}</div>`).join('')
        : `<p class="empty">${esc(t('khata.noMaal'))}</p>`;
    } else
      body = ord.length
        ? ord.map((e) => row('bag', '', esc(e.name || '?'), `${e.item ? esc(e.item) : ''}${e.amount ? ' · ' + rs(e.amount) : ''}${e.due ? ` <span class="tag ${e.due < today() ? 'late' : ''}">${esc(fmtDate(e.due))}</span>` : ''}`, act('done', `data-ids="${esc(e.id)}"`, t('khata.done'), 'check'))).join('')
        : `<p class="empty">${esc(t('khata.noOrd'))}</p>`;
    return `<section aria-labelledby="h-khata"><h2 id="h-khata">${ICON.book}${esc(t('khata.title'))}</h2><div class="subtabs" role="group" aria-label="${esc(t('khata.groupLabel'))}">${tabs}</div><div class="list">${body}</div></section>`;
  }

  function ask() {
    const v = S.voiceFor === 'ask' ? S.voice : 'idle';
    const ex = ['ex1', 'ex2', 'ex3', 'ex4'].map((k) => `<button type="button" class="phrase" data-act="askEx" data-q="${esc(t('ask.' + k))}">${ICON.ask}${esc(t('ask.' + k))}</button>`).join('');
    return `<section aria-labelledby="h-ask"><h2 id="h-ask">${ICON.ask}${esc(t('ask.title'))}</h2><p class="note-s">${esc(t('ask.hint'))}</p>
      <div class="ask-card"><div class="ask-mic">${micButton('ask', true)}<span class="ask-state" aria-live="polite">${esc(v === 'listening' ? S.partial || t('mic.listening') : v === 'thinking' ? t('mic.thinking') : t('ask.micLabel'))}</span></div>
      <form class="ask-form" id="askForm"><input id="q" value="${esc(S.question)}" placeholder="${esc(t('ask.placeholder'))}" aria-label="${esc(t('ask.placeholder'))}" enterkeyhint="search"><button type="submit" class="small sel" ${S.askBusy ? 'disabled' : ''}>${esc(t('ask.go'))}</button></form></div>
      <div aria-live="polite">${S.askBusy ? `<p class="empty">${esc(t('ask.thinking'))}</p>` : ''}${
        S.answer && !S.askBusy ? `<div class="ans"><div class="ans-text">${esc(S.answer)}</div>${S.caps.tts ? `<button type="button" class="small" data-act="speak">${ICON.speaker} ${esc(t('ask.speak'))}</button>` : ''}</div>` : ''
      }</div>
      <div class="examples"><p class="say-label">${esc(t('ask.examples'))}</p><div class="phrases">${ex}</div></div></section>`;
  }

  function settings() {
    const hasDemo = S.ledger.entries.some((e) => e.demo);
    return `<div class="settings" role="dialog" aria-modal="true" aria-labelledby="h-settings"><div class="wrap">
      <div class="row settings-top"><h2 id="h-settings">${esc(t('settings.title'))}</h2><button type="button" class="icon-btn" data-act="closeSettings" aria-label="${esc(t('settings.close'))}">${ICON.close}</button></div>
      <div class="card"><label class="field" for="langSel">${esc(t('settings.lang'))}<select id="langSel">${LANGS.map((l) => `<option value="${l}" ${l === S.lang ? 'selected' : ''}>${esc(LANG_NAMES[l])}</option>`).join('')}</select></label></div>
      <h3>${esc(t('settings.demo'))}</h3>
      <div class="card acts"><button type="button" class="small" data-act="example">${ICON.play}${esc(t('settings.demoLoad'))}</button>${hasDemo ? `<button type="button" class="small" data-act="clearDemo">${ICON.trash}${esc(t('settings.demoClear'))}</button>` : ''}</div>
      <div class="card"><p><b>${esc(S.store === 'claude' ? x('privacy') : x('privacyLocal'))}</b></p>
      ${
        !S.wipeAsk
          ? `<div class="acts"><button type="button" class="small" data-act="wipe">${ICON.trash}${esc(t('settings.wipe'))}</button></div>`
          : `<div class="dlg" role="alert">${esc(t('settings.wipeConfirm'))}<div class="acts"><button type="button" class="danger" data-act="wipeYes">${esc(t('settings.wipeYes'))}</button><button type="button" class="small" data-act="wipeNo">${esc(t('settings.wipeNo'))}</button></div></div>`
      }</div>
      <p class="note-s center">${esc(t('settings.about'))}</p></div></div>`;
  }

  function onboard() {
    const E0 = EXTRA.hi;
    return `<main class="onboard"><div class="wrap">
      <p class="brand"><span class="brand-mark">${ICON.note}</span>Dukaan Yaad</p>
      <h1>${esc(E0.introTitle)}</h1><p class="onboard-sub">${esc(E0.introSub)}</p>
      <ol class="steps">${[1, 2, 3].map((n) => `<li><span class="step-n">${n}</span><span><b>${esc(E0['step' + n])}</b><span>${esc(E0['step' + n + 'd'])}</span></span></li>`).join('')}</ol>
      <h2>Apni bhasha chuno / Choose your language</h2>
      <div class="lang-grid">${LANGS.map((l) => `<button type="button" class="lang-btn" data-act="lang" data-lang="${l}"><span>${esc(LANG_NAMES[l])}</span>${svg('M10 6 8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z')}</button>`).join('')}</div></div></main>`;
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
    el.innerHTML = `<span>${ICON.check}${esc(S.toast.text)}</span>${S.toast.undo ? `<button type="button" class="small" data-act="undo">${esc(t('toast.undo'))} (${S.toast.left})</button>` : ''}`;
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
    const status = S.status ? `<div class="status" role="status">${ICON.help}<span>${esc(S.status)}</span></div>` : '';
    let main = '';
    if (S.tab === 'home') main = talk() + status + (S.draft ? review() : home());
    else main = status + (S.tab === 'khata' ? khata() : ask());
    const navIcon = { home: 'today', khata: 'book', ask: 'ask' };
    document.body.classList.toggle('reviewing', S.tab === 'home' && !!S.draft);
    root.innerHTML = `${header()}<main class="page" id="main"><div class="wrap">${main}</div></main>
      <nav aria-label="Main"><div class="wrap">${['home', 'khata', 'ask'].map((k) => `<button type="button" data-act="tab" data-tab="${k}" ${S.tab === k ? 'aria-current="page"' : ''}>${ICON[navIcon[k]]}<span>${esc(t('nav.' + k))}</span></button>`).join('')}</div></nav>
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
      case 'phrase': {
        // fill the typing box with the sample so the owner sees exactly what to say (and can send it)
        S.typing = true;
        render();
        const ta = $('#typed');
        if (ta) {
          ta.value = b.dataset.text;
          ta.focus();
        }
        return;
      }
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
