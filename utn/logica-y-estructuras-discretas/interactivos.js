// On the subject's pages, fixed walk-throughs of examples from the course notes: neither widget takes free input
// there, so a page cannot be fed the data of an exam question. In a person's own summary (ayuda.enResumen) both take
// the student's own set and relation, or tree: see the start of the file.
(() => {
  // ===== In a person's own summary (ayuda.enResumen) both take the student's own data: a set and a relation, or a tree.
  // cfg.datos is untrusted: only known keys with a string within its cap, read by the parsers below.
  const enResumenDe = (figura, ayuda) => ayuda.enResumen ?? figura.classList.contains('ag-pieza');
  const leerDatos = (cfg) => {
    const d = cfg && cfg.datos && typeof cfg.datos === 'object' && !Array.isArray(cfg.datos) ? cfg.datos : {};
    return (k, def, tope = 40) => (Object.prototype.hasOwnProperty.call(d, k) && typeof d[k] === 'string' && d[k].length <= tope ? d[k] : def);
  };
  let nCampo = 0;
  function campoDe(ayuda, etq, valor, tope) {
    const id = `led-p${(nCampo += 1)}`;
    const inp = ayuda.crear('input', { id, type: 'text', autocomplete: 'off', spellcheck: false, autocapitalize: 'off', value: valor, maxLength: tope });
    inp.style.width = '100%';
    inp.style.boxSizing = 'border-box';
    return { inp, fila: ayuda.crear('div', { className: 'w-entrada' }, ayuda.crear('label', { htmlFor: id }, etq), inp) };
  }
  function elegirDe(ayuda, etq, opciones, actual) {
    const id = `led-p${(nCampo += 1)}`;
    const sel = ayuda.crear('select', { id }, ...opciones.map(([v, t]) => ayuda.crear('option', { value: v, selected: v === actual }, t)));
    sel.style.maxWidth = '100%';
    return { sel, fila: ayuda.crear('div', { className: 'w-fila' }, ayuda.crear('span', { className: 'w-campo' }, ayuda.crear('label', { htmlFor: id }, etq), sel)) };
  }
  /** The picture: the drawing as on screen and, under it, the texts and tables (ayuda.pngTablas). */
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
  const MAX_ELEMENTOS = 10;
  const ELEMENTO = /^[^\s(),;{}]{1,6}$/;
  /** A set as typed: {1, 2, 3} or a b c. Elements of up to 6 characters, without repeats. */
  function leerConjunto(texto) {
    const partes = String(texto).replace(/[{}]/g, ' ').split(/[\s,;]+/).filter(Boolean);
    if (!partes.length) return { error: 'Escribí los elementos del conjunto A.' };
    if (partes.length > MAX_ELEMENTOS) return { error: `A tiene ${partes.length} elementos: hasta ${MAX_ELEMENTOS}.` };
    const mal = partes.find((p) => !ELEMENTO.test(p));
    if (mal) return { error: `«${mal.slice(0, 12)}» es muy largo: cada elemento, hasta 6 caracteres.` };
    const repetido = partes.find((p, i) => partes.indexOf(p) !== i);
    if (repetido) return { error: `${repetido} está repetido en A.` };
    return { elementos: partes };
  }
  /** The pairs as typed: (1,2), (2,3). Every element has to be in A. */
  function leerPares(texto, elementos) {
    const t = String(texto).trim();
    const pares = [];
    const vistos = new Set();
    const PAR = /\(\s*([^\s(),;{}]+)\s*[,;]\s*([^\s(),;{}]+)\s*\)/g;
    let resto = t;
    for (const m of t.matchAll(PAR)) {
      for (const e of [m[1], m[2]]) if (!elementos.includes(e)) return { error: `En ${m[0]}, ${e.slice(0, 12)} no está en A.` };
      const k = `${m[1]},${m[2]}`;
      if (!vistos.has(k)) {
        vistos.add(k);
        pares.push([m[1], m[2]]);
      }
      resto = resto.replace(m[0], ' ');
    }
    const sobra = resto.replace(/[\s,;{}∅]/g, '');
    if (sobra) return { error: `No entiendo «${sobra.slice(0, 16)}». Escribí los pares así: (1,2), (2,3). Una relación vacía, con el campo vacío.` };
    return { pares };
  }
  const LISTA_MAX = 24;
  const lista = (xs) => (xs.length > LISTA_MAX ? `${xs.slice(0, LISTA_MAX).join(', ')} y ${xs.length - LISTA_MAX} más` : xs.join(', '));
  /** The six properties of the notes, each one on its own, with the pair that breaks it or the pairs that verify it. */
  function propiedades(elementos, pares) {
    const hay = new Set(pares.map(([a, b]) => `${a},${b}`));
    const esta = (a, b) => hay.has(`${a},${b}`);
    const p = (a, b) => `(${a},${b})`;
    const bucles = pares.filter(([a, b]) => a === b);
    const sinBucle = elementos.find((a) => !esta(a, a));
    const idaSinVuelta = pares.find(([a, b]) => !esta(b, a));
    const idaYVuelta = pares.find(([a, b]) => a !== b && esta(b, a));
    const cadenas = [];
    let rota = null;
    for (const [a, x] of pares) {
      for (const [y, b] of pares) {
        if (x !== y) continue;
        if (!esta(a, b)) {
          rota = rota || [a, x, b];
        } else cadenas.push(`${p(a, x)} y ${p(x, b)} dan ${p(a, b)}`);
      }
    }
    const filas = [
      ['Reflexiva', !sinBucle, sinBucle ? `${p(sinBucle, sinBucle)} no está.` : `Están ${lista(elementos.map((a) => p(a, a)))}.`],
      ['Irreflexiva', !bucles.length, bucles.length ? `${p(...bucles[0])} está.` : 'Ningún elemento está relacionado con sí mismo.'],
      ['Simétrica', !idaSinVuelta, idaSinVuelta ? `${p(...idaSinVuelta)} está y ${p(idaSinVuelta[1], idaSinVuelta[0])} no.` : pares.length ? `Cada par tiene su vuelta: ${lista(pares.map(([a, b]) => p(a, b)))}.` : 'No hay ningún par: se cumple por vacuidad.'],
      ['Asimétrica', !bucles.length && !idaYVuelta, bucles.length ? `${p(...bucles[0])} está, y la asimétrica no deja bucles.` : idaYVuelta ? `${p(...idaYVuelta)} y ${p(idaYVuelta[1], idaYVuelta[0])} están las dos.` : pares.length ? 'Ningún par tiene vuelta y no hay bucles.' : 'No hay ningún par: se cumple por vacuidad.'],
      ['Antisimétrica', !idaYVuelta, idaYVuelta ? `${p(...idaYVuelta)} y ${p(idaYVuelta[1], idaYVuelta[0])} están, con ${idaYVuelta[0]} ≠ ${idaYVuelta[1]}.` : pares.some(([a, b]) => a !== b) ? 'Entre elementos distintos, ningún par tiene vuelta.' : 'No hay pares entre elementos distintos: se cumple por vacuidad.'],
      ['Transitiva', !rota, rota ? `${p(rota[0], rota[1])} y ${p(rota[1], rota[2])} están, pero ${p(rota[0], rota[2])} no.` : cadenas.length ? `${lista(cadenas)}.` : 'No hay dos flechas seguidas: se cumple por vacuidad.'],
    ];
    const tiene = (n) => filas.find((f) => f[0] === n)[1];
    let tipo = 'No es de equivalencia ni de orden.';
    let clases = null;
    if (tiene('Reflexiva') && tiene('Simétrica') && tiene('Transitiva')) {
      tipo = 'Es reflexiva, simétrica y transitiva: es de equivalencia.';
      const ya = new Set();
      clases = [];
      for (const a of elementos) {
        if (ya.has(a)) continue;
        const c = elementos.filter((b) => esta(a, b));
        c.forEach((b) => ya.add(b));
        clases.push(`[${a}] = {${c.join(', ')}}`);
      }
    }
    if (tiene('Reflexiva') && tiene('Antisimétrica') && tiene('Transitiva')) tipo = tiene('Simétrica') ? 'Es de equivalencia y también de orden: es la igualdad.' : 'Es reflexiva, antisimétrica y transitiva: es de orden.';
    return { filas, tipo, clases };
  }

  function relacionPropia(figura, cfg, ayuda) {
    const { lienzo, crear, svg, boton } = ayuda;
    const g = leerDatos(cfg);
    const cA = campoDe(ayuda, 'Conjunto A', g('conjunto', '{1, 2, 3, 4}', 120), 120);
    const cR = campoDe(ayuda, 'Relación R, sus pares', g('pares', '{(1,1), (1,2), (2,3), (3,1)}', 1600), 1600);
    const area = crear('textarea', { id: cR.inp.id, rows: 2, spellcheck: false, autocomplete: 'off', maxLength: 1600, value: cR.inp.value });
    area.style.width = '100%';
    area.style.boxSizing = 'border-box';
    cR.inp.replaceWith(area);
    cR.inp = area;
    const nota = crear('p', { className: 'w-ayuda' }, 'Separá los elementos con coma o espacio. Los pares, así: (1,2), (2,3). Para la relación vacía, dejá ese campo vacío.');
    const error = crear('p', { className: 'w-error', role: 'status' });
    const R = 16;
    const ANCHO = 300;
    const dibujo = svg('svg', { viewBox: `0 0 ${ANCHO} ${ANCHO}`, role: 'img', 'aria-label': 'Digrafo de la relación' });
    dibujo.style.cssText = 'display:block;width:100%;max-width:300px;margin:.4rem auto';
    const matrices = crear('div', { className: 'w-tabla-v' });
    matrices.style.cssText = 'display:flex;flex-wrap:wrap;gap:1.2rem;justify-content:center';
    const salida = crear('div', { className: 'w-resultado', 'aria-live': 'polite' });
    const paresR2 = crear('div', { className: 'w-botones', role: 'group', 'aria-label': 'Pares de R al cuadrado' });
    const tablaProp = crear('div', {});
    let corrida = null;
    const clave = (a, b) => `${a},${b}`;
    const texto = (pares) => (pares.length ? `{${pares.map(([a, b]) => `(${a},${b})`).join(', ')}}` : '∅');

    const dibujar = (elementos, pares, marcados) => {
      const posicion = new Map(elementos.map((e, i) => {
        const ang = -Math.PI / 2 + (2 * Math.PI * i) / elementos.length;
        return [e, { x: ANCHO / 2 + 100 * Math.cos(ang), y: ANCHO / 2 + 100 * Math.sin(ang), ang }];
      }));
      const flecha = (a, b, marcada) => {
        const trazo = marcada ? 'var(--birome)' : 'var(--tinta-suave)';
        const ancho = marcada ? 3 : 1.5;
        const p = posicion.get(a);
        const q = posicion.get(b);
        if (a === b) return [svg('circle', { cx: p.x + 26 * Math.cos(p.ang), cy: p.y + 26 * Math.sin(p.ang), r: 14, fill: 'none', stroke: trazo, 'stroke-width': ancho })];
        const dx = q.x - p.x;
        const dy = q.y - p.y;
        const largo = Math.hypot(dx, dy);
        const ux = dx / largo;
        const uy = dy / largo;
        const nx = -uy * 5;
        const ny = ux * 5;
        const fx = q.x - ux * (R + 1) + nx;
        const fy = q.y - uy * (R + 1) + ny;
        return [
          svg('line', { x1: p.x + ux * R + nx, y1: p.y + uy * R + ny, x2: fx, y2: fy, stroke: trazo, 'stroke-width': ancho }),
          svg('polygon', { points: `${fx},${fy} ${fx - ux * 9 - uy * 4},${fy - uy * 9 + ux * 4} ${fx - ux * 9 + uy * 4},${fy - uy * 9 - ux * 4}`, fill: trazo }),
        ];
      };
      const hijos = pares.flatMap(([a, b]) => flecha(a, b, marcados.has(clave(a, b))));
      for (const e of elementos) {
        const { x, y } = posicion.get(e);
        hijos.push(
          svg('circle', { cx: x, cy: y, r: R, fill: 'var(--papel)', stroke: 'var(--tinta)', 'stroke-width': 1.5 }),
          svg('text', { x, y: y + 5, 'text-anchor': 'middle', fill: 'var(--tinta)', 'font-size': e.length > 2 ? 10 : 15 }, e),
        );
      }
      dibujo.replaceChildren(...hijos);
    };
    const matriz = (titulo, elementos, pares) => {
      const hay = new Set(pares.map(([a, b]) => clave(a, b)));
      return crear('table', {}, crear('caption', {}, titulo),
        crear('thead', {}, crear('tr', {}, crear('th', { scope: 'col' }, ''), ...elementos.map((e) => crear('th', { scope: 'col' }, e)))),
        crear('tbody', {}, ...elementos.map((a) => crear('tr', {}, crear('th', { scope: 'row' }, a), ...elementos.map((b) => crear('td', {}, hay.has(clave(a, b)) ? '1' : '0'))))));
    };
    const filasMatriz = (elementos, pares) => {
      const hay = new Set(pares.map(([a, b]) => clave(a, b)));
      return elementos.map((a) => [a, ...elementos.map((b) => (hay.has(clave(a, b)) ? '1' : '0'))]);
    };

    const calcular = () => {
      const A = leerConjunto(cA.inp.value);
      const P = A.error ? A : leerPares(cR.inp.value, A.elementos);
      corrida = P.error ? { error: P.error } : { elementos: A.elementos, pares: P.pares };
      error.textContent = corrida.error || '';
      error.hidden = !corrida.error;
      dibujo.style.display = corrida.error ? 'none' : 'block';
      if (corrida.error) {
        matrices.replaceChildren();
        salida.replaceChildren();
        paresR2.replaceChildren();
        tablaProp.replaceChildren();
        return;
      }
      const { elementos, pares } = corrida;
      const vias = new Map();
      for (const [a, x] of pares) for (const [y, b] of pares) if (x === y && !vias.has(clave(a, b))) vias.set(clave(a, b), { par: [a, b], por: x });
      const r2 = elementos.flatMap((a) => elementos.flatMap((b) => (vias.has(clave(a, b)) ? [vias.get(clave(a, b))] : [])));
      const hay = new Set(pares.map(([a, b]) => clave(a, b)));
      const incluida = r2.every(({ par: [a, b] }) => hay.has(clave(a, b)));
      const prop = propiedades(elementos, pares);
      Object.assign(corrida, { r2: r2.map((x) => x.par), incluida, prop });
      dibujar(elementos, pares, new Set());
      matrices.replaceChildren(matriz('Matriz de R', elementos, pares), matriz('Matriz de R²', elementos, corrida.r2));
      const detalle = crear('p', {}, r2.length ? 'Tocá un par de abajo para ver las dos flechas que lo forman.' : 'No hay dos flechas seguidas, así que R² es vacía.');
      corrida.lineas = [
        `R = ${texto(pares)}`,
        `R² = ${texto(corrida.r2)}`,
        incluida ? 'R² está incluida en R, así que R es transitiva.' : 'R² no está incluida en R, así que R no es transitiva.',
        prop.tipo,
        ...(prop.clases ? [`Clases de equivalencia: ${prop.clases.join('; ')}.`] : []),
      ];
      salida.replaceChildren(...corrida.lineas.map((t) => crear('p', {}, t)), detalle);
      paresR2.replaceChildren(...r2.map(({ par: [a, b], por }) => boton(`(${a},${b})`, () => {
        dibujar(elementos, pares, new Set([clave(a, por), clave(por, b)]));
        detalle.textContent = `De ${a} a ${por} y de ${por} a ${b}: longitud 2, ${hay.has(clave(a, b)) ? `y (${a},${b}) está en R` : `pero (${a},${b}) no está en R`}.`;
      })));
      tablaProp.replaceChildren(crear('p', { className: 'w-titular' }, 'Cada propiedad por separado'), crear('ul', {}, ...prop.filas.map(([nombre, si, por]) => crear('li', {}, crear('strong', {}, `${nombre}: ${si ? 'sí' : 'no'}.`), ` ${por}`))));
    };
    const cambio = () => {
      calcular();
      ayuda.guardarDatos?.({ conjunto: cA.inp.value, pares: cR.inp.value });
    };
    cA.inp.addEventListener('input', cambio);
    cR.inp.addEventListener('input', cambio);
    lienzo.append(cA.fila, cR.fila, nota, error, dibujo, matrices, salida, paresR2, tablaProp);
    calcular();
    const imagen = () => {
      if (!corrida || corrida.error) return Promise.resolve(null);
      const { elementos } = corrida;
      return apilar(ayuda, dibujo, [
        { texto: `A = {${elementos.join(', ')}}`, negrita: true },
        ...corrida.lineas.map((t) => ({ texto: t })),
        { texto: 'Matriz de R', negrita: true },
        { cab: ['', ...elementos], tabla: filasMatriz(elementos, corrida.pares), resaltar: 0 },
        { texto: 'Matriz de R²', negrita: true },
        { cab: ['', ...elementos], tabla: filasMatriz(elementos, corrida.r2), resaltar: 0 },
        { texto: 'Cada propiedad por separado', negrita: true },
        ...corrida.prop.filas.map(([nombre, si, por]) => ({ texto: `${nombre}: ${si ? 'sí' : 'no'}. ${por}` })),
      ]);
    };
    return { imagen };
  }

  // ----- Trees: an expression, or a binary tree written as A(B, C(, D)).
  const MAX_NODOS = 31;
  const SIMBOLO = { '+': '+', '-': '−', '−': '−', '*': '×', '×': '×', '/': '÷', '÷': '÷', '^': '^' };
  const PRECEDENCIA = { '+': 1, '−': 1, '×': 2, '÷': 2, '^': 3 };
  /** The tree of an expression with + − × ÷ ^ and brackets. The labels stay as written, as the notes ask. */
  function arbolDeExpresion(texto) {
    const fichas = String(texto).match(/[A-Za-z0-9_.,]+|[-+*/^×÷−()]|\S/g) || [];
    if (!fichas.length) return { error: 'Escribí la expresión.' };
    const mala = fichas.find((f) => !/^[A-Za-z0-9_.,]+$/.test(f) && !SIMBOLO[f] && f !== '(' && f !== ')');
    if (mala) return { error: `«${mala}» no es un operador que entienda. Usá + − × ÷ ^ y paréntesis.` };
    let i = 0;
    const atomo = () => {
      const f = fichas[i];
      if (f === undefined) return { error: 'La expresión termina antes de tiempo: falta un operando.' };
      if (f === '(') {
        i += 1;
        const e = nivel(1);
        if (e.error) return e;
        if (fichas[i] !== ')') return { error: 'Falta cerrar un paréntesis.' };
        i += 1;
        return e;
      }
      if (SIMBOLO[f] || f === ')') return { error: `Sobra «${f}»: falta un operando antes.` };
      i += 1;
      if (f.length > 6) return { error: `«${f.slice(0, 12)}» es muy largo: cada operando, hasta 6 caracteres.` };
      return { e: f };
    };
    function nivel(min) {
      let izq = atomo();
      if (izq.error) return izq;
      for (;;) {
        const op = SIMBOLO[fichas[i]];
        if (!op || PRECEDENCIA[op] < min) return izq;
        i += 1;
        const der = nivel(op === '^' ? PRECEDENCIA[op] : PRECEDENCIA[op] + 1);
        if (der.error) return der;
        izq = { e: op, i: izq, d: der };
      }
    }
    const raiz = nivel(1);
    if (raiz.error) return raiz;
    if (i < fichas.length) return { error: fichas[i] === ')' ? 'Sobra un paréntesis que cierra.' : `Sobra «${fichas[i]}»: entre dos operandos va un operador.` };
    return { raiz };
  }
  /** A binary tree written as A(B(D, E), C(, F)): each vertex, then its left and right child in brackets; either may be missing. */
  function arbolAnidado(texto) {
    const t = String(texto).replace(/\s+/g, '');
    if (!t) return { error: 'Escribí el árbol.' };
    let i = 0;
    const vertice = () => {
      const m = /^[^(),]+/.exec(t.slice(i));
      if (!m) return { error: t[i] === undefined ? 'El árbol termina antes de tiempo.' : `En la posición ${i + 1} falta el nombre de un vértice (hasta 6 caracteres).` };
      if (m && m[0].length > 6) return { error: `«${m[0].slice(0, 12)}» es muy largo: cada vértice, hasta 6 caracteres.` };
      i += m[0].length;
      const n = { e: m[0] };
      if (t[i] !== '(') return n;
      i += 1;
      if (t[i] !== ',') {
        const h = vertice();
        if (h.error) return h;
        n.i = h;
      }
      if (t[i] === ',') {
        i += 1;
        if (t[i] !== ')') {
          const h = vertice();
          if (h.error) return h;
          n.d = h;
        }
      }
      if (t[i] !== ')') return { error: 'Falta cerrar un paréntesis, o hay más de dos hijos: es un árbol binario.' };
      i += 1;
      return n;
    };
    const raiz = vertice();
    if (raiz.error) return raiz;
    if (i < t.length) return { error: `Sobra «${t.slice(i, i + 12)}» después del árbol.` };
    return { raiz };
  }
  const ORDENES_RES = {
    Preorden: (n) => [n, ...(n.i ? ORDENES_RES.Preorden(n.i) : []), ...(n.d ? ORDENES_RES.Preorden(n.d) : [])],
    Entreorden: (n) => [...(n.i ? ORDENES_RES.Entreorden(n.i) : []), n, ...(n.d ? ORDENES_RES.Entreorden(n.d) : [])],
    Postorden: (n) => [...(n.i ? ORDENES_RES.Postorden(n.i) : []), ...(n.d ? ORDENES_RES.Postorden(n.d) : []), n],
  };
  const REGLA_RES = { Preorden: 'raíz, izquierdo, derecho', Entreorden: 'izquierdo, raíz, derecho', Postorden: 'izquierdo, derecho, raíz' };
  const QUE_DA = { Preorden: 'forma polaca o prefija', Entreorden: 'forma infija sin paréntesis', Postorden: 'forma polaca inversa o postfija' };

  function recorridoPropio(figura, cfg, ayuda) {
    const { lienzo, crear, svg, boton } = ayuda;
    const g = leerDatos(cfg);
    const forma = elegirDe(ayuda, 'El árbol es', [['expresion', 'De una expresión'], ['anidado', 'Escrito como A(B, C)']], g('forma') === 'anidado' ? 'anidado' : 'expresion');
    const cE = campoDe(ayuda, 'Árbol', g('arbol', '(a - b) * (c + d / e)', 300), 300);
    const nota = crear('p', { className: 'w-ayuda' });
    const orden = elegirDe(ayuda, 'Recorrido', Object.keys(ORDENES_RES).map((n) => [n, n]), Object.keys(ORDENES_RES).includes(g('orden')) ? g('orden') : 'Preorden');
    const error = crear('p', { className: 'w-error', role: 'status' });
    const regla = crear('p', {});
    const dibujo = svg('svg', { role: 'img', 'aria-label': 'Árbol binario' });
    dibujo.style.cssText = 'display:block;width:100%;max-width:420px;margin:.4rem auto';
    const salida = crear('p', { className: 'w-titular', 'aria-live': 'polite' });
    const botones = crear('div', { className: 'w-botones' });
    const todas = crear('div', { className: 'w-tabla-v' });
    let corrida = null;
    let vistos = Math.max(0, Math.min(MAX_NODOS, Number.parseInt(g('vistos', '0', 3), 10) || 0));
    let primera = true;

    const leer = () => {
      const r = forma.sel.value === 'anidado' ? arbolAnidado(cE.inp.value) : arbolDeExpresion(cE.inp.value);
      if (r.error) return r;
      const nodos = [];
      const lineas = [];
      let columna = 0;
      let hondo = 0;
      const ubicar = (n, nivel) => {
        if (nodos.length >= MAX_NODOS) return;
        if (n.i) ubicar(n.i, nivel + 1);
        n.x = columna;
        n.y = nivel;
        hondo = Math.max(hondo, nivel);
        columna += 1;
        nodos.push(n);
        if (n.d) ubicar(n.d, nivel + 1);
      };
      ubicar(r.raiz, 0);
      const contar = (n) => (n ? 1 + contar(n.i) + contar(n.d) : 0);
      const total = contar(r.raiz);
      if (total > MAX_NODOS) return { error: `El árbol tiene ${total} vértices: hasta ${MAX_NODOS}.` };
      const aristas = (n) => [n.i, n.d].forEach((h) => {
        if (h) {
          lineas.push([n, h]);
          aristas(h);
        }
      });
      aristas(r.raiz);
      return { raiz: r.raiz, nodos, lineas, columna, hondo };
    };
    const pintar = () => {
      if (!corrida || corrida.error) return;
      const n = orden.sel.value;
      const lista = ORDENES_RES[n](corrida.raiz);
      vistos = Math.min(vistos, lista.length);
      const ya = new Set(lista.slice(0, vistos));
      const ultimo = lista[vistos - 1];
      const PX = 44;
      const PY = 58;
      const px = (v) => 26 + v.x * PX;
      const py = (v) => 26 + v.y * PY;
      dibujo.setAttribute('viewBox', `0 0 ${52 + (corrida.columna - 1) * PX} ${52 + corrida.hondo * PY}`);
      const hijos = corrida.lineas.map(([a, b]) => svg('line', { x1: px(a), y1: py(a), x2: px(b), y2: py(b), stroke: 'var(--tinta-suave)', 'stroke-width': 1.5 }));
      for (const v of corrida.nodos) {
        const relleno = v === ultimo ? 'var(--birome)' : ya.has(v) ? 'var(--resaltador)' : 'var(--papel)';
        const letra = v === ultimo ? 'var(--papel)' : ya.has(v) ? 'var(--sobre-resaltador)' : 'var(--tinta)';
        hijos.push(
          svg('circle', { cx: px(v), cy: py(v), r: 17, fill: relleno, stroke: 'var(--tinta)', 'stroke-width': 1.5 }),
          svg('text', { x: px(v), y: py(v) + 5, 'text-anchor': 'middle', fill: letra, 'font-size': v.e.length > 2 ? 10 : 15 }, v.e),
        );
      }
      dibujo.replaceChildren(...hijos);
      regla.textContent = `${n}: ${REGLA_RES[n]}. Da la ${QUE_DA[n]}.`;
      salida.textContent = vistos ? `${lista.slice(0, vistos).map((v) => v.e).join(' ')}${vistos === lista.length ? ' (completo)' : ''}` : 'Tocá Siguiente para visitar el primer vértice.';
    };
    const guardar = () => ayuda.guardarDatos?.({ forma: forma.sel.value, arbol: cE.inp.value, orden: orden.sel.value, vistos: String(vistos) });
    const calcular = () => {
      corrida = leer();
      nota.textContent = forma.sel.value === 'anidado'
        ? 'Cada vértice y, entre paréntesis, su hijo izquierdo y su hijo derecho. Si falta uno, dejá su lugar vacío: A(B, C(, D)).'
        : 'Con operandos de hasta 6 caracteres y + − × ÷ ^ (también * y /). Los paréntesis se respetan; si no, primero ^, después × y ÷, al final + y −.';
      error.textContent = corrida.error || '';
      error.hidden = !corrida.error;
      for (const el of [regla, salida, botones, todas]) el.hidden = Boolean(corrida.error);
      dibujo.style.display = corrida.error ? 'none' : 'block';
      if (!primera) vistos = 0;
      primera = false;
      if (corrida.error) return;
      todas.replaceChildren(crear('table', {},
        crear('caption', {}, 'Los tres recorridos'),
        crear('thead', {}, crear('tr', {}, crear('th', { scope: 'col' }, 'Recorrido'), crear('th', { scope: 'col' }, 'Orden de visita'))),
        crear('tbody', {}, ...Object.keys(ORDENES_RES).map((n) => crear('tr', {}, crear('td', {}, n), crear('td', {}, ORDENES_RES[n](corrida.raiz).map((v) => v.e).join(' ')))))));
      pintar();
    };
    botones.append(
      boton('Siguiente', () => {
        if (!corrida || corrida.error) return;
        vistos = Math.min(vistos + 1, corrida.nodos.length);
        pintar();
        guardar();
      }),
      boton('Volver a empezar', () => {
        vistos = 0;
        pintar();
        guardar();
      }),
    );
    forma.sel.addEventListener('change', () => {
      calcular();
      guardar();
    });
    cE.inp.addEventListener('input', () => {
      calcular();
      guardar();
    });
    orden.sel.addEventListener('change', () => {
      vistos = 0;
      pintar();
      guardar();
    });
    lienzo.append(forma.fila, cE.fila, nota, orden.fila, error, regla, dibujo, salida, botones, todas);
    calcular();
    const imagen = () => {
      if (!corrida || corrida.error) return Promise.resolve(null);
      return apilar(ayuda, dibujo, [
        { texto: forma.sel.value === 'anidado' ? `Árbol ${cE.inp.value.trim()}` : `Árbol de la expresión ${cE.inp.value.trim()}`, negrita: true },
        { cab: ['Recorrido', 'Orden de visita'], tabla: Object.keys(ORDENES_RES).map((n) => [n, ORDENES_RES[n](corrida.raiz).map((v) => v.e).join(' ')]), resaltar: 0 },
      ]);
    };
    return { imagen };
  }

  UTN.interactivo('relacion', (figura, cfg, ayuda) => {
    if (enResumenDe(figura, ayuda)) return relacionPropia(figura, cfg, ayuda);
    const { lienzo, crear, svg, boton } = ayuda;
    const elementos = cfg.elementos;
    const clave = (a, b) => `${a},${b}`;
    const texto = (pares) => (pares.length ? `{${pares.map(([a, b]) => `(${a},${b})`).join(', ')}}` : '∅');
    const cuadrado = (pares) => {
      const salida = new Map();
      for (const [a, x] of pares) {
        for (const [y, b] of pares) {
          if (x === y && !salida.has(clave(a, b))) salida.set(clave(a, b), { par: [a, b], por: x });
        }
      }
      return elementos.flatMap((a) => elementos.flatMap((b) => (salida.has(clave(a, b)) ? [salida.get(clave(a, b))] : [])));
    };

    const R = 16;
    const ANCHO = 300;
    const posicion = new Map(elementos.map((e, i) => {
      const ang = -Math.PI / 2 + (2 * Math.PI * i) / elementos.length;
      return [e, { x: ANCHO / 2 + 100 * Math.cos(ang), y: ANCHO / 2 + 100 * Math.sin(ang), ang }];
    }));

    const elegir = crear('div', { className: 'w-botones', role: 'group', 'aria-label': 'Relación del ejemplo' });
    const dibujo = svg('svg', { viewBox: `0 0 ${ANCHO} ${ANCHO}`, role: 'img', 'aria-label': 'Digrafo de la relación elegida' });
    dibujo.style.cssText = 'display:block;width:100%;max-width:300px;margin:.4rem auto';
    const matrices = crear('div', { className: 'w-tabla-v' });
    matrices.style.cssText = 'display:flex;flex-wrap:wrap;gap:1.2rem;justify-content:center';
    const salida = crear('div', { className: 'w-resultado', 'aria-live': 'polite' });
    const paresR2 = crear('div', { className: 'w-botones', role: 'group', 'aria-label': 'Pares de R al cuadrado' });

    const flecha = (a, b, marcada) => {
      const trazo = marcada ? 'var(--birome)' : 'var(--tinta-suave)';
      const ancho = marcada ? 3 : 1.5;
      const p = posicion.get(a);
      const q = posicion.get(b);
      if (a === b) {
        const cx = p.x + 26 * Math.cos(p.ang);
        const cy = p.y + 26 * Math.sin(p.ang);
        return [svg('circle', { cx, cy, r: 14, fill: 'none', stroke: trazo, 'stroke-width': ancho })];
      }
      const dx = q.x - p.x;
      const dy = q.y - p.y;
      const largo = Math.hypot(dx, dy);
      const ux = dx / largo;
      const uy = dy / largo;
      // A pair and its way back are drawn apart, so both stay visible.
      const nx = -uy * 5;
      const ny = ux * 5;
      const fx = q.x - ux * (R + 1) + nx;
      const fy = q.y - uy * (R + 1) + ny;
      const punta = `${fx},${fy} ${fx - ux * 9 - uy * 4},${fy - uy * 9 + ux * 4} ${fx - ux * 9 + uy * 4},${fy - uy * 9 - ux * 4}`;
      return [
        svg('line', { x1: p.x + ux * R + nx, y1: p.y + uy * R + ny, x2: fx, y2: fy, stroke: trazo, 'stroke-width': ancho }),
        svg('polygon', { points: punta, fill: trazo }),
      ];
    };

    const dibujar = (pares, marcados) => {
      const hijos = pares.flatMap(([a, b]) => flecha(a, b, marcados.has(clave(a, b))));
      for (const e of elementos) {
        const { x, y } = posicion.get(e);
        const circulo = svg('circle', { cx: x, cy: y, r: R, fill: 'var(--papel)', stroke: 'var(--tinta)', 'stroke-width': 1.5 });
        const nombre = svg('text', { x, y: y + 5, 'text-anchor': 'middle', fill: 'var(--tinta)', 'font-size': 15 }, String(e));
        hijos.push(circulo, nombre);
      }
      dibujo.replaceChildren(...hijos);
    };

    const matriz = (titulo, pares) => {
      const hay = new Set(pares.map(([a, b]) => clave(a, b)));
      const cabeza = crear('tr', {}, crear('th', { scope: 'col' }, ''), ...elementos.map((e) => crear('th', { scope: 'col' }, String(e))));
      const filas = elementos.map((a) => crear('tr', {}, crear('th', { scope: 'row' }, String(a)), ...elementos.map((b) => crear('td', {}, hay.has(clave(a, b)) ? '1' : '0'))));
      return crear('table', {}, crear('caption', {}, titulo), crear('thead', {}, cabeza), crear('tbody', {}, ...filas));
    };

    const mostrar = (rel) => {
      const pares = rel.pares;
      const r2 = cuadrado(pares);
      const hay = new Set(pares.map(([a, b]) => clave(a, b)));
      const incluida = r2.every(({ par: [a, b] }) => hay.has(clave(a, b)));
      dibujar(pares, new Set());
      matrices.replaceChildren(matriz(`Matriz de ${rel.nombre}`, pares), matriz(`Matriz de ${rel.nombre}²`, r2.map((x) => x.par)));
      const detalle = crear('p', {}, r2.length ? 'Tocá un par de abajo para ver las dos flechas que lo forman.' : 'No hay dos flechas seguidas, así que no hay ningún par que controlar.');
      salida.replaceChildren(
        crear('p', {}, `${rel.nombre} = ${texto(pares)}`),
        crear('p', {}, `${rel.nombre}² = ${texto(r2.map((x) => x.par))}`),
        crear('p', {}, incluida ? `${rel.nombre}² está incluida en ${rel.nombre}, así que ${rel.nombre} es transitiva.` : `${rel.nombre}² no está incluida en ${rel.nombre}, así que ${rel.nombre} no es transitiva.`),
        detalle,
      );
      paresR2.replaceChildren(...r2.map(({ par: [a, b], por }) => boton(`(${a},${b})`, () => {
        dibujar(pares, new Set([clave(a, por), clave(por, b)]));
        const falta = hay.has(clave(a, b)) ? `y (${a},${b}) está en ${rel.nombre}` : `pero (${a},${b}) no está en ${rel.nombre}`;
        detalle.textContent = `De ${a} a ${por} y de ${por} a ${b}: longitud 2, ${falta}.`;
      })));
    };

    elegir.append(...cfg.relaciones.map((rel) => boton(rel.nombre, () => mostrar(rel))));
    lienzo.append(elegir, dibujo, matrices, salida, paresR2);
    mostrar(cfg.relaciones[0]);
  });

  UTN.interactivo('recorrido', (figura, cfg, ayuda) => {
    if (enResumenDe(figura, ayuda)) return recorridoPropio(figura, cfg, ayuda);
    const { lienzo, crear, svg, boton } = ayuda;
    const nodos = [];
    const lineas = [];
    let columna = 0;
    const ubicar = (n, nivel) => {
      if (n.i) ubicar(n.i, nivel + 1);
      n.x = columna;
      n.y = nivel;
      columna += 1;
      if (n.d) ubicar(n.d, nivel + 1);
      nodos.push(n);
    };
    ubicar(cfg.raiz, 0);
    const verAristas = (n) => {
      for (const h of [n.i, n.d]) {
        if (h) {
          lineas.push([n, h]);
          verAristas(h);
        }
      }
    };
    verAristas(cfg.raiz);

    const ORDENES = {
      Preorden: (n) => [n, ...(n.i ? ORDENES.Preorden(n.i) : []), ...(n.d ? ORDENES.Preorden(n.d) : [])],
      Entreorden: (n) => [...(n.i ? ORDENES.Entreorden(n.i) : []), n, ...(n.d ? ORDENES.Entreorden(n.d) : [])],
      Postorden: (n) => [...(n.i ? ORDENES.Postorden(n.i) : []), ...(n.d ? ORDENES.Postorden(n.d) : []), n],
    };
    const REGLA = { Preorden: 'raíz, izquierdo, derecho', Entreorden: 'izquierdo, raíz, derecho', Postorden: 'izquierdo, derecho, raíz' };

    const PASO_X = 44;
    const PASO_Y = 58;
    const px = (n) => 26 + n.x * PASO_X;
    const py = (n) => 26 + n.y * PASO_Y;
    const alto = Math.max(...nodos.map((n) => n.y));
    const dibujo = svg('svg', { viewBox: `0 0 ${52 + (columna - 1) * PASO_X} ${52 + alto * PASO_Y}`, role: 'img', 'aria-label': 'Árbol binario de la expresión' });
    dibujo.style.cssText = 'display:block;width:100%;max-width:420px;margin:.4rem auto';
    const salida = crear('p', { className: 'w-titular', 'aria-live': 'polite' });
    const regla = crear('p', {});

    let nombre = 'Preorden';
    let vistos = 0;
    const pintar = () => {
      const orden = ORDENES[nombre](cfg.raiz);
      const ya = new Set(orden.slice(0, vistos));
      const ultimo = orden[vistos - 1];
      const dibujos = lineas.map(([a, b]) => svg('line', { x1: px(a), y1: py(a), x2: px(b), y2: py(b), stroke: 'var(--tinta-suave)', 'stroke-width': 1.5 }));
      for (const n of nodos) {
        const relleno = n === ultimo ? 'var(--birome)' : ya.has(n) ? 'var(--resaltador)' : 'var(--papel)';
        const letra = n === ultimo ? 'var(--papel)' : ya.has(n) ? 'var(--sobre-resaltador)' : 'var(--tinta)';
        dibujos.push(
          svg('circle', { cx: px(n), cy: py(n), r: 17, fill: relleno, stroke: 'var(--tinta)', 'stroke-width': 1.5 }),
          svg('text', { x: px(n), y: py(n) + 5, 'text-anchor': 'middle', fill: letra, 'font-size': 15 }, n.e),
        );
      }
      dibujo.replaceChildren(...dibujos);
      regla.textContent = `${nombre}: ${REGLA[nombre]}.`;
      salida.textContent = vistos ? orden.slice(0, vistos).map((n) => n.e).join(' ') : 'Tocá Siguiente para visitar el primer vértice.';
    };
    const usar = (n) => () => {
      nombre = n;
      vistos = 0;
      pintar();
    };
    lienzo.append(
      crear('div', { className: 'w-botones', role: 'group', 'aria-label': 'Recorrido' }, ...Object.keys(ORDENES).map((n) => boton(n, usar(n)))),
      regla,
      dibujo,
      salida,
      crear('div', { className: 'w-botones' },
        boton('Siguiente', () => {
          vistos = Math.min(vistos + 1, nodos.length);
          pintar();
        }),
        boton('Volver a empezar', () => {
          vistos = 0;
          pintar();
        })),
    );
    pintar();
  });
})();
