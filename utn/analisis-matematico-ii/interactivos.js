// Simulators of Análisis Matemático II. On the subject's pages every field comes from the catedra's notes or from
// Stewart, with no input for a field on purpose: a page cannot be used to work out an exam question. In a person's own
// summary (ayuda.enResumen) the student types the field: see the end of the file.
(() => {
  const CAMPOS = [
    {
      etq: 'F = -y i + x j',
      p: (x, y) => -y,
      q: (x, y) => x,
      nota: 'Apunte «7A», p. 1. Las flechas giran alrededor del origen, y son más largas cuanto más lejos están.',
    },
    {
      etq: 'F = ∇f, con f = x²y³',
      p: (x, y) => 2 * x * y ** 3,
      q: (x, y) => 3 * x ** 2 * y ** 2,
      nota: 'Apunte «7A», p. 2. Es un campo de gradientes: en cada punto, la flecha señala hacia donde $f$ crece más rápido.',
    },
    {
      etq: 'F = (-y i + x j) / (x² + y²)',
      p: (x, y) => -y / (x * x + y * y),
      q: (x, y) => x / (x * x + y * y),
      nota: 'Apunte «19», p. 16. No está definido en el origen. Por eso el dominio tiene un agujero y no es simplemente conexo.',
    },
  ];

  UTN.interactivo('campo', (figura, cfg, ayuda) => {
    if (ayuda.enResumen ?? figura.classList.contains('ag-pieza')) return campoPropio(figura, cfg, ayuda);
    const { crear, svg, lienzo, boton } = ayuda;
    const idTitulo = figura.querySelector('figcaption')?.id;
    const marco = crear('div', { className: 'w-plano' });
    const hoja = svg('svg', { class: 'wg', role: 'img', 'aria-labelledby': idTitulo || undefined });
    marco.append(hoja);
    const nota = crear('p', { className: 'w-nota' });
    let actual = 0;

    const pintar = () => {
      const c = CAMPOS[actual];
      const W = Math.max(280, Math.round(marco.clientWidth || lienzo.clientWidth || 600));
      const H = Math.min(W, 420);
      const m = 14;
      const lado = Math.min(W, H) - 2 * m;
      const cx = W / 2;
      const cy = H / 2;
      const rango = 2.4;
      const aPx = (x, y) => [cx + (x / rango) * (lado / 2), cy - (y / rango) * (lado / 2)];
      hoja.setAttribute('viewBox', `0 0 ${W} ${H}`);
      hoja.replaceChildren();
      const [x0, y0] = aPx(-rango, 0);
      const [x1] = aPx(rango, 0);
      const [, y2] = aPx(0, rango);
      const [, y3] = aPx(0, -rango);
      hoja.append(svg('line', { class: 'wg-red', x1: x0, x2: x1, y1: y0, y2: y0 }));
      hoja.append(svg('line', { class: 'wg-red', x1: cx, x2: cx, y1: y2, y2: y3 }));

      const n = 6;
      const paso = (2 * rango) / (2 * n + 1);
      const puntos = [];
      for (let i = -n; i <= n; i += 1) {
        for (let j = -n; j <= n; j += 1) {
          puntos.push([i * paso, j * paso]);
        }
      }
      const modulos = puntos.map(([x, y]) => Math.hypot(c.p(x, y), c.q(x, y)));
      const tope = Math.max(...modulos) || 1;
      const largoMax = (lado / (2 * n + 1)) * 0.9;
      puntos.forEach(([x, y], k) => {
        const mod = modulos[k];
        if (!(mod > 0)) return;
        // Length grows with the square root of the module, so the small arrows stay visible.
        const largo = largoMax * Math.max(0.25, Math.sqrt(mod / tope));
        const ux = c.p(x, y) / mod;
        const uy = -c.q(x, y) / mod;
        const [ax, ay] = aPx(x, y);
        const bx = ax + ux * largo;
        const by = ay + uy * largo;
        const pu = 5;
        hoja.append(
          svg('line', { class: 'wg-vector wg-s0', x1: ax.toFixed(1), y1: ay.toFixed(1), x2: bx.toFixed(1), y2: by.toFixed(1) }),
          svg('path', {
            class: 'wg-vpunta wg-s0',
            d: `M${bx.toFixed(1)} ${by.toFixed(1)}L${(bx - ux * pu - uy * pu * 0.55).toFixed(1)} ${(by - uy * pu + ux * pu * 0.55).toFixed(1)}L${(bx - ux * pu + uy * pu * 0.55).toFixed(1)} ${(by - uy * pu - ux * pu * 0.55).toFixed(1)}Z`,
          }),
        );
      });
      nota.textContent = `${c.etq}. ${c.nota.replace(/\$/g, '')}`;
    };

    const barra = crear('div', { className: 'w-botones' });
    const botones = CAMPOS.map((c, i) => {
      const b = boton(c.etq, () => {
        actual = i;
        botones.forEach((o, k) => o.setAttribute('aria-pressed', String(k === actual)));
        pintar();
      });
      b.setAttribute('aria-pressed', String(i === 0));
      barra.append(b);
      return b;
    });
    lienzo.append(barra, marco, nota);
    new ResizeObserver(pintar).observe(lienzo);
    ayuda.alCambiar(pintar);
    pintar();
  });

  // ===== In a person's own summary (ayuda.enResumen) the student types P and Q, the window, and a point where the
  // field, its divergence and its rotor are read. cfg.datos is untrusted: only known keys with a string within its
  // cap; formulas go through ayuda.expr only.
  function campoPropio(figura, cfg, ayuda) {
    const { crear, svg, lienzo, numero } = ayuda;
    const d = cfg && cfg.datos && typeof cfg.datos === 'object' && !Array.isArray(cfg.datos) ? cfg.datos : {};
    const g = (k, def, tope = 40) => (Object.prototype.hasOwnProperty.call(d, k) && typeof d[k] === 'string' && d[k].length <= tope ? d[k] : def);
    let n = 0;
    const campo = (etq, valor, tope) => {
      const id = `am2-p${Math.random().toString(36).slice(2, 7)}${(n += 1)}`;
      const inp = crear('input', { id, type: 'text', autocomplete: 'off', spellcheck: false, autocapitalize: 'off', value: valor, maxLength: tope });
      inp.style.width = '100%';
      inp.style.boxSizing = 'border-box';
      return { inp, fila: crear('div', { className: 'w-entrada' }, crear('label', { htmlFor: id }, etq), inp) };
    };
    const cP = campo('P(x, y), lo que acompaña a i', g('p', '-y', 200), 200);
    const cQ = campo('Q(x, y), lo que acompaña a j', g('q', 'x', 200), 200);
    const cX0 = campo('x desde', g('x0', '-2.4'), 40);
    const cX1 = campo('x hasta', g('x1', '2.4'), 40);
    const cY0 = campo('y desde', g('y0', '-2.4'), 40);
    const cY1 = campo('y hasta', g('y1', '2.4'), 40);
    const cA = campo('Punto, x', g('a', '1'), 40);
    const cB = campo('Punto, y', g('b', '1'), 40);
    const nota = crear('p', { className: 'w-ayuda' }, 'F = P i + Q j. Escribí P y Q con x e y, como -y o 2*x*y^3. La multiplicación va con *.');
    const error = crear('p', { className: 'w-error', role: 'status' });
    const idTitulo = figura.querySelector('figcaption')?.id;
    const hoja = svg('svg', { class: 'wg', role: 'img', 'aria-labelledby': idTitulo || undefined });
    const marco = crear('div', { className: 'w-plano' }, hoja);
    const lectura = crear('dl', { className: 'w-salidas' });
    const pie = crear('p', { className: 'w-nota' });
    let corrida = null;
    const formula = (texto, nombre) => {
      const t = String(texto).trim().replace(/−/g, '-').replace(/\bsen(?=\s*\()/g, 'sin').replace(/\btg(?=\s*\()/g, 'tan');
      if (!t) return `Falta ${nombre}.`;
      const mal = ayuda.expr.revisar(t, ['x', 'y']);
      if (mal) return `${nombre}: ${mal}`;
      const f = ayuda.expr.compilar(t, ['x', 'y']);
      return (x, y) => {
        try {
          const v = f({ x, y });
          return Number.isFinite(v) ? v : NaN;
        } catch {
          return NaN;
        }
      };
    };
    const num = (c, nombre) => {
      const t = String(c.inp.value).trim().replace(/−/g, '-');
      if (!t) return `Falta ${nombre}.`;
      try {
        const v = ayuda.expr.evaluar(/^[+-]?\d+,\d+$/.test(t) ? t.replace(',', '.') : t);
        return Number.isFinite(v) ? v : `${nombre} no da un número.`;
      } catch {
        return `${nombre} no es un número. Escribilo como 2,5.`;
      }
    };
    const leer = () => {
      const P = formula(cP.inp.value, 'P');
      if (typeof P === 'string') return { error: P };
      const Q = formula(cQ.inp.value, 'Q');
      if (typeof Q === 'string') return { error: Q };
      const v = {};
      for (const [k, c, nombre] of [['x0', cX0, 'x desde'], ['x1', cX1, 'x hasta'], ['y0', cY0, 'y desde'], ['y1', cY1, 'y hasta'], ['a', cA, 'El x del punto'], ['b', cB, 'El y del punto']]) {
        v[k] = num(c, nombre);
        if (typeof v[k] === 'string') return { error: v[k] };
      }
      if (!(v.x1 > v.x0)) return { error: '«x hasta» tiene que ser mayor que «x desde».' };
      if (!(v.y1 > v.y0)) return { error: '«y hasta» tiene que ser mayor que «y desde».' };
      if (v.x1 - v.x0 > 1e6 || v.y1 - v.y0 > 1e6) return { error: 'La ventana es demasiado grande.' };
      // Derivatives by central differences, so the reading says «aprox.».
      const h = 1e-4 * Math.max(1, Math.abs(v.a), Math.abs(v.b));
      const { a, b } = v;
      const Pa = P(a, b);
      const Qa = Q(a, b);
      const dPx = (P(a + h, b) - P(a - h, b)) / (2 * h);
      const dPy = (P(a, b + h) - P(a, b - h)) / (2 * h);
      const dQx = (Q(a + h, b) - Q(a - h, b)) / (2 * h);
      const dQy = (Q(a, b + h) - Q(a, b - h)) / (2 * h);
      const redondo = (x) => (Number.isFinite(x) ? numero(Number((Math.abs(x) < 1e-6 ? 0 : x).toFixed(4))) : 'no definido');
      const filas = [
        [`F(${numero(a)}; ${numero(b)})`, Number.isFinite(Pa) && Number.isFinite(Qa) ? `${redondo(Pa)} i + ${redondo(Qa)} j` : 'no definido'],
        ['|F| en el punto', redondo(Math.hypot(Pa, Qa))],
        ['div F = ∂P/∂x + ∂Q/∂y, aprox.', redondo(dPx + dQy)],
        ['rot F = ∂Q/∂x − ∂P/∂y, aprox.', redondo(dQx - dPy)],
      ];
      // Over the whole grid: is ∂Q/∂x − ∂P/∂y zero everywhere it is defined?
      let rotMax = 0;
      let huecos = 0;
      for (let i = 0; i <= 12; i += 1) {
        for (let j = 0; j <= 12; j += 1) {
          const x = v.x0 + ((v.x1 - v.x0) * (i + 0.37)) / 13;
          const y = v.y0 + ((v.y1 - v.y0) * (j + 0.41)) / 13;
          const k = 1e-4 * Math.max(1, Math.abs(x), Math.abs(y));
          const r = (Q(x + k, y) - Q(x - k, y)) / (2 * k) - (P(x, y + k) - P(x, y - k)) / (2 * k);
          const esc = Math.max(1, Math.abs(P(x, y)), Math.abs(Q(x, y)));
          if (Number.isFinite(r)) rotMax = Math.max(rotMax, Math.abs(r) / esc);
          else huecos += 1;
        }
      }
      const pieTxt = rotMax < 1e-5
        ? `En toda la ventana, ∂Q/∂x − ∂P/∂y da 0 (aprox.). Si el dominio es simplemente conexo, el campo es conservativo.${huecos ? ' Ojo: en algunos puntos el campo no está definido, así que hay que mirar el dominio.' : ''}`
        : 'En la ventana hay puntos con ∂Q/∂x − ∂P/∂y distinto de 0: el campo no es conservativo.';
      return { P, Q, ...v, filas, pie: pieTxt };
    };
    const pintar = () => {
      hoja.replaceChildren();
      if (!corrida || corrida.error) return;
      const { P, Q, x0, x1, y0, y1, a, b } = corrida;
      const W = Math.max(280, Math.round(marco.clientWidth || lienzo.clientWidth || 600));
      const H = Math.min(W, 420);
      const m = 14;
      const ancho = W - 2 * m;
      const alto = H - 2 * m;
      const k = Math.min(ancho / (x1 - x0), alto / (y1 - y0));
      const ox = m + (ancho - k * (x1 - x0)) / 2;
      const oy = m + (alto - k * (y1 - y0)) / 2;
      const aPx = (x, y) => [ox + (x - x0) * k, oy + (y1 - y) * k];
      hoja.setAttribute('viewBox', `0 0 ${W} ${H}`);
      const [l0, t0] = aPx(x0, y1);
      const [l1, t1] = aPx(x1, y0);
      hoja.append(svg('rect', { x: l0, y: t0, width: l1 - l0, height: t1 - t0, fill: 'none', class: 'wg-red' }));
      if (y0 <= 0 && y1 >= 0) hoja.append(svg('line', { class: 'wg-eje', x1: l0, x2: l1, y1: aPx(0, 0)[1], y2: aPx(0, 0)[1] }));
      if (x0 <= 0 && x1 >= 0) hoja.append(svg('line', { class: 'wg-eje', x1: aPx(0, 0)[0], x2: aPx(0, 0)[0], y1: t0, y2: t1 }));
      const etq = svg('g', { class: 'wg-num' });
      etq.append(
        svg('text', { x: l0 + 3, y: t1 - 4 }, `(${numero(x0)}; ${numero(y0)})`),
        svg('text', { x: l1 - 3, y: t0 + 14, 'text-anchor': 'end' }, `(${numero(x1)}; ${numero(y1)})`),
      );
      const cols = 13;
      const filas = Math.max(5, Math.min(13, Math.round((cols * (y1 - y0)) / (x1 - x0))));
      const puntos = [];
      for (let i = 0; i < cols; i += 1) {
        for (let j = 0; j < filas; j += 1) puntos.push([x0 + ((x1 - x0) * (i + 0.5)) / cols, y0 + ((y1 - y0) * (j + 0.5)) / filas]);
      }
      const vec = puntos.map(([x, y]) => [P(x, y), Q(x, y)]);
      const modulos = vec.map(([p, q]) => Math.hypot(p, q));
      const tope = Math.max(...modulos.filter(Number.isFinite), 0) || 1;
      const largoMax = Math.min(((x1 - x0) * k) / cols, ((y1 - y0) * k) / filas) * 0.9;
      const flecha = (x, y, p, q, largo, clase) => {
        const mod = Math.hypot(p, q);
        const ux = p / mod;
        const uy = -q / mod;
        const [ax, ay] = aPx(x, y);
        const bx = ax + ux * largo;
        const by = ay + uy * largo;
        const pu = 5;
        hoja.append(
          svg('line', { class: `wg-vector ${clase}`, x1: ax.toFixed(1), y1: ay.toFixed(1), x2: bx.toFixed(1), y2: by.toFixed(1) }),
          svg('path', { class: `wg-vpunta ${clase}`, d: `M${bx.toFixed(1)} ${by.toFixed(1)}L${(bx - ux * pu - uy * pu * 0.55).toFixed(1)} ${(by - uy * pu + ux * pu * 0.55).toFixed(1)}L${(bx - ux * pu + uy * pu * 0.55).toFixed(1)} ${(by - uy * pu - ux * pu * 0.55).toFixed(1)}Z` }),
        );
      };
      puntos.forEach(([x, y], i) => {
        const mod = modulos[i];
        if (!(mod > 0) || !Number.isFinite(mod)) return;
        // Length grows with the square root of the module, so the small arrows stay visible.
        flecha(x, y, vec[i][0], vec[i][1], largoMax * Math.max(0.25, Math.sqrt(Math.min(1, mod / tope))), 'wg-s0');
      });
      if (a >= x0 && a <= x1 && b >= y0 && b <= y1) {
        const p = P(a, b);
        const q = Q(a, b);
        const [px, py] = aPx(a, b);
        if (Math.hypot(p, q) > 0 && Number.isFinite(Math.hypot(p, q))) flecha(a, b, p, q, largoMax * 1.3, 'wg-s1');
        hoja.append(svg('circle', { class: 'wg-punto', cx: px, cy: py, r: 4.5 }));
      }
      hoja.append(etq);
    };
    const calcular = () => {
      corrida = leer();
      error.textContent = corrida.error || '';
      error.hidden = !corrida.error;
      for (const el of [marco, lectura, pie]) el.hidden = Boolean(corrida.error);
      if (corrida.error) return;
      lectura.replaceChildren(...corrida.filas.flatMap(([t, v]) => [crear('dt', {}, t), crear('dd', {}, v)]));
      pie.textContent = corrida.pie;
      pintar();
    };
    const todos = [cP, cQ, cX0, cX1, cY0, cY1, cA, cB];
    const cambio = () => {
      calcular();
      ayuda.guardarDatos?.({ p: cP.inp.value, q: cQ.inp.value, x0: cX0.inp.value, x1: cX1.inp.value, y0: cY0.inp.value, y1: cY1.inp.value, a: cA.inp.value, b: cB.inp.value });
    };
    todos.forEach((c) => c.inp.addEventListener('input', cambio));
    new ResizeObserver(pintar).observe(lienzo);
    ayuda.alCambiar(pintar);
    lienzo.append(cP.fila, cQ.fila, nota, crear('div', { className: 'w-entradas' }, cX0.fila, cX1.fila, cY0.fila, cY1.fila, cA.fila, cB.fila), error, marco, lectura, pie);
    calcular();
    const imagen = async () => {
      if (!corrida || corrida.error) return null;
      const urls = [await ayuda.png(hoja), ayuda.pngTablas ? await ayuda.pngTablas([
        { texto: `F = (${cP.inp.value.trim()}) i + (${cQ.inp.value.trim()}) j`, negrita: true },
        { texto: `Ventana: x de ${numero(corrida.x0)} a ${numero(corrida.x1)}, y de ${numero(corrida.y0)} a ${numero(corrida.y1)}. En rojo, F en el punto (${numero(corrida.a)}; ${numero(corrida.b)}).` },
        { tabla: corrida.filas },
        { texto: corrida.pie },
      ]) : null].filter(Boolean);
      const imgs = await Promise.all(urls.map(async (u) => {
        const im = new Image();
        im.src = u;
        await im.decode();
        return im;
      }));
      const c = document.createElement('canvas');
      c.width = Math.max(...imgs.map((im) => im.width));
      c.height = imgs.reduce((s, im) => s + im.height, 0);
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
