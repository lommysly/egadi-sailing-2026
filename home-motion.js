(() => {
  const video = document.querySelector('.home-hero-video');
  if (!video) return;

  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const saveData = navigator.connection?.saveData === true;

  const syncVideo = () => {
    if (reducedMotion.matches || saveData) {
      video.pause();
      return;
    }

    video.play().catch(() => {
      // Il poster rimane visibile se il browser blocca la riproduzione automatica.
    });
  };

  reducedMotion.addEventListener?.('change', syncVideo);
  video.addEventListener('canplay', syncVideo, { once: true });
  syncVideo();
})();
