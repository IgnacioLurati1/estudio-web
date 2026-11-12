// The emergency protocol's on and off buttons. tema.js applies it and redirects before first paint.
(() => {
  const d = document.documentElement;
  const CLAVE = 'utn:emergencia';
  const escribir = (on) => {
    try {
      if (on) localStorage.setItem(CLAVE, '1');
      else localStorage.removeItem(CLAVE);
      return true;
    } catch {
      return false;
    }
  };
  const prender = (b) => {
    if (!escribir(true)) {
      const aviso = document.createElement('span');
      aviso.setAttribute('role', 'status');
      aviso.className = 'em-falla';
      aviso.textContent = 'Este navegador no deja guardar el protocolo.';
      b.after(aviso);
      return;
    }
    d.dataset.emergencia = '1';
    window.UTN_USO?.avisar('_', 'emergencia-prendida');
    // A button can say where to go next, like the menu's row: the map of subjects.
    if (b.dataset.emIr) location.href = b.dataset.emIr;
    else if (d.hasAttribute('data-em-fuera')) location.replace('emergencia.html');
    else document.querySelector('.em-banda')?.focus();
  };
  const apagar = (b) => {
    escribir(false);
    delete d.dataset.emergencia;
    if (d.hasAttribute('data-em-solo')) {
      location.replace('index.html');
      return;
    }
    // The focus goes to the button that turns it on again: the menu's own if it was turned off from the menu.
    const destino = b.closest('dialog')?.querySelector('[data-em-prender]') || [...document.querySelectorAll('[data-em-prender]')].find((x) => !x.closest('dialog')) || document.querySelector('main');
    if (destino.tagName === 'MAIN') destino.tabIndex = -1;
    destino.focus();
  };
  document.addEventListener('click', (e) => {
    const b = e.target.closest?.('[data-em-prender], [data-em-apagar]');
    if (!b) return;
    if (b.hasAttribute('data-em-prender')) prender(b);
    else apagar(b);
  });
})();
