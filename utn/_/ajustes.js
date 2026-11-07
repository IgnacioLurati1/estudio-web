// Accessibility settings and full screen reading. Saved for every subject, only in this browser.
(() => {
  const A = window.UTN_AJUSTES;
  const bAcc = document.getElementById('accesibilidad');
  const bFoco = document.getElementById('foco');
  if (!A || !bAcc || !bFoco) return;
  const cambiar = (k, v) => {
    const s = A.leer();
    s[k] = v;
    A.guardar(s);
    A.aplicar(s);
  };

  // ----- Full screen: hides the side column so only the text is left.
  let conPantalla = false;
  const pintarFoco = () => {
    const on = document.documentElement.dataset.foco === '1';
    bFoco.textContent = on ? 'Salir de pantalla completa' : 'Pantalla completa';
  };
  const apagarFoco = () => {
    cambiar('foco', false);
    pintarFoco();
  };
  bFoco.addEventListener('click', () => {
    if (document.documentElement.dataset.foco === '1') {
      apagarFoco();
      if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
      return;
    }
    cambiar('foco', true);
    pintarFoco();
    const pedir = document.documentElement.requestFullscreen;
    if (pedir) {
      pedir
        .call(document.documentElement)
        .then(() => {
          conPantalla = true;
        })
        .catch(() => {});
    }
  });
  // Esc leaves the browser's full screen, and the reading mode goes with it.
  document.addEventListener('fullscreenchange', () => {
    if (!document.fullscreenElement && conPantalla) {
      conPantalla = false;
      apagarFoco();
    }
  });
  pintarFoco();

  // ----- Settings dialog
  const crear = (tag, props = {}, ...hijos) => {
    const e = document.createElement(tag);
    Object.assign(e, props);
    e.append(...hijos);
    return e;
  };
  const casilla = (k, texto, ayuda) => {
    const c = crear('input', { type: 'checkbox', checked: document.documentElement.dataset[k] === '1' });
    c.dataset.clave = k;
    c.addEventListener('change', () => cambiar(k, c.checked));
    const l = crear('label', { className: 'acc-op' }, c, crear('span', {}, texto));
    if (ayuda) l.append(crear('small', {}, ayuda));
    return l;
  };
  // `fichas` shows the options as tiles: with the letters at each size (true, for the text size) or with a tiny sheet
  // in each look's colours ('estilo').
  const grupo = (k, titulo, opciones, fichas = false) => {
    const ops = crear('div', { className: fichas === 'estilo' ? 'acc-fichas acc-estilos' : fichas ? 'acc-fichas' : 'acc-ops' });
    const actual = A.leer()[k] || '';
    opciones.forEach(([v, texto, ayuda]) => {
      const r = crear('input', { type: 'radio', name: `acc-${k}`, value: v, checked: v === actual });
      r.addEventListener('change', () => cambiar(k, v));
      const l = crear('label', { className: 'acc-op' }, r);
      if (fichas === 'estilo') {
        const m = crear('span', { className: 'acc-muestra' }, crear('span', { className: 'acc-muestra-t' }), crear('span', { className: 'acc-muestra-r' }));
        m.dataset.estilo = v || 'cuaderno';
        m.setAttribute('aria-hidden', 'true');
        l.append(m);
      } else if (fichas) {
        const aa = crear('span', { className: 'acc-aa' }, 'Aa');
        aa.setAttribute('aria-hidden', 'true');
        l.append(aa);
      }
      l.append(crear('span', {}, texto));
      if (ayuda) l.append(crear('small', {}, ayuda));
      ops.append(l);
    });
    return crear('fieldset', { className: 'acc-grupo' }, crear('legend', {}, titulo), ops);
  };
  // Own colours for titles and borders. The picker opens on the colour in use right now.
  const aHex = (css) => {
    const m = css.match(/\d+/g) || [0, 0, 0];
    return `#${m.slice(0, 3).map((n) => Number(n).toString(16).padStart(2, '0')).join('')}`;
  };
  const leerColor = (variable) => {
    const sonda = crear('span', {});
    sonda.style.color = `var(${variable})`;
    document.body.append(sonda);
    const c = getComputedStyle(sonda).color;
    sonda.remove();
    return aHex(c);
  };
  const luz = (hex) => {
    const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((s) => (s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4));
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };
  const contraste = (a, b) => {
    const [m, n] = [luz(a), luz(b)].sort((x, y) => y - x);
    return (m + 0.05) / (n + 0.05);
  };
  const filaColor = (clave, variable, texto) => {
    const id = `acc-${clave}`;
    const c = crear('input', { type: 'color', id, value: leerColor(variable) });
    // Always in the page and empty when the color is fine, so a screen reader hears it when it appears.
    const aviso = crear('span', { className: 'acc-aviso', id: `${id}-aviso` });
    aviso.setAttribute('role', 'status');
    c.setAttribute('aria-describedby', aviso.id);
    const pintarAviso = () => {
      aviso.textContent = contraste(c.value, leerColor('--papel')) >= 3 ? '' : 'Con este color cuesta verlo sobre el fondo.';
    };
    c.addEventListener('input', () => {
      cambiar(clave, c.value);
      pintarAviso();
    });
    pintarAviso();
    return crear('div', { className: 'acc-color' }, crear('label', { htmlFor: id }, texto), c, aviso);
  };
  // A drawer from the right, built like the menu (menu.js): data-fuera is the drawer out of view and data-saliendo
  // makes the way out faster. The slide lives in utn.css; without motion only the fade is left. The modal dialog keeps
  // the focus inside, and Esc, a click outside and both close buttons close it.
  let abierto = null;
  bAcc.addEventListener('click', () => {
    if (abierto) return;
    const d = crear('dialog', { className: 'menu acc' });
    d.setAttribute('aria-labelledby', 'accTitulo');
    const panel = crear('div', { className: 'mn-panel' });
    const cuerpo = crear('div', { className: 'acc-cuerpo' });
    let espera = 0;

    const armar = () => {
      const estilo = grupo('estilo', 'Estilo', [
        ['', 'Cuaderno'],
        ['lisa', 'Hoja lisa'],
        ['rayada', 'Hoja rayada'],
        ['sepia', 'Sepia'],
        ['pizarron', 'Pizarrón'],
      ], 'estilo');
      estilo.append(crear('p', { className: 'acc-ayuda' }, 'Cada uno tiene su versión de día y de noche. El pizarrón es blanco de día y verde de noche.'));
      cuerpo.replaceChildren(
        estilo,
        crear('div', { className: 'acc-grupo' }, casilla('contraste', 'Alto contraste', 'Texto y bordes más marcados, sin cuadriculado. Va con el modo día y con el modo noche.')),
        grupo('daltonismo', 'Colores', [
          ['', 'Normales'],
          ['rg', 'Daltonismo rojo y verde', 'Para protanopia y deuteranopia. Bien y mal pasan a azul y naranja.'],
          ['ay', 'Daltonismo azul y amarillo', 'Para tritanopia. El resaltador pasa a rosa y los enlaces a turquesa.'],
        ]),
        grupo('texto', 'Tamaño del texto', [
          ['', 'Normal'],
          ['125', 'Grande'],
          ['150', 'Más grande'],
          ['175', 'Enorme'],
        ], true),
        crear('fieldset', { className: 'acc-grupo' }, crear('legend', {}, 'Títulos y bordes'), filaColor('colorTitulos', '--titulo', 'Color de los títulos'), filaColor('colorBordes', '--linea', 'Color de los bordes')),
        crear(
          'div',
          { className: 'acc-grupo' },
          casilla('interlineado', 'Más espacio entre líneas y letras'),
          casilla('legible', 'Letra más fácil de leer', 'Cambia todas las letras, también las notas a mano.'),
          casilla('quieto', 'Sin animaciones'),
        ),
      );
    };

    const sinTransicion = () => getComputedStyle(panel).transitionDuration.split(',').every((x) => parseFloat(x) === 0);
    const cerrar = () => {
      if (!d.open || 'saliendo' in d.dataset) return;
      const listo = () => {
        clearTimeout(espera);
        panel.removeEventListener('transitionend', alTerminar);
        if (d.open) d.close();
      };
      const alTerminar = (e) => {
        if (e.target === panel) listo();
      };
      d.dataset.saliendo = '';
      d.dataset.fuera = '';
      if (sinTransicion()) {
        listo();
        return;
      }
      panel.addEventListener('transitionend', alTerminar);
      espera = setTimeout(listo, 400);
    };

    const titulo = crear('h2', { className: 'mn-marca', id: 'accTitulo' }, 'Accesibilidad');
    const equis = crear('button', { type: 'button', className: 'b-tema mn-cerrar' });
    equis.setAttribute('aria-label', 'Cerrar');
    equis.innerHTML = '<svg class="b-menu-i" viewBox="0 0 48 48" aria-hidden="true" focusable="false"><path d="M13 13l22 22M35 13L13 35"/></svg>';
    equis.addEventListener('click', cerrar);
    const normal = crear('button', { type: 'button', className: 'b-sec' }, 'Volver a lo normal');
    normal.addEventListener('click', () => {
      const foco = A.leer().foco === true;
      A.guardar({ foco });
      A.aplicar({ foco });
      armar();
    });
    const listoBoton = crear('button', { type: 'button', className: 'b-pri' }, 'Cerrar');
    listoBoton.addEventListener('click', cerrar);
    armar();
    // The focus starts on the look in use, the first setting, and not on the scrolling panel.
    (cuerpo.querySelector('input:checked') || cuerpo.querySelector('input')).autofocus = true;
    panel.append(crear('div', { className: 'mn-cabeza' }, titulo, equis), cuerpo, crear('div', { className: 'acc-pie' }, listoBoton, normal));
    d.append(crear('div', { className: 'mn-fondo' }), panel);

    d.addEventListener('cancel', (e) => {
      // Esc: the drawer goes out the same way. If the browser does not let us wait, it closes at once.
      if (!e.cancelable) return;
      e.preventDefault();
      cerrar();
    });
    d.addEventListener('click', (e) => {
      if (!panel.contains(e.target)) cerrar();
    });
    d.addEventListener('close', () => {
      clearTimeout(espera);
      abierto = null;
      d.remove();
      bAcc.focus();
    });

    abierto = d;
    d.dataset.fuera = '';
    document.body.append(d);
    d.showModal();
    // The drawer starts out of view, so the slide has somewhere to come from.
    void panel.offsetWidth;
    delete d.dataset.fuera;
  });
  // Coming back with the browser's back button should not find the drawer still open.
  window.addEventListener('pagehide', () => {
    if (abierto && abierto.open) abierto.close();
  });
})();
