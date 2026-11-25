// Root locus of the slide's example k/(s^3 + 4s^2 + 8s): closed-loop poles for each gain. In a person's own summary
// (ayuda.enResumen) the student types the open loop instead: see the end of the file.
(() => {
  const ANCHO = 480;
  const ALTO = 400;
  const X = [-7, 2];
  const Y = [-5, 5];
  const KMAX = 120;
  const px = (re) => ((re - X[0]) / (X[1] - X[0])) * ANCHO;
  const py = (im) => ALTO - ((im - Y[0]) / (Y[1] - Y[0])) * ALTO;

  const mul = (a, b) => [a[0] * b[0] - a[1] * b[1], a[0] * b[1] + a[1] * b[0]];
  const res = (a, b) => [a[0] - b[0], a[1] - b[1]];
  const div = (a, b) => {
    const d = b[0] * b[0] + b[1] * b[1];
    return [(a[0] * b[0] + a[1] * b[1]) / d, (a[1] * b[0] - a[0] * b[1]) / d];
  };

  // Durand-Kerner on s^3 + 4s^2 + 8s + k. Starting from the previous roots keeps each branch in order.
  const raices = (k, previas) => {
    const polinomio = (s) => {
      const s2 = mul(s, s);
      const s3 = mul(s2, s);
      return [s3[0] + 4 * s2[0] + 8 * s[0] + k, s3[1] + 4 * s2[1] + 8 * s[1]];
    };
    let r = previas.map((p) => [p[0], p[1]]);
    for (let vuelta = 0; vuelta < 200; vuelta += 1) {
      r = r.map((ri, i) => {
        let den = [1, 0];
        r.forEach((rj, j) => {
          if (j !== i) den = mul(den, res(ri, rj));
        });
        return res(ri, div(polinomio(ri), den));
      });
    }
    return r;
  };

  const INICIO = [[0.0001, 0], [-2, 2], [-2, -2]];
  const ramas = [[], [], []];
  let previas = INICIO;
  for (let k = 0.0001; k <= KMAX; k += 0.5) {
    previas = raices(k, previas);
    previas.forEach((p, i) => ramas[i].push(p));
  }

  UTN.interactivo('lgr-raices', (figura, cfg, ayuda) => {
    if (ayuda.enResumen ?? figura.classList.contains('ag-pieza')) return lgrPropio(figura, cfg, ayuda);
    const { lienzo, crear, svg, deslizador, numero } = ayuda;
    const trazo = (el, color, ancho, punteado) => {
      el.style.stroke = color;
      el.style.strokeWidth = ancho;
      el.style.fill = 'none';
      if (punteado) el.style.strokeDasharray = '4 4';
      return el;
    };
    const texto = (x, y, cadena, ancla = 'start') => {
      const t = svg('text', { x, y, 'font-size': 13, 'text-anchor': ancla }, cadena);
      t.style.fill = 'var(--tinta)';
      return t;
    };

    const lamina = svg('svg', { viewBox: `0 0 ${ANCHO} ${ALTO}`, role: 'img', 'aria-hidden': 'true' });
    lamina.style.width = '100%';
    lamina.style.maxWidth = `${ANCHO}px`;
    lamina.style.height = 'auto';
    lamina.style.display = 'block';

    lamina.append(
      trazo(svg('line', { x1: 0, x2: ANCHO, y1: py(0), y2: py(0) }), 'var(--tinta)', 1),
      trazo(svg('line', { x1: px(0), x2: px(0), y1: 0, y2: ALTO }), 'var(--tinta)', 1),
      texto(ANCHO - 6, py(0) - 6, 'Real', 'end'),
      texto(px(0) + 6, 16, 'Imaginario'),
      texto(px(0) + 8, py(Math.sqrt(8)) + 4, 'k = 32'),
    );
    for (const rama of ramas) {
      const d = rama.map((p, i) => `${i ? 'L' : 'M'}${px(p[0]).toFixed(1)} ${py(p[1]).toFixed(1)}`).join(' ');
      lamina.append(trazo(svg('path', { d }), 'var(--birome)', 2));
    }
    for (const p of INICIO) {
      const c = 5;
      const x = px(p[0]);
      const y = py(p[1]);
      lamina.append(trazo(svg('path', { d: `M${x - c} ${y - c}L${x + c} ${y + c}M${x - c} ${y + c}L${x + c} ${y - c}` }), 'var(--tinta)', 2));
    }
    const marcas = [0, 1, 2].map(() => {
      const c = svg('circle', { r: 7 });
      c.style.stroke = 'var(--tinta)';
      lamina.append(c);
      return c;
    });

    const lectura = crear('p', { className: 'w-ayuda', role: 'status' });
    const mostrar = (k) => {
      let r = INICIO;
      const pasos = Math.max(1, Math.round(k / 0.5));
      for (let i = 1; i <= pasos; i += 1) r = raices((k * i) / pasos, r);
      const derecha = r.some((p) => p[0] > 1e-3);
      const sobreEje = r.some((p) => Math.abs(p[0]) <= 1e-3);
      marcas.forEach((c, i) => {
        c.setAttribute('cx', px(r[i][0]));
        c.setAttribute('cy', py(r[i][1]));
        c.style.fill = derecha ? 'var(--mal)' : 'var(--bien)';
      });
      const lista = r.map((p) => `${numero(p[0], 2)}${Math.abs(p[1]) > 1e-3 ? `${p[1] > 0 ? ' + ' : ' − '}${numero(Math.abs(p[1]), 2)}i` : ''}`).join(', ');
      const estado = derecha ? 'Inestable' : sobreEje ? 'Críticamente estable' : 'Estable';
      lectura.textContent = `Polos de lazo cerrado: ${lista}. ${estado}.`;
    };

    const VALOR = 8;
    const control = crear('div', { className: 'w-controles' }, deslizador({ id: 'k', etq: 'Ganancia k', min: 0, max: KMAX, paso: 1, valor: VALOR }, mostrar));
    lienzo.append(lamina, lectura, control);
    mostrar(VALOR);
  });

  // ===== In a person's own summary (ayuda.enResumen) the student types the open loop k·N(s)/D(s), and the piece applies
  // the construction rules of the slides one by one. cfg.datos is untrusted: only known keys with a string within its
  // cap, read by the small polynomial parser below, which runs no code.
  const MAX_GRADO = 8;
  /** Coefficients, lowest power first. */
  const pSuma = (a, b) => Array.from({ length: Math.max(a.length, b.length) }, (_, i) => (a[i] || 0) + (b[i] || 0));
  const pPor = (a, b) => {
    const r = new Array(a.length + b.length - 1).fill(0);
    a.forEach((x, i) => b.forEach((y, j) => {
      r[i + j] += x * y;
    }));
    return r;
  };
  const pEscala = (a, k) => a.map((x) => x * k);
  const pLimpio = (a) => {
    const r = a.slice();
    const tope = Math.max(...r.map(Math.abs), 1e-300);
    while (r.length > 1 && Math.abs(r[r.length - 1]) <= tope * 1e-12) r.pop();
    return r;
  };
  const pDeriv = (a) => (a.length > 1 ? a.slice(1).map((x, i) => x * (i + 1)) : [0]);
  /** A polynomial in s as written in class: 4s^2 + 8s, s(s + 2)(s + 4), (s+1)^2. Only + − × ÷ by numbers and integer powers. */
  function leerPolinomio(texto, nombre) {
    const t = String(texto).replace(/−/g, '-').replace(/×|·/g, '*').replace(/÷/g, '/').replace(/\s+/g, '');
    if (!t) return { error: `Falta ${nombre}.` };
    const fichas = t.match(/\d+(?:[.,]\d+)?|[sS]|[-+*/^()]|./g);
    let i = 0;
    let mal = null;
    const falla = (m) => {
      mal = mal || m;
      return [0];
    };
    const atomo = () => {
      const f = fichas[i];
      if (f === undefined) return falla(`${nombre} termina antes de tiempo.`);
      if (/^\d/.test(f)) {
        i += 1;
        return [Number(f.replace(',', '.'))];
      }
      if (f === 's' || f === 'S') {
        i += 1;
        return [0, 1];
      }
      if (f === '(') {
        i += 1;
        const e = suma();
        if (fichas[i] !== ')') return falla(`En ${nombre} falta cerrar un paréntesis.`);
        i += 1;
        return e;
      }
      return falla(`En ${nombre} no entiendo «${f}». Usá números, s, + − * / ^ y paréntesis.`);
    };
    const potencia = () => {
      let b = atomo();
      if (fichas[i] === '^') {
        i += 1;
        const e = fichas[i];
        if (!/^\d+$/.test(e || '') || Number(e) > MAX_GRADO) return falla(`En ${nombre}, después de ^ va un exponente entero de 0 a ${MAX_GRADO}.`);
        i += 1;
        let r = [1];
        for (let k = 0; k < Number(e); k += 1) r = pPor(r, b);
        b = r;
      }
      return b;
    };
    const signo = () => {
      if (fichas[i] === '-') {
        i += 1;
        return pEscala(signo(), -1);
      }
      if (fichas[i] === '+') {
        i += 1;
        return signo();
      }
      return potencia();
    };
    const producto = () => {
      let a = signo();
      for (;;) {
        const f = fichas[i];
        if (f === '*') {
          i += 1;
          a = pPor(a, signo());
        } else if (f === '/') {
          i += 1;
          const d = pLimpio(signo());
          if (d.length > 1 || d[0] === 0) return falla(`En ${nombre} solo se puede dividir por un número distinto de 0.`);
          a = pEscala(a, 1 / d[0]);
        } else if (f !== undefined && (/^\d/.test(f) || f === 's' || f === 'S' || f === '(')) {
          a = pPor(a, potencia());
        } else return a;
        if (a.length - 1 > MAX_GRADO * 2) return falla(`${nombre} tiene grado más alto que ${MAX_GRADO}.`);
      }
    };
    function suma() {
      let a = producto();
      while (fichas[i] === '+' || fichas[i] === '-') {
        const menos = fichas[i] === '-';
        i += 1;
        a = pSuma(a, pEscala(producto(), menos ? -1 : 1));
      }
      return a;
    }
    const p = suma();
    if (mal) return { error: mal };
    if (i < fichas.length) return { error: `En ${nombre} sobra «${fichas.slice(i).join('').slice(0, 12)}».` };
    const r = pLimpio(p);
    if (!r.every(Number.isFinite)) return { error: `${nombre} no da números.` };
    if (r.length === 1 && r[0] === 0) return { error: `${nombre} no puede ser 0.` };
    if (r.length - 1 > MAX_GRADO) return { error: `${nombre} tiene grado ${r.length - 1}: hasta ${MAX_GRADO}.` };
    return { p: r };
  }
  const evaluar = (a, z) => {
    let r = [0, 0];
    for (let k = a.length - 1; k >= 0; k -= 1) r = [r[0] * z[0] - r[1] * z[1] + a[k], r[0] * z[1] + r[1] * z[0]];
    return r;
  };
  /** Roots by Durand-Kerner, from the given ones (to follow each branch) or from the usual spiral. */
  function raicesDe(a, previas, vueltas = 300) {
    const n = a.length - 1;
    if (n < 1) return [];
    const lider = a[n];
    const m = a.map((x) => x / lider);
    // A small push, different for each root: from seeds that are real or come in conjugate pairs, the method keeps
    // that symmetry, and two roots that meet on the real line could never leave it (nor two complex ones land on it).
    let r = previas && previas.length === n ? previas.map((p, i) => {
      const e = 1e-4 * (1 + Math.hypot(p[0], p[1]));
      return [p[0] + e * Math.cos(i + 1), p[1] + e * Math.sin(i + 1)];
    }) : Array.from({ length: n }, (_, k) => {
      let z = [1, 0];
      for (let j = 0; j < k; j += 1) z = mul(z, [0.4, 0.9]);
      return z;
    });
    for (let v = 0; v < vueltas; v += 1) {
      let cambio = 0;
      r = r.map((ri, i) => {
        let den = [1, 0];
        r.forEach((rj, j) => {
          if (j !== i) den = mul(den, res(ri, rj));
        });
        if (den[0] === 0 && den[1] === 0) den = [1e-12, 1e-12];
        const d = div(evaluar(m, ri), den);
        cambio = Math.max(cambio, Math.abs(d[0]) + Math.abs(d[1]));
        return res(ri, d);
      });
      if (cambio < 1e-14) break;
    }
    return r;
  }
  const real = (z, escala) => Math.abs(z[1]) <= 1e-6 * Math.max(1, escala);
  const ordenar = (zs) => zs.slice().sort((a, b) => a[0] - b[0] || b[1] - a[1]);
  /** The roots, with the parts that are noise of the method rounded to 0. */
  const limpiar = (zs) => zs.map((z) => [Math.abs(z[0]) < 1e-6 ? 0 : z[0], Math.abs(z[1]) <= 1e-5 * Math.max(1, Math.hypot(z[0], z[1])) ? 0 : z[1]]);

  function lgrPropio(figura, cfg, ayuda) {
    const { lienzo, crear, svg, deslizador, numero } = ayuda;
    const d = cfg && cfg.datos && typeof cfg.datos === 'object' && !Array.isArray(cfg.datos) ? cfg.datos : {};
    const g = (k, def, tope = 200) => (Object.prototype.hasOwnProperty.call(d, k) && typeof d[k] === 'string' && d[k].length <= tope ? d[k] : def);
    let n = 0;
    const campo = (etq, valor, tope) => {
      const id = `lgr-p${Math.random().toString(36).slice(2, 7)}${(n += 1)}`;
      const inp = crear('input', { id, type: 'text', autocomplete: 'off', spellcheck: false, autocapitalize: 'off', value: valor, maxLength: tope });
      inp.style.width = '100%';
      inp.style.boxSizing = 'border-box';
      return { inp, fila: crear('div', { className: 'w-entrada' }, crear('label', { htmlFor: id }, etq), inp) };
    };
    const cN = campo('Numerador N(s)', g('num', '1'), 200);
    const cD = campo('Denominador D(s)', g('den', 's^3 + 4s^2 + 8s'), 200);
    const cK = campo('k más alta del gráfico', g('kmax', '120', 12), 12);
    const nota = crear('p', { className: 'w-ayuda' }, 'La función de lazo abierto es k·N(s)/D(s). Escribí los polinomios en s, como s^3 + 4s^2 + 8s o s(s + 2)(s + 4).');
    const error = crear('p', { className: 'w-error', role: 'status' });
    const hoja = svg('svg', { class: 'wg', role: 'img', 'aria-labelledby': figura.querySelector('figcaption')?.id || undefined });
    const marco = crear('div', { className: 'w-plano' }, hoja);
    const control = crear('div', { className: 'w-controles' });
    const lectura = crear('p', { className: 'w-titular', role: 'status' });
    const reglas = crear('ol', {});
    let corrida = null;
    let kActual = Number(g('k', '8', 12));
    if (!Number.isFinite(kActual) || kActual < 0) kActual = 8;
    const z2 = (z) => {
      const re = numero(Number(z[0].toFixed(4)));
      if (Math.abs(z[1]) < 5e-5) return re;
      const im = numero(Number(Math.abs(z[1]).toFixed(4)));
      return `${z[0] === 0 ? '' : re}${z[0] === 0 ? (z[1] < 0 ? '−' : '') : z[1] < 0 ? ' − ' : ' + '}${im}i`;
    };
    const leer = () => {
      const N = leerPolinomio(cN.inp.value, 'el numerador');
      if (N.error) return N;
      const D = leerPolinomio(cD.inp.value, 'el denominador');
      if (D.error) return D;
      const kmax = Number(String(cK.inp.value).trim().replace(',', '.'));
      if (!(kmax > 0 && kmax <= 1e9)) return { error: 'La k más alta: un número mayor que 0.' };
      const nP = D.p.length - 1;
      const mZ = N.p.length - 1;
      if (nP < 1) return { error: 'El denominador tiene que tener s: sin polos no hay lugar de las raíces.' };
      if (mZ > nP) return { error: 'El numerador tiene más grado que el denominador: más ceros que polos. Revisá cuál es cuál.' };
      const polos = limpiar(ordenar(raicesDe(D.p)));
      const ceros = limpiar(ordenar(raicesDe(N.p)));
      const car = (k) => pLimpio(pSuma(D.p, pEscala(N.p, k)));
      // Branches: from k = 0 to kmax with small steps, denser near 0, each one starting from the previous roots.
      const ramas = polos.map(() => []);
      let previas = polos;
      const J = 360;
      for (let j = 0; j <= J; j += 1) {
        const k = kmax * (j / J) ** 2;
        const c = car(k);
        if (c.length - 1 !== nP) continue;
        previas = raicesDe(c, previas, 80);
        previas.forEach((z, i) => ramas[i].push(z));
      }
      const lineas = [];
      const sumaRe = (zs) => zs.reduce((a, z) => a + z[0], 0);
      lineas.push(`Polos de lazo abierto (raíces de D): ${polos.map(z2).join('; ')}. Son n = ${nP}, así que hay ${nP} ${nP === 1 ? 'rama' : 'ramas'}, que arrancan ahí con k = 0.`);
      lineas.push(mZ ? `Ceros de lazo abierto (raíces de N): ${ceros.map(z2).join('; ')}. Son m = ${mZ}: ${mZ === nP ? 'todas las ramas terminan en un cero' : `${mZ} ${mZ === 1 ? 'rama termina' : 'ramas terminan'} en los ceros y ${nP - mZ} en infinito`}.` : `No hay ceros (m = 0): las ${nP} ramas terminan en infinito.`);
      // Real axis: a point belongs if there is an odd number of real poles and zeros to its right.
      const marcas = [...polos, ...ceros].filter((z) => z[1] === 0).map((z) => Math.round(z[0] * 1e4) / 1e4).sort((a, b) => b - a);
      const tramos = [];
      const unicos = [...new Set(marcas)];
      for (let i = 0; i < unicos.length; i += 1) {
        const derecha = marcas.filter((x) => x > unicos[i] - 1e-9).length;
        if (derecha % 2 === 1) tramos.push([unicos[i + 1] ?? -Infinity, unicos[i]]);
      }
      lineas.push(tramos.length ? `Sobre el eje real, con un número impar de polos y ceros a la derecha: ${tramos.map(([a, b]) => `de ${a === -Infinity ? '−∞' : numero(Number(a.toFixed(4)))} a ${numero(Number(b.toFixed(4)))}`).join(', ')}.` : 'Ningún tramo del eje real pertenece al lugar.');
      let centroide = null;
      if (nP > mZ) {
        const q = Array.from({ length: nP - mZ }, (_, i) => 2 * i + 1);
        centroide = (sumaRe(polos) - sumaRe(ceros)) / (nP - mZ);
        lineas.push(`Asíntotas: 180°·q / (n − m) con n − m = ${nP - mZ}, q = ${q.join(', ')}: ${q.map((x) => `${numero(Number(((180 * x) / (nP - mZ)).toFixed(2)))}°`).join(', ')}.`);
        const entre = (v) => (v < 0 ? `(${numero(Number(v.toFixed(4)))})` : numero(Number(v.toFixed(4))));
        lineas.push(`Centroide: (${numero(Number(sumaRe(polos).toFixed(4)))} − ${entre(sumaRe(ceros))}) / ${nP - mZ} = ${numero(Number(centroide.toFixed(4)))}.`);
      } else lineas.push('Con n = m no hay asíntotas.');
      // Imaginary axis: D(iω) + k N(iω) = 0 splits into a real and an imaginary part; with both, k drops out.
      const partes = (a) => {
        const re = [];
        const im = [];
        a.forEach((c, k) => {
          const s = [1, 0, -1, 0][k % 4];
          const t = [0, 1, 0, -1][k % 4];
          re[k] = c * s;
          im[k] = c * t;
        });
        return [re.map((x) => x || 0), im.map((x) => x || 0)];
      };
      const [Dr, Di] = partes(D.p);
      const [Nr, Ni] = partes(N.p);
      const sinK = pLimpio(pSuma(pPor(Dr, Ni), pEscala(pPor(Di, Nr), -1)));
      const cruces = [];
      if (sinK.length > 1) {
        for (const w of raicesDe(sinK)) {
          if (!real(w, Math.abs(w[0])) || w[0] < -1e-9) continue;
          const om = Math.max(0, w[0]);
          const nn = evaluar(N.p, [0, om]);
          const dd = evaluar(D.p, [0, om]);
          const den2 = nn[0] * nn[0] + nn[1] * nn[1];
          if (den2 < 1e-18) continue;
          const kc = -(dd[0] * nn[0] + dd[1] * nn[1]) / den2;
          if (kc > 1e-9 && !cruces.some((c) => Math.abs(c.om - om) < 1e-6)) cruces.push({ om, k: kc });
        }
      }
      cruces.sort((a, b) => a.k - b.k);
      lineas.push(cruces.length ? `Cruce con el eje imaginario, con s = iω en D(s) + k·N(s) = 0: ${cruces.map((c) => (c.om < 1e-9 ? `en s = 0 con k = ${numero(Number(c.k.toFixed(4)))}` : `en ω = ±${numero(Number(c.om.toFixed(4)))} con k = ${numero(Number(c.k.toFixed(4)))}`)).join('; ')}.` : 'Con s = iω no sale ningún k positivo: el lugar no cruza el eje imaginario.');
      // Breakaway and break-in: k = −D/N and dk/ds = 0, that is D'·N − D·N' = 0, at real points with k > 0.
      const dkds = pLimpio(pSuma(pPor(pDeriv(D.p), N.p), pEscala(pPor(D.p, pDeriv(N.p)), -1)));
      const quiebres = [];
      if (dkds.length > 1) {
        for (const s of raicesDe(dkds)) {
          if (!real(s, Math.abs(s[0]))) continue;
          const nn = evaluar(N.p, [s[0], 0])[0];
          if (Math.abs(nn) < 1e-12) continue;
          const k = -evaluar(D.p, [s[0], 0])[0] / nn;
          if (k > 1e-9) quiebres.push({ s: s[0], k });
        }
      }
      lineas.push(quiebres.length ? `Desprendimiento o entrada, con dk/ds = 0 y k = −D(s)/N(s) positiva: ${quiebres.sort((a, b) => b.s - a.s).map((q) => `s = ${numero(Number(q.s.toFixed(4)))} con k = ${numero(Number(q.k.toFixed(4)))}`).join('; ')}.` : 'dk/ds = 0 no da ningún punto real con k positiva: no hay puntos de desprendimiento ni de entrada.');
      // Departure from complex poles and arrival to complex zeros, by the angle condition.
      const ang = (a, b) => (Math.atan2(a[1] - b[1], a[0] - b[0]) * 180) / Math.PI;
      const norm = (x) => {
        let v = ((x + 180) % 360 + 360) % 360 - 180;
        if (v === -180) v = 180;
        return v;
      };
      const salidas = [];
      polos.forEach((p, i) => {
        if (p[1] <= 0) return;
        const otros = polos.filter((_, j) => j !== i).reduce((a, q) => a + ang(p, q), 0);
        const deCeros = ceros.reduce((a, z) => a + ang(p, z), 0);
        salidas.push(`desde ${z2(p)} sale a ${numero(Number(norm(180 - otros + deCeros).toFixed(2)))}°`);
      });
      ceros.forEach((z, i) => {
        if (z[1] <= 0) return;
        const otros = ceros.filter((_, j) => j !== i).reduce((a, q) => a + ang(z, q), 0);
        const dePolos = polos.reduce((a, p) => a + ang(z, p), 0);
        salidas.push(`a ${z2(z)} llega a ${numero(Number(norm(180 - otros + dePolos).toFixed(2)))}°`);
      });
      if (salidas.length) lineas.push(`Ángulos con la condición de ángulo: ${salidas.join('; ')} (y lo simétrico abajo).`);
      // Stable ranges of k: test each stretch between the k of the crossings.
      const estable = (k) => raicesDe(car(k)).every((z) => z[0] < -1e-7);
      const cortes = [0, ...cruces.map((c) => c.k).filter((k, i, a) => a.indexOf(k) === i)];
      const rangos = [];
      cortes.forEach((a, i) => {
        const b = cortes[i + 1];
        const medio = b === undefined ? a * 2 + 1 : (a + b) / 2;
        if (estable(medio)) rangos.push([a, b]);
      });
      const kTxt = (k) => numero(Number(k.toFixed(4)));
      lineas.push(rangos.length ? `Estable para ${rangos.map(([a, b]) => (b === undefined ? `k > ${kTxt(a)}` : `${kTxt(a)} < k < ${kTxt(b)}`)).join(' y ')}.` : 'No hay ningún k positivo que lo haga estable.');
      return { N: N.p, D: D.p, polos, ceros, ramas, kmax, centroide, nP, mZ, cruces, lineas, car };
    };
    const pintar = () => {
      hoja.replaceChildren();
      if (!corrida || corrida.error) return;
      const W = Math.max(280, Math.round(marco.clientWidth || lienzo.clientWidth || 600));
      const H = Math.round(Math.min(W * 0.78, 440));
      hoja.setAttribute('viewBox', `0 0 ${W} ${H}`);
      const todos = [...corrida.ramas.flat(), ...corrida.polos, ...corrida.ceros, [0, 0]].filter((z) => Math.abs(z[0]) < 1e6 && Math.abs(z[1]) < 1e6);
      if (corrida.centroide !== null) todos.push([corrida.centroide, 0]);
      let x0 = Math.min(...todos.map((z) => z[0]));
      let x1 = Math.max(...todos.map((z) => z[0]));
      let y1 = Math.max(1, ...todos.map((z) => Math.abs(z[1])));
      const padX = Math.max((x1 - x0) * 0.08, 0.5);
      x0 -= padX;
      x1 += padX;
      y1 *= 1.1;
      // The same scale on both axes, so the angles look as they are.
      const m = { i: 40, d: 12, a: 12, b: 26 };
      const k = Math.min((W - m.i - m.d) / (x1 - x0), (H - m.a - m.b) / (2 * y1));
      const cx = (m.i + W - m.d) / 2 - (k * (x0 + x1)) / 2;
      const cy = (m.a + H - m.b) / 2;
      const sx = (v) => cx + v * k;
      const sy = (v) => cy - v * k;
      const vx = [(m.i - cx) / k, (W - m.d - cx) / k];
      const vy = [(cy - (H - m.b)) / k, (cy - m.a) / k];
      const red = svg('g', {});
      const num = svg('g', { class: 'wg-num' });
      const bruto = (vx[1] - vx[0]) / (W < 420 ? 5 : 8);
      const base = 10 ** Math.floor(Math.log10(bruto));
      const paso = [1, 2, 5, 10].map((q) => q * base).find((q) => q >= bruto);
      for (let v = Math.ceil(vx[0] / paso) * paso; v <= vx[1]; v += paso) {
        red.append(svg('line', { class: 'wg-red', x1: sx(v), x2: sx(v), y1: m.a, y2: H - m.b }));
        num.append(svg('text', { x: sx(v), y: H - m.b + 17, 'text-anchor': 'middle' }, numero(Number(v.toFixed(6)))));
      }
      for (let v = Math.ceil(vy[0] / paso) * paso; v <= vy[1]; v += paso) {
        red.append(svg('line', { class: 'wg-red', x1: m.i, x2: W - m.d, y1: sy(v), y2: sy(v) }));
        num.append(svg('text', { x: m.i - 5, y: sy(v) + 4, 'text-anchor': 'end' }, numero(Number(v.toFixed(6)))));
      }
      red.append(svg('line', { class: 'wg-eje', x1: m.i, x2: W - m.d, y1: sy(0), y2: sy(0) }));
      if (sx(0) >= m.i && sx(0) <= W - m.d) red.append(svg('line', { class: 'wg-eje', x1: sx(0), x2: sx(0), y1: m.a, y2: H - m.b }));
      const id = `lgr-c${Math.random().toString(36).slice(2, 8)}`;
      hoja.append(svg('defs', {}, svg('clipPath', { id }, svg('rect', { x: m.i, y: m.a, width: W - m.i - m.d, height: H - m.a - m.b }))), red, num);
      const dentro = svg('g', { 'clip-path': `url(#${id})` });
      if (corrida.centroide !== null) {
        const L = 4 * (W + H) / k;
        for (let q = 1; q < 2 * (corrida.nP - corrida.mZ); q += 2) {
          const a = (Math.PI * q) / (corrida.nP - corrida.mZ);
          dentro.append(svg('line', { class: 'wg-guia', x1: sx(corrida.centroide), y1: sy(0), x2: sx(corrida.centroide + L * Math.cos(a)), y2: sy(L * Math.sin(a)) }));
        }
      }
      for (const rama of corrida.ramas) dentro.append(svg('path', { class: 'wg-curva wg-s0', d: rama.map((z, i) => `${i ? 'L' : 'M'}${sx(z[0]).toFixed(1)} ${sy(z[1]).toFixed(1)}`).join(' ') }));
      for (const p of corrida.polos) {
        const x = sx(p[0]);
        const y = sy(p[1]);
        dentro.append(svg('path', { d: `M${x - 5} ${y - 5}L${x + 5} ${y + 5}M${x - 5} ${y + 5}L${x + 5} ${y - 5}`, style: 'stroke:var(--tinta);stroke-width:2;fill:none' }));
      }
      for (const z of corrida.ceros) dentro.append(svg('circle', { class: 'wg-punto wg-hueco', cx: sx(z[0]), cy: sy(z[1]), r: 5 }));
      const ahora = raicesDe(corrida.car(kActual));
      const inestable = ahora.some((z) => z[0] > 1e-6);
      for (const z of ahora) dentro.append(svg('circle', { class: 'wg-leido', cx: sx(z[0]), cy: sy(z[1]), r: 6, style: `fill:${inestable ? 'var(--mal)' : 'var(--bien)'}` }));
      hoja.append(dentro);
      const sobre = ahora.some((z) => Math.abs(z[0]) <= 1e-6);
      lectura.textContent = `Con k = ${numero(kActual)}, polos de lazo cerrado: ${limpiar(ordenar(ahora)).map(z2).join('; ')}. ${inestable ? 'Inestable.' : sobre ? 'Críticamente estable.' : 'Estable.'}`;
    };
    const armarControl = () => {
      const kmax = corrida && !corrida.error ? corrida.kmax : 120;
      kActual = Math.min(kActual, kmax);
      control.replaceChildren(deslizador({ id: 'k', etq: 'Ganancia k', min: 0, max: kmax, paso: kmax / 240, valor: kActual }, (v) => {
        kActual = v;
        pintar();
        guardar();
      }));
    };
    const guardar = () => ayuda.guardarDatos?.({ num: cN.inp.value, den: cD.inp.value, kmax: cK.inp.value, k: String(Number(kActual.toPrecision(8))) });
    const calcular = () => {
      corrida = leer();
      error.textContent = corrida.error || '';
      error.hidden = !corrida.error;
      for (const el of [marco, control, lectura, reglas]) el.hidden = Boolean(corrida.error);
      if (corrida.error) return;
      reglas.replaceChildren(...corrida.lineas.map((t) => crear('li', {}, t)));
      armarControl();
      pintar();
    };
    const cambio = () => {
      calcular();
      guardar();
    };
    [cN, cD, cK].forEach((c) => c.inp.addEventListener('input', cambio));
    new ResizeObserver(pintar).observe(lienzo);
    ayuda.alCambiar(pintar);
    lienzo.append(cN.fila, cD.fila, cK.fila, nota, error, marco, lectura, control, reglas);
    calcular();
    const imagen = async () => {
      if (!corrida || corrida.error) return null;
      const urls = [await ayuda.png(hoja), ayuda.pngTablas ? await ayuda.pngTablas([
        { texto: `Lugar de las raíces de k·(${cN.inp.value.trim()}) / (${cD.inp.value.trim()})`, negrita: true },
        ...corrida.lineas.map((t, i) => ({ texto: `${i + 1}. ${t}` })),
        { texto: lectura.textContent },
      ]) : null].filter(Boolean);
      const imgs = await Promise.all(urls.map(async (u) => {
        const im = new Image();
        im.src = u;
        await im.decode();
        return im;
      }));
      const c = document.createElement('canvas');
      c.width = Math.max(...imgs.map((im) => im.width));
      c.height = imgs.reduce((a, im) => a + im.height, 0);
      const ctx = c.getContext('2d');
      ctx.fillStyle = '#fff';
      ctx.fillRect(0, 0, c.width, c.height);
      let y = 0;
      imgs.forEach((im) => {
        ctx.drawImage(im, 0, y);
        y += im.height;
      });
      return c.toDataURL('image/png');
    };
    return { imagen };
  }
})();
