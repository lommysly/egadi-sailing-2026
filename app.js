(() => {
  const menuButton = document.querySelector('.menu-toggle');
  const menu = document.querySelector('.site-nav');
  if (menuButton && menu) {
    menuButton.addEventListener('click', () => {
      const isOpen = menu.classList.toggle('open');
      menuButton.setAttribute('aria-expanded', String(isOpen));
      menuButton.textContent = isOpen ? 'Chiudi' : 'Menu';
    });
  }

  const dialog = document.querySelector('#setupDialog');
  const dialogTitle = document.querySelector('#dialogTitle');
  document.querySelectorAll('.setup-action').forEach((button) => {
    button.addEventListener('click', () => {
      if (dialogTitle) {
        dialogTitle.textContent = button.dataset.action === 'skipper'
          ? 'Accesso skipper'
          : 'Accesso Crew List';
      }
      dialog?.showModal();
    });
  });
  document.querySelector('.dialog-close')?.addEventListener('click', () => dialog?.close());
})();
