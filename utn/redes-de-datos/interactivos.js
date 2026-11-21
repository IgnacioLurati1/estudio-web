// Simulators of Redes de Datos. On the subject's pages every value and example comes from the catedra's material and
// none takes an address or a data set from outside, so a page cannot work out an exam question. In a person's own
// summary (ayuda.enResumen) subred and ventana-tcp take the student's own values: see the end of the file.
(() => {
  const est = (el, estilos) => {
    for (const [k, v] of Object.entries(estilos)) el.style.setProperty(k, v);
    return el;
  };
  const PRENDIDO = { background: 'var(--birome)', color: 'var(--papel)', 'border-color': 'var(--birome)' };
  const APAGADO = { background: '', color: '', 'border-color': '' };

  // A group of buttons where one stays pressed.
  function selector(ayuda, etq, opciones, inicial, alElegir) {
    const { crear, boton } = ayuda;
    const caja = crear('div', { className: 'w-botones', role: 'group', 'aria-label': etq });
    let botones = [];
    const marcar = (v) => {
      botones.forEach((b) => {
        const si = b.dataset.v === String(v);
        b.setAttribute('aria-pressed', String(si));
        est(b, si ? PRENDIDO : APAGADO);
      });
    };
    botones = opciones.map((o) => {
      const b = boton(o.t, () => {
        marcar(o.v);
        alElegir(o.v);
      });
      b.dataset.v = String(o.v);
      caja.append(b);
      return b;
    });
    marcar(inicial);
    const fila = crear('div', {}, est(crear('p', { className: 'w-ayuda' }, etq), { margin: '.5rem 0 .2rem' }), caja);
    return fila;
  }

  const lectura = (ayuda) => est(ayuda.crear('p', { className: 'w-ayuda', role: 'status' }), { color: 'var(--tinta)', 'font-size': '.95rem', 'min-height': '2.8em' });

  function salidas(ayuda, filas) {
    const { crear } = ayuda;
    const dl = crear('dl', { className: 'w-salidas' });
    filas.forEach(([a, b]) => dl.append(crear('dt', {}, a), crear('dd', {}, b)));
    return dl;
  }

  // ----- What each layer adds to the message
  const CAPAS = [
    { t: 'Aplicación', unidad: 'Datos', dir: 'La maneja la aplicación', aparato: 'Hosts', nota: 'Es lo que la aplicación quiere mandar. Lo usual es que no pase de 1460 bytes para entrar en una trama Ethernet.' },
    { t: 'Transporte', unidad: 'Segmento', dir: 'Puerto, 16 bits', aparato: 'Hosts', nota: 'TCP agrega 20 bytes fijos. Trabaja de extremo a extremo.' },
    { t: 'Red', unidad: 'Paquete', dir: 'IP, 32 bits en IPv4', aparato: 'Router', nota: 'IPv4 agrega 20 bytes como mínimo. Trabaja salto a salto.' },
    { t: 'Enlace', unidad: 'Trama', dir: 'MAC, 6 bytes', aparato: 'Switch', nota: 'Ethernet agrega 14 bytes de encabezado y 4 de CRC, sin contar el preámbulo. Trabaja salto a salto.' },
    { t: 'Física', unidad: 'Bit', dir: 'Ninguna', aparato: 'Hub, repetidor', nota: 'No agrega campos. Manda los bits como señal por el medio.' },
  ];
  const PIEZAS = [
    { n: 'Ethernet', tam: '14', capa: 3, peso: 14 },
    { n: 'IP', tam: '20', capa: 2, peso: 14 },
    { n: 'TCP', tam: '20', capa: 1, peso: 14 },
    { n: 'Datos', tam: 'hasta 1460', capa: 0, peso: 40 },
    { n: 'CRC', tam: '4', capa: 3, peso: 10 },
  ];
  UTN.interactivo('capas', (figura, cfg, ayuda) => {
    const { crear, lienzo } = ayuda;
    const barra = est(crear('div', {}), { display: 'flex', gap: '2px', margin: '.6rem 0', 'min-height': '3.6rem' });
    const texto = lectura(ayuda);
    const tabla = crear('div', {});
    const pintar = (k) => {
      barra.replaceChildren();
      PIEZAS.filter((p) => k === 4 || p.capa <= k).forEach((p) => {
        const propia = p.capa === k;
        const caja = crear('div', {}, crear('strong', {}, p.n), crear('br'), `${p.tam} B`);
        est(caja, { flex: `${p.peso} 1 0`, 'min-width': '0', padding: '.3rem .1rem', 'text-align': 'center', font: '500 .78rem/1.25 var(--sans)', 'overflow-wrap': 'anywhere', border: '1px solid var(--borde-control)', ...(propia ? PRENDIDO : {}) });
        barra.append(caja);
      });
      const c = CAPAS[k];
      tabla.replaceChildren(salidas(ayuda, [['Unidad', c.unidad], ['Dirección', c.dir], ['Dónde vive', c.aparato]]));
      texto.textContent = c.nota;
    };
    lienzo.append(selector(ayuda, 'Elegí una capa', CAPAS.map((c, i) => ({ t: c.t, v: i })), 2, (v) => pintar(Number(v))), barra, texto, tabla);
    pintar(2);
  });

  // ----- Frames through a hub or a switch
  const PC = { A: [62, 46], B: [358, 46], C: [62, 214], D: [358, 214] };
  const PUERTO = { A: 1, B: 2, C: 3, D: 4 };
  UTN.interactivo('hub-switch', (figura, cfg, ayuda) => {
    const { crear, svg, boton, lienzo } = ayuda;
    const estado = { modo: 'switch', de: 'A', a: 'C', tabla: {}, llega: [], origen: null };
    const hoja = svg('svg', { class: 'wg', viewBox: '0 0 420 260', role: 'img', 'aria-labelledby': figura.querySelector('figcaption')?.id || undefined });
    const texto = lectura(ayuda);
    const tablaTxt = crear('p', { className: 'w-ayuda' });
    const letra = (x, y, t, peso) => est(svg('text', { x, y, 'text-anchor': 'middle' }, t), { fill: 'var(--tinta)', font: `${peso || 500} 15px var(--sans)` });
    const pintar = () => {
      hoja.replaceChildren();
      const cx = 210;
      const cy = 130;
      Object.entries(PC).forEach(([n, [x, y]]) => {
        const esOrigen = estado.origen === n;
        const recibe = estado.llega.includes(n);
        const esDestino = recibe && n === estado.a;
        const linea = svg('line', { x1: x, y1: y, x2: cx, y2: cy });
        est(linea, esOrigen || esDestino ? { stroke: 'var(--birome)', 'stroke-width': '4' } : recibe ? { stroke: 'var(--mal)', 'stroke-width': '3', 'stroke-dasharray': '7 5' } : { stroke: 'var(--borde-control)', 'stroke-width': '1.5' });
        hoja.append(linea);
      });
      Object.entries(PC).forEach(([n, [x, y]]) => {
        const caja = svg('rect', { x: x - 42, y: y - 20, width: 84, height: 40, rx: 3 });
        est(caja, { fill: 'var(--papel)', stroke: 'var(--tinta)', 'stroke-width': estado.origen === n ? '3' : '1' });
        hoja.append(caja, letra(x, y + 5, `PC ${n}`));
        hoja.append(est(letra(x, y + (y < cy ? -26 : 38), `puerto ${PUERTO[n]}`), { font: '400 13px var(--sans)' }));
      });
      const centro = svg('rect', { x: cx - 48, y: cy - 22, width: 96, height: 44, rx: 3 });
      est(centro, { fill: 'var(--papel)', stroke: 'var(--birome)', 'stroke-width': '2.5' });
      hoja.append(centro, letra(cx, cy + 5, estado.modo === 'hub' ? 'Hub' : 'Switch', 700));
      const lista = Object.entries(estado.tabla).map(([m, p]) => `${m} en el puerto ${p}`);
      tablaTxt.textContent = estado.modo === 'hub' ? 'El hub no tiene tabla. Es un repetidor de capa física.' : `Tabla del switch: ${lista.length ? lista.join(', ') : 'vacía'}.`;
    };
    const limpiar = (msg) => {
      estado.llega = [];
      estado.origen = null;
      texto.textContent = msg;
      pintar();
    };
    const enviar = () => {
      if (estado.de === estado.a) {
        limpiar('Elegí un destino distinto del origen.');
        return;
      }
      const otros = Object.keys(PC).filter((n) => n !== estado.de);
      estado.origen = estado.de;
      if (estado.modo === 'hub') {
        estado.llega = otros;
        texto.textContent = `El hub repite la señal por todos los puertos. La trama llega a ${otros.join(', ')}, y solo ${estado.a} la toma. No mira direcciones.`;
      } else {
        const conocido = estado.tabla[estado.a];
        estado.tabla[estado.de] = PUERTO[estado.de];
        if (conocido) {
          estado.llega = [estado.a];
          texto.textContent = `El switch ya sabe que ${estado.a} está en el puerto ${conocido}, y manda la trama solo por ahí. También anota de dónde vino.`;
        } else {
          estado.llega = otros;
          texto.textContent = `El switch no conoce a ${estado.a}, así que actúa como hub y la manda por todos los puertos. Eso sí, ya anotó que ${estado.de} está en el puerto ${PUERTO[estado.de]}.`;
        }
      }
      pintar();
    };
    const pcs = Object.keys(PC).map((n) => ({ t: n, v: n }));
    const marco = crear('div', { className: 'w-plano' }, hoja);
    lienzo.append(
      marco,
      texto,
      tablaTxt,
      selector(ayuda, 'Aparato', [{ t: 'Switch', v: 'switch' }, { t: 'Hub', v: 'hub' }], estado.modo, (v) => {
        estado.modo = v;
        estado.tabla = {};
        limpiar('Tabla vacía, como recién encendido. Mandá una trama.');
      }),
      selector(ayuda, 'Origen', pcs, estado.de, (v) => {
        estado.de = v;
      }),
      selector(ayuda, 'Destino', pcs, estado.a, (v) => {
        estado.a = v;
      }),
      est(crear('div', { className: 'w-botones' }, boton('Mandar la trama', enviar), boton('Encender de nuevo', () => {
        estado.tabla = {};
        limpiar('Tabla vacía, como recién encendido. Mandá una trama.');
      })), { 'margin-top': '.6rem' }),
    );
    limpiar('Probá de A a C, después de C a A y otra vez de A a C. Mirá cómo se llena la tabla.');
    ayuda.alCambiar(pintar);
  });

  // ----- Count to infinity, line of routers of the catedra's figure
  const INF = Infinity;
  UTN.interactivo('cuenta-infinito', (figura, cfg, ayuda) => {
    const { crear, boton, lienzo } = ayuda;
    const INICIO = { cae: [1, 2, 3, 4], vuelve: [INF, INF, INF, INF] };
    let escena = 'cae';
    let filas = [INICIO.cae];
    const tabla = crear('div', {});
    est(tabla, { 'overflow-x': 'auto' });
    const texto = lectura(ayuda);
    const paso = (v) => {
      const vec = (i) => (i < 0 ? (escena === 'vuelve' ? 0 : INF) : i >= v.length ? INF : v[i]);
      return v.map((_, i) => Math.min(vec(i - 1), vec(i + 1)) + 1);
    };
    const pintar = () => {
      const cab = crear('tr', {}, ...['Intercambio', 'B', 'C', 'D', 'E'].map((t) => crear('th', { scope: 'col' }, t)));
      const cuerpo = filas.map((f, n) => crear('tr', {}, crear('td', {}, n === 0 ? 'Al inicio' : String(n)), ...f.map((x) => crear('td', {}, x === INF ? 'sin ruta' : String(x)))));
      tabla.replaceChildren(crear('table', {}, crear('thead', {}, cab), crear('tbody', {}, ...cuerpo)));
      const u = filas[filas.length - 1];
      if (escena === 'vuelve') {
        texto.textContent = u.every((x) => x !== INF) ? 'Listo. Hicieron falta 4 intercambios en una línea de 4 routers. Las buenas noticias viajan rápido.' : 'A volvió a funcionar. La noticia avanza un router por intercambio.';
      } else {
        texto.textContent = filas.length === 1 ? 'A acaba de salir de servicio. B no le llega directo, pero C le dice que está a 2 saltos.' : filas.length >= 9 ? 'Y sigue. Sin un tope para «infinito» no termina nunca. En la práctica se usa el mayor número de saltos posible más 1.' : 'Nadie sabe que A cayó. Cada uno se apoya en el dato viejo del vecino, y la cuenta sube.';
      }
    };
    lienzo.append(
      selector(ayuda, 'Qué pasa con el router A', [{ t: 'A sale de servicio', v: 'cae' }, { t: 'A vuelve a funcionar', v: 'vuelve' }], escena, (v) => {
        escena = v;
        filas = [INICIO[v]];
        pintar();
      }),
      est(crear('div', { className: 'w-botones' }, boton('Intercambiar tablas', () => {
        if (filas.length < 9 && !(escena === 'vuelve' && filas.length >= 5)) filas.push(paso(filas[filas.length - 1]));
        pintar();
      }), boton('Empezar de nuevo', () => {
        filas = [INICIO[escena]];
        pintar();
      })), { margin: '.5rem 0' }),
      tabla,
      texto,
    );
    pintar();
  });

  // ----- Header explorer: each field is a button that says what it does
  UTN.interactivo('campos', (figura, cfg, ayuda) => {
    const { crear, lienzo, deslizador } = ayuda;
    const texto = lectura(ayuda);
    const botones = [];
    const hoja = crear('div', {});
    (cfg.filas || []).forEach((fila) => {
      const caja = est(crear('div', {}), { display: 'flex', 'flex-wrap': 'wrap', gap: '2px', 'margin-bottom': '2px' });
      fila.forEach((c) => {
        const b = crear('button', { type: 'button', className: 'b-sec b-chico' }, crear('strong', {}, c.n), crear('br'), c.tam);
        est(b, { flex: `${c.b} 1 0`, 'min-width': '2.5rem', padding: '.3rem .1rem', 'white-space': 'normal', 'overflow-wrap': 'anywhere', 'text-align': 'center', 'font-size': '.76rem', 'line-height': '1.2', 'border-radius': '0' });
        b.setAttribute('aria-pressed', 'false');
        b.addEventListener('click', () => {
          botones.forEach((o) => {
            o.setAttribute('aria-pressed', String(o === b));
            est(o, o === b ? PRENDIDO : APAGADO);
          });
          texto.textContent = `${c.n}, ${c.tam}. ${c.t}`;
        });
        botones.push(b);
        caja.append(b);
      });
      hoja.append(caja);
    });
    texto.textContent = 'Tocá un campo para ver qué hace.';
    lienzo.append(hoja, texto);
    if (cfg.ihl) {
      const res = lectura(ayuda);
      const decir = (v) => {
        res.textContent = `IHL = ${v}: el encabezado mide ${v} × 4 = ${v * 4} bytes, con ${(v - 5) * 4} bytes de opciones.`;
      };
      lienzo.append(deslizador({ id: 'ihl', etq: 'Valor del campo IHL', min: 5, max: 15, paso: 1, valor: 5 }, decir), res);
      decir(5);
    }
  });

  // ----- Subnets over the two networks of the catedra's practice
  const REDES = {
    a: { base: '192.168.0', n: 5, nota: 'La práctica toma N = 5 para pedir 20 redes.' },
    b: { base: '192.168.168', n: 3, nota: 'La práctica toma N = 3 para pedir 8 áreas.' },
  };
  UTN.interactivo('subred', (figura, cfg, ayuda) => {
    if (enResumenDe(figura, ayuda)) return subredPropia(figura, cfg, ayuda);
    const { crear, deslizador, lienzo } = ayuda;
    let red = 'b';
    let N = 3;
    const bits = est(crear('p', {}), { font: '500 .92rem/1.5 var(--mono)', margin: '.6rem 0 .2rem', 'overflow-wrap': 'anywhere' });
    const nota = crear('p', { className: 'w-ayuda' });
    const tabla = crear('div', {});
    const pintar = () => {
      const M = 8 - N;
      const salto = 2 ** M;
      const ultimo = 256 - salto;
      const r = REDES[red];
      const sub = est(crear('strong', {}, '1'.repeat(N)), { color: 'var(--mal)', 'text-decoration': 'underline' });
      bits.replaceChildren('11111111.11111111.11111111.', sub, '0'.repeat(M));
      const lista = [];
      for (let i = 0; i < Math.min(4, 2 ** N); i += 1) lista.push(`${r.base}.${i * salto}`);
      tabla.replaceChildren(
        salidas(ayuda, [
          ['Subredes', String(2 ** N)],
          ['Hosts por subred', String(salto - 2)],
          ['Máscara', `255.255.255.${ultimo}`],
          ['Prefijo', `/${24 + N}`],
          ['Salto', String(salto)],
        ]),
        crear('p', { className: 'w-ayuda' }, `Primeras subredes: ${lista.join(', ')}${2 ** N > 4 ? ' y siguen' : ''}.`),
      );
      nota.textContent = `En rojo y subrayado, los N bits para subredes. Los ceros son los M = ${M} bits de host. Subredes = 2^N, hosts = 2^M − 2 y salto = 256 − ${ultimo}. ${r.nota}`;
    };
    lienzo.append(
      selector(ayuda, 'Red de la práctica', [{ t: '192.168.168.0/24', v: 'b' }, { t: '192.168.0.0/24', v: 'a' }], red, (v) => {
        red = v;
        pintar();
      }),
      est(deslizador({ id: 'n', etq: 'Bits para subredes, N', min: 1, max: 6, paso: 1, valor: N }, (v) => {
        N = v;
        pintar();
      }), { 'margin-top': '.5rem' }),
      bits,
      nota,
      tabla,
    );
    pintar();
  });

  // ----- Congestion window with the values of the catedra's figures
  function serie(perdida, reno) {
    const v = [];
    let cw = 1;
    let umbral = 32;
    let perdio = false;
    for (let r = 0; r <= 24; r += 1) {
      v.push(cw);
      if (r === perdida && !perdio) {
        perdio = true;
        umbral = Math.floor(cw / 2);
        cw = reno ? umbral : 1;
      } else {
        cw = cw < umbral ? Math.min(cw * 2, umbral) : cw + 1;
      }
    }
    return v;
  }
  UTN.interactivo('ventana-tcp', (figura, cfg, ayuda) => {
    if (enResumenDe(figura, ayuda)) return ventanaPropia(figura, cfg, ayuda);
    const { crear, svg, deslizador, lienzo, numero } = ayuda;
    let perdida = 13;
    const hoja = svg('svg', { class: 'wg', role: 'img', 'aria-labelledby': figura.querySelector('figcaption')?.id || undefined });
    const marco = crear('div', { className: 'w-plano' }, hoja);
    const texto = lectura(ayuda);
    const pintar = () => {
      const W = Math.max(280, Math.round(marco.clientWidth || lienzo.clientWidth || 600));
      const H = Math.round(Math.min(W * 0.6, 380));
      hoja.setAttribute('viewBox', `0 0 ${W} ${H}`);
      hoja.replaceChildren();
      const m = { i: 40, d: 14, a: 14, b: 40 };
      const sx = (x) => m.i + (x / 24) * (W - m.i - m.d);
      const sy = (y) => H - m.b - (y / 50) * (H - m.a - m.b);
      const red = svg('g', {});
      const num = svg('g', { class: 'wg-num' });
      for (let x = 0; x <= 24; x += W < 420 ? 6 : 4) {
        red.append(svg('line', { class: 'wg-red', x1: sx(x), x2: sx(x), y1: m.a, y2: H - m.b }));
        num.append(svg('text', { x: sx(x), y: H - m.b + 17, 'text-anchor': 'middle' }, numero(x)));
      }
      for (let y = 0; y <= 50; y += 10) {
        red.append(svg('line', { class: 'wg-red', x1: m.i, x2: W - m.d, y1: sy(y), y2: sy(y) }));
        num.append(svg('text', { x: m.i - 6, y: sy(y) + 4, 'text-anchor': 'end' }, numero(y)));
      }
      num.append(svg('text', { x: (m.i + W - m.d) / 2, y: H - 6, 'text-anchor': 'middle' }, 'Rondas de ida y vuelta (RTT)'));
      red.append(svg('line', { class: 'wg-eje', x1: m.i, x2: W - m.d, y1: sy(0), y2: sy(0) }), svg('line', { class: 'wg-eje', x1: m.i, x2: m.i, y1: m.a, y2: H - m.b }));
      hoja.append(red, num);
      const camino = (v) => v.map((y, x) => `${x ? 'L' : 'M'}${sx(x).toFixed(1)} ${sy(y).toFixed(1)}`).join(' ');
      const t = serie(perdida, false);
      const r = serie(perdida, true);
      hoja.append(svg('path', { class: 'wg-curva wg-s1', d: camino(t), fill: 'none' }), svg('path', { class: 'wg-curva wg-s2', d: camino(r), fill: 'none' }));
      num.append(svg('text', { x: sx(24) - 2, y: sy(t[24]) + 30, 'text-anchor': 'end' }, 'Tahoe'), svg('text', { x: sx(24) - 2, y: sy(r[24]) - 12, 'text-anchor': 'end' }, 'Reno'));
      const pico = t[perdida];
      texto.textContent = `En la ronda ${perdida} se pierde un segmento con la ventana en ${pico}. El umbral baja a ${Math.floor(pico / 2)}. Tahoe vuelve a 1 con slow start. Reno sigue desde ${Math.floor(pico / 2)}, sumando de a uno.`;
    };
    new ResizeObserver(pintar).observe(lienzo);
    ayuda.alCambiar(pintar);
    lienzo.append(marco, texto, deslizador({ id: 'perdida', etq: 'Ronda en la que se pierde un segmento', min: 6, max: 20, paso: 1, valor: perdida }, (v) => {
      perdida = v;
      pintar();
    }));
    pintar();
  });

  // ===== In a person's own summary (ayuda.enResumen) subred and ventana-tcp take the student's own values and show
  // every step. The subject's pages keep the catedra's examples above, without free input.
  // cfg.datos is untrusted: only known keys with a string within its cap, read by the parsers below.
  function enResumenDe(figura, ayuda) {
    return ayuda.enResumen ?? figura.classList.contains('ag-pieza');
  }
  function leerDatos(cfg) {
    const d = cfg && cfg.datos && typeof cfg.datos === 'object' && !Array.isArray(cfg.datos) ? cfg.datos : {};
    return (k, def, tope = 40) => (Object.prototype.hasOwnProperty.call(d, k) && typeof d[k] === 'string' && d[k].length <= tope ? d[k] : def);
  }
  let nCampo = 0;
  function campoDe(ayuda, etq, valor, tope) {
    const id = `red-p${(nCampo += 1)}`;
    const inp = ayuda.crear('input', { id, type: 'text', autocomplete: 'off', spellcheck: false, autocapitalize: 'off', value: valor, maxLength: tope });
    inp.style.width = '100%';
    inp.style.boxSizing = 'border-box';
    return { inp, fila: ayuda.crear('div', { className: 'w-entrada' }, ayuda.crear('label', { htmlFor: id }, etq), inp) };
  }
  function elegirDe(ayuda, etq, opciones, actual) {
    const id = `red-p${(nCampo += 1)}`;
    const sel = ayuda.crear('select', { id }, ...opciones.map(([v, t]) => ayuda.crear('option', { value: v, selected: v === actual }, t)));
    sel.style.maxWidth = '100%';
    return { sel, fila: ayuda.crear('div', { className: 'w-fila' }, ayuda.crear('span', { className: 'w-campo' }, ayuda.crear('label', { htmlFor: id }, etq), sel)) };
  }
  /** The picture: the drawing as on screen (if any) and, under it, the texts and tables (ayuda.pngTablas). */
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
  const entero = (t) => (/^\s*\d{1,9}\s*$/.test(String(t)) ? Number(t) : NaN);

  // ----- Subnets of the student's own network: 2^N ≥ C, 2^M − 2 = H, salto = 256 − last decimal of the mask.
  const aTexto = (n) => [24, 16, 8, 0].map((s) => (n >>> s) & 255).join('.');
  const mascaraDe = (p) => (p === 0 ? 0 : (0xffffffff << (32 - p)) >>> 0);
  /** An address as typed, with its prefix (/24) or its mask (255.255.255.0) after it. */
  function leerRed(texto) {
    const t = String(texto).trim();
    const m = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})\s*(?:\/\s*(\d{1,2})|\s+(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3}))$/.exec(t);
    if (!m) return { error: 'Escribí la red con su prefijo, como 192.168.1.0/24, o con su máscara, como 192.168.1.0 255.255.255.0.' };
    const oct = m.slice(1, 5).map(Number);
    if (oct.some((o) => o > 255)) return { error: 'Cada número de la dirección va de 0 a 255.' };
    let p;
    if (m[5] !== undefined) {
      p = Number(m[5]);
      if (p > 30) return { error: 'El prefijo va de 0 a 30: con /31 o /32 no quedan hosts para repartir.' };
    } else {
      const mk = m.slice(6, 10).map(Number);
      if (mk.some((o) => o > 255)) return { error: 'Cada número de la máscara va de 0 a 255.' };
      const v = mk.reduce((a, o) => a * 256 + o, 0);
      p = v.toString(2).padStart(32, '0').indexOf('0');
      if (p < 0) p = 32;
      if (mascaraDe(p) !== v) return { error: 'Esa máscara no es válida: tiene que ser todos unos seguidos y después todos ceros.' };
      if (p > 30) return { error: 'Con esa máscara no quedan hosts para repartir.' };
    }
    const ip = oct.reduce((a, o) => a * 256 + o, 0);
    return { ip, p, red: (ip & mascaraDe(p)) >>> 0 };
  }
  const MAX_SUBREDES_LISTA = 16;
  function subredPropia(figura, cfg, ayuda) {
    const { crear, lienzo } = ayuda;
    const g = leerDatos(cfg);
    const cRed = campoDe(ayuda, 'Red, con su prefijo o su máscara', g('red', '192.168.168.0/24'), 40);
    const pide = elegirDe(ayuda, 'Te piden', [['c', 'Una cantidad de subredes (C)'], ['h', 'Hosts por subred (H)'], ['n', 'Los bits para subredes (N)']], ['c', 'h', 'n'].includes(g('pide')) ? g('pide') : 'c');
    const cCuanto = campoDe(ayuda, 'Cuántas subredes', g('cuanto', '8', 10), 10);
    const error = crear('p', { className: 'w-error', role: 'status' });
    const bits = est(crear('p', {}), { font: '500 .92rem/1.5 var(--mono)', margin: '.6rem 0 .2rem', 'overflow-wrap': 'anywhere' });
    const pasos = crear('ol', {});
    const tabla = crear('div', {});
    const lista = crear('div', { className: 'w-tabla-v' });
    let corrida = null;
    const ETQ = { c: 'Cuántas subredes', h: 'Cuántos hosts por subred', n: 'Cuántos bits, N' };
    const leer = () => {
      const r = leerRed(cRed.inp.value);
      if (r.error) return r;
      const libres = 32 - r.p;
      const k = entero(cCuanto.inp.value);
      if (!Number.isFinite(k)) return { error: `${ETQ[pide.sel.value]}: un número entero.` };
      const lineas = [];
      if (r.red !== r.ip) lineas.push(`${aTexto(r.ip)} no es la dirección de red de /${r.p}: con la máscara queda ${aTexto(r.red)}, y se sigue con esa.`);
      let N;
      let M;
      if (pide.sel.value === 'c') {
        if (k < 1) return { error: 'Tienen que ser 1 o más subredes.' };
        N = Math.ceil(Math.log2(k) - 1e-12);
        if (2 ** N < k) N += 1;
        M = libres - N;
        if (M < 2) return { error: `Para ${k} subredes hacen falta ${N} bits, y la red /${r.p} tiene ${libres} libres: no quedan por lo menos 2 bits de host.` };
        lineas.push(N === 0 ? 'Con C = 1 no hace falta ningún bit: N = 0.' : `2^N ≥ C: con C = ${k}, N = ${N}, porque 2^${N} = ${2 ** N}${N > 0 ? ` y 2^${N - 1} = ${2 ** (N - 1)} no alcanza` : ''}.`);
        lineas.push(`M = 32 − ${r.p} − ${N} = ${M} bits de host. H = 2^${M} − 2 = ${2 ** M - 2} hosts por subred.`);
      } else if (pide.sel.value === 'h') {
        if (k < 1) return { error: 'Tiene que ser 1 host o más.' };
        M = 2;
        while (2 ** M - 2 < k) M += 1;
        N = libres - M;
        if (N < 0) return { error: `Para ${k} hosts hacen falta ${M} bits de host, y la red /${r.p} tiene ${libres} libres.` };
        lineas.push(`2^M − 2 ≥ H: con H = ${k}, M = ${M}, porque 2^${M} − 2 = ${2 ** M - 2}${M > 2 ? ` y 2^${M - 1} − 2 = ${2 ** (M - 1) - 2} no alcanza` : ''}.`);
        lineas.push(`N = 32 − ${r.p} − ${M} = ${N} bits para subredes: 2^${N} = ${2 ** N} subredes.`);
      } else {
        N = k;
        M = libres - N;
        if (M < 2) return { error: `La red /${r.p} tiene ${libres} bits libres: N puede ir de 0 a ${libres - 2}.` };
        lineas.push(`Con N = ${N} bits salen 2^${N} = ${2 ** N} subredes. M = 32 − ${r.p} − ${N} = ${M}: H = 2^${M} − 2 = ${2 ** M - 2} hosts por subred.`);
      }
      const p2 = r.p + N;
      const mk = mascaraDe(p2);
      const octeto = Math.floor((p2 - 1) / 8);
      const ultimo = (mk >>> (24 - 8 * octeto)) & 255;
      const salto = 256 - ultimo;
      lineas.push(`Máscara nueva: /${p2}, ${aTexto(mk)}.`);
      lineas.push(`Salto = 256 − ${ultimo} = ${salto}, en el ${['primer', 'segundo', 'tercer', 'cuarto'][octeto]} número de la dirección.`);
      const tam = 2 ** M;
      const cant = 2 ** N;
      const filas = [];
      const fila = (i) => {
        const base = r.red + i * tam;
        return [String(i + 1), aTexto(base), aTexto(base + 1), aTexto(base + tam - 2), aTexto(base + tam - 1)];
      };
      for (let i = 0; i < Math.min(cant, MAX_SUBREDES_LISTA); i += 1) filas.push(fila(i));
      if (cant > MAX_SUBREDES_LISTA) filas.push(['…', '', '', '', ''], fila(cant - 1));
      return { r, N, M, p2, mk, salto, ultimo, cant, lineas, filas };
    };
    const calcular = () => {
      cCuanto.fila.querySelector('label').textContent = ETQ[pide.sel.value];
      corrida = leer();
      error.textContent = corrida.error || '';
      error.hidden = !corrida.error;
      for (const el of [bits, pasos, tabla, lista]) el.hidden = Boolean(corrida.error);
      if (corrida.error) return;
      const { r, N, M, p2, mk, salto, cant } = corrida;
      const b = mk.toString(2).padStart(32, '0');
      const tramo = (desde, hasta) => b.slice(desde, hasta).replace(/(.{8})(?=.)/g, '$1.');
      const red = tramo(0, r.p);
      const sub = b.slice(r.p, p2);
      const resto = b.slice(p2);
      const conPuntos = (s, desde) => s.split('').map((c, i) => ((desde + i) % 8 === 0 && desde + i > 0 && i > 0 ? `.${c}` : c)).join('');
      const punto = (p, s) => (s && p % 8 === 0 && p > 0 ? '.' : '');
      bits.replaceChildren(red, punto(r.p, sub), est(crear('strong', {}, conPuntos(sub, r.p)), { color: 'var(--mal)', 'text-decoration': 'underline' }), punto(p2, resto), conPuntos(resto, p2));
      pasos.replaceChildren(...corrida.lineas.map((t) => crear('li', {}, t)));
      tabla.replaceChildren(salidas(ayuda, [
        ['Subredes', String(cant)],
        ['Hosts por subred', String(2 ** M - 2)],
        ['Máscara', aTexto(mk)],
        ['Prefijo', `/${p2}`],
        ['Salto', String(salto)],
        ['Bits N y M', `${N} y ${M}`],
      ]));
      lista.replaceChildren(crear('table', {},
        crear('caption', {}, cant > MAX_SUBREDES_LISTA ? `Las primeras ${MAX_SUBREDES_LISTA} subredes y la última` : 'Las subredes'),
        crear('thead', {}, crear('tr', {}, ...CAB.map((c) => crear('th', { scope: 'col' }, c)))),
        crear('tbody', {}, ...corrida.filas.map((f) => crear('tr', {}, ...f.map((c) => crear('td', {}, c)))))));
    };
    const CAB = ['Subred', 'Dirección de red', 'Primera útil', 'Última útil', 'Broadcast'];
    const cambio = () => {
      calcular();
      ayuda.guardarDatos?.({ red: cRed.inp.value, pide: pide.sel.value, cuanto: cCuanto.inp.value });
    };
    cRed.inp.addEventListener('input', cambio);
    cCuanto.inp.addEventListener('input', cambio);
    pide.sel.addEventListener('change', cambio);
    lienzo.append(cRed.fila, crear('div', { className: 'w-entradas' }, pide.fila, cCuanto.fila), error, bits, pasos, tabla, lista);
    calcular();
    const imagen = () => {
      if (!corrida || corrida.error) return Promise.resolve(null);
      const { r, p2, mk } = corrida;
      return apilar(ayuda, null, [
        { texto: `Subredes de ${aTexto(r.red)}/${r.p}`, negrita: true },
        { texto: `Máscara en binario: ${mk.toString(2).padStart(32, '0').replace(/(.{8})(?=.)/g, '$1.')} (los bits ${r.p + 1} a ${p2} son de subred)` },
        ...corrida.lineas.map((t) => ({ texto: t })),
        { cab: CAB, tabla: corrida.filas },
      ]);
    };
    return { imagen };
  }

  // ----- Congestion window with the student's own threshold, start and losses, in Tahoe and in Reno.
  const MAX_RONDAS = 60;
  function ventanaPropia(figura, cfg, ayuda) {
    const { crear, svg, lienzo, numero } = ayuda;
    const g = leerDatos(cfg);
    const cU = campoDe(ayuda, 'Umbral inicial', g('umbral', '32', 6), 6);
    const cI = campoDe(ayuda, 'Ventana inicial', g('inicial', '1', 6), 6);
    const cR = campoDe(ayuda, 'Rondas', g('rondas', '24', 3), 3);
    const cP = campoDe(ayuda, 'Rondas con pérdida, separadas por coma', g('perdidas', '13', 200), 200);
    const ver = elegirDe(ayuda, 'Mostrar', [['ambas', 'Tahoe y Reno'], ['tahoe', 'Solo Tahoe'], ['reno', 'Solo Reno']], ['ambas', 'tahoe', 'reno'].includes(g('ver')) ? g('ver') : 'ambas');
    const error = crear('p', { className: 'w-error', role: 'status' });
    const hoja = svg('svg', { class: 'wg', role: 'img', 'aria-labelledby': figura.querySelector('figcaption')?.id || undefined });
    const marco = crear('div', { className: 'w-plano' }, hoja);
    const texto = lectura(ayuda);
    const tabla = crear('div', { className: 'w-tabla-v' });
    let corrida = null;
    /** One run: the window at the start of every round, and what happens in it. */
    const correr = (umbral0, inicial, rondas, perdidas, reno) => {
      const v = [];
      let cw = inicial;
      let umbral = umbral0;
      for (let r = 0; r <= rondas; r += 1) {
        const fase = perdidas.has(r) ? 'pérdida' : cw < umbral ? 'slow start' : 'aditivo';
        v.push({ cw, umbral, fase });
        if (perdidas.has(r)) {
          umbral = Math.max(1, Math.floor(cw / 2));
          cw = reno ? umbral : 1;
        } else {
          cw = cw < umbral ? Math.min(cw * 2, umbral) : cw + 1;
        }
      }
      return v;
    };
    const leer = () => {
      const umbral = entero(cU.inp.value);
      const inicial = entero(cI.inp.value);
      const rondas = entero(cR.inp.value);
      if (!(umbral >= 1 && umbral <= 100000)) return { error: 'El umbral inicial: un entero de 1 en adelante.' };
      if (!(inicial >= 1 && inicial <= 100000)) return { error: 'La ventana inicial: un entero de 1 en adelante.' };
      if (!(rondas >= 1 && rondas <= MAX_RONDAS)) return { error: `Las rondas: un entero de 1 a ${MAX_RONDAS}.` };
      const partes = cP.inp.value.split(/[\s,;]+/).filter(Boolean);
      const perdidas = new Set();
      for (const p of partes) {
        const n = entero(p);
        if (!Number.isFinite(n)) return { error: `«${p.slice(0, 12)}» no es una ronda: escribí números enteros, como 8, 15.` };
        if (n > rondas) return { error: `La ronda ${n} queda después de la última (${rondas}).` };
        perdidas.add(n);
      }
      const tahoe = correr(umbral, inicial, rondas, perdidas, false);
      const reno = correr(umbral, inicial, rondas, perdidas, true);
      return { umbral, inicial, rondas, perdidas: [...perdidas].sort((a, b) => a - b), tahoe, reno };
    };
    const series = () => (ver.sel.value === 'tahoe' ? [['Tahoe', corrida.tahoe, 1]] : ver.sel.value === 'reno' ? [['Reno', corrida.reno, 2]] : [['Tahoe', corrida.tahoe, 1], ['Reno', corrida.reno, 2]]);
    const pintar = () => {
      hoja.replaceChildren();
      if (!corrida || corrida.error) return;
      const W = Math.max(280, Math.round(marco.clientWidth || lienzo.clientWidth || 600));
      const H = Math.round(Math.min(W * 0.6, 380));
      hoja.setAttribute('viewBox', `0 0 ${W} ${H}`);
      const { rondas } = corrida;
      const tope = Math.max(...series().flatMap(([, s]) => s.map((x) => Math.max(x.cw, x.umbral))));
      const paso = [1, 2, 5, 10, 20, 50, 100, 200, 500, 1000, 2000, 5000, 10000, 20000, 50000].find((k) => k * 6 >= tope) || 100000;
      const yMax = Math.ceil((tope * 1.08) / paso) * paso || paso;
      const m = { i: 46, d: 14, a: 14, b: 40 };
      const sx = (x) => m.i + (x / rondas) * (W - m.i - m.d);
      const sy = (y) => H - m.b - (y / yMax) * (H - m.a - m.b);
      const red = svg('g', {});
      const num = svg('g', { class: 'wg-num' });
      const px = [1, 2, 4, 5, 10, 20].find((k) => rondas / k <= (W < 420 ? 6 : 10)) || 10;
      for (let x = 0; x <= rondas; x += px) {
        red.append(svg('line', { class: 'wg-red', x1: sx(x), x2: sx(x), y1: m.a, y2: H - m.b }));
        num.append(svg('text', { x: sx(x), y: H - m.b + 17, 'text-anchor': 'middle' }, numero(x)));
      }
      for (let y = 0; y <= yMax; y += paso) {
        red.append(svg('line', { class: 'wg-red', x1: m.i, x2: W - m.d, y1: sy(y), y2: sy(y) }));
        num.append(svg('text', { x: m.i - 6, y: sy(y) + 4, 'text-anchor': 'end' }, numero(y)));
      }
      num.append(svg('text', { x: (m.i + W - m.d) / 2, y: H - 6, 'text-anchor': 'middle' }, 'Rondas de ida y vuelta (RTT)'));
      red.append(svg('line', { class: 'wg-eje', x1: m.i, x2: W - m.d, y1: sy(0), y2: sy(0) }), svg('line', { class: 'wg-eje', x1: m.i, x2: m.i, y1: m.a, y2: H - m.b }));
      corrida.perdidas.forEach((r) => red.append(svg('line', { class: 'wg-guia', x1: sx(r), x2: sx(r), y1: m.a, y2: H - m.b })));
      hoja.append(red, num);
      const etqs = svg('g', { class: 'wg-etqs' });
      series().forEach(([nombre, s, k], j) => {
        hoja.append(svg('path', { class: `wg-curva wg-s${k}`, d: s.map((x, i) => `${i ? 'L' : 'M'}${sx(i).toFixed(1)} ${sy(x.cw).toFixed(1)}`).join(' '), fill: 'none' }));
        etqs.append(svg('text', { class: `wg-t${k}`, x: W - 20, y: 30 + j * 20, 'text-anchor': 'end' }, nombre));
      });
      hoja.append(etqs);
    };
    const CAB = () => ['Ronda', ...series().flatMap(([n]) => [`${n}: ventana`, `${n}: umbral`, `${n}: qué pasa`])];
    const filas = () => corrida.tahoe.map((_, r) => [String(r), ...series().flatMap(([, s]) => [String(s[r].cw), String(s[r].umbral), s[r].fase])]);
    const calcular = () => {
      corrida = leer();
      error.textContent = corrida.error || '';
      error.hidden = !corrida.error;
      for (const el of [marco, texto, tabla]) el.hidden = Boolean(corrida.error);
      if (corrida.error) return;
      const { perdidas } = corrida;
      const umbralDe = (cw) => Math.max(1, Math.floor(cw / 2));
      texto.textContent = perdidas.length
        ? perdidas.map((r) => `En la ronda ${r} se pierde un segmento. ${series().map(([nombre, s]) => `${nombre}: la ventana estaba en ${s[r].cw}, el umbral baja a ${umbralDe(s[r].cw)} y la ventana ${nombre === 'Tahoe' ? 'vuelve a 1, con slow start' : `sigue desde ${umbralDe(s[r].cw)}, de a uno`}.`).join(' ')}`).join(' ')
        : 'Sin pérdidas, la ventana se duplica hasta el umbral y después sube de a uno. Tahoe y Reno van juntos.';
      tabla.replaceChildren(crear('table', {},
        crear('thead', {}, crear('tr', {}, ...CAB().map((c) => crear('th', { scope: 'col' }, c)))),
        crear('tbody', {}, ...filas().map((f) => crear('tr', {}, ...f.map((c) => crear('td', {}, c)))))));
      pintar();
    };
    const cambio = () => {
      calcular();
      ayuda.guardarDatos?.({ umbral: cU.inp.value, inicial: cI.inp.value, rondas: cR.inp.value, perdidas: cP.inp.value, ver: ver.sel.value });
    };
    [cU, cI, cR, cP].forEach((c) => c.inp.addEventListener('input', cambio));
    ver.sel.addEventListener('change', cambio);
    new ResizeObserver(pintar).observe(lienzo);
    ayuda.alCambiar(pintar);
    lienzo.append(crear('div', { className: 'w-entradas' }, cU.fila, cI.fila, cR.fila), cP.fila, ver.fila, error, marco, texto, tabla);
    calcular();
    const imagen = () => {
      if (!corrida || corrida.error) return Promise.resolve(null);
      return apilar(ayuda, hoja, [
        { texto: `Ventana de congestión: umbral inicial ${corrida.umbral}, ventana inicial ${corrida.inicial}${corrida.perdidas.length ? `, pérdidas en las rondas ${corrida.perdidas.join(', ')}` : ', sin pérdidas'}`, negrita: true },
        { texto: texto.textContent },
        { cab: CAB(), tabla: filas() },
      ]);
    };
    return { imagen };
  }
})();
