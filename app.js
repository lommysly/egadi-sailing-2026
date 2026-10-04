(() => {
  // Il browser ripristina da solo la posizione dell'ultima visita. Siccome
  // l'ultima sezione della home è la promo dell'app, riaprendo il sito o
  // tornando indietro ci si ritrovava dentro, senza capire dove si era
  // finiti (segnalato da Silvio, 2/10/2026: "si perde orientamento").
  // Ogni pagina riparte dall'alto; se l'indirizzo contiene un'ancora
  // esplicita quella continua a comandare, perché lì il punto preciso è
  // stato chiesto (es. i pannelli dell'area skipper).
  if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
  if (!window.location.hash) window.scrollTo(0, 0);

  // Stesso problema, un livello più giù: dentro le aree riservate aprire una
  // casella cambia il contenuto della pagina ma non la sposta. Si resta dove
  // si era — di solito in basso, sopra le caselle appena toccate — davanti a
  // un contenuto che nel frattempo è un altro, e bisogna risalire a mano per
  // capire dove si è finiti (segnalato da Silvio, 4/10/2026: "ogni volta che
  // si entra in un container ti manda in fondo alla pagina").
  //
  // Vive qui perché riguarda tutte le aree e perché questo file possiede già
  // l'orientamento della pagina: una sola regola, invece di una per area.
  // Lo spostamento è immediato, non animato: aprire una sezione deve
  // sembrare aprire una pagina, non scorrere fino a un punto.
  window.EgadiOrientation = {
    showTopOf(element) {
      if (!element) return;
      const header = document.querySelector('.site-header');
      const headerHeight = header ? header.getBoundingClientRect().height : 0;
      const top = element.getBoundingClientRect().top + window.scrollY - headerHeight - 14;
      window.scrollTo({ top: Math.max(0, top), behavior: 'auto' });
    },
  };

  let hasStarted = false;

  const start = () => {
    if (hasStarted) return;
    hasStarted = true;

    const i18n = window.EgadiI18n;
    const header = document.querySelector('.site-header');
    const menuButton = header?.querySelector('.menu-toggle');
    const menu = header?.querySelector('.site-nav');
    const backdrop = document.querySelector('.menu-backdrop');

    if (!header || !menuButton || !menu || !backdrop) return;

    const t = (key, fallback) => i18n?.t(key) || fallback;
    const menuLabel = menuButton.querySelector('.menu-toggle-label');
    const mobileViewport = window.matchMedia('(max-width: 800px)');
    const isHomePage = /(?:^|\/)index\.html$/.test(window.location.pathname) || window.location.pathname === '/';
    const navigationKeys = {
      'index.html': 'nav.journey',
      'flotta.html': 'nav.fleet',
      'passage-plan.html': 'nav.passagePlan',
      'arrivi-partenze.html': 'nav.arrivalsDepartures',
      'film.html': 'nav.film',
      'accesso.html': 'nav.privateArea',
      'privacy.html': 'nav.privacy',
    };

    const setI18nAttribute = (element, name, key) => {
      if (!element || element.dataset[name]) return;
      element.dataset[name] = key;
    };

    const prepareNavigation = () => {
      setI18nAttribute(menuButton, 'i18nAriaLabel', 'common.openMenu');
      setI18nAttribute(menuLabel, 'i18n', 'common.menu');
      setI18nAttribute(menu, 'i18nAriaLabel', 'common.mainNavigation');
      setI18nAttribute(backdrop, 'i18nAriaLabel', 'common.closeMenu');
      setI18nAttribute(header.querySelector('.brand'), 'i18nAriaLabel', 'common.homeAria');

      menu.querySelectorAll('a[href]').forEach((anchor) => {
        try {
          const fileName = new URL(anchor.href, window.location.href).pathname.split('/').pop() || 'index.html';
          const key = navigationKeys[fileName];
          if (key) setI18nAttribute(anchor, 'i18n', key);
        } catch {
          // Un eventuale link non standard resta invariato.
        }
      });
    };

    const preserveNavigationLocale = () => {
      if (!i18n) return;
      document.querySelectorAll('a[href]').forEach((anchor) => {
        const href = anchor.getAttribute('href');
        if (href) anchor.href = i18n.preserveLocaleUrl(href);
      });
    };

    const createLanguageSwitcher = () => {
      if (!i18n || header.querySelector('.language-switcher')) return null;

      const switcher = document.createElement('div');
      switcher.className = 'language-switcher';
      switcher.setAttribute('role', 'group');

      ['it', 'en'].forEach((locale) => {
        const button = document.createElement('button');
        button.className = 'language-switcher-button';
        button.type = 'button';
        button.dataset.locale = locale;
        button.textContent = locale.toUpperCase();
        button.addEventListener('click', () => i18n.setLocale(locale));
        switcher.append(button);
      });

      header.insertBefore(switcher, menuButton);
      return switcher;
    };

    const languageSwitcher = createLanguageSwitcher();
    const updateLanguageSwitcher = () => {
      if (!languageSwitcher || !i18n) return;
      const locale = i18n.getLocale();
      languageSwitcher.setAttribute('aria-label', t('common.language', 'Lingua'));
      languageSwitcher.querySelectorAll('.language-switcher-button').forEach((button) => {
        const isActive = button.dataset.locale === locale;
        const labelKey = button.dataset.locale === 'en' ? 'common.languageEnglish' : 'common.languageItalian';
        button.setAttribute('aria-pressed', String(isActive));
        button.setAttribute('aria-label', t(labelKey, button.dataset.locale.toUpperCase()));
        button.title = t(labelKey, button.dataset.locale.toUpperCase());
      });
    };

    prepareNavigation();

    let backButton;
    if (!isHomePage) {
      backButton = document.createElement('button');
      backButton.className = 'menu-back';
      backButton.type = 'button';
      backButton.innerHTML = '<span aria-hidden="true">←</span><span class="menu-back-label"></span>';
      setI18nAttribute(backButton.querySelector('.menu-back-label'), 'i18n', 'common.back');
      setI18nAttribute(backButton, 'i18nAriaLabel', 'common.backAria');
      menu.prepend(backButton);

      backButton.addEventListener('click', () => {
        const cameFromThisSite = (() => {
          try {
            return new URL(document.referrer).origin === window.location.origin;
          } catch {
            return false;
          }
        })();

        if (cameFromThisSite && window.history.length > 1) {
          window.history.back();
        } else {
          window.location.assign(i18n?.preserveLocaleUrl('index.html') || 'index.html');
        }
      });
    }

    const updateMenu = (isOpen, { restoreFocus = false, moveFocus = false } = {}) => {
      const isMobile = mobileViewport.matches;
      const shouldOpen = isMobile && isOpen;

      menu.classList.toggle('open', shouldOpen);
      menu.toggleAttribute('inert', isMobile && !shouldOpen);
      menu.toggleAttribute('aria-hidden', isMobile && !shouldOpen);
      menuButton.setAttribute('aria-expanded', String(shouldOpen));
      menuButton.setAttribute('aria-label', shouldOpen ? t('common.closeMenu', 'Chiudi menu') : t('common.openMenu', 'Apri menu'));
      if (menuLabel) menuLabel.textContent = shouldOpen ? t('common.close', 'Chiudi') : t('common.menu', 'Menu');
      backdrop.hidden = !shouldOpen;
      document.body.classList.toggle('menu-open', shouldOpen);

      if (shouldOpen && moveFocus) {
        window.requestAnimationFrame(() => menu.querySelector('a')?.focus());
      }
      if (!shouldOpen && restoreFocus && isMobile) menuButton.focus();
    };

    const localizeNavigation = () => {
      i18n?.localizeDocument();
      preserveNavigationLocale();
      updateLanguageSwitcher();
      const menuIsOpen = menuButton.getAttribute('aria-expanded') === 'true';
      updateMenu(menuIsOpen);
    };

    menuButton.addEventListener('click', () => {
      updateMenu(menuButton.getAttribute('aria-expanded') !== 'true', { moveFocus: true });
    });

    backdrop.addEventListener('click', () => updateMenu(false, { restoreFocus: true }));

    menu.addEventListener('click', (event) => {
      if (event.target.closest('a')) updateMenu(false);
    });

    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && menuButton.getAttribute('aria-expanded') === 'true') {
        updateMenu(false, { restoreFocus: true });
      }
    });

    const syncViewport = () => updateMenu(false);
    if (mobileViewport.addEventListener) {
      mobileViewport.addEventListener('change', syncViewport);
    } else {
      mobileViewport.addListener(syncViewport);
    }

    window.addEventListener('egadi:localechange', localizeNavigation);
    localizeNavigation();
  };

  if (window.EgadiI18n) {
    start();
    return;
  }

  const existingCore = document.querySelector('script[data-egadi-i18n-core]');
  if (existingCore) {
    existingCore.addEventListener('load', start, { once: true });
    existingCore.addEventListener('error', start, { once: true });
    return;
  }

  const currentScript = document.currentScript;
  const coreScript = document.createElement('script');
  coreScript.src = new URL('i18n.js?v=20260914-en2', currentScript?.src || window.location.href).href;
  coreScript.dataset.egadiI18nCore = 'true';
  coreScript.async = false;
  coreScript.addEventListener('load', start, { once: true });
  coreScript.addEventListener('error', start, { once: true });
  document.head.append(coreScript);
})();
