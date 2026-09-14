(() => {
  'use strict';

  /*
   * Dizionario editoriale condiviso. Chiavi attualmente disponibili:
   * - common.menu, common.close, common.openMenu, common.closeMenu
   * - common.back, common.backAria, common.mainNavigation, common.language
   * - common.languageItalian, common.languageEnglish, common.homeAria
   * - nav.journey, nav.fleet, nav.passagePlan, nav.arrivalsDepartures,
   *   nav.film, nav.privateArea, nav.privacy
   *
   * Le pagine possono aggiungere dizionari editoriali con
   * EgadiI18n.registerTranslations({ it: {...}, en: {...} }).
   * Il motore traduce soltanto nodi marcati esplicitamente con data-i18n
   * (o una delle varianti di attributo). Non esegue traduzioni automatiche
   * di testo libero, dati personali, contenuti skipper o dati Firestore.
   * Il testo italiano originale di ciascun nodo viene conservato nel browser:
   * questo permette di tornare a IT anche quando una chiave editoriale EN non
   * esiste ancora, senza mai mostrare la chiave tecnica all'utente.
   */
  const messages = {
    it: {
      common: {
        menu: 'Menu',
        close: 'Chiudi',
        openMenu: 'Apri menu',
        closeMenu: 'Chiudi menu',
        back: 'Indietro',
        backAria: 'Torna alla pagina precedente',
        mainNavigation: 'Navigazione principale',
        language: 'Lingua',
        languageItalian: 'Italiano',
        languageEnglish: 'Inglese',
        homeAria: 'Egadi Sailing Experience, home',
      },
      nav: {
        journey: 'Il viaggio',
        fleet: 'Flottiglia',
        passagePlan: 'Passage Plan',
        arrivalsDepartures: 'Arrivi e partenze',
        film: 'Il film',
        privateArea: 'Area riservata',
        privacy: 'Privacy e dati',
      },
    },
    en: {
      common: {
        menu: 'Menu',
        close: 'Close',
        openMenu: 'Open menu',
        closeMenu: 'Close menu',
        back: 'Back',
        backAria: 'Go back to the previous page',
        mainNavigation: 'Main navigation',
        language: 'Language',
        languageItalian: 'Italian',
        languageEnglish: 'English',
        homeAria: 'Egadi Sailing Experience, home',
      },
      nav: {
        journey: 'The journey',
        fleet: 'Flotilla',
        passagePlan: 'Passage Plan',
        arrivalsDepartures: 'Arrivals & departures',
        film: 'The film',
        privateArea: 'Private area',
        privacy: 'Privacy & data',
      },
    },
  };

  const supportedLocales = new Set(Object.keys(messages));
  const storageKey = 'egadi.locale';
  const defaultLocale = 'it';
  const originalLocalizedValues = new WeakMap();
  let activeLocale;

  const normalizeLocale = (value) => {
    const candidate = String(value || '').trim().toLowerCase().split('-')[0];
    return supportedLocales.has(candidate) ? candidate : null;
  };

  const readStoredLocale = () => {
    try {
      return normalizeLocale(window.localStorage.getItem(storageKey));
    } catch {
      return null;
    }
  };

  const readUrlLocale = () => {
    try {
      return normalizeLocale(new URL(window.location.href).searchParams.get('lang'));
    } catch {
      return null;
    }
  };

  const resolveMessage = (locale, key) => {
    return String(key || '')
      .split('.')
      .reduce((value, segment) => (value && typeof value === 'object' ? value[segment] : undefined), messages[locale]);
  };

  const isPlainObject = (value) => {
    return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
  };

  const mergeMessages = (target, source) => {
    Object.entries(source).forEach(([key, value]) => {
      if (isPlainObject(value) && isPlainObject(target[key])) {
        mergeMessages(target[key], value);
      } else if (isPlainObject(value)) {
        target[key] = {};
        mergeMessages(target[key], value);
      } else if (typeof value === 'string') {
        target[key] = value;
      }
    });
  };

  const interpolate = (value, params) => {
    if (!params || typeof params !== 'object') return value;
    return value.replace(/\{([^}]+)\}/g, (match, name) => {
      return Object.prototype.hasOwnProperty.call(params, name) ? String(params[name]) : match;
    });
  };

  const getLocale = () => activeLocale || defaultLocale;

  const t = (key, params) => {
    const value = resolveMessage(getLocale(), key) ?? resolveMessage(defaultLocale, key);
    return typeof value === 'string' ? interpolate(value, params) : undefined;
  };

  const updateDocumentLanguage = () => {
    const documentElement = document.documentElement;
    if (!documentElement) return;
    documentElement.lang = getLocale();
    documentElement.dataset.locale = getLocale();
  };

  const collectLocalizedElements = (root, selector) => {
    if (!root) return [];
    const elements = [];
    if (root.nodeType === Node.ELEMENT_NODE && root.matches(selector)) elements.push(root);
    if (typeof root.querySelectorAll === 'function') elements.push(...root.querySelectorAll(selector));
    return elements;
  };

  const originalValueFor = (element, target) => {
    let values = originalLocalizedValues.get(element);
    if (!values) {
      values = {};
      originalLocalizedValues.set(element, values);
    }

    if (!Object.prototype.hasOwnProperty.call(values, target)) {
      values[target] = target === 'textContent' || target === 'innerHTML'
        ? element[target]
        : element.getAttribute(target);
    }

    return values[target];
  };

  const setLocalizedValue = (element, target, key) => {
    if (!key) return;

    // `lang` is the one attribute whose value is owned by the locale engine
    // itself. Some pages carry a declarative marker for auditability, but it
    // must not restore a previously cached language after `setLocale()`.
    if (element === document.documentElement && target === 'lang') return;

    const original = originalValueFor(element, target);
    const translated = getLocale() === defaultLocale ? undefined : resolveMessage(getLocale(), key);
    const value = typeof translated === 'string' ? translated : original;

    if (target === 'textContent' || target === 'innerHTML') {
      element[target] = value ?? '';
    } else if (target === 'value') {
      element.value = value ?? '';
    } else if (value === null || value === undefined) {
      element.removeAttribute(target);
    } else {
      element.setAttribute(target, value);
    }
  };

  const localizeDocument = (root = document) => {
    updateDocumentLanguage();

    const textAttributes = [
      ['[data-i18n]', 'i18n', 'textContent'],
      ['[data-i18n-html]', 'i18nHtml', 'innerHTML'],
      ['[data-i18n-placeholder]', 'i18nPlaceholder', 'placeholder'],
      ['[data-i18n-aria-label]', 'i18nAriaLabel', 'aria-label'],
      ['[data-i18n-title]', 'i18nTitle', 'title'],
      ['[data-i18n-value]', 'i18nValue', 'value'],
    ];

    textAttributes.forEach(([selector, datasetKey, target]) => {
      collectLocalizedElements(root, selector).forEach((element) => {
        setLocalizedValue(element, target, element.dataset[datasetKey]);
      });
    });

    collectLocalizedElements(root, '[data-i18n-attr]').forEach((element) => {
      element.dataset.i18nAttr.split(';').forEach((definition) => {
        const separator = definition.indexOf(':');
        if (separator < 1) return;
        const target = definition.slice(0, separator).trim();
        const key = definition.slice(separator + 1).trim();
        if (!target || !key) return;
        setLocalizedValue(element, target, key);
      });
    });
  };

  const registerTranslations = (translations) => {
    if (!isPlainObject(translations)) return;

    Object.entries(translations).forEach(([locale, entries]) => {
      const normalizedLocale = normalizeLocale(locale);
      if (!normalizedLocale || !isPlainObject(entries)) return;
      mergeMessages(messages[normalizedLocale], entries);
    });

    localizeDocument();
    window.dispatchEvent(new CustomEvent('egadi:translationschange'));
  };

  const preserveLocaleUrl = (href, locale = getLocale()) => {
    if (typeof href !== 'string' || !href.trim() || /^(?:#|mailto:|tel:|javascript:|data:)/i.test(href.trim())) {
      return href;
    }

    try {
      const url = new URL(href, document.baseURI);
      if (url.origin !== window.location.origin) return href;
      url.searchParams.set('lang', normalizeLocale(locale) || defaultLocale);
      return url.href;
    } catch {
      return href;
    }
  };

  const setLocale = (locale, { reload = true } = {}) => {
    const nextLocale = normalizeLocale(locale) || defaultLocale;
    activeLocale = nextLocale;

    try {
      window.localStorage.setItem(storageKey, nextLocale);
    } catch {
      // L'interfaccia resta utilizzabile anche se il browser blocca lo storage.
    }

    localizeDocument();
    window.dispatchEvent(new CustomEvent('egadi:localechange', { detail: { locale: nextLocale } }));

    if (reload) {
      const destination = new URL(window.location.href);
      destination.searchParams.set('lang', nextLocale);
      window.location.assign(destination.href);
    }

    return nextLocale;
  };

  activeLocale = readUrlLocale() || readStoredLocale() || normalizeLocale(document.documentElement?.lang) || defaultLocale;
  updateDocumentLanguage();

  window.EgadiI18n = Object.freeze({
    getLocale,
    t,
    setLocale,
    preserveLocaleUrl,
    localizeDocument,
    registerTranslations,
  });
})();
