// Simuladores de Probabilidad y Estadística. Muestran ideas de la teoría con ejemplos del apunte.
(() => {
  // Dibuja en un SVG del ancho real del lugar. Repinta si cambia el ancho, el tema o el tamaño del texto.
  const lamina = (ayuda, pintar) => {
    const { crear, svg, color, alCambiar, lienzo } = ayuda;
    const cont = crear('div', { className: 'pye-lamina' });
    lienzo.append(cont);
    let ancho = 0;
    const repintar = () => {
      const W = Math.max(260, Math.round(cont.clientWidth || 600));
      ancho = W;
      const fs = Math.round(13 * (parseFloat(getComputedStyle(document.documentElement).fontSize) || 16) / 16);
      const t = { fs, tinta: color('--tinta'), suave: color('--tinta-suave'), acento: color('--birome'), borde: color('--borde') };
      const H = pintar.alto(W, t);
      const s = svg('svg', { viewBox: `0 0 ${W} ${H}`, width: '100%', 'aria-hidden': 'true' });
      pintar.dibujar(s, W, H, t);
      cont.replaceChildren(s);
    };
    alCambiar(repintar);
    new ResizeObserver(() => {
      if (Math.round(cont.clientWidth) !== ancho && cont.clientWidth > 0) repintar();
    }).observe(cont);
    repintar();
    return repintar;
  };

  const linea = (svg, s, x1, y1, x2, y2, stroke, ancho = 1.5, trazo) => {
    s.append(svg('line', { x1, y1, x2, y2, stroke, 'stroke-width': ancho, 'stroke-dasharray': trazo }));
  };
  const texto = (svg, s, x, y, cuerpo, fill, fs, ancla = 'middle') => {
    s.append(svg('text', { x, y, fill, 'font-size': fs, 'text-anchor': ancla }, cuerpo));
  };
  const lectura = (ayuda) => {
    const p = ayuda.crear('p', { className: 'w-ayuda', role: 'status' });
    return p;
  };
  const controles = (ayuda, ...hijos) => ayuda.crear('div', { className: 'w-ctl' }, ...hijos);

  // ----- In a person's own summary a piece keeps its data: the summary maker hands them back in cfg.datos.
  const enResumenDe = (figura, ayuda) => ayuda.enResumen ?? figura.classList.contains('ag-pieza');
  /** cfg.datos comes from the browser's storage, so it is untrusted: a saved string within its cap, or undefined. */
  const guardado = (cfg, clave, tope = 24) => {
    const d = cfg && cfg.datos;
    if (!d || typeof d !== 'object' || Array.isArray(d) || !Object.prototype.hasOwnProperty.call(d, clave)) return undefined;
    return typeof d[clave] === 'string' && d[clave].length <= tope ? d[clave] : undefined;
  };
  /** A saved slider value, snapped to the slider, or the default when it is not one of its numbers. */
  const enRango = (texto, min, max, paso, def) => {
    const v = Number(String(texto ?? '').trim().replace(',', '.'));
    if (texto === undefined || String(texto).trim() === '' || !Number.isFinite(v) || v < min || v > max) return def;
    return Number((min + Math.round((v - min) / paso) * paso).toFixed(6));
  };
  /** A select in a .w-campo, for the choices that only a summary offers. */
  const elegirDe = (ayuda, etq, opciones, actual, alElegir) => {
    const { crear } = ayuda;
    const id = `pye-sel${cuenta += 1}`;
    const sel = crear('select', { id }, ...opciones.map(([v, t]) => crear('option', { value: v, selected: v === actual }, t)));
    sel.addEventListener('change', () => alElegir(sel.value));
    return crear('div', { className: 'w-fila' }, crear('span', { className: 'w-campo' }, crear('label', { htmlFor: id }, etq), sel));
  };

  // ----- Pictures of the pieces for the summary. Calculators go as text and tables with ayuda.pngTablas, like the
  // matrix and the truth table. A drawing goes as it looks on screen, with lines of text under it in its colours.
  const fondoDe = (el) => {
    for (let n = el; n && n.nodeType === 1; n = n.parentElement) {
      const c = getComputedStyle(n).backgroundColor;
      if (c && !/^(transparent|rgba\(0, 0, 0, 0\))$/.test(c)) return c;
    }
    return '#fff';
  };
  /** lineas: strings, or { t, fuerte } for a heading, under the drawing. Long lines wrap at spaces. */
  const imagenCon = async (ayuda, dibujo, lineas) => {
    const { lienzo } = ayuda;
    const k = 2;
    const fs = 15;
    const alto = Math.round(fs * 1.45);
    const margen = 14;
    const familia = getComputedStyle(lienzo).fontFamily || 'sans-serif';
    const fuente = (fuerte) => `${fuerte ? 600 : 400} ${fs}px ${familia}`;
    const img = new Image();
    img.src = await ayuda.png(dibujo);
    await img.decode();
    // ayuda.png draws at twice the size on screen: the text goes at that same width.
    const W = Math.max(320, Math.round(img.width / k));
    const altoDibujo = Math.round((W * img.height) / img.width);
    const c = document.createElement('canvas');
    const g = c.getContext('2d');
    const renglones = [];
    lineas.filter(Boolean).forEach((l) => {
      const fuerte = typeof l === 'object' && l.fuerte;
      g.font = fuente(fuerte);
      let actual = '';
      String(typeof l === 'object' ? l.t : l).split(' ').forEach((p) => {
        const prueba = actual ? `${actual} ${p}` : p;
        if (actual && g.measureText(prueba).width > W - 2 * margen) {
          renglones.push({ t: actual, fuerte });
          actual = p;
        } else actual = prueba;
      });
      renglones.push({ t: actual, fuerte });
    });
    const H = altoDibujo + 6 + renglones.length * alto + margen;
    c.width = W * k;
    c.height = H * k;
    g.scale(k, k);
    g.fillStyle = fondoDe(dibujo);
    g.fillRect(0, 0, W, H);
    g.drawImage(img, 0, 0, W, altoDibujo);
    g.fillStyle = ayuda.color('--tinta');
    g.textBaseline = 'middle';
    renglones.forEach((r, i) => {
      g.font = fuente(r.fuerte);
      g.fillText(r.t, margen, altoDibujo + 6 + i * alto + alto / 2);
    });
    return c.toDataURL('image/png');
  };
  /** The dt and dd of a results list, as rows of a table. */
  const filasDe = (dl) => {
    const h = [...dl.children];
    const r = [];
    for (let i = 0; i + 1 < h.length; i += 2) r.push([h[i].textContent, h[i + 1].textContent]);
    return r;
  };
  /** Parts for ayuda.pngTablas, without the empty ones. Null if this page's w.js cannot draw them. */
  const tablas = (ayuda, partes) => (ayuda.pngTablas ? ayuda.pngTablas(partes.filter((p) => p && (p.texto || (p.tabla && p.tabla.length)))) : null);

  // ----- Bastones de una variable discreta: Binomial o Poisson
  UTN.interactivo('bastones', (figura, cfg, ayuda) => {
    const { svg, numero, deslizador, lienzo } = ayuda;
    // A summary chooses the model and takes finer values, so the student's own n, π or λ fit.
    const enResumen = enResumenDe(figura, ayuda);
    const R = enResumen
      ? { n: [1, 50, 1], pi: [0.01, 0.99, 0.01], lam: [0.1, 15, 0.1] }
      : { n: [1, 30, 1], pi: [0.05, 0.95, 0.05], lam: [0.2, 15, 0.2] };
    const elegido = guardado(cfg, 'modelo');
    let binomial = elegido === 'binomial' || elegido === 'poisson' ? elegido === 'binomial' : enResumen && !cfg.modelo ? true : cfg.modelo === 'binomial';
    let n = enRango(guardado(cfg, 'n'), ...R.n, cfg.n ?? 5);
    let pi = enRango(guardado(cfg, 'pi'), ...R.pi, cfg.pi ?? 0.2);
    let lam = enRango(guardado(cfg, 'lambda'), ...R.lam, cfg.lambda ?? 5);
    const guardar = () => {
      if (enResumen) ayuda.guardarDatos?.({ modelo: binomial ? 'binomial' : 'poisson', n: String(n), pi: String(pi), lambda: String(lam) });
    };
    if (enResumen) {
      lienzo.append(elegirDe(ayuda, 'Modelo', [['binomial', 'Binomial'], ['poisson', 'Poisson']], binomial ? 'binomial' : 'poisson', (v) => {
        binomial = v === 'binomial';
        armarControles();
        repintar();
        guardar();
      }));
    }
    const kMax = () => (binomial ? n : 25);
    const media = () => (binomial ? n * pi : lam);
    const varianza = () => (binomial ? n * pi * (1 - pi) : lam);
    const probs = () => {
      const p = [];
      if (binomial) {
        let q = (1 - pi) ** n;
        for (let k = 0; k <= n; k += 1) {
          p.push(q);
          q = q * ((n - k) / (k + 1)) * (pi / (1 - pi));
        }
      } else {
        let q = Math.exp(-lam);
        for (let k = 0; k <= 25; k += 1) {
          p.push(q);
          q = q * lam / (k + 1);
        }
      }
      return p;
    };
    const lect = lectura(ayuda);
    const repintar = lamina(ayuda, {
      alto: (W, t) => Math.round(t.fs * 15),
      dibujar: (s, W, H, t) => {
        const izq = t.fs * 3.2;
        const der = W - t.fs;
        const arriba = t.fs * 2;
        const abajo = H - t.fs * 2.4;
        const p = probs();
        const tope = Math.max(...p) * 1.1;
        const X = (k) => izq + (k + 0.5) * (der - izq) / (kMax() + 1);
        const Y = (v) => abajo - v * (abajo - arriba) / tope;
        linea(svg, s, izq, abajo, der, abajo, t.suave);
        linea(svg, s, izq, abajo, izq, arriba, t.suave);
        texto(svg, s, izq - 5, Y(tope / 1.1) + t.fs / 3, numero(tope / 1.1, 2), t.tinta, t.fs, 'end');
        texto(svg, s, izq - 5, abajo + t.fs / 3, '0', t.tinta, t.fs, 'end');
        const paso = Math.max(1, Math.ceil((kMax() + 1) * t.fs * 2 / (der - izq)));
        p.forEach((v, k) => {
          linea(svg, s, X(k), abajo, X(k), Y(v), t.acento, 3);
          s.append(svg('circle', { cx: X(k), cy: Y(v), r: 3.5, fill: t.acento }));
          if (k % paso === 0) texto(svg, s, X(k), abajo + t.fs * 1.2, String(k), t.tinta, t.fs);
        });
        texto(svg, s, (izq + der) / 2, H - t.fs * 0.2, binomial ? 'x: cantidad de éxitos' : 'x: cantidad de eventos', t.tinta, t.fs);
        const xE = X(media());
        linea(svg, s, xE, abajo, xE, arriba - t.fs * 0.3, t.tinta, 1.5, '6 4');
        texto(svg, s, Math.min(Math.max(xE, izq + t.fs * 2), der - t.fs * 2), arriba - t.fs * 0.6, 'E(X)', t.tinta, t.fs);
        lect.textContent = `E(X) = ${numero(media(), 2)} y V(X) = ${numero(varianza(), 2)}.`;
      },
    });
    const caja = controles(ayuda);
    const mover = (fn) => (v) => {
      fn(v);
      repintar();
      guardar();
    };
    const armarControles = () => {
      const [n0, n1, n2] = R.n;
      const [p0, p1, p2] = R.pi;
      const [l0, l1, l2] = R.lam;
      caja.replaceChildren(...(binomial
        ? [
            deslizador({ id: 'n', etq: 'Ensayos, n', min: n0, max: n1, paso: n2, valor: n }, mover((v) => { n = v; })),
            deslizador({ id: 'p', etq: 'Probabilidad de éxito, π', min: p0, max: p1, paso: p2, valor: pi }, mover((v) => { pi = v; })),
          ]
        : [deslizador({ id: 'l', etq: 'Promedio, λ', min: l0, max: l1, paso: l2, valor: lam }, mover((v) => { lam = v; }))]));
    };
    armarControles();
    lienzo.append(lect, caja);
    const titulo = () => (binomial ? `Binomial con n = ${n} y π = ${numero(pi)}` : `Poisson con λ = ${numero(lam)}`);
    return { imagen: () => imagenCon(ayuda, lienzo.querySelector('.pye-lamina svg'), [{ t: titulo(), fuerte: true }, lect.textContent]) };
  });

  // ----- Diagrama de caja: cada tramo deja el 25% de los datos
  // In a person's own summary the box is drawn from the student's own data, with every number of the procedure.
  // Quartiles as the notes define them: the least value that accumulates at least 25%, 50% or 75% of the ordered
  // data; the median of an even n averages the two central ones (Tratamiento de datos, pág. 22).
  const cajaPropia = (figura, cfg, ayuda) => {
    const { crear, svg, numero, lienzo } = ayuda;
    const id = `pyec${cuenta += 1}`;
    const inp = crear('textarea', { id, rows: 3, spellcheck: false, autocomplete: 'off', value: guardado(cfg, 'datos', TOPE_LISTA) ?? EJEMPLO_LISTA, maxLength: TOPE_LISTA });
    inp.style.width = '100%';
    inp.style.boxSizing = 'border-box';
    let bigotes = guardado(cfg, 'bigotes', 10) === 'riq' ? 'riq' : 'extremos';
    const aviso = crear('p', { className: 'w-ayuda', role: 'status' });
    const res = crear('dl', { className: 'w-salidas', 'aria-live': 'polite' });
    const pasos = crear('ol', {});
    let r = null;
    const n2 = (v) => numero(Number(v.toFixed(6)));
    const calcular = () => {
      r = null;
      const v = lista(inp.value);
      if (!v.length) return 'Escribí tus datos, separados por espacios o punto y coma. Se puede usar 3,5.';
      if (v.some((x) => !Number.isFinite(x))) return 'Hay algo que no es un número.';
      if (v.length < 4) return 'Hacen falta al menos 4 datos para armar la caja.';
      const o = [...v].sort((a, b) => a - b);
      const n = o.length;
      const pos = (p) => Math.ceil((p * n) / 100 - 1e-9);
      const q1 = o[pos(25) - 1];
      const q3 = o[pos(75) - 1];
      const me = n % 2 ? o[(n - 1) / 2] : (o[n / 2 - 1] + o[n / 2]) / 2;
      const riq = q3 - q1;
      const bajo = q1 - 1.5 * riq;
      const alto = q3 + 1.5 * riq;
      const conRiq = bigotes === 'riq';
      const bInf = conRiq ? Math.max(o[0], bajo) : o[0];
      const bSup = conRiq ? Math.min(o[n - 1], alto) : o[n - 1];
      const atipicos = conRiq ? o.filter((x) => x < bajo || x > alto) : [];
      const lineas = [
        `Ordenados de menor a mayor: ${o.length > 60 ? `${o.slice(0, 60).map(n2).join('; ')}; …` : o.map(n2).join('; ')}.`,
        `q₁: el 25% de ${n} es ${n2(n * 0.25)}, así que es el dato ${pos(25)}°, el primero que acumula por lo menos el 25%: q₁ = ${n2(q1)}.`,
        n % 2 ? `Mediana: con n = ${n} impar, el dato del medio, el ${(n + 1) / 2}°: ${n2(me)}.` : `Mediana: con n = ${n} par, el promedio del ${n / 2}° y el ${n / 2 + 1}°: (${n2(o[n / 2 - 1])} + ${n2(o[n / 2])}) / 2 = ${n2(me)}.`,
        `q₃: el 75% de ${n} es ${n2(n * 0.75)}, así que es el dato ${pos(75)}°: q₃ = ${n2(q3)}.`,
        `riq = q₃ − q₁ = ${n2(q3)} − ${n2(q1)} = ${n2(riq)}. Rango = ${n2(o[n - 1])} − ${n2(o[0])} = ${n2(o[n - 1] - o[0])}.`,
        conRiq
          ? `Bigotes con la regla de 1,5 riq: abajo, máx{${n2(o[0])}; ${n2(q1)} − 1,5 · ${n2(riq)} = ${n2(bajo)}} = ${n2(bInf)}; arriba, mín{${n2(o[n - 1])}; ${n2(q3)} + 1,5 · ${n2(riq)} = ${n2(alto)}} = ${n2(bSup)}. ${atipicos.length ? `Quedan afuera, como atípicos: ${atipicos.map(n2).join('; ')}.` : 'No queda ningún dato afuera.'}`
          : `Bigotes hasta el mínimo, ${n2(o[0])}, y el máximo, ${n2(o[n - 1])}, como en el apunte.`,
      ];
      r = { o, n, q1, q3, me, riq, bInf, bSup, atipicos, lineas, conRiq };
      return `Son ${n} datos.`;
    };
    const llenar = () => {
      aviso.textContent = calcular();
      res.replaceChildren();
      pasos.replaceChildren();
      if (!r) return;
      res.replaceChildren(...[['Mínimo', r.o[0]], ['q₁', r.q1], ['Mediana', r.me], ['q₃', r.q3], ['Máximo', r.o[r.n - 1]], ['riq', r.riq], ['Largo del bigote inferior', r.q1 - r.bInf], ['Largo del bigote superior', r.bSup - r.q3]].flatMap(([t, v]) => [crear('dt', {}, t), crear('dd', {}, n2(v))]));
      pasos.replaceChildren(...r.lineas.map((t) => crear('li', {}, t)));
    };
    const elegir = elegirDe(ayuda, 'Bigotes', [['extremos', 'Al mínimo y al máximo (apunte)'], ['riq', 'Regla de 1,5 riq']], bigotes, (v) => {
      bigotes = v;
      llenar();
      repintar();
      ayuda.guardarDatos?.({ datos: inp.value, bigotes });
    });
    elegir.querySelector('select').style.maxWidth = '100%';
    lienzo.append(crear('div', { className: 'w-entrada' }, crear('label', { htmlFor: id }, 'Datos'), inp), aviso, elegir);
    llenar();
    const repintar = lamina(ayuda, {
      alto: (W, t) => Math.round(t.fs * (r ? 9 : 1)),
      dibujar: (s, W, H, t) => {
        if (!r) return;
        const izq = t.fs * 2;
        const der = W - t.fs * 2;
        let lo = r.o[0];
        let hi = r.o[r.n - 1];
        if (hi - lo < 1e-12) {
          lo -= 1;
          hi += 1;
        }
        const X = (v) => izq + ((v - lo) / (hi - lo)) * (der - izq);
        const yM = H * 0.4;
        const altoCaja = t.fs * 2.4;
        linea(svg, s, X(r.bInf), yM, X(r.q1), yM, t.tinta, 2);
        linea(svg, s, X(r.q3), yM, X(r.bSup), yM, t.tinta, 2);
        linea(svg, s, X(r.bInf), yM - t.fs * 0.6, X(r.bInf), yM + t.fs * 0.6, t.tinta, 2);
        linea(svg, s, X(r.bSup), yM - t.fs * 0.6, X(r.bSup), yM + t.fs * 0.6, t.tinta, 2);
        s.append(svg('rect', { x: X(r.q1), y: yM - altoCaja / 2, width: Math.max(1, X(r.q3) - X(r.q1)), height: altoCaja, fill: 'none', stroke: t.acento, 'stroke-width': 2 }));
        linea(svg, s, X(r.me), yM - altoCaja / 2, X(r.me), yM + altoCaja / 2, t.acento, 3);
        r.atipicos.forEach((x) => s.append(svg('circle', { cx: X(x), cy: yM, r: t.fs * 0.3, fill: 'none', stroke: t.tinta, 'stroke-width': 1.5 })));
        // The axis with the five numbers, alternating rows so close values do not overlap.
        const yEje = H - t.fs * 3;
        linea(svg, s, izq, yEje, der, yEje, t.suave, 1);
        [[r.bInf, 'bigote'], [r.q1, 'q₁'], [r.me, 'me'], [r.q3, 'q₃'], [r.bSup, 'bigote']].forEach(([v, nom], i) => {
          linea(svg, s, X(v), yEje - 4, X(v), yEje + 4, t.suave, 1);
          texto(svg, s, X(v), yEje + t.fs * 1.25 + (i % 2) * t.fs * 1.15, `${nom} ${n2(v)}`, t.tinta, t.fs * 0.92);
        });
      },
    });
    lienzo.append(res, pasos);
    inp.addEventListener('input', () => {
      llenar();
      repintar();
      ayuda.guardarDatos?.({ datos: inp.value, bigotes });
    });
    const imagen = () => {
      if (!r) return Promise.resolve(null);
      return imagenCon(ayuda, lienzo.querySelector('.pye-lamina svg'), [{ t: `Diagrama de caja de ${r.n} datos`, fuerte: true }, ...r.lineas]);
    };
    return { imagen };
  };

  UTN.interactivo('caja', (figura, cfg, ayuda) => {
    if (enResumenDe(figura, ayuda)) return cajaPropia(figura, cfg, ayuda);
    const { svg, numero, deslizador, lienzo } = ayuda;
    const tramos = [...(cfg.tramos ?? [20, 10, 15, 30])];
    const lect = lectura(ayuda);
    const repintar = lamina(ayuda, {
      alto: (W, t) => Math.round(t.fs * 10),
      dibujar: (s, W, H, t) => {
        const izq = t.fs * 1.5;
        const der = W - t.fs * 1.5;
        const total = tramos[0] + tramos[1] + tramos[2] + tramos[3];
        const X = (v) => izq + v * (der - izq) / 120;
        const c = [0, tramos[0], tramos[0] + tramos[1], tramos[0] + tramos[1] + tramos[2], total];
        const yM = H * 0.46;
        const altoCaja = t.fs * 2.6;
        linea(svg, s, X(c[0]), yM, X(c[1]), yM, t.tinta, 2);
        linea(svg, s, X(c[3]), yM, X(c[4]), yM, t.tinta, 2);
        linea(svg, s, X(c[0]), yM - t.fs * 0.6, X(c[0]), yM + t.fs * 0.6, t.tinta, 2);
        linea(svg, s, X(c[4]), yM - t.fs * 0.6, X(c[4]), yM + t.fs * 0.6, t.tinta, 2);
        s.append(svg('rect', { x: X(c[1]), y: yM - altoCaja / 2, width: X(c[3]) - X(c[1]), height: altoCaja, fill: 'none', stroke: t.acento, 'stroke-width': 2 }));
        linea(svg, s, X(c[2]), yM - altoCaja / 2, X(c[2]), yM + altoCaja / 2, t.acento, 3);
        const nombres = ['mín', 'q1', 'me', 'q3', 'máx'];
        c.forEach((v, i) => texto(svg, s, X(v), yM + altoCaja / 2 + t.fs * 1.4 + (i % 2) * t.fs * 1.2, nombres[i], t.tinta, t.fs));
        for (let i = 0; i < 4; i += 1) {
          texto(svg, s, (X(c[i]) + X(c[i + 1])) / 2, yM - altoCaja / 2 - t.fs * 0.7, '25%', t.suave, t.fs);
        }
        lect.textContent = `Largo de la caja: ${numero(tramos[1] + tramos[2], 0)}. Largo total: ${numero(total, 0)}. Cada tramo sigue dejando el 25% de los datos.`;
      },
    });
    const etiquetas = ['Tramo de mín a q1', 'Tramo de q1 a la mediana', 'Tramo de la mediana a q3', 'Tramo de q3 a máx'];
    lienzo.append(lect, controles(ayuda, ...tramos.map((v, i) => deslizador({ id: `t${i}`, etq: etiquetas[i], min: 2, max: 30, paso: 1, valor: v }, (nuevo) => { tramos[i] = nuevo; repintar(); }))));
  });

  // ----- Teorema central del límite: forma de la suma estandarizada contra la Normal
  const convolucion = (a, b) => {
    const r = new Float64Array(a.length + b.length - 1);
    for (let i = 0; i < a.length; i += 1) for (let j = 0; j < b.length; j += 1) r[i + j] += a[i] * b[j];
    return r;
  };
  const BASES = {
    uniforme: { h: 1 / 40, p: () => new Float64Array(40).fill(1 / 40) },
    exponencial: {
      h: 0.125,
      p: () => {
        const v = new Float64Array(64);
        for (let i = 0; i < 64; i += 1) v[i] = Math.exp(-i * 0.125) - Math.exp(-(i + 1) * 0.125);
        const suma = v.reduce((x, y) => x + y, 0);
        return v.map((x) => x / suma);
      },
    },
  };
  UTN.interactivo('tcl', (figura, cfg, ayuda) => {
    const { svg, deslizador, boton, lienzo, crear } = ayuda;
    let modelo = cfg.modelo ?? 'uniforme';
    let n = cfg.n ?? 6;
    const cache = { uniforme: [], exponencial: [] };
    const suma = () => {
      const lista = cache[modelo];
      if (!lista.length) lista.push(BASES[modelo].p());
      while (lista.length < n) lista.push(convolucion(lista[lista.length - 1], lista[0]));
      return lista[n - 1];
    };
    const lect = lectura(ayuda);
    const repintar = lamina(ayuda, {
      alto: (W, t) => Math.round(t.fs * 17),
      dibujar: (s, W, H, t) => {
        const izq = t.fs * 1.2;
        const der = W - t.fs * 1.2;
        const arriba = t.fs * 1.2;
        const abajo = H - t.fs * 2.6;
        const { h } = BASES[modelo];
        const p = suma();
        let m = 0;
        let v = 0;
        p.forEach((q, i) => { m += q * i * h; });
        p.forEach((q, i) => { v += q * (i * h - m) ** 2; });
        const d = Math.sqrt(v);
        const puntos = [];
        p.forEach((q, i) => {
          const z = (i * h - m) / d;
          if (z >= -4 && z <= 4) puntos.push([z, q / h * d]);
        });
        const primero = puntos[0];
        const ultimo = puntos[puntos.length - 1];
        const tope = Math.max(0.46, ...puntos.map((q) => q[1])) * 1.08;
        const X = (z) => izq + (z + 4) * (der - izq) / 8;
        const Y = (y) => abajo - y * (abajo - arriba) / tope;
        linea(svg, s, izq, abajo, der, abajo, t.suave);
        for (let z = -4; z <= 4; z += 2) texto(svg, s, X(z), abajo + t.fs * 1.2, String(z), t.tinta, t.fs);
        texto(svg, s, (izq + der) / 2, H - t.fs * 0.2, 'Desvíos desde la media de la suma', t.tinta, t.fs);
        const trazo = [[primero[0], 0], ...puntos, [ultimo[0], 0]].map((q) => `${X(q[0]).toFixed(1)},${Y(q[1]).toFixed(1)}`).join(' ');
        s.append(svg('polyline', { points: trazo, fill: 'none', stroke: t.acento, 'stroke-width': 2.4 }));
        const normal = [];
        for (let z = -4; z <= 4.001; z += 0.1) normal.push(`${X(z).toFixed(1)},${Y(Math.exp(-0.5 * z * z) / Math.sqrt(2 * Math.PI)).toFixed(1)}`);
        s.append(svg('polyline', { points: normal.join(' '), fill: 'none', stroke: t.tinta, 'stroke-width': 1.6, 'stroke-dasharray': '6 4' }));
        lect.textContent = `Línea llena: suma de ${n} ${modelo === 'uniforme' ? 'uniformes' : 'exponenciales'}. Línea cortada: Normal.`;
      },
    });
    const elegir = (nombre) => () => { modelo = nombre; repintar(); };
    lienzo.append(
      lect,
      crear('div', { className: 'w-botones' }, boton('Uniforme, simétrica', elegir('uniforme')), boton('Exponencial, asimétrica', elegir('exponencial'))),
      controles(ayuda, deslizador({ id: 'n', etq: 'Cantidad de variables sumadas, n', min: 1, max: 40, paso: 1, valor: n }, (v) => { n = v; repintar(); })),
    );
  });

  // ----- Intervalos de confianza: cuántos cubren a la media, muestra tras muestra
  const azar = (semilla) => {
    let a = semilla >>> 0;
    return () => {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  };
  UTN.interactivo('cobertura', (figura, cfg, ayuda) => {
    const { svg, numero, boton, lienzo, crear } = ayuda;
    const mu = cfg.mu ?? 250;
    const sigma = cfg.sigma ?? 20;
    const n = cfg.n ?? 10;
    const filas = 30;
    const NIVELES = cfg.niveles;
    let nivel = NIVELES[0];
    let semilla = 4;
    const medias = () => {
      const r = azar(semilla);
      const lista = [];
      for (let i = 0; i < filas; i += 1) {
        const z = Math.sqrt(-2 * Math.log(1 - r())) * Math.cos(2 * Math.PI * r());
        lista.push(mu + z * sigma / Math.sqrt(n));
      }
      return lista;
    };
    const lect = lectura(ayuda);
    const repintar = lamina(ayuda, {
      alto: (W, t) => Math.round(filas * 10 + t.fs * 4),
      dibujar: (s, W, H, t) => {
        const izq = t.fs;
        const der = W - t.fs;
        const arriba = t.fs * 1.5;
        const abajo = H - t.fs * 2;
        const paso = (abajo - arriba) / filas;
        const rango = 6 * sigma / Math.sqrt(n);
        const X = (v) => izq + (v - (mu - rango)) * (der - izq) / (2 * rango);
        const e = nivel.z * sigma / Math.sqrt(n);
        let cubren = 0;
        medias().forEach((m, i) => {
          const cubre = m - e < mu && mu < m + e;
          if (cubre) cubren += 1;
          const y = arriba + (i + 0.5) * paso;
          linea(svg, s, X(m - e), y, X(m + e), y, cubre ? t.suave : t.acento, cubre ? 1.5 : 3, cubre ? undefined : '5 3');
          s.append(svg('circle', { cx: X(m), cy: y, r: 2, fill: cubre ? t.suave : t.acento }));
        });
        linea(svg, s, X(mu), arriba - 2, X(mu), abajo, t.tinta, 1.8);
        texto(svg, s, X(mu), arriba - t.fs * 0.4, `μ = ${numero(mu, 0)}`, t.tinta, t.fs);
        linea(svg, s, izq, abajo, der, abajo, t.suave);
        const marca = 15;
        for (let v = mu - 2 * marca; v <= mu + 2 * marca; v += marca) texto(svg, s, X(v), abajo + t.fs * 1.3, String(v), t.tinta, t.fs);
        lect.textContent = `Con ${nivel.etq} de confianza, ${cubren} de ${filas} intervalos cubren a μ. Los que no cubren van con trazo grueso y cortado.`;
      },
    });
    lienzo.append(
      lect,
      crear('div', { className: 'w-botones' },
        boton('Otras 30 muestras', () => { semilla += 1; repintar(); }),
        ...NIVELES.map((x) => boton(x.etq, () => { nivel = x; repintar(); }))),
    );
  });

  // ----- Cuentas para las calculadoras: distribuciones y percentiles
  const lgam = (x) => {
    const c = [76.18009172947146, -86.50532032941677, 24.01409824083091, -1.231739572450155, 0.1208650973866179e-2, -0.5395239384953e-5];
    let y = x;
    let t = x + 5.5;
    t -= (x + 0.5) * Math.log(t);
    let s = 1.000000000190015;
    c.forEach((v) => { y += 1; s += v / y; });
    return -t + Math.log(2.5066282746310005 * s / x);
  };
  const combi = (a, b) => (b < 0 || b > a ? -Infinity : lgam(a + 1) - lgam(b + 1) - lgam(a - b + 1));
  const fiNormal = (x) => {
    const a = Math.abs(x);
    let c = 0;
    if (a <= 37) {
      const e = Math.exp(-a * a / 2);
      if (a < 7.07106781186547) {
        let b = 3.52624965998911e-2 * a + 0.700383064443688;
        b = b * a + 6.37396220353165;
        b = b * a + 33.912866078383;
        b = b * a + 112.079291497871;
        b = b * a + 221.213596169931;
        b = b * a + 220.206867912376;
        c = e * b;
        b = 8.83883476483184e-2 * a + 1.75566716318264;
        b = b * a + 16.064177579207;
        b = b * a + 86.7807322029461;
        b = b * a + 296.564248779674;
        b = b * a + 637.333633378831;
        b = b * a + 793.826512519948;
        b = b * a + 440.413735824752;
        c /= b;
      } else {
        let b = a + 0.65;
        b = a + 4 / b;
        b = a + 3 / b;
        b = a + 2 / b;
        b = a + 1 / b;
        c = e / b / 2.506628274631;
      }
    }
    return x > 0 ? 1 - c : c;
  };
  const gammaInf = (a, x) => {
    if (x <= 0) return 0;
    const pre = Math.exp(-x + a * Math.log(x) - lgam(a));
    if (x < a + 1) {
      let ap = a;
      let del = 1 / a;
      let s = del;
      for (let i = 0; i < 2000; i += 1) {
        ap += 1;
        del *= x / ap;
        s += del;
        if (Math.abs(del) < Math.abs(s) * 1e-15) break;
      }
      return s * pre;
    }
    let b = x + 1 - a;
    let c = 1e300;
    let d = 1 / b;
    let h = d;
    for (let i = 1; i < 2000; i += 1) {
      const an = -i * (i - a);
      b += 2;
      d = an * d + b;
      if (Math.abs(d) < 1e-300) d = 1e-300;
      c = b + an / c;
      if (Math.abs(c) < 1e-300) c = 1e-300;
      d = 1 / d;
      const del = d * c;
      h *= del;
      if (Math.abs(del - 1) < 1e-15) break;
    }
    return 1 - pre * h;
  };
  const betaCf = (a, b, x) => {
    let c = 1;
    let d = 1 - (a + b) * x / (a + 1);
    if (Math.abs(d) < 1e-300) d = 1e-300;
    d = 1 / d;
    let h = d;
    for (let m = 1; m < 2000; m += 1) {
      let aa = m * (b - m) * x / ((a + 2 * m - 1) * (a + 2 * m));
      d = 1 + aa * d;
      if (Math.abs(d) < 1e-300) d = 1e-300;
      c = 1 + aa / c;
      if (Math.abs(c) < 1e-300) c = 1e-300;
      d = 1 / d;
      h *= d * c;
      aa = -(a + m) * (a + b + m) * x / ((a + 2 * m) * (a + 2 * m + 1));
      d = 1 + aa * d;
      if (Math.abs(d) < 1e-300) d = 1e-300;
      c = 1 + aa / c;
      if (Math.abs(c) < 1e-300) c = 1e-300;
      d = 1 / d;
      const del = d * c;
      h *= del;
      if (Math.abs(del - 1) < 1e-15) break;
    }
    return h;
  };
  const betaReg = (a, b, x) => {
    if (x <= 0) return 0;
    if (x >= 1) return 1;
    const pre = Math.exp(lgam(a + b) - lgam(a) - lgam(b) + a * Math.log(x) + b * Math.log(1 - x));
    return x < (a + 1) / (a + b + 2) ? pre * betaCf(a, b, x) / a : 1 - pre * betaCf(b, a, 1 - x) / b;
  };
  const acumT = (g, x) => {
    const cola = betaReg(g / 2, 0.5, g / (g + x * x)) / 2;
    return x > 0 ? 1 - cola : cola;
  };
  const invertir = (F, p, a, b) => {
    let lo = a;
    let hi = b;
    for (let i = 0; i < 200; i += 1) {
      const m = (lo + hi) / 2;
      if (F(m) < p) lo = m;
      else hi = m;
    }
    return (lo + hi) / 2;
  };
  const CAMPO = {
    n: { etq: 'Ensayos, n', ent: true, min: 1 },
    pi: { etq: 'Probabilidad de éxito, π', abierto: [0, 1] },
    k: { etq: 'Valor, k', ent: true, min: 0 },
    N: { etq: 'Tamaño de la población, N', ent: true, min: 1 },
    r: { etq: 'Éxitos en la población, r', ent: true, min: 0 },
    m: { etq: 'Tamaño de la muestra, n', ent: true, min: 1 },
    lam: { etq: 'Parámetro, λ', positivo: true },
    mu: { etq: 'Media, μ' },
    sig: { etq: 'Desvío, σ', positivo: true },
    x: { etq: 'Valor, x' },
    t: { etq: 'Tiempo, t', min: 0 },
    a: { etq: 'Extremo, a' },
    b: { etq: 'Extremo, b' },
    g: { etq: 'Grados de libertad', ent: true, min: 1 },
    p: { etq: 'Probabilidad para el percentil', abierto: [0, 1] },
  };
  const discreta = (pmf, desde, hasta, k, e, v) => {
    let acum = 0;
    for (let i = desde; i <= Math.min(k, hasta); i += 1) acum += pmf(i);
    return [['P(X = k)', pmf(k)], ['P(X ≤ k)', Math.min(1, acum)], ['P(X ≥ k)', Math.min(1, 1 - acum + pmf(k))], ['E(X)', e], ['V(X)', v]];
  };
  const continua = (F, x, p, inv) => [['P(X < x)', F(x)], ['P(X > x)', 1 - F(x)], ['Percentil de esa probabilidad', inv(p)]];
  const MODELOS = {
    binomial: {
      etq: 'Binomial',
      campos: { n: 5, pi: 0.2, k: 2 },
      calc: ({ n, pi, k }) => discreta((i) => (i > n ? 0 : Math.exp(combi(n, i) + i * Math.log(pi) + (n - i) * Math.log(1 - pi))), 0, n, k, n * pi, n * pi * (1 - pi)),
    },
    hipergeometrica: {
      etq: 'Hipergeométrica',
      campos: { N: 20, r: 4, m: 5, k: 1 },
      revisar: ({ N, r, m }) => (r > N || m > N ? 'r y n no pueden pasar a N.' : ''),
      calc: ({ N, r, m, k }) => {
        const pi = r / N;
        const pmf = (i) => (i > Math.min(m, r) || m - i > N - r ? 0 : Math.exp(combi(r, i) + combi(N - r, m - i) - combi(N, m)));
        return discreta(pmf, Math.max(0, m - (N - r)), Math.min(m, r), k, m * pi, N > 1 ? m * pi * (1 - pi) * (N - m) / (N - 1) : 0);
      },
    },
    poisson: {
      etq: 'Poisson',
      campos: { lam: 5, k: 2 },
      calc: ({ lam, k }) => {
        const pmf = (i) => Math.exp(i * Math.log(lam) - lam - lgam(i + 1));
        return discreta(pmf, 0, k, k, lam, lam);
      },
    },
    normal: {
      etq: 'Normal',
      campos: { mu: 10, sig: 1.6, x: 12.05, p: 0.9 },
      calc: ({ mu, sig, x, p }) => [['Valor z', (x - mu) / sig], ...continua((v) => fiNormal((v - mu) / sig), x, p, (q) => mu + sig * invertir(fiNormal, q, -40, 40))],
    },
    exponencial: {
      etq: 'Exponencial',
      campos: { lam: 0.2, t: 4, p: 0.5 },
      calc: ({ lam, t, p }) => [...continua((v) => 1 - Math.exp(-lam * v), t, p, (q) => -Math.log(1 - q) / lam), ['E(T)', 1 / lam], ['V(T)', 1 / (lam * lam)]],
    },
    uniforme: {
      etq: 'Uniforme',
      campos: { a: 1, b: 3, x: 2, p: 0.5 },
      revisar: ({ a, b }) => (a >= b ? 'a tiene que ser menor que b.' : ''),
      calc: ({ a, b, x, p }) => [...continua((v) => Math.min(1, Math.max(0, (v - a) / (b - a))), x, p, (q) => a + q * (b - a)), ['E(X)', (a + b) / 2], ['V(X)', (b - a) ** 2 / 12]],
    },
    student: {
      etq: 't de Student',
      campos: { g: 119, x: 2, p: 0.995 },
      calc: ({ g, x, p }) => continua((v) => acumT(g, v), x, p, (q) => invertir((v) => acumT(g, v), q, -1e5, 1e5)),
    },
    chi: {
      etq: 'Chi-cuadrado',
      campos: { g: 119, x: 100, p: 0.995 },
      revisar: ({ x }) => (x < 0 ? 'x no puede ser negativo.' : ''),
      calc: ({ g, x, p }) => continua((v) => gammaInf(g / 2, v / 2), x, p, (q) => invertir((v) => gammaInf(g / 2, v / 2), q, 0, g + 200 * Math.sqrt(2 * g) + 1000)),
    },
  };
  const leer = (texto) => {
    const v = Number(String(texto).trim().replace(',', '.'));
    return String(texto).trim() === '' ? NaN : v;
  };
  // tope caps what can be typed, only in a summary (its saved data must stay small).
  const uno = (ayuda, id, etq, valor, alCambiar, tope) => {
    const { crear } = ayuda;
    const inp = crear('input', { id, type: 'text', inputMode: 'decimal', autocomplete: 'off', spellcheck: false, value: valor, maxLength: tope });
    inp.addEventListener('input', alCambiar);
    inp.style.width = '100%';
    inp.style.boxSizing = 'border-box';
    return { inp, fila: crear('div', { className: 'w-entrada' }, crear('label', { htmlFor: id }, etq), crear('div', { className: 'w-con-unidad' }, inp)) };
  };
  let cuenta = 0;
  const salidas = (ayuda, cont, filas, dec = 4) => {
    cont.replaceChildren(...filas.flatMap(([etq, v]) => [ayuda.crear('dt', {}, etq), ayuda.crear('dd', {}, ayuda.numero(v, dec))]));
  };
  const TODOS = Object.keys(MODELOS);
  const TOPE_CAMPO = 24;
  UTN.interactivo('probabilidades', (figura, cfg, ayuda) => {
    const { crear, boton, lienzo } = ayuda;
    // In a summary every model is offered, with a select, and the fields come back as the student left them.
    const enResumen = enResumenDe(figura, ayuda);
    const lista = enResumen ? TODOS : cfg.modelos;
    const base = (cuenta += 1);
    const campos = crear('div', { className: 'w-entradas' });
    const error = crear('p', { className: 'w-error', hidden: true });
    const res = crear('dl', { className: 'w-salidas', 'aria-live': 'polite' });
    const previo = guardado(cfg, 'modelo');
    let modelo = lista.includes(previo) ? previo : lista[0];
    let filas = [];
    const guardar = () => {
      if (enResumen) ayuda.guardarDatos?.({ modelo, ...Object.fromEntries(filas.map((f) => [f.clave, f.inp.value])) });
    };
    const escribir = () => {
      calcular();
      guardar();
    };
    const calcular = () => {
      const M = MODELOS[modelo];
      const d = {};
      let msg = '';
      filas.forEach(({ clave, inp }) => {
        const C = CAMPO[clave];
        const v = leer(inp.value);
        d[clave] = v;
        let mal = '';
        if (!Number.isFinite(v)) mal = `${C.etq}: falta un número, escrito como 3,5.`;
        else if (C.ent && !Number.isInteger(v)) mal = `${C.etq}: tiene que ser un entero.`;
        else if (C.min !== undefined && v < C.min) mal = `${C.etq}: tiene que ser ${C.min} o más.`;
        else if (C.positivo && v <= 0) mal = `${C.etq}: tiene que ser mayor que 0.`;
        else if (C.abierto && !(v > C.abierto[0] && v < C.abierto[1])) mal = `${C.etq}: tiene que estar entre 0 y 1, sin incluirlos.`;
        inp.setAttribute('aria-invalid', String(Boolean(mal)));
        if (mal && !msg) msg = mal;
      });
      if (!msg && M.revisar) msg = M.revisar(d);
      error.textContent = msg;
      error.hidden = !msg;
      if (msg) res.replaceChildren();
      else salidas(ayuda, res, M.calc(d));
    };
    // The saved values are used once, for the model the summary had. Another model starts with its example.
    const elegir = (nombre, conGuardados) => {
      modelo = nombre;
      filas = Object.entries(MODELOS[nombre].campos).map(([clave, valor]) => {
        const propio = conGuardados ? guardado(cfg, clave, TOPE_CAMPO) : undefined;
        return { clave, ...uno(ayuda, `pye${base}-${clave}`, CAMPO[clave].etq, propio ?? String(valor).replace('.', ','), escribir, enResumen ? TOPE_CAMPO : undefined) };
      });
      campos.replaceChildren(...filas.map((f) => f.fila));
      calcular();
      botones.forEach((b, i) => b.setAttribute('aria-pressed', String(lista[i] === nombre)));
    };
    const botones = enResumen ? [] : lista.map((n) => boton(MODELOS[n].etq, () => elegir(n)));
    const arriba = enResumen
      ? elegirDe(ayuda, 'Modelo', lista.map((n) => [n, MODELOS[n].etq]), modelo, (n) => {
          elegir(n);
          guardar();
        })
      : crear('div', { className: 'w-botones' }, ...botones);
    lienzo.append(arriba, campos, error, res);
    elegir(modelo, true);
    const imagen = () => tablas(ayuda, [
      { texto: MODELOS[modelo].etq, negrita: true },
      { tabla: filas.map((f) => [CAMPO[f.clave].etq, f.inp.value.trim() || 'sin completar']) },
      error.hidden ? null : { texto: error.textContent },
      { tabla: filasDe(res), resaltar: 1 },
    ]);
    return { imagen };
  });

  // ----- Listas de números escritas por el alumno
  const lista = (texto) => String(texto).split(/[\s;]+/).filter(Boolean).map((v) => Number(v.replace(',', '.')));
  // Up to some 300 numbers in a summary, so the saved piece stays small.
  const TOPE_LISTA = 2000;
  // What a new piece in a summary starts with, so it already shows something.
  const EJEMPLO_LISTA = '12; 15; 15; 17; 18; 20; 21; 23; 25; 31';
  UTN.interactivo('medidas', (figura, cfg, ayuda) => {
    const { crear, lienzo } = ayuda;
    const enResumen = enResumenDe(figura, ayuda);
    const id = `pyed${cuenta += 1}`;
    const inp = crear('textarea', { id, rows: 3, spellcheck: false, autocomplete: 'off', value: guardado(cfg, 'datos', TOPE_LISTA) ?? (enResumen ? EJEMPLO_LISTA : ''), maxLength: enResumen ? TOPE_LISTA : undefined });
    const aviso = crear('p', { className: 'w-ayuda', role: 'status' });
    const res = crear('dl', { className: 'w-salidas', 'aria-live': 'polite' });
    const calcular = () => {
      const v = lista(inp.value);
      res.replaceChildren();
      if (!v.length) { aviso.textContent = 'Escribí tus datos, separados por espacios o punto y coma. Se puede usar 3,5.'; return; }
      if (v.some((x) => !Number.isFinite(x))) { aviso.textContent = 'Hay algo que no es un número.'; return; }
      if (v.length < 2) { aviso.textContent = 'Hacen falta al menos 2 datos.'; return; }
      const orden = [...v].sort((a, b) => a - b);
      const n = v.length;
      const media = v.reduce((a, b) => a + b, 0) / n;
      const s2 = v.reduce((a, b) => a + (b - media) ** 2, 0) / (n - 1);
      const mediana = n % 2 ? orden[(n - 1) / 2] : (orden[n / 2 - 1] + orden[n / 2]) / 2;
      aviso.textContent = `Son ${n} datos.`;
      const filas = [['Media', media], ['Mediana', mediana], ['Varianza muestral, s²', s2], ['Desvío estándar, s', Math.sqrt(s2)], ['Rango', orden[n - 1] - orden[0]]];
      if (media !== 0) filas.push(['Coeficiente de variación', Math.sqrt(s2) / media]);
      salidas(ayuda, res, filas);
    };
    inp.addEventListener('input', () => {
      calcular();
      if (enResumen) ayuda.guardarDatos?.({ datos: inp.value });
    });
    inp.style.width = '100%';
    inp.style.boxSizing = 'border-box';
    lienzo.append(crear('div', { className: 'w-entrada' }, crear('label', { htmlFor: id }, 'Datos'), inp), aviso, res);
    calcular();
    const imagen = () => tablas(ayuda, [
      { texto: `Datos: ${inp.value.trim().replace(/\s+/g, ' ') || 'sin completar'}` },
      { texto: aviso.textContent },
      { tabla: filasDe(res), resaltar: 1 },
    ]);
    return { imagen };
  });
  const TOPE_TABLA = 600;
  UTN.interactivo('tabla-discreta', (figura, cfg, ayuda) => {
    const { crear, lienzo } = ayuda;
    const enResumen = enResumenDe(figura, ayuda);
    const base = (cuenta += 1);
    const aviso = crear('p', { className: 'w-ayuda', role: 'status' });
    const res = crear('dl', { className: 'w-salidas', 'aria-live': 'polite' });
    const calcular = () => {
      const x = lista(cx.inp.value);
      const p = lista(cp.inp.value);
      res.replaceChildren();
      // A summary may start empty: it asks for the data instead of pointing at a mismatch.
      if (enResumen && !x.length && !p.length) { aviso.textContent = 'Escribí los valores de x y sus probabilidades, en el mismo orden. Se puede usar 0,25.'; return; }
      if (!x.length || x.length !== p.length) { aviso.textContent = 'Tiene que haber la misma cantidad de valores que de probabilidades.'; return; }
      if ([...x, ...p].some((v) => !Number.isFinite(v))) { aviso.textContent = 'Hay algo que no es un número.'; return; }
      if (p.some((v) => v < 0)) { aviso.textContent = 'Una probabilidad no puede ser negativa.'; return; }
      const suma = p.reduce((a, b) => a + b, 0);
      const e = x.reduce((a, v, i) => a + v * p[i], 0);
      const va = x.reduce((a, v, i) => a + (v - e) ** 2 * p[i], 0);
      aviso.textContent = Math.abs(suma - 1) > 1e-6 ? `Las probabilidades suman ${ayuda.numero(suma, 4)}: no se cumple la condición de cierre.` : 'Las probabilidades suman 1.';
      salidas(ayuda, res, [['E(X)', e], ['V(X)', va], ['Desvío estándar', Math.sqrt(va)]]);
    };
    const escribir = () => {
      calcular();
      if (enResumen) ayuda.guardarDatos?.({ x: cx.inp.value, p: cp.inp.value });
    };
    const tope = enResumen ? TOPE_TABLA : undefined;
    const inicial = (clave) => guardado(cfg, clave, TOPE_TABLA) ?? (Array.isArray(cfg[clave]) ? cfg[clave] : []).join(' ').replace(/\./g, ',');
    const cx = uno(ayuda, `pyex${base}`, 'Valores de x, separados por espacios', inicial('x'), escribir, tope);
    const cp = uno(ayuda, `pyep${base}`, 'Probabilidades, en el mismo orden', inicial('p'), escribir, tope);
    lienzo.append(crear('div', { className: 'w-entradas' }, cx.fila, cp.fila), aviso, res);
    calcular();
    // The distribution goes as a table of x and P(X = x) while it fits; a long one, as the two lists.
    const imagen = () => {
      const xs = cx.inp.value.trim().split(/[\s;]+/).filter(Boolean);
      const ps = cp.inp.value.trim().split(/[\s;]+/).filter(Boolean);
      const n = Math.max(xs.length, ps.length);
      const entrada = n && n <= 40
        ? [{ cab: ['x', 'P(X = x)'], tabla: Array.from({ length: n }, (_, i) => [xs[i] ?? '', ps[i] ?? '']) }]
        : [{ texto: `Valores de x: ${xs.join(' ') || 'sin completar'}` }, { texto: `Probabilidades: ${ps.join(' ') || 'sin completar'}` }];
      return tablas(ayuda, [...entrada, { texto: aviso.textContent }, { tabla: filasDe(res), resaltar: 1 }]);
    };
    return { imagen };
  });
})();
