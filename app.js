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
})();
