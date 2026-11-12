// Edit mode. Changes live only in this browser, and travel as a link or a file, never through a server.
// Anything loaded from storage, a link or a file is untrusted: it goes through validar() and limpiar().
(() => {
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const hoja = $('.hoja');
  const bEditar = $('#editar');
  // The PDF of the subject (pdf.html) carries the student's changes too: painted once, part by part, with no tools.
  const enPdf = document.body.classList.contains('pdf');
  if (!hoja || (!bEditar && !enPdf)) return;

  const materia = document.body.dataset.materia;
  const CLAVE = `utn:${materia}:cambios`;
  const pagina = (location.pathname.split('/').pop() || 'index').replace(/\.html$/, '') || 'index';
  const MAX_TEXTO = 20000;
  const MAX_CAMBIOS = 3000;
  const MAX_BYTES = 3000000;
  const LINK_LARGO = 6000;
  // Photos and graphs live in piezas.js, shared with the summary maker.
  const P = window.UTN_PIEZAS;

  const TEXTO = 'h2,h3,h4,p,li,td,th,figcaption,.nota strong,.nota span,summary > span,summary small';
  const BLOQUES = 'pre,figure,.tabla,.tomado,.ojo,.idea,.criollo,.alumnos,.teorema,.demostracion,.ejemplo,.pregunta,.ejercicio';
  const AFUERA = '.w,.quiz,.mapa,.radar,.ej-filtros,.ej-lista,.ej-acciones,.ej-paso,.sol-ayuda,.aviso-cambios,.em-solo,.es-materia,.cae,.nivel,.pdf-de,.si-vivo';
  const INTERNO = /^([a-z0-9-]+\.html)?(#[a-z0-9-]+)?$/;

  // ----- Sanitising: only plain inline text formatting survives, and no attribute except internal links.
  const PERMITIDAS = { STRONG: 'strong', B: 'strong', EM: 'em', I: 'em', CODE: 'code', MARK: 'mark', SUP: 'sup', SUB: 'sub', BR: 'br', A: 'a' };
  const PELIGROSAS = /^(SCRIPT|STYLE|IFRAME|OBJECT|EMBED|SVG|MATH|TEMPLATE|NOSCRIPT|LINK|META|BASE|FORM|INPUT|BUTTON|TEXTAREA|SELECT|VIDEO|AUDIO|IMG)$/i;
  const limpiar = (html) => {
    const doc = new DOMParser().parseFromString(`<!doctype html><body>${html}`, 'text/html');
    const sale = doc.createElement('div');
    const copiar = (origen, destino) => {
      origen.childNodes.forEach((n) => {
        if (n.nodeType === 3) {
          destino.append(doc.createTextNode(n.nodeValue));
          return;
        }
        if (n.nodeType !== 1 || PELIGROSAS.test(n.nodeName)) return;
        const tag = PERMITIDAS[n.nodeName];
        if (n.nodeName === 'A' && !(n.getAttribute('href') && INTERNO.test(n.getAttribute('href')))) {
          copiar(n, destino);
          return;
        }
        if (tag) {
          const nuevo = doc.createElement(tag);
          if (tag === 'a') nuevo.setAttribute('href', n.getAttribute('href'));
          destino.append(nuevo);
          copiar(n, nuevo);
          return;
        }
        if (/^(DIV|P|LI|TR|H[1-6]|UL|OL|BLOCKQUOTE)$/.test(n.nodeName) && destino.childNodes.length) destino.append(doc.createElement('br'));
        copiar(n, destino);
      });
    };
    copiar(doc.body, sale);
    return sale.innerHTML.replace(/(<br>|\s)+$/, '').replace(/^(<br>|\s)+/, '');
  };

  const corto = P.corto;
  /** One added piece: text (sanitised HTML), or a photo or a graph checked by piezas.js. Null if it does not fit. */
  const pieza = (x) => (typeof x === 'string' ? (x.length <= MAX_TEXTO ? limpiar(x) || null : null) : P.objeto(x));

  // ----- State
  const vacio = () => ({ v: 1, nombre: '', paginas: Object.create(null) });
  const validar = (d) => {
    if (!d || typeof d !== 'object' || d.v !== 1 || !d.paginas || typeof d.paginas !== 'object') return null;
    const out = vacio();
    out.nombre = typeof d.nombre === 'string' ? d.nombre.slice(0, 60) : '';
    let n = 0;
    for (const [p, items] of Object.entries(d.paginas)) {
      if (!/^[a-z0-9-]{1,60}$/.test(p) || !items || typeof items !== 'object') continue;
      const o = Object.create(null);
      for (const [k, it] of Object.entries(items)) {
        if (!/^[a-z0-9]{1,12}-\d{1,5}$/.test(k) || !it || typeof it !== 'object') continue;
        n += 1;
        if (n > MAX_CAMBIOS) return null;
        const c = {};
        if (typeof it.h === 'string' && it.h.length <= MAX_TEXTO) c.h = limpiar(it.h);
        if (it.s === 1) c.s = 1;
        if (it.t === 1 || it.t === 0) c.t = it.t;
        if (Array.isArray(it.a)) {
          const a = it.a.slice(0, 50).map(pieza).filter(Boolean);
          if (a.length) c.a = a;
        }
        if (Object.keys(c).length) o[k] = c;
      }
      if (Object.keys(o).length) out.paginas[p] = o;
    }
    return out;
  };
  const cargar = () => {
    try {
      return validar(JSON.parse(localStorage.getItem(CLAVE))) || vacio();
    } catch {
      return vacio();
    }
  };
  let cambios = cargar();
  let sinGuardar = false;
  const guardarYa = () => {
    sinGuardar = false;
    try {
      localStorage.setItem(CLAVE, JSON.stringify(cambios));
      return true;
    } catch {
      avisar('No se pudo guardar en este navegador.');
      return false;
    }
  };
  let tGuardar = 0;
  const guardar = () => {
    sinGuardar = true;
    clearTimeout(tGuardar);
    tGuardar = setTimeout(guardarYa, 250);
  };
  addEventListener('pagehide', () => {
    if (sinGuardar) guardarYa();
  });
  const itemsPagina = () => cambios.paginas[pagina] || (cambios.paginas[pagina] = Object.create(null));
  const item = (k) => {
    const p = itemsPagina();
    return p[k] || (p[k] = {});
  };
  const podar = (k) => {
    const p = cambios.paginas[pagina];
    if (p && p[k] && !Object.keys(p[k]).length) delete p[k];
    if (p && !Object.keys(p).length) delete cambios.paginas[pagina];
  };
  const contar = (d = cambios) => {
    let n = 0;
    let paginas = 0;
    for (const items of Object.values(d.paginas)) {
      paginas += 1;
      for (const it of Object.values(items)) n += (it.h !== undefined ? 1 : 0) + (it.s ? 1 : 0) + (it.t !== undefined ? 1 : 0) + (it.a ? it.a.length : 0);
    }
    return { n, paginas };
  };

  // ----- Stable keys: built from the original text, so they survive a rebuild of the page.
  const fnv = (s) => {
    let h = 0x811c9dc5;
    for (let i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 0x01000193);
    }
    return (h >>> 0).toString(36);
  };
  // A page, or one part of the PDF, which is the same page inside a section.
  const armarClaves = (raiz) => {
    const unidades = new Map();
    const porClave = new Map();
    const vistos = new Map();
    $$(`${TEXTO},${BLOQUES}`, raiz).forEach((el) => {
      if (el.closest(AFUERA) || el.closest('.sol-grande')) return;
      const esTexto = el.matches(TEXTO);
      if (esTexto && el.querySelector(TEXTO)) return;
      const base = fnv(`${el.tagName}:${el.textContent.replace(/\s+/g, ' ').trim()}`);
      const orden = vistos.get(base) || 0;
      vistos.set(base, orden + 1);
      const clave = `${base}-${orden}`;
      const info = { el, clave, edita: esTexto && !el.querySelector('.katex, svg, pre, img'), html: el.innerHTML };
      unidades.set(el, info);
      porClave.set(clave, info);
    });
    return { unidades, porClave };
  };
  const { unidades, porClave } = enPdf ? { unidades: new Map(), porClave: new Map() } : armarClaves(hoja);

  // ----- Painting saved changes on the page
  let verOriginal = false;
  let editando = false;
  let huerfanos = 0;
  const grupoDe = (el) => {
    if (el.tagName === 'H2') return el.closest('.sec') ? [el.closest('.sec')] : [el];
    if (el.tagName === 'H3' || el.tagName === 'H4') {
      const nivel = +el.tagName[1];
      const g = [el];
      let n = el.nextElementSibling;
      while (n && !(/^H[1-6]$/.test(n.tagName) && +n.tagName[1] <= nivel)) {
        g.push(n);
        n = n.nextElementSibling;
      }
      return g;
    }
    if (el.tagName === 'TD' || el.tagName === 'TH') return [el.closest('tr')];
    return [el];
  };
  // ----- Photos and graphs
  const piezas = new WeakMap();
  const soltar = P.soltar;
  const crearPieza = (p) => {
    const fig = P.figura(p, 'agregado');
    piezas.set(fig, p);
    return fig;
  };
  const prenderPieza = (fig) => {
    fig.tabIndex = 0;
    const cap = fig.classList.contains('ag-foto') ? fig.querySelector('figcaption') : null;
    if (cap) cap.contentEditable = 'true';
  };
  const crearAgregado = (ancla, clave, contenido) => {
    let nuevo;
    if (typeof contenido === 'string') {
      nuevo = document.createElement(ancla.tagName === 'LI' ? 'li' : 'div');
      nuevo.className = 'agregado';
      nuevo.dataset.ph = 'Escribí acá lo que quieras sumar';
      nuevo.innerHTML = contenido;
      if (editando) nuevo.contentEditable = 'true';
    } else {
      // A figure does not fit inside a list item or a question title: it goes after the whole list or question.
      if (ancla.closest('summary')) ancla = ancla.closest('details') || ancla;
      if (ancla.tagName === 'LI') ancla = ancla.closest('ul,ol') || ancla;
      nuevo = crearPieza(contenido);
      if (editando) prenderPieza(nuevo);
    }
    nuevo.dataset.para = clave;
    let ultimo = ancla;
    while (ultimo.nextElementSibling && ultimo.nextElementSibling.classList.contains('agregado') && ultimo.nextElementSibling.dataset.para === clave) ultimo = ultimo.nextElementSibling;
    ultimo.after(nuevo);
    if (nuevo.classList.contains('ag-w')) P.montar(nuevo);
    return nuevo;
  };
  if (enPdf) {
    // ?original leaves the PDF as it comes. Otherwise each part gets the changes of its page, like the page itself.
    const original = new URLSearchParams(location.search).has('original');
    let paginas = 0;
    if (!original) {
      $$('section.pdf-parte[data-pagina]', hoja).forEach((sec) => {
        const items = cambios.paginas[sec.dataset.pagina];
        if (!items) return;
        const claves = armarClaves(sec).porClave;
        let alguno = false;
        for (const [k, it] of Object.entries(items)) {
          const u = claves.get(k);
          if (!u) continue;
          alguno = true;
          if (it.h !== undefined && u.edita) {
            u.el.innerHTML = it.h;
            u.el.classList.add('editado');
          }
          if (it.t !== undefined) (u.el.closest('.sec > *') || u.el).classList.add(it.t ? 'marca-toma' : 'no-toma');
          if (it.a) it.a.forEach((x) => crearAgregado(u.el, k, x));
          if (it.s) grupoDe(u.el).forEach((e) => e.setAttribute('data-sacado', k));
        }
        if (alguno) paginas += 1;
      });
    }
    const barra = $('.pdf-accion');
    if (barra && (paginas || (original && contar().n))) {
      const nota = document.createElement('p');
      nota.className = 'pdf-ayuda pdf-cambios';
      const ir = document.createElement('a');
      ir.href = original ? 'pdf.html' : 'pdf.html?original';
      ir.textContent = original ? 'Bajarlo con mis cambios' : 'Bajar el original';
      nota.append(original ? 'Es el original, sin tus cambios. ' : `Va con tus cambios en ${paginas === 1 ? '1 página' : `${paginas} páginas`}. `, ir);
      barra.append(nota);
    }
    return;
  }
  const aviso = document.createElement('div');
  aviso.className = 'aviso-cambios';
  aviso.hidden = true;
  aviso.setAttribute('role', 'status');
  const avisoTexto = document.createElement('span');
  const bVer = document.createElement('button');
  bVer.type = 'button';
  bVer.className = 'b-sec b-chico';
  aviso.append(avisoTexto, bVer);
  hoja.prepend(aviso);

  const pintarToc = () => {
    $$('.toc a').forEach((a) => {
      const h = document.getElementById(a.hash.slice(1));
      if (a.dataset.orig === undefined) a.dataset.orig = a.textContent;
      if (!h) return;
      if (/^H[1-6]$/.test(h.tagName)) {
        const limpio = h.cloneNode(true);
        limpio.querySelector('.rep-b')?.remove();
        a.textContent = limpio.textContent || a.dataset.orig;
      }
      a.parentElement.hidden = !editando && !!h.closest('[data-sacado]');
    });
  };
  const pintarAviso = () => {
    const items = cambios.paginas[pagina] ? Object.values(cambios.paginas[pagina]) : [];
    const ed = items.filter((i) => i.h !== undefined).length;
    const sa = items.filter((i) => i.s).length;
    const ag = items.reduce((t, i) => t + (i.a ? i.a.length : 0), 0);
    const partes = [];
    if (ed) partes.push(ed === 1 ? '1 texto editado' : `${ed} textos editados`);
    if (ag) partes.push(ag === 1 ? '1 agregado' : `${ag} agregados`);
    if (sa) partes.push(sa === 1 ? '1 parte sacada' : `${sa} partes sacadas`);
    const ma = items.filter((i) => i.t !== undefined).length;
    if (ma) partes.push(ma === 1 ? '1 cambio en lo que se toma' : `${ma} cambios en lo que se toma`);
    aviso.hidden = !partes.length && !huerfanos && !verOriginal;
    const version = cambios.nombre ? ` Versión «${cambios.nombre}».` : '';
    const perdidos = huerfanos ? ` ${huerfanos === 1 ? '1 cambio ya no encuentra' : `${huerfanos} cambios ya no encuentran`} su lugar porque el resumen se actualizó.` : '';
    avisoTexto.textContent = verOriginal ? 'Estás viendo el resumen original, sin cambios.' : `Esta página no es la original: ${partes.join(', ') || 'sin cambios a la vista'}.${version}${perdidos}`;
    bVer.textContent = verOriginal ? 'Volver a los cambios' : 'Ver el original';
    bEditar.classList.toggle('con-cambios', contar().n > 0);
  };
  // What counts as asked in exams works on the whole block, so the filter keeps it together.
  const bloqueDe = (el) => el.closest('.sec > *') || el;
  const pintarMarcas = () => {
    $$('.marca-toma, .no-toma', hoja).forEach((x) => x.classList.remove('marca-toma', 'no-toma'));
    const items = cambios.paginas[pagina];
    if (items && !verOriginal) {
      for (const [k, it] of Object.entries(items)) {
        const u = porClave.get(k);
        if (u && it.t !== undefined) bloqueDe(u.el).classList.add(it.t ? 'marca-toma' : 'no-toma');
      }
    }
    document.dispatchEvent(new Event('utn:recalcular'));
  };
  const pintar = () => {
    $$('.agregado', hoja).forEach((a) => {
      soltar(a);
      a.remove();
    });
    $$('[data-sacado]', hoja).forEach((e) => e.removeAttribute('data-sacado'));
    unidades.forEach((u) => {
      // Only text units: resetting a block would swap the elements inside it and leave them out of reach.
      if (u.edita && u.el.innerHTML !== u.html) u.el.innerHTML = u.html;
      u.el.classList.remove('editado');
    });
    huerfanos = 0;
    if (!verOriginal) {
      const items = cambios.paginas[pagina];
      if (items) {
        for (const [k, it] of Object.entries(items)) {
          const u = porClave.get(k);
          if (!u) {
            huerfanos += 1;
            continue;
          }
          if (it.h !== undefined && u.edita) {
            u.el.innerHTML = it.h;
            u.el.classList.add('editado');
          }
          if (it.a) it.a.forEach((html) => crearAgregado(u.el, k, html));
          if (it.s) grupoDe(u.el).forEach((e) => e.setAttribute('data-sacado', k));
        }
      }
    }
    pintarMarcas();
    pintarToc();
    pintarAviso();
  };

  // ----- Dock
  const boton = (texto, clase) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = clase;
    b.textContent = texto;
    return b;
  };
  const dock = document.createElement('div');
  dock.className = 'dock';
  dock.setAttribute('role', 'toolbar');
  dock.setAttribute('aria-label', 'Edición');
  dock.hidden = true;
  const estado = document.createElement('p');
  estado.className = 'dock-estado';
  estado.setAttribute('aria-live', 'polite');
  const acciones = document.createElement('div');
  acciones.className = 'dock-acciones';
  const bSacar = boton('Sacar', 'b-sec');
  const bBloque = boton('Sacar el bloque', 'b-sec');
  const bPoner = boton('Volver a poner', 'b-sec');
  const bAgregar = boton('Agregar abajo', 'b-sec');
  const bFoto = boton('Sumar una foto', 'b-sec');
  const bGrafico = boton('Sumar un gráfico', 'b-sec');
  const bRestaurar = boton('Volver al original', 'b-sec');
  const bToma = boton('Marcar que se toma', 'b-sec');
  const bCompartir = boton('Compartir', 'b-sec');
  const bListo = boton('Listo', 'b-pri');
  acciones.append(bSacar, bBloque, bPoner, bAgregar, bFoto, bGrafico, bRestaurar, bToma, bCompartir, bListo);
  dock.append(estado, acciones);
  document.body.append(dock);
  // Keeps the caret in the text while the buttons are used.
  dock.addEventListener('mousedown', (e) => e.preventDefault());

  const AYUDA = 'Tocá un texto para cambiarlo. Queda guardado solo en este navegador.';
  let actual = null;
  const avisar = (t) => {
    estado.textContent = t;
  };
  const nombreSacar = (el) => {
    if (el.tagName === 'H2') return 'Sacar la sección';
    if (el.tagName === 'H3' || el.tagName === 'H4') return 'Sacar este tema';
    if (el.tagName === 'TD' || el.tagName === 'TH') return 'Sacar la fila';
    return 'Sacar';
  };
  const NATURAL = '.tomado,.pregunta,.ejercicio';
  const seToma = (top) => (top.matches(NATURAL) || top.classList.contains('marca-toma')) && !top.classList.contains('no-toma');
  const pintarDock = () => {
    const el = actual;
    const esAgregado = !!el && el.classList.contains('agregado');
    const sacado = el ? el.closest('[data-sacado]') : null;
    const u = el ? unidades.get(el) : null;
    const contenedor = el && !esAgregado && el.parentElement ? el.parentElement.closest(BLOQUES) : null;
    const itemActual = u && cambios.paginas[pagina] ? cambios.paginas[pagina][u.clave] : null;
    bSacar.hidden = !el || !!sacado;
    bSacar.textContent = esAgregado ? 'Borrar lo agregado' : el ? nombreSacar(el) : 'Sacar';
    bBloque.hidden = !contenedor || !unidades.has(contenedor) || !!sacado;
    bPoner.hidden = !sacado;
    bAgregar.hidden = !el || !!sacado;
    bFoto.hidden = bAgregar.hidden;
    bGrafico.hidden = bAgregar.hidden;
    bRestaurar.hidden = !(itemActual && itemActual.h !== undefined);
    const solo = $('#soloTomado');
    const marcable = !!u && !el.matches('h2,h3,h4') && !sacado && !!solo && !solo.hidden;
    bToma.hidden = !marcable;
    if (marcable) bToma.textContent = seToma(bloqueDe(el)) ? 'Sacar de lo que se toma' : 'Marcar que se toma';
  };
  const seleccionar = (el) => {
    actual = el;
    pintarDock();
    if (el && el.classList.contains('ag-foto')) avisar('Abajo de la foto podés escribir qué muestra.');
    else if (el && el.classList.contains('w-interactivo')) avisar('Cambiá los datos cuando quieras. Quedan guardados en este navegador.');
    else if (el && el.classList.contains('ag-w')) avisar('Se puede mover y acercar como los otros gráficos.');
    else if (el && unidades.has(el) && !unidades.get(el).edita) avisar('Esto no se puede reescribir, pero sí sacar o sumarle algo abajo.');
    else avisar(AYUDA);
  };

  const prender = (el) => {
    const u = unidades.get(el);
    if (u.edita) {
      el.contentEditable = 'true';
      el.spellcheck = true;
    } else if (el.matches('pre,figure,.tabla') || el.matches(TEXTO)) {
      if (!el.hasAttribute('tabindex')) {
        el.tabIndex = 0;
        el.dataset.edTab = '1';
      }
    }
  };
  const apagar = (el) => {
    el.removeAttribute('contenteditable');
    if (el.dataset.edTab) {
      el.removeAttribute('tabindex');
      delete el.dataset.edTab;
    }
  };
  const entrar = () => {
    editando = true;
    verOriginal = false;
    document.body.classList.add('editando');
    pintar();
    unidades.forEach((u) => prender(u.el));
    $$('.agregado', hoja).forEach((a) => {
      if (a.classList.contains('ag-pieza')) prenderPieza(a);
      else a.contentEditable = 'true';
    });
    dock.hidden = false;
    // The pressed look says it is on; the name stays «Editar» for screen readers and voice control.
    bEditar.setAttribute('aria-pressed', 'true');
    seleccionar(null);
  };
  const salir = () => {
    if (sinGuardar) guardarYa();
    editando = false;
    document.body.classList.remove('editando');
    unidades.forEach((u) => apagar(u.el));
    dock.hidden = true;
    actual = null;
    bEditar.setAttribute('aria-pressed', 'false');
    bEditar.textContent = 'Editar';
    pintar();
    bEditar.focus();
  };
  bEditar.addEventListener('click', () => (editando ? salir() : entrar()));
  bListo.addEventListener('click', salir);
  bVer.addEventListener('click', () => {
    if (editando) salir();
    verOriginal = !verOriginal;
    pintar();
    bVer.focus();
  });

  // Typing
  const guardarAgregados = (clave) => {
    const it = item(clave);
    const a = $$(`.agregado[data-para="${clave}"]`, hoja)
      .map((e) => {
        const p = piezas.get(e);
        if (!p) return limpiar(e.innerHTML);
        if (p.f !== undefined) p.t = corto(e.querySelector('figcaption').textContent, 300);
        return p;
      })
      .filter(Boolean);
    if (a.length) it.a = a;
    else delete it.a;
    podar(clave);
    guardar();
    pintarAviso();
  };
  hoja.addEventListener('input', (e) => {
    if (!editando) return;
    const el = e.target.closest('[contenteditable="true"]');
    if (!el) return;
    const pz = el.closest('.ag-pieza');
    if (pz || el.classList.contains('agregado')) {
      guardarAgregados((pz || el).dataset.para);
      return;
    }
    const u = unidades.get(el);
    if (!u) return;
    const h = limpiar(el.innerHTML);
    const it = item(u.clave);
    if (h === limpiar(u.html)) delete it.h;
    else it.h = h;
    el.classList.toggle('editado', it.h !== undefined);
    podar(u.clave);
    guardar();
    pintarAviso();
    pintarDock();
    pintarToc();
  });
  // A simulator someone added tells what they typed in it (w.js checks it is a flat object of texts): it is kept with
  // the piece, so it comes back the same. Data that do not fit are not kept.
  hoja.addEventListener('w-datos', (e) => {
    const fig = e.target.closest('.ag-pieza');
    const p = fig && piezas.get(fig);
    if (!p || p.g !== 'interactivo' || !e.detail || typeof e.detail !== 'object') return;
    const c = { ...p.c, datos: e.detail };
    if (JSON.stringify(c).length > P.MAX_CFG) {
      avisar('Esos datos son demasiados para guardarlos. Si recargás la página, vuelven los de antes. Probá con menos.');
      return;
    }
    p.c = c;
    guardarAgregados(fig.dataset.para);
  });
  hoja.addEventListener('focusin', (e) => {
    if (!editando) return;
    const el = e.target.closest('.ag-pieza') || e.target.closest('[contenteditable="true"],[data-ed-tab]');
    if (el) seleccionar(el);
  });
  hoja.addEventListener('focusout', (e) => {
    const el = e.target;
    if (editando && el.classList && el.classList.contains('agregado') && !el.classList.contains('ag-pieza') && !el.textContent.trim()) {
      const k = el.dataset.para;
      el.remove();
      guardarAgregados(k);
      if (actual === el) seleccionar(null);
    }
  });
  hoja.addEventListener('keydown', (e) => {
    if (!editando) return;
    const el = e.target.closest('[contenteditable="true"]');
    if (!el) return;
    if (e.key === 'Escape') {
      el.blur();
      bListo.focus();
    }
    if (e.key === 'Enter' && el.matches('h2,h3,h4,td,th,summary *,.ag-pieza figcaption')) e.preventDefault();
  });
  // A question title is inside a summary: typing in it must not open or close the question.
  hoja.addEventListener('click', (e) => {
    if (editando && e.target.closest('summary [contenteditable="true"]')) e.preventDefault();
  });
  hoja.addEventListener('keyup', (e) => {
    if (editando && e.key === ' ' && e.target.closest('summary [contenteditable="true"]')) e.preventDefault();
  });
  hoja.addEventListener('paste', (e) => {
    if (!editando || !e.target.closest('[contenteditable="true"]')) return;
    e.preventDefault();
    const t = (e.clipboardData || window.clipboardData).getData('text/plain');
    document.execCommand('insertText', false, t);
  });
  hoja.addEventListener('drop', (e) => {
    if (editando) e.preventDefault();
  });

  // Dock actions
  const sacar = (el) => {
    const u = unidades.get(el);
    if (!u) return;
    item(u.clave).s = 1;
    guardarYa();
    grupoDe(el).forEach((g) => g.setAttribute('data-sacado', u.clave));
    pintarToc();
    pintarAviso();
    pintarDock();
    avisar('Sacado. Se puede volver a poner.');
  };
  bSacar.addEventListener('click', () => {
    if (!actual) return;
    if (actual.classList.contains('agregado')) {
      const ag = actual;
      const borrar = () => {
        const k = ag.dataset.para;
        soltar(ag);
        ag.remove();
        guardarAgregados(k);
        seleccionar(null);
      };
      // What was written is lost for good, so it asks first. An empty one goes right away.
      if (ag.textContent.trim() || ag.querySelector('img')) seguro('Se borra lo que agregaste acá. No se puede deshacer.', borrar, 'Sí, borrarlo');
      else borrar();
      return;
    }
    sacar(actual);
  });
  bBloque.addEventListener('click', () => {
    const c = actual && actual.parentElement.closest(BLOQUES);
    if (c) sacar(c);
  });
  bPoner.addEventListener('click', () => {
    const s = actual && actual.closest('[data-sacado]');
    if (!s) return;
    const k = s.dataset.sacado;
    const p = cambios.paginas[pagina];
    if (p && p[k]) delete p[k].s;
    podar(k);
    guardarYa();
    $$(`[data-sacado="${k}"]`, hoja).forEach((e) => e.removeAttribute('data-sacado'));
    pintarToc();
    pintarAviso();
    pintarDock();
    avisar('Volvió a su lugar.');
  });
  // Where something added goes: after the selected text, or after the other things added there.
  const anclaDe = (el) => {
    if (!el) return null;
    let ancla = el;
    if (ancla.classList.contains('agregado')) ancla = porClave.get(ancla.dataset.para) ? porClave.get(ancla.dataset.para).el : null;
    if (ancla && ancla.matches('td,th,figcaption')) ancla = ancla.closest('.tabla,figure') || ancla;
    return ancla && unidades.has(ancla) ? ancla : null;
  };
  bAgregar.addEventListener('click', () => {
    const ancla = anclaDe(actual);
    if (!ancla) return;
    const u = unidades.get(ancla);
    const nuevo = crearAgregado(ancla, u.clave, '');
    nuevo.focus();
    seleccionar(nuevo);
  });
  // Puts a photo or a graph after the anchor and saves right away, to know if it fit in the browser's storage.
  const ponerPieza = (ancla, p) => {
    const u = unidades.get(ancla);
    const nuevo = crearAgregado(ancla, u.clave, p);
    guardarAgregados(u.clave);
    clearTimeout(tGuardar);
    if (!guardarYa()) {
      soltar(nuevo);
      nuevo.remove();
      guardarAgregados(u.clave);
      guardarYa();
      avisar('No entra en el espacio de este navegador. Sacá alguna foto y probá de nuevo.');
      return null;
    }
    pintarAviso();
    return nuevo;
  };
  const pesoFotos = () => {
    let t = 0;
    for (const items of Object.values(cambios.paginas)) for (const it of Object.values(items)) (it.a || []).forEach((x) => (t += x && x.f ? x.f.length : 0));
    return t;
  };
  bFoto.addEventListener('click', async () => {
    const ancla = anclaDe(actual);
    if (!ancla) return;
    const f = await P.elegirArchivo();
    if (!f || !ancla.isConnected) return;
    avisar('Preparando la foto…');
    const r = await P.achicar(f);
    if (r.error) {
      avisar(r.error);
      return;
    }
    if (pesoFotos() + r.url.length > P.MAX_FOTOS) {
      avisar('Ya hay muchas fotos en esta materia. Sacá alguna para sumar otra.');
      return;
    }
    const nuevo = ponerPieza(ancla, { f: r.url, t: '' });
    if (!nuevo) return;
    nuevo.querySelector('figcaption').focus();
    seleccionar(nuevo);
  });
  bGrafico.addEventListener('click', async () => {
    const ancla = anclaDe(actual);
    if (!ancla) return;
    avisar('Buscando los gráficos de esta materia…');
    let p = null;
    try {
      p = await P.elegirGrafico('figuras.json', materia, () => avisar(AYUDA));
    } catch {
      avisar('No se pudieron cargar los gráficos. Probá recargar la página.');
      return;
    }
    avisar(AYUDA);
    if (!p || !ancla.isConnected) return;
    const nuevo = ponerPieza(ancla, p);
    if (!nuevo) return;
    nuevo.focus();
    seleccionar(nuevo);
    nuevo.scrollIntoView({ block: 'nearest' });
  });
  bRestaurar.addEventListener('click', () => {
    const u = actual && unidades.get(actual);
    if (!u) return;
    seguro('Se pierde lo que cambiaste en esta parte.', () => {
      const p = cambios.paginas[pagina];
      if (p && p[u.clave]) delete p[u.clave].h;
      podar(u.clave);
      guardarYa();
      u.el.innerHTML = u.html;
      u.el.classList.remove('editado');
      pintarToc();
      pintarAviso();
      pintarDock();
      avisar('Quedó como el original.');
    }, 'Sí, volver al original');
  });

  bToma.addEventListener('click', () => {
    const u = actual && unidades.get(actual);
    if (!u) return;
    const top = bloqueDe(actual);
    const estaba = seToma(top);
    const natural = top.matches(NATURAL);
    const p = cambios.paginas[pagina];
    unidades.forEach((o) => {
      if (top.contains(o.el) && p && p[o.clave]) {
        delete p[o.clave].t;
        podar(o.clave);
      }
    });
    if (estaba && natural) item(u.clave).t = 0;
    if (!estaba && !natural) item(u.clave).t = 1;
    guardarYa();
    pintarMarcas();
    pintarAviso();
    pintarDock();
    avisar(estaba ? 'Ya no aparece en «Solo lo que se toma».' : 'Ahora aparece en «Solo lo que se toma».');
  });

  // ----- Dialogs
  let nDialogo = 0;
  const dialogo = (armar) => {
    const d = document.createElement('dialog');
    d.className = 'dlg';
    armar(d);
    // Its title names it for screen readers.
    const h = d.querySelector('h2');
    if (h) {
      nDialogo += 1;
      h.id = h.id || `edDlg${nDialogo}`;
      d.setAttribute('aria-labelledby', h.id);
    }
    d.addEventListener('close', () => d.remove());
    document.body.append(d);
    d.showModal();
    return d;
  };
  const parrafo = (t, clase) => {
    const p = document.createElement('p');
    if (clase) p.className = clase;
    p.textContent = t;
    return p;
  };
  const titulo = (t) => {
    const h = document.createElement('h2');
    h.textContent = t;
    return h;
  };
  const fila = (...hijos) => {
    const f = document.createElement('div');
    f.className = 'dlg-botones';
    f.append(...hijos);
    return f;
  };
  // The focus starts on «No», so a quick Enter does not erase anything.
  const seguro = (texto, accion, siTexto = 'Sí, borrarlos') =>
    dialogo((d) => {
      const si = boton(siTexto, 'b-pri');
      const no = boton('No', 'b-sec');
      no.autofocus = true;
      si.addEventListener('click', () => {
        d.close();
        accion();
      });
      no.addEventListener('click', () => d.close());
      d.append(titulo('¿Seguro?'), parrafo(texto), fila(si, no));
    });

  // ----- Sharing: everything goes inside the link fragment, which browsers never send to a server.
  const aB64 = (bytes) => {
    let s = '';
    for (let i = 0; i < bytes.length; i += 8192) s += String.fromCharCode(...bytes.subarray(i, i + 8192));
    return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  };
  const deB64 = (t) => {
    const s = atob(t.replace(/-/g, '+').replace(/_/g, '/'));
    const b = new Uint8Array(s.length);
    for (let i = 0; i < s.length; i++) b[i] = s.charCodeAt(i);
    return b;
  };
  const leerTodo = async (stream) => {
    const r = stream.getReader();
    const trozos = [];
    let total = 0;
    for (;;) {
      const { done, value } = await r.read();
      if (done) break;
      total += value.length;
      if (total > MAX_BYTES) {
        await r.cancel();
        throw new Error('Demasiado grande');
      }
      trozos.push(value);
    }
    const out = new Uint8Array(total);
    let i = 0;
    trozos.forEach((t) => {
      out.set(t, i);
      i += t.length;
    });
    return out;
  };
  const empaquetar = async (d) => {
    const crudo = new TextEncoder().encode(JSON.stringify(d));
    if (typeof CompressionStream === 'undefined') return `u.${aB64(crudo)}`;
    const s = new Blob([crudo]).stream().pipeThrough(new CompressionStream('deflate-raw'));
    return `d.${aB64(await leerTodo(s))}`;
  };
  const desempaquetar = async (t) => {
    if (t.length > MAX_BYTES) throw new Error('Demasiado grande');
    const [modo, datos] = [t.slice(0, 1), t.slice(2)];
    let bytes = deB64(datos);
    if (modo === 'd') bytes = await leerTodo(new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate-raw')));
    else if (modo !== 'u') throw new Error('Formato desconocido');
    return validar(JSON.parse(new TextDecoder().decode(bytes)));
  };
  const hayCambios = (d) => contar(d).n > 0;
  const sumar = (a, b) => {
    for (const [p, items] of Object.entries(b.paginas)) {
      a.paginas[p] = a.paginas[p] || Object.create(null);
      for (const [k, it] of Object.entries(items)) {
        const m = a.paginas[p][k] || (a.paginas[p][k] = {});
        if (it.h !== undefined) m.h = it.h;
        if (it.s) m.s = 1;
        if (it.t !== undefined) m.t = it.t;
        if (it.a) {
          const ya = new Set();
          m.a = [...(m.a || []), ...it.a].filter((x) => {
            const k = typeof x === 'string' ? x : JSON.stringify(x);
            if (ya.has(k)) return false;
            ya.add(k);
            return true;
          });
        }
      }
    }
    a.nombre = b.nombre || a.nombre;
    return a;
  };
  const describir = (d) => {
    const { n, paginas } = contar(d);
    return `${n === 1 ? '1 cambio' : `${n} cambios`} en ${paginas === 1 ? '1 página' : `${paginas} páginas`}`;
  };
  const recibir = (nuevos) => {
    dialogo((d) => {
      const tengo = hayCambios(cambios);
      const aplicar = (fn) => () => {
        cambios = fn();
        guardarYa();
        d.close();
        verOriginal = false;
        pintar();
      };
      const botones = [];
      if (tengo) {
        const reemplazar = boton('Reemplazar los míos', 'b-sec');
        const juntar = boton('Sumarlos a los míos', 'b-pri');
        reemplazar.addEventListener('click', aplicar(() => nuevos));
        juntar.addEventListener('click', aplicar(() => sumar(cambios, nuevos)));
        botones.push(juntar, reemplazar);
      } else {
        const ver = boton('Ver los cambios', 'b-pri');
        ver.addEventListener('click', aplicar(() => nuevos));
        botones.push(ver);
      }
      const no = boton('Ahora no', 'b-sec');
      no.addEventListener('click', () => d.close());
      botones.push(no);
      const nombre = nuevos.nombre ? `«${nuevos.nombre}»: ` : '';
      d.append(
        titulo('Te pasaron cambios para este resumen'),
        parrafo(`${nombre}${describir(nuevos)}.`),
        parrafo('Los escribió quien te los mandó y nadie los revisó, así que no son palabra de la cátedra. Se guardan solo en este navegador y siempre vas a poder ver el original.'),
        fila(...botones),
      );
    });
  };
  const noPudo = (t) =>
    dialogo((d) => {
      const ok = boton('Entendido', 'b-pri');
      ok.addEventListener('click', () => d.close());
      d.append(titulo('No se pudieron cargar los cambios'), parrafo(t), fila(ok));
    });

  bCompartir.addEventListener('click', () => {
    if (sinGuardar) guardarYa();
    dialogo((d) => {
      const { n } = contar();
      const salida = parrafo('', 'dlg-estado');
      salida.setAttribute('aria-live', 'polite');
      const etiqueta = document.createElement('label');
      etiqueta.className = 'dlg-campo';
      etiqueta.textContent = 'Nombre de esta versión (opcional)';
      const nombre = document.createElement('input');
      nombre.type = 'text';
      nombre.maxLength = 60;
      nombre.placeholder = 'Por ejemplo: Comisión 302';
      nombre.value = cambios.nombre;
      etiqueta.append(nombre);
      nombre.addEventListener('input', () => {
        cambios.nombre = nombre.value.trim();
        guardar();
        pintarAviso();
      });
      const bLink = boton('Copiar link', 'b-pri');
      const bArchivo = boton('Bajar archivo', 'b-sec');
      bLink.disabled = !n;
      bArchivo.disabled = !n;
      bLink.addEventListener('click', async () => {
        let url;
        try {
          url = `${location.href.split('#')[0].replace(/[^/]*$/, 'index.html')}#cambios=${await empaquetar(cambios)}`;
        } catch {
          salida.textContent = 'Es muy largo para un link. Bajá el archivo.';
          return;
        }
        let copiado = true;
        try {
          await navigator.clipboard.writeText(url);
        } catch {
          copiado = false;
        }
        if (!copiado) {
          salida.textContent = 'No se pudo copiar solo. Copialo de acá.';
          // One field, reused if the copy fails again.
          let campo = salida.nextElementSibling;
          if (!campo || !campo.classList.contains('dlg-link')) {
            campo = document.createElement('input');
            campo.readOnly = true;
            campo.className = 'dlg-link';
            campo.setAttribute('aria-label', 'Link con tus cambios');
            salida.after(campo);
          }
          campo.value = url;
          campo.select();
          return;
        }
        salida.textContent = url.length > LINK_LARGO ? 'Link copiado, pero es muy largo y algunas apps lo cortan. Si no se abre, mandá el archivo.' : 'Link copiado. Quien lo abra elige si quiere ver los cambios.';
      });
      bArchivo.addEventListener('click', () => {
        const a = document.createElement('a');
        a.href = URL.createObjectURL(new Blob([JSON.stringify(cambios)], { type: 'application/json' }));
        a.download = `cambios-${materia}.json`;
        a.click();
        setTimeout(() => URL.revokeObjectURL(a.href), 2000);
        salida.textContent = 'Archivo listo. Quien lo reciba lo carga con «Cargar un archivo».';
      });
      const bCargar = boton('Cargar un archivo', 'b-sec');
      const archivo = document.createElement('input');
      archivo.type = 'file';
      archivo.accept = '.json,application/json';
      archivo.hidden = true;
      bCargar.addEventListener('click', () => archivo.click());
      archivo.addEventListener('change', async () => {
        const f = archivo.files[0];
        if (!f) return;
        let nuevos = null;
        try {
          if (f.size > MAX_BYTES) throw new Error('Demasiado grande');
          nuevos = validar(JSON.parse(await f.text()));
        } catch {
          nuevos = null;
        }
        d.close();
        if (nuevos && hayCambios(nuevos)) recibir(nuevos);
        else noPudo('Ese archivo no trae cambios de este resumen.');
      });
      const bBorrar = boton('Borrar todos mis cambios', 'b-peligro');
      bBorrar.disabled = !n;
      bBorrar.addEventListener('click', () => {
        d.close();
        seguro('Se borran todos tus cambios de esta materia, en todas sus páginas.', () => {
          cambios = vacio();
          guardarYa();
          pintar();
          if (editando) {
            salir();
            entrar();
          }
        });
      });
      const bCerrar = boton('Cerrar', 'b-sec');
      bCerrar.addEventListener('click', () => d.close());
      d.append(
        titulo('Compartir tus cambios'),
        parrafo(n ? `Se comparten tus ${n === 1 ? '1 cambio' : `${n} cambios`} de toda la materia, como están ahora. Si después cambiás algo, hay que mandar de nuevo el link o el archivo.` : 'Todavía no hiciste cambios. Si te pasaron un archivo, cargalo acá.'),
        etiqueta,
        fila(bLink, bArchivo),
        salida,
        fila(bCargar, archivo, bBorrar, bCerrar),
      );
    });
  });

  // ----- Arriving from a shared link
  const leerLink = async () => {
    const m = /^#cambios=([A-Za-z0-9._-]+)$/.exec(location.hash);
    if (!location.hash.startsWith('#cambios=')) return;
    history.replaceState(null, '', location.pathname + location.search);
    let nuevos = null;
    try {
      if (m) nuevos = await desempaquetar(m[1]);
    } catch {
      nuevos = null;
    }
    if (nuevos && hayCambios(nuevos)) recibir(nuevos);
    else noPudo('Este link está incompleto o cortado. Pedile a quien te lo pasó el archivo con los cambios.');
  };

  pintar();
  leerLink();
})();
