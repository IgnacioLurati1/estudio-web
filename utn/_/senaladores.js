// Bookmarks of a subject: a small ribbon next to each title of a study page marks that part, and the ribbon button at
// the bottom right lists them all, page by page, to go back to one or take it off. Saved in this browser, in
// utn:<subject>:senaladores, and with a session also in the account (progreso.js, PATRONES). Each one keeps its page,
// the title's id, the title as it read, its place in the page and when it was put. Modelled on Super CVG's bookmarks
// (lector/Senaladores.jsx). The pure part also runs from Node, for the tests.
(() => {
  'use strict';

  /** At most this many per subject: the list stays short enough to find one, and small for the account. */
  const MAX = 60;
  const ID = /^[a-z0-9-]{1,150}$/;
  const ARCHIVO = /^[a-z0-9][a-z0-9._-]{0,80}\.html$/;

  /** The saved list, cleaned: only well formed ones, without repeats, at most MAX. Anything else gives an empty list. */
  function leer(texto) {
    let crudo;
    try {
      crudo = JSON.parse(texto);
    } catch {
      return [];
    }
    if (!Array.isArray(crudo)) return [];
    const vistos = new Set();
    const lista = [];
    for (const s of crudo) {
      if (!s || typeof s !== 'object' || typeof s.a !== 'string' || typeof s.id !== 'string' || !ARCHIVO.test(s.a) || !ID.test(s.id)) continue;
      const k = `${s.a}#${s.id}`;
      if (vistos.has(k)) continue;
      vistos.add(k);
      lista.push({
        a: s.a,
        id: s.id,
        t: typeof s.t === 'string' ? s.t.replace(/\s+/g, ' ').trim().slice(0, 120) : '',
        o: Number.isInteger(s.o) && s.o >= 0 ? s.o : 0,
        c: Number.isFinite(s.c) ? s.c : 0,
      });
      if (lista.length >= MAX) break;
    }
    return lista;
  }

  const esta = (lista, a, id) => lista.some((s) => s.a === a && s.id === id);

  /** The list with one more, or null when it already has MAX. Putting one that is there changes nothing. */
  function poner(lista, s) {
    if (esta(lista, s.a, s.id)) return lista;
    if (lista.length >= MAX) return null;
    return [...lista, s];
  }

  const sacar = (lista, a, id) => lista.filter((s) => !(s.a === a && s.id === id));

  /** In the order of the subject: page by page as the side menu lists them (one it doesn't know goes last), and inside a
   * page in the order of its titles. `[{ a, items }]`. */
  function agrupar(lista, paginas) {
    const lugar = (a) => {
      const i = paginas.indexOf(a);
      return i < 0 ? paginas.length : i;
    };
    const grupos = new Map();
    [...lista]
      .sort((x, y) => lugar(x.a) - lugar(y.a) || x.a.localeCompare(y.a) || x.o - y.o || x.c - y.c)
      .forEach((s) => {
        if (!grupos.has(s.a)) grupos.set(s.a, []);
        grupos.get(s.a).push(s);
      });
    return [...grupos].map(([a, items]) => ({ a, items }));
  }

  const API = { MAX, leer, poner, sacar, esta, agrupar };
  if (typeof module === 'object' && module.exports) {
    module.exports = API;
    return;
  }

  // ----- The page
  const hoja = document.querySelector('main.hoja');
  const materia = document.body.dataset.materia;
  if (!hoja || !/^[a-z0-9_-]+$/.test(materia || '')) return;
  const CLAVE = `utn:${materia}:senaladores`;
  // Titles that are not part of the summary: what edit mode took out, and the stars of the subject.
  const FUERA = '[data-sacado],.es-materia';

  const crear = (tag, props = {}, ...hijos) => {
    const e = document.createElement(tag);
    Object.assign(e, props);
    e.append(...hijos);
    return e;
  };
  const SVG = 'http://www.w3.org/2000/svg';
  const dibujo = (d, clase) => {
    const s = document.createElementNS(SVG, 'svg');
    s.setAttribute('viewBox', '0 0 24 24');
    s.setAttribute('aria-hidden', 'true');
    s.setAttribute('focusable', 'false');
    if (clase) s.setAttribute('class', clase);
    const p = document.createElementNS(SVG, 'path');
    p.setAttribute('d', d);
    s.append(p);
    return s;
  };
  const CINTA = 'M7 4h10v16.5l-5-4-5 4z';
  const CRUZ = 'M7 7l10 10M17 7L7 17';
  const herramientas = () => {
    let h = document.querySelector('.vz-herr');
    if (!h) {
      h = crear('div', { className: 'vz-herr' });
      h.setAttribute('role', 'region');
      h.setAttribute('aria-label', 'Leer y señalar');
      document.body.append(h);
    }
    return h;
  };

  // The pages of the subject, as the side menu lists and names them, and the one open now.
  const enlaces = [...document.querySelectorAll('.nav a[href]')].filter((a) => ARCHIVO.test(a.getAttribute('href')));
  const paginas = enlaces.map((a) => a.getAttribute('href'));
  const nombres = new Map(enlaces.map((a) => [a.getAttribute('href'), a.textContent.replace(/\s+/g, ' ').trim()]));
  const aqui = document.querySelector('.nav a[aria-current="page"]')?.getAttribute('href') || location.pathname.split('/').pop() || 'index.html';
  if (!ARCHIVO.test(aqui)) return;

  const cargar = () => {
    try {
      return leer(localStorage.getItem(CLAVE));
    } catch {
      return [];
    }
  };
  const guardar = (lista) => {
    try {
      if (lista.length) localStorage.setItem(CLAVE, JSON.stringify(lista));
      else localStorage.removeItem(CLAVE);
      return true;
    } catch {
      return false;
    }
  };

  // A title as the side index says it (construir.mjs), or its visible text without the formulas' copy and the buttons.
  const textoTitulo = (h) => {
    const enIndice = document.querySelector(`.toc a[href="#${CSS.escape(h.id)}"]`);
    if (enIndice) return enIndice.textContent.replace(/\s+/g, ' ').trim();
    const c = h.cloneNode(true);
    c.querySelectorAll('.katex-mathml, button').forEach((x) => x.remove());
    return c.textContent.replace(/\s+/g, ' ').trim();
  };
  const titulos = () => [...hoja.querySelectorAll('h2[id], h3[id]')].filter((h) => ID.test(h.id) && !h.closest(FUERA));

  // ----- The ribbon next to each title, before the flag of «Sugerir una corrección» if it is there.
  const herr = herramientas();
  const anuncio = crear('span', { className: 'vh' });
  anuncio.setAttribute('role', 'status');
  const decir = (t) => {
    anuncio.textContent = '';
    requestAnimationFrame(() => {
      anuncio.textContent = t;
    });
  };

  const pintarCintas = (lista) => {
    hoja.querySelectorAll('.sn-b').forEach((b) => {
      const puesto = esta(lista, aqui, b.dataset.id);
      b.setAttribute('aria-pressed', String(puesto));
      b.title = puesto ? 'Sacar el señalador' : 'Señalar esta parte';
    });
  };
  const ponerCintas = () => {
    if (document.body.classList.contains('editando')) return;
    titulos().forEach((h, o) => {
      if (h.querySelector('.sn-b')) return;
      const b = crear('button', { type: 'button', className: 'sn-b' }, dibujo(CINTA));
      // Short on purpose, like the flag: it is read as part of the title, and its state says the rest.
      b.setAttribute('aria-label', 'Señalar');
      b.dataset.id = h.id;
      b.dataset.o = String(o);
      h.insertBefore(b, h.querySelector('.rep-b'));
    });
    pintarCintas(cargar());
  };
  const quitarCintas = () => hoja.querySelectorAll('.sn-b').forEach((b) => b.remove());

  // ----- The list, over the ribbon button.
  const bAbrir = crear('button', { type: 'button', className: 'vz-b sn-abrir', title: 'Tus señaladores' }, dibujo(CINTA));
  const cuenta = crear('span', { className: 'sn-cuenta' });
  cuenta.setAttribute('aria-hidden', 'true');
  bAbrir.append(cuenta);
  bAbrir.setAttribute('aria-expanded', 'false');
  bAbrir.setAttribute('aria-controls', 'snPanel');
  const panel = crear('div', { className: 'sn-panel', id: 'snPanel', hidden: true });
  herr.prepend(bAbrir, panel, anuncio);
  let falta = '';

  const pintarCuenta = (lista) => {
    const n = lista.length;
    cuenta.textContent = n ? String(n) : '';
    bAbrir.toggleAttribute('data-con', n > 0);
    bAbrir.setAttribute('aria-label', n ? `Señaladores, ${n}` : 'Señaladores');
  };

  const pintarLista = (lista) => {
    const titulo = crear('h2', { className: 'sn-titulo', id: 'snTitulo', tabIndex: -1 }, 'Señaladores');
    const partes = [titulo];
    if (falta) {
      const p = crear('p', { className: 'sn-falta' }, falta);
      p.setAttribute('role', 'alert');
      partes.push(p);
    }
    if (!lista.length) partes.push(crear('p', { className: 'sn-vacio' }, 'Todavía no señalaste nada. Tocá la cinta al lado de un título para guardarlo acá.'));
    agrupar(lista, paginas).forEach(({ a, items }) => {
      const id = `snPag-${a.replace(/\W/g, '-')}`;
      const ul = crear('ul', { className: 'sn-lista' });
      ul.setAttribute('aria-labelledby', id);
      items.forEach((s) => {
        const nombre = s.t || 'Sin título';
        const ir = crear('a', { className: 'sn-ir', href: `${s.a}#${s.id}` }, nombre);
        if (s.a === aqui && location.hash === `#${s.id}`) ir.setAttribute('aria-current', 'location');
        ir.addEventListener('click', () => cerrar(false));
        const fuera = crear('button', { type: 'button', className: 'sn-sacar', title: 'Sacar el señalador' }, dibujo(CRUZ));
        fuera.setAttribute('aria-label', `Sacar «${nombre}»`);
        fuera.addEventListener('click', () => sacarDeLaLista(s));
        const li = crear('li', { className: 'sn-item' }, ir, fuera);
        li.dataset.k = `${s.a}#${s.id}`;
        ul.append(li);
      });
      partes.push(crear('section', { className: 'sn-grupo' }, crear('h3', { className: 'sn-pag', id }, nombres.get(a) || a.replace(/\.html$/, '')), ul));
    });
    panel.replaceChildren(...partes);
    panel.setAttribute('aria-labelledby', 'snTitulo');
    panel.setAttribute('role', 'region');
  };

  const pintar = (lista = cargar()) => {
    pintarCintas(lista);
    pintarCuenta(lista);
    if (!panel.hidden) pintarLista(lista);
  };

  let espera = 0;
  // `motivo`: why a bookmark could not be put, said at the top of the list.
  const abrir = (motivo = '') => {
    falta = motivo;
    if (!panel.hidden && !('saliendo' in panel.dataset)) {
      pintarLista(cargar());
      return;
    }
    clearTimeout(espera);
    delete panel.dataset.saliendo;
    pintarLista(cargar());
    panel.hidden = false;
    bAbrir.setAttribute('aria-expanded', 'true');
    herr.dispatchEvent(new CustomEvent('utn:herramienta', { detail: 'senaladores' }));
  };
  // It leaves faster than it comes (utn.css). Without motion, at once.
  function cerrar(devolverFoco) {
    if (panel.hidden || 'saliendo' in panel.dataset) return;
    bAbrir.setAttribute('aria-expanded', 'false');
    if (devolverFoco) bAbrir.focus();
    const quieto = window.matchMedia('(prefers-reduced-motion: reduce)').matches || document.documentElement.hasAttribute('data-quieto');
    const listo = () => {
      delete panel.dataset.saliendo;
      panel.hidden = true;
    };
    if (quieto) {
      listo();
      return;
    }
    panel.dataset.saliendo = '';
    espera = setTimeout(listo, 130);
  }
  bAbrir.addEventListener('click', () => (panel.hidden || 'saliendo' in panel.dataset ? abrir() : cerrar(false)));
  // Esc closes the list first, with the focus back on its button, and the reading (voz.js) keeps going.
  [bAbrir, panel].forEach((x) =>
    x.addEventListener('keydown', (e) => {
      if (e.key !== 'Escape' || panel.hidden) return;
      e.preventDefault();
      cerrar(true);
    }),
  );
  document.addEventListener('pointerdown', (e) => {
    if (!panel.hidden && !herr.contains(e.target)) cerrar(false);
  });
  herr.addEventListener('utn:herramienta', (e) => {
    if (e.detail !== 'senaladores') cerrar(false);
  });

  // Taken off from the list, the focus goes to the next one, or the one before, or the list's title.
  function sacarDeLaLista(s) {
    const lista = sacar(cargar(), s.a, s.id);
    if (!guardar(lista)) return;
    falta = '';
    const items = [...panel.querySelectorAll('.sn-item')];
    const i = items.findIndex((li) => li.dataset.k === `${s.a}#${s.id}`);
    const otra = items[i + 1]?.dataset.k ?? items[i - 1]?.dataset.k;
    pintar(lista);
    decir(`Sacaste el señalador de «${s.t || 'Sin título'}».`);
    const ir = otra && [...panel.querySelectorAll('.sn-item')].find((li) => li.dataset.k === otra)?.querySelector('.sn-ir');
    (ir || panel.querySelector('.sn-titulo'))?.focus();
  }

  // A ribbon pressed: puts or takes off the bookmark of that title.
  hoja.addEventListener('click', (e) => {
    const b = e.target.closest?.('.sn-b');
    if (!b || !hoja.contains(b)) return;
    const h = b.closest('h2, h3');
    if (!h) return;
    const lista = cargar();
    const t = textoTitulo(h);
    if (esta(lista, aqui, h.id)) {
      const otra = sacar(lista, aqui, h.id);
      if (!guardar(otra)) return;
      pintar(otra);
      decir(`Sacaste el señalador de «${t}».`);
      return;
    }
    const otra = poner(lista, { a: aqui, id: h.id, t: t.slice(0, 120), o: Number(b.dataset.o) || 0, c: Date.now() });
    if (!otra || !guardar(otra)) {
      abrir(otra ? 'No se pudo guardar el señalador. Puede que el navegador no tenga más lugar.' : `Llegaste a los ${MAX} señaladores de esta materia. Sacá alguno para poner otro.`);
      return;
    }
    falta = '';
    pintar(otra);
    b.dataset.recien = '';
    setTimeout(() => delete b.dataset.recien, 400);
    decir(`Señalaste «${t}».`);
  });

  // Another tab, or the account (progreso.js), changed them.
  window.addEventListener('storage', (e) => {
    if (e.key === CLAVE || e.key === null) pintar();
  });
  window.addEventListener('pagehide', () => cerrar(false));

  ponerCintas();
  pintarCuenta(cargar());
  // The edit script works on clean titles: this runs before its click, and comes back when it repaints after leaving.
  document.getElementById('editar')?.addEventListener('click', () => {
    if (!document.body.classList.contains('editando')) {
      quitarCintas();
      cerrar(false);
    }
  }, true);
  document.addEventListener('utn:recalcular', ponerCintas);
})();
