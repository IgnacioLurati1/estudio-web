// Summary maker (crear.html): a notebook sheet with titles, formatted text, boxed notes, formulas, photos and the
// subject's graphs and simulators, with tags on top and a comment in the margin of any part. It lives only in this
// browser until it is downloaded, shared by link or taken to the bank's upload form, as an HTML file the bank's cleaning
// keeps whole: headings, paragraphs, lists, b/i/u/mark, asides, classes, a <style> sheet of its own and images as data
// URLs. Graphs and simulators go out as pictures of how they look.
(() => {
  const P = window.UTN_PIEZAS;
  const $ = (id) => document.getElementById(id);
  // Read while the script runs: KaTeX sits next to it, in the assets folder.
  const KATEX = new URL('katex/', document.currentScript?.src || location.href).href;
  const raiz = $('crTodo');
  if (!raiz || !P) return;

  const CLAVE = 'utn:crear';
  const MAX_BLOQUES = 200;
  // Of a text's stored markup, and of a margin comment.
  const MAX_TEXTO = 40000;
  const MAX_MARGEN = 600;
  const MAX_ETIQUETAS = 8;
  const MAX_FORMULA = 1000;
  const MAX_HTML = 4900000;
  const NOTAS = { ojo: 'Ojo', definicion: 'Definición', formula: 'Fórmula', ejemplo: 'Ejemplo', recordar: 'Para recordar' };
  // Index = the part's «e»: the space before it.
  const ESPACIOS = ['Pegado', 'Espacio normal', 'Más aire'];
  const sMateria = $('crMateria');
  const sTitulo = $('crTitulo');
  const hoja = $('crHoja');
  const vacio = $('crVacio');
  const salida = $('crSalida');
  const donde = $('crDonde');
  const indiceNav = $('crIndice').closest('nav');
  const indiceLista = $('crIndice');
  const chips = $('crChips');
  const iEtiqueta = $('crEtiqueta');

  const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const sinControl = (s) => s.replace(/[\u0000-\u0008\u000b-\u001f\u007f]/g, '');

  // ----- Formatted text. Only these tags, without attributes, ever reach the page, storage or the file. Whatever arrives
  // (storage, the editor's own markup, an old summary) is read in an inert document and rebuilt from scratch as a tree:
  // a list of { t: 'p' | 'ul' | 'ol', h } blocks, li items, and inline strings, { t: 'b' | 'i' | 'u' | 'mark', h } and
  // { t: 'br' }. It goes back to the page with createElement and text nodes, never as markup.
  const EN_LINEA = { B: 'b', STRONG: 'b', I: 'i', EM: 'i', U: 'u', MARK: 'mark' };
  // The highlighter in green or light blue is a mark with one of these classes, the only attribute that ever passes.
  const RESALTADORES = new Set(['r-verde', 'r-celeste']);
  const LISTAS = { UL: 'ul', OL: 'ol' };
  const BLOQUE = /^(P|DIV|H[1-6]|BLOCKQUOTE|SECTION|ARTICLE|PRE|HEADER|FOOTER|ASIDE|MAIN|FIGURE|TABLE|TBODY|TR|TD|TH)$/;
  const SIN = new Set(['SCRIPT', 'STYLE', 'TEMPLATE', 'NOSCRIPT', 'IFRAME', 'OBJECT', 'EMBED', 'SVG', 'MATH', 'TEXTAREA', 'SELECT', 'BUTTON', 'TITLE', 'CANVAS', 'VIDEO', 'AUDIO']);
  const leerLinea = (n, out) => {
    for (const c of n.childNodes) {
      if (c.nodeType === 3) {
        const s = sinControl(c.data);
        if (s) out.push(s);
      } else if (c.nodeType !== 1 || SIN.has(c.tagName)) continue;
      else if (c.tagName === 'BR') out.push({ t: 'br' });
      else if (EN_LINEA[c.tagName]) {
        const h = [];
        leerLinea(c, h);
        if (!h.length) continue;
        const x = { t: EN_LINEA[c.tagName], h };
        if (x.t === 'mark' && RESALTADORES.has(c.getAttribute('class'))) x.c = c.getAttribute('class');
        out.push(x);
      } else leerLinea(c, out);
    }
    return out;
  };
  const leerBloques = (raizNodo) => {
    const out = [];
    let linea = null;
    const cerrar = () => {
      if (linea && linea.h.length) out.push(linea);
      linea = null;
    };
    const recorrer = (n) => {
      for (const c of n.childNodes) {
        if (c.nodeType === 1 && SIN.has(c.tagName)) continue;
        if (c.nodeType === 1 && LISTAS[c.tagName]) {
          cerrar();
          const items = [...c.children].filter((li) => li.tagName === 'LI').map((li) => ({ t: 'li', h: leerLinea(li, []) })).filter((li) => li.h.length);
          if (items.length) out.push({ t: LISTAS[c.tagName], h: items });
        } else if (c.nodeType === 1 && BLOQUE.test(c.tagName)) {
          cerrar();
          if ([...c.children].some((x) => LISTAS[x.tagName] || BLOQUE.test(x.tagName))) recorrer(c);
          else out.push({ t: 'p', h: leerLinea(c, []) });
        } else {
          if (!linea) linea = { t: 'p', h: [] };
          const wrap = document.createElement('span');
          wrap.append(c.cloneNode(true));
          leerLinea(wrap, linea.h);
        }
      }
    };
    recorrer(raizNodo);
    cerrar();
    return out;
  };
  const leerHtml = (x) => (typeof x === 'string' && x ? leerBloques(new DOMParser().parseFromString(x.slice(0, MAX_TEXTO * 2), 'text/html').body) : []);
  const aHtml = (lista) => lista.map((x) => (typeof x === 'string' ? esc(x) : x.t === 'br' ? '<br>' : `<${x.t}${x.c ? ` class="${x.c}"` : ''}>${aHtml(x.h)}</${x.t}>`)).join('');
  const aDom = (lista, padre) => {
    for (const x of lista) {
      if (typeof x === 'string') padre.append(x);
      else {
        const e = document.createElement(x.t);
        if (x.c) e.className = x.c;
        if (x.h) aDom(x.h, e);
        padre.append(e);
      }
    }
    return padre;
  };
  const conTexto = (lista) => lista.some((x) => (typeof x === 'string' ? x.trim() : x.h && conTexto(x.h)));
  // Summaries made before formatting: blank lines split paragraphs and «- » lines are a list.
  const deTexto = (t) =>
    t
      .split(/\n\s*\n/)
      .map((p) => p.trim())
      .filter(Boolean)
      .map((p) => {
        const lineas = p.split('\n');
        if (lineas.every((l) => /^\s*[-•]\s+/.test(l))) return { t: 'ul', h: lineas.map((l) => ({ t: 'li', h: [l.replace(/^\s*[-•]\s+/, '')] })) };
        return { t: 'p', h: lineas.flatMap((l, i) => (i ? [{ t: 'br' }, l] : [l])) };
      });

  // ----- State. Whatever comes from storage is checked again.
  const nuevo = () => ({ v: 1, materia: '', titulo: '', etiquetas: [], bloques: [] });
  const HEX = /^#[0-9a-f]{6}$/i;
  const COLORES_BASE = { fondo: '#e7ecf3', hoja: '#ffffff' };
  // Relative luminance (WCAG): a sheet darker than this reads better with light ink.
  const luz = (hex) => {
    const [r, g, b] = [1, 3, 5].map((i) => {
      const v = parseInt(hex.slice(i, i + 2), 16) / 255;
      return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };
  const esOscura = (hex) => luz(hex) < 0.179;
  const esMedia = (hex) => luz(hex) > 0.09 && luz(hex) < 0.4;
  const espacio = (e) => (e === 0 || e === 2 ? e : 1);
  const margen = (m) => (typeof m === 'string' && m.trim() ? sinControl(m).slice(0, MAX_MARGEN) : '');
  const rico = (b) => {
    const x = typeof b.x === 'string' ? aHtml(leerHtml(b.x)) : typeof b.t === 'string' ? aHtml(deTexto(sinControl(b.t))) : '';
    return x.length <= MAX_TEXTO ? x : '';
  };
  const validar = (d) => {
    if (!d || typeof d !== 'object' || d.v !== 1 || !Array.isArray(d.bloques)) return nuevo();
    const out = nuevo();
    out.materia = typeof d.materia === 'string' && /^[a-z0-9-]{1,80}$/.test(d.materia) ? d.materia : '';
    out.titulo = P.corto(d.titulo, 120);
    if (Array.isArray(d.etiquetas)) out.etiquetas = [...new Set(d.etiquetas.map((t) => P.corto(t, 30)).filter(Boolean))].slice(0, MAX_ETIQUETAS);
    if (d.colores && typeof d.colores === 'object' && HEX.test(d.colores.fondo) && HEX.test(d.colores.hoja)) out.colores = { fondo: d.colores.fondo.toLowerCase(), hoja: d.colores.hoja.toLowerCase() };
    for (const b of d.bloques.slice(0, MAX_BLOQUES)) {
      if (!b || typeof b !== 'object') continue;
      let v = null;
      if (b.k === 'h') v = { k: 'h', t: P.corto(b.t, 200), n: b.n === 3 ? 3 : 2 };
      else if (b.k === 'p') v = { k: 'p', x: rico(b) };
      else if (b.k === 'n') v = { k: 'n', tipo: Object.hasOwn(NOTAS, b.tipo) ? b.tipo : 'ojo', x: rico(b) };
      else if (b.k === 'm') v = { k: 'm', t: typeof b.t === 'string' ? sinControl(b.t).slice(0, MAX_FORMULA) : '' };
      else if (b.k === 'o') {
        const o = P.objeto(b.o);
        if (o) v = { k: 'o', o };
      }
      if (!v) continue;
      if (espacio(b.e) !== 1) v.e = espacio(b.e);
      const m = margen(b.m);
      if (m) v.m = m;
      out.bloques.push(v);
    }
    return out;
  };
  let doc;
  try {
    doc = validar(JSON.parse(localStorage.getItem(CLAVE)));
  } catch {
    doc = nuevo();
  }
  // The status line stays in the page, hidden only to the eye while empty: a reader announces what changes inside a
  // live region that already exists, not one that shows up with its text.
  const decir = (t, error) => {
    salida.textContent = t;
    salida.classList.toggle('vh', !t);
    if (error) salida.dataset.error = '1';
    else salida.removeAttribute('data-error');
  };
  // A simple «¿Seguro?», with the site's dialog. Closing it puts the focus back where it was.
  const preguntar = (texto, siTexto, alSi, alNo) => {
    const d = crear('dialog', 'dlg');
    const h = crear('h2', '', '¿Seguro?');
    h.id = 'crPreguntaTitulo';
    d.setAttribute('aria-labelledby', h.id);
    const si = boton(siTexto, 'b-pri');
    const no = boton('No', 'b-sec');
    // The focus starts on «No», so a quick Enter does not erase anything.
    no.autofocus = true;
    const f = crear('div', 'dlg-botones');
    f.append(si, no);
    si.addEventListener('click', () => {
      d.close();
      alSi();
    });
    no.addEventListener('click', () => {
      d.close();
      alNo?.();
    });
    d.addEventListener('close', () => d.remove());
    d.append(h, crear('p', '', texto), f);
    document.body.append(d);
    d.showModal();
  };
  const tieneAlgo = (b) => Boolean(b.m) || (b.k === 'h' || b.k === 'm' ? Boolean(b.t.trim()) : b.k === 'o' || conTexto(leerHtml(b.x)));
  const guardarYa = () => {
    try {
      localStorage.setItem(CLAVE, JSON.stringify(doc));
      return true;
    } catch {
      decir('No entra en el espacio de este navegador. Sacá alguna foto.', true);
      return false;
    }
  };
  let tGuardar = 0;
  const guardar = () => {
    clearTimeout(tGuardar);
    tGuardar = setTimeout(guardarYa, 300);
  };
  addEventListener('pagehide', () => {
    clearTimeout(tGuardar);
    guardarYa();
  });

  // ----- Little builders
  const crear = (tag, clase, texto) => {
    const e = document.createElement(tag);
    if (clase) e.className = clase;
    if (texto !== undefined) e.textContent = texto;
    return e;
  };
  const boton = (texto, clase, etiqueta) => {
    const b = crear('button', clase, texto);
    b.type = 'button';
    if (etiqueta) b.setAttribute('aria-label', etiqueta);
    return b;
  };
  const elegir = (etiqueta, opciones, valor) => {
    const s = crear('select', 'cr-elegir');
    s.setAttribute('aria-label', etiqueta);
    for (const [v, t] of opciones) {
      const o = crear('option', '', t);
      o.value = String(v);
      o.selected = String(v) === String(valor);
      s.append(o);
    }
    return s;
  };

  // ----- Formulas, written as LaTeX and drawn by the site's own KaTeX as MathML, which needs no fonts. The file carries
  // the MathML and, under it, the same LaTeX: the bank's cleaning takes MathML out and the bank draws the LaTeX again.
  let katexListo = null;
  const conKatex = () => {
    katexListo ??= new Promise((listo, falla) => {
      const s = document.createElement('script');
      s.src = `${KATEX}katex.min.js`;
      s.addEventListener('load', () => (window.katex ? listo(window.katex) : falla(new Error('sin katex'))));
      s.addEventListener('error', () => falla(new Error('no cargó katex')));
      document.head.append(s);
    }).catch((e) => {
      katexListo = null;
      throw e;
    });
    return katexListo;
  };
  const OPCIONES_TEX = { displayMode: true, output: 'mathml', throwOnError: true, trust: false, strict: 'ignore', maxSize: 20, maxExpand: 300 };
  // The file writes each formula between \[ and \]: one of those inside would cut it short in the bank.
  const fallaFormula = (t) => (/\\\[|\\\]|\$\$/.test(t) ? 'Sacá el \\[, el \\] o el $$ de la fórmula. Acá no hacen falta.' : '');
  // A «|» marks where the cursor goes; what was selected goes there too.
  const PLANTILLAS = [
    ['Fracción', '\\frac{|}{}'],
    ['Raíz', '\\sqrt{|}'],
    ['Potencia', '^{|}'],
    ['Subíndice', '_{|}'],
    ['Integral', '\\int_{|}^{} \\, dx'],
    ['Sumatoria', '\\sum_{|}^{}'],
    ['Límite', '\\lim_{x \\to |}'],
    ['Infinito', '\\infty '],
  ];
  const SIMBOLOS = [
    ['α', 'alfa', '\\alpha '], ['β', 'beta', '\\beta '], ['γ', 'gamma', '\\gamma '], ['δ', 'delta', '\\delta '], ['Δ', 'delta mayúscula', '\\Delta '],
    ['ε', 'épsilon', '\\varepsilon '], ['θ', 'theta', '\\theta '], ['λ', 'lambda', '\\lambda '], ['μ', 'mu', '\\mu '], ['π', 'pi', '\\pi '],
    ['ρ', 'rho', '\\rho '], ['σ', 'sigma', '\\sigma '], ['ω', 'omega', '\\omega '], ['≤', 'menor o igual', '\\leq '], ['≥', 'mayor o igual', '\\geq '],
    ['≠', 'distinto', '\\neq '], ['≈', 'aproximado', '\\approx '], ['±', 'más o menos', '\\pm '], ['·', 'producto punto', '\\cdot '], ['×', 'por (cruz)', '\\times '],
    ['→', 'tiende a', '\\to '], ['⇒', 'implica', '\\Rightarrow '], ['∈', 'pertenece', '\\in '], ['∂', 'derivada parcial', '\\partial '], ['∇', 'nabla', '\\nabla '],
  ];
  // False when it doesn't fit: the formula is at its maximum.
  const meter = (campo, plantilla) => {
    const i = plantilla.indexOf('|');
    const texto = plantilla.replace('|', '');
    const a = campo.selectionStart ?? campo.value.length;
    const z = campo.selectionEnd ?? a;
    const elegido = campo.value.slice(a, z);
    const nuevo = i >= 0 ? texto.slice(0, i) + elegido + texto.slice(i) : texto;
    if (campo.value.length - (z - a) + nuevo.length > MAX_FORMULA) return false;
    campo.focus();
    campo.setRangeText(nuevo, a, z, 'end');
    if (i >= 0) {
      // With something selected, it goes in the first slot and the cursor moves on to the next one, if there is one.
      const siguiente = elegido ? texto.indexOf('{}', i) : -1;
      const cursor = a + (siguiente >= 0 ? siguiente + 1 + elegido.length : i + elegido.length);
      campo.setSelectionRange(cursor, cursor);
    }
    campo.dispatchEvent(new Event('input', { bubbles: true }));
    return true;
  };
  const editorFormula = (b) => {
    const id = `crFormula${(cuentaFormulas += 1)}`;
    const paleta = crear('div', 'cr-formato cr-paleta');
    paleta.setAttribute('role', 'group');
    paleta.setAttribute('aria-label', 'Partes de la fórmula');
    const campo = crear('textarea', 'cr-formula-campo');
    campo.id = id;
    campo.rows = 2;
    campo.maxLength = MAX_FORMULA;
    campo.spellcheck = false;
    campo.autocomplete = 'off';
    campo.setAttribute('autocapitalize', 'off');
    campo.setAttribute('aria-label', 'Fórmula, como en LaTeX');
    campo.placeholder = '\\frac{a}{b} + \\sqrt{x^2 + 1}';
    campo.value = b.t;
    const error = crear('p', 'cr-formula-error');
    error.id = `${id}Error`;
    error.setAttribute('aria-live', 'polite');
    const sumarPieza = (plantilla) => {
      if (!meter(campo, plantilla)) error.textContent = `La fórmula llegó al máximo de ${MAX_FORMULA} caracteres.`;
    };
    // A press keeps the cursor in the formula, so each piece goes where it was.
    const sinRobarFoco = (bt) => bt.addEventListener('mousedown', (e) => e.preventDefault());
    for (const [nombre, plantilla] of PLANTILLAS) {
      const bt = boton(nombre, 'b-sec b-chico');
      sinRobarFoco(bt);
      bt.addEventListener('click', () => sumarPieza(plantilla));
      paleta.append(bt);
    }
    // The symbols open as a set of buttons under the bar: a select would put one in with each arrow key.
    const simbolos = crear('div', 'cr-simbolos');
    simbolos.id = `${id}Simbolos`;
    simbolos.setAttribute('role', 'group');
    simbolos.setAttribute('aria-label', 'Símbolos');
    simbolos.hidden = true;
    const bSimbolos = boton('Símbolos', 'b-sec b-chico');
    bSimbolos.setAttribute('aria-expanded', 'false');
    bSimbolos.setAttribute('aria-controls', simbolos.id);
    sinRobarFoco(bSimbolos);
    const abrirSimbolos = (si) => {
      simbolos.hidden = !si;
      bSimbolos.setAttribute('aria-expanded', String(si));
    };
    bSimbolos.addEventListener('click', () => abrirSimbolos(simbolos.hidden));
    for (const [signo, nombre, tex] of SIMBOLOS) {
      const bt = boton(signo, 'b-sec b-chico cr-simbolo', nombre);
      bt.title = nombre;
      sinRobarFoco(bt);
      bt.addEventListener('click', () => sumarPieza(tex));
      simbolos.append(bt);
    }
    simbolos.addEventListener('keydown', (e) => {
      if (e.key !== 'Escape') return;
      e.preventDefault();
      e.stopPropagation();
      abrirSimbolos(false);
      bSimbolos.focus();
    });
    paleta.append(bSimbolos);
    const vista = crear('div', 'cr-formula-vista');
    vista.setAttribute('aria-hidden', 'true');
    const ayuda = crear('p', 'c-ayuda cr-formula-ayuda', 'Se escribe como en LaTeX. Con los botones de arriba sumás fracciones, raíces, integrales y símbolos.');
    ayuda.id = `${id}Ayuda`;
    campo.setAttribute('aria-describedby', ayuda.id);
    let t = 0;
    const dibujar = async () => {
      const tex = campo.value.trim();
      const marcar = (mensaje) => {
        error.textContent = mensaje;
        if (mensaje) campo.setAttribute('aria-invalid', 'true');
        else campo.removeAttribute('aria-invalid');
        campo.setAttribute('aria-describedby', mensaje ? `${error.id} ${ayuda.id}` : ayuda.id);
      };
      if (!tex) {
        vista.replaceChildren();
        marcar('');
        return;
      }
      const problema = fallaFormula(tex);
      if (problema) {
        vista.replaceChildren();
        marcar(problema);
        return;
      }
      try {
        const k = await conKatex();
        if (campo.value.trim() !== tex) return;
        k.render(tex, vista, OPCIONES_TEX);
        marcar('');
      } catch {
        vista.replaceChildren();
        marcar(window.katex ? 'Esa fórmula no se entiende. Fijate que cada llave que abrís se cierre.' : 'No se pudo dibujar la fórmula. Igual queda guardada.');
      }
    };
    campo.addEventListener('input', () => {
      b.t = campo.value.slice(0, MAX_FORMULA);
      guardar();
      clearTimeout(t);
      t = setTimeout(dibujar, 180);
    });
    dibujar();
    return [paleta, simbolos, campo, vista, error, ayuda];
  };
  let cuentaFormulas = 0;

  // ----- The editor of a text or a box. Enter makes a paragraph; a paste comes in as plain text.
  try {
    document.execCommand('styleWithCSS', false, false);
    document.execCommand('defaultParagraphSeparator', false, 'p');
  } catch {
    /* Older browsers keep their defaults, and the cleaning above reads them too. */
  }
  const FORMATOS = [
    { id: 'bold', texto: 'Negrita', clase: 'cr-f-b', atajo: 'Control+B' },
    { id: 'italic', texto: 'Cursiva', clase: 'cr-f-i', atajo: 'Control+I' },
    { id: 'underline', texto: 'Subrayado', clase: 'cr-f-u', atajo: 'Control+U' },
    { id: 'mark', texto: 'Resaltar', clase: 'cr-f-m', etiqueta: 'Resaltar en amarillo', color: '' },
    { id: 'mark', texto: 'Verde', clase: 'cr-f-m cr-f-verde', etiqueta: 'Resaltar en verde', color: 'r-verde' },
    { id: 'mark', texto: 'Celeste', clase: 'cr-f-m cr-f-celeste', etiqueta: 'Resaltar en celeste', color: 'r-celeste' },
    { id: 'insertUnorderedList', texto: 'Lista' },
    { id: 'insertOrderedList', texto: 'Lista numerada' },
  ];
  const marcaDe = (n, ed) => {
    const e = n && (n.nodeType === 1 ? n : n.parentElement);
    const m = e && e.closest('mark');
    return m && ed.contains(m) ? m : null;
  };
  // The highlighter takes the selection. On highlighted text, the same colour takes it off and another one changes it.
  const colorDe = (m) => (RESALTADORES.has(m.getAttribute('class')) ? m.getAttribute('class') : '');
  const resaltar = (ed, color) => {
    const sel = getSelection();
    if (!sel.rangeCount) return;
    const r = sel.getRangeAt(0);
    if (!ed.contains(r.commonAncestorContainer)) return;
    const m = marcaDe(r.startContainer, ed) || marcaDe(r.endContainer, ed);
    if (m && colorDe(m) === color) m.replaceWith(...m.childNodes);
    else if (m) {
      if (color) m.className = color;
      else m.removeAttribute('class');
    } else if (!r.collapsed) {
      const mk = document.createElement('mark');
      if (color) mk.className = color;
      mk.append(r.extractContents());
      mk.querySelectorAll('mark').forEach((x) => x.replaceWith(...x.childNodes));
      r.insertNode(mk);
      const nr = document.createRange();
      nr.selectNodeContents(mk);
      sel.removeAllRanges();
      sel.addRange(nr);
    }
    ed.dispatchEvent(new Event('input', { bubbles: true }));
  };
  const estados = (barra, ed) => {
    const sel = getSelection();
    const nodo = sel.rangeCount ? sel.getRangeAt(0).startContainer : null;
    barra.querySelectorAll('button[data-f]').forEach((bt) => {
      let on = false;
      try {
        const m = bt.dataset.f === 'mark' ? marcaDe(nodo, ed) : null;
        on = bt.dataset.f === 'mark' ? Boolean(m) && colorDe(m) === bt.dataset.color : document.queryCommandState(bt.dataset.f);
      } catch {
        on = false;
      }
      bt.setAttribute('aria-pressed', String(on));
    });
  };
  const ultimos = new WeakMap();
  const barraDe = new WeakMap();
  document.addEventListener('selectionchange', () => {
    const sel = getSelection();
    if (!sel.rangeCount) return;
    const r = sel.getRangeAt(0);
    const n = r.startContainer.nodeType === 1 ? r.startContainer : r.startContainer.parentElement;
    const ed = n && n.closest('.cr-texto');
    if (!ed || !hoja.contains(ed)) return;
    ultimos.set(ed, r.cloneRange());
    const barra = barraDe.get(ed);
    if (barra) estados(barra, ed);
  });
  const editor = (b, etiqueta, ph, avisar) => {
    const ed = crear('div', 'cr-texto');
    ed.contentEditable = 'true';
    ed.setAttribute('role', 'textbox');
    ed.setAttribute('aria-multiline', 'true');
    ed.setAttribute('aria-label', etiqueta);
    ed.dataset.ph = ph;
    aDom(leerHtml(b.x), ed);
    const pintarVacioTexto = () => ed.classList.toggle('cr-vacio', !ed.textContent.trim() && !ed.querySelector('li'));
    pintarVacioTexto();
    ed.addEventListener('input', () => {
      pintarVacioTexto();
      const x = aHtml(leerBloques(ed));
      if (x.length > MAX_TEXTO) {
        decir('Este texto es muy largo para guardarlo entero. Partilo en dos partes.', true);
        return;
      }
      b.x = x;
      guardar();
      if (avisar) avisar();
    });
    ed.addEventListener('paste', (e) => {
      e.preventDefault();
      document.execCommand('insertText', false, (e.clipboardData || window.clipboardData).getData('text/plain'));
    });
    ed.addEventListener('drop', (e) => e.preventDefault());
    const barra = crear('div', 'cr-formato');
    barra.setAttribute('role', 'group');
    barra.setAttribute('aria-label', 'Formato del texto');
    for (const f of FORMATOS) {
      const bt = boton(f.texto, `b-sec b-chico ${f.clase || ''}`.trim(), f.etiqueta);
      bt.dataset.f = f.id;
      if (f.color !== undefined) bt.dataset.color = f.color;
      bt.setAttribute('aria-pressed', 'false');
      if (f.atajo) bt.setAttribute('aria-keyshortcuts', f.atajo);
      // The text keeps its selection when the button is pressed with the mouse or a finger.
      bt.addEventListener('pointerdown', (e) => e.preventDefault());
      bt.addEventListener('click', () => {
        if (document.activeElement !== ed) {
          ed.focus();
          const r = ultimos.get(ed);
          if (r) {
            const sel = getSelection();
            sel.removeAllRanges();
            sel.addRange(r);
          }
        }
        if (f.id === 'mark') resaltar(ed, f.color);
        else document.execCommand(f.id);
        estados(barra, ed);
      });
      barra.append(bt);
    }
    barraDe.set(ed, barra);
    return [barra, ed];
  };

  // ----- The sheet. Each part is a section: the part itself and, beside it, its margin. Moving one moves its node, so
  // graphs stay alive. New parts go under the one marked (the last one touched), or at the end.
  const bloqueDe = new WeakMap();
  const NOMBRES = { h: 'el título', p: 'el texto', n: 'el recuadro', m: 'la fórmula', f: 'la foto', g: 'el gráfico', s: 'el simulador' };
  const nombreDe = (b) => NOMBRES[b.k === 'o' ? (b.o.f !== undefined ? 'f' : b.o.g === 'interactivo' ? 's' : 'g') : b.k];
  const indice = (sec) => [...hoja.children].indexOf(sec);
  let activa = null;
  const pintarDonde = () => {
    donde.textContent = activa && activa.isConnected ? 'Se suma debajo de la parte marcada.' : 'Se suma al final.';
  };
  const marcarActiva = (sec) => {
    if (activa === sec) return;
    if (activa) activa.classList.remove('cr-activa');
    activa = sec;
    if (sec) sec.classList.add('cr-activa');
    pintarDonde();
  };
  hoja.addEventListener('focusin', (e) => {
    const sec = e.target.closest('.cr-bloque');
    if (sec) marcarActiva(sec);
  });
  hoja.addEventListener('pointerdown', (e) => {
    const sec = e.target.closest('.cr-bloque');
    if (sec) marcarActiva(sec);
  });
  const pintarVacio = () => {
    vacio.hidden = doc.bloques.length > 0;
  };
  // The titles, in the side column, to jump around a long summary.
  const pintarIndice = () => {
    const titulos = [...hoja.children].filter((s) => bloqueDe.get(s)?.k === 'h');
    indiceNav.hidden = !titulos.length;
    indiceLista.replaceChildren(
      ...titulos.map((s) => {
        const b = bloqueDe.get(s);
        const li = crear('li', b.n === 3 ? 'cr-ind-sub' : '');
        const ir = boton(b.t || 'Título sin escribir', b.t ? 'cr-ir' : 'cr-ir cr-ir-vacio');
        ir.addEventListener('click', () => {
          s.scrollIntoView({ block: 'center', behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
          s.querySelector('input').focus({ preventScroll: true });
        });
        li.append(ir);
        return li;
      }),
    );
  };
  let tIndice = 0;
  const pintarIndiceLuego = () => {
    clearTimeout(tIndice);
    tIndice = setTimeout(pintarIndice, 250);
  };
  const ponerEspacio = (sec, b) => {
    sec.classList.toggle('cr-e0', b.e === 0);
    sec.classList.toggle('cr-e2', b.e === 2);
  };
  // The margin: an empty one is only a button, shown on the part being worked on.
  const armarMargen = (sec, b) => {
    const lado = crear('aside', 'cr-margen');
    const escribir = (enfocar) => {
      const t = crear('textarea', 'cr-margen-campo');
      t.rows = 2;
      t.maxLength = MAX_MARGEN;
      t.placeholder = 'Tu comentario';
      t.setAttribute('aria-label', `Comentario al margen de ${nombreDe(b)}`);
      t.value = b.m || '';
      t.addEventListener('input', () => {
        const m = margen(t.value);
        if (m) b.m = m;
        else delete b.m;
        guardar();
      });
      t.addEventListener('blur', () => {
        if (!t.value.trim()) {
          delete b.m;
          guardar();
          vacioMargen(document.activeElement === t);
        }
      });
      lado.classList.remove('cr-margen-vacio');
      lado.replaceChildren(t);
      if (enfocar) t.focus();
    };
    const vacioMargen = () => {
      const bt = boton('Escribir al margen', 'cr-margen-b', `Escribir un comentario al margen de ${nombreDe(b)}`);
      bt.addEventListener('click', () => escribir(true));
      lado.classList.add('cr-margen-vacio');
      lado.replaceChildren(bt);
    };
    if (b.m) escribir(false);
    else vacioMargen();
    return lado;
  };
  const armarBloque = (b) => {
    const sec = crear('section', `cr-bloque cr-${b.k}`);
    bloqueDe.set(sec, b);
    ponerEspacio(sec, b);
    const nombre = nombreDe(b);
    const parte = crear('div', 'cr-parte');
    const barra = crear('div', 'cr-barra');
    const propios = crear('div', 'cr-barra-izq');
    const mover = crear('div', 'cr-barra-der');
    const arriba = boton('Subir', 'b-sec b-chico', `Subir ${nombre}`);
    const abajo = boton('Bajar', 'b-sec b-chico', `Bajar ${nombre}`);
    const sacar = boton('Sacar', 'b-sec b-chico', `Sacar ${nombre}`);
    const sEspacio = elegir(`Espacio antes de ${nombre}`, ESPACIOS.map((t, i) => [i, t]), espacio(b.e));
    sEspacio.addEventListener('change', () => {
      const e = Number(sEspacio.value);
      if (e === 1) delete b.e;
      else b.e = e;
      ponerEspacio(sec, b);
      guardarYa();
    });
    mover.append(sEspacio, arriba, abajo, sacar);
    const moverA = (paso) => {
      const i = indice(sec);
      const j = i + paso;
      if (j < 0 || j >= doc.bloques.length) {
        decir(paso < 0 ? 'Ya es la primera parte.' : 'Ya es la última parte.');
        return;
      }
      [doc.bloques[i], doc.bloques[j]] = [doc.bloques[j], doc.bloques[i]];
      if (paso < 0) hoja.insertBefore(sec, hoja.children[j]);
      else hoja.insertBefore(hoja.children[j], sec);
      guardarYa();
      pintarIndice();
      (paso < 0 ? arriba : abajo).focus();
      decir(`Quedó en el lugar ${j + 1} de ${doc.bloques.length}.`);
    };
    arriba.addEventListener('click', () => moverA(-1));
    abajo.addEventListener('click', () => moverA(1));
    const sacarYa = () => {
      const i = indice(sec);
      doc.bloques.splice(i, 1);
      const fig = sec.querySelector('.ag-w');
      if (fig) P.soltar(fig);
      if (activa === sec) marcarActiva(null);
      sec.remove();
      guardarYa();
      pintarVacio();
      pintarIndice();
      const vecino = hoja.children[Math.min(i, hoja.children.length - 1)];
      (vecino ? vecino.querySelector('input,textarea,[contenteditable],figcaption,figure') : $('crTexto')).focus();
      decir(`Se sacó ${nombre}.`);
    };
    // An empty part goes at once; one with something in it asks first.
    sacar.addEventListener('click', () => {
      if (!tieneAlgo(b)) sacarYa();
      else preguntar(`Se saca ${nombre} del resumen${b.m ? ', con su comentario al margen' : ''}.`, 'Sí, sacar', sacarYa);
    });
    let cuerpo;
    if (b.k === 'h') {
      const sNivel = elegir('Tipo de título', [[2, 'Título'], [3, 'Subtítulo']], b.n);
      propios.append(sNivel);
      cuerpo = crear('input', `cr-h-campo cr-h${b.n}`);
      cuerpo.type = 'text';
      cuerpo.maxLength = 200;
      cuerpo.placeholder = b.n === 3 ? 'Subtítulo de esta parte' : 'Título de esta parte';
      cuerpo.setAttribute('aria-label', b.n === 3 ? 'Subtítulo' : 'Título');
      cuerpo.value = b.t;
      cuerpo.addEventListener('input', () => {
        b.t = P.corto(cuerpo.value, 200);
        guardar();
        pintarIndiceLuego();
      });
      sNivel.addEventListener('change', () => {
        b.n = sNivel.value === '3' ? 3 : 2;
        cuerpo.className = `cr-h-campo cr-h${b.n}`;
        cuerpo.placeholder = b.n === 3 ? 'Subtítulo de esta parte' : 'Título de esta parte';
        cuerpo.setAttribute('aria-label', b.n === 3 ? 'Subtítulo' : 'Título');
        guardarYa();
        pintarIndice();
      });
      parte.append(barra, cuerpo);
    } else if (b.k === 'p') {
      const [formato, ed] = editor(b, 'Texto', 'Escribí acá. Con la barra de arriba ponés negrita, subrayado, resaltador o listas.');
      parte.append(barra, formato, ed);
    } else if (b.k === 'n') {
      const sTipo = elegir('Tipo de recuadro', Object.entries(NOTAS), b.tipo);
      propios.append(sTipo);
      const caja = crear('div', `cr-recuadro cr-r-${b.tipo}`);
      const rotulo = crear('p', 'cr-recuadro-t', NOTAS[b.tipo]);
      rotulo.setAttribute('aria-hidden', 'true');
      const [formato, ed] = editor(b, `Recuadro: ${NOTAS[b.tipo]}`, 'Lo que querés que salte a la vista.');
      sTipo.addEventListener('change', () => {
        b.tipo = Object.hasOwn(NOTAS, sTipo.value) ? sTipo.value : 'ojo';
        caja.className = `cr-recuadro cr-r-${b.tipo}`;
        rotulo.textContent = NOTAS[b.tipo];
        ed.setAttribute('aria-label', `Recuadro: ${NOTAS[b.tipo]}`);
        guardarYa();
      });
      caja.append(rotulo, ed);
      parte.append(barra, formato, caja);
    } else if (b.k === 'm') {
      parte.append(barra, ...editorFormula(b));
    } else {
      cuerpo = P.figura(b.o);
      cuerpo.tabIndex = 0;
      const cap = b.o.f !== undefined ? cuerpo.querySelector('figcaption') : null;
      if (cap) {
        cap.contentEditable = 'true';
        cap.setAttribute('role', 'textbox');
        cap.setAttribute('aria-label', 'Epígrafe de la foto');
        cap.addEventListener('input', () => {
          b.o.t = P.corto(cap.textContent, 300);
          guardar();
        });
        cap.addEventListener('keydown', (e) => {
          if (e.key === 'Enter') e.preventDefault();
        });
        cap.addEventListener('paste', (e) => {
          e.preventDefault();
          document.execCommand('insertText', false, (e.clipboardData || window.clipboardData).getData('text/plain'));
        });
      }
      parte.append(barra, cuerpo);
    }
    barra.append(propios, mover);
    sec.append(parte, armarMargen(sec, b));
    return sec;
  };
  const poner = (b) => {
    if (doc.bloques.length >= MAX_BLOQUES) {
      decir('Llegaste al máximo de partes de un resumen.', true);
      return null;
    }
    const i = activa && activa.isConnected ? indice(activa) + 1 : doc.bloques.length;
    doc.bloques.splice(i, 0, b);
    if (!guardarYa()) {
      doc.bloques.splice(i, 1);
      guardarYa();
      return null;
    }
    const sec = armarBloque(b);
    sec.classList.add('cr-nuevo');
    sec.addEventListener('animationend', () => sec.classList.remove('cr-nuevo'), { once: true });
    hoja.insertBefore(sec, hoja.children[i] || null);
    const fig = sec.querySelector('.ag-w');
    if (fig) P.montar(fig);
    marcarActiva(sec);
    pintarVacio();
    pintarIndice();
    decir('');
    return sec;
  };

  // ----- Tags, on top of the sheet.
  const pintarEtiquetas = () => {
    chips.replaceChildren(
      ...doc.etiquetas.map((t, i) => {
        const li = crear('li', 'cr-chip');
        const sacar = boton('×', 'cr-chip-x', `Sacar la etiqueta ${t}`);
        sacar.addEventListener('click', () => {
          doc.etiquetas.splice(i, 1);
          guardarYa();
          pintarEtiquetas();
          iEtiqueta.focus();
          decir(`Se sacó la etiqueta ${t}.`);
        });
        li.append(crear('span', '', t), sacar);
        return li;
      }),
    );
    chips.hidden = !doc.etiquetas.length;
    iEtiqueta.disabled = doc.etiquetas.length >= MAX_ETIQUETAS;
    iEtiqueta.placeholder = iEtiqueta.disabled ? `Ya tiene ${MAX_ETIQUETAS}` : 'Por ejemplo: Parcial 1';
  };
  // What is typed, split at the commas (pasting «Parcial 1, Parcial 2» gives two). Leaving the field keeps what was
  // typed without pulling the focus back; with Enter or a comma the focus stays, or goes to the last tag once there are 8.
  const sumarEtiqueta = (enfocar) => {
    const nuevas = iEtiqueta.value.split(',').map((x) => P.corto(x, 30)).filter(Boolean);
    iEtiqueta.value = '';
    let cambio = false;
    for (const t of nuevas) {
      if (doc.etiquetas.length >= MAX_ETIQUETAS) break;
      if (doc.etiquetas.includes(t)) continue;
      doc.etiquetas.push(t);
      cambio = true;
    }
    if (!cambio) {
      if (nuevas.length) decir(nuevas.length > 1 ? 'Esas etiquetas ya están.' : 'Esa etiqueta ya está.');
      return;
    }
    guardarYa();
    pintarEtiquetas();
    if (!enfocar) return;
    if (iEtiqueta.disabled) chips.querySelector('li:last-child .cr-chip-x')?.focus();
    else iEtiqueta.focus();
  };
  iEtiqueta.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      sumarEtiqueta(true);
    } else if (e.key === 'Backspace' && !iEtiqueta.value && doc.etiquetas.length) {
      const t = doc.etiquetas.pop();
      guardarYa();
      pintarEtiquetas();
      decir(`Se sacó la etiqueta ${t}.`);
    }
  });
  iEtiqueta.addEventListener('blur', () => sumarEtiqueta(false));

  // ----- Colours. Picking either one keeps both; the sheet and everything on it follow, and the ink with them.
  const mesa = $('crMesa');
  const iFondo = $('crFondo');
  const iHojaColor = $('crHojaColor');
  const bSacarColores = $('crColoresSacar');
  const pintarColores = () => {
    const cs = doc.colores;
    iFondo.value = cs ? cs.fondo : COLORES_BASE.fondo;
    iHojaColor.value = cs ? cs.hoja : COLORES_BASE.hoja;
    bSacarColores.hidden = !cs;
    if (!cs) {
      delete mesa.dataset.colores;
      mesa.style.removeProperty('--cr-fondo');
      mesa.style.removeProperty('--cr-hoja');
      return;
    }
    mesa.dataset.colores = esOscura(cs.hoja) ? 'oscuro' : 'claro';
    // A mid-tone sheet only reaches the contrast with pure black or pure white, so everything goes in that ink.
    mesa.toggleAttribute('data-medio', esMedia(cs.hoja));
    mesa.style.setProperty('--cr-fondo', cs.fondo);
    mesa.style.setProperty('--cr-hoja', cs.hoja);
  };
  const cambiarColor = () => {
    doc.colores = { fondo: iFondo.value.toLowerCase(), hoja: iHojaColor.value.toLowerCase() };
    pintarColores();
    guardar();
  };
  iFondo.addEventListener('input', cambiarColor);
  iHojaColor.addEventListener('input', cambiarColor);
  bSacarColores.addEventListener('click', () => {
    delete doc.colores;
    pintarColores();
    guardarYa();
    iHojaColor.focus();
    decir('La hoja volvió a sus colores de siempre.');
  });

  const pintar = () => {
    hoja.querySelectorAll('.ag-w').forEach(P.soltar);
    activa = null;
    hoja.replaceChildren(...doc.bloques.map(armarBloque));
    hoja.querySelectorAll('.ag-w').forEach(P.montar);
    sMateria.value = doc.materia;
    if (sMateria.value !== doc.materia) doc.materia = '';
    sTitulo.value = doc.titulo;
    pintarColores();
    pintarEtiquetas();
    pintarVacio();
    pintarIndice();
    pintarDonde();
  };

  // ----- Subject and title. Coming from the upload form, the subject arrives in the address.
  const pedida = new URLSearchParams(location.search).get('materia');
  if (pedida && [...sMateria.options].some((o) => o.value === pedida) && !doc.bloques.length) doc.materia = pedida;
  sMateria.addEventListener('change', () => {
    doc.materia = sMateria.value;
    guardarYa();
  });
  sTitulo.addEventListener('input', () => {
    doc.titulo = P.corto(sTitulo.value, 120);
    guardar();
  });

  $('crTitulo2').addEventListener('click', () => poner({ k: 'h', t: '', n: 2 })?.querySelector('input').focus());
  $('crTexto').addEventListener('click', () => poner({ k: 'p', x: '' })?.querySelector('.cr-texto').focus());
  $('crNota').addEventListener('click', () => poner({ k: 'n', tipo: 'ojo', x: '' })?.querySelector('.cr-texto').focus());
  $('crFormula').addEventListener('click', () => poner({ k: 'm', t: '' })?.querySelector('textarea').focus());
  // A mouse press leaves the focus where it was. If the marked part lost it, its bar would fold, the page would get
  // shorter and the button would move away before the click.
  document.querySelector('.cr-sumar-b').addEventListener('mousedown', (e) => {
    if (e.button === 0 && e.target.closest('button')) e.preventDefault();
  });
  const pesoFotos = () => doc.bloques.reduce((t, b) => t + (b.k === 'o' && b.o.f ? b.o.f.length : 0), 0);
  $('crFoto').addEventListener('click', async () => {
    const f = await P.elegirArchivo();
    if (!f) return;
    decir('Preparando la foto…');
    const r = await P.achicar(f);
    if (r.error) {
      decir(r.error, true);
      return;
    }
    if (pesoFotos() + r.url.length > P.MAX_FOTOS) {
      decir('Ya hay muchas fotos en este resumen. Sacá alguna para sumar otra.', true);
      return;
    }
    const sec = poner({ k: 'o', o: { f: r.url, t: '' } });
    if (sec) sec.querySelector('figcaption').focus();
  });
  // Graphs and simulators are the subject's, so the subject comes first. Each piece keeps its own afterwards.
  $('crGrafico').addEventListener('click', async () => {
    if (!doc.materia) {
      decir('Elegí la materia antes de sumar un gráfico.', true);
      sMateria.focus();
      return;
    }
    decir('Buscando los gráficos de la materia…');
    let o = null;
    try {
      o = await P.elegirGrafico(`${doc.materia}/figuras.json`, doc.materia, () => decir(''));
    } catch {
      decir('No se pudieron cargar los gráficos. Probá recargar la página.', true);
      return;
    }
    if (!o) return;
    const sec = poner({ k: 'o', o });
    if (sec) {
      sec.querySelector('figure').focus();
      sec.scrollIntoView({ block: 'nearest' });
    }
  });
  // A simulator tells what the person typed in it (w.js checks it is a flat object of texts), and it is kept with the
  // piece, so it comes back the same. What does not fit is not kept, and the person is told.
  const NO_ENTRA = 'Esos datos son demasiados para guardarlos. Si recargás la página, vuelven los de antes. Probá con menos.';
  hoja.addEventListener('w-datos', (e) => {
    const sec = e.target.closest('.cr-bloque');
    const b = sec && bloqueDe.get(sec);
    if (!b || b.k !== 'o' || b.o.g !== 'interactivo' || !e.detail || typeof e.detail !== 'object') return;
    const c = { ...b.o.c, datos: e.detail };
    if (JSON.stringify(c).length > P.MAX_CFG) {
      decir(NO_ENTRA, true);
      return;
    }
    if (salida.textContent === NO_ENTRA) decir('');
    b.o.c = c;
    guardar();
  });

  // ----- The file. Its look travels in a <style> of its own, which the bank keeps: on a wide screen the comments go in
  // a margin column, on a phone under their part.
  const ESTILO = [
    'body{margin:0;background:#fff;color:#1b1b1b}',
    "main{box-sizing:border-box;max-width:46rem;margin:0 auto;padding:1.6rem 1.1rem 3rem;font-family:Georgia,'Times New Roman',serif;font-size:17px;line-height:1.55}",
    'main.con-margen{max-width:66rem}',
    "h1,h2,h3,.recuadro-t,.etiquetas{font-family:system-ui,'Segoe UI',sans-serif}",
    'h1,h2,h3{line-height:1.2}',
    '.materia{margin:.2rem 0;color:#555}',
    '.etiquetas{display:flex;flex-wrap:wrap;gap:.4rem;margin:.6rem 0 1.4rem;padding:0;list-style:none}',
    '.etiquetas li{padding:.05rem .65rem;border:1px solid #8a94a8;border-radius:999px;font-size:.8rem;font-weight:600;line-height:1.6;color:#2b3550}',
    '.parte{margin:1.1rem 0 0}',
    '.parte.pegada{margin-top:.25rem}',
    '.parte.aire{margin-top:2.6rem}',
    '.cuerpo>:first-child{margin-top:0}',
    '.cuerpo>:last-child{margin-bottom:0}',
    ".margen{margin:.5rem 0 0 .8rem;padding:.1rem 0 .1rem .75rem;border-left:2px solid #e0578f;font-family:'Segoe Print','Comic Sans MS',cursive;font-size:.92rem;line-height:1.35;color:#1f3a9e;white-space:pre-wrap}",
    '@media (min-width:56rem){main.con-margen .parte{display:grid;grid-template-columns:minmax(0,1fr) 15rem;column-gap:2rem;align-items:start}main.con-margen .margen{margin:.2rem 0 0}}',
    '.recuadro{padding:.65rem 1rem;border-left:5px solid #8a94a8;background:#f4f6fa}',
    '.recuadro-t{margin:0 0 .3rem;font-size:.85rem;font-weight:700}',
    '.recuadro>:last-child{margin-bottom:0}',
    '.recuadro.ojo{border-color:#e0578f;background:#fdeef4}',
    '.recuadro.definicion{border-color:#1f3a9e;background:#eef2fd}',
    '.recuadro.formula{border-color:#6b4fbb;background:#f3effc}',
    '.recuadro.ejemplo{border-color:#2f8a57;background:#edf8f1}',
    '.recuadro.recordar{border-color:#b98d00;background:#fff8dc}',
    'mark{background:#fff06a;color:inherit}',
    'mark.r-verde{background:#aef0c0}',
    'mark.r-celeste{background:#b5e2ff}',
    '.ecuacion{margin:.6rem 0;overflow-x:auto;font-size:1.1em}',
    '.ecuacion .tex{margin:0;text-align:center;white-space:pre-wrap}',
    '.ecuacion:has(.ml math) .tex{display:none}',
    'figure{margin:0}',
    'figure img{display:block;width:100%;height:auto}',
    'figcaption{margin-top:.3rem;font-size:.9em;color:#555}',
  ].join('\n');
  const coloresArchivo = (cs) => {
    if (!cs) return '';
    const oscura = esOscura(cs.hoja);
    const media = esMedia(cs.hoja);
    const tinta = oscura ? (media ? '#fff' : '#f4f4f4') : media ? '#000' : '#1b1b1b';
    const reglas = [
      `body{background:${cs.fondo}}`,
      `main{margin:1.5rem auto;background:${cs.hoja};color:${tinta};border-radius:10px;box-shadow:0 12px 32px -18px rgb(0 0 0 / 45%)}`,
      '@media (max-width:48rem){main{margin:0;border-radius:0}}',
      'mark{color:#1b1b1b}',
    ];
    if (oscura) reglas.push('.materia,figcaption{color:inherit;opacity:.8}', '.etiquetas li{color:inherit;border-color:currentColor}', '.margen{color:#b8ccff}', '.recuadro[class]{background:rgb(255 255 255 / 8%)}', 'a{color:#a9c8ff}');
    // On a mid-tone sheet the softer inks fall short, so the secondary texts take the main one.
    if (media) reglas.push('.materia,figcaption,.margen,a{color:inherit;opacity:1}', '.etiquetas li{color:inherit;border-color:currentColor}');
    return `\n${reglas.join('\n')}`;
  };
  const imagenHtml = (src, alt, pie) => `<figure><img src="${src}" alt="${esc(alt)}">${pie ? `<figcaption>${esc(pie)}</figcaption>` : ''}</figure>`;
  const nombreMateria = () => (sMateria.selectedIndex > 0 ? sMateria.options[sMateria.selectedIndex].textContent : '');
  const armarArchivo = async () => {
    const partes = [];
    const secciones = [...hoja.children];
    for (let i = 0; i < doc.bloques.length; i += 1) {
      const b = doc.bloques[i];
      let dentro = '';
      if (b.k === 'h' && b.t) dentro = `<h${b.n}>${esc(b.t)}</h${b.n}>`;
      else if (b.k === 'p') {
        const arbol = leerHtml(b.x);
        if (conTexto(arbol)) dentro = aHtml(arbol);
      } else if (b.k === 'n') {
        const arbol = leerHtml(b.x);
        if (conTexto(arbol)) dentro = `<div class="recuadro ${b.tipo}"><p class="recuadro-t">${esc(NOTAS[b.tipo])}</p>${aHtml(arbol)}</div>`;
      } else if (b.k === 'm' && b.t.trim()) {
        const tex = b.t.trim();
        const nombre = `La fórmula de la parte ${i + 1}`;
        if (fallaFormula(tex)) return { error: `${nombre} tiene un \\[, un \\] o un $$. Sacalos y probá de nuevo.` };
        const k = await conKatex().catch(() => null);
        if (!k) return { error: 'No se pudieron dibujar las fórmulas. Revisá la conexión y probá de nuevo.' };
        let ml;
        try {
          ml = k.renderToString(tex, OPCIONES_TEX);
        } catch {
          return { error: `${nombre} no se entiende. Fijate que cada llave que abrís se cierre.` };
        }
        dentro = `<div class="ecuacion"><span class="ml">${ml}</span><p class="tex">\\[${esc(tex)}\\]</p></div>`;
      } else if (b.k === 'o' && b.o.f !== undefined) dentro = imagenHtml(b.o.f, b.o.t ? '' : 'Foto', b.o.t);
      else if (b.k === 'o') {
        const fig = secciones[i] && secciones[i].querySelector('.ag-w');
        const src = fig ? await P.imagen(fig).catch(() => null) : null;
        if (!src && b.o.g === 'interactivo' && fig && fig.classList.contains('w-listo')) return { error: `El simulador «${b.o.t || 'sin título'}» está vacío o tiene datos que no cierran, y así no se puede pasar a imagen. Completalo o sacalo.` };
        if (!src) return { error: `El gráfico «${b.o.t || 'sin título'}» no se pudo pasar a imagen. Probá de nuevo o sacalo.` };
        dentro = imagenHtml(src, b.o.d || b.o.t, b.o.t);
      }
      if (!dentro && !b.m) continue;
      const clase = b.e === 0 ? ' pegada' : b.e === 2 ? ' aire' : '';
      partes.push(`<div class="parte${clase}"><div class="cuerpo">${dentro}</div>${b.m ? `<aside class="margen">${esc(b.m)}</aside>` : ''}</div>`);
    }
    if (!partes.length) return { error: 'El resumen está vacío. Sumale algo antes.' };
    const titulo = doc.titulo || 'Resumen';
    const materia = nombreMateria();
    const conMargen = doc.bloques.some((b) => b.m);
    const etiquetas = doc.etiquetas.length ? `<ul class="etiquetas">${doc.etiquetas.map((t) => `<li>${esc(t)}</li>`).join('')}</ul>\n` : '';
    const html = `<!doctype html>
<html lang="es">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${esc(titulo)}</title>
<style>
${ESTILO}${coloresArchivo(doc.colores)}
</style>
</head>
<body>
<main${conMargen ? ' class="con-margen"' : ''}>
<h1>${esc(titulo)}</h1>
${materia ? `<p class="materia">${esc(materia)}. Armado en El Santo Resumen.</p>\n` : ''}${etiquetas}${partes.join('\n')}
</main>
</body>
</html>
`;
    if (html.length > MAX_HTML) return { error: 'El archivo pasa de 5 MB, lo máximo que entra en el banco. Sacá alguna foto o algún gráfico.' };
    const base = titulo.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60) || 'resumen';
    return { html, nombre: `${base}.html` };
  };
  // While the file is being made, both buttons say they are busy but keep the focus (a disabled button drops it).
  let armando = false;
  const conArchivo = async (bt, hacer) => {
    if (armando) return;
    armando = true;
    clearTimeout(tGuardar);
    guardarYa();
    const botones = [$('crBajar'), $('crSubir')];
    botones.forEach((x) => x.setAttribute('aria-disabled', 'true'));
    decir('Armando el archivo…');
    const r = await armarArchivo().catch(() => ({ error: 'No se pudo armar el archivo. Probá de nuevo.' }));
    botones.forEach((x) => x.removeAttribute('aria-disabled'));
    armando = false;
    if (r.error) {
      decir(r.error, true);
      salida.focus();
      return;
    }
    hacer(r);
  };
  $('crBajar').addEventListener('click', (e) =>
    conArchivo(e.currentTarget, ({ html, nombre }) => {
      const a = document.createElement('a');
      a.href = URL.createObjectURL(new Blob([html], { type: 'text/html' }));
      a.download = nombre;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 2000);
      decir(`Se bajó ${nombre}. Lo podés subir al banco cuando quieras.`);
    }),
  );
  $('crSubir').addEventListener('click', (e) => {
    if (!doc.materia) {
      decir('Elegí la materia antes de llevarlo al banco.', true);
      sMateria.focus();
      return;
    }
    conArchivo(e.currentTarget, ({ html, nombre }) => {
      try {
        sessionStorage.setItem('utn:creado', JSON.stringify({ materia: doc.materia, titulo: doc.titulo, nombre, html }));
      } catch {
        decir('Es muy pesado para pasarlo directo. Bajá el archivo y subilo desde «Subir un resumen».', true);
        salida.focus();
        return;
      }
      location.href = `subir.html?materia=${encodeURIComponent(doc.materia)}&creado=1`;
    });
  });
  $('crBorrar').addEventListener('click', () =>
    preguntar('Se borra todo lo que armaste en este resumen. No se puede deshacer.', 'Sí, borrarlo', () => {
      doc = nuevo();
      guardarYa();
      pintar();
      decir('Quedó en blanco.');
    }),
  );

  // ----- Sharing by link. The summary travels compressed in the part of the address after «#», which the browser never
  // sends to a server: nobody but whoever gets the link sees it. Photos stay out, they would make it too long. Whoever
  // opens it gets a copy of their own, checked again like anything from storage.
  const MAX_LINK = 60000;
  const MAX_LINK_JSON = 2000000;
  const aBase64 = (bytes) => {
    let s = '';
    for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
    return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  };
  const deBase64 = (t) => Uint8Array.from(atob(t.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0));
  const comprimir = async (texto) => new Uint8Array(await new Response(new Blob([texto]).stream().pipeThrough(new CompressionStream('deflate-raw'))).arrayBuffer());
  // Stops reading past the size of a real summary: a link can't make the page unpack something enormous.
  const descomprimir = async (bytes) => {
    const lector = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate-raw')).getReader();
    const partes = [];
    let total = 0;
    for (;;) {
      const { done, value } = await lector.read();
      if (done) break;
      total += value.length;
      if (total > MAX_LINK_JSON) {
        lector.cancel();
        throw new Error('demasiado');
      }
      partes.push(value);
    }
    return new TextDecoder().decode(await new Blob(partes).arrayBuffer());
  };
  const esFoto = (b) => b.k === 'o' && b.o.f !== undefined;
  const mostrarLink = (link, fotos) => {
    const d = crear('dialog', 'dlg dlg-ancho');
    const h = crear('h2', '', 'Link de tu resumen');
    h.id = 'crLinkTitulo';
    d.setAttribute('aria-labelledby', h.id);
    const nota = crear('p', '', 'Quien lo abra recibe una copia en su navegador, con tus comentarios al margen. Lo que cambie no te llega a vos.');
    const campo = crear('input', 'cr-link');
    campo.type = 'text';
    campo.readOnly = true;
    campo.value = link;
    campo.setAttribute('aria-label', 'Link del resumen');
    campo.addEventListener('focus', () => campo.select());
    const estado = crear('p', 'cr-link-estado');
    estado.setAttribute('role', 'status');
    const copiar = boton('Copiar el link', 'b-pri');
    copiar.addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(link);
        estado.textContent = 'Se copió el link.';
      } catch {
        campo.focus();
        estado.textContent = 'No se pudo copiar solo. Quedó marcado para que lo copies vos.';
      }
    });
    const f = crear('div', 'dlg-botones');
    f.append(copiar);
    if (navigator.share) {
      const compartir = boton('Mandarlo', 'b-sec');
      compartir.addEventListener('click', () => navigator.share({ title: doc.titulo || 'Resumen', url: link }).catch(() => {}));
      f.append(compartir);
    }
    const cerrar = boton('Cerrar', 'b-sec');
    cerrar.addEventListener('click', () => d.close());
    f.append(cerrar);
    d.addEventListener('close', () => d.remove());
    d.append(h, nota);
    if (fotos) d.append(crear('p', 'cr-link-fotos', fotos === 1 ? 'La foto no va en el link. Para mandarla, bajá el archivo.' : `Las ${fotos} fotos no van en el link. Para mandarlas, bajá el archivo.`));
    d.append(campo, estado, f);
    document.body.append(d);
    d.showModal();
    copiar.focus();
  };
  let armandoLink = false;
  $('crLink').addEventListener('click', async () => {
    if (armandoLink) return;
    clearTimeout(tGuardar);
    guardarYa();
    const partes = doc.bloques.filter((b) => !esFoto(b));
    const fotos = doc.bloques.length - partes.length;
    if (!partes.some(tieneAlgo)) {
      decir(fotos ? 'Las fotos no van en el link y el resumen no tiene nada más. Bajá el archivo para mandarlo.' : 'El resumen está vacío. Sumale algo antes.', true);
      salida.focus();
      return;
    }
    if (typeof CompressionStream !== 'function') {
      decir('Este navegador no puede armar el link. Bajá el archivo y mandalo así.', true);
      salida.focus();
      return;
    }
    armandoLink = true;
    const datos = await comprimir(JSON.stringify({ ...doc, bloques: partes })).then(aBase64, () => null);
    armandoLink = false;
    if (datos === null) {
      decir('No se pudo armar el link. Probá de nuevo.', true);
      salida.focus();
      return;
    }
    if (datos.length > MAX_LINK) {
      decir('Es muy largo para un link. Bajá el archivo y mandalo así.', true);
      salida.focus();
      return;
    }
    decir('');
    mostrarLink(`${location.origin}${location.pathname}#r=${datos}`, fotos);
  });
  const abrirLink = async () => {
    const datos = location.hash.startsWith('#r=') ? location.hash.slice(3) : '';
    if (!datos) return;
    // Out of the address at once: a reload doesn't ask again, and the summary doesn't stay in the history.
    history.replaceState(null, '', location.pathname + location.search);
    let otro;
    try {
      if (datos.length > MAX_LINK || typeof DecompressionStream !== 'function') throw new Error('no');
      otro = validar(JSON.parse(await descomprimir(deBase64(datos))));
    } catch {
      otro = nuevo();
    }
    if (!otro.titulo && !otro.bloques.some(tieneAlgo)) {
      decir('Ese link no trae un resumen. Puede que le falte un pedazo. Pedí que te lo manden de nuevo.', true);
      salida.focus();
      return;
    }
    const abrir = () => {
      const antes = doc;
      doc = otro;
      if (!guardarYa()) {
        doc = antes;
        guardarYa();
        salida.focus();
        return;
      }
      pintar();
      decir(`Se abrió «${doc.titulo || 'el resumen del link'}». Es tu copia. Lo que cambies queda en este navegador.`);
    };
    if (doc.titulo || doc.bloques.some(tieneAlgo)) preguntar('El resumen del link reemplaza al que tenés armado. Para guardar el tuyo, bajá el archivo y abrí el link de nuevo.', 'Sí, abrirlo', abrir, () => decir('No se abrió el link. Volvé a tocarlo cuando quieras.'));
    else abrir();
  };

  pintar();
  abrirLink();
  addEventListener('hashchange', abrirLink);
})();
