// Side index of a study page («En esta página»): a box next to each entry marks what you already did, and coming back
// to the page takes you to the section you were reading. The marks live in utn:<subject>:indice:<page> and, with a
// session, also in the account (progreso.js, PATRONES). Where you were stays in this browser only, in
// utn:<subject>:leyendo:<page>. A title and its subtitles are marked one by one. The pure part also runs from Node.
(() => {
  'use strict';

  const ID = /^[a-z0-9-]{1,150}$/;
  const ARCHIVO = /^[a-z0-9][a-z0-9._-]{0,80}\.html$/;
  /** At most this many marks per page: far more than any index has. */
  const MAX = 300;

  /** The saved marks, cleaned: ids only, without repeats, at most MAX. Anything else gives an empty list. */
  function leer(texto) {
    let crudo;
    try {
      crudo = JSON.parse(texto);
    } catch {
      return [];
    }
    if (!Array.isArray(crudo)) return [];
    return [...new Set(crudo.filter((x) => typeof x === 'string' && ID.test(x)))].slice(0, MAX);
  }

  /** The list with the id marked or not. Marking one that is there, or taking one that is not, gives the same list. */
  function marcar(lista, id, si) {
    if (!ID.test(id)) return lista;
    const esta = lista.includes(id);
    if (si === esta) return lista;
    if (!si) return lista.filter((x) => x !== id);
    return lista.length >= MAX ? lista : [...lista, id];
  }

  /** Where to take the page on arrival, or '' to leave it alone: only on a fresh visit (not a reload nor back and
   * forward, where the browser puts it back itself), without an #anchor, before any scrolling, and to a section that
   * is in this index. */
  function retomar({ guardado, ids, hash, tipo, y }) {
    if (tipo === 'reload' || tipo === 'back_forward') return '';
    if (hash && hash !== '#') return '';
    if (y > 0) return '';
    return typeof guardado === 'string' && ID.test(guardado) && ids.includes(guardado) ? guardado : '';
  }

  const API = { MAX, leer, marcar, retomar };
  if (typeof module === 'object' && module.exports) {
    module.exports = API;
    return;
  }

  // ----- The page
  const nav = document.querySelector('.toc[data-marcas]');
  const materia = document.body.dataset.materia;
  if (!nav || !/^[a-z0-9_-]+$/.test(materia || '')) return;
  const aqui = document.querySelector('.nav a[aria-current="page"]')?.getAttribute('href') || location.pathname.split('/').pop() || 'index.html';
  if (!ARCHIVO.test(aqui)) return;
  const pagina = aqui.slice(0, -5);
  const CLAVE = `utn:${materia}:indice:${pagina}`;
  const LEYENDO = `utn:${materia}:leyendo:${pagina}`;

  const leerClave = (k) => {
    try {
      return localStorage.getItem(k);
    } catch {
      return null;
    }
  };
  const escribir = (k, v) => {
    try {
      if (v === null) localStorage.removeItem(k);
      else localStorage.setItem(k, v);
    } catch {
      /* No storage: nothing is remembered. */
    }
  };

  // ----- The boxes. Each one is named by its entry: «Hecho: Árboles».
  const entradas = [...nav.querySelectorAll('li > a[href^="#"]')]
    .map((a) => ({ a, id: decodeURIComponent(a.hash.slice(1)) }))
    .filter((x) => ID.test(x.id));
  const rotulo = document.createElement('span');
  rotulo.id = 'tocHechoT';
  rotulo.hidden = true;
  rotulo.textContent = 'Hecho:';
  nav.append(rotulo);

  const cajas = new Map();
  for (const { a, id } of entradas) {
    if (!a.id) a.id = `toc-${id}`;
    const c = document.createElement('input');
    c.type = 'checkbox';
    c.className = 'toc-hecho';
    c.setAttribute('aria-labelledby', `${rotulo.id} ${a.id}`);
    c.addEventListener('change', () => {
      const lista = marcar(leer(leerClave(CLAVE)), id, c.checked);
      escribir(CLAVE, lista.length ? JSON.stringify(lista) : null);
      a.parentElement.toggleAttribute('data-hecho', c.checked);
    });
    a.parentElement.prepend(c);
    cajas.set(id, c);
  }
  const pintar = () => {
    const marcadas = new Set(leer(leerClave(CLAVE)));
    cajas.forEach((c, id) => {
      c.checked = marcadas.has(id);
      c.parentElement.toggleAttribute('data-hecho', c.checked);
    });
  };
  pintar();
  // Another tab, or the account (progreso.js), changed them.
  window.addEventListener('storage', (e) => {
    if (e.key === CLAVE || e.key === null) pintar();
  });

  // ----- Where you were: the last title above the top third of the screen, saved a moment after scrolling stops and
  // when leaving. Above the first title there is nothing to come back to.
  const ids = entradas.map((x) => x.id);
  const titulos = ids.map((id) => document.getElementById(id)).filter(Boolean);
  if (!titulos.length) return;
  const visible = (h) => h.getClientRects().length > 0;
  const dondeEstoy = () => {
    const linea = window.innerHeight / 3;
    let id = null;
    for (const t of titulos) {
      if (!visible(t)) continue;
      if (t.getBoundingClientRect().top > linea) break;
      id = t.id;
    }
    return id;
  };
  const anotar = () => escribir(LEYENDO, dondeEstoy());
  let espera = 0;
  const alMover = () => {
    clearTimeout(espera);
    espera = setTimeout(anotar, 250);
  };
  window.addEventListener('pagehide', anotar);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') anotar();
  });

  const tipo = performance.getEntriesByType?.('navigation')?.[0]?.type || 'navigate';
  const destino = retomar({ guardado: leerClave(LEYENDO), ids, hash: location.hash, tipo, y: window.scrollY });
  const h = destino && document.getElementById(destino);
  // A jump, never a slide: «Sin animaciones» and reduced motion have nothing to take away.
  const ir = () => h.scrollIntoView({ block: 'start', behavior: 'instant' });
  if (h && visible(h)) {
    ir();
    // Fonts, formulas and figures can still move it. Until the reader touches anything, it stays on that title.
    let quieto = true;
    const tocar = () => {
      quieto = false;
    };
    for (const ev of ['wheel', 'touchstart', 'keydown', 'pointerdown']) window.addEventListener(ev, tocar, { once: true, passive: true });
    const otraVez = () => {
      if (quieto && !location.hash && visible(h)) ir();
    };
    if (document.readyState === 'complete') requestAnimationFrame(otraVez);
    else window.addEventListener('load', otraVez, { once: true });
    document.fonts?.ready.then(otraVez);
  }
  // Listening starts after the jump, so arriving does not count as reading.
  requestAnimationFrame(() => window.addEventListener('scroll', alMover, { passive: true }));
})();
