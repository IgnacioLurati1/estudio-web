// Simuladores de Sintaxis y Semántica de los Lenguajes para «Armá tu resumen». El alumno escribe su expresión
// regular o su gramática y cada pieza muestra el procedimiento con la notación del apunte (parcial-2.md: Thompson,
// subconjuntos, gramáticas y Chomsky). Lo que escribe se lee con un parser propio. En una página de la materia los
// campos quedan fijos en el ejemplo, así que ahí no se puede resolver un ejercicio de examen.
(() => {
  const TOPE = { er: 50, cadena: 30, producciones: 800, palabra: 30, lado: 10 };
  const MAX_ESTADOS = 80;
  const MAX_AFD = 2000;
  // (a|b)*abb es el ejemplo del apunte «5. Autómatas…», págs. 9 a 13. A -> B1 | 1, B -> A0 es el del apunte
  // «4. Gramáticas», pág. 3, con la derivación del 2° autotest de 2024.
  const EJEMPLO = { er: '(a|b)*abb', cadena: 'aabb', producciones: 'A -> B1 | 1\nB -> A0', palabra: '101', lado: 'izquierda' };

  let cuenta = 0;
  const nuevoId = () => `ssl-${(cuenta += 1)}`;
  const enResumenDe = (figura, ayuda) => ayuda.enResumen ?? figura.classList.contains('ag-pieza');
  /** cfg.datos comes from the browser's storage: a saved string within its cap, or undefined. */
  const guardado = (cfg, clave) => {
    const d = cfg && cfg.datos;
    if (!d || typeof d !== 'object' || Array.isArray(d) || !Object.prototype.hasOwnProperty.call(d, clave)) return undefined;
    return typeof d[clave] === 'string' && d[clave].length <= TOPE[clave] ? d[clave] : undefined;
  };
  const corto = (t) => (t.length > 40 ? `${t.slice(0, 40)}…` : t);
  const yLista = (xs) => (xs.length > 1 ? `${xs.slice(0, -1).join(', ')} y ${xs[xs.length - 1]}` : xs[0] || '');
  const conj = (xs) => `{${xs.join(',')}}`;

  // ----- Pieces both simulators share
  function campo(ayuda, etq, valor, k, propio, largo) {
    const { crear } = ayuda;
    const id = nuevoId();
    const inp = crear(largo ? 'textarea' : 'input', { id, spellcheck: false, autocomplete: 'off', autocapitalize: 'off', maxLength: TOPE[k], readOnly: !propio });
    if (largo) inp.rows = 4;
    else inp.type = 'text';
    inp.value = valor;
    inp.style.cssText = 'width:100%;box-sizing:border-box';
    const fila = crear('div', { className: 'w-entrada' }, crear('label', { htmlFor: id }, etq), inp);
    fila.style.marginBottom = '.5rem';
    return { inp, fila };
  }
  /** The value of a field. The other fields follow the main one (`base`): if it came back broken, they all show the
   * example, so the word to test never lands on a grammar it was not written for. */
  const valorDe = (cfg, k, propio, base) => (propio && guardado(cfg, base) !== undefined ? guardado(cfg, k) ?? '' : typeof cfg[k] === 'string' && cfg[k].length <= TOPE[k] ? cfg[k] : EJEMPLO[k]);
  const titulo = (ayuda, t) => {
    const h = ayuda.crear('p', { className: 'w-titular' }, t);
    h.style.margin = '.8rem 0 .3rem';
    return h;
  };
  const listaDe = (ayuda, lineas, numerada = true) => ayuda.crear(numerada ? 'ol' : 'ul', {}, ...lineas.map((t) => ayuda.crear('li', {}, t)));
  /** A table that scrolls in its own box. The column `texto` holds sentences, so it wraps instead of scrolling. */
  const tablaDe = (ayuda, cab, filas, etq, texto = -1) => {
    const { crear } = ayuda;
    const celda = (c, j) => {
      const td = crear(j ? 'td' : 'th', j ? {} : { scope: 'row' }, c);
      if (j === texto) td.style.cssText = 'white-space:normal;text-align:left;min-width:9rem';
      return td;
    };
    return crear('div', { className: 'w-tabla-v' }, crear('table', {}, crear('caption', { className: 'w-ayuda' }, etq),
      crear('thead', {}, crear('tr', {}, ...cab.map((c, j) => {
        const th = crear('th', { scope: 'col' }, c);
        if (j === texto) th.style.textAlign = 'left';
        return th;
      }))),
      crear('tbody', {}, ...filas.map((f) => crear('tr', {}, ...f.map(celda))))));
  };
  const nota = (ayuda, propio, texto) => {
    const p = ayuda.crear('p', { className: 'w-ayuda' }, propio ? texto : 'Es el ejemplo del apunte. En «Armá tu resumen» lo cambiás por el tuyo.');
    p.style.margin = '0 0 .5rem';
    return p;
  };
  /** The picture: the drawing as on screen and, under it, the texts and tables (ayuda.pngTablas, dark on white). */
  async function apilar(ayuda, dibujo, partes) {
    const urls = [dibujo ? await ayuda.png(dibujo) : null, ayuda.pngTablas ? await ayuda.pngTablas(partes.filter(Boolean)) : null].filter(Boolean);
    const imgs = await Promise.all(urls.map(async (u) => {
      const i = new Image();
      i.src = u;
      await i.decode();
      return i;
    }));
    if (!imgs.length) return null;
    const c = document.createElement('canvas');
    c.width = Math.max(...imgs.map((i) => i.width));
    c.height = imgs.reduce((a, i) => a + i.height, 0);
    const g = c.getContext('2d');
    g.fillStyle = '#fff';
    g.fillRect(0, 0, c.width, c.height);
    let y = 0;
    imgs.forEach((i) => {
      g.drawImage(i, 0, y);
      y += i.height;
    });
    return c.toDataURL('image/png');
  }

  // ===== Regular expressions: | . * + ? ( ) [ ] and ε, with the precedence of the notes (* over . over |)
  const esSimbolo = (c) => c !== 'ε' && /^[\p{L}\p{N}_]$/u.test(c);
  function leerER(src) {
    let i = 0;
    const ver = () => {
      while (i < src.length && /\s/.test(src[i])) i += 1;
      return src[i];
    };
    const falla = (m) => {
      throw new Error(m);
    };
    const fin = (c) => c === undefined || c === '|' || c === ')';
    function alt() {
      ver();
      const ini = i;
      let a = cat();
      while (ver() === '|') {
        i += 1;
        if (fin(ver())) falla('Falta algo después de una |.');
        const b = cat();
        a = { t: 'alt', a, b, txt: src.slice(ini, i).trim() };
      }
      return a;
    }
    function cat() {
      ver();
      const ini = i;
      let a = rep();
      for (;;) {
        let c = ver();
        if (c === '.') {
          i += 1;
          c = ver();
          if (fin(c)) falla('Falta algo después del punto.');
        } else if (fin(c)) break;
        const b = rep();
        a = { t: 'cat', a, b, txt: src.slice(ini, i).trim() };
      }
      return a;
    }
    function rep() {
      ver();
      const ini = i;
      let a = atomo();
      for (let c = ver(); c === '*' || c === '+' || c === '?'; c = ver()) {
        i += 1;
        a = { t: c === '*' ? 'star' : c === '+' ? 'plus' : 'opt', a, txt: src.slice(ini, i).trim() };
      }
      return a;
    }
    function clase() {
      const ini = i;
      i += 1;
      const cierra = src.indexOf(']', i);
      if (cierra < 0) falla('Falta cerrar el corchete.');
      const dentro = src.slice(i, cierra).replace(/\s+/g, '');
      i = cierra + 1;
      const simbolos = [];
      for (let j = 0; j < dentro.length; j += 1) {
        const a = dentro[j];
        if (!esSimbolo(a)) falla(`«${a}» no puede ir en una clase. Van letras o dígitos, como [abc] o [a-c].`);
        if ((dentro[j + 1] === '-' || dentro[j + 1] === '–') && j + 2 < dentro.length) {
          const b = dentro[j + 2];
          const x = a.codePointAt(0);
          const y = b.codePointAt(0);
          if (!esSimbolo(b) || y < x || y - x > 25) falla(`El rango ${a}-${b} no sirve. Va de menor a mayor, como a-c o 0-9.`);
          for (let k = x; k <= y; k += 1) simbolos.push(String.fromCodePoint(k));
          j += 2;
        } else simbolos.push(a);
      }
      const unicos = [...new Set(simbolos)];
      if (!unicos.length) falla('Hay un par de corchetes vacío.');
      if (unicos.length > 26) falla('La clase tiene demasiados símbolos. El tope es 26.');
      const txt = src.slice(ini, i);
      let n = { t: 'sim', c: unicos[0], txt: unicos[0] };
      unicos.slice(1).forEach((c, k) => {
        n = { t: 'alt', a: n, b: { t: 'sim', c, txt: c }, txt: unicos.slice(0, k + 2).join('|') };
      });
      return { ...n, txtP: txt, clase: txt };
    }
    function atomo() {
      const c = ver();
      const ini = i;
      if (c === undefined) falla('Falta una parte de la expresión.');
      if (c === '(') {
        i += 1;
        if (ver() === ')') falla('Hay un par de paréntesis vacío.');
        const a = alt();
        if (ver() !== ')') falla('Falta cerrar un paréntesis.');
        i += 1;
        return { ...a, txtP: src.slice(ini, i).trim() };
      }
      if (c === '[') return clase();
      if (c === 'ε') {
        i += 1;
        return { t: 'eps', txt: 'ε' };
      }
      if (esSimbolo(c)) {
        i += 1;
        return { t: 'sim', c, txt: c };
      }
      if (c === ')') falla('Sobra un paréntesis que cierra.');
      if (c === '*' || c === '+' || c === '?') falla(`El ${c} va después de un símbolo o de un paréntesis.`);
      if (c === '|') falla('Falta algo antes de una |.');
      if (c === '.') falla('Falta algo antes del punto.');
      return falla(`No entiendo «${c}». Los símbolos son letras o dígitos, y los operadores, | . * + ? y paréntesis.`);
    }
    if (!src.trim()) falla('Escribí una expresión regular, como a(a|b)*b.');
    const r = alt();
    if (ver() === ')') falla('Sobra un paréntesis que cierra.');
    if (ver() !== undefined) falla(`No entiendo «${src[i]}».`);
    return r;
  }
  const verTxt = (n) => n.txtP || n.txt;
  const tamano = (n) => ({ sim: 2, eps: 2 }[n.t] ?? (n.t === 'cat' ? tamano(n.a) + tamano(n.b) - 1 : n.t === 'alt' ? tamano(n.a) + tamano(n.b) + 2 : n.t === 'star' ? tamano(n.a) + 2 : n.t === 'plus' ? 2 * tamano(n.a) + 1 : tamano(n.a) + 4));
  const soloVacia = (n) => (n.t === 'eps' ? true : n.t === 'sim' ? false : n.t === 'alt' || n.t === 'cat' ? soloVacia(n.a) && soloVacia(n.b) : soloVacia(n.a));
  const tieneVacia = (n) => (n.t === 'eps' || n.t === 'star' || n.t === 'opt' ? true : n.t === 'sim' ? false : n.t === 'alt' ? tieneVacia(n.a) || tieneVacia(n.b) : n.t === 'cat' ? tieneVacia(n.a) && tieneVacia(n.b) : tieneVacia(n.a));
  /** The first closure that can repeat a non-empty word, which is what makes the language infinite. */
  const cerraduraQueRepite = (n) => {
    if ((n.t === 'star' || n.t === 'plus') && !soloVacia(n.a)) return n;
    return n.a ? cerraduraQueRepite(n.a) || (n.b ? cerraduraQueRepite(n.b) : null) : null;
  };

  /** Thompson as the notes number it: each state gets its number when its rule creates it, left to right, and in
   * s.t the final state of N(s) is the start of N(t). Each step is one rule, in the order the notes build them. */
  function thompson(raiz) {
    const aristas = [];
    const pasos = [];
    const pasoDe = [];
    const pos = [];
    const curvas = new Map();
    let n = 0;
    const nuevo = () => {
      n += 1;
      return n - 1;
    };
    const arista = (de, a, c) => aristas.push({ de, a, c, paso: -1 }) - 1;
    const paso = (texto, estados, ars) => {
      const k = pasos.length;
      pasos.push(texto);
      estados.forEach((s) => (pasoDe[s] = k));
      ars.forEach((x) => (aristas[x].paso = k));
    };
    // Each fragment knows its size (columns wide, rows over and under the line of its start and end) and how to
    // place its states once the whole automaton is built.
    function hacer(nodo, inicio) {
      if (nodo.t === 'sim' || nodo.t === 'eps') {
        const i = inicio ?? nuevo();
        const f = nuevo();
        const c = nodo.t === 'eps' ? 'ε' : nodo.c;
        paso(nodo.t === 'eps' ? `Regla 1, para ε. Una arista ε del ${i} al ${f}.` : `Regla 2, para ${c}. Una arista ${c} del ${i} al ${f}.`, inicio === undefined ? [i, f] : [f], [arista(i, f, c)]);
        return { i, f, w: 1, up: 0.5, down: 0.5, colocar: (x, y) => {
          pos[i] = { x, y };
          pos[f] = { x: x + 1, y };
        } };
      }
      if (nodo.t === 'cat' || nodo.t === 'plus') {
        const izq = nodo.t === 'cat' ? nodo.a : nodo.a;
        const der = nodo.t === 'cat' ? nodo.b : { t: 'star', a: nodo.a, txt: `${verTxt(nodo.a)}*` };
        const s = hacer(izq, inicio);
        const t = hacer(der, s.f);
        const como = nodo.t === 'plus' ? `, que es ${verTxt(nodo.a)}${verTxt(nodo.a)}*` : '';
        paso(`Regla 3.b, para ${nodo.txt}${como}. En serie, el final de ${verTxt(izq)}, el ${s.f}, se fusiona con el inicio de ${verTxt(der)}.`, [], []);
        return { i: s.i, f: t.f, w: s.w + t.w, up: Math.max(s.up, t.up), down: Math.max(s.down, t.down), colocar: (x, y) => {
          s.colocar(x, y);
          t.colocar(x + s.w, y);
        } };
      }
      if (nodo.t === 'alt' || nodo.t === 'opt') {
        const a = nodo.a;
        const b = nodo.t === 'alt' ? nodo.b : { t: 'eps', txt: 'ε' };
        const i = inicio ?? nuevo();
        const s = hacer(a);
        const t = hacer(b);
        const f = nuevo();
        const xs = [arista(i, s.i, 'ε'), arista(i, t.i, 'ε'), arista(s.f, f, 'ε'), arista(t.f, f, 'ε')];
        const que = nodo.t === 'opt' ? `${nodo.txt}, que es ${verTxt(a)}|ε` : nodo.clase ? `${nodo.txt}, de ${nodo.clase}` : nodo.txt;
        paso(`Regla 3.a, para ${que}. En paralelo, con un inicio ${i} que va con ε al ${s.i} y al ${t.i}, y un final ${f} al que llegan con ε el ${s.f} y el ${t.f}.`, inicio === undefined ? [i, f] : [f], xs);
        const G = 0.25;
        const w = Math.max(s.w, t.w) + 2;
        return { i, f, w, up: s.up + s.down + G, down: t.up + t.down + G, colocar: (x, y) => {
          pos[i] = { x, y };
          s.colocar(x + 1 + (w - 2 - s.w) / 2, y - s.down - G);
          t.colocar(x + 1 + (w - 2 - t.w) / 2, y + t.up + G);
          pos[f] = { x: x + w, y };
        } };
      }
      // star
      const i = inicio ?? nuevo();
      const s = hacer(nodo.a);
      const f = nuevo();
      const vuelta = arista(s.f, s.i, 'ε');
      const salto = arista(i, f, 'ε');
      const xs = [arista(i, s.i, 'ε'), vuelta, arista(s.f, f, 'ε'), salto];
      paso(`Regla 3.c, para ${nodo.txt}. Un inicio ${i} y un final ${f}. Con ε, del ${i} al ${s.i} para entrar y del ${i} al ${f} para no pasar nunca, y del ${s.f} al ${s.i} para repetir y al ${f} para salir.`, inicio === undefined ? [i, f] : [f], xs);
      return { i, f, w: s.w + 2, up: s.up + 0.45, down: s.down + 0.45, colocar: (x, y) => {
        pos[i] = { x, y };
        s.colocar(x + 1, y);
        pos[f] = { x: x + s.w + 2, y };
        curvas.set(vuelta, { arriba: true, nivel: y - s.up - 0.25 });
        curvas.set(salto, { arriba: false, nivel: y + s.down + 0.25 });
      } };
    }
    const r = hacer(raiz);
    r.colocar(0, 0);
    const alfabeto = [];
    aristas.forEach((a) => {
      if (a.c !== 'ε' && !alfabeto.includes(a.c)) alfabeto.push(a.c);
    });
    const sale = Array.from({ length: n }, () => []);
    aristas.forEach((a) => sale[a.de].push(a));
    return { n, inicio: r.i, final: r.f, aristas, sale, pasos, pasoDe, pos, curvas, alfabeto, w: r.w, up: r.up, down: r.down };
  }

  const cerradura = (afn, T) => {
    const vistos = new Set(T);
    const pila = [...T];
    while (pila.length) {
      const s = pila.pop();
      for (const a of afn.sale[s]) {
        if (a.c === 'ε' && !vistos.has(a.a)) {
          vistos.add(a.a);
          pila.push(a.a);
        }
      }
    }
    return [...vistos].sort((x, y) => x - y);
  };
  const mueve = (afn, T, c) => [...new Set(T.flatMap((s) => afn.sale[s].filter((a) => a.c === c).map((a) => a.a)))].sort((x, y) => x - y);
  const letra = (j) => (j < 26 ? String.fromCharCode(65 + j) : `Q${j}`);

  /** Subset construction as in the notes: A = cerradura-ε(s₀), and cerradura-ε(mueve(T, a)) for each set and symbol. */
  function afd(afn) {
    const estados = [];
    const idx = new Map();
    const lineas = [];
    const agregar = (T) => {
      const k = T.join(',');
      if (!idx.has(k)) {
        idx.set(k, estados.length);
        estados.push({ T, final: T.includes(afn.final), trans: {} });
      }
      return idx.get(k);
    };
    const A = cerradura(afn, [afn.inicio]);
    agregar(A);
    lineas.push(`cerradura-ε(${afn.inicio}) = ${conj(A)} = A.`);
    for (let q = 0; q < estados.length; q += 1) {
      for (const c of afn.alfabeto) {
        const m = mueve(afn, estados[q].T, c);
        if (!m.length) {
          estados[q].trans[c] = -1;
          continue;
        }
        const T = cerradura(afn, m);
        const ya = idx.has(T.join(','));
        const j = agregar(T);
        if (estados.length > MAX_AFD) return null;
        estados[q].trans[c] = j;
        lineas.push(`mueve(${letra(q)}, ${c}) = ${conj(m)}, y su cerradura-ε es ${conj(T)} = ${letra(j)}${ya ? '' : ', nuevo'}.`);
      }
    }
    return { estados, lineas };
  }

  /** Words of exactly length r, in the order of the alphabet, using the automaton without trying dead ends. */
  function palabrasDe(d, alfabeto, MAXL) {
    const llega = [d.estados.map((e) => e.final)];
    for (let r = 1; r <= MAXL; r += 1) llega.push(d.estados.map((e) => alfabeto.some((c) => e.trans[c] >= 0 && llega[r - 1][e.trans[c]])));
    const largos = [];
    for (let r = 0; r <= MAXL; r += 1) if (llega[r][0]) largos.push(r);
    const listar = (r, tope) => {
      const out = [];
      const ir = (q, falta, pref) => {
        if (out.length > tope) return;
        if (!falta) {
          out.push(pref);
          return;
        }
        for (const c of alfabeto) {
          const t = d.estados[q].trans[c];
          if (t >= 0 && llega[falta - 1][t]) ir(t, falta - 1, pref + c);
        }
      };
      ir(0, r, '');
      return out;
    };
    return { largos, listar };
  }

  function dibujoAFN(ayuda, afn, k, etiqueta) {
    const { svg } = ayuda;
    const CX = 54;
    const CY = 44;
    const R = 13;
    const M = 10;
    const IZQ = 44;
    const W = Math.round(IZQ + afn.w * CX + R + M + 4);
    const H = Math.round((afn.up + afn.down) * CY + 2 * M);
    const X = (x) => IZQ + x * CX;
    const Y = (y) => M + (y + afn.up) * CY;
    const ve = (p) => k === null || p <= k;
    const marca = (p) => k !== null && p === k;
    const hijos = [];
    const punta = (x, y, ux, uy, color) => svg('polygon', { points: `${x},${y} ${x - ux * 8 - uy * 4},${y - uy * 8 + ux * 4} ${x - ux * 8 + uy * 4},${y - uy * 8 - ux * 4}`, fill: color });
    const etq = (x, y, t) => svg('text', { x, y, 'text-anchor': 'middle', 'font-size': 13, fill: 'var(--tinta)', stroke: 'var(--papel)', 'stroke-width': 3, 'paint-order': 'stroke' }, t);
    const x0 = X(0);
    const y0 = Y(0);
    hijos.push(svg('line', { x1: x0 - R - 30, y1: y0, x2: x0 - R - 2, y2: y0, stroke: 'var(--tinta)', 'stroke-width': 1.5 }), punta(x0 - R - 1, y0, 1, 0, 'var(--tinta)'));
    afn.aristas.forEach((a, j) => {
      if (!ve(a.paso)) return;
      const color = marca(a.paso) ? 'var(--birome)' : 'var(--tinta-suave)';
      const ancho = marca(a.paso) ? 2.4 : 1.4;
      const p = afn.pos[a.de];
      const q = afn.pos[a.a];
      const curva = afn.curvas.get(j);
      if (curva) {
        const s = curva.arriba ? -1 : 1;
        const yl = Y(curva.nivel);
        const [x1, y1, x2, y2] = [X(p.x), Y(p.y) + s * R, X(q.x), Y(q.y) + s * (R + 1)];
        hijos.push(svg('path', { d: `M${x1},${y1} C${x1},${yl} ${x2},${yl} ${x2},${y2}`, fill: 'none', stroke: color, 'stroke-width': ancho }), punta(x2, y2, 0, -s, color), etq((x1 + x2) / 2, (y1 + y2) / 8 + (yl * 3) / 4 + (s < 0 ? -4 : 13), a.c));
        return;
      }
      const dx = X(q.x) - X(p.x);
      const dy = Y(q.y) - Y(p.y);
      const largo = Math.hypot(dx, dy) || 1;
      const ux = dx / largo;
      const uy = dy / largo;
      const [x1, y1, x2, y2] = [X(p.x) + ux * R, Y(p.y) + uy * R, X(q.x) - ux * (R + 1), Y(q.y) - uy * (R + 1)];
      let [nx, ny] = [-uy, ux];
      if (ny > 0 || (ny === 0 && nx > 0)) [nx, ny] = [-nx, -ny];
      hijos.push(svg('line', { x1, y1, x2, y2, stroke: color, 'stroke-width': ancho }), punta(x2, y2, ux, uy, color), etq((x1 + x2) / 2 + nx * 9, (y1 + y2) / 2 + ny * 9 + 4, a.c));
    });
    for (let s = 0; s < afn.n; s += 1) {
      if (!ve(afn.pasoDe[s])) continue;
      const color = marca(afn.pasoDe[s]) ? 'var(--birome)' : 'var(--tinta)';
      const ancho = marca(afn.pasoDe[s]) ? 2.4 : 1.5;
      const cx = X(afn.pos[s].x);
      const cy = Y(afn.pos[s].y);
      hijos.push(svg('circle', { cx, cy, r: R, fill: 'var(--papel)', stroke: color, 'stroke-width': ancho }));
      if (s === afn.final) hijos.push(svg('circle', { cx, cy, r: R - 3.5, fill: 'none', stroke: color, 'stroke-width': 1.2 }));
      hijos.push(svg('text', { x: cx, y: cy + 4.5, 'text-anchor': 'middle', 'font-size': s > 9 ? 11 : 13, fill: 'var(--tinta)' }, String(s)));
    }
    const dib = svg('svg', { viewBox: `0 0 ${W} ${H}`, width: W, height: H, role: 'img', 'aria-label': etiqueta }, ...hijos);
    dib.style.cssText = `display:block;width:${W}px;height:${H}px;max-width:none`;
    return dib;
  }

  // ----- Thompson, the shortest words, finite or infinite, the DFA by subsets and a string to try
  UTN.interactivo('thompson', (figura, cfg, ayuda) => {
    const { crear, lienzo, boton } = ayuda;
    const propio = enResumenDe(figura, ayuda);
    const er = campo(ayuda, 'Expresión regular', valorDe(cfg, 'er', propio, 'er'), 'er', propio);
    const cad = campo(ayuda, 'Cadena para probar (opcional)', valorDe(cfg, 'cadena', propio, 'er'), 'cadena', propio);
    const ponerEps = boton('Escribir ε', () => {
      const { selectionStart: a, selectionEnd: b, value: v } = er.inp;
      if (v.length >= TOPE.er) return;
      er.inp.value = v.slice(0, a ?? v.length) + 'ε' + v.slice(b ?? v.length);
      er.inp.focus();
      er.inp.setSelectionRange((a ?? v.length) + 1, (a ?? v.length) + 1);
      cambio();
    });
    ponerEps.disabled = !propio;
    const ayudaEr = nota(ayuda, propio, 'Operadores | . * + ? y paréntesis. Los símbolos son letras o dígitos, y la cadena vacía va con el botón ε.');
    const error = crear('p', { className: 'w-error', role: 'status' });
    error.hidden = true;
    const titular = crear('p', { className: 'w-titular', 'aria-live': 'polite' });
    const lengua = crear('div', { className: 'w-resultado' });
    const marco = crear('div', {});
    marco.style.cssText = 'max-width:100%;overflow-x:auto;margin:.4rem 0';
    const pasoTxt = crear('p', { 'aria-live': 'off' });
    pasoTxt.style.minHeight = '2.6em';
    let k = null;
    let hecho = null;
    const dibujar = () => {
      if (!hecho) return;
      const { afn, r } = hecho;
      const total = afn.pasos.length;
      marco.replaceChildren(dibujoAFN(ayuda, afn, k, `AFN de Thompson de ${r}, con ${afn.n} estados. Inicio ${afn.inicio} y final ${afn.final}.`));
      pasoTxt.textContent = k === null ? `AFN entero, con ${afn.n} estados, del 0 al ${afn.n - 1}. Inicio ${afn.inicio} y final ${afn.final}.` : `Paso ${k + 1} de ${total}. ${afn.pasos[k]}`;
      bAnt.disabled = k === 0;
      bSig.disabled = k !== null && k >= total - 1;
      bTodo.disabled = k === null;
    };
    const ir = (nuevo) => {
      k = nuevo;
      pasoTxt.setAttribute('aria-live', 'polite');
      dibujar();
    };
    const bPrin = boton('Desde el principio', () => ir(0));
    const bAnt = boton('Paso anterior', () => ir(k === null ? hecho.afn.pasos.length - 1 : Math.max(0, k - 1)));
    const bSig = boton('Paso siguiente', () => ir(k === null ? 0 : Math.min(hecho.afn.pasos.length - 1, k + 1)));
    const bTodo = boton('Ver el AFN entero', () => ir(null));
    const controles = crear('div', { className: 'w-botones', role: 'group', 'aria-label': 'Pasos de la construcción' }, bPrin, bAnt, bSig, bTodo);
    const tablaAfn = crear('div', {});
    const subc = crear('div', {});
    const prueba = crear('div', {});
    const seccion = crear('div', {}, titulo(ayuda, 'Construcción de Thompson'), controles, pasoTxt, marco, tablaAfn, subc, prueba);
    const calcular = () => {
      hecho = null;
      k = null;
      er.inp.setAttribute('aria-invalid', 'false');
      let raiz;
      try {
        raiz = leerER(er.inp.value);
        if (tamano(raiz) > MAX_ESTADOS) throw new Error(`Esa e.r. arma un AFN de más de ${MAX_ESTADOS} estados. Probá con una más corta.`);
      } catch (e) {
        er.inp.setAttribute('aria-invalid', 'true');
        error.textContent = e.message;
        error.hidden = false;
        titular.textContent = '';
        lengua.replaceChildren();
        seccion.hidden = true;
        return;
      }
      error.hidden = true;
      seccion.hidden = false;
      const r = er.inp.value.trim();
      const afn = thompson(raiz);
      const d = afd(afn);
      // What the language is: finite or not, whether ε is in it, and its shortest words.
      const repite = cerraduraQueRepite(raiz);
      const lineas = [];
      lineas.push(repite ? `Es infinito, porque ${repite.txt} es una cerradura que se puede repetir sin límite.` : soloVacia(raiz) ? 'Es finito. Solo tiene la cadena vacía.' : 'Es finito, porque no tiene una cerradura que repita símbolos. Solo alternativas y concatenaciones.');
      lineas.push(tieneVacia(raiz) ? 'ε está en el lenguaje.' : 'ε no está en el lenguaje.');
      let resumen = repite ? 'Lenguaje infinito.' : 'Lenguaje finito.';
      if (d) {
        const p = palabrasDe(d, afn.alfabeto, 50);
        const ver = (x) => x || 'ε';
        const de = (r2) => {
          const ws = p.listar(r2, 12);
          return ws.length > 12 ? `${ws.slice(0, 12).map(ver).join(', ')} y más` : yLista(ws.map(ver));
        };
        const [m, sig] = p.largos;
        const ws = p.listar(m, 12);
        lineas.push(ws.length === 1 ? `La palabra más corta es ${ver(ws[0])}, de longitud ${m}.` : `Las más cortas, de longitud ${m}, son ${de(m)}.`);
        if (sig !== undefined) lineas.push(`Las que siguen, de longitud ${sig}, son ${de(sig)}.`);
        if (!repite && p.largos.length) {
          const todas = p.largos.flatMap((x) => p.listar(x, 40));
          if (todas.length <= 40) lineas.push(`L(r) = {${todas.map(ver).join(', ')}}.`);
        }
        resumen += ` La palabra más corta es ${ver(ws[0])}.`;
      } else lineas.push(`El AFD pasa de ${MAX_AFD} estados, así que no calculo las palabras.`);
      titular.textContent = resumen;
      lengua.replaceChildren(titulo(ayuda, `El lenguaje de ${r}`), listaDe(ayuda, lineas, false));
      // Transition table of the NFA, with ∅ where there is no transition, as in the notes.
      const cols = [...afn.alfabeto, 'ε'];
      const filas = Array.from({ length: afn.n }, (_, s) => [`${s}${s === afn.inicio ? ' inicio' : ''}${s === afn.final ? ' final' : ''}`, ...cols.map((c) => {
        const t = afn.aristas.filter((a) => a.de === s && a.c === c).map((a) => a.a).sort((x, y) => x - y);
        return t.length ? conj(t) : '∅';
      })]);
      tablaAfn.replaceChildren(tablaDe(ayuda, ['Estado', ...cols], filas, 'Tabla de transiciones del AFN'));
      // DFA by subsets
      let filasD = null;
      const LINEAS = 30;
      if (d && d.estados.length <= 26) {
        filasD = d.estados.map((e, q) => [`${letra(q)}${e.final ? ' final' : ''}`, conj(e.T), ...afn.alfabeto.map((c) => (e.trans[c] >= 0 ? letra(e.trans[c]) : '—'))]);
        const ls = d.lineas.length > LINEAS ? [...d.lineas.slice(0, LINEAS), `Y ${d.lineas.length - LINEAS} cálculos más, que están en la tabla.`] : d.lineas;
        subc.replaceChildren(titulo(ayuda, 'AFD por subconjuntos'), listaDe(ayuda, ls), tablaDe(ayuda, ['AFD', 'Estados del AFN', ...afn.alfabeto], filasD, `Es final el conjunto que tiene al ${afn.final}. Con —, mueve da ∅ y no hay transición.`));
      } else subc.replaceChildren(titulo(ayuda, 'AFD por subconjuntos'), crear('p', {}, d ? `El AFD tiene ${d.estados.length} estados y no entra en una tabla. El tope es 26.` : `El AFD pasa de ${MAX_AFD} estados.`));
      // A string tried on the DFA, step by step: accepted, not accepted or aborted.
      const lineasC = [];
      const texto = cad.inp.value.replace(/\s+/g, '');
      if (texto && d) {
        const w = texto === 'ε' ? '' : texto.replace(/ε/g, '');
        let q = 0;
        let corta = false;
        for (const c of w) {
          const t = afn.alfabeto.includes(c) ? d.estados[q].trans[c] : -1;
          if (t < 0) {
            lineasC.push(afn.alfabeto.includes(c) ? `Desde ${letra(q)} no hay arista con ${c}. La cadena queda abortada.` : `${c} no está en el alfabeto de la e.r., así que no hay arista. La cadena queda abortada.`);
            corta = true;
            break;
          }
          lineasC.push(`Con ${c}, de ${letra(q)} a ${letra(t)}.`);
          q = t;
        }
        if (!corta) lineasC.push(d.estados[q].final ? `Termina en ${letra(q)}, que es final. La cadena es aceptada.` : `Termina en ${letra(q)}, que no es final. La cadena no es aceptada.`);
        prueba.replaceChildren(titulo(ayuda, `Probar ${w || 'ε'} en el AFD`), listaDe(ayuda, [`Empieza en A.`, ...lineasC]));
      } else prueba.replaceChildren();
      hecho = { afn, r, lineas, filas, cols, d, filasD, lineasC, w: texto === 'ε' ? 'ε' : texto.replace(/ε/g, '') || 'ε' };
      pasoTxt.setAttribute('aria-live', 'off');
      dibujar();
    };
    const cambio = () => {
      calcular();
      if (propio) ayuda.guardarDatos?.({ er: er.inp.value, cadena: cad.inp.value });
    };
    er.inp.addEventListener('input', cambio);
    cad.inp.addEventListener('input', cambio);
    const filaEr = crear('div', { className: 'w-fila' }, er.fila, ponerEps);
    filaEr.style.cssText = 'display:flex;align-items:flex-end;gap:.5rem;margin:0';
    er.fila.style.flex = '1 1 12rem';
    ponerEps.style.marginBottom = '.5rem';
    lienzo.append(filaEr, cad.fila, ayudaEr, error, titular, lengua, seccion);
    calcular();
    const imagen = async () => {
      if (!hecho) return null;
      const { afn, r, lineas, filas, cols, d, filasD, lineasC, w } = hecho;
      const antes = k;
      k = null;
      dibujar();
      const partes = [
        { texto: `r = ${r}`, negrita: true },
        ...lineas.map((t) => ({ texto: t })),
        { texto: 'Construcción de Thompson', negrita: true },
        ...afn.pasos.map((t, i) => ({ texto: `${i + 1}. ${t}` })),
        { cab: ['Estado', ...cols], tabla: filas, resaltar: 0 },
        ...(filasD ? [{ texto: 'AFD por subconjuntos', negrita: true }, ...d.lineas.map((t) => ({ texto: t })), { cab: ['AFD', 'Estados del AFN', ...afn.alfabeto], tabla: filasD, resaltar: 0 }] : []),
        ...(lineasC.length ? [{ texto: `Probar ${w} en el AFD`, negrita: true }, { texto: 'Empieza en A.' }, ...lineasC.map((t) => ({ texto: t }))] : []),
      ];
      const png = await apilar(ayuda, marco.querySelector('svg'), partes);
      k = antes;
      dibujar();
      return png;
    };
    return { imagen };
  });

  // ===== Grammars: productions as the notes write them, A -> aB | b, with capitals for the non-terminals
  const esNT = (c) => /^\p{Lu}$/u.test(c);
  function leerGramatica(texto) {
    let t = texto.trim().replace(/^P\s*=\s*/, '');
    if (t.startsWith('{') && t.endsWith('}')) t = t.slice(1, -1);
    const items = t.split(/[\n;,]+/).map((s) => s.trim()).filter(Boolean);
    if (!items.length) return { error: 'Escribí las producciones, como S -> aS | b.' };
    const prods = [];
    for (let it of items) {
      // The notes write each production as a pair, (A → B1). Those parentheses go, but not the ones of E -> (E).
      if (it.startsWith('(') && it.endsWith(')') && /->|→/.test(it)) it = it.slice(1, -1).trim();
      const partes = it.split(/->|→/);
      if (partes.length < 2) return { error: `A «${corto(it)}» le falta la flecha, como en S -> aS.` };
      if (partes.length > 2) return { error: `«${corto(it)}» tiene más de una flecha. Poné una producción por renglón.` };
      const izq = partes[0].replace(/\s+/g, '').replace(/ε/g, '');
      if (!izq) return { error: `«${corto(it)}» no tiene nada a la izquierda de la flecha.` };
      if (izq.length > 10) return { error: `La izquierda de «${corto(it)}» es muy larga. El tope son 10 símbolos.` };
      for (const alt of partes[1].split('|')) {
        const der = alt.replace(/\s+/g, '').replace(/ε/g, '');
        if (der.length > 20) return { error: `«${corto(alt.trim())}» es muy larga. El tope son 20 símbolos.` };
        if (!prods.some((p) => p.izq === izq && p.der === der)) prods.push({ izq, der });
      }
      if (prods.length > 40) return { error: 'Son más de 40 producciones. Probá con menos.' };
    }
    const izqs = prods.map((p) => p.izq);
    const axioma = esNT(izqs[0]) ? izqs[0] : [...izqs.join('')].find(esNT);
    if (!axioma) return { error: 'Falta un no terminal a la izquierda. Van en mayúsculas, como S.' };
    const simbolos = [...new Set(prods.flatMap((p) => [...p.izq, ...p.der]))];
    const VN = [axioma, ...simbolos.filter((c) => esNT(c) && c !== axioma)];
    const VT = simbolos.filter((c) => !esNT(c));
    return { prods, axioma, VN, VT, libre: prods.every((p) => p.izq.length === 1 && esNT(p.izq)) };
  }
  const flecha = (p) => `${p.izq} → ${p.der || 'ε'}`;
  const esTipo1 = (izq, der) => {
    for (let i = 0; i < izq.length; i += 1) {
      if (esNT(izq[i])) {
        const a = izq.slice(0, i);
        const b = izq.slice(i + 1);
        if (der.length >= a.length + b.length + 1 && der.startsWith(a) && der.endsWith(b)) return true;
      }
    }
    return false;
  };
  /** The type of one production, by the forms of the notes, and why it does not reach the next one. */
  function tipoDe(p, axioma, conEps) {
    const { izq, der } = p;
    const unNT = izq.length === 1 && esNT(izq);
    if (!der) {
      if (unNT && (izq === axioma || conEps)) return { tipo: 3, forma: 'eps', por: izq === axioma ? `El apunte admite ${axioma} → ε en el axioma.` : 'Da la cadena vacía.' };
      return { tipo: 0, eps: unNT, por: unNT ? `Da ε y ${izq} no es el axioma. El apunte admite ε solo en ${axioma} → ε.` : 'La derecha es ε, así que achica la cadena.' };
    }
    if (unNT) {
      const nts = [...der].filter(esNT).length;
      if (!nts) return { tipo: 3, forma: 'term', por: 'Da solo terminales.' };
      if (nts === 1 && der.length > 1 && esNT(der[der.length - 1])) return { tipo: 3, forma: 'der', por: 'Terminales y un no terminal al final. Es regular por la derecha.' };
      if (nts === 1 && der.length > 1 && esNT(der[0])) return { tipo: 3, forma: 'izq', por: 'Un no terminal al principio y terminales. Es regular por la izquierda.' };
      return { tipo: 2, por: der.length === 1 ? 'Pasa de un no terminal a otro sin terminales, y eso no es regular.' : 'Un solo no terminal a la izquierda, pero la derecha no tiene la forma regular.' };
    }
    if (esTipo1(izq, der)) return { tipo: 1, por: 'Reemplaza un no terminal según lo que lo rodea, sin achicar la cadena.' };
    return { tipo: 0, por: der.length < izq.length ? 'La derecha es más corta que la izquierda.' : 'No se puede escribir como αAβ → αγβ, aunque no achica la cadena.' };
  }
  const NOMBRE_TIPO = ['tipo 0, sin restricciones', 'tipo 1, dependiente del contexto', 'tipo 2, libre del contexto', 'tipo 3, regular'];
  const MAQUINA = ['una máquina de Turing', 'un autómata linealmente acotado', 'un autómata de pila', 'un autómata finito'];
  function clasificar(g, conEps) {
    const tipos = g.prods.map((p) => tipoDe(p, g.axioma, conEps));
    let tipo = Math.min(...tipos.map((t) => t.tipo));
    const formas = new Set(tipos.map((t) => t.forma));
    const mezcla = tipo === 3 && formas.has('der') && formas.has('izq');
    if (mezcla) tipo = 2;
    const lado = formas.has('izq') ? ' por la izquierda' : formas.has('der') ? ' por la derecha' : '';
    return { tipos, tipo, mezcla, lado };
  }

  /** For a context-free grammar: shortest length of each non-terminal, which ones generate, and the words. */
  function lenguaje(g) {
    const NT = g.VN;
    const largo = new Map(NT.map((A) => [A, Infinity]));
    const med = (c) => (esNT(c) ? largo.get(c) ?? Infinity : 1);
    for (let vuelta = 0, otra = true; otra && vuelta < 100; vuelta += 1) {
      otra = false;
      for (const p of g.prods) {
        const v = [...p.der].reduce((a, c) => a + med(c), 0);
        if (v < largo.get(p.izq)) {
          largo.set(p.izq, v);
          otra = true;
        }
      }
    }
    const genera = (c) => !esNT(c) || Number.isFinite(largo.get(c));
    const utiles = g.prods.filter((p) => genera(p.izq) && [...p.der].every(genera));
    const alcanza = new Set([g.axioma]);
    for (let otra = true; otra;) {
      otra = false;
      for (const p of utiles) {
        if (!alcanza.has(p.izq)) continue;
        for (const c of p.der) {
          if (esNT(c) && !alcanza.has(c)) {
            alcanza.add(c);
            otra = true;
          }
        }
      }
    }
    const usadas = utiles.filter((p) => alcanza.has(p.izq));
    // A non-terminal that can give a non-empty word.
    const lleno = new Set();
    for (let otra = true; otra;) {
      otra = false;
      for (const p of usadas) {
        if (!lleno.has(p.izq) && [...p.der].some((c) => !esNT(c) || lleno.has(c))) {
          lleno.add(p.izq);
          otra = true;
        }
      }
    }
    // Infinite when a non-terminal comes back on itself while some other symbol of the way adds terminals.
    const llega = (de, a) => {
      const vistos = new Set([de]);
      const cola = [{ X: de, camino: [] }];
      while (cola.length) {
        const { X, camino } = cola.shift();
        if (X === a) return camino;
        for (const p of usadas) {
          if (p.izq !== X) continue;
          for (const c of new Set(p.der)) {
            if (esNT(c) && !vistos.has(c)) {
              vistos.add(c);
              cola.push({ X: c, camino: [...camino, p] });
            }
          }
        }
      }
      return null;
    };
    let ciclo = null;
    for (const p of usadas) {
      if (ciclo) break;
      [...p.der].forEach((c, j) => {
        if (ciclo || !esNT(c)) return;
        const suma = [...p.der].some((x, i) => i !== j && (!esNT(x) || lleno.has(x)));
        if (!suma) return;
        const vuelta = llega(c, p.izq);
        if (vuelta) ciclo = [p, ...vuelta];
      });
    }
    // Words up to a length, by rounds, keeping at most TOPE of each non-terminal (the shortest).
    const m = largo.get(g.axioma);
    let maxLargo = Infinity;
    if (!ciclo && Number.isFinite(m)) {
      const mayor = new Map(NT.map((A) => [A, -Infinity]));
      for (let vuelta = 0; vuelta < NT.length + 2; vuelta += 1) {
        for (const p of usadas) {
          const v = [...p.der].reduce((a, c) => a + (esNT(c) ? mayor.get(c) : 1), 0);
          if (v > mayor.get(p.izq)) mayor.set(p.izq, v);
        }
      }
      maxLargo = mayor.get(g.axioma);
    }
    const L = Number.isFinite(m) ? Math.min(40, Number.isFinite(maxLargo) ? maxLargo : m + 8) : 0;
    const TOPE_P = 300;
    const W = new Map(NT.map((A) => [A, new Set()]));
    let trabajo = 0;
    let cortado = false;
    for (let vuelta = 0, otra = Number.isFinite(m); otra && vuelta < 60; vuelta += 1) {
      otra = false;
      for (const p of usadas) {
        let parciales = [''];
        for (const c of p.der) {
          const sig = [];
          const opciones = esNT(c) ? [...W.get(c)] : [c];
          for (const a of parciales) {
            for (const b of opciones) {
              trabajo += 1;
              if (a.length + b.length > L) continue;
              if (sig.length < TOPE_P) sig.push(a + b);
              else cortado = true;
            }
          }
          parciales = sig;
        }
        const S = W.get(p.izq);
        for (const w of parciales) {
          if (S.has(w)) continue;
          if (S.size >= TOPE_P) {
            cortado = true;
            break;
          }
          S.add(w);
          otra = true;
        }
      }
      if (trabajo > 400000) {
        cortado = true;
        break;
      }
    }
    const palabras = [...(W.get(g.axioma) || [])].sort((a, b) => a.length - b.length || (a < b ? -1 : a > b ? 1 : 0));
    return { m, ciclo, palabras, L, cortado, completo: !ciclo && Number.isFinite(maxLargo) && maxLargo <= 40 && !cortado, sinUso: NT.filter((A) => !Number.isFinite(largo.get(A))), largo };
  }

  /** A derivation of the word, the shortest one. In a context-free grammar it replaces the leftmost (or rightmost)
   * non-terminal; otherwise any part that matches a left side. */
  function derivar(g, objetivo, lado, largo) {
    const conNT = [...objetivo].some(esNT);
    const libre = g.libre && !conNT;
    const tope = objetivo.length + (libre ? 10 : 6);
    const terminales = [...objetivo].filter((c) => !esNT(c)).length;
    const min = (f) => [...f].reduce((a, c) => a + (esNT(c) ? largo.get(c) ?? Infinity : 1), 0);
    const sirve = (f) => {
      if (!g.libre) return true;
      if ([...f].filter((c) => !esNT(c)).length > terminales) return false;
      if (conNT) return true;
      if (min(f) > objetivo.length) return false;
      const a = [...f].findIndex(esNT);
      if (a < 0) return f === objetivo;
      const b = f.length - 1 - [...f].reverse().findIndex(esNT);
      return objetivo.startsWith(f.slice(0, a)) && objetivo.endsWith(f.slice(b + 1));
    };
    const visto = new Map([[g.axioma, null]]);
    const cola = [g.axioma];
    let cortado = false;
    for (let h = 0; h < cola.length; h += 1) {
      const f = cola[h];
      if (f === objetivo) {
        const camino = [];
        for (let x = f; x !== null; x = visto.get(x)?.de ?? null) camino.unshift({ f: x, p: visto.get(x)?.p });
        return { camino, libre };
      }
      if (visto.size > 30000) {
        cortado = true;
        break;
      }
      const hijos = [];
      if (libre) {
        const nts = [...f].map((c, i) => (esNT(c) ? i : -1)).filter((i) => i >= 0);
        if (!nts.length) continue;
        const i = lado === 'derecha' ? nts[nts.length - 1] : nts[0];
        for (const p of g.prods) if (p.izq === f[i]) hijos.push({ nf: f.slice(0, i) + p.der + f.slice(i + 1), p });
      } else {
        for (const p of g.prods) {
          for (let i = f.indexOf(p.izq); i >= 0; i = f.indexOf(p.izq, i + 1)) hijos.push({ nf: f.slice(0, i) + p.der + f.slice(i + p.izq.length), p });
        }
      }
      for (const { nf, p } of hijos) {
        if (visto.has(nf)) continue;
        if (nf.length > tope) {
          cortado = true;
          continue;
        }
        if (!sirve(nf)) continue;
        visto.set(nf, { de: f, p });
        cola.push(nf);
      }
    }
    return { camino: null, cortado, revisadas: visto.size, libre };
  }

  UTN.interactivo('gramatica', (figura, cfg, ayuda) => {
    const { crear, lienzo } = ayuda;
    const propio = enResumenDe(figura, ayuda);
    const pr = campo(ayuda, 'Producciones', valorDe(cfg, 'producciones', propio, 'producciones'), 'producciones', propio, true);
    const pal = campo(ayuda, 'Palabra para derivar (opcional)', valorDe(cfg, 'palabra', propio, 'producciones'), 'palabra', propio);
    let lado = valorDe(cfg, 'lado', propio, 'producciones') === 'derecha' ? 'derecha' : 'izquierda';
    const idLado = nuevoId();
    const selLado = crear('select', { id: idLado, disabled: !propio }, crear('option', { value: 'izquierda', selected: lado === 'izquierda' }, 'Por la izquierda'), crear('option', { value: 'derecha', selected: lado === 'derecha' }, 'Por la derecha'));
    selLado.style.maxWidth = '100%';
    const filaLado = crear('div', { className: 'w-fila' }, crear('span', { className: 'w-campo' }, crear('label', { htmlFor: idLado }, 'Derivación'), selLado));
    const ayudaG = nota(ayuda, propio, 'Una producción por renglón, como S -> aS | b. Los no terminales van en mayúscula, y la cadena vacía se escribe ε o se deja vacía.');
    const error = crear('p', { className: 'w-error', role: 'status' });
    error.hidden = true;
    const titular = crear('p', { className: 'w-titular', 'aria-live': 'polite' });
    const salida = crear('div', { className: 'w-resultado' });
    let hecho = null;
    const calcular = () => {
      hecho = null;
      pr.inp.setAttribute('aria-invalid', 'false');
      const g = leerGramatica(pr.inp.value);
      if (g.error) {
        pr.inp.setAttribute('aria-invalid', 'true');
        error.textContent = g.error;
        error.hidden = false;
        titular.textContent = '';
        salida.replaceChildren();
        return;
      }
      error.hidden = true;
      const c = clasificar(g, false);
      const conEps = c.tipos.some((t) => t.eps) ? clasificar(g, true) : null;
      const peor = g.prods.find((p, i) => c.tipos[i].tipo === Math.min(...c.tipos.map((t) => t.tipo)));
      const quien = c.mezcla ? 'Mezcla producciones regulares por la derecha y por la izquierda, así que no llega a tipo 3.' : c.tipo < 3 ? `${flecha(peor)} no llega a tipo ${c.tipo + 1}. ${c.tipos[g.prods.indexOf(peor)].por}` : 'Todas las producciones tienen la forma regular.';
      const lineasT = [
        `G = {VT, VN, P, S}, con VT = {${g.VT.join(', ')}}, VN = {${g.VN.join(', ')}} y axioma ${g.axioma}.`,
        quien,
        `Lo reconoce ${MAQUINA[c.tipo]}.`,
        ...(conEps && conEps.tipo !== c.tipo ? [`Si tu cátedra acepta ε en cualquier no terminal, sería de ${NOMBRE_TIPO[conEps.tipo]}${conEps.tipo === 3 ? conEps.lado : ''}.`] : []),
      ];
      const filasT = g.prods.map((p, i) => [flecha(p), String(c.tipos[i].tipo), c.tipos[i].por]);
      titular.textContent = `Es de ${NOMBRE_TIPO[c.tipo]}${c.tipo === 3 ? c.lado : ''}.`;
      const partes = [titulo(ayuda, 'Tipo en la jerarquía de Chomsky'), listaDe(ayuda, lineasT, false), tablaDe(ayuda, ['Producción', 'Tipo', 'Por qué'], filasT, 'Cada producción, con el tipo más alto que cumple', 2)];
      // The language: only worked out for context-free grammars, where the left side is one non-terminal.
      const lineasL = [];
      let len = null;
      if (g.libre) {
        len = lenguaje(g);
        const ver = (w) => w || 'ε';
        if (!Number.isFinite(len.m)) lineasL.push(`No genera ninguna palabra, porque ${g.axioma} nunca termina en terminales.`);
        else {
          const ciclo = len.ciclo;
          lineasL.push(ciclo ? `Es infinito. Con ${ciclo.map(flecha).join(' y ')}, ${ciclo[0].izq} vuelve a aparecer y suma terminales, así que se repite sin límite.` : 'Es finito, porque ninguna recursión suma terminales.');
          const porLargo = (n) => len.palabras.filter((w) => w.length === n);
          const m = len.m;
          const primeras = porLargo(m);
          const mas = (ws) => (ws.length > 10 ? `${ws.slice(0, 10).map(ver).join(', ')} y más` : yLista(ws.map(ver)));
          lineasL.push(primeras.length === 1 ? `La palabra más corta es ${ver(primeras[0])}, de longitud ${m}.` : `Las más cortas, de longitud ${m}, son ${mas(primeras)}.`);
          const sig = len.palabras.find((w) => w.length > m);
          if (sig !== undefined) {
            const ws = porLargo(sig.length);
            lineasL.push(ws.length === 1 ? `La que sigue es ${ver(ws[0])}, de longitud ${sig.length}.` : `Las que siguen, de longitud ${sig.length}, son ${mas(ws)}.`);
          }
          if (len.completo && len.palabras.length <= 40) lineasL.push(`L(G) = {${len.palabras.map(ver).join(', ')}}.`);
        }
        if (len.sinUso.length) lineasL.push(`${yLista(len.sinUso)} nunca ${len.sinUso.length > 1 ? 'terminan' : 'termina'} en terminales, así que no ${len.sinUso.length > 1 ? 'aportan' : 'aporta'} palabras.`);
      } else lineasL.push('No es libre del contexto, así que acá no calculo sus palabras ni si es finito. Probá derivar una palabra.');
      partes.push(titulo(ayuda, 'Palabras que genera'), listaDe(ayuda, lineasL, false));
      // The derivation of the word the student wrote.
      filaLado.hidden = !g.libre;
      const objetivo = pal.inp.value.replace(/\s+/g, '').replace(/ε/g, '');
      let lineasD = [];
      let tituloD = '';
      if (pal.inp.value.trim()) {
        const d = derivar(g, objetivo, lado, len ? len.largo : new Map());
        const ver = (w) => w || 'ε';
        tituloD = `Derivación de ${ver(objetivo)}${d.libre ? ` por la ${lado}` : ''}`;
        if (d.camino) {
          // Long derivations keep the whole chain but explain only the first 20 steps, so the list stays readable.
          const pasos = d.camino.slice(1).map((x, i) => `${ver(d.camino[i].f)} ⇒ ${ver(x.f)}, con ${flecha(x.p)}.`);
          const PASOS = 20;
          lineasD = [d.camino.map((x) => ver(x.f)).join(' ⇒ '), ...pasos.slice(0, PASOS)];
          if (pasos.length > PASOS) lineasD.push(`Siguen ${pasos.length - PASOS} pasos más del mismo modo, hasta llegar a ${ver(objetivo)}.`);
          const medio = d.camino.slice(1, -1).map((x) => ver(x.f));
          const esForma = [...objetivo].some(esNT);
          lineasD.push(esForma ? `${ver(objetivo)} es una forma sentencial, porque sale del axioma y todavía tiene no terminales.` : `${ver(objetivo)} es una sentencia, porque sale del axioma y tiene solo terminales.${medio.length ? ` ${medio.length > 6 ? 'Las del medio son formas sentenciales' : medio.length > 1 ? `Las del medio, ${yLista(medio)}, son formas sentenciales` : `${medio[0]} es una forma sentencial`}.` : ''}`);
          if (!d.libre && g.libre) lineasD.push('Como tiene no terminales, se reemplaza el que haga falta y no siempre el de un lado.');
          if (!g.libre) lineasD.push('Como no es libre del contexto, se reemplaza la parte de la izquierda donde aparezca.');
        } else if (d.cortado) lineasD = [`No la encontré revisando ${d.revisadas} formas sentenciales. Puede que la gramática no la genere.`];
        else lineasD = [`La gramática no genera ${ver(objetivo)}. Ninguna derivación desde ${g.axioma} llega a ella.`];
        partes.push(titulo(ayuda, tituloD), listaDe(ayuda, lineasD, false));
      } else partes.push(crear('p', { className: 'w-ayuda' }, 'Escribí una palabra arriba para ver su derivación paso a paso.'));
      salida.replaceChildren(...partes);
      hecho = { g, c, lineasT, filasT, lineasL, lineasD, tituloD };
    };
    const guardar = () => {
      if (propio) ayuda.guardarDatos?.({ producciones: pr.inp.value, palabra: pal.inp.value, lado });
    };
    [pr, pal].forEach((x) => x.inp.addEventListener('input', () => {
      calcular();
      guardar();
    }));
    selLado.addEventListener('change', () => {
      lado = selLado.value === 'derecha' ? 'derecha' : 'izquierda';
      calcular();
      guardar();
    });
    lienzo.append(pr.fila, ayudaG, error, pal.fila, filaLado, titular, salida);
    calcular();
    const imagen = () => {
      if (!hecho) return Promise.resolve(null);
      const { g, lineasT, filasT, lineasL, lineasD, tituloD } = hecho;
      return apilar(ayuda, null, [
        { texto: `P = {${g.prods.map(flecha).join(', ')}}`, negrita: true },
        { texto: titular.textContent, negrita: true },
        ...lineasT.map((t) => ({ texto: t })),
        { cab: ['Producción', 'Tipo', 'Por qué'], tabla: filasT },
        { texto: 'Palabras que genera', negrita: true },
        ...lineasL.map((t) => ({ texto: t })),
        ...(lineasD.length ? [{ texto: tituloD, negrita: true }, ...lineasD.map((t) => ({ texto: t }))] : []),
      ]);
    };
    return { imagen };
  });
})();
