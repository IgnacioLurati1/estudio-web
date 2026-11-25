// Diagrams that do not fit the page: a tap opens them in full screen, fitted, with zoom.
(() => {
  const figuras = [...document.querySelectorAll('.hoja figure')].filter((f) => f.querySelector(':scope > svg') && !f.closest('[data-w]'));
  if (!figuras.length) return;

  const PASO = 1.4;
  const MAXIMO = 6;
  const raiz = document.documentElement;
  let dlg;
  let marco;
  let actual;
  let escala = 1;
  let serie = 0;

  const pintar = () => {
    if (!actual) return;
    const vb = actual.viewBox.baseVal;
    const ajuste = Math.min(marco.clientWidth / vb.width, marco.clientHeight / vb.height);
    actual.style.width = `${vb.width * ajuste * escala}px`;
    actual.style.height = `${vb.height * ajuste * escala}px`;
  };

  // Zooms around the middle of what is on screen, so the part being read stays in place.
  const acercar = (nueva) => {
    const cx = (marco.scrollLeft + marco.clientWidth / 2) / marco.scrollWidth;
    const cy = (marco.scrollTop + marco.clientHeight / 2) / marco.scrollHeight;
    escala = Math.min(MAXIMO, Math.max(1, nueva));
    pintar();
    marco.scrollLeft = cx * marco.scrollWidth - marco.clientWidth / 2;
    marco.scrollTop = cy * marco.scrollHeight - marco.clientHeight / 2;
  };

  const boton = (texto, accion) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'b-tema';
    b.textContent = texto;
    b.addEventListener('click', accion);
    return b;
  };

  const crear = () => {
    dlg = document.createElement('dialog');
    dlg.className = 'dlg-diagrama';
    dlg.setAttribute('aria-label', 'Dibujo en pantalla completa');
    const barra = document.createElement('div');
    barra.className = 'dlg-diagrama-barra';
    barra.append(
      boton('Alejar', () => acercar(escala / PASO)),
      boton('Acercar', () => acercar(escala * PASO)),
      boton('Ajustar', () => acercar(1)),
      boton('Cerrar', () => dlg.close()),
    );
    marco = document.createElement('div');
    marco.className = 'dlg-diagrama-marco';
    marco.tabIndex = 0;
    dlg.append(barra, marco);
    dlg.addEventListener('keydown', (e) => {
      if (e.key === '+' || e.key === '=') acercar(escala * PASO);
      else if (e.key === '-') acercar(escala / PASO);
      else if (e.key === '0') acercar(1);
    });
    dlg.addEventListener('close', () => {
      actual = null;
      marco.replaceChildren();
      screen.orientation?.unlock?.();
      if (document.fullscreenElement === raiz) document.exitFullscreen().catch(() => {});
    });
    // Esc in full screen only reaches the browser: leaving full screen is what closes the drawing.
    document.addEventListener('fullscreenchange', () => {
      if (!dlg.open) return;
      if (!document.fullscreenElement) dlg.close();
      else pintar();
    });
    window.addEventListener('resize', () => {
      if (dlg.open) pintar();
    });
    document.body.append(dlg);
  };

  const mostrar = (figura) => {
    actual = figura.querySelector(':scope > svg').cloneNode(true);
    actual.removeAttribute('style');
    actual.removeAttribute('width');
    actual.removeAttribute('height');
    marco.replaceChildren(actual);
    escala = 1;
    dlg.showModal();
    pintar();
    marco.focus();
  };

  // A dialog cannot be the full screen element itself, so the whole page goes first and the dialog opens on top of it.
  const abrir = async (figura) => {
    if (!dlg) crear();
    if (dlg.open) return;
    const esta = ++serie;
    try {
      await raiz.requestFullscreen?.({ navigationUI: 'hide' });
      // A wide drawing reads better lying down. Only some phones allow it, and only in full screen.
      if (screen.orientation?.type.startsWith('portrait')) await screen.orientation.lock?.('landscape');
    } catch {
      // Without full screen or rotation, the dialog still fills the page.
    }
    if (esta === serie) mostrar(figura);
  };

  const editando = (f) => Boolean(f.closest('[contenteditable="true"]'));

  figuras.forEach((f) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'b-tema b-pantalla';
    b.textContent = 'Ver en pantalla completa';
    b.hidden = true;
    b.addEventListener('click', () => abrir(f));
    f.after(b);
    // Only drawings cut by the page get it: the ones that already fit have nothing to gain.
    const medir = () => {
      const corta = f.scrollWidth > f.clientWidth + 1;
      f.classList.toggle('con-pantalla', corta);
      b.hidden = !corta;
    };
    new ResizeObserver(medir).observe(f);
    medir();
    f.addEventListener('click', (e) => {
      if (f.classList.contains('con-pantalla') && e.target.closest('svg') && !editando(f)) abrir(f);
    });
    f.addEventListener('keydown', (e) => {
      if (f.classList.contains('con-pantalla') && e.target === f && (e.key === 'Enter' || e.key === ' ') && !editando(f)) {
        e.preventDefault();
        abrir(f);
      }
    });
  });
})();
