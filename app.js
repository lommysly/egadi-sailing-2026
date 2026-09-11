(() => {
  const header = document.querySelector('.site-header');
  const menuButton = header?.querySelector('.menu-toggle');
  const menu = header?.querySelector('.site-nav');
  const backdrop = document.querySelector('.menu-backdrop');

  if (!header || !menuButton || !menu || !backdrop) return;

  const menuLabel = menuButton.querySelector('.menu-toggle-label');
  const mobileViewport = window.matchMedia('(max-width: 800px)');
  const isHomePage = /(?:^|\/)index\.html$/.test(window.location.pathname) || window.location.pathname === '/';

  if (!isHomePage) {
    const backButton = document.createElement('button');
    backButton.className = 'menu-back';
    backButton.type = 'button';
    backButton.innerHTML = '<span aria-hidden="true">←</span> Indietro';
    backButton.setAttribute('aria-label', 'Torna alla pagina precedente');
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
        window.location.assign('index.html');
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
    menuButton.setAttribute('aria-label', shouldOpen ? 'Chiudi menu' : 'Apri menu');
    if (menuLabel) menuLabel.textContent = shouldOpen ? 'Chiudi' : 'Menu';
    backdrop.hidden = !shouldOpen;
    document.body.classList.toggle('menu-open', shouldOpen);

    if (shouldOpen && moveFocus) {
      window.requestAnimationFrame(() => menu.querySelector('a')?.focus());
    }
    if (!shouldOpen && restoreFocus && isMobile) menuButton.focus();
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

  updateMenu(false);
})();
