// The menu at the top left: a drawer with every feature of the site. Esc, a click outside and the close button close
// it, and the focus goes back to the button. The slide lives in utn.css: data-fuera is the drawer out of view, and
// data-saliendo makes the way out faster. Without motion, utn.css leaves only the fade.
(() => {
  const boton = document.getElementById('menuAbrir');
  const dlg = document.getElementById('menu');
  if (!boton || !dlg || typeof dlg.showModal !== 'function') return;
  const panel = dlg.querySelector('.mn-panel');
  let espera = 0;

  const sinTransicion = () => getComputedStyle(panel).transitionDuration.split(',').every((d) => parseFloat(d) === 0);

  const abrir = () => {
    if (dlg.open) return;
    clearTimeout(espera);
    delete dlg.dataset.saliendo;
    dlg.dataset.fuera = '';
    dlg.showModal();
    // The drawer starts out of view, so the slide has somewhere to come from.
    void panel.offsetWidth;
    delete dlg.dataset.fuera;
    boton.setAttribute('aria-expanded', 'true');
  };

  const cerrar = () => {
    if (!dlg.open || 'saliendo' in dlg.dataset) return;
    const listo = () => {
      clearTimeout(espera);
      panel.removeEventListener('transitionend', alTerminar);
      if (dlg.open) dlg.close();
    };
    const alTerminar = (e) => {
      if (e.target === panel) listo();
    };
    dlg.dataset.saliendo = '';
    dlg.dataset.fuera = '';
    if (sinTransicion()) {
      listo();
      return;
    }
    panel.addEventListener('transitionend', alTerminar);
    espera = setTimeout(listo, 400);
  };

  boton.addEventListener('click', abrir);
  dlg.addEventListener('cancel', (e) => {
    // Esc: the drawer goes out the same way. If the browser does not let us wait, it closes at once.
    if (!e.cancelable) return;
    e.preventDefault();
    cerrar();
  });
  dlg.addEventListener('click', (e) => {
    if (!panel.contains(e.target) || e.target.closest('[data-menu-cerrar]')) cerrar();
  });
  dlg.addEventListener('close', () => {
    clearTimeout(espera);
    delete dlg.dataset.saliendo;
    delete dlg.dataset.fuera;
    boton.setAttribute('aria-expanded', 'false');
    boton.focus();
  });
  // Coming back with the browser's back button should not find the menu still open.
  window.addEventListener('pagehide', () => {
    if (dlg.open) dlg.close();
  });
})();
