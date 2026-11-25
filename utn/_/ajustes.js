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
  // drawn with the real option ('paleta', 'hoja' and 'forma'). Each tile carries the other choices in use, so changing
  // one repaints the others. The style is saved as «forma» and goes on <html> as data-estilo.
  const ATRIBUTO = { paleta: 'paleta', hoja: 'hoja', forma: 'estilo' };
  const BASE = { paleta: 'birome', hoja: 'cuadriculada', forma: 'cuaderno' };
  const grupo = (k, titulo, opciones, fichas = false) => {
    const muestra = fichas in ATRIBUTO;
    const ops = crear('div', { className: muestra ? `acc-fichas acc-estilos acc-${fichas}s` : fichas ? 'acc-fichas' : 'acc-ops' });
    const actual = muestra ? document.documentElement.dataset[ATRIBUTO[k]] || '' : A.leer()[k] || '';
    opciones.forEach(([v, texto, ayuda]) => {
      const r = crear('input', { type: 'radio', name: `acc-${k}`, value: v, checked: v === actual });
      r.addEventListener('change', () => {
        cambiar(k, v);
        if (muestra) {
          Object.keys(ATRIBUTO).filter((o) => o !== k).forEach((o) => {
            document.querySelectorAll(`.acc-${o}s .acc-muestra`).forEach((m) => {
              m.dataset[ATRIBUTO[k]] = v || BASE[k];
            });
          });
        }
      });
      const l = crear('label', { className: 'acc-op' }, r);
      if (muestra) {
        const raiz = document.documentElement.dataset;
        const m = crear('span', { className: 'acc-muestra' });
        Object.keys(ATRIBUTO).forEach((o) => {
          m.dataset[ATRIBUTO[o]] = (o === k ? v : raiz[ATRIBUTO[o]]) || BASE[o];
        });
        if (k === 'paleta') m.append(crear('span', { className: 'acc-muestra-hoja' }, crear('span', { className: 'acc-muestra-t' }, 'Aa'), crear('mark', {}, 'final')));
        if (k === 'forma') m.append(crear('span', { className: 'acc-forma-tarjeta' }), crear('span', { className: 'acc-forma-fila' }, crear('span', { className: 'acc-forma-campo' }), crear('span', { className: 'acc-forma-boton' })));
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
  // Day, night or like the device. It lives apart from the other settings (utn:tema), like the button in the bar.
  const grupoTema = () => {
    const actual = A.tema();
    const ops = crear('div', { className: 'acc-ops acc-tema' });
    [['dia', 'De día'], ['noche', 'De noche'], ['sistema', 'Como la compu']].forEach(([v, texto]) => {
      const r = crear('input', { type: 'radio', name: 'acc-tema', value: v, checked: v === actual });
      r.addEventListener('change', () => {
        try {
          localStorage.setItem('utn:tema', v);
        } catch {
          /* No storage: it applies until the page closes. */
        }
        if (v === 'sistema') A.aplicarTema();
        else if (v === 'noche') document.documentElement.dataset.tema = 'noche';
        else delete document.documentElement.dataset.tema;
        window.dispatchEvent(new Event('utn:tema'));
      });
      ops.append(crear('label', { className: 'acc-op' }, r, crear('span', {}, texto)));
    });
    return crear('fieldset', { className: 'acc-grupo' }, crear('legend', {}, 'Modo'), ops);
  };
  // Ready-made colours as round swatches, plus any other with the browser's picker. The first, empty, is the palette's.
  const tonos = (k, titulo, opciones, ayuda) => {
    const actual = A.leer()[k] || '';
    const propio = actual && !opciones.some(([v]) => v === actual);
    const ops = crear('div', { className: 'acc-tonos' });
    const otro = crear('input', { type: 'color', id: `acc-${k}-otro`, value: propio ? actual : opciones[1][0] });
    opciones.forEach(([v, nombre]) => {
      const r = crear('input', { type: 'radio', name: `acc-${k}`, value: v, checked: v === actual });
      if (v) r.style.setProperty('--tono', v);
      r.addEventListener('change', () => cambiar(k, v || undefined));
      ops.append(crear('label', { className: 'acc-tono' }, r, crear('span', {}, nombre)));
    });
    otro.addEventListener('input', () => {
      ops.querySelectorAll('input').forEach((r) => {
        r.checked = false;
      });
      cambiar(k, otro.value);
    });
    const caja = crear('fieldset', { className: 'acc-sub' }, crear('legend', {}, titulo));
    if (ayuda) caja.append(crear('small', { className: 'acc-ayuda' }, ayuda));
    caja.append(ops, crear('div', { className: 'acc-color' }, crear('label', { htmlFor: otro.id }, 'Otro color'), otro));
    return caja;
  };
  // How bright the letters are at night: a native slider of five steps, each said in words. The last one, the look's own
  // ink, is the one that comes, so it is not saved.
  const BRILLO = ['Muy bajo', 'Bajo', 'Medio', 'Alto', 'Al máximo'];
  const filaBrillo = () => {
    const id = 'acc-brillo';
    const guardado = A.leer().claridad;
    const r = crear('input', { type: 'range', id, min: 0, max: BRILLO.length - 1, step: 1, value: String([0, 1, 2, 3].includes(guardado) ? guardado : BRILLO.length - 1) });
    const valor = crear('output', { className: 'acc-valor', id: `${id}-valor` });
    valor.setAttribute('for', id);
    valor.setAttribute('aria-hidden', 'true');
    const ayuda = crear('small', { className: 'acc-ayuda', id: `${id}-ayuda` }, 'Bajalo si de noche la letra te encandila. Con alto contraste queda siempre al máximo.');
    r.setAttribute('aria-describedby', ayuda.id);
    const pintar = () => {
      const t = BRILLO[Number(r.value)];
      valor.textContent = t;
      r.setAttribute('aria-valuetext', t);
    };
    r.addEventListener('input', () => {
      pintar();
      const n = Number(r.value);
      cambiar('claridad', n < BRILLO.length - 1 ? n : undefined);
    });
    pintar();
    return crear('div', { className: 'acc-grupo acc-rango' }, crear('div', { className: 'acc-rango-cab' }, crear('label', { htmlFor: id }, 'Brillo de la letra de noche'), valor), r, ayuda);
  };
  // Own colours for titles and borders. The picker opens on the colour in use right now. A colour mixed in CSS (the
  // night brightness) comes back as `color(srgb r g b)`, from 0 to 1.
  const aHex = (css) => {
    const srgb = /^color\(srgb\s+([\d.e-]+)\s+([\d.e-]+)\s+([\d.e-]+)/.exec(css);
    const m = srgb ? srgb.slice(1, 4).map((x) => Math.round(Math.min(1, Math.max(0, Number(x) || 0)) * 255)) : (css.match(/\d+/g) || [0, 0, 0]).slice(0, 3);
    return `#${m.map((n) => Number(n).toString(16).padStart(2, '0')).join('')}`;
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
      cuerpo.replaceChildren(
        grupoTema(),
        grupo('paleta', 'Tema', [
          ['', 'Birome'],
          ['sepia', 'Sepia'],
          ['pizarron', 'Pizarrón'],
          ['plano', 'Plano'],
          ['grafito', 'Grafito'],
          ['rosa', 'Dark pink'],
        ], 'paleta'),
        grupo('forma', 'Estilo', [
          ['', 'Cuaderno'],
          ['limpio', 'Limpio'],
          ['redondo', 'Redondo'],
          ['brutal', 'Brutal'],
        ], 'forma'),
        grupo('hoja', 'Hoja', [
          ['', 'Cuadriculada'],
          ['rayada', 'Rayada'],
          ['punteada', 'Punteada'],
          ['lisa', 'Lisa'],
        ], 'hoja'),
        crear(
          'fieldset',
          { className: 'acc-grupo' },
          crear('legend', {}, 'Tus colores'),
          tonos('tinta', 'Tinta', [['', 'Del tema'], ['#1f4fd1', 'Azul'], ['#1d7a4a', 'Verde'], ['#9b1d3a', 'Bordó'], ['#6b3fb8', 'Violeta'], ['#00747a', 'Turquesa'], ['#c2410c', 'Naranja']], 'Títulos, enlaces y botones.'),
          tonos('resaltador', 'Resaltador', [['', 'Del tema'], ['#c8f56a', 'Lima'], ['#8fd8ff', 'Celeste'], ['#ffb3d6', 'Rosa'], ['#ffc27a', 'Naranja'], ['#d4b8ff', 'Lila']]),
          filaColor('colorTitulos', '--titulo', 'Color de los títulos'),
          filaColor('colorBordes', '--linea', 'Color de los bordes'),
        ),
        filaBrillo(),
        crear('div', { className: 'acc-grupo' }, casilla('contraste', 'Alto contraste', 'Letra y bordes más marcados, sin perder tu tema.')),
        grupo('daltonismo', 'Daltonismo', [
          ['', 'No'],
          ['rg', 'Rojo y verde', 'Para protanopia y deuteranopia. Bien y mal pasan a azul y naranja.'],
          ['ay', 'Azul y amarillo', 'Para tritanopia. El resaltador pasa a rosa y los enlaces a turquesa.'],
        ]),
        grupo('texto', 'Tamaño del texto', [
          ['', 'Normal'],
          ['125', 'Grande'],
          ['150', 'Más grande'],
          ['175', 'Enorme'],
        ], true),
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

    const titulo = crear('h2', { className: 'mn-marca', id: 'accTitulo' }, 'Configuración');
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
    // Once something is changed, the page behind stops being darkened, so the change can be judged without closing.
    cuerpo.addEventListener('change', () => {
      d.dataset.viendo = '';
    });

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
