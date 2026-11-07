// Simulators of Análisis Numérico. On the subject's pages every function and starting value comes from the catedra's
// material, with no input for a function on purpose: a page cannot be used to work out an exam question. In a person's
// own summary (ayuda.enResumen) raices, punto-fijo and pvi take the student's own function: see the end of the file.
(() => {
  const PARACAIDISTA = (c) => (667.38 / c) * (1 - Math.exp(-0.146843 * c)) - 40;
  const EXP = (x) => Math.exp(-x) - x;
  const DEXP = (x) => -Math.exp(-x) - 1;
  const RAIZ_PARA = 14.7802;
  const RAIZ_EXP = 0.56714329;
  const err = (v, a) => Math.abs((v - a) / v) * 100;

  // Draws into a responsive svg and redraws when the width or the theme changes.
  function lamina(figura, ayuda, proporcion, dibujar) {
    const { crear, svg, lienzo } = ayuda;
    const idTitulo = figura.querySelector('figcaption')?.id;
    const marco = crear('div', { className: 'w-plano' });
    const hoja = svg('svg', { class: 'wg', role: 'img', 'aria-labelledby': idTitulo || undefined });
    marco.append(hoja);
    const pintar = () => {
      const W = Math.max(280, Math.round(marco.clientWidth || lienzo.clientWidth || 600));
      const H = Math.round(Math.min(W * proporcion, 460));
      hoja.setAttribute('viewBox', `0 0 ${W} ${H}`);
      hoja.replaceChildren();
      dibujar(hoja, W, H);
    };
    new ResizeObserver(pintar).observe(lienzo);
    ayuda.alCambiar(pintar);
    return { marco, pintar };
  }

  function ejes(ayuda, hoja, W, H, x, y, nombres = {}) {
    const { svg } = ayuda;
    const m = { i: nombres.margen || 46, d: 14, a: 14, b: 32 };
    const sx = (v) => m.i + ((v - x[0]) / (x[1] - x[0])) * (W - m.i - m.d);
    const sy = (v) => H - m.b - ((v - y[0]) / (y[1] - y[0])) * (H - m.a - m.b);
    const paso = (r, n) => {
      const crudo = r / n;
      const base = 10 ** Math.floor(Math.log10(crudo));
      return [1, 2, 5, 10].map((k) => k * base).find((k) => k >= crudo);
    };
    const red = svg('g', {});
    const num = svg('g', { class: 'wg-num' });
    const px = nombres.pasoX || paso(x[1] - x[0], W < 420 ? 5 : 8);
    const py = nombres.pasoY || paso(y[1] - y[0], 6);
    for (let v = Math.ceil(x[0] / px) * px; v <= x[1] + 1e-9; v += px) {
      red.append(svg('line', { class: 'wg-red', x1: sx(v), x2: sx(v), y1: m.a, y2: H - m.b }));
      num.append(svg('text', { x: sx(v), y: H - m.b + 18, 'text-anchor': 'middle' }, ayuda.numero(Number(v.toFixed(6)))));
    }
    for (let v = Math.ceil(y[0] / py) * py; v <= y[1] + 1e-9; v += py) {
      red.append(svg('line', { class: 'wg-red', x1: m.i, x2: W - m.d, y1: sy(v), y2: sy(v) }));
      const t = nombres.etqY ? nombres.etqY(v) : ayuda.numero(Number(v.toFixed(6)));
      num.append(svg('text', { x: m.i - 6, y: sy(v) + 4, 'text-anchor': 'end' }, t));
    }
    const ceroY = y[0] <= 0 && y[1] >= 0 && !nombres.sinCero ? sy(0) : H - m.b;
    const ceroX = x[0] <= 0 && x[1] >= 0 ? sx(0) : m.i;
    red.append(svg('line', { class: 'wg-eje', x1: m.i, x2: W - m.d, y1: ceroY, y2: ceroY }), svg('line', { class: 'wg-eje', x1: ceroX, x2: ceroX, y1: m.a, y2: H - m.b }));
    hoja.append(red, num);
    return { sx, sy, m };
  }

  const trazo = (ayuda, puntos, serie, extra = {}) => ayuda.svg('path', { class: `wg-curva wg-s${serie}`, d: puntos.map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(' '), ...extra });

  function curva(ayuda, f, x, sx, sy, serie, yLim) {
    const pts = [];
    for (let i = 0; i <= 200; i += 1) {
      const v = x[0] + ((x[1] - x[0]) * i) / 200;
      const w = f(v);
      if (Number.isFinite(w) && w >= yLim[0] - 1e-9 && w <= yLim[1] + 1e-9) pts.push([sx(v), sy(w)]);
    }
    return trazo(ayuda, pts, serie);
  }

  function tabla(ayuda, cabeza, filas) {
    const { crear } = ayuda;
    return crear('div', { className: 'w-tabla-v' }, crear('table', {},
      crear('thead', {}, crear('tr', {}, ...cabeza.map((c) => crear('th', { scope: 'col' }, c)))),
      crear('tbody', {}, ...filas.map((f) => crear('tr', {}, ...f.map((c) => crear('td', {}, c)))))));
  }

  const leyenda = (ayuda, hoja, W, nombres, yInicial = 30) => {
    const g = ayuda.svg('g', { class: 'wg-etqs' });
    nombres.forEach(([t, serie], i) => g.append(ayuda.svg('text', { class: `wg-t${serie}`, x: W - 20, y: yInicial + i * 20, 'text-anchor': 'end' }, t)));
    hoja.append(g);
  };

  // ----- Methods for roots, one iteration at a time.
  const METODOS = {
    biseccion: {
      nombre: 'xᵣ', x: [11, 17], y: [-4, 8], f: PARACAIDISTA, raiz: RAIZ_PARA, max: 8,
      inicio: () => ({ xl: 12, xu: 16 }),
      paso: (e) => {
        const xr = (e.xl + e.xu) / 2;
        const prod = PARACAIDISTA(e.xl) * PARACAIDISTA(xr);
        return { xr, de: e, sig: prod > 0 ? { xl: xr, xu: e.xu } : { xl: e.xl, xu: xr }, txt: prod > 0 ? 'mismo signo que xₗ: xᵣ reemplaza a xₗ' : 'mismo signo que xᵤ: xᵣ reemplaza a xᵤ' };
      },
    },
    falsa: {
      nombre: 'xᵣ', x: [11, 17], y: [-4, 8], f: PARACAIDISTA, raiz: RAIZ_PARA, max: 5, cuerda: true,
      inicio: () => ({ xl: 12, xu: 16 }),
      paso: (e) => {
        const fl = PARACAIDISTA(e.xl);
        const fu = PARACAIDISTA(e.xu);
        const xr = e.xu - (fu * (e.xl - e.xu)) / (fl - fu);
        const prod = fl * PARACAIDISTA(xr);
        return { xr, de: e, sig: prod > 0 ? { xl: xr, xu: e.xu } : { xl: e.xl, xu: xr }, txt: prod > 0 ? 'mismo signo que xₗ: xᵣ reemplaza a xₗ' : 'mismo signo que xᵤ: xᵣ reemplaza a xᵤ' };
      },
    },
    newton: {
      nombre: 'xᵢ₊₁', x: [-0.2, 1], y: [-0.6, 1.4], f: EXP, raiz: RAIZ_EXP, max: 4, tangente: true,
      inicio: () => ({ x: 0 }),
      paso: (e) => {
        const xr = e.x - EXP(e.x) / DEXP(e.x);
        return { xr, de: e, sig: { x: xr }, txt: 'la tangente en xᵢ corta al eje en xᵢ₊₁' };
      },
    },
    secante: {
      nombre: 'xᵢ₊₁', x: [-0.2, 1.2], y: [-0.9, 1.4], f: EXP, raiz: RAIZ_EXP, max: 3, secante: true,
      inicio: () => ({ a: 0, b: 1 }),
      paso: (e) => {
        const fa = EXP(e.a);
        const fb = EXP(e.b);
        const xr = e.b - (fb * (e.a - e.b)) / (fa - fb);
        return { xr, de: e, sig: { a: e.b, b: xr }, txt: 'xᵢ pasa a ser xᵢ₋₁ y xᵢ₊₁ pasa a ser xᵢ, en secuencia estricta' };
      },
    },
  };

  UTN.interactivo('raices', (figura, cfg, ayuda) => {
    if (enResumenDe(figura, ayuda)) return raicesPropias(figura, cfg, ayuda);
    const { crear, svg, numero, lienzo } = ayuda;
    const M = METODOS[cfg.metodo];
    let estado = M.inicio();
    let filas = [];
    let ultimo = null;
    const titular = crear('p', { className: 'w-titular', 'aria-live': 'polite' }, 'Tocá «Siguiente iteración».');
    const salida = crear('div', {});
    const { marco, pintar } = lamina(figura, ayuda, 0.56, (hoja, W, H) => {
      const { sx, sy, m } = ejes(ayuda, hoja, W, H, M.x, M.y);
      hoja.append(curva(ayuda, M.f, M.x, sx, sy, 0, M.y));
      const marcas = svg('g', {});
      const etqs = svg('g', { class: 'wg-etqs' });
      const vert = (x, y) => svg('line', { class: 'wg-guia', x1: sx(x), x2: sx(x), y1: sy(0), y2: sy(y) });
      const pto = (x, y, t, arriba) => {
        marcas.append(vert(x, y), svg('circle', { class: 'wg-punto', cx: sx(x), cy: sy(y), r: 5 }));
        if (t) etqs.append(svg('text', { x: sx(x), y: sy(y) + (arriba ? -10 : 20), 'text-anchor': 'middle' }, t));
      };
      if ('xl' in estado && !ultimo) {
        pto(estado.xl, PARACAIDISTA(estado.xl), 'xₗ', true);
        pto(estado.xu, PARACAIDISTA(estado.xu), 'xᵤ', true);
      }
      if ('x' in estado && !ultimo) pto(estado.x, EXP(estado.x), 'x₀', true);
      if ('a' in estado && !ultimo) {
        pto(estado.a, EXP(estado.a), 'x₋₁', true);
        pto(estado.b, EXP(estado.b), 'x₀', false);
      }
      if (ultimo) {
        const d = ultimo.de;
        if ('xl' in d) {
          pto(d.xl, PARACAIDISTA(d.xl), 'xₗ', true);
          pto(d.xu, PARACAIDISTA(d.xu), 'xᵤ', true);
          if (M.cuerda) marcas.append(svg('line', { class: 'wg-tan', x1: sx(d.xl), y1: sy(PARACAIDISTA(d.xl)), x2: sx(d.xu), y2: sy(PARACAIDISTA(d.xu)) }));
        }
        if (M.tangente) {
          pto(d.x, EXP(d.x), 'xᵢ', true);
          marcas.append(svg('line', { class: 'wg-tan', x1: sx(d.x), y1: sy(EXP(d.x)), x2: sx(ultimo.xr), y2: sy(0) }));
        }
        if (M.secante) {
          pto(d.a, EXP(d.a), 'xᵢ₋₁', true);
          pto(d.b, EXP(d.b), 'xᵢ', false);
          marcas.append(svg('line', { class: 'wg-tan', x1: sx(d.a), y1: sy(EXP(d.a)), x2: sx(ultimo.xr), y2: sy(0) }));
        }
        marcas.append(svg('circle', { class: 'wg-leido', cx: sx(ultimo.xr), cy: sy(0), r: 6 }));
        etqs.append(svg('text', { x: sx(ultimo.xr), y: sy(0) + 22, 'text-anchor': 'middle' }, M.nombre));
      }
      hoja.append(marcas, etqs);
      void m;
    });
    const avanzar = () => {
      if (filas.length >= M.max) return;
      const p = M.paso(estado);
      const previa = filas.length ? filas[filas.length - 1].xr : null;
      const pct = (v) => `${v < 0.01 ? numero(v) : numero(v, 3)} %`;
      const ea = previa === null ? '' : pct(err(p.xr, previa));
      const et = pct(err(M.raiz, p.xr));
      filas.push({ xr: p.xr, ea, et });
      ultimo = p;
      estado = p.sig;
      titular.textContent = `Iteración ${filas.length}: ${M.nombre} = ${numero(p.xr, 6)}. ${p.txt.charAt(0).toUpperCase()}${p.txt.slice(1)}.`;
      salida.replaceChildren(tabla(ayuda, ['Iteración', M.nombre, 'εa', 'εt'], filas.map((f, i) => [String(i + 1), numero(f.xr, 6), f.ea, f.et])));
      pintar();
    };
    const reiniciar = () => {
      estado = M.inicio();
      filas = [];
      ultimo = null;
      titular.textContent = 'Tocá «Siguiente iteración».';
      salida.replaceChildren();
      pintar();
    };
    lienzo.append(marco, crear('div', { className: 'w-botones' }, ayuda.boton('Siguiente iteración', avanzar), ayuda.boton('Volver al inicio', reiniciar)), titular, salida);
  });

  // ----- Fixed point: the stair of y = g(x) against y = x.
  const GS = {
    exp: { g: (x) => Math.exp(-x), x0: 0, x: [0, 1.2], y: [0, 1.2], etq: 'g(x) = e^(-x)' },
    log: { g: (x) => -Math.log(x), x0: 0.6, x: [0, 2.8], y: [-0.2, 2.8], etq: 'g(x) = -ln(x)' },
  };

  UTN.interactivo('punto-fijo', (figura, cfg, ayuda) => {
    if (enResumenDe(figura, ayuda)) return puntoFijoPropio(figura, cfg, ayuda);
    const { crear, svg, numero, lienzo } = ayuda;
    let G = GS.exp;
    let xs = [G.x0];
    const titular = crear('p', { className: 'w-titular', 'aria-live': 'polite' }, 'Tocá «Siguiente iteración».');
    const salida = crear('div', {});
    const { marco, pintar } = lamina(figura, ayuda, 0.62, (hoja, W, H) => {
      const { sx, sy } = ejes(ayuda, hoja, W, H, G.x, G.y);
      hoja.append(curva(ayuda, (x) => x, G.x, sx, sy, 3, G.y), curva(ayuda, G.g, [Math.max(G.x[0], 0.001), G.x[1]], sx, sy, 0, G.y));
      const tramos = [[sx(xs[0]), sy(Math.max(G.y[0], 0))]];
      for (let i = 0; i + 1 < xs.length; i += 1) {
        tramos.push([sx(xs[i]), sy(xs[i + 1])], [sx(xs[i + 1]), sy(xs[i + 1])]);
      }
      if (xs.length > 1) hoja.append(trazo(ayuda, tramos, 1));
      hoja.append(svg('circle', { class: 'wg-leido', cx: sx(xs[xs.length - 1]), cy: sy(xs[xs.length - 1]), r: 5 }));
      leyenda(ayuda, hoja, W, [['y = x', 3], [G.etq, 0], ['iteraciones', 1]], H - 100);
    });
    const mostrar = () => {
      salida.replaceChildren(tabla(ayuda, ['i', 'xᵢ', 'εa'], xs.map((x, i) => [String(i), numero(x, 6), i ? `${numero(err(x, xs[i - 1]), 3)} %` : ''])));
    };
    const avanzar = () => {
      const u = xs[xs.length - 1];
      const n = u > 0 || G === GS.exp ? G.g(u) : NaN;
      if (xs.length > 10) return;
      if (!Number.isFinite(n) || n > G.x[1] || n < 0) {
        titular.textContent = 'La iteración se fue de la región y no se puede seguir. El método divergió.';
        return;
      }
      xs.push(n);
      titular.textContent = `Iteración ${xs.length - 1}: x = ${numero(n, 6)}.`;
      mostrar();
      pintar();
    };
    const reiniciar = () => {
      xs = [G.x0];
      titular.textContent = 'Tocá «Siguiente iteración».';
      salida.replaceChildren();
      pintar();
    };
    const selId = `pf-${Math.random().toString(36).slice(2, 8)}`;
    const sel = crear('select', { id: selId }, crear('option', { value: 'exp' }, 'e^(-x), desde 0 (la filmina)'), crear('option', { value: 'log' }, '-ln(x), desde 0,6 (armado)'));
    sel.style.maxWidth = '100%';
    sel.addEventListener('change', () => {
      G = GS[sel.value];
      reiniciar();
    });
    lienzo.append(crear('div', { className: 'w-entrada' }, crear('label', { htmlFor: selId }, 'Despeje de la misma ecuación'), sel), marco, crear('div', { className: 'w-botones' }, ayuda.boton('Siguiente iteración', avanzar), ayuda.boton('Volver al inicio', reiniciar)), titular, salida);
  });

  // ----- Error per iteration on a logarithmic axis, from the tables of the material.
  UTN.interactivo('errores', (figura, cfg, ayuda) => {
    const { crear, svg, numero, lienzo } = ayuda;
    const { marco } = lamina(figura, ayuda, 0.6, (hoja, W, H) => {
      const maxI = Math.max(...cfg.series.flatMap((s) => s.puntos.map((p) => p[0])));
      const { sx, sy } = ejes(ayuda, hoja, W, H, [0, maxI], [-5, 2], { pasoX: 1, pasoY: 1, sinCero: true, margen: 72, etqY: (v) => (v < 0 ? (10 ** v).toFixed(-v).replace('.', ',') : String(10 ** v)) });
      cfg.series.forEach((s, i) => {
        const pts = s.puntos.map((p) => [sx(p[0]), sy(Math.log10(p[1]))]);
        hoja.append(trazo(ayuda, pts, i));
        pts.forEach((p) => hoja.append(svg('circle', { class: 'wg-punto', cx: p[0], cy: p[1], r: 3.5 })));
      });
      leyenda(ayuda, hoja, W, cfg.series.map((s, i) => [s.etq, i]));
    });
    lienzo.append(marco, crear('p', { className: 'w-ayuda' }, 'Cada línea del eje vertical es diez veces menor que la anterior. El eje horizontal es la iteración.'));
  });

  // ----- Euler, Heun and RK4 on the book's example, against the true solution.
  const ED = (x) => -2 * x ** 3 + 12 * x ** 2 - 20 * x + 8.5;
  const VERDAD = (x) => -0.5 * x ** 4 + 4 * x ** 3 - 10 * x ** 2 + 8.5 * x + 1;
  const PASOS = {
    euler: (x, y, h) => y + ED(x) * h,
    heun: (x, y, h) => y + ((ED(x) + ED(x + h)) / 2) * h,
    rk4: (x, y, h) => y + (ED(x) + 4 * ED(x + h / 2) + ED(x + h)) * (h / 6),
  };

  UTN.interactivo('pvi', (figura, cfg, ayuda) => {
    if (enResumenDe(figura, ayuda)) return pviPropio(figura, cfg, ayuda);
    const { crear, numero, lienzo } = ayuda;
    let metodo = 'euler';
    let h = 0.5;
    const salida = crear('div', {});
    const calcular = () => {
      const pts = [[0, 1]];
      const n = Math.round(4 / h);
      for (let i = 0; i < n; i += 1) {
        const [x, y] = pts[pts.length - 1];
        pts.push([Number((x + h).toFixed(6)), PASOS[metodo](x, y, h)]);
      }
      return pts;
    };
    const { marco, pintar } = lamina(figura, ayuda, 0.62, (hoja, W, H) => {
      const { sx, sy } = ejes(ayuda, hoja, W, H, [0, 4], [0, 8]);
      hoja.append(curva(ayuda, VERDAD, [0, 4], sx, sy, 0, [0, 8]));
      const pts = calcular().filter((p) => p[1] <= 8 && p[1] >= 0);
      hoja.append(trazo(ayuda, pts.map((p) => [sx(p[0]), sy(p[1])]), 1));
      pts.forEach((p) => hoja.append(ayuda.svg('circle', { class: 'wg-punto', cx: sx(p[0]), cy: sy(p[1]), r: 3.5 })));
      leyenda(ayuda, hoja, W, [['solución verdadera', 0], [{ euler: 'Euler', heun: 'Heun', rk4: 'RK de cuarto orden' }[metodo], 1]]);
    });
    const actualizar = () => {
      const filas = calcular().filter((p) => Math.abs(p[0] * 2 - Math.round(p[0] * 2)) < 1e-9).map((p) => [numero(p[0]), numero(p[1], 5), numero(VERDAD(p[0]), 5), p[0] === 0 ? '' : `${numero(err(VERDAD(p[0]), p[1]), 1)} %`]);
      salida.replaceChildren(tabla(ayuda, ['x', 'y aproximado', 'y verdadero', 'εt'], filas));
      pintar();
    };
    const selM = `m-${Math.random().toString(36).slice(2, 8)}`;
    const m = crear('select', { id: selM }, crear('option', { value: 'euler' }, 'Euler'), crear('option', { value: 'heun' }, 'Heun'), crear('option', { value: 'rk4' }, 'RK de cuarto orden'));
    m.addEventListener('change', () => {
      metodo = m.value;
      actualizar();
    });
    const selH = `h-${Math.random().toString(36).slice(2, 8)}`;
    const ph = crear('select', { id: selH }, crear('option', { value: '1' }, '1'), crear('option', { value: '0.5', selected: true }, '0,5'), crear('option', { value: '0.25' }, '0,25'));
    ph.addEventListener('change', () => {
      h = Number(ph.value);
      actualizar();
    });
    lienzo.append(crear('div', { className: 'w-fila' }, crear('span', { className: 'w-campo' }, crear('label', { htmlFor: selM }, 'Método'), m), crear('span', { className: 'w-campo' }, crear('label', { htmlFor: selH }, 'Tamaño de paso h'), ph)), marco, salida);
    actualizar();
  });

  // ----- Figures 4-1 and 4-3 of the book, redrawn.
  const DIBUJOS = {
    'fig-4-1': {
      w: 620, h: 500,
      cajas: [[60, 90, 'NIVEL 1'], [340, 270, 'NIVEL 2'], [150, 380, 'NIVEL 3']],
      nubes: [[120, 30, 'FUENTE'], [210, 470, 'SUMIDERO']],
      valvulas: [[192, 250, 'TASA 1', 'izq'], [400, 130, 'TASA 2', 'der'], [400, 400, 'TASA 3', 'der']],
      constantes: [[286, 188, 'CONSTANTE']],
      llenas: [[[120, 48], [120, 90]], [[120, 130], [192, 240]], [[192, 260], [210, 380]], [[210, 420], [210, 452]], [[400, 140], [400, 270]], [[400, 310], [400, 390]]],
      punteadas: [[[180, 110], [388, 130]], [[340, 290], [204, 252]], [[278, 196], [202, 244]], [[270, 400], [388, 400]]],
    },
    'fig-4-3': {
      w: 620, h: 320,
      cajas: [[390, 40, 'CASAS VENDIDAS, y'], [390, 200, 'ACONDICIONADORES VENDIDOS, x']],
      nubes: [[100, 60, 'DEMANDA DE VIVIENDAS, Y0'], [100, 220, 'SUMINISTRO DE ACONDICIONADORES']],
      valvulas: [[270, 60, '', 'der'], [270, 220, '', 'der']],
      constantes: [[220, 130, 'T1'], [220, 290, 'T2']],
      llenas: [[[198, 60], [262, 60]], [[278, 60], [390, 60]], [[198, 220], [262, 220]], [[278, 220], [390, 220]]],
      punteadas: [[[228, 124], [266, 70]], [[390, 80], [278, 70]], [[450, 84], [278, 212]], [[390, 240], [278, 230]], [[228, 284], [266, 230]]],
    },
  };

  UTN.interactivo('cursograma', (figura, cfg, ayuda) => {
    const { svg, lienzo, crear } = ayuda;
    const D = DIBUJOS[cfg.dibujo];
    const idTitulo = figura.querySelector('figcaption')?.id;
    const hoja = svg('svg', { class: 'wg', role: 'img', viewBox: `0 0 ${D.w} ${D.h}`, 'aria-labelledby': idTitulo || undefined });
    const puntaId = `p-${Math.random().toString(36).slice(2, 8)}`;
    hoja.append(svg('defs', {}, svg('marker', { id: puntaId, viewBox: '0 0 10 10', refX: 9, refY: 5, markerWidth: 7, markerHeight: 7, orient: 'auto-start-reverse' }, svg('path', { class: 'wg-punta', d: 'M0 0L10 5L0 10z' }))));
    const linea = ([a, b], clase) => svg('line', { class: clase, x1: a[0], y1: a[1], x2: b[0], y2: b[1], 'marker-end': `url(#${puntaId})` });
    D.llenas.forEach((l) => hoja.append(linea(l, 'wg-eje')));
    D.punteadas.forEach((l) => hoja.append(linea(l, 'wg-tan')));
    const textos = svg('g', { class: 'wg-etqs' });
    const lineas = (x, y, t, ancho) => {
      const palabras = t.split(' ');
      const filas = [''];
      palabras.forEach((p) => {
        if ((`${filas[filas.length - 1]} ${p}`).trim().length * 7.6 > ancho) filas.push(p);
        else filas[filas.length - 1] = `${filas[filas.length - 1]} ${p}`.trim();
      });
      filas.forEach((f, i) => textos.append(svg('text', { x, y: y + (i - (filas.length - 1) / 2) * 16 + 5, 'text-anchor': 'middle' }, f)));
    };
    D.cajas.forEach(([x, y, t]) => {
      hoja.append(svg('rect', { class: 'wg-punto wg-hueco', x, y, width: 180, height: 44 }));
      lineas(x + 90, y + 22, t, 170);
    });
    D.nubes.forEach(([x, y, t]) => {
      hoja.append(svg('ellipse', { class: 'wg-punto wg-hueco', cx: x, cy: y, rx: 98, ry: t.length > 12 ? 34 : 26 }));
      lineas(x, y, t, 130);
    });
    D.valvulas.forEach(([x, y, t, lado]) => {
      hoja.append(svg('path', { class: 'wg-punto wg-hueco', d: `M${x - 10} ${y - 10}L${x + 10} ${y + 10}L${x + 10} ${y - 10}L${x - 10} ${y + 10}z` }));
      if (t) lineas(lado === 'izq' ? x - 62 : x + 66, y + 2, t, 90);
    });
    D.constantes.forEach(([x, y, t]) => {
      hoja.append(svg('circle', { class: 'wg-punto wg-hueco', cx: x, cy: y, r: 8 }), svg('line', { class: 'wg-eje', x1: x - 8, x2: x + 8, y1: y, y2: y }));
      lineas(x - (t.length > 3 ? 62 : 22), y + 2, t, 110);
    });
    hoja.append(textos);
    lienzo.append(crear('div', { className: 'w-plano' }, hoja));
  });

  // ===== In a person's own summary (ayuda.enResumen) raices, punto-fijo and pvi take the student's own function and
  // values and show the whole run. The subject's pages keep the fixed examples above, without free input.
  // cfg.datos is untrusted: only known keys with a string within its cap; formulas go through ayuda.expr.
  function enResumenDe(figura, ayuda) {
    return ayuda.enResumen ?? figura.classList.contains('ag-pieza');
  }
  const leerDatos = (cfg) => {
    const d = cfg && cfg.datos && typeof cfg.datos === 'object' && !Array.isArray(cfg.datos) ? cfg.datos : {};
    return (k, def, tope = 40) => (Object.prototype.hasOwnProperty.call(d, k) && typeof d[k] === 'string' && d[k].length <= tope ? d[k] : def);
  };
  let nCampo = 0;
  function campo(ayuda, etq, valor, tope) {
    const id = `an-p${(nCampo += 1)}`;
    const inp = ayuda.crear('input', { id, type: 'text', autocomplete: 'off', spellcheck: false, autocapitalize: 'off', value: valor, maxLength: tope });
    inp.style.width = '100%';
    inp.style.boxSizing = 'border-box';
    const etiqueta = ayuda.crear('label', { htmlFor: id }, etq);
    return { inp, etiqueta, fila: ayuda.crear('div', { className: 'w-entrada' }, etiqueta, inp) };
  }
  function elegir(ayuda, etq, opciones, actual) {
    const id = `an-p${(nCampo += 1)}`;
    const sel = ayuda.crear('select', { id }, ...opciones.map(([v, t]) => ayuda.crear('option', { value: v, selected: v === actual }, t)));
    sel.style.maxWidth = '100%';
    return { sel, fila: ayuda.crear('div', { className: 'w-fila' }, ayuda.crear('span', { className: 'w-campo' }, ayuda.crear('label', { htmlFor: id }, etq), sel)) };
  }
  /** A formula as written in class (sen, tg too), checked by expr.js: a function of plain numbers, or the error in words. */
  function formula(ayuda, texto, vars, nombre) {
    const t = String(texto).trim().replace(/−/g, '-').replace(/\bsen(?=\s*\()/g, 'sin').replace(/\btg(?=\s*\()/g, 'tan');
    if (!t) return `Falta ${nombre}.`;
    const mal = ayuda.expr.revisar(t, vars);
    if (mal) return `${nombre}: ${mal}`;
    const fn = ayuda.expr.compilar(t, vars);
    const esc = Object.create(null);
    return (...v) => {
      vars.forEach((n, i) => { esc[n] = v[i]; });
      try {
        return fn(esc);
      } catch {
        return NaN;
      }
    };
  }
  /** A number as written in class (3,5 or 3.5, -2, or a formula such as pi/2), or the error in words. */
  function numeroDe(ayuda, texto, nombre) {
    const t = String(texto).trim().replace(/−/g, '-');
    if (!t) return `Falta ${nombre}.`;
    try {
      const v = ayuda.expr.evaluar(/^[+-]?\d+,\d+$/.test(t) ? t.replace(',', '.') : t);
      return Number.isFinite(v) ? v : `${nombre} no da un número.`;
    } catch {
      return `${nombre} no es un número. Escribilo como 3,5.`;
    }
  }
  /** The picture: the drawing as on screen and, under it, the run as text and tables (ayuda.pngTablas). */
  async function apilar(ayuda, hoja, partes) {
    const urls = [hoja ? await ayuda.png(hoja) : null, ayuda.pngTablas ? await ayuda.pngTablas(partes.filter(Boolean)) : null].filter(Boolean);
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
  /** Range of the values, padded; a tiny one becomes ±1 around its centre. */
  const rango = (vals, pad = 0.12) => {
    const v = vals.filter((x) => Number.isFinite(x) && Math.abs(x) < 1e9);
    if (!v.length) return [-1, 1];
    let lo = Math.min(...v);
    let hi = Math.max(...v);
    if (hi - lo < 1e-9) {
      lo -= 1;
      hi += 1;
    }
    const d = (hi - lo) * pad;
    return [lo - d, hi + d];
  };
  /** Vertical range of f over x, with 0 in it. A pole does not flatten the rest: then the extremes are cut. */
  const rangoDe = (f, x, extra = []) => {
    const v = [0, ...extra];
    for (let i = 0; i <= 200; i += 1) {
      const w = f(x[0] + ((x[1] - x[0]) * i) / 200);
      if (Number.isFinite(w) && Math.abs(w) < 1e9) v.push(w);
    }
    v.sort((a, b) => a - b);
    const q = (p) => v[Math.min(v.length - 1, Math.max(0, Math.round(p * (v.length - 1))))];
    const ancho = v[v.length - 1] - v[0];
    return ancho > 40 * (q(0.95) - q(0.05)) + 1e-9 ? rango([q(0.05), q(0.95), 0], 0.25) : rango(v, 0.1);
  };
  /** The curve of f, cut where it leaves the drawing or jumps (a pole), clipped to the plot area. */
  function curvaPropia(ayuda, hoja, f, x, sx, sy, serie, m, W, H) {
    const { svg } = ayuda;
    const id = `an-r${(nCampo += 1)}`;
    hoja.append(svg('defs', {}, svg('clipPath', { id }, svg('rect', { x: m.i, y: m.a, width: Math.max(1, W - m.i - m.d), height: Math.max(1, H - m.a - m.b) }))));
    const d = [];
    let previo = null;
    for (let i = 0; i <= 400; i += 1) {
      const v = x[0] + ((x[1] - x[0]) * i) / 400;
      const w = f(v);
      const py = Number.isFinite(w) ? sy(w) : NaN;
      const sigue = Number.isFinite(py) && Math.abs(py) < 1e5;
      if (sigue) d.push(`${previo !== null && Math.abs(py - previo) < H ? 'L' : 'M'}${sx(v).toFixed(1)} ${py.toFixed(1)}`);
      previo = sigue ? py : null;
    }
    return svg('path', { class: `wg-curva wg-s${serie}`, d: d.join(' '), 'clip-path': `url(#${id})` });
  }
  const pct = (ayuda, v) => (v === null || v === undefined ? '' : Number.isFinite(v) ? `${v < 0.01 ? ayuda.numero(v) : ayuda.numero(v, 4)} %` : '∞');
  // The form, the drawing and the table of a summary's simulator. leer() gives the run or { error }.
  function armarPropio(figura, ayuda, o) {
    const { crear, lienzo } = ayuda;
    const error = crear('p', { className: 'w-error', role: 'status' });
    const titular = crear('p', { className: 'w-titular', 'aria-live': 'polite' });
    const salida = crear('div', {});
    let corrida = null;
    const { marco, pintar } = lamina(figura, ayuda, o.proporcion || 0.6, (hoja, W, H) => {
      if (corrida && !corrida.error) o.dibujar(hoja, W, H, corrida);
    });
    const calcular = () => {
      corrida = o.leer();
      error.textContent = corrida.error || '';
      error.hidden = !corrida.error;
      marco.hidden = Boolean(corrida.error);
      titular.textContent = corrida.error ? '' : corrida.titular;
      salida.replaceChildren(...(corrida.error ? [] : [tabla(ayuda, corrida.cab, corrida.filas.map((f) => f.map(String)))]));
      o.alCalcular?.(corrida);
      pintar();
    };
    const cambio = () => {
      calcular();
      ayuda.guardarDatos?.(o.datos());
    };
    lienzo.append(...o.arriba, error, marco, ...(o.medio || []), titular, salida);
    calcular();
    const imagen = () => (corrida && !corrida.error
      ? apilar(ayuda, marco.querySelector('svg'), [{ texto: o.nombre(), negrita: true }, ...(o.lineas?.() || []).map((t) => ({ texto: t })), { cab: corrida.cab, tabla: corrida.filas }, { texto: corrida.titular }])
      : Promise.resolve(null));
    return { calcular, cambio, imagen, pintar };
  }

  // ----- Roots, in a summary: the student's f, method and starting values, every iteration in the table.
  const METODOS_RES = [['biseccion', 'Bisección'], ['falsa', 'Falsa posición'], ['newton', 'Newton-Raphson'], ['secante', 'Secante']];
  function raicesPropias(figura, cfg, ayuda) {
    const { svg, numero, crear } = ayuda;
    const g = leerDatos(cfg);
    const claves = METODOS_RES.map((x) => x[0]);
    const inicial = claves.includes(g('metodo')) ? g('metodo') : claves.includes(cfg.metodo) ? cfg.metodo : 'biseccion';
    const m = elegir(ayuda, 'Método', METODOS_RES, inicial);
    const cF = campo(ayuda, 'f(x)', g('f', 'e^(-x) - x', 200), 200);
    const cD = campo(ayuda, "f'(x), la derivada", g('df', '-e^(-x) - 1', 200), 200);
    const cA = campo(ayuda, 'xₗ', g('a', '0'), 40);
    const cB = campo(ayuda, 'xᵤ', g('b', '1'), 40);
    const c0 = campo(ayuda, 'x₀', g('x0', '0'), 40);
    const cTol = campo(ayuda, 'εs en %, para parar (opcional)', g('es', ''), 20);
    const cMax = campo(ayuda, 'Iteraciones como máximo', g('max', '6'), 4);
    const cV = campo(ayuda, 'Raíz verdadera, para εt (opcional)', g('verdadero', ''), 40);
    const ver = elegir(ayuda, 'En el gráfico, la iteración', [['0', '1']], '0');
    let verGuardado = g('ver', '0', 4);
    const n6 = (v) => numero(v, 6);
    const ajustar = () => {
      const M = m.sel.value;
      const cerrado = M === 'biseccion' || M === 'falsa';
      cD.fila.hidden = M !== 'newton';
      c0.fila.hidden = M !== 'newton';
      cA.fila.hidden = M === 'newton';
      cB.fila.hidden = M === 'newton';
      cA.etiqueta.textContent = cerrado ? 'xₗ' : 'x₋₁';
      cB.etiqueta.textContent = cerrado ? 'xᵤ' : 'x₀';
    };
    const leer = () => {
      const M = m.sel.value;
      const f = formula(ayuda, cF.inp.value, ['x'], 'f(x)');
      if (typeof f === 'string') return { error: f };
      const df = M === 'newton' ? formula(ayuda, cD.inp.value, ['x'], "f'(x)") : null;
      if (typeof df === 'string') return { error: df };
      const max = numeroDe(ayuda, cMax.inp.value, 'Iteraciones como máximo');
      if (typeof max === 'string') return { error: max };
      if (!Number.isInteger(max) || max < 1 || max > 50) return { error: 'Iteraciones como máximo: un entero entre 1 y 50.' };
      const es = cTol.inp.value.trim() ? numeroDe(ayuda, cTol.inp.value, 'εs') : null;
      if (typeof es === 'string') return { error: es };
      if (es !== null && !(es > 0)) return { error: 'εs tiene que ser mayor que 0.' };
      const xv = cV.inp.value.trim() ? numeroDe(ayuda, cV.inp.value, 'La raíz verdadera') : null;
      if (typeof xv === 'string') return { error: xv };
      if (xv === 0) return { error: 'Con raíz verdadera 0, εt no se puede calcular: dejá ese campo vacío.' };
      const et = (x) => (xv === null ? null : Math.abs((xv - x) / xv) * 100);
      const conEt = (c) => (xv === null ? c : [...c, 'εt (%)']);
      const pasos = [];
      let fin = '';
      const cortar = (ea, i) => es !== null && ea !== null && ea < es && ((fin = `En la iteración ${i}, εa = ${pct(ayuda, ea)} ya es menor que εs = ${numero(es)} %, y se para.`), true);
      if (M === 'biseccion' || M === 'falsa') {
        let xl = numeroDe(ayuda, cA.inp.value, 'xₗ');
        if (typeof xl === 'string') return { error: xl };
        let xu = numeroDe(ayuda, cB.inp.value, 'xᵤ');
        if (typeof xu === 'string') return { error: xu };
        if (!(xl < xu)) return { error: 'xₗ tiene que ser menor que xᵤ.' };
        let fl = f(xl);
        let fu = f(xu);
        if (!Number.isFinite(fl) || !Number.isFinite(fu)) return { error: 'f(xₗ) o f(xᵤ) no da un número real.' };
        if (fl * fu > 0) return { error: `f(xₗ) = ${n6(fl)} y f(xᵤ) = ${n6(fu)} tienen el mismo signo: el intervalo no encierra un cambio de signo. Probá otros extremos.` };
        if (fl * fu === 0) return { error: `${fl === 0 ? 'f(xₗ)' : 'f(xᵤ)'} ya vale 0: ese extremo es la raíz.` };
        let previo = null;
        for (let i = 1; i <= max; i += 1) {
          const xr = M === 'biseccion' ? (xl + xu) / 2 : xu - (fu * (xl - xu)) / (fl - fu);
          const fr = f(xr);
          if (!Number.isFinite(fr)) {
            fin = `f(xᵣ) no da un número real en xᵣ = ${n6(xr)}.`;
            break;
          }
          const ea = previo === null ? null : Math.abs((xr - previo) / xr) * 100;
          const prod = fl * fr;
          pasos.push({ x: xr, de: { xl, xu, fl, fu }, fila: [String(i), n6(xl), n6(xu), n6(fl), n6(fu), n6(xr), n6(fr), n6(prod), prod < 0 ? 'xᵤ = xᵣ' : prod > 0 ? 'xₗ = xᵣ' : 'raíz', pct(ayuda, ea), ...(xv === null ? [] : [pct(ayuda, et(xr))])] });
          if (prod === 0) {
            fin = `f(xᵣ) = 0: xᵣ = ${n6(xr)} es la raíz.`;
            break;
          }
          if (cortar(ea, i)) break;
          if (prod < 0) {
            xu = xr;
            fu = fr;
          } else {
            xl = xr;
            fl = fr;
          }
          previo = xr;
        }
        return terminar(pasos, fin, conEt(['i', 'xₗ', 'xᵤ', 'f(xₗ)', 'f(xᵤ)', 'xᵣ', 'f(xᵣ)', 'f(xₗ)·f(xᵣ)', 'Queda', 'εa (%)']), 'xᵣ', f, max);
      }
      if (M === 'newton') {
        let x = numeroDe(ayuda, c0.inp.value, 'x₀');
        if (typeof x === 'string') return { error: x };
        for (let i = 0; i < max; i += 1) {
          const fx = f(x);
          const dx = df(x);
          if (!Number.isFinite(fx) || !Number.isFinite(dx)) {
            fin = `f o f' no dan un número real en x = ${n6(x)}.`;
            break;
          }
          if (dx === 0) {
            fin = `f'(x${i}) = 0: la tangente es horizontal y Newton-Raphson no puede seguir.`;
            break;
          }
          const x1 = x - fx / dx;
          const ea = Math.abs((x1 - x) / x1) * 100;
          pasos.push({ x: x1, de: { x, fx }, fila: [String(i), n6(x), n6(fx), n6(dx), n6(x1), pct(ayuda, ea), ...(xv === null ? [] : [pct(ayuda, et(x1))])] });
          if (!(Math.abs(x1) < 1e12)) {
            fin = 'La iteración se fue lejísimos: el método no converge desde ese x₀.';
            break;
          }
          if (cortar(ea, i)) break;
          x = x1;
        }
        return terminar(pasos, fin, conEt(['i', 'xᵢ', 'f(xᵢ)', "f'(xᵢ)", 'xᵢ₊₁', 'εa (%)']), 'xᵢ₊₁', f, max);
      }
      let a = numeroDe(ayuda, cA.inp.value, 'x₋₁');
      if (typeof a === 'string') return { error: a };
      let b = numeroDe(ayuda, cB.inp.value, 'x₀');
      if (typeof b === 'string') return { error: b };
      for (let i = 0; i < max; i += 1) {
        const fa = f(a);
        const fb = f(b);
        if (!Number.isFinite(fa) || !Number.isFinite(fb)) {
          fin = 'f no da un número real en uno de los dos puntos.';
          break;
        }
        if (fa === fb) {
          fin = `f(x${i - 1}) = f(x${i}): la recta es horizontal y no corta al eje.`;
          break;
        }
        const x1 = b - (fb * (a - b)) / (fa - fb);
        const ea = Math.abs((x1 - b) / x1) * 100;
        pasos.push({ x: x1, de: { a, b, fa, fb }, fila: [String(i), n6(a), n6(b), n6(fa), n6(fb), n6(x1), pct(ayuda, ea), ...(xv === null ? [] : [pct(ayuda, et(x1))])] });
        if (!(Math.abs(x1) < 1e12)) {
          fin = 'La iteración se fue lejísimos: el método no converge desde esos valores.';
          break;
        }
        if (cortar(ea, i)) break;
        a = b;
        b = x1;
      }
      return terminar(pasos, fin, conEt(['i', 'xᵢ₋₁', 'xᵢ', 'f(xᵢ₋₁)', 'f(xᵢ)', 'xᵢ₊₁', 'εa (%)']), 'xᵢ₊₁', f, max);
    };
    function terminar(pasos, fin, cab, nombre, f, max) {
      if (!pasos.length) return { error: fin || 'No se pudo hacer ninguna iteración.' };
      const u = pasos[pasos.length - 1];
      const cuantas = pasos.length === 1 ? 'una iteración' : `${pasos.length} iteraciones`;
      const titular = `${fin || (pasos.length === max ? (max === 1 ? 'Se hizo la iteración pedida.' : `Se hicieron las ${max} iteraciones pedidas.`) : '')} Raíz aproximada: ${n6(u.x)}, después de ${cuantas}.`.trim();
      return { pasos, cab, filas: pasos.map((p) => p.fila), titular, nombre, f };
    }
    const dibujar = (hoja, W, H, r) => {
      const M = m.sel.value;
      const i = Math.min(Number(ver.sel.value) || 0, r.pasos.length - 1);
      const p = r.pasos[i];
      const xs = M === 'biseccion' || M === 'falsa' ? [r.pasos[0].de.xl, r.pasos[0].de.xu] : [...r.pasos.slice(0, 8).flatMap((q) => [q.x, q.de.x, q.de.a, q.de.b])];
      const x = rango(xs, 0.15);
      const y = rangoDe(r.f, x, [p.de.fl, p.de.fu, p.de.fx, p.de.fa, p.de.fb].filter(Number.isFinite));
      const { sx, sy, m: mg } = ejes(ayuda, hoja, W, H, x, y);
      hoja.append(curvaPropia(ayuda, hoja, r.f, x, sx, sy, 0, mg, W, H));
      const marcas = svg('g', {});
      const etqs = svg('g', { class: 'wg-etqs' });
      const pto = (px, py, t, arriba) => {
        marcas.append(svg('line', { class: 'wg-guia', x1: sx(px), x2: sx(px), y1: sy(0), y2: sy(py) }), svg('circle', { class: 'wg-punto', cx: sx(px), cy: sy(py), r: 5 }));
        etqs.append(svg('text', { x: sx(px), y: sy(py) + (arriba ? -10 : 20), 'text-anchor': 'middle' }, t));
      };
      const d = p.de;
      if ('xl' in d) {
        pto(d.xl, d.fl, 'xₗ', true);
        pto(d.xu, d.fu, 'xᵤ', true);
        if (M === 'falsa') marcas.append(svg('line', { class: 'wg-tan', x1: sx(d.xl), y1: sy(d.fl), x2: sx(d.xu), y2: sy(d.fu) }));
      } else if ('fx' in d) {
        pto(d.x, d.fx, 'xᵢ', true);
        marcas.append(svg('line', { class: 'wg-tan', x1: sx(d.x), y1: sy(d.fx), x2: sx(p.x), y2: sy(0) }));
      } else {
        pto(d.a, d.fa, 'xᵢ₋₁', true);
        pto(d.b, d.fb, 'xᵢ', false);
        marcas.append(svg('line', { class: 'wg-tan', x1: sx(d.a), y1: sy(d.fa), x2: sx(p.x), y2: sy(0) }));
      }
      marcas.append(svg('circle', { class: 'wg-leido', cx: sx(p.x), cy: sy(0), r: 6 }));
      etqs.append(svg('text', { x: sx(p.x), y: sy(0) + 22, 'text-anchor': 'middle' }, r.nombre));
      hoja.append(marcas, etqs);
    };
    const nombreMetodo = () => METODOS_RES.find((x) => x[0] === m.sel.value)[1];
    const api = armarPropio(figura, ayuda, {
      arriba: [m.fila, cF.fila, cD.fila, crear('div', { className: 'w-entradas' }, cA.fila, cB.fila, c0.fila, cMax.fila, cTol.fila, cV.fila)],
      medio: [ver.fila],
      leer,
      dibujar,
      alCalcular: (r) => {
        const n = r.error ? 0 : r.pasos.length;
        const actual = verGuardado ?? ver.sel.value;
        verGuardado = null;
        ver.sel.replaceChildren(...Array.from({ length: Math.max(n, 1) }, (_, k) => crear('option', { value: String(k) }, r.error ? '1' : r.pasos[k].fila[0])));
        ver.sel.value = String(Math.min(Number(actual) || 0, Math.max(n - 1, 0)));
        ver.fila.hidden = n < 2;
      },
      nombre: () => `${nombreMetodo()} con f(x) = ${cF.inp.value.trim()}`,
      lineas: () => (m.sel.value === 'newton' ? [`f'(x) = ${cD.inp.value.trim()}`] : []),
      datos: () => ({ metodo: m.sel.value, f: cF.inp.value, df: cD.inp.value, a: cA.inp.value, b: cB.inp.value, x0: c0.inp.value, es: cTol.inp.value, max: cMax.inp.value, verdadero: cV.inp.value, ver: ver.sel.value }),
    });
    ajustar();
    api.calcular();
    m.sel.addEventListener('change', () => {
      ajustar();
      api.cambio();
    });
    [cF, cD, cA, cB, c0, cTol, cMax, cV].forEach((c) => c.inp.addEventListener('input', api.cambio));
    ver.sel.addEventListener('change', () => {
      api.pintar();
      ayuda.guardarDatos?.({ metodo: m.sel.value, f: cF.inp.value, df: cD.inp.value, a: cA.inp.value, b: cB.inp.value, x0: c0.inp.value, es: cTol.inp.value, max: cMax.inp.value, verdadero: cV.inp.value, ver: ver.sel.value });
    });
    return { imagen: api.imagen };
  }

  // ----- Fixed point, in a summary: the student's g(x) and x₀, with the stair and every iteration.
  function puntoFijoPropio(figura, cfg, ayuda) {
    const { svg, numero, crear } = ayuda;
    const g = leerDatos(cfg);
    const cG = campo(ayuda, 'g(x), el despeje x = g(x)', g('g', 'e^(-x)', 200), 200);
    const c0 = campo(ayuda, 'x₀', g('x0', '0'), 40);
    const cMax = campo(ayuda, 'Iteraciones como máximo', g('max', '6'), 4);
    const cTol = campo(ayuda, 'εs en %, para parar (opcional)', g('es', ''), 20);
    const cV = campo(ayuda, 'Raíz verdadera, para εt (opcional)', g('verdadero', ''), 40);
    const n6 = (v) => numero(v, 6);
    const leer = () => {
      const gx = formula(ayuda, cG.inp.value, ['x'], 'g(x)');
      if (typeof gx === 'string') return { error: gx };
      const x0 = numeroDe(ayuda, c0.inp.value, 'x₀');
      if (typeof x0 === 'string') return { error: x0 };
      const max = numeroDe(ayuda, cMax.inp.value, 'Iteraciones como máximo');
      if (typeof max === 'string') return { error: max };
      if (!Number.isInteger(max) || max < 1 || max > 50) return { error: 'Iteraciones como máximo: un entero entre 1 y 50.' };
      const es = cTol.inp.value.trim() ? numeroDe(ayuda, cTol.inp.value, 'εs') : null;
      if (typeof es === 'string') return { error: es };
      if (es !== null && !(es > 0)) return { error: 'εs tiene que ser mayor que 0.' };
      const xv = cV.inp.value.trim() ? numeroDe(ayuda, cV.inp.value, 'La raíz verdadera') : null;
      if (typeof xv === 'string') return { error: xv };
      if (xv === 0) return { error: 'Con raíz verdadera 0, εt no se puede calcular: dejá ese campo vacío.' };
      const xs = [x0];
      const filas = [['0', n6(x0), '', ...(xv === null ? [] : [pct(ayuda, Math.abs((xv - x0) / xv) * 100)])]];
      let fin = '';
      for (let i = 1; i <= max; i += 1) {
        const x = gx(xs[i - 1]);
        if (!Number.isFinite(x) || Math.abs(x) > 1e12) {
          fin = `g(x${i - 1}) no da un número real o se fue lejísimos: la iteración diverge.`;
          break;
        }
        const ea = Math.abs((x - xs[i - 1]) / x) * 100;
        xs.push(x);
        filas.push([String(i), n6(x), pct(ayuda, ea), ...(xv === null ? [] : [pct(ayuda, Math.abs((xv - x) / xv) * 100)])]);
        if (es !== null && ea < es) {
          fin = `En la iteración ${i}, εa = ${pct(ayuda, ea)} ya es menor que εs = ${numero(es)} %, y se para.`;
          break;
        }
      }
      if (!fin && xs.length - 1 === max) fin = max === 1 ? 'Se hizo la iteración pedida.' : `Se hicieron las ${max} iteraciones pedidas.`;
      const u = xs[xs.length - 1];
      const h = 1e-5 * Math.max(1, Math.abs(u));
      const d = Math.abs((gx(u + h) - gx(u - h)) / (2 * h));
      const deriv = Number.isFinite(d) ? ` Cerca de ese valor, |g'(x)| ≈ ${numero(d, 4)}: ${d < 1 ? 'menor que 1, así que la escalera se acerca a la raíz' : 'no es menor que 1, así que la escalera no se acerca'}.` : '';
      return { xs, gx, filas, cab: ['i', 'xᵢ', 'εa (%)', ...(xv === null ? [] : ['εt (%)'])], titular: `${fin ? `${fin} ` : ''}Último valor: x${xs.length - 1} = ${n6(u)}.${deriv}` };
    };
    const dibujar = (hoja, W, H, r) => {
      const x = rango(r.xs.slice(0, 12), 0.25);
      const { sx, sy, m: mg } = ejes(ayuda, hoja, W, H, x, x);
      hoja.append(curvaPropia(ayuda, hoja, (v) => v, x, sx, sy, 3, mg, W, H), curvaPropia(ayuda, hoja, r.gx, x, sx, sy, 0, mg, W, H));
      const y0 = x[0] <= 0 && x[1] >= 0 ? 0 : x[0];
      const tramos = [[sx(r.xs[0]), sy(y0)]];
      for (let i = 0; i + 1 < r.xs.length; i += 1) tramos.push([sx(r.xs[i]), sy(r.xs[i + 1])], [sx(r.xs[i + 1]), sy(r.xs[i + 1])]);
      const corte = `an-r${(nCampo += 1)}`;
      hoja.append(ayuda.svg('defs', {}, ayuda.svg('clipPath', { id: corte }, ayuda.svg('rect', { x: mg.i, y: mg.a, width: Math.max(1, W - mg.i - mg.d), height: Math.max(1, H - mg.a - mg.b) }))));
      if (r.xs.length > 1) hoja.append(trazo(ayuda, tramos.filter((q) => Math.abs(q[1]) < 1e5 && Math.abs(q[0]) < 1e5), 1, { 'clip-path': `url(#${corte})` }));
      const u = r.xs[r.xs.length - 1];
      if (u >= x[0] && u <= x[1]) hoja.append(svg('circle', { class: 'wg-leido', cx: sx(u), cy: sy(u), r: 5 }));
      leyenda(ayuda, hoja, W, [['y = x', 3], [`g(x) = ${cG.inp.value.trim()}`.slice(0, 40), 0], ['iteraciones', 1]], H - 100);
    };
    const api = armarPropio(figura, ayuda, {
      proporcion: 0.62,
      arriba: [cG.fila, crear('div', { className: 'w-entradas' }, c0.fila, cMax.fila, cTol.fila, cV.fila)],
      leer,
      dibujar,
      nombre: () => `Punto fijo con g(x) = ${cG.inp.value.trim()}`,
      datos: () => ({ g: cG.inp.value, x0: c0.inp.value, max: cMax.inp.value, es: cTol.inp.value, verdadero: cV.inp.value }),
    });
    [cG, c0, cMax, cTol, cV].forEach((c) => c.inp.addEventListener('input', api.cambio));
    return { imagen: api.imagen };
  }

  // ----- One-step methods, in a summary: the student's y' = f(x, y), start, step and method, every step in the table.
  const METODOS_PVI = [['euler', 'Euler'], ['heun', 'Heun'], ['medio', 'Punto medio'], ['rk4', 'Runge-Kutta de cuarto orden']];
  function pviPropio(figura, cfg, ayuda) {
    const { svg, numero, crear } = ayuda;
    const g = leerDatos(cfg);
    const claves = METODOS_PVI.map((x) => x[0]);
    const m = elegir(ayuda, 'Método', METODOS_PVI, claves.includes(g('metodo')) ? g('metodo') : 'euler');
    const cF = campo(ayuda, "y' = f(x, y)", g('f', '-2*x^3 + 12*x^2 - 20*x + 8.5', 200), 200);
    const cX0 = campo(ayuda, 'x₀', g('x0', '0'), 40);
    const cY0 = campo(ayuda, 'y₀ = y(x₀)', g('y0', '1'), 40);
    const cH = campo(ayuda, 'Paso h', g('h', '0.5'), 40);
    const cXf = campo(ayuda, 'Hasta x =', g('xf', '4'), 40);
    const cE = campo(ayuda, 'Solución verdadera y(x), para εt (opcional)', g('exacta', '-0.5*x^4 + 4*x^3 - 10*x^2 + 8.5*x + 1', 200), 200);
    const n6 = (v) => numero(v, 6);
    const leer = () => {
      const f = formula(ayuda, cF.inp.value, ['x', 'y'], 'f(x, y)');
      if (typeof f === 'string') return { error: f };
      const ex = cE.inp.value.trim() ? formula(ayuda, cE.inp.value, ['x'], 'La solución verdadera') : null;
      if (typeof ex === 'string') return { error: ex };
      const val = {};
      for (const [k, c, n] of [['x0', cX0, 'x₀'], ['y0', cY0, 'y₀'], ['h', cH, 'h'], ['xf', cXf, 'El x final']]) {
        val[k] = numeroDe(ayuda, c.inp.value, n);
        if (typeof val[k] === 'string') return { error: val[k] };
      }
      const { x0, y0, h, xf } = val;
      if (!(h > 0)) return { error: 'h tiene que ser mayor que 0.' };
      if (!(xf > x0)) return { error: 'El x final tiene que ser mayor que x₀.' };
      const n = Math.round((xf - x0) / h);
      if (n < 1 || Math.abs(x0 + n * h - xf) > 1e-9 * Math.max(1, Math.abs(xf))) return { error: 'Con ese h no se llega justo al x final. Elegí un h que entre una cantidad entera de veces.' };
      if (n > 100) return { error: `Serían ${n} pasos: hasta 100. Agrandá h o acortá el intervalo.` };
      const M = m.sel.value;
      const pts = [[x0, y0]];
      const filas = [];
      let fin = '';
      for (let i = 0; i < n; i += 1) {
        const [x, y] = pts[i];
        const x1 = Number((x0 + (i + 1) * h).toPrecision(12));
        const k1 = f(x, y);
        let y1;
        let extra;
        if (M === 'euler') {
          y1 = y + k1 * h;
          extra = [n6(k1)];
        } else if (M === 'heun') {
          const p = y + k1 * h;
          const k2 = f(x1, p);
          y1 = y + ((k1 + k2) / 2) * h;
          extra = [n6(k1), n6(p), n6(k2), n6((k1 + k2) / 2)];
          extra.push(pct(ayuda, Math.abs((y1 - p) / y1) * 100));
        } else if (M === 'medio') {
          const ym = y + k1 * (h / 2);
          const k2 = f(x + h / 2, ym);
          y1 = y + k2 * h;
          extra = [n6(k1), n6(ym), n6(k2)];
        } else {
          const k2 = f(x + h / 2, y + (k1 * h) / 2);
          const k3 = f(x + h / 2, y + (k2 * h) / 2);
          const k4 = f(x + h, y + k3 * h);
          y1 = y + ((k1 + 2 * k2 + 2 * k3 + k4) / 6) * h;
          extra = [n6(k1), n6(k2), n6(k3), n6(k4)];
        }
        if (!Number.isFinite(y1)) {
          fin = `En x = ${n6(x)} la cuenta no da un número real.`;
          break;
        }
        const yv = ex ? ex(x1) : null;
        filas.push([String(i), numero(x), n6(y), ...extra, n6(y1), ...(ex ? [n6(yv), pct(ayuda, Math.abs((yv - y1) / yv) * 100)] : [])]);
        pts.push([x1, y1]);
      }
      if (!filas.length) return { error: fin };
      const CAB = {
        euler: ["f(xᵢ, yᵢ)"],
        heun: ["f(xᵢ, yᵢ)", 'y⁰ᵢ₊₁ predictor', 'f(xᵢ₊₁, y⁰ᵢ₊₁)', 'Pendiente promedio', 'εa (%) corrector contra predictor'],
        medio: ["f(xᵢ, yᵢ)", 'yᵢ₊₁/₂', 'f(xᵢ₊₁/₂, yᵢ₊₁/₂)'],
        rk4: ['k₁', 'k₂', 'k₃', 'k₄'],
      }[M];
      const [xu, yu] = pts[pts.length - 1];
      const verdad = ex ? ` El valor verdadero es ${n6(ex(xu))}, con εt = ${pct(ayuda, Math.abs((ex(xu) - yu) / ex(xu)) * 100)}.` : '';
      return { pts, f, ex, x: [x0, xf], filas, cab: ['i', 'xᵢ', 'yᵢ', ...CAB, 'yᵢ₊₁', ...(ex ? ['y verdadero en xᵢ₊₁', 'εt (%)'] : [])], titular: `${fin ? `${fin} ` : ''}y(${numero(xu)}) ≈ ${n6(yu)}.${verdad}` };
    };
    const dibujar = (hoja, W, H, r) => {
      const muestras = [];
      if (r.ex) for (let i = 0; i <= 60; i += 1) muestras.push(r.ex(r.x[0] + ((r.x[1] - r.x[0]) * i) / 60));
      const y = rango([...r.pts.map((p) => p[1]), ...muestras], 0.1);
      const { sx, sy, m: mg } = ejes(ayuda, hoja, W, H, r.x, y);
      if (r.ex) hoja.append(curvaPropia(ayuda, hoja, r.ex, r.x, sx, sy, 0, mg, W, H));
      hoja.append(trazo(ayuda, r.pts.map((p) => [sx(p[0]), sy(p[1])]), 1));
      r.pts.forEach((p) => hoja.append(svg('circle', { class: 'wg-punto', cx: sx(p[0]), cy: sy(p[1]), r: 3.5 })));
      leyenda(ayuda, hoja, W, [...(r.ex ? [['solución verdadera', 0]] : []), [METODOS_PVI.find((x) => x[0] === m.sel.value)[1], 1]]);
    };
    const api = armarPropio(figura, ayuda, {
      proporcion: 0.62,
      arriba: [m.fila, cF.fila, crear('div', { className: 'w-entradas' }, cX0.fila, cY0.fila, cH.fila, cXf.fila), cE.fila],
      leer,
      dibujar,
      nombre: () => `${METODOS_PVI.find((x) => x[0] === m.sel.value)[1]} para y' = ${cF.inp.value.trim()}, con y(${cX0.inp.value.trim()}) = ${cY0.inp.value.trim()} y h = ${cH.inp.value.trim()}`,
      datos: () => ({ metodo: m.sel.value, f: cF.inp.value, x0: cX0.inp.value, y0: cY0.inp.value, h: cH.inp.value, xf: cXf.inp.value, exacta: cE.inp.value }),
    });
    m.sel.addEventListener('change', api.cambio);
    [cF, cX0, cY0, cH, cXf, cE].forEach((c) => c.inp.addEventListener('input', api.cambio));
    return { imagen: api.imagen };
  }
})();
