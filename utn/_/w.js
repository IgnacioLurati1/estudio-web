// Interactive figures of the study pages: 2D graphs in SVG, 3D with three.js on demand, calculators and simulators.
// Data comes from the build in data-cfg. Nothing here uses innerHTML or eval. The pure logic at the top also runs in Node.
(() => {
  'use strict';

  // ----- Exact fractions, for the matrix steps
  const mcd = (a, b) => {
    let x = a < 0n ? -a : a;
    let y = b < 0n ? -b : b;
    while (y) [x, y] = [y, x % y];
    return x;
  };
  const fr = (n, d = 1n) => {
    const g = mcd(n, d) || 1n;
    const s = d < 0n ? -1n : 1n;
    return { n: (s * n) / g, d: (s * d) / g };
  };
  const mas = (a, b) => fr(a.n * b.d + b.n * a.d, a.d * b.d);
  const menos = (a, b) => fr(a.n * b.d - b.n * a.d, a.d * b.d);
  const por = (a, b) => fr(a.n * b.n, a.d * b.d);
  const entre = (a, b) => fr(a.n * b.d, a.d * b.n);
  const esCero = (a) => a.n === 0n;
  const CERO = fr(0n);
  const UNO = fr(1n);
  const textoFr = (a) => `${a.n < 0n ? '−' : ''}${a.n < 0n ? -a.n : a.n}${a.d === 1n ? '' : `/${a.d}`}`;
  /** Reads «3», «-2,5», «0.25» or «1/3». Returns null when it is not a number. */
  const leerFr = (txt) => {
    const t = String(txt).trim().replace('−', '-').replace(',', '.');
    const q = /^([+-]?\d+)\s*\/\s*(\d+)$/.exec(t);
    if (q) return BigInt(q[2]) === 0n ? null : fr(BigInt(q[1]), BigInt(q[2]));
    const m = /^([+-]?)(\d*)(?:\.(\d*))?$/.exec(t);
    if (!m || (!m[2] && !m[3]) || t.length > 24) return null;
    const dec = m[3] || '';
    const v = fr(BigInt((m[2] || '0') + dec), 10n ** BigInt(dec.length));
    return m[1] === '-' ? fr(-v.n, v.d) : v;
  };

  const copia = (M) => M.map((f) => f.slice());
  const opTexto = (i, k, j) => `F${i + 1} = F${i + 1} ${k.n < 0n ? '+' : '−'} ${textoFr(fr(k.n < 0n ? -k.n : k.n, k.d))}·F${j + 1}`;

  /** Gaussian elimination. `reducida` also clears above each pivot and turns pivots into 1 (Gauss-Jordan). */
  function escalonar(A, { reducida = false, columnas = A[0].length } = {}) {
    const M = copia(A);
    const pasos = [];
    const filas = M.length;
    let r = 0;
    let signo = 1;
    const pivotes = [];
    for (let c = 0; c < columnas && r < filas; c += 1) {
      let piv = -1;
      for (let i = r; i < filas; i += 1) {
        if (!esCero(M[i][c])) {
          piv = i;
          break;
        }
      }
      if (piv < 0) continue;
      if (piv !== r) {
        [M[piv], M[r]] = [M[r], M[piv]];
        signo = -signo;
        pasos.push({ texto: `Cambiamos la fila ${r + 1} con la fila ${piv + 1}.`, matriz: copia(M) });
      }
      if (reducida && !(M[r][c].n === 1n && M[r][c].d === 1n)) {
        const k = entre(UNO, M[r][c]);
        M[r] = M[r].map((v) => por(v, k));
        pasos.push({ texto: `F${r + 1} = ${textoFr(k)}·F${r + 1}`, matriz: copia(M) });
      }
      for (let i = reducida ? 0 : r + 1; i < filas; i += 1) {
        if (i === r || esCero(M[i][c])) continue;
        const k = entre(M[i][c], M[r][c]);
        M[i] = M[i].map((v, j) => menos(v, por(k, M[r][j])));
        pasos.push({ texto: opTexto(i, k, r), matriz: copia(M) });
      }
      pivotes.push({ fila: r, columna: c });
      r += 1;
    }
    return { matriz: M, pasos, rango: r, signo, pivotes };
  }

  const aFracciones = (A) => A.map((f) => f.map((v) => (typeof v === 'object' ? v : leerFr(v))));

  function determinante(A) {
    const M = aFracciones(A);
    if (M.length !== M[0].length) return null;
    const e = escalonar(M);
    let d = fr(BigInt(e.signo));
    for (let i = 0; i < M.length; i += 1) d = por(d, e.matriz[i][i]);
    return { valor: d, pasos: e.pasos, intercambios: e.signo < 0, final: e.matriz };
  }
  function rango(A) {
    const e = escalonar(aFracciones(A));
    return { valor: e.rango, pasos: e.pasos, final: e.matriz };
  }
  function inversa(A) {
    const M = aFracciones(A);
    const n = M.length;
    if (n !== M[0].length) return null;
    const aumentada = M.map((f, i) => [...f, ...f.map((_, j) => (i === j ? UNO : CERO))]);
    const e = escalonar(aumentada, { reducida: true, columnas: n });
    if (e.rango < n) return { existe: false, pasos: e.pasos };
    return { existe: true, valor: e.matriz.map((f) => f.slice(n)), pasos: e.pasos, final: e.matriz };
  }

  // ----- Propositional logic
  function tokensLogica(src) {
    const out = [];
    const t = src.replace(/\s+/g, ' ').trim();
    let i = 0;
    const SIMBOLOS = [['<->', 'ssi'], ['<=>', 'ssi'], ['↔', 'ssi'], ['⇔', 'ssi'], ['->', 'imp'], ['=>', 'imp'], ['→', 'imp'], ['⇒', 'imp'], ['∧', 'y'], ['^', 'y'], ['&', 'y'], ['∨', 'o'], ['|', 'o'], ['¬', 'no'], ['~', 'no'], ['!', 'no'], ['⊻', 'xor'], ['⊕', 'xor'], ['(', '('], [')', ')']];
    while (i < t.length) {
      if (t[i] === ' ') {
        i += 1;
        continue;
      }
      const s = SIMBOLOS.find(([x]) => t.startsWith(x, i));
      if (s) {
        out.push({ k: s[1] });
        i += s[0].length;
        continue;
      }
      const m = /^[A-Za-z]+/.exec(t.slice(i, i + 12));
      if (!m) throw new Error(`No entiendo el símbolo «${t[i]}».`);
      const w = m[0];
      i += w.length;
      if (w === 'no') out.push({ k: 'no' });
      else if (w === 'y') out.push({ k: 'y' });
      else if (w === 'o' || w === 'v') out.push({ k: 'o' });
      else if (w === 'xor') out.push({ k: 'xor' });
      else if (w === 'V' || w === 'F') out.push({ k: 'cte', v: w === 'V' });
      else if (w.length === 1) out.push({ k: 'var', n: w });
      else throw new Error(`«${w}» no es una variable: usá una sola letra, como p o q.`);
    }
    return out;
  }
  function parsearLogica(src) {
    if (!src.trim()) throw new Error('Escribí una fórmula, por ejemplo p -> q.');
    if (src.length > 200) throw new Error('La fórmula es demasiado larga.');
    const ts = tokensLogica(src);
    let p = 0;
    const es = (k) => ts[p]?.k === k;
    const unaria = (prof = 0) => {
      if (prof > 30) throw new Error('La fórmula tiene demasiados niveles.');
      if (es('no')) {
        p += 1;
        return { k: 'no', a: unaria(prof + 1) };
      }
      if (es('(')) {
        p += 1;
        const d = ssi(prof + 1);
        if (!es(')')) throw new Error('Falta cerrar un paréntesis.');
        p += 1;
        return d;
      }
      if (es('var') || es('cte')) {
        p += 1;
        return ts[p - 1];
      }
      if (p >= ts.length) throw new Error('La fórmula termina antes de tiempo: falta una variable.');
      throw new Error('Falta una variable antes de un conector.');
    };
    const izquierda = (k, sig) => (prof) => {
      let a = sig(prof);
      while (es(k) || (k === 'o' && es('xor'))) {
        const op = ts[p].k;
        p += 1;
        a = { k: op, a, b: sig(prof) };
      }
      return a;
    };
    const conj = izquierda('y', unaria);
    const disy = izquierda('o', conj);
    const imp = (prof) => {
      const a = disy(prof);
      if (!es('imp')) return a;
      p += 1;
      return { k: 'imp', a, b: imp(prof + 1) };
    };
    function ssi(prof) {
      if (prof > 30) throw new Error('La fórmula tiene demasiados niveles.');
      let a = imp(prof);
      while (es('ssi')) {
        p += 1;
        a = { k: 'ssi', a, b: imp(prof) };
      }
      return a;
    }
    const r = ssi(0);
    if (p < ts.length) throw new Error(ts[p].k === ')' ? 'Sobra un paréntesis que cierra.' : 'Falta un conector entre dos partes de la fórmula.');
    return r;
  }
  const FUERZA = { ssi: 1, imp: 2, o: 3, xor: 3, y: 4, no: 5, var: 6, cte: 6 };
  const SIMBOLO = { ssi: '↔', imp: '→', o: '∨', xor: '⊻', y: '∧' };
  const textoLogica = (n) => {
    if (n.k === 'var') return n.n;
    if (n.k === 'cte') return n.v ? 'V' : 'F';
    const par = (h) => (FUERZA[h.k] <= FUERZA[n.k] ? `(${textoLogica(h)})` : textoLogica(h));
    if (n.k === 'no') return `¬${par(n.a)}`;
    return `${par(n.a)} ${SIMBOLO[n.k]} ${par(n.b)}`;
  };
  const valorLogica = (n, v) => {
    switch (n.k) {
      case 'var':
        return v[n.n];
      case 'cte':
        return n.v;
      case 'no':
        return !valorLogica(n.a, v);
      case 'y':
        return valorLogica(n.a, v) && valorLogica(n.b, v);
      case 'o':
        return valorLogica(n.a, v) || valorLogica(n.b, v);
      case 'xor':
        return valorLogica(n.a, v) !== valorLogica(n.b, v);
      case 'imp':
        return !valorLogica(n.a, v) || valorLogica(n.b, v);
      default:
        return valorLogica(n.a, v) === valorLogica(n.b, v);
    }
  };
  /** Builds the truth table: one column per variable and per sub-formula, the whole formula last. */
  function tablaVerdad(src) {
    const raiz = parsearLogica(src);
    const vars = new Set();
    const subs = [];
    const recorrer = (n) => {
      if (n.k === 'var') return vars.add(n.n);
      if (n.k === 'cte') return null;
      recorrer(n.a);
      if (n.b) recorrer(n.b);
      if (!subs.some((s) => textoLogica(s) === textoLogica(n))) subs.push(n);
      return null;
    };
    recorrer(raiz);
    const nombres = [...vars].sort();
    if (nombres.length > 6) throw new Error('Con más de seis variables la tabla no entra en pantalla.');
    const filas = 2 ** nombres.length;
    const asignaciones = Array.from({ length: filas }, (_, i) => Object.fromEntries(nombres.map((n, j) => [n, !(i & (1 << (nombres.length - 1 - j)))])));
    const columnas = [...nombres.map((n) => ({ texto: n, vals: asignaciones.map((a) => a[n]) })), ...subs.map((s) => ({ texto: textoLogica(s), vals: asignaciones.map((a) => valorLogica(s, a)) }))];
    if (!subs.length) columnas.push({ texto: textoLogica(raiz), vals: asignaciones.map((a) => valorLogica(raiz, a)) });
    const final = columnas.at(-1).vals;
    const clase = final.every(Boolean) ? 'tautología' : final.some(Boolean) ? 'contingencia' : 'contradicción';
    return { variables: nombres, columnas, clase };
  }

  const NUCLEO = { fr, leerFr, textoFr, escalonar, determinante, rango, inversa, tablaVerdad, parsearLogica, textoLogica };
  if (typeof document === 'undefined') {
    module.exports = NUCLEO;
    return;
  }

  // ===== Browser
  const E = window.UTN_EXPR;
  const NS = 'http://www.w3.org/2000/svg';
  const raizDoc = document.documentElement;
  // The PDF page of a subject: every figure is drawn at once in its print size, and each 3D one becomes a still picture.
  const enPdf = raizDoc.hasAttribute('data-pdf');
  let avisarListas = () => {};
  const listas = new Promise((r) => {
    avisarListas = r;
  });
  let contador = 0;
  const nuevoId = () => `w${(contador += 1)}`;

  const poner = (el, props) => {
    for (const [k, v] of Object.entries(props)) {
      if (k === 'innerHTML' || k === 'outerHTML') throw new Error('Sin innerHTML: armá el contenido con crear().');
      if (v === undefined || v === null) continue;
      if (/^(aria-|data-|role$|for$)/.test(k)) el.setAttribute(k, v);
      else el[k] = v;
    }
    return el;
  };
  const crear = (tag, props = {}, ...hijos) => {
    const el = poner(document.createElement(tag), props);
    el.append(...hijos.filter((h) => h !== null && h !== undefined));
    return el;
  };
  const dibu = (tag, attrs = {}, ...hijos) => {
    const el = document.createElementNS(NS, tag);
    for (const [k, v] of Object.entries(attrs)) if (v !== undefined && v !== null) el.setAttribute(k, v);
    el.append(...hijos.filter((h) => h !== null && h !== undefined));
    return el;
  };
  const numero = (v, dec) => {
    if (!Number.isFinite(v)) return 'no definido';
    const x = Math.abs(v) < 1e-12 ? 0 : v;
    const a = Math.abs(x);
    let s;
    if (dec !== undefined && a < 1e15) s = x.toFixed(dec);
    else if (x !== 0 && (a >= 1e7 || a < 1e-4)) s = x.toExponential(3).replace(/\.?0+e/, 'e').replace('e+', 'e');
    else s = String(Number(x.toPrecision(6)));
    return s.replace('.', ',').replace(/-/g, '−');
  };

  // Colours always come from the page's variables. Only WebGL and canvas labels need them resolved.
  const color = (variable) => {
    const sonda = crear('span', { hidden: true });
    sonda.style.color = `var(${variable})`;
    document.body.append(sonda);
    const c = getComputedStyle(sonda).color;
    sonda.remove();
    return c;
  };
  const oyentes = new Set();
  const alCambiar = (fn) => {
    oyentes.add(fn);
    return () => oyentes.delete(fn);
  };
  let avisoPendiente = false;
  new MutationObserver(() => {
    if (avisoPendiente) return;
    avisoPendiente = true;
    requestAnimationFrame(() => {
      avisoPendiente = false;
      oyentes.forEach((fn) => fn());
    });
  }).observe(raizDoc, { attributes: true, attributeFilter: ['data-tema', 'data-contraste', 'data-daltonismo', 'data-texto', 'data-legible', 'data-interlineado', 'style'] });

  const deslizador = (p, alMover) => {
    const id = nuevoId();
    const valorTxt = crear('output', { className: 'w-valor', for: id }, numero(p.valor));
    const inp = crear('input', { type: 'range', id, min: p.min, max: p.max, step: p.paso ?? (p.max - p.min) / 100, value: p.valor });
    inp.addEventListener('input', () => {
      const v = Number(inp.value);
      valorTxt.textContent = numero(v);
      alMover(v);
    });
    return crear('div', { className: 'w-desliza' }, crear('label', { htmlFor: id }, p.etq || p.id), valorTxt, inp);
  };
  const boton = (texto, fn) => {
    const b = crear('button', { type: 'button', className: 'b-sec b-chico' }, texto);
    b.addEventListener('click', fn);
    return b;
  };
  const aviso = (lienzo, texto) => {
    lienzo.prepend(crear('p', { className: 'w-aviso', role: 'status' }, texto));
  };

  // ----- Shared numeric pieces
  const pasoLindo = (bruto) => {
    const p = 10 ** Math.floor(Math.log10(bruto));
    const n = bruto / p;
    return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10) * p;
  };
  const decimalesDe = (paso) => Math.max(0, Math.ceil(-Math.log10(paso) - 1e-9));
  const rangoNum = (par, nombre, vars = []) => {
    if (!Array.isArray(par) || par.length !== 2) throw new Error(`${nombre}: se espera [desde, hasta]`);
    return par.map((v) => E.compilar(v, vars));
  };
  const comoLista = (v) => (Array.isArray(v) ? v : v ? [v] : []);
  const ESTILOS = 4;
  const VARS_SERIE = ['--birome', '--mal', '--bien', '--tinta'];

  // ----- 2D graph
  const fmtPi = (v) => {
    const k = Math.round(v / (Math.PI / 4));
    if (k === 0) return '0';
    const g = mcd(BigInt(Math.abs(k)), 4n);
    const n = Math.abs(k) / Number(g);
    const d = 4 / Number(g);
    return `${k < 0 ? '−' : ''}${n === 1 ? '' : n}π${d === 1 ? '' : `/${d}`}`;
  };

  function grafico(fig, cfg, lienzo) {
    const ids = comoLista(cfg.param).map((p) => p.id);
    const esc = Object.create(null);
    const params = comoLista(cfg.param).map((p) => {
      const q = { ...p, min: E.evaluar(p.min), max: E.evaluar(p.max), valor: E.evaluar(p.valor), paso: p.paso === undefined ? undefined : E.evaluar(p.paso) };
      esc[p.id] = q.valor;
      return q;
    });
    const expr = (src, extra = []) => E.compilar(src, [...ids, ...extra]);
    const curvas = comoLista(cfg.curvas).map((c, i) => {
      const base = { etq: c.etq || '', i };
      if (c.f !== undefined) return { ...base, tipo: 'f', fn: expr(c.f, ['x']) };
      const t = rangoNum(c.t, 'curva', ids);
      if (c.r !== undefined) return { ...base, tipo: 'pol', fr: expr(c.r, ['t']), t };
      return { ...base, tipo: 'par', fx: expr(c.xt, ['t']), fy: expr(c.yt, ['t']), t };
    });
    const puntos = comoLista(cfg.puntos).map((p) => ({ ...p, fx: expr(p.x), fy: expr(p.y) }));
    const vectores = comoLista(cfg.vectores).map((v, i) => ({ etq: v.etq, i, de: (v.de || [0, 0]).map((s) => expr(s)), a: v.a.map((s) => expr(s)) }));
    const verticales = comoLista(cfg.verticales).map((v) => ({ etq: v.etq, fx: expr(v.x) }));
    const areas = comoLista(cfg.area).map((a) => ({ etq: a.etq, f: expr(a.f, ['x']), g: expr(a.g ?? 0, ['x']), de: expr(a.de), a: expr(a.a) }));
    const tangentes = comoLista(cfg.tangente).map((t, i) => ({ etq: t.etq, i, f: expr(t.f, ['x']), en: expr(t.en) }));
    const igual = cfg.igual ?? (curvas.some((c) => c.tipo !== 'f') || vectores.length > 0);
    const [x0, x1] = rangoNum(cfg.x, 'x').map((f) => f());

    const evF = (fn) => (x) => {
      esc.x = x;
      return fn(esc);
    };

    // A jump survives halving the interval, a steep but continuous stretch does not.
    const salto = (ev, a0, b0, ya0, yb0) => {
      let [a, b, ya, yb] = [a0, b0, ya0, yb0];
      const d0 = Math.abs(yb0 - ya0);
      for (let k = 0; k < 16; k += 1) {
        const m = (a + b) / 2;
        const ym = ev(m);
        if (!Number.isFinite(ym)) return { a, ya, b, yb };
        if (Math.abs(ym - ya) >= Math.abs(yb - ym)) {
          b = m;
          yb = ym;
        } else {
          a = m;
          ya = ym;
        }
      }
      return Math.abs(yb - ya) > d0 * 0.5 ? { a, ya, b, yb } : null;
    };
    // Walks from the defined side towards the undefined one, so the curve reaches its true edge.
    const borde = (ev, xBien, xMal) => {
      let [a, b] = [xBien, xMal];
      for (let k = 0; k < 30; k += 1) {
        const m = (a + b) / 2;
        if (Number.isFinite(ev(m))) a = m;
        else b = m;
      }
      return [a, ev(a)];
    };
    const muestrearF = (ev, a, b, n, escY) => {
      const segs = [];
      let act = null;
      let xp = a;
      let yp = ev(a);
      if (Number.isFinite(yp)) act = [[xp, yp]];
      for (let i = 1; i <= n; i += 1) {
        const x = a + ((b - a) * i) / n;
        const y = ev(x);
        const okA = Number.isFinite(yp);
        const okB = Number.isFinite(y);
        if (okA && okB) {
          if (Math.abs(y - yp) * escY > 8) {
            const s = salto(ev, xp, x, yp, y);
            if (s) {
              act.push([s.a, s.ya]);
              segs.push(act);
              act = [[s.b, s.yb]];
            }
          }
          act.push([x, y]);
        } else if (okA) {
          act.push(borde(ev, xp, x));
          segs.push(act);
          act = null;
        } else if (okB) {
          act = [borde(ev, x, xp), [x, y]];
        }
        xp = x;
        yp = y;
      }
      if (act) segs.push(act);
      return segs;
    };
    const muestrearT = (c, W, H, aPx) => {
      const n = 480;
      esc.t = 0;
      const t0 = c.t[0](esc);
      const t1 = c.t[1](esc);
      const segs = [];
      let act = null;
      let prev = null;
      for (let i = 0; i <= n; i += 1) {
        esc.t = t0 + ((t1 - t0) * i) / n;
        let px;
        let py;
        if (c.tipo === 'pol') {
          const r = c.fr(esc);
          px = r * Math.cos(esc.t);
          py = r * Math.sin(esc.t);
        } else {
          px = c.fx(esc);
          py = c.fy(esc);
        }
        if (!Number.isFinite(px) || !Number.isFinite(py)) {
          if (act) segs.push(act);
          act = null;
          prev = null;
          continue;
        }
        if (prev) {
          const [ax, ay] = aPx(prev[0], prev[1]);
          const [bx, by] = aPx(px, py);
          if (Math.hypot(bx - ax, by - ay) > Math.max(W, H) * 0.7) {
            segs.push(act);
            act = null;
          }
        }
        if (!act) act = [];
        act.push([px, py]);
        prev = [px, py];
      }
      if (act) segs.push(act);
      return segs;
    };

    // Automatic y range: looks at every slider at its ends, so moving one does not change the scale.
    const variantes = () => {
      const lista = [{}];
      params.forEach((p) => {
        lista.push({ [p.id]: p.min }, { [p.id]: p.max });
      });
      return lista;
    };
    const rangoY = () => {
      const ys = [];
      const guardados = params.map((p) => esc[p.id]);
      variantes().forEach((v) => {
        params.forEach((p, i) => {
          esc[p.id] = v[p.id] ?? guardados[i];
        });
        curvas.forEach((c) => {
          if (c.tipo === 'f') {
            const ev = evF(c.fn);
            for (let i = 0; i <= 240; i += 1) ys.push(ev(x0 + ((x1 - x0) * i) / 240));
          } else muestrearT(c, 1e9, 1e9, (a, b) => [a, b]).flat().forEach(([, y]) => ys.push(y));
        });
        tangentes.forEach((t) => {
          const ev = evF(t.f);
          ys.push(ev(t.en(esc)));
        });
        areas.forEach((a) => {
          const f = evF(a.f);
          const g = evF(a.g);
          const d = a.de(esc);
          const h = a.a(esc);
          for (let i = 0; i <= 60; i += 1) {
            const x = d + ((h - d) * i) / 60;
            ys.push(f(x), g(x));
          }
        });
      });
      puntos.forEach((p) => ys.push(p.fy(esc)));
      vectores.forEach((v) => ys.push(v.de[1](esc), v.a[1](esc)));
      params.forEach((p, i) => {
        esc[p.id] = guardados[i];
      });
      const finitos = ys.filter(Number.isFinite).sort((a, b) => a - b);
      if (!finitos.length) return [-1, 1];
      const lo = finitos[Math.floor(finitos.length * 0.03)];
      const hi = finitos[Math.floor(finitos.length * 0.97)];
      let a = finitos[0];
      let b = finitos.at(-1);
      // Poles would flatten everything else: without them the curve keeps its shape.
      if (b - a > (hi - lo) * 3) {
        a = lo;
        b = hi;
      }
      if (a > 0 && a < (b - a) * 0.4) a = 0;
      if (b < 0 && -b < (b - a) * 0.4) b = 0;
      if (a === b) {
        a -= 1;
        b += 1;
      }
      const m = (b - a) * 0.08;
      return [a - m, b + m];
    };

    const base = { x: [x0, x1], y: cfg.y ? rangoNum(cfg.y, 'y').map((f) => f()) : null };
    let vista = null;
    let W = 0;
    let H = 0;
    let fs = 13;
    let impresion = false;
    let abierto = false;
    let cursor = null; // { x } or { curva, i }
    let elegida = 0;

    const LECTURA_VACIA = 'Pasá el cursor, tocá el gráfico o usá las flechas para leer x e y.';
    const lectura = crear('output', { className: 'w-lect w-lect-vacia', 'aria-live': 'polite' }, LECTURA_VACIA);
    const idDesc = fig.querySelector('.w-desc').id;
    const svg = dibu('svg', { role: 'img', 'aria-labelledby': fig.querySelector('figcaption').id, 'aria-describedby': idDesc, class: 'wg' });
    const plano = crear('div', { className: 'w-plano', tabIndex: 0, role: 'application', 'aria-label': 'Gráfico. Flechas izquierda y derecha: leer valores. Mayúscula con flechas: mover. Más y menos: acercar y alejar. Cero: volver.' }, svg);
    const ctl = params.length ? crear('div', { className: 'w-ctl' }) : null;
    const ley = crear('ul', { className: 'w-ley' });
    const pie = crear('div', { className: 'w-pie' }, ley);
    const idPat = nuevoId();
    let capaCursor = null;

    const medir = () => {
      const estilo = getComputedStyle(plano);
      if (impresion) {
        W = 640;
        H = 400;
        fs = 12;
      } else {
        W = plano.clientWidth;
        // Large text setting: numbers grow with it, but never so much that a narrow plot only shows labels.
        fs = Math.min(Math.max(11, parseFloat(estilo.fontSize) * 0.8), Math.max(12, W / 14));
        H = Math.round(Math.max(W * 0.62, Math.min(fs * 15, W * 1.05), 200));
      }
      if (!impresion) plano.style.height = `${H}px`;
      return W > 0;
    };
    const corregirIgual = (v) => {
      if (!igual) return v;
      const kx = W / (v.x[1] - v.x[0]);
      const ky = H / (v.y[1] - v.y[0]);
      const k = Math.min(kx, ky);
      const cx = (v.x[0] + v.x[1]) / 2;
      const cy = (v.y[0] + v.y[1]) / 2;
      return { x: [cx - W / k / 2, cx + W / k / 2], y: [cy - H / k / 2, cy + H / k / 2] };
    };
    const volver = () => {
      if (!base.y) base.y = rangoY();
      vista = corregirIgual({ x: base.x.slice(), y: base.y.slice() });
      cursor = null;
    };
    const aPx = (x, y) => [((x - vista.x[0]) / (vista.x[1] - vista.x[0])) * W, H - ((y - vista.y[0]) / (vista.y[1] - vista.y[0])) * H];
    const deX = (px) => vista.x[0] + (px / W) * (vista.x[1] - vista.x[0]);
    const deY = (py) => vista.y[0] + ((H - py) / H) * (vista.y[1] - vista.y[0]);
    const limita = (v) => Math.max(-H * 3, Math.min(H * 4, v));
    const trazo = (segs) => segs.map((s) => s.map(([x, y], i) => {
      const [px, py] = aPx(x, y);
      return `${i ? 'L' : 'M'}${px.toFixed(1)} ${limita(py).toFixed(1)}`;
    }).join('')).join('');
    const texto = (x, y, t, attrs = {}) => dibu('text', { x: x.toFixed(1), y: y.toFixed(1), ...attrs }, t);

    const flecha = (ax, ay, bx, by, cl, largo = fs * 0.75) => {
      const ang = Math.atan2(by - ay, bx - ax);
      const a1 = ang + Math.PI - 0.42;
      const a2 = ang + Math.PI + 0.42;
      return dibu('polygon', { class: cl, points: `${bx.toFixed(1)},${by.toFixed(1)} ${(bx + largo * Math.cos(a1)).toFixed(1)},${(by + largo * Math.sin(a1)).toFixed(1)} ${(bx + largo * Math.cos(a2)).toFixed(1)},${(by + largo * Math.sin(a2)).toFixed(1)}` });
    };

    const ejes = () => {
      const g = dibu('g', { class: 'wg-ejes' });
      const rotulos = dibu('g', { class: 'wg-num' });
      const xS = vista.x[1] - vista.x[0];
      const yS = vista.y[1] - vista.y[0];
      const usaPi = cfg.marcasX === 'pi';
      const anchoNum = fs * 0.62 * 5;
      let pasoX = usaPi ? (Math.PI / 4) * 2 ** Math.ceil(Math.log2(Math.max(1e-9, (xS * (fs * 3.4)) / W / (Math.PI / 4)))) : pasoLindo((xS * (anchoNum + fs * 0.6)) / W);
      if (usaPi && pasoX < Math.PI / 4) pasoX = Math.PI / 4;
      const pasoY = pasoLindo((yS * fs * 2.6) / H);
      const decX = decimalesDe(pasoX);
      const decY = decimalesDe(pasoY);
      const [px0, py0] = aPx(0, 0);
      // Axes sit at zero when zero is in view, and otherwise on the nearest edge.
      const ejeY = px0 < 1 ? 1 : px0 > W - 1 ? W - 1 : px0;
      const ejeX = py0 < 1 ? 1 : py0 > H - 1 ? H - 1 : py0;
      const abajo = ejeX + fs * 1.15 > H - 2;
      const izquierda = ejeY - fs * 2.2 < 0;
      for (let k = Math.ceil(vista.x[0] / pasoX); k * pasoX <= vista.x[1]; k += 1) {
        const x = k * pasoX;
        const [px] = aPx(x, 0);
        g.append(dibu('line', { class: 'wg-red', x1: px.toFixed(1), x2: px.toFixed(1), y1: 0, y2: H }));
        if (k === 0 && Math.abs(px - ejeY) < 1) continue;
        g.append(dibu('line', { class: 'wg-marca', x1: px.toFixed(1), x2: px.toFixed(1), y1: ejeX - 3, y2: ejeX + 3 }));
        if (px < fs * 0.8 || px > W - fs * 0.8) continue;
        rotulos.append(texto(px, abajo ? ejeX - fs * 0.5 : ejeX + fs * 1.1, usaPi ? fmtPi(x) : numero(x, decX), { 'text-anchor': 'middle' }));
      }
      for (let k = Math.ceil(vista.y[0] / pasoY); k * pasoY <= vista.y[1]; k += 1) {
        const y = k * pasoY;
        const [, py] = aPx(0, y);
        g.append(dibu('line', { class: 'wg-red', x1: 0, x2: W, y1: py.toFixed(1), y2: py.toFixed(1) }));
        if (k === 0 && Math.abs(py - ejeX) < 1) continue;
        g.append(dibu('line', { class: 'wg-marca', x1: ejeY - 3, x2: ejeY + 3, y1: py.toFixed(1), y2: py.toFixed(1) }));
        if (py < fs * 0.7 || py > H - fs * 0.4) continue;
        rotulos.append(texto(izquierda ? ejeY + fs * 0.45 : ejeY - fs * 0.45, py + fs * 0.34, numero(y, decY), { 'text-anchor': izquierda ? 'start' : 'end' }));
      }
      g.append(dibu('line', { class: 'wg-eje', x1: 0, x2: W, y1: ejeX.toFixed(1), y2: ejeX.toFixed(1) }), dibu('line', { class: 'wg-eje', x1: ejeY.toFixed(1), x2: ejeY.toFixed(1), y1: 0, y2: H }));
      g.append(flecha(W - fs, ejeX, W - 1, ejeX, 'wg-punta'), flecha(ejeY, fs, ejeY, 1, 'wg-punta'));
      const nomX = cfg.ejeX || 'x';
      const nomY = cfg.ejeY || 'y';
      rotulos.append(
        texto(W - fs * 1.1, abajo ? ejeX - fs * 0.45 : ejeX - fs * 0.5, nomX, { 'text-anchor': 'end', class: 'wg-nom' }),
        texto(izquierda ? ejeY + fs * 0.75 : ejeY - fs * 0.6, fs * 1.15, nomY, { 'text-anchor': izquierda ? 'start' : 'end', class: 'wg-nom' }),
      );
      return [g, rotulos];
    };

    const hayRect = (rs, r) => rs.some((o) => r.x < o.x + o.w && r.x + r.w > o.x && r.y < o.y + o.h && r.y + r.h > o.y);
    const ponerRotulo = (ocupados, capa, candidatos, t, attrs = {}) => {
      const ancho = t.length * fs * 0.56;
      if (ancho > W * 0.42) return false; // The legend says it anyway.
      for (const [cx, cy] of candidatos) {
        const r = { x: cx, y: cy - fs, w: ancho, h: fs * 1.25 };
        if (r.x < 4 || r.x + r.w > W - 4 || r.y < 4 || r.y + r.h > H - 4 || hayRect(ocupados, r)) continue;
        ocupados.push(r);
        capa.append(texto(cx, cy, t, attrs));
        return true;
      }
      return false;
    };

    const pendiente = (t) => {
      const ev = evF(t.f);
      const x = t.en(esc);
      const h = 1e-5 * Math.max(1, Math.abs(x));
      return { x, y: ev(x), m: (ev(x + h) - ev(x - h)) / (2 * h) };
    };

    const dibujarLeyenda = () => {
      const filas = [];
      const linea = (cl) => dibu('svg', { class: 'w-muestra', viewBox: '0 0 34 10', 'aria-hidden': 'true' }, dibu('line', { class: cl, x1: 0, x2: 34, y1: 5, y2: 5 }));
      curvas.forEach((c) => {
        if (c.etq) filas.push(crear('li', {}, linea(`wg-curva wg-s${c.i % ESTILOS}`), c.etq));
      });
      tangentes.forEach((t) => {
        const p = pendiente(t);
        filas.push(crear('li', {}, linea('wg-tan'), `${t.etq || 'Tangente'} en x = ${numero(p.x)}: pendiente ${Number.isFinite(p.m) ? numero(Number(p.m.toFixed(4))) : 'no definida'}`));
      });
      areas.forEach((a) => {
        if (a.etq) filas.push(crear('li', {}, crear('span', { className: 'w-rayado', 'aria-hidden': 'true' }), a.etq));
      });
      ley.replaceChildren(...filas);
      ley.hidden = !filas.length;
    };

    const dibujar = () => {
      if (!abierto || !medir()) return;
      if (!vista) volver();
      else vista = corregirIgual(vista);
      svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
      svg.setAttribute('width', W);
      svg.setAttribute('height', H);
      svg.style.fontSize = `${fs}px`;
      const idClip = `${idPat}c`;
      const defs = dibu(
        'defs',
        {},
        dibu('clipPath', { id: idClip }, dibu('rect', { x: 0, y: 0, width: W, height: H })),
        dibu('pattern', { id: idPat, patternUnits: 'userSpaceOnUse', width: 8, height: 8, patternTransform: 'rotate(45)' }, dibu('line', { class: 'wg-trama', x1: 0, x2: 0, y1: 0, y2: 8 })),
      );
      const [ejesG, numeros] = ejes();
      const datos = dibu('g', { 'clip-path': `url(#${idClip})` });
      const escY = H / (vista.y[1] - vista.y[0]);
      const ocupados = [];
      const rotulos = dibu('g', { class: 'wg-etqs' });

      areas.forEach((a) => {
        const f = evF(a.f);
        const g = evF(a.g);
        const d = Math.max(a.de(esc), vista.x[0]);
        const h = Math.min(a.a(esc), vista.x[1]);
        if (!(h > d)) return;
        const n = Math.ceil(W);
        const arriba = [];
        const abajo = [];
        const volcar = () => {
          if (arriba.length > 1) {
            const contorno = `${trazo([[...arriba, ...abajo.reverse()]])}Z`;
            datos.append(dibu('path', { class: 'wg-area', d: contorno }), dibu('path', { fill: `url(#${idPat})`, d: contorno }));
          }
          arriba.length = 0;
          abajo.length = 0;
        };
        for (let i = 0; i <= n; i += 1) {
          const x = d + ((h - d) * i) / n;
          const yf = f(x);
          const yg = g(x);
          if (Number.isFinite(yf) && Number.isFinite(yg)) {
            arriba.push([x, yf]);
            abajo.push([x, yg]);
          } else volcar();
        }
        volcar();
      });
      verticales.forEach((v) => {
        const x = v.fx(esc);
        const [px] = aPx(x, 0);
        datos.append(dibu('line', { class: 'wg-vertical', x1: px.toFixed(1), x2: px.toFixed(1), y1: 0, y2: H }));
        if (v.etq) ponerRotulo(ocupados, rotulos, [[px + 5, fs * 1.2], [px - v.etq.length * fs * 0.58, fs * 1.2], [px + 5, H - fs]], v.etq);
      });

      curvas.forEach((c) => {
        const n = Math.ceil(W);
        c.segs = c.tipo === 'f' ? muestrearF(evF(c.fn), vista.x[0], vista.x[1], n, escY) : muestrearT(c, W, H, aPx);
        datos.append(dibu('path', { class: `wg-curva wg-s${c.i % ESTILOS}`, d: trazo(c.segs) }));
      });
      tangentes.forEach((t) => {
        const p = pendiente(t);
        if (!Number.isFinite(p.y) || !Number.isFinite(p.m)) return;
        const a = vista.x[0];
        const b = vista.x[1];
        datos.append(dibu('path', { class: 'wg-tan', d: trazo([[[a, p.y + p.m * (a - p.x)], [b, p.y + p.m * (b - p.x)]]]) }));
        const [px, py] = aPx(p.x, p.y);
        datos.append(dibu('circle', { class: 'wg-punto', cx: px.toFixed(1), cy: py.toFixed(1), r: 4 }));
      });
      vectores.forEach((v) => {
        const [ax, ay] = aPx(v.de[0](esc), v.de[1](esc));
        const [bx, by] = aPx(v.a[0](esc), v.a[1](esc));
        const cl = `wg-s${v.i % ESTILOS}`;
        const lado = Math.hypot(bx - ax, by - ay);
        if (lado > 0.5) {
          const k = Math.max(0, 1 - (fs * 0.6) / lado);
          datos.append(dibu('line', { class: `wg-vector ${cl}`, x1: ax.toFixed(1), y1: ay.toFixed(1), x2: (ax + (bx - ax) * k).toFixed(1), y2: (ay + (by - ay) * k).toFixed(1) }), flecha(ax, ay, bx, by, `wg-vpunta ${cl}`, fs * 0.85));
        }
        if (v.etq) ponerRotulo(ocupados, rotulos, [[bx + 6, by - 5], [bx + 6, by + fs], [bx - v.etq.length * fs * 0.6, by - 6], [bx - v.etq.length * fs * 0.6, by + fs]], v.etq);
      });
      puntos.forEach((p) => {
        const x = p.fx(esc);
        const y = p.fy(esc);
        if (!Number.isFinite(x) || !Number.isFinite(y)) return;
        const [px, py] = aPx(x, y);
        datos.append(dibu('circle', { class: p.abierto ? 'wg-punto wg-hueco' : 'wg-punto', cx: px.toFixed(1), cy: py.toFixed(1), r: 4.5 }));
        if (p.etq) ponerRotulo(ocupados, rotulos, [[px + 7, py - 6], [px + 7, py + fs], [px - p.etq.length * fs * 0.58 - 5, py - 6], [px - p.etq.length * fs * 0.58 - 5, py + fs]], p.etq);
      });
      // Labels next to their curve, only when there is more than one to tell apart. The legend always stays.
      const conEtq = curvas.filter((c) => c.etq);
      if (conEtq.length > 1 && W > fs * 22) {
        conEtq.forEach((c) => {
          const pts = c.segs.flat().map(([x, y]) => aPx(x, y)).filter(([px, py]) => px > 4 && px < W - 4 && py > 4 && py < H - 4);
          if (!pts.length) return;
          const cand = [0.72, 0.5, 0.86, 0.3, 0.15].map((f) => pts[Math.floor((pts.length - 1) * f)]).flatMap(([x, y]) => [[x + 5, y - 6], [x + 5, y + fs + 2]]);
          ponerRotulo(ocupados, rotulos, cand, c.etq, { class: `wg-enc wg-t${c.i % ESTILOS}` });
        });
      }
      capaCursor = dibu('g', { class: 'wg-cursor' });
      svg.replaceChildren(defs, ejesG, datos, numeros, rotulos, capaCursor);
      dibujarLeyenda();
      dibujarCursor();
      fig.dataset.wEstado = 'listo';
    };

    const conF = curvas.filter((c) => c.tipo === 'f');
    const textoLectura = () => {
      if (cursor === null) return null;
      if (cursor.curva !== undefined) {
        const c = curvas[cursor.curva];
        const p = c.segs.flat()[cursor.i];
        return p ? `${c.etq || `Curva ${c.i + 1}`}: x = ${numero(p[0])}, y = ${numero(p[1])}` : null;
      }
      const x = cursor.x;
      if (!conF.length) return `x = ${numero(x)}, y = ${numero(cursor.y ?? NaN)}`;
      const partes = conF.map((c) => {
        const y = evF(c.fn)(x);
        const nombre = conF.length > 1 ? `${c.etq || `Curva ${c.i + 1}`}: ` : '';
        return `${nombre}y = ${Number.isFinite(y) ? numero(y) : 'no definida'}`;
      });
      return `x = ${numero(x)}. ${partes.join('. ')}`;
    };
    const dibujarCursor = () => {
      if (!capaCursor) return;
      const hijos = [];
      if (cursor) {
        if (cursor.curva !== undefined) {
          const p = curvas[cursor.curva].segs.flat()[cursor.i];
          if (p) {
            const [px, py] = aPx(p[0], p[1]);
            hijos.push(dibu('circle', { class: 'wg-leido', cx: px.toFixed(1), cy: py.toFixed(1), r: 5 }));
          }
        } else {
          const [px] = aPx(cursor.x, 0);
          hijos.push(dibu('line', { class: 'wg-guia', x1: px.toFixed(1), x2: px.toFixed(1), y1: 0, y2: H }));
          conF.forEach((c) => {
            const y = evF(c.fn)(cursor.x);
            if (!Number.isFinite(y)) return;
            const [, py] = aPx(cursor.x, y);
            if (py > -10 && py < H + 10) hijos.push(dibu('circle', { class: 'wg-leido', cx: px.toFixed(1), cy: py.toFixed(1), r: 5 }));
          });
          if (!conF.length && cursor.y !== undefined) {
            const [, py] = aPx(cursor.x, cursor.y);
            hijos.push(dibu('line', { class: 'wg-guia', x1: 0, x2: W, y1: py.toFixed(1), y2: py.toFixed(1) }));
          }
        }
      }
      capaCursor.replaceChildren(...hijos);
      const t = textoLectura();
      const mostrar = t || LECTURA_VACIA;
      if (lectura.textContent !== mostrar) lectura.textContent = mostrar;
      lectura.classList.toggle('w-lect-vacia', !t);
    };

    let pedido = false;
    const pedir = () => {
      if (pedido) return;
      pedido = true;
      requestAnimationFrame(() => {
        pedido = false;
        dibujar();
      });
    };

    const acercar = (factor) => {
      const cx = (vista.x[0] + vista.x[1]) / 2;
      const cy = (vista.y[0] + vista.y[1]) / 2;
      const xs = (vista.x[1] - vista.x[0]) * factor;
      const ys = (vista.y[1] - vista.y[0]) * factor;
      if (xs < 1e-6 || xs > 1e7) return;
      vista = { x: [cx - xs / 2, cx + xs / 2], y: [cy - ys / 2, cy + ys / 2] };
      pedir();
    };

    // Pointer: drag moves the view. On a phone only sideways drags reach here, the page keeps its vertical scroll.
    let arrastre = null;
    const cursorEn = (e) => {
      const r = plano.getBoundingClientRect();
      const px = ((e.clientX - r.left) / r.width) * W;
      const py = ((e.clientY - r.top) / r.height) * H;
      if (conF.length) cursor = { x: deX(px) };
      else {
        let mejor = null;
        curvas.forEach((c, ic) => {
          c.segs.flat().forEach(([x, y], i) => {
            const [a, b] = aPx(x, y);
            const d = (a - px) ** 2 + (b - py) ** 2;
            if (!mejor || d < mejor.d) mejor = { d, curva: ic, i };
          });
        });
        cursor = mejor && mejor.d < (fs * 3) ** 2 ? { curva: mejor.curva, i: mejor.i } : { x: deX(px), y: deY(py) };
      }
      dibujarCursor();
    };
    plano.addEventListener('pointerdown', (e) => {
      if (e.button !== 0) return;
      plano.setPointerCapture(e.pointerId);
      arrastre = { id: e.pointerId, x: e.clientX, y: e.clientY, v: vista, movio: false };
    });
    plano.addEventListener('pointermove', (e) => {
      if (arrastre && e.pointerId === arrastre.id) {
        const dx = e.clientX - arrastre.x;
        const dy = e.clientY - arrastre.y;
        if (!arrastre.movio && Math.hypot(dx, dy) < 4) return;
        arrastre.movio = true;
        plano.classList.add('w-agarrado');
        const r = plano.getBoundingClientRect();
        const wx = ((dx / r.width) * (arrastre.v.x[1] - arrastre.v.x[0]));
        const wy = ((dy / r.height) * (arrastre.v.y[1] - arrastre.v.y[0]));
        vista = { x: [arrastre.v.x[0] - wx, arrastre.v.x[1] - wx], y: [arrastre.v.y[0] + wy, arrastre.v.y[1] + wy] };
        pedir();
      } else if (!arrastre && e.pointerType === 'mouse' && abierto) cursorEn(e);
    });
    const soltar = (e) => {
      if (!arrastre) return;
      const fue = arrastre.movio;
      arrastre = null;
      plano.classList.remove('w-agarrado');
      if (!fue && e.type === 'pointerup') cursorEn(e);
    };
    plano.addEventListener('pointerup', soltar);
    plano.addEventListener('pointercancel', soltar);
    plano.addEventListener('pointerleave', (e) => {
      if (e.pointerType === 'mouse' && !arrastre) {
        cursor = null;
        dibujarCursor();
      }
    });
    plano.addEventListener('blur', () => {
      cursor = null;
      dibujarCursor();
    });
    plano.addEventListener('keydown', (e) => {
      if (!vista) return;
      const xS = vista.x[1] - vista.x[0];
      const yS = vista.y[1] - vista.y[0];
      const k = e.key;
      if (e.shiftKey && k.startsWith('Arrow')) {
        const dx = k === 'ArrowLeft' ? -0.1 : k === 'ArrowRight' ? 0.1 : 0;
        const dy = k === 'ArrowDown' ? -0.1 : k === 'ArrowUp' ? 0.1 : 0;
        vista = { x: [vista.x[0] + dx * xS, vista.x[1] + dx * xS], y: [vista.y[0] + dy * yS, vista.y[1] + dy * yS] };
        pedir();
      } else if (k === 'ArrowLeft' || k === 'ArrowRight') {
        const sentido = k === 'ArrowLeft' ? -1 : 1;
        if (conF.length) {
          const paso = pasoLindo(xS / 40);
          const desde = cursor && cursor.x !== undefined ? cursor.x : (vista.x[0] + vista.x[1]) / 2;
          const nx = Math.round(desde / paso + sentido) * paso;
          cursor = { x: Math.max(vista.x[0], Math.min(vista.x[1], nx)) };
        } else if (curvas.length) {
          const lista = curvas[elegida].segs.flat();
          const desde = cursor && cursor.curva === elegida ? cursor.i : Math.floor(lista.length / 2);
          cursor = { curva: elegida, i: (desde + sentido * 4 + lista.length) % lista.length };
        } else {
          const paso = pasoLindo(xS / 40);
          const nx = (cursor?.x ?? (vista.x[0] + vista.x[1]) / 2) + sentido * paso;
          cursor = { x: nx, y: cursor?.y ?? (vista.y[0] + vista.y[1]) / 2 };
        }
        dibujarCursor();
      } else if (k === 'ArrowUp' || k === 'ArrowDown') {
        if (!conF.length && curvas.length > 1) {
          elegida = (elegida + (k === 'ArrowUp' ? 1 : curvas.length - 1)) % curvas.length;
          cursor = { curva: elegida, i: Math.floor(curvas[elegida].segs.flat().length / 2) };
          dibujarCursor();
        } else if (!conF.length && !curvas.length) {
          const paso = pasoLindo(yS / 30);
          cursor = { x: cursor?.x ?? (vista.x[0] + vista.x[1]) / 2, y: (cursor?.y ?? (vista.y[0] + vista.y[1]) / 2) + (k === 'ArrowUp' ? paso : -paso) };
          dibujarCursor();
        } else return; // With functions of x every curve is read at once, so the page keeps its scroll.
      } else if (k === '+' || k === '=') acercar(1 / 1.4);
      else if (k === '-' || k === '_') acercar(1.4);
      else if (k === '0' || k === 'Home') {
        volver();
        pedir();
      } else if (k === 'Escape') {
        cursor = null;
        dibujarCursor();
      } else return;
      e.preventDefault();
    });

    params.forEach((p) => {
      ctl.append(deslizador(p, (v) => {
        esc[p.id] = v;
        pedir();
      }));
    });
    pie.append(crear('div', { className: 'w-botones' }, boton('Acercar', () => acercar(1 / 1.4)), boton('Alejar', () => acercar(1.4)), boton('Volver', () => {
      volver();
      pedir();
    })));
    lienzo.append(plano, lectura);
    if (ctl) lienzo.append(ctl);
    lienzo.append(pie);
    medir();

    return {
      abrir: () => {
        if (abierto) return;
        abierto = true;
        dibujar();
      },
      redibujar: () => {
        if (abierto) dibujar();
      },
      imprimir: (on) => {
        impresion = on;
        if (on && !abierto) abierto = true;
        dibujar();
      },
      imagen: () => {
        if (!abierto) {
          abierto = true;
          dibujar();
        }
        return pngDeSvg(svg);
      },
    };
  }

  // ----- 3D graph. three.js arrives only when a figure comes into view.
  let cargaTres = null;
  const traerTres = () => {
    if (!cargaTres) cargaTres = import('./three/three.module.min.js');
    return cargaTres;
  };
  const hayWebGL = () => {
    try {
      const c = document.createElement('canvas');
      const gl = c.getContext('webgl2');
      if (!gl) return false;
      gl.getExtension('WEBGL_lose_context')?.loseContext();
      return true;
    } catch {
      return false;
    }
  };
  const figuras3d = new Set();
  const MAX_VIVAS = 3;

  function grafico3d(fig, cfg, lienzo) {
    const ids = comoLista(cfg.param).map((p) => p.id);
    const esc = Object.create(null);
    const params = comoLista(cfg.param).map((p) => {
      const q = { ...p, min: E.evaluar(p.min), max: E.evaluar(p.max), valor: E.evaluar(p.valor), paso: p.paso === undefined ? undefined : E.evaluar(p.paso) };
      esc[p.id] = q.valor;
      return q;
    });
    const expr = (src, extra = []) => E.compilar(src, [...ids, ...extra]);
    const superficies = comoLista(cfg.superficies).map((s, i) => {
      const n = Math.min(90, Math.max(8, s.n || 48));
      if (s.z !== undefined) return { etq: s.etq, i, n, fz: expr(s.z, ['x', 'y']) };
      return { etq: s.etq, i, n, fx: expr(s.xuv, ['u', 'v']), fy: expr(s.yuv, ['u', 'v']), fz: expr(s.zuv, ['u', 'v']), u: rangoNum(s.u, 'u', ids), v: rangoNum(s.v, 'v', ids), par: true };
    });
    const planos = comoLista(cfg.planos).map((p, i) => ({ etq: p.etq, i: i + superficies.length, a: expr(p.a), b: expr(p.b), c: expr(p.c), d: expr(p.d) }));
    const curvas = comoLista(cfg.curvas).map((c, i) => ({ etq: c.etq, i, fx: expr(c.xt, ['t']), fy: expr(c.yt, ['t']), fz: expr(c.zt, ['t']), t: rangoNum(c.t, 't', ids) }));
    const vectores = comoLista(cfg.vectores).map((v, i) => ({ etq: v.etq, i, de: (v.de || [0, 0, 0]).map((s) => expr(s)), a: v.a.map((s) => expr(s)) }));
    const puntos = comoLista(cfg.puntos).map((p) => ({ etq: p.etq, fx: expr(p.x), fy: expr(p.y), fz: expr(p.z) }));
    const rx = rangoNum(cfg.x, 'x').map((f) => f());
    const ry = rangoNum(cfg.y, 'y').map((f) => f());
    const rz = (() => {
      if (cfg.z) return rangoNum(cfg.z, 'z').map((f) => f());
      const zs = [];
      const guardados = params.map((p) => esc[p.id]);
      [{}, ...params.flatMap((p) => [{ [p.id]: p.min }, { [p.id]: p.max }])].forEach((v) => {
        params.forEach((p, i) => {
          esc[p.id] = v[p.id] ?? guardados[i];
        });
        superficies.filter((s) => !s.par).forEach((s) => {
          for (let i = 0; i <= 24; i += 1) {
            for (let j = 0; j <= 24; j += 1) {
              esc.x = rx[0] + ((rx[1] - rx[0]) * i) / 24;
              esc.y = ry[0] + ((ry[1] - ry[0]) * j) / 24;
              zs.push(s.fz(esc));
            }
          }
        });
        superficies.filter((s) => s.par).forEach((s) => {
          const [u0, u1] = s.u.map((f) => f(esc));
          const [v0, v1] = s.v.map((f) => f(esc));
          for (let i = 0; i <= 24; i += 1) {
            for (let j = 0; j <= 24; j += 1) {
              esc.u = u0 + ((u1 - u0) * i) / 24;
              esc.v = v0 + ((v1 - v0) * j) / 24;
              zs.push(s.fz(esc));
            }
          }
        });
        curvas.forEach((c) => {
          const [t0, t1] = c.t.map((f) => f(esc));
          for (let i = 0; i <= 60; i += 1) {
            esc.t = t0 + ((t1 - t0) * i) / 60;
            zs.push(c.fz(esc));
          }
        });
      });
      params.forEach((p, i) => {
        esc[p.id] = guardados[i];
      });
      vectores.forEach((v) => zs.push(v.a[2](esc), v.de[2](esc)));
      puntos.forEach((p) => zs.push(p.fz(esc)));
      const f = zs.filter(Number.isFinite).sort((a, b) => a - b);
      if (!f.length) return [-1, 1];
      let a = f[Math.floor(f.length * 0.02)];
      let b = f[Math.floor(f.length * 0.98)];
      if (a === b) {
        a -= 1;
        b += 1;
      }
      const m = (b - a) * 0.08;
      return [Math.min(a - m, 0), Math.max(b + m, 0)];
    })();
    const mitad = [(rx[1] - rx[0]) / 2, (ry[1] - ry[0]) / 2, (rz[1] - rz[0]) / 2];
    const centro = [(rx[1] + rx[0]) / 2, (ry[1] + ry[0]) / 2, (rz[1] + rz[0]) / 2];
    const mayor = Math.max(...mitad);
    // Same scale on all axes unless the ranges are too different to read together.
    const uniforme = cfg.igual ?? Math.max(...mitad) / Math.min(...mitad) <= 3;
    const k3 = uniforme ? [1 / mayor, 1 / mayor, 1 / mayor] : mitad.map((m) => 1 / m);
    const borde = mitad.map((m, i) => m * k3[i]);

    const ANG0 = { giro: -0.68, alza: 0.46, dist: 1 };
    const camara = { ...ANG0 };
    let T = null;
    let v = null; // Everything that holds GPU memory.
    let viva = false;
    let queriendo = false;
    let visible = false;
    let cuadroPedido = false;

    const figEscena = crear('div', { className: 'w-escena', tabIndex: 0, role: 'application', 'aria-label': 'Figura en 3D. Flechas: girar. Más y menos: acercar y alejar.', 'aria-describedby': fig.querySelector('.w-desc').id });
    // Until it is drawn, the scene (already at its height) is a skeleton, .esq in utn.css. The words are for screen readers.
    const estadoTexto = crear('span', { className: 'vh' }, 'Cargando la figura en 3D.');
    const estado = crear('p', { className: 'w-cargando' }, crear('span', { className: 'esq esq-bloque', 'aria-hidden': 'true' }), estadoTexto);
    figEscena.append(estado);
    figEscena.setAttribute('aria-busy', 'true');
    const ctl = params.length ? crear('div', { className: 'w-ctl' }) : null;
    const ley = crear('ul', { className: 'w-ley' });
    const pie = crear('div', { className: 'w-pie' }, ley);

    const aMundo = (x, y, z) => new T.Vector3((x - centro[0]) * k3[0], (z - centro[2]) * k3[2], -(y - centro[1]) * k3[1]);
    const limite = 6;
    const acotar = (w) => {
      w.x = Math.max(-limite, Math.min(limite, w.x));
      w.y = Math.max(-limite, Math.min(limite, w.y));
      w.z = Math.max(-limite, Math.min(limite, w.z));
      return w;
    };

    const alturaPx = () => {
      const fs = parseFloat(getComputedStyle(figEscena).fontSize);
      const W = figEscena.clientWidth;
      return Math.round(Math.max(W * 0.72, Math.min(fs * 17, W * 1.1), 240));
    };

    const textura = (texto, opciones = {}) => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const fs = (opciones.px || 13) * dpr;
      const fam = getComputedStyle(raizDoc).getPropertyValue(opciones.mano ? '--mano' : '--sans') || 'sans-serif';
      const fuente = `${opciones.peso || 600} ${fs}px ${fam}`;
      const c = document.createElement('canvas');
      const ctx = c.getContext('2d');
      ctx.font = fuente;
      const ancho = Math.ceil(ctx.measureText(texto).width + fs);
      const alto = Math.ceil(fs * 1.7);
      c.width = ancho;
      c.height = alto;
      const d = c.getContext('2d');
      d.font = fuente;
      d.textBaseline = 'middle';
      d.textAlign = 'center';
      d.lineJoin = 'round';
      d.lineWidth = fs * 0.32;
      d.strokeStyle = v.colores.papel;
      d.strokeText(texto, ancho / 2, alto / 2);
      d.fillStyle = opciones.color || v.colores.tinta;
      d.fillText(texto, ancho / 2, alto / 2);
      const t = new T.CanvasTexture(c);
      t.colorSpace = T.SRGBColorSpace;
      t.minFilter = T.LinearFilter;
      t.generateMipmaps = false;
      return { t, ancho: ancho / dpr, alto: alto / dpr };
    };
    const rotulo = (texto, pos, grupo, opciones = {}) => {
      const { t, ancho, alto } = textura(texto, { px: opciones.px || v.fsRot, ...opciones });
      const m = new T.SpriteMaterial({ map: t, depthTest: false, depthWrite: false, sizeAttenuation: false, transparent: true });
      const s = new T.Sprite(m);
      s.position.copy(pos);
      s.renderOrder = 10;
      s.userData.tam = [ancho, alto];
      grupo.add(s);
      return s;
    };
    const ajustarRotulos = (H) => {
      const k = 2 / (H * v.cam.projectionMatrix.elements[5]);
      for (const g of [v.fijos, v.datos]) {
        g.traverse((o) => {
          if (o.isSprite) o.scale.set(o.userData.tam[0] * k, o.userData.tam[1] * k, 1);
        });
      }
    };
    const barra = (a, b, r, mat, grupo, seg = 8) => {
      const dir = new T.Vector3().subVectors(b, a);
      const largo = dir.length();
      if (largo < 1e-6) return;
      const geo = new T.CylinderGeometry(r, r, largo, seg, 1);
      const me = new T.Mesh(geo, mat);
      me.position.copy(a).addScaledVector(dir, 0.5);
      me.quaternion.setFromUnitVectors(new T.Vector3(0, 1, 0), dir.normalize());
      grupo.add(me);
    };
    const punta = (a, b, r, largo, mat, grupo) => {
      const dir = new T.Vector3().subVectors(b, a).normalize();
      const geo = new T.ConeGeometry(r, largo, 16);
      const me = new T.Mesh(geo, mat);
      me.position.copy(b).addScaledVector(dir, -largo / 2);
      me.quaternion.setFromUnitVectors(new T.Vector3(0, 1, 0), dir);
      grupo.add(me);
    };

    const planosCorte = () => {
      const m = 1.002;
      return [
        new T.Plane(new T.Vector3(1, 0, 0), borde[0] * m),
        new T.Plane(new T.Vector3(-1, 0, 0), borde[0] * m),
        new T.Plane(new T.Vector3(0, 1, 0), borde[2] * m),
        new T.Plane(new T.Vector3(0, -1, 0), borde[2] * m),
        new T.Plane(new T.Vector3(0, 0, 1), borde[1] * m),
        new T.Plane(new T.Vector3(0, 0, -1), borde[1] * m),
      ];
    };

    const armarFijos = () => {
      const g = v.fijos;
      const [bx, by, bz] = borde;
      const c = v.colores;
      const matEje = new T.MeshBasicMaterial({ color: c.tinta });
      const matMarca = new T.MeshBasicMaterial({ color: c.tinta });
      const lineaMat = new T.LineBasicMaterial({ color: c.borde });
      const redMat = new T.LineBasicMaterial({ color: c.cuadro });
      v.mats.push(matEje, matMarca, lineaMat, redMat);
      // The cage and a graph paper floor, so depth can be read without shading tricks.
      const cubo = new T.BoxGeometry(bx * 2, bz * 2, by * 2);
      const aristas = new T.EdgesGeometry(cubo);
      cubo.dispose();
      g.add(new T.LineSegments(aristas, lineaMat));
      const ceroZ = rz[0] <= 0 && rz[1] >= 0 ? (0 - centro[2]) * k3[2] : -bz;
      const ori = [rx[0] <= 0 && rx[1] >= 0 ? 0 : centro[0], ry[0] <= 0 && ry[1] >= 0 ? 0 : centro[1], rz[0] <= 0 && rz[1] >= 0 ? 0 : rz[0]];
      const O = aMundo(ori[0], ori[1], ori[2]);
      const pasoRed = pasoLindo(Math.max(mitad[0], mitad[1]) / 3);
      const pts = [];
      for (let k = Math.ceil(rx[0] / pasoRed); k * pasoRed <= rx[1] + 1e-9; k += 1) {
        const w = aMundo(k * pasoRed, 0, 0);
        pts.push(w.x, ceroZ, -by, w.x, ceroZ, by);
      }
      for (let k = Math.ceil(ry[0] / pasoRed); k * pasoRed <= ry[1] + 1e-9; k += 1) {
        const w = aMundo(0, k * pasoRed, 0);
        pts.push(-bx, ceroZ, w.z, bx, ceroZ, w.z);
      }
      const redGeo = new T.BufferGeometry();
      redGeo.setAttribute('position', new T.Float32BufferAttribute(pts, 3));
      g.add(new T.LineSegments(redGeo, redMat));

      const ejes = [
        { nom: cfg.ejeX || 'x', de: [rx[0], ori[1], ori[2]], a: [rx[1], ori[1], ori[2]], i: 0, r: rx },
        { nom: cfg.ejeY || 'y', de: [ori[0], ry[0], ori[2]], a: [ori[0], ry[1], ori[2]], i: 1, r: ry },
        { nom: cfg.ejeZ || 'z', de: [ori[0], ori[1], rz[0]], a: [ori[0], ori[1], rz[1]], i: 2, r: rz },
      ];
      const grosor = 0.0075;
      ejes.forEach((e) => {
        const A = aMundo(...e.de);
        const B = aMundo(...e.a);
        const dir = new T.Vector3().subVectors(B, A).normalize();
        const extra = B.clone().addScaledVector(dir, 0.1);
        barra(A, B, grosor, matEje, g);
        punta(A, extra, 0.035, 0.11, matEje, g);
        rotulo(e.nom, extra.clone().addScaledVector(dir, 0.08), g, { px: v.fsRot * 1.25, peso: 700 });
        const paso = pasoLindo((e.r[1] - e.r[0]) / v.marcasEje);
        for (let k = Math.ceil(e.r[0] / paso); k * paso <= e.r[1] + 1e-9; k += 1) {
          const val = k * paso;
          if (Math.abs(val) < paso * 1e-6) continue;
          const pos = e.a.slice();
          pos[e.i] = val;
          const w = aMundo(...pos);
          const lado = e.i === 2 ? new T.Vector3(1, 0, 1).normalize() : new T.Vector3(0, 1, 0);
          barra(w.clone().addScaledVector(lado, -0.022), w.clone().addScaledVector(lado, 0.022), grosor * 0.8, matMarca, g, 6);
          rotulo(numero(val, decimalesDe(paso)), w.clone().addScaledVector(lado, e.i === 2 ? 0.1 : -0.075), g, { peso: 500, px: v.fsRot * 0.92 });
        }
      });
    };

    const colorSerie = (i) => v.colores.serie[i % v.colores.serie.length];

    const mallaSuperficie = (s) => {
      const n = s.n;
      const pos = new Float32Array((n + 1) * (n + 1) * 3);
      const ok = new Uint8Array((n + 1) * (n + 1));
      let a0;
      let a1;
      let b0;
      let b1;
      if (s.par) {
        [a0, a1] = s.u.map((f) => f(esc));
        [b0, b1] = s.v.map((f) => f(esc));
      }
      for (let i = 0; i <= n; i += 1) {
        for (let j = 0; j <= n; j += 1) {
          const q = i * (n + 1) + j;
          let x;
          let y;
          let z;
          if (s.par) {
            esc.u = a0 + ((a1 - a0) * i) / n;
            esc.v = b0 + ((b1 - b0) * j) / n;
            x = s.fx(esc);
            y = s.fy(esc);
            z = s.fz(esc);
          } else {
            x = rx[0] + ((rx[1] - rx[0]) * i) / n;
            y = ry[0] + ((ry[1] - ry[0]) * j) / n;
            esc.x = x;
            esc.y = y;
            z = s.fz(esc);
          }
          const bien = Number.isFinite(x) && Number.isFinite(y) && Number.isFinite(z);
          ok[q] = bien ? 1 : 0;
          const w = bien ? acotar(aMundo(x, y, z)) : { x: 0, y: 0, z: 0 };
          pos[q * 3] = w.x;
          pos[q * 3 + 1] = w.y;
          pos[q * 3 + 2] = w.z;
        }
      }
      const idx = [];
      for (let i = 0; i < n; i += 1) {
        for (let j = 0; j < n; j += 1) {
          const a = i * (n + 1) + j;
          const b = a + 1;
          const c = a + n + 1;
          const d = c + 1;
          if (ok[a] && ok[b] && ok[c]) idx.push(a, c, b);
          if (ok[b] && ok[c] && ok[d]) idx.push(b, c, d);
        }
      }
      const geo = new T.BufferGeometry();
      geo.setAttribute('position', new T.BufferAttribute(pos, 3));
      geo.setIndex(idx);
      geo.computeVertexNormals();
      // Pen lines over the surface. The density also tells two surfaces apart without relying on colour.
      const cada = s.i % 2 ? Math.max(2, Math.round(n / 6)) : Math.max(2, Math.round(n / 12));
      const lineas = [];
      const unir = (a, b) => {
        if (ok[a] && ok[b]) lineas.push(pos[a * 3], pos[a * 3 + 1], pos[a * 3 + 2], pos[b * 3], pos[b * 3 + 1], pos[b * 3 + 2]);
      };
      for (let i = 0; i <= n; i += 1) {
        for (let j = 0; j <= n; j += 1) {
          const q = i * (n + 1) + j;
          if (i % cada === 0 && j < n) unir(q, q + 1);
          if (j % cada === 0 && i < n) unir(q, q + n + 1);
        }
      }
      const lin = new T.BufferGeometry();
      lin.setAttribute('position', new T.Float32BufferAttribute(lineas, 3));
      // The label goes on the part of the surface that faces the viewer, off the z axis, and inside the box.
      let ancla = null;
      for (const [fi, fj] of [[0.72, 0.28], [0.72, 0.72], [0.28, 0.28], [0.6, 0.4], [0.5, 0.5]]) {
        const q = Math.floor(fi * n) * (n + 1) + Math.floor(fj * n);
        const dentro = ok[q] && Math.abs(pos[q * 3]) <= borde[0] && Math.abs(pos[q * 3 + 1]) <= borde[2] && Math.abs(pos[q * 3 + 2]) <= borde[1];
        if (dentro) {
          ancla = new T.Vector3(pos[q * 3], pos[q * 3 + 1], pos[q * 3 + 2]);
          break;
        }
      }
      return { geo, lin, ancla };
    };

    const poligonoPlano = (a, b, c, d) => {
      // Corners of the box in math coordinates, then where the plane cuts each edge.
      const pts = [];
      const X = rx;
      const Y = ry;
      const Z = rz;
      const f = (x, y, z) => a * x + b * y + c * z - d;
      const arista = (p, q) => {
        const fp = f(...p);
        const fq = f(...q);
        if ((fp <= 0 && fq > 0) || (fp > 0 && fq <= 0)) {
          const k = fp / (fp - fq);
          pts.push([p[0] + (q[0] - p[0]) * k, p[1] + (q[1] - p[1]) * k, p[2] + (q[2] - p[2]) * k]);
        }
      };
      for (const y of Y) for (const z of Z) arista([X[0], y, z], [X[1], y, z]);
      for (const x of X) for (const z of Z) arista([x, Y[0], z], [x, Y[1], z]);
      for (const x of X) for (const y of Y) arista([x, y, Z[0]], [x, y, Z[1]]);
      if (pts.length < 3) return null;
      const w = pts.map((p) => aMundo(...p));
      const cen = w.reduce((s, p) => s.add(p), new T.Vector3()).divideScalar(w.length);
      const nor = new T.Vector3(a / k3[0], c / k3[2], -b / k3[1]).normalize();
      const e1 = new T.Vector3().subVectors(w[0], cen).normalize();
      const e2 = new T.Vector3().crossVectors(nor, e1);
      w.sort((p, q) => {
        const dp = new T.Vector3().subVectors(p, cen);
        const dq = new T.Vector3().subVectors(q, cen);
        return Math.atan2(dp.dot(e2), dp.dot(e1)) - Math.atan2(dq.dot(e2), dq.dot(e1));
      });
      return { w, cen };
    };

    const armarDatos = () => {
      const g = v.datos;
      limpiar(g);
      const corte = v.corte;
      const c = v.colores;
      const sobreSuperficie = new T.LineBasicMaterial({ color: c.papel, clippingPlanes: corte, transparent: true, opacity: 0.75 });
      v.temporales.push(sobreSuperficie);
      superficies.forEach((s) => {
        const { geo, lin, ancla } = mallaSuperficie(s);
        const color3 = colorSerie(s.i);
        const mat = new T.MeshLambertMaterial({ color: color3, side: T.DoubleSide, clippingPlanes: corte, transparent: true, opacity: 0.88, polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1 });
        v.temporales.push(mat);
        const me = new T.Mesh(geo, mat);
        me.frustumCulled = false;
        g.add(me);
        const li = new T.LineSegments(lin, sobreSuperficie);
        li.frustumCulled = false;
        g.add(li);
        if (s.etq && ancla && v.conNombres) rotulo(s.etq, ancla, g, { mano: true, color: c.tinta, px: v.fsRot * 1.05 });
      });
      planos.forEach((p) => {
        const res = poligonoPlano(p.a(esc), p.b(esc), p.c(esc), p.d(esc));
        if (!res) return;
        const { w, cen } = res;
        const pos = [];
        w.forEach((q, i) => {
          const r = w[(i + 1) % w.length];
          pos.push(cen.x, cen.y, cen.z, q.x, q.y, q.z, r.x, r.y, r.z);
        });
        const geo = new T.BufferGeometry();
        geo.setAttribute('position', new T.Float32BufferAttribute(pos, 3));
        const col = colorSerie(p.i);
        const mat = new T.MeshBasicMaterial({ color: col, side: T.DoubleSide, transparent: true, opacity: 0.32, depthWrite: false });
        v.temporales.push(mat);
        const me = new T.Mesh(geo, mat);
        me.frustumCulled = false;
        g.add(me);
        const bordeMat = new T.LineDashedMaterial({ color: col, dashSize: 0.07, gapSize: p.i % 2 ? 0.05 : 0.0001 });
        v.temporales.push(bordeMat);
        const lazo = new T.LineLoop(new T.BufferGeometry().setFromPoints(w), bordeMat);
        lazo.computeLineDistances();
        lazo.frustumCulled = false;
        g.add(lazo);
        if (p.etq && v.conNombres) rotulo(p.etq, cen.clone().lerp(w[0], 0.62), g, { mano: true, px: v.fsRot * 1.05 });
      });
      curvas.forEach((cu) => {
        const [t0, t1] = cu.t.map((f) => f(esc));
        const col = colorSerie(cu.i + superficies.length + planos.length);
        const mat = new T.MeshBasicMaterial({ color: col, clippingPlanes: corte });
        v.temporales.push(mat);
        const tramos = [];
        let act = [];
        for (let i = 0; i <= 200; i += 1) {
          esc.t = t0 + ((t1 - t0) * i) / 200;
          const x = cu.fx(esc);
          const y = cu.fy(esc);
          const z = cu.fz(esc);
          if (Number.isFinite(x) && Number.isFinite(y) && Number.isFinite(z)) act.push(acotar(aMundo(x, y, z)));
          else {
            if (act.length > 1) tramos.push(act);
            act = [];
          }
        }
        if (act.length > 1) tramos.push(act);
        tramos.forEach((tr) => {
          const me = new T.Mesh(new T.TubeGeometry(new T.CatmullRomCurve3(tr), Math.min(300, tr.length * 2), 0.014, 7, false), mat);
          me.frustumCulled = false;
          g.add(me);
        });
        if (cu.etq && tramos.length) {
          const tr = tramos[0];
          rotulo(cu.etq, tr[Math.floor(tr.length * 0.7)].clone().add(new T.Vector3(0, 0.1, 0)), g, { mano: true, px: v.fsRot * 1.05 });
        }
      });
      vectores.forEach((ve) => {
        const A = aMundo(...ve.de.map((f) => f(esc)));
        const B = aMundo(...ve.a.map((f) => f(esc)));
        const col = colorSerie(ve.i + superficies.length + planos.length + curvas.length);
        const mat = new T.MeshBasicMaterial({ color: col });
        v.temporales.push(mat);
        const dir = new T.Vector3().subVectors(B, A);
        const largo = dir.length();
        if (largo > 0.02) {
          const fin = B.clone().addScaledVector(dir.normalize(), -Math.min(0.1, largo * 0.5));
          barra(A, fin, 0.012, mat, g);
          punta(A, B, 0.04, Math.min(0.12, largo * 0.6), mat, g);
        }
        if (ve.etq) rotulo(ve.etq, B.clone().add(new T.Vector3(0.05, 0.08, 0)), g, { mano: true, px: v.fsRot * 1.05 });
      });
      puntos.forEach((p) => {
        const x = p.fx(esc);
        const y = p.fy(esc);
        const z = p.fz(esc);
        if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z)) return;
        const mat = new T.MeshBasicMaterial({ color: c.tinta });
        v.temporales.push(mat);
        const me = new T.Mesh(new T.SphereGeometry(0.04, 16, 12), mat);
        me.position.copy(aMundo(x, y, z));
        g.add(me);
        if (p.etq) rotulo(p.etq, me.position.clone().add(new T.Vector3(0.06, 0.08, 0)), g, { mano: true, px: v.fsRot * 1.05 });
      });
      if (v.ultimoH) ajustarRotulos(v.ultimoH);
    };

    const limpiar = (g) => {
      const fuera = [];
      g.traverse((o) => {
        if (o !== g) fuera.push(o);
      });
      fuera.forEach((o) => {
        o.geometry?.dispose();
        if (o.isSprite) {
          o.material.map?.dispose();
          o.material.dispose();
        }
      });
      g.clear();
      if (g === v.datos) {
        v.temporales.forEach((m) => m.dispose());
        v.temporales = [];
      }
    };

    const encuadrar = () => {
      const W = figEscena.clientWidth;
      if (!W) return false;
      const H = alturaPx();
      figEscena.style.height = `${H}px`;
      v.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      v.renderer.setSize(W, H, false);
      v.cam.aspect = W / H;
      v.cam.updateProjectionMatrix();
      v.ultimoH = H;
      ajustarRotulos(H);
      return true;
    };
    const ubicarCamara = () => {
      const radio = Math.hypot(...borde) * 0.94;
      const fovV = (v.cam.fov * Math.PI) / 360;
      const fovH = Math.atan(Math.tan(fovV) * v.cam.aspect);
      const d = (radio / Math.sin(Math.min(fovV, fovH))) * camara.dist;
      const [ce, se, ca, sa] = [Math.cos(camara.alza), Math.sin(camara.alza), Math.cos(camara.giro), Math.sin(camara.giro)];
      v.cam.position.set(d * ce * ca, d * se, -d * ce * sa);
      v.cam.lookAt(0, 0, 0);
      v.luz.position.copy(v.cam.position).add(new T.Vector3(1.5, 3, 0));
    };
    const pintar = () => {
      if (!v || cuadroPedido) return;
      cuadroPedido = true;
      requestAnimationFrame(() => {
        cuadroPedido = false;
        if (!v) return;
        ubicarCamara();
        v.renderer.render(v.escena, v.cam);
        fig.dataset.wEstado = 'listo';
      });
    };

    const leerColores = () => ({
      papel: color('--papel'),
      tinta: color('--tinta'),
      borde: color('--borde'),
      cuadro: color('--cuadro'),
      serie: VARS_SERIE.map(color),
    });
    const armarEscena = () => {
      limpiarEscena();
      v.colores = leerColores();
      const anchoEscena = figEscena.clientWidth;
      v.fsRot = Math.min(Math.max(11, parseFloat(getComputedStyle(figEscena).fontSize) * 0.82), Math.max(12, anchoEscena / 17));
      // In a narrow scene, names stay in the legend and axes keep fewer numbers.
      v.conNombres = anchoEscena / v.fsRot > 22;
      v.marcasEje = anchoEscena < 340 ? 3 : 4.5;
      v.escena.background = new T.Color(v.colores.papel);
      armarFijos();
      armarDatos();
      encuadrar();
    };
    const limpiarEscena = () => {
      limpiar(v.fijos);
      limpiar(v.datos);
      v.mats.forEach((m) => m.dispose());
      v.mats = [];
    };

    const encender = async () => {
      if (v || queriendo) return;
      if (!hayWebGL()) {
        sinWebGL();
        return;
      }
      queriendo = true;
      try {
        T = await traerTres();
      } catch (err) {
        queriendo = false;
        console.error(err);
        sinWebGL();
        return;
      }
      queriendo = false;
      if (v) return;
      let renderer;
      try {
        renderer = new T.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'low-power' });
      } catch {
        sinWebGL();
        return;
      }
      estado.remove();
      figEscena.removeAttribute('aria-busy');
      renderer.localClippingEnabled = true;
      const lienzo3 = renderer.domElement;
      lienzo3.className = 'w-webgl';
      lienzo3.setAttribute('aria-hidden', 'true');
      figEscena.prepend(lienzo3);
      const escena = new T.Scene();
      const cam = new T.PerspectiveCamera(26, 1, 0.05, 80);
      escena.add(new T.HemisphereLight(0xffffff, 0x9aa3b8, 1.7));
      const luz = new T.DirectionalLight(0xffffff, 1.5);
      escena.add(luz);
      const fijos = new T.Group();
      const datos = new T.Group();
      escena.add(fijos, datos);
      v = { renderer, escena, cam, luz, fijos, datos, mats: [], temporales: [], corte: null, colores: null };
      v.corte = planosCorte();
      viva = true;
      figuras3d.add(api);
      armarEscena();
      pintar();
      soltarDeMas();
      // Canvas labels do not repaint by themselves when the page's fonts arrive.
      if (document.fonts?.status !== 'loaded') {
        document.fonts?.ready.then(() => {
          if (v) {
            armarEscena();
            pintar();
          }
        });
      }
    };
    const apagar = () => {
      if (!v) return;
      limpiarEscena();
      v.renderer.dispose();
      v.renderer.forceContextLoss();
      v.renderer.domElement.remove();
      v = null;
      viva = false;
      figuras3d.delete(api);
      figEscena.prepend(estado);
      estadoTexto.textContent = 'La figura se vuelve a dibujar cuando la mirás.';
      fig.dataset.wEstado = 'pausada';
    };
    // Browsers allow few live WebGL contexts, so figures out of view give theirs back.
    const soltarDeMas = () => {
      if (figuras3d.size <= MAX_VIVAS) return;
      figuras3d.forEach((f) => {
        if (figuras3d.size > MAX_VIVAS && !f.visible()) f.apagar();
      });
    };
    const sinWebGL = () => {
      fig.classList.add('w-sin3d');
      fig.dataset.wEstado = 'sin-webgl';
      figEscena.hidden = true;
      figEscena.removeAttribute('aria-busy');
      ayudita.hidden = true;
      if (ctl) ctl.hidden = true;
      pie.hidden = true;
      if (!lienzo.querySelector('.w-aviso')) aviso(lienzo, 'Este navegador no puede dibujar figuras en 3D. La figura está contada con palabras acá abajo.');
    };

    // Rotate: touch-action lets the page scroll vertically, and sideways drags reach this code.
    let arrastre = null;
    figEscena.addEventListener('pointerdown', (e) => {
      if (e.button !== 0) return;
      figEscena.setPointerCapture(e.pointerId);
      arrastre = { id: e.pointerId, x: e.clientX, y: e.clientY, giro: camara.giro, alza: camara.alza };
    });
    figEscena.addEventListener('pointermove', (e) => {
      if (!arrastre || e.pointerId !== arrastre.id) return;
      figEscena.classList.add('w-agarrado');
      camara.giro = arrastre.giro - (e.clientX - arrastre.x) * 0.01;
      camara.alza = Math.max(-1.45, Math.min(1.45, arrastre.alza + (e.clientY - arrastre.y) * 0.01));
      pintar();
    });
    const soltar = () => {
      arrastre = null;
      figEscena.classList.remove('w-agarrado');
    };
    figEscena.addEventListener('pointerup', soltar);
    figEscena.addEventListener('pointercancel', soltar);
    const zoom = (f) => {
      camara.dist = Math.max(0.3, Math.min(2.5, camara.dist * f));
      pintar();
    };
    const reiniciar = () => {
      Object.assign(camara, ANG0);
      pintar();
    };
    figEscena.addEventListener('keydown', (e) => {
      const k = e.key;
      if (k === 'ArrowLeft') camara.giro += 0.14;
      else if (k === 'ArrowRight') camara.giro -= 0.14;
      else if (k === 'ArrowUp') camara.alza = Math.min(1.45, camara.alza + 0.12);
      else if (k === 'ArrowDown') camara.alza = Math.max(-1.45, camara.alza - 0.12);
      else if (k === '+' || k === '=') camara.dist = Math.max(0.3, camara.dist / 1.2);
      else if (k === '-' || k === '_') camara.dist = Math.min(2.5, camara.dist * 1.2);
      else if (k === '0' || k === 'Home') Object.assign(camara, ANG0);
      else return;
      e.preventDefault();
      pintar();
    });

    let pedidoDatos = false;
    params.forEach((p) => {
      ctl.append(deslizador(p, (val) => {
        esc[p.id] = val;
        if (pedidoDatos || !v) return;
        pedidoDatos = true;
        requestAnimationFrame(() => {
          pedidoDatos = false;
          if (!v) return;
          armarDatos();
          pintar();
        });
      }));
    });

    const filas = [];
    [...superficies, ...planos].forEach((s) => {
      if (!s.etq) return;
      const sw = crear('span', { className: 'w-mancha', 'aria-hidden': 'true' });
      sw.style.setProperty('--c', `var(${VARS_SERIE[s.i % VARS_SERIE.length]})`);
      filas.push(crear('li', {}, sw, s.etq));
    });
    [...curvas.map((c, i) => ({ c, n: i + superficies.length + planos.length })), ...vectores.map((c, i) => ({ c, n: i + superficies.length + planos.length + curvas.length }))].forEach(({ c, n }) => {
      if (!c.etq) return;
      const sw = crear('span', { className: 'w-mancha w-mancha-fina', 'aria-hidden': 'true' });
      sw.style.setProperty('--c', `var(${VARS_SERIE[n % VARS_SERIE.length]})`);
      filas.push(crear('li', {}, sw, c.etq));
    });
    ley.append(...filas);
    ley.hidden = !filas.length;
    pie.append(crear('div', { className: 'w-botones' }, boton('Acercar', () => zoom(1 / 1.2)), boton('Alejar', () => zoom(1.2)), boton('Volver', reiniciar)));
    const ayudita = crear('p', { className: 'w-ayuda' }, 'Arrastrá para girar. Con el teclado, flechas.');
    lienzo.append(figEscena, ayudita);
    if (ctl) lienzo.append(ctl);
    lienzo.append(pie);
    figEscena.style.height = `${alturaPx()}px`;

    const api = {
      abrir: () => {
        visible = true;
        if (v) pintar();
        else encender();
      },
      salir: () => {
        visible = false;
        if (viva) soltarDeMas();
      },
      visible: () => visible,
      apagar,
      redibujar: () => {
        if (v) {
          armarEscena();
          pintar();
        } else figEscena.style.height = `${alturaPx()}px`;
      },
      // For paper: draw once, keep the picture and give the WebGL context back for the next figure.
      foto: async () => {
        visible = true;
        await encender();
        if (!v) return;
        if (document.fonts && document.fonts.status !== 'loaded') await document.fonts.ready;
        armarEscena();
        v.renderer.setPixelRatio(2);
        v.renderer.setSize(figEscena.clientWidth, v.ultimoH, false);
        ubicarCamara();
        v.renderer.render(v.escena, v.cam);
        const img = crear('img', { className: 'w-foto', alt: '', src: v.renderer.domElement.toDataURL('image/png') });
        await img.decode().catch(() => {});
        apagar();
        figEscena.replaceChildren(img);
        figEscena.removeAttribute('tabindex');
        figEscena.removeAttribute('role');
        figEscena.removeAttribute('aria-label');
        figEscena.style.height = '';
        ayudita.hidden = true;
        fig.dataset.wEstado = 'foto';
      },
      // A picture of the view as the person left it, without touching the live figure.
      imagen: async () => {
        const antes = visible;
        visible = true;
        await encender();
        if (!v) {
          visible = antes;
          return null;
        }
        if (document.fonts && document.fonts.status !== 'loaded') await document.fonts.ready;
        armarEscena();
        v.renderer.render(v.escena, v.cam);
        const url = v.renderer.domElement.toDataURL('image/png');
        visible = antes;
        if (!antes && viva) soltarDeMas();
        return url;
      },
    };
    return api;
  }

  // ----- Calculator
  const leerEntrada = (txt) => {
    const t = String(txt).trim().replace('−', '-');
    if (!t) return { falta: true };
    const conPunto = /^[+-]?\d+,\d+$/.test(t) ? t.replace(',', '.') : t;
    try {
      const v = E.evaluar(conPunto);
      return Number.isFinite(v) ? { v } : { mal: true };
    } catch {
      return { mal: true };
    }
  };
  function calculadora(fig, cfg, lienzo) {
    const entradas = cfg.entradas.map((en) => {
      const id = nuevoId();
      const inp = crear('input', { id, type: 'text', inputMode: 'decimal', autocomplete: 'off', spellcheck: false, value: String(en.valor ?? '').replace('.', ',') });
      const err = crear('p', { className: 'w-error', id: `${id}e`, hidden: true });
      inp.setAttribute('aria-describedby', err.id);
      const fila = crear('div', { className: 'w-entrada' }, crear('label', { htmlFor: id }, en.etq), crear('div', { className: 'w-con-unidad' }, inp, en.unidad ? crear('span', { className: 'w-unidad' }, en.unidad) : null), err);
      return { ...en, inp, err, fila };
    });
    const vistas = [];
    const permitidas = entradas.map((e) => e.id);
    const salidas = cfg.salidas.map((s) => {
      const f = E.compilar(s.f, permitidas);
      if (s.id) permitidas.push(s.id);
      const val = crear('dd', {});
      vistas.push(crear('dt', {}, s.etq), val);
      return { ...s, f, val };
    });
    const resultado = crear('dl', { className: 'w-salidas', 'aria-live': 'polite' }, ...vistas);
    const calcular = () => {
      const esc = Object.create(null);
      let todoBien = true;
      entradas.forEach((en) => {
        const r = leerEntrada(en.inp.value);
        let msg = '';
        if (r.falta) msg = 'Falta completar este valor.';
        else if (r.mal) msg = 'Esto no es un número. Escribilo como 3,5.';
        else if (en.min !== undefined && r.v < en.min) msg = `Tiene que ser ${numero(en.min)} o más.`;
        else if (en.max !== undefined && r.v > en.max) msg = `Tiene que ser ${numero(en.max)} o menos.`;
        en.err.textContent = msg;
        en.err.hidden = !msg;
        en.inp.setAttribute('aria-invalid', String(Boolean(msg)));
        if (msg) todoBien = false;
        else esc[en.id] = r.v;
      });
      salidas.forEach((s) => {
        s.val.classList.remove('w-sin-valor');
        if (!todoBien) {
          s.val.textContent = 'Corregí los valores de arriba.';
          s.val.classList.add('w-sin-valor');
          return;
        }
        const v = s.f(esc);
        if (s.id) esc[s.id] = v;
        if (Number.isFinite(v)) {
          s.val.textContent = `${numero(v, s.dec)}${s.unidad ? ` ${s.unidad}` : ''}`;
          return;
        }
        s.val.textContent = Number.isNaN(v) ? 'Con estos valores no da un número real.' : 'Con estos valores da infinito: revisá si hay una división por cero.';
        s.val.classList.add('w-sin-valor');
      });
      fig.dataset.wEstado = 'listo';
    };
    entradas.forEach((en) => en.inp.addEventListener('input', calcular));
    lienzo.append(crear('div', { className: 'w-entradas' }, ...entradas.map((e) => e.fila)), resultado);
    calcular();
    return {};
  }

  // ----- Matrices
  const tablaMatriz = (M, corte) => {
    const cuerpo = crear('tbody', {}, ...M.map((f) => crear('tr', {}, ...f.map((v, j) => crear('td', { className: corte === j ? 'w-corte' : '' }, typeof v === 'string' ? v : textoFr(v))))));
    return crear('div', { className: 'w-mat-marco' }, crear('table', { className: 'w-mat' }, cuerpo));
  };

  function interactivoMatriz(figura, cfg, ayuda) {
    const { crear: c, lienzo } = ayuda;
    // In a summary, the person's own matrix comes back in cfg.datos: its size, its cells as typed and the last button.
    const d = cfg.datos || {};
    const tamDe = (s) => (/^[1-6]$/.test(s || '') ? Number(s) : 0);
    let propias = null;
    try {
      const v = JSON.parse(d.valores || 'null');
      if (Array.isArray(v) && v.length <= 6 && v.every((f) => Array.isArray(f) && f.length <= 6 && f.every((x) => typeof x === 'string' && x.length <= 24))) propias = v;
    } catch {
      propias = null;
    }
    const dato = (i, j) => (propias ? (propias[i]?.[j] ?? (i === j ? '1' : '0')) : String(cfg.valores?.[i]?.[j] ?? (i === j ? 1 : 0)).replace('.', ','));
    let filas = tamDe(d.filas) || Math.min(6, Math.max(1, cfg.filas || cfg.valores?.length || 3));
    let columnas = tamDe(d.columnas) || Math.min(6, Math.max(1, cfg.columnas || cfg.valores?.[0]?.length || 3));
    let ultima = '';
    const selector = (texto, actual, alCambio) => {
      const id = nuevoId();
      const sel = c('select', { id }, ...[1, 2, 3, 4, 5, 6].map((n) => c('option', { value: n, selected: n === actual }, String(n))));
      sel.addEventListener('change', () => alCambio(Number(sel.value)));
      return c('span', { className: 'w-campo' }, c('label', { htmlFor: id }, texto), sel);
    };
    const grilla = c('div', { className: 'w-grilla', role: 'group', 'aria-label': 'Valores de la matriz' });
    const salida = c('div', { className: 'w-resultado' });
    const titular = c('p', { className: 'w-titular', 'aria-live': 'polite' });
    let celdas = [];
    const armarGrilla = () => {
      const previas = celdas.map((f) => f.map((i) => i.value));
      grilla.style.setProperty('--cols', columnas);
      celdas = Array.from({ length: filas }, (_, i) => Array.from({ length: columnas }, (_u, j) => c('input', { type: 'text', inputMode: 'text', autocomplete: 'off', spellcheck: false, 'aria-label': `Fila ${i + 1}, columna ${j + 1}`, value: previas[i]?.[j] ?? dato(i, j) })));
      grilla.replaceChildren(...celdas.flat());
    };
    const guardar = () => ayuda.guardarDatos({ filas: String(filas), columnas: String(columnas), valores: JSON.stringify(celdas.map((f) => f.map((i) => i.value.slice(0, 24)))), accion: ultima });
    const leer = (enfocar = true) => {
      const M = celdas.map((f) => f.map((i) => leerFr(i.value)));
      const malas = celdas.flat().filter((i) => {
        const mal = !leerFr(i.value);
        i.setAttribute('aria-invalid', String(mal));
        return mal;
      });
      const hayMal = malas[0];
      if (hayMal) {
        titular.textContent = 'Hay un valor que no es un número. Se puede escribir 3, -2,5 o 1/3.';
        salida.replaceChildren();
        if (enfocar) hayMal.focus();
        return null;
      }
      return M;
    };
    const mostrarPasos = (pasos, corte) => {
      if (!pasos.length) return c('p', {}, 'No hizo falta ninguna operación entre filas.');
      const lista = c('ol', { className: 'w-pasos' }, ...pasos.map((p) => c('li', {}, c('p', {}, p.texto), tablaMatriz(p.matriz, corte))));
      return c('details', { open: true }, c('summary', {}, pasos.length === 1 ? 'Ver el paso' : `Ver los ${pasos.length} pasos`), lista);
    };
    const acciones = {
      Determinante: (M) => {
        if (filas !== columnas) return ['El determinante existe solo en matrices cuadradas.'];
        const r = determinante(M);
        const diag = r.final.map((f, i) => textoFr(f[i])).map((t) => (t.startsWith('−') ? `(${t})` : t)).join('·');
        return [`det = ${textoFr(r.valor)}`, mostrarPasos(r.pasos), c('p', {}, `Al final queda triangular, y el determinante es el producto de la diagonal${r.intercambios ? ', con el signo cambiado por la cantidad impar de cambios de fila' : ''}: ${r.intercambios ? '−' : ''}${diag}.`)];
      },
      Inversa: (M) => {
        if (filas !== columnas) return ['La inversa existe solo en matrices cuadradas.'];
        const r = inversa(M);
        if (!r.existe) return ['No tiene inversa: su rango es menor que su tamaño.', mostrarPasos(r.pasos, filas)];
        return ['La inversa es esta:', tablaMatriz(r.valor), mostrarPasos(r.pasos, filas)];
      },
      Rango: (M) => {
        const r = rango(M);
        return [`Rango = ${r.valor}`, mostrarPasos(r.pasos), c('p', {}, 'El rango es la cantidad de filas no nulas que quedan al escalonar.')];
      },
      Escalonar: (M) => {
        const r = rango(M);
        return ['Matriz escalonada:', tablaMatriz(r.final), mostrarPasos(r.pasos)];
      },
    };
    const correr = (fn, enfocar) => {
      const M = leer(enfocar);
      if (!M) return false;
      const [cabeza, ...resto] = fn(M);
      titular.textContent = cabeza;
      salida.replaceChildren(...resto);
      return true;
    };
    const botones = Object.entries(acciones).map(([t, fn]) => ayuda.boton(t, () => {
      if (!correr(fn, true)) return;
      ultima = t;
      guardar();
    }));
    const tam = c('div', { className: 'w-fila' }, selector('Filas', filas, (n) => {
      filas = n;
      armarGrilla();
      guardar();
    }), selector('Columnas', columnas, (n) => {
      columnas = n;
      armarGrilla();
      guardar();
    }));
    armarGrilla();
    grilla.addEventListener('input', guardar);
    lienzo.append(tam, grilla, c('p', { className: 'w-ayuda' }, 'Se puede escribir 3, -2,5 o 1/3.'), c('div', { className: 'w-botones' }, ...botones), titular, salida);
    if (typeof d.accion === 'string' && Object.hasOwn(acciones, d.accion)) {
      ultima = d.accion;
      correr(acciones[ultima], false);
    }
    // The picture has the matrix as typed and, if a button was used, its result again with the values of now.
    const imagen = async () => {
      if (celdas.flat().some((i) => !leerFr(i.value))) return null;
      const partes = [{ tabla: celdas.map((f) => f.map((i) => i.value.trim())) }];
      if (ultima && correr(acciones[ultima], false)) {
        partes.push({ texto: titular.textContent, negrita: true });
        const t = salida.querySelector(':scope > .w-mat-marco table');
        if (t) partes.push({ tabla: [...t.rows].map((r) => [...r.cells].map((x) => x.textContent)) });
      }
      return pngTablas(partes);
    };
    return { imagen };
  }

  // ----- Truth table
  function interactivoTablaVerdad(figura, cfg, ayuda) {
    const { crear: c, lienzo } = ayuda;
    const id = nuevoId();
    // In a summary, the person's own formula comes back in cfg.datos.
    const propia = typeof cfg.datos?.formula === 'string' && cfg.datos.formula.length <= 200 ? cfg.datos.formula : null;
    const inp = c('input', { id, type: 'text', className: 'w-formula', autocomplete: 'off', spellcheck: false, autocapitalize: 'off', value: propia ?? (cfg.formula || 'p -> q') });
    if (ayuda.enResumen) inp.maxLength = 200;
    const titular = c('p', { className: 'w-titular', 'aria-live': 'polite' });
    const marco = c('div', { className: 'w-tabla-v' });
    let tabla = null;
    const pintar = () => {
      tabla = null;
      try {
        const r = tablaVerdad(inp.value);
        tabla = r;
        inp.setAttribute('aria-invalid', 'false');
        titular.textContent = `Resultado: ${r.clase}.`;
        const cab = c('tr', {}, ...r.columnas.map((col, j) => c('th', { scope: 'col', className: j === r.columnas.length - 1 ? 'w-final' : j === r.variables.length ? 'w-parte' : '' }, col.texto)));
        const n = r.columnas[0]?.vals.length || 0;
        const cuerpo = Array.from({ length: n }, (_, i) => c('tr', {}, ...r.columnas.map((col, j) => c('td', { className: j === r.columnas.length - 1 ? 'w-final' : j === r.variables.length ? 'w-parte' : '' }, col.vals[i] ? 'V' : 'F'))));
        marco.replaceChildren(c('table', {}, c('thead', {}, cab), c('tbody', {}, ...cuerpo)));
      } catch (e) {
        inp.setAttribute('aria-invalid', 'true');
        titular.textContent = e.message;
        marco.replaceChildren();
      }
    };
    inp.addEventListener('input', () => {
      pintar();
      ayuda.guardarDatos({ formula: inp.value.slice(0, 200) });
    });
    lienzo.append(c('div', { className: 'w-entrada' }, c('label', { htmlFor: id }, 'Fórmula'), inp), c('p', { className: 'w-ayuda' }, 'Conectores: no, y, o, ->, <-> (también ¬ ∧ ∨ → ↔). Variables de una letra, como p y q.'), titular, marco);
    pintar();
    const imagen = async () => {
      if (!tabla) return null;
      const n = tabla.columnas[0]?.vals.length || 0;
      return pngTablas([
        { texto: `Fórmula: ${inp.value.trim()}` },
        { texto: titular.textContent, negrita: true },
        { cab: tabla.columnas.map((col) => col.texto), tabla: Array.from({ length: n }, (_, i) => tabla.columnas.map((col) => (col.vals[i] ? 'V' : 'F'))), resaltar: tabla.columnas.length - 1 },
      ]);
    };
    return { imagen };
  }

  // ----- Registry: subjects add their simulators from interactivos.js
  const INTERNOS = new Map([['matriz', interactivoMatriz], ['tabla-verdad', interactivoTablaVerdad]]);
  const REGISTRO = new Map(INTERNOS);
  // The summary maker can load the files of several subjects in one page, so each simulator is also kept under the
  // subject whose file registered it (the folder in the script's address). A piece says its subject in data-materia.
  const DE_MATERIA = new Map();
  const UTN = window.UTN || (window.UTN = {});
  // Settles when every figure of the page is drawn. Only the PDF page waits for it.
  UTN.figurasListas = listas;
  UTN.interactivo = (nombre, fn) => {
    if (typeof fn !== 'function') throw new Error(`UTN.interactivo: «${nombre}» necesita una función`);
    REGISTRO.set(nombre, fn);
    const m = /\/([a-z0-9-]{1,80})\/interactivos\.js(?:[?#]|$)/.exec(document.currentScript?.src || '');
    if (m) DE_MATERIA.set(`${m[1]}/${nombre}`, fn);
  };
  const buscarInteractivo = (nombre, materia) => (materia ? DE_MATERIA.get(`${materia}/${nombre}`) || INTERNOS.get(nombre) : REGISTRO.get(nombre));
  /** Whether a simulator can be drawn now: built in, or registered by that subject's file (or by any, with no subject). */
  UTN.hayInteractivo = (nombre, materia) => typeof nombre === 'string' && !!buscarInteractivo(nombre, typeof materia === 'string' ? materia : '');

  // What a simulator saves of itself in a summary: a flat object of short texts. Anything else is dropped.
  const datosLimpios = (o) => {
    if (!o || typeof o !== 'object' || Array.isArray(o)) return null;
    const out = {};
    let n = 0;
    for (const [k, v] of Object.entries(o)) {
      if (!/^[A-Za-z0-9_-]{1,40}$/.test(k) || n >= 60) continue;
      const t = typeof v === 'string' ? v : (typeof v === 'number' && Number.isFinite(v)) || typeof v === 'boolean' ? String(v) : null;
      if (t === null || t.length > 4000) continue;
      out[k] = t;
      n += 1;
    }
    return out;
  };

  function interactivo(fig, cfg, lienzo) {
    const materia = fig.classList.contains('ag-pieza') ? fig.dataset.materia || '' : '';
    const fn = buscarInteractivo(fig.dataset.nombre, materia);
    if (!fn) throw new Error(`Interactivo sin registrar: ${fig.dataset.nombre}`);
    // A piece someone added (edit mode, summary maker) hides what only makes sense on the subject's page, and tells
    // the page what the person typed, so it comes back the same after a reload.
    const enResumen = fig.classList.contains('ag-pieza');
    if (cfg.datos !== undefined) cfg.datos = datosLimpios(cfg.datos) || {};
    const guardarDatos = (obj) => {
      const datos = datosLimpios(obj);
      if (datos) fig.dispatchEvent(new CustomEvent('w-datos', { bubbles: true, detail: datos }));
    };
    const ayuda = { lienzo, expr: E, crear, svg: dibu, boton, deslizador, numero, color, alCambiar, png: (svg) => pngDeSvg(svg), pngTablas: (partes) => pngTablas(partes), guardarDatos, enResumen };
    // A simulator may return { redibujar, imagen }: the page calls them on resize and to take its picture.
    const api = fn(fig, cfg, ayuda);
    if (!fig.dataset.wEstado) fig.dataset.wEstado = 'listo';
    return api && typeof api === 'object' && !(api instanceof Node) ? api : {};
  }

  // ----- 2D picture: the drawing goes out as an image, with the colours it has on screen written into it.
  const PROPS_SVG = ['fill', 'fill-opacity', 'stroke', 'stroke-width', 'stroke-opacity', 'stroke-dasharray', 'stroke-linecap', 'stroke-linejoin', 'opacity', 'font-family', 'font-size', 'font-weight', 'font-style', 'text-anchor', 'dominant-baseline', 'paint-order', 'visibility', 'display'];
  const fondoDe = (el) => {
    for (let n = el; n && n.nodeType === 1; n = n.parentElement) {
      const c = getComputedStyle(n).backgroundColor;
      if (c && !/^(transparent|rgba\(0, 0, 0, 0\))$/.test(c)) return c;
    }
    return '#fff';
  };
  const pngDeSvg = async (svg) => {
    const caja = svg.getBoundingClientRect();
    const w = Math.max(1, Math.round(caja.width));
    const h = Math.max(1, Math.round(caja.height));
    const copia = svg.cloneNode(true);
    const orig = [svg, ...svg.querySelectorAll('*')];
    const dup = [copia, ...copia.querySelectorAll('*')];
    orig.forEach((el, i) => {
      const cs = getComputedStyle(el);
      dup[i].setAttribute('style', PROPS_SVG.map((p) => `${p}:${cs.getPropertyValue(p)}`).join(';'));
    });
    copia.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    copia.setAttribute('width', String(w));
    copia.setAttribute('height', String(h));
    const img = new Image();
    img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(new XMLSerializer().serializeToString(copia))}`;
    await img.decode();
    const k = 2;
    const c = document.createElement('canvas');
    c.width = w * k;
    c.height = h * k;
    const g = c.getContext('2d');
    g.fillStyle = fondoDe(svg);
    g.fillRect(0, 0, c.width, c.height);
    g.drawImage(img, 0, 0, c.width, c.height);
    return c.toDataURL('image/png');
  };

  // ----- Picture of texts and tables (a matrix, a truth table), dark on white like the file the summary turns into.
  // Each part is { texto, negrita } or { tabla: [[text]], cab: [text], resaltar: column index }.
  const pngTablas = async (partes) => {
    const LETRA = '15px system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
    const normal = `400 ${LETRA}`;
    const grueso = `600 ${LETRA}`;
    const MARGEN = 16;
    const RENGLON = 26;
    const CELDA = 10;
    const MAX_LINEA = 640;
    const medir = document.createElement('canvas').getContext('2d');
    const ancho = (t, f) => {
      medir.font = f;
      return medir.measureText(t).width;
    };
    const cortar = (t, f) => {
      const lineas = [];
      let l = '';
      for (const p of String(t).split(/\s+/).filter(Boolean)) {
        const con = l ? `${l} ${p}` : p;
        if (l && ancho(con, f) > MAX_LINEA) {
          lineas.push(l);
          l = p;
        } else l = con;
      }
      if (l) lineas.push(l);
      return lineas;
    };
    let w = 0;
    let h = MARGEN;
    let hueco = 0;
    const plan = [];
    for (const p of partes) {
      h += hueco;
      if (Array.isArray(p.tabla)) {
        const filas = (p.cab ? [p.cab, ...p.tabla] : p.tabla).map((f) => f.map((x) => String(x ?? '')));
        const cols = Math.max(0, ...filas.map((f) => f.length));
        const fuente = (i, j) => ((p.cab && i === 0) || j === p.resaltar ? grueso : normal);
        const anchos = Array.from({ length: cols }, (_, j) => CELDA * 2 + Math.max(0, ...filas.map((f, i) => ancho(f[j] || '', fuente(i, j)))));
        plan.push({ filas, anchos, fuente, cab: !!p.cab, resaltar: p.resaltar, y: h });
        w = Math.max(w, anchos.reduce((a, b) => a + b, 0));
        h += filas.length * RENGLON;
        hueco = 12;
      } else {
        const f = p.negrita ? grueso : normal;
        const lineas = cortar(p.texto, f);
        plan.push({ lineas, f, y: h });
        lineas.forEach((l) => (w = Math.max(w, ancho(l, f))));
        h += lineas.length * RENGLON;
        hueco = 4;
      }
    }
    w = Math.ceil(w + MARGEN * 2 + 1);
    h = Math.ceil(h + MARGEN + 1);
    const k = 2;
    const c = document.createElement('canvas');
    c.width = w * k;
    c.height = h * k;
    const g = c.getContext('2d');
    g.scale(k, k);
    g.fillStyle = '#fff';
    g.fillRect(0, 0, w, h);
    g.textBaseline = 'middle';
    for (const p of plan) {
      if (p.lineas) {
        g.fillStyle = '#1b1b1b';
        g.font = p.f;
        g.textAlign = 'left';
        p.lineas.forEach((l, i) => g.fillText(l, MARGEN, p.y + i * RENGLON + RENGLON / 2));
        continue;
      }
      p.filas.forEach((f, i) => {
        let x = MARGEN;
        const y = p.y + i * RENGLON;
        p.anchos.forEach((aw, j) => {
          const fondo = p.cab && i === 0 ? '#eceef2' : j === p.resaltar ? '#f7f2e4' : '';
          if (fondo) {
            g.fillStyle = fondo;
            g.fillRect(x, y, aw, RENGLON);
          }
          g.strokeStyle = '#b3b3b3';
          g.lineWidth = 1;
          g.strokeRect(x + 0.5, y + 0.5, aw, RENGLON);
          g.fillStyle = '#1b1b1b';
          g.font = p.fuente(i, j);
          g.textAlign = 'center';
          g.fillText(f[j] || '', x + aw / 2, y + RENGLON / 2);
          x += aw;
        });
      });
    }
    return c.toDataURL('image/png');
  };

  // ----- Page wiring
  const TIPOS = { grafico, grafico3d, calculadora, interactivo };
  const vivas = new Map();

  const iniciar = (fig) => {
    const tipo = fig.dataset.w;
    const lienzo = fig.querySelector('.w-lienzo');
    const desc = fig.querySelector('.w-desc');
    const cap = fig.querySelector('figcaption');
    desc.id = desc.id || nuevoId();
    cap.id = cap.id || nuevoId();
    try {
      const cfg = JSON.parse(fig.dataset.cfg || '{}');
      fig.classList.add('w-listo');
      const api = TIPOS[tipo](fig, cfg, lienzo);
      vivas.set(fig, api);
    } catch (err) {
      console.error(`Figura «${cap.textContent.trim()}»:`, err);
      fig.classList.remove('w-listo');
      fig.dataset.wEstado = 'error';
      lienzo.replaceChildren(crear('p', { className: 'w-aviso', role: 'status' }, 'Esta figura no se pudo dibujar. Está contada con palabras acá abajo.'));
    }
  };

  let mirador = null;
  let tamano = null;
  const anchos = new WeakMap();
  const observar = (f) => {
    if (!mirador) {
      mirador = new IntersectionObserver((entradas) => {
        entradas.forEach((e) => {
          const api = vivas.get(e.target);
          if (!api) return;
          if (e.isIntersecting) api.abrir?.();
          else api.salir?.();
        });
      }, { rootMargin: '240px 0px' });
      tamano = new ResizeObserver((entradas) => {
        entradas.forEach((e) => {
          const w = Math.round(e.contentRect.width);
          if (anchos.get(e.target) === w) return;
          anchos.set(e.target, w);
          vivas.get(e.target.closest('figure.w'))?.redibujar?.();
        });
      });
    }
    mirador.observe(f);
    tamano.observe(f.querySelector('.w-lienzo'));
  };

  // Figures that edit mode or the summary maker add after the page loaded: graphs, and simulators once registered.
  const montadas = new WeakSet();
  const esperaSuArchivo = (fig) => fig.dataset.w === 'interactivo' && !UTN.hayInteractivo(fig.dataset.nombre || '', fig.classList.contains('ag-pieza') ? fig.dataset.materia || '' : '');
  UTN.montarFigura = (fig) => {
    if (montadas.has(fig)) return;
    if (!/^grafico(3d)?$/.test(fig.dataset.w || '') && !(fig.dataset.w === 'interactivo' && !esperaSuArchivo(fig))) return;
    montadas.add(fig);
    iniciar(fig);
    observar(fig);
  };
  UTN.soltarFigura = (fig) => {
    const api = vivas.get(fig);
    api?.apagar?.();
    vivas.delete(fig);
    mirador?.unobserve(fig);
    const l = fig.querySelector('.w-lienzo');
    if (l) tamano?.unobserve(l);
  };
  /** PNG data URL of a graph as it looks now, or null. */
  UTN.imagenFigura = async (fig) => {
    const api = vivas.get(fig);
    return api && api.imagen ? api.imagen() : null;
  };

  const arrancar = () => {
    // A simulator someone added whose subject file is not here yet is left for piezas.js, which loads it and mounts it.
    const figuras = [...document.querySelectorAll('figure.w')].filter((f) => !montadas.has(f) && !(f.classList.contains('ag-pieza') && esperaSuArchivo(f)));
    figuras.forEach((f) => montadas.add(f));
    figuras.forEach(iniciar);
    if (enPdf) {
      vivas.forEach((api) => api.imprimir?.(true));
      // One 3D figure at a time: browsers allow few live WebGL contexts.
      (async () => {
        for (const api of vivas.values()) {
          if (!api.foto) continue;
          try {
            await api.foto();
          } catch (err) {
            console.error('Figura en 3D para el PDF:', err);
          }
        }
      })().finally(avisarListas);
      return;
    }
    avisarListas();
    figuras.forEach(observar);
    alCambiar(() => vivas.forEach((api) => api.redibujar?.()));

    // Printed graphs get a fixed drawing size, so they do not inherit a phone's or a large text setting's proportions.
    let imprimiendo = false;
    const imprimir = (on) => {
      if (on === imprimiendo) return;
      imprimiendo = on;
      vivas.forEach((api) => api.imprimir?.(on));
    };
    window.addEventListener('beforeprint', () => imprimir(true));
    window.addEventListener('afterprint', () => imprimir(false));
    window.matchMedia('print').addEventListener('change', (e) => imprimir(e.matches));
  };

  // Deferred scripts run before this event, so a subject's interactivos.js has already registered its simulators.
  // Edit mode loads this file late on pages without figures, and marks the script so it starts right away.
  if (document.currentScript?.dataset.tarde && document.readyState !== 'loading') arrancar();
  else document.addEventListener('DOMContentLoaded', arrancar, { once: true });
})();
