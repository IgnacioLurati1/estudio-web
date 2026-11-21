// Reading a study page aloud: what is selected or, with nothing selected, from the part of the page in view to the end.
// Sentence by sentence, with a soft mark on the paragraph that sounds and the view going along with it. Only with the
// device's own voices (`localService`): the others, like Chrome's «Google» ones, send the text to a server. Nothing of
// the text is kept or sent. The speed is kept with the other settings (utn:ajustes, tema.js).
// Ported from Super CVG's PDF reader (src/lib/voz.js and lector/Voz.jsx). The pure part also runs from Node, for the
// tests, like examen.js. The round buttons at the bottom right are shared with senaladores.js.
(() => {
  'use strict';

  /** The speeds offered, in order: the button goes through them and back to the first. */
  const VELOCIDADES = [0.75, 1, 1.25, 1.5, 1.75, 2];
  const VELOCIDAD_INICIAL = 1;

  /** A speed that came from anywhere (utn:ajustes): the closest of the offered ones, or the usual one. */
  function normalizarVelocidad(v) {
    if (typeof v !== 'number' || !Number.isFinite(v)) return VELOCIDAD_INICIAL;
    return VELOCIDADES.reduce((mejor, paso) => (Math.abs(paso - v) < Math.abs(mejor - v) ? paso : mejor));
  }

  const siguienteVelocidad = (v) => VELOCIDADES[(VELOCIDADES.indexOf(normalizarVelocidad(v)) + 1) % VELOCIDADES.length];

  /** «1,25×», as the button shows it. */
  const textoVelocidad = (v) => `${String(normalizarVelocidad(v)).replace('.', ',')}×`;

  const idioma = (v) => v.lang.replace(/_/g, '-').toLowerCase();
  // Rioplatense first, then the rest of Latin America, Spain last: it sounds the least like the student.
  const RIOPLATENSE = ['es-uy', 'es-py'];
  const puesto = (lang) => (lang === 'es-ar' ? 0 : RIOPLATENSE.includes(lang) ? 1 : lang === 'es-es' ? 3 : 2);

  /** The voice to read with: a local one in Spanish, Argentina's first. Null when the device has none: then nothing is
   * read, because without a voice the browser could take a remote one. */
  function elegirVoz(voces) {
    const propias = (voces ?? []).filter((v) => v?.localService === true && typeof v.lang === 'string' && /^es(-|$)/.test(idioma(v)));
    if (!propias.length) return null;
    const orden = (v) => puesto(idioma(v)) * 2 + (v.default ? 0 : 1);
    return propias.reduce((mejor, v) => (orden(v) < orden(mejor) ? v : mejor));
  }

  /** The longest piece said at once: Chrome cuts long texts, and a short piece pauses and changes speed sooner. */
  const TRAMO_MAX = 200;
  // A line this short, without a period and with a capital after it, is a title: it is read apart and not run into the
  // next sentence.
  const RENGLON_TITULO = 60;
  const FIN_DE_ORACION = /[.!?…:;,]["»”’)\]]*$/u;
  const EMPIEZA_ALGO = /^[\p{Lu}\p{N}•▪◦●■\-–—]/u;

  // Pieces of a sentence longer than `max`: at a semicolon or a colon, then at a comma, then between words.
  function trozar(oracion, max) {
    const partes = [];
    let resto = oracion;
    while (resto.length > max) {
      const ventana = resto.slice(0, max + 1);
      const minimo = Math.floor(max * 0.4);
      let corte = Math.max(ventana.lastIndexOf('; '), ventana.lastIndexOf(': '));
      if (corte < minimo) corte = ventana.lastIndexOf(', ');
      if (corte < minimo) corte = ventana.lastIndexOf(' ');
      corte = corte <= 0 ? max : corte + 1;
      partes.push(resto.slice(0, corte).trim());
      resto = resto.slice(corte).trim();
    }
    if (resto) partes.push(resto);
    return partes;
  }

  /** A text in the pieces it's read in: by sentence, and the long ones cut where they pause. Words split at the end of
   * a line come back together, and a short line before a capital is a title of its own. */
  function partirTexto(texto, max = TRAMO_MAX) {
    const renglones = String(texto ?? '')
      .replace(/(\p{L})[-­]\s*\n\s*(\p{Ll})/gu, '$1$2')
      .split(/\n/)
      .map((r) => r.replace(/\s+/g, ' ').trim())
      .filter(Boolean);
    const bloques = [];
    let bloque = '';
    renglones.forEach((r, i) => {
      bloque = bloque ? `${bloque} ${r}` : r;
      const siguiente = renglones[i + 1];
      const titulo = siguiente && r.length <= RENGLON_TITULO && !FIN_DE_ORACION.test(r) && EMPIEZA_ALGO.test(siguiente);
      if (!siguiente || titulo) {
        bloques.push(bloque);
        bloque = '';
      }
    });
    return bloques
      .flatMap((b) =>
        b.split(/(?<=[.!?…]["»”’)\]]*)\s+/u).reduce((oraciones, o) => {
          // A period before a number or a lowercase letter is not the end of a sentence: «p. 14», «Cap. 3», «etc. y».
          if (oraciones.length && /\.$/.test(oraciones.at(-1)) && /^[\p{Ll}\p{N}]/u.test(o)) oraciones[oraciones.length - 1] += ` ${o}`;
          else oraciones.push(o);
          return oraciones;
        }, []),
      )
      .map((o) => o.trim())
      .filter((o) => /[\p{L}\p{N}]/u.test(o))
      .flatMap((o) => trozar(o, max));
  }

  // What a flat formula says aloud, operator by operator. An operator missing here makes the formula one to skip.
  const OPERADORES = {
    '=': 'igual a', '+': 'más', '-': 'menos', '−': 'menos', '±': 'más o menos', '×': 'por', '·': 'por', '⋅': 'por', '*': 'por', '∗': 'por',
    '/': 'sobre', '÷': 'dividido', '<': 'menor que', '>': 'mayor que', '≤': 'menor o igual que', '≥': 'mayor o igual que', '≠': 'distinto de',
    '≈': 'aproximadamente', '%': 'por ciento', ',': ',', ';': ';', '.': '.', ':': ':', '(': '', ')': '', '[': '', ']': '', '{': '', '}': '',
  };
  const PLANOS = new Set(['math', 'semantics', 'mrow', 'mstyle', 'mpadded', 'mi', 'mn', 'mo', 'mtext', 'mspace']);

  /** What a formula says, from KaTeX's MathML copy (what screen readers read): only a flat one, letters, numbers, words
   * and the operators above, where the order of its characters is the order it's said in. One with a fraction, a power,
   * an index, a root or a table gives null, and the formula is skipped. */
  function hablarMathml(math) {
    const partes = [];
    const ir = (n) => {
      const tag = String(n.localName || n.nodeName || '').toLowerCase();
      if (tag === 'annotation' || tag === 'annotation-xml') return true;
      if (!PLANOS.has(tag)) return false;
      const t = String(n.textContent ?? '').trim();
      if (tag === 'mo') {
        if (!Object.hasOwn(OPERADORES, t)) return false;
        if (OPERADORES[t]) partes.push(OPERADORES[t]);
        return true;
      }
      if (tag === 'mi' || tag === 'mn' || tag === 'mtext') {
        if (t) partes.push(t);
        return true;
      }
      if (tag === 'mspace') return true;
      return [...(n.children ?? [])].every(ir);
    };
    if (!math || !ir(math)) return null;
    const t = partes.join(' ').replace(/\s+([,;.:])/g, '$1').replace(/\s+/g, ' ').trim();
    return /[\p{L}\p{N}]/u.test(t) ? t : null;
  }

  /** Reads aloud, one piece at a time, what `siguiente` hands out: `{ donde, tramos }` each time, or null at the end.
   * Pausing stops the voice and keeps the place: going on says that piece again from its start (Chrome on Android can't
   * pause in the middle). `alCambiar({ estado, donde })`: 'leyendo', 'pausa', or null when it was stopped, with
   * `terminada` when it got to the end and `error` if the voice failed. `decir(texto, velocidad)` makes the utterance,
   * with the voice already on it. */
  function crearLectura({ synth, decir, velocidad = VELOCIDAD_INICIAL, siguiente, alCambiar = () => {}, demora = 50 }) {
    // Each start, pause, speed change or stop is a new `vez`: what an older one left pending does nothing.
    let vez = 0;
    let estado = null;
    let bloque = null;
    let indice = 0;
    let fin = false;
    let pedido = null;
    let actual = null;
    let rapidez = normalizarVelocidad(velocidad);
    let espera = null;

    const avisar = (extra = {}) => alCambiar({ estado, donde: bloque?.donde ?? null, ...extra });

    const callar = () => {
      vez++;
      clearTimeout(espera);
      actual = null;
      synth.cancel();
    };

    const terminar = (extra) => {
      callar();
      estado = null;
      avisar(extra);
    };

    // The next block, asked once even if a pause and a «seguir» wait for it: none is skipped.
    const traer = () => {
      pedido ??= (async () => {
        let otro = null;
        try {
          otro = await siguiente();
        } catch {
          otro = null;
        }
        pedido = null;
        if (otro) {
          bloque = otro;
          indice = 0;
        } else fin = true;
        return otro;
      })();
      return pedido;
    };

    async function avanzar(miVez) {
      while (!bloque || indice >= bloque.tramos.length) {
        if (fin) {
          if (miVez === vez) terminar({ terminada: true });
          return;
        }
        const otro = await traer();
        if (miVez !== vez) return;
        if (otro?.tramos.length) avisar();
      }
      hablar(miVez);
    }

    function hablar(miVez) {
      let dicho;
      try {
        dicho = decir(bloque.tramos[indice], rapidez);
      } catch {
        // Without its voice on it, it is not said: the browser would choose one, maybe a remote one.
        terminar({ error: 'voz' });
        return;
      }
      // Held until it ends: Chrome drops the events of an utterance nobody holds.
      actual = dicho;
      dicho.onend = () => {
        if (miVez !== vez || actual !== dicho) return;
        indice++;
        avanzar(miVez);
      };
      dicho.onerror = (e) => {
        if (miVez !== vez || actual !== dicho) return;
        // Cut by something else (another tab, a call): it waits, paused, where it was.
        if (e?.error === 'interrupted' || e?.error === 'canceled') {
          vez++;
          actual = null;
          estado = 'pausa';
          avisar();
          return;
        }
        terminar({ error: e?.error ?? 'error' });
      };
      synth.speak(dicho);
    }

    // After a cancel, Safari and some Chromes drop a speak that comes right away.
    const retomar = () => {
      callar();
      const miVez = vez;
      espera = setTimeout(() => {
        if (miVez === vez && estado === 'leyendo') avanzar(miVez);
      }, demora);
    };

    return {
      empezar() {
        if (estado !== null) return;
        estado = 'leyendo';
        avisar();
        callar();
        avanzar(vez);
      },
      pausar() {
        if (estado !== 'leyendo') return;
        callar();
        estado = 'pausa';
        avisar();
      },
      seguir() {
        if (estado !== 'pausa') return;
        estado = 'leyendo';
        avisar();
        retomar();
      },
      parar() {
        if (estado !== null) terminar();
      },
      /** The new speed starts with the piece being said, said again from its start. */
      velocidad(v) {
        rapidez = normalizarVelocidad(v);
        if (estado === 'leyendo') retomar();
      },
      get estado() {
        return estado;
      },
    };
  }

  /** The device's voices. Chrome hands them out a moment after the first ask, with `voiceschanged`: it waits that long,
   * and no more than `ms`. */
  function cargarVoces(synth, ms = 1500) {
    const ya = synth.getVoices();
    if (ya.length) return Promise.resolve(ya);
    return new Promise((listo) => {
      const fin = () => {
        clearTimeout(reloj);
        synth.removeEventListener?.('voiceschanged', fin);
        listo(synth.getVoices());
      };
      const reloj = setTimeout(fin, ms);
      synth.addEventListener?.('voiceschanged', fin);
    });
  }

  const API = { VELOCIDADES, VELOCIDAD_INICIAL, normalizarVelocidad, siguienteVelocidad, textoVelocidad, elegirVoz, TRAMO_MAX, partirTexto, hablarMathml, crearLectura, cargarVoces };
  if (typeof module === 'object' && module.exports) {
    module.exports = API;
    return;
  }

  // ----- The page
  const hoja = document.querySelector('main.hoja');
  const A = window.UTN_AJUSTES;
  if (!hoja || !A) return;
  const d = document.documentElement;
  const quieto = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches || d.hasAttribute('data-quieto');

  const crear = (tag, props = {}, ...hijos) => {
    const e = document.createElement(tag);
    Object.assign(e, props);
    e.append(...hijos);
    return e;
  };
  const SVG = 'http://www.w3.org/2000/svg';
  const TRAZOS = {
    voz: 'M4 9.5h3.5L12 6v12l-4.5-3.5H4zM15.5 9.2a4 4 0 0 1 0 5.6M18.2 6.6a7.8 7.8 0 0 1 0 10.8',
    pausa: 'M9 6.5v11M15 6.5v11',
    seguir: 'M8.5 6v12l9.5-6z',
    parar: 'M7 7h10v10H7z',
  };
  const icono = (nombre) => {
    const s = document.createElementNS(SVG, 'svg');
    s.setAttribute('viewBox', '0 0 24 24');
    s.setAttribute('aria-hidden', 'true');
    s.setAttribute('focusable', 'false');
    s.dataset.icono = nombre;
    const p = document.createElementNS(SVG, 'path');
    p.setAttribute('d', TRAZOS[nombre]);
    s.append(p);
    return s;
  };
  // The round buttons at the bottom right, a labelled region of their own. senaladores.js puts its own first.
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

  const AVISOS = {
    sinLector: 'Este navegador no lee en voz alta. Probá con otro.',
    sinVoz: 'Tu dispositivo no tiene una voz en castellano para leer. Podés sumar una en la configuración del sistema.',
    sinTexto: 'No queda texto para leer desde acá. Subí un poco y probá de nuevo.',
    error: 'Se cortó la lectura en voz alta. Probá de nuevo.',
  };
  // A selection taken when the button is pressed lasts this long: on a phone, the touch on the button may clear it.
  const SELECCION_MS = 1500;
  const sintetizador = () => (window.speechSynthesis && typeof window.SpeechSynthesisUtterance === 'function' ? window.speechSynthesis : null);

  // ----- The text. Blocks of the sheet in order (a paragraph, an item, a cell, a title), each with its text and the
  // title of its part. Skipped: what can't be seen, the buttons, interactive graphs, exercises and quizzes, code, and
  // what a closed «details» keeps.
  const SALTEAR = 'script,style,template,noscript,svg,canvas,img,video,audio,iframe,button,input,select,textarea,pre,[hidden],[aria-hidden="true"],.vh,[data-w],figure.w,.quiz,.ejercicio,.ej-fila,.nivel,.esq,.em-votos,[data-estrellas-materia]';
  const LETRA = /[\p{L}\p{N}]/u;
  const textoFormula = (k) => {
    const propio = k.getAttribute('aria-label') || k.closest('[role="math"]')?.getAttribute('aria-label') || k.querySelector('math')?.getAttribute('alttext');
    if (propio && propio.trim()) return propio.trim();
    return hablarMathml(k.querySelector('math'));
  };
  // A title as the side index says it (construir.mjs), or its visible text without the formulas' copy and the buttons.
  const textoTitulo = (h) => {
    const enIndice = h.id && document.querySelector(`.toc a[href="#${CSS.escape(h.id)}"]`);
    if (enIndice) return enIndice.textContent.replace(/\s+/g, ' ').trim();
    const c = h.cloneNode(true);
    c.querySelectorAll('.katex-mathml, button').forEach((x) => x.remove());
    return c.textContent.replace(/\s+/g, ' ').trim();
  };

  function extraer(raiz, rango) {
    const bloques = [];
    const h1 = raiz.querySelector('h1');
    let titulo = h1 ? textoTitulo(h1) : '';
    const nuevo = (el) => {
      const b = { el, partes: [], titulo };
      bloques.push(b);
      return b;
    };
    const ir = (nodo, bloque) => {
      let actual = bloque;
      for (const n of nodo.childNodes) {
        if (n.nodeType === 3) {
          if (rango && !rango.intersectsNode(n)) continue;
          // A selection that cuts a word takes it whole.
          let desde = rango && n === rango.startContainer ? rango.startOffset : 0;
          let hasta = rango && n === rango.endContainer ? rango.endOffset : n.data.length;
          while (desde > 0 && LETRA.test(n.data[desde]) && LETRA.test(n.data[desde - 1])) desde--;
          while (hasta < n.data.length && hasta > 0 && LETRA.test(n.data[hasta]) && LETRA.test(n.data[hasta - 1])) hasta++;
          actual.partes.push(n.data.slice(desde, hasta));
          continue;
        }
        if (n.nodeType !== 1 || (rango && !rango.intersectsNode(n)) || n.matches(SALTEAR)) continue;
        const cs = getComputedStyle(n);
        if (cs.display === 'none' || cs.visibility === 'hidden') continue;
        if (n.classList.contains('katex')) {
          const f = textoFormula(n);
          if (f) actual.partes.push(` ${f} `);
          continue;
        }
        if (n.localName === 'br') {
          actual.partes.push(' ');
          continue;
        }
        if (cs.display.startsWith('inline') || cs.display === 'contents') {
          ir(n, actual);
          continue;
        }
        // A block of its own. A closed «details» only says its summary.
        const hijo = nuevo(n);
        if (/^h[1-4]$/.test(n.localName)) titulo = hijo.titulo = textoTitulo(n);
        if (n.localName === 'details' && !n.open) {
          const s = n.querySelector(':scope > summary');
          if (s) ir(s, hijo);
        } else ir(n, hijo);
        // What the outer block says after this one is read after it.
        actual = nuevo(actual.el);
      }
    };
    ir(raiz, nuevo(raiz));
    return bloques
      .map((b) => ({ el: b.el, titulo: b.titulo, tramos: partirTexto(b.partes.join('').replace(/\s+/g, ' ').replace(/ ([.,;:!?])/g, '$1')) }))
      .filter((b) => b.tramos.length);
  }

  // The top of what can be seen: under the bar when it stays on top (on a computer), the window's edge if not.
  const arriba = () => Math.max(0, document.querySelector('.barra')?.getBoundingClientRect().bottom ?? 0);
  // From the first block that still shows, even if only its end does.
  const desdeLaVista = (bloques) => {
    const borde = arriba() + 4;
    const i = bloques.findIndex((b) => b.el.getBoundingClientRect().bottom > borde);
    return i < 0 ? [] : bloques.slice(i);
  };
  const rangoDeAhora = () => {
    const sel = document.getSelection();
    if (!sel?.rangeCount || sel.isCollapsed) return null;
    const r = sel.getRangeAt(0);
    return r.intersectsNode(hoja) ? r.cloneRange() : null;
  };

  // ----- The bar
  const herr = herramientas();
  const bLeer = crear('button', { type: 'button', className: 'vz-b vz-leer', title: 'Leer en voz alta' }, icono('voz'));
  bLeer.setAttribute('aria-label', 'Leer en voz alta');
  const donde = crear('p', { className: 'vz-donde' });
  const bPausa = crear('button', { type: 'button', className: 'vz-c vz-pausa' }, icono('pausa'));
  const bVel = crear('button', { type: 'button', className: 'vz-c vz-vel', title: 'Cambiar la velocidad' });
  const bParar = crear('button', { type: 'button', className: 'vz-c vz-parar', title: 'Parar' }, icono('parar'));
  bParar.setAttribute('aria-label', 'Parar');
  bParar.setAttribute('aria-keyshortcuts', 'Escape');
  const barra = crear('div', { className: 'vz-barra', hidden: true }, donde, bPausa, bVel, bParar);
  barra.setAttribute('role', 'group');
  barra.setAttribute('aria-label', 'Lectura en voz alta');
  // The notice is said by a status that is always there; the card shows it with its button.
  const anuncio = crear('span', { className: 'vh' });
  anuncio.setAttribute('role', 'status');
  const avisoTexto = crear('p');
  const bEntendido = crear('button', { type: 'button', className: 'b-sec b-chico' }, 'Entendido');
  const aviso = crear('div', { className: 'vz-aviso', hidden: true }, avisoTexto, bEntendido);
  herr.append(barra, bLeer, aviso, anuncio);

  const velocidad = () => normalizarVelocidad(A.leer().velocidadVoz);
  let lectura = null;
  let preparando = false;
  let tomada = null;
  let marcado = null;
  let estado = { estado: null, bloque: null, seleccion: false };

  const pintar = () => {
    const activa = estado.estado !== null;
    const pausa = estado.estado === 'pausa';
    herr.toggleAttribute('data-leyendo', activa);
    barra.hidden = !activa;
    bLeer.hidden = activa;
    if (!activa) return;
    // Two lines: how it goes, small, and what it reads, cut with an ellipsis when it doesn't fit.
    const que = estado.seleccion ? 'Lo que seleccionaste' : estado.bloque?.titulo || document.title;
    donde.replaceChildren(crear('span', { className: 'vz-estado' }, pausa ? 'En pausa' : 'Leyendo'), ' ', crear('span', { className: 'vz-que' }, que));
    donde.title = que;
    bPausa.replaceChildren(icono(pausa ? 'seguir' : 'pausa'));
    bPausa.setAttribute('aria-label', pausa ? 'Seguir' : 'Pausar');
    bPausa.title = pausa ? 'Seguir' : 'Pausar';
    bVel.replaceChildren(crear('span', { className: 'vh' }, 'Velocidad '), textoVelocidad(velocidad()));
  };

  const mostrarAviso = (clave) => {
    avisoTexto.textContent = AVISOS[clave];
    anuncio.textContent = AVISOS[clave];
    aviso.hidden = false;
    herr.dispatchEvent(new CustomEvent('utn:herramienta', { detail: 'voz' }));
  };
  const cerrarAviso = (devolverFoco) => {
    if (aviso.hidden) return;
    const tenia = aviso.contains(document.activeElement);
    aviso.hidden = true;
    anuncio.textContent = '';
    if (devolverFoco || tenia) bLeer.focus();
  };
  bEntendido.addEventListener('click', () => cerrarAviso(true));
  // The bookmarks' list opening takes the notice away, so the two never pile up.
  herr.addEventListener('utn:herramienta', (e) => {
    if (e.detail !== 'voz') cerrarAviso(false);
  });

  // The soft mark on the block that sounds, and the view going with it. Not while the student moved the page by hand a
  // moment ago: they may be looking at something else.
  let gesto = 0;
  const tocoLaPagina = () => {
    gesto = Date.now();
  };
  window.addEventListener('wheel', tocoLaPagina, { passive: true });
  window.addEventListener('touchmove', tocoLaPagina, { passive: true });
  document.addEventListener('keydown', (e) => {
    if (/^(PageUp|PageDown|ArrowUp|ArrowDown|Home|End| )$/.test(e.key) && !e.target.closest?.('input, textarea, select, [contenteditable="true"]')) tocoLaPagina();
  });
  const marcar = (el) => {
    if (marcado === el) return;
    marcado?.classList.remove('vz-marca');
    marcado = el && el !== hoja ? el : null;
    marcado?.classList.add('vz-marca');
  };
  const acompanar = (el) => {
    if (!el || el === hoja || Date.now() - gesto < 4000) return;
    const r = el.getBoundingClientRect();
    const tope = arriba();
    const piso = window.innerHeight - herr.getBoundingClientRect().height - 24;
    const alto = piso - tope;
    if (r.top >= tope && r.bottom <= piso) return;
    // A block taller than the window is fine once it starts in view.
    if (r.height > alto && r.top >= tope && r.top < piso) return;
    let y;
    // Out of view, it comes to the middle. Cut at the top, or taller than the window, its top goes under the bar. Cut
    // at the bottom, it moves up just enough to clear the buttons.
    if (r.bottom <= tope || r.top >= piso) y = r.top - tope - Math.max(0, (alto - r.height) / 2);
    else if (r.top < tope || r.height > alto) y = r.top - tope - 12;
    else y = r.bottom - piso + 12;
    window.scrollBy({ top: y, behavior: quieto() ? 'auto' : 'smooth' });
  };

  const empezar = async () => {
    if (lectura || preparando) return;
    const conFoco = document.activeElement === bLeer;
    const synth = sintetizador();
    if (!synth) {
      mostrarAviso('sinLector');
      return;
    }
    const guardada = tomada && Date.now() - tomada.vez < SELECCION_MS ? tomada.rango : null;
    tomada = null;
    const rango = rangoDeAhora() ?? guardada;
    let bloques = rango ? extraer(hoja, rango) : [];
    const seleccion = bloques.length > 0;
    if (!seleccion) bloques = desdeLaVista(extraer(hoja));
    cerrarAviso(false);
    preparando = true;
    let voces = [];
    try {
      voces = await cargarVoces(synth);
    } catch {
      // A browser that fails to list them: as if it had none.
    } finally {
      preparando = false;
    }
    // Without a voice of the device nothing is said: the browser would take any, a remote one too.
    const voz = elegirVoz(voces);
    if (!voz) {
      mostrarAviso('sinVoz');
      return;
    }
    if (!bloques.length) {
      mostrarAviso('sinTexto');
      return;
    }
    // Scrolling to where it starts doesn't count: from here the view goes with the reading.
    gesto = 0;
    let i = 0;
    const esta = crearLectura({
      synth,
      velocidad: velocidad(),
      siguiente: async () => (i < bloques.length ? { donde: bloques[i], tramos: bloques[i++].tramos } : null),
      decir: (texto, rapidez) => {
        const dicho = new window.SpeechSynthesisUtterance(texto);
        dicho.voice = voz;
        dicho.lang = voz.lang;
        dicho.rate = rapidez;
        return dicho;
      },
      alCambiar: ({ estado: e, donde: b, error }) => {
        if (lectura !== esta) return;
        const antes = estado.estado;
        estado = { estado: e, bloque: b ?? estado.bloque, seleccion };
        if (e === null) {
          lectura = null;
          marcar(null);
          const enBarra = barra.contains(document.activeElement);
          pintar();
          // The bar goes: the focus that was in it goes back to the button.
          if (enBarra) bLeer.focus();
          if (error) mostrarAviso('error');
          return;
        }
        if (b) {
          marcar(b.el);
          if (e === 'leyendo') acompanar(b.el);
        }
        pintar();
        if (antes === null && conFoco) bPausa.focus();
      },
    });
    lectura = esta;
    esta.empezar();
  };
  const parar = () => lectura?.parar();

  bLeer.addEventListener('pointerdown', () => {
    const r = rangoDeAhora();
    tomada = r ? { rango: r, vez: Date.now() } : null;
  });
  bLeer.addEventListener('click', empezar);
  bPausa.addEventListener('click', () => (estado.estado === 'pausa' ? lectura?.seguir() : lectura?.pausar()));
  bParar.addEventListener('click', parar);
  bVel.addEventListener('click', () => {
    const v = siguienteVelocidad(velocidad());
    const s = A.leer();
    s.velocidadVoz = v;
    A.guardar(s);
    lectura?.velocidad(v);
    pintar();
  });

  // Esc stops the reading or takes the notice away, unless something else uses it first: an open dialog, the search
  // box, a field, editing, or the bookmarks' list (senaladores.js, which stops it there).
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape' || e.defaultPrevented || document.querySelector('dialog[open]')) return;
    if (e.target.closest?.('input, textarea, select, [contenteditable="true"]')) return;
    if (lectura) {
      e.preventDefault();
      parar();
    } else if (!aviso.hidden) {
      e.preventDefault();
      cerrarAviso(aviso.contains(document.activeElement));
    }
  });
  // Editing changes the text being read; leaving the page should not leave the voice going.
  document.getElementById('editar')?.addEventListener('click', parar, true);
  window.addEventListener('pagehide', () => {
    parar();
    sintetizador()?.cancel();
  });
})();
