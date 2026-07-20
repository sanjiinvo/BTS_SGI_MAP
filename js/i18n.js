const I18n = (() => {
  let currentLang = 'ru';
  let translations = {};

  function getDefaultLang() {
    const supported = ['ru', 'kk', 'en', 'de', 'zh'];
    const stored = localStorage.getItem('app-lang');
    if (stored && supported.includes(stored)) return stored;
    const browser = (navigator.language || '').slice(0, 2);
    if (supported.includes(browser)) return browser;
    return 'ru';
  }

  async function init() {
    currentLang = getDefaultLang();
    await loadLang(currentLang);
  }

  async function loadLang(lang) {
    try {
      const res = await fetch(`data/i18n/${lang}.json`);
      translations = await res.json();
    } catch (e) {
      console.warn('Failed to load language:', lang, e);
      translations = {};
    }
  }

  function t(key, fallback) {
    const keys = key.split('.');
    let val = translations;
    for (const k of keys) {
      if (val && typeof val === 'object' && k in val) val = val[k];
      else return fallback || key;
    }
    return typeof val === 'string' ? val : fallback || key;
  }

  function tr(obj) {
    if (!obj) return '';
    if (typeof obj === 'string') return obj;
    return obj[currentLang] || obj.ru || obj.en || obj.kk || '';
  }

  async function setLang(lang) {
    if (lang === currentLang) return;
    await loadLang(lang);
    currentLang = lang;
    localStorage.setItem('app-lang', lang);
    document.documentElement.lang = lang;
    document.querySelectorAll('.lang-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.lang === lang);
    });
    document.dispatchEvent(new CustomEvent('language-changed', { detail: { lang } }));
  }

  function getLang() { return currentLang; }

  return { init, t, tr, setLang, getLang };
})();
