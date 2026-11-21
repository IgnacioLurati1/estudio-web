// Desk checks of Simulación: the single-server queue and the (s,S) inventory, with data the student can change,
// a table per event, step graphs of the areas and a copy for their own summary. Never exam data.
// Queue defaults: Fig 1.7 of the course notes. Inventory: the notes' parameters with our own random numbers.
// The pure part at the top also runs in Node (the scratchpad check scripts require this file).
(() => {
  'use strict';
  const INF = Infinity;
  const r9 = (x) => Math.round(x * 1e9) / 1e9;
  /** Number as the page writes it: dot for decimals, up to `dec` of them, ∞ and a real minus sign. */
  const f = (x, dec = 4) => (x === INF ? '∞' : String(Number((Math.abs(x) < 1e-12 ? 0 : x).toFixed(dec))).replace('-', '−'));
  const f2 = (x) => (Math.abs(x) < 5e-13 ? 0 : x).toFixed(2).replace('-', '−');
  const entre = (x) => (x < 0 ? `(${f(x)})` : f(x));

  /** «0.4», «0,4», «.4», «-3» or «1/6». NaN when it is not a number. */
  const leerNumero = (txt) => {
    const t = String(txt).trim().replace(/−/g, '-');
    const q = /^([+-]?\d+(?:[.,]\d+)?)\s*\/\s*(\d+(?:[.,]\d+)?)$/.exec(t);
    if (q) {
      const d = Number(q[2].replace(',', '.'));
      return d === 0 ? NaN : Number(q[1].replace(',', '.')) / d;
    }
    if (!/^[+-]?(\d+([.,]\d*)?|[.,]\d+)$/.test(t)) return NaN;
    return Number(t.replace(',', '.'));
  };
  /** A list split by spaces, semicolons or commas. «0,4 1,2» reads as decimals; «1,2,3» and «0.4,1.2» as lists. */
  const leerLista = (txt, max) => {
    const fichas = [];
    for (const parte of String(txt).split(/[\s;]+/)) {
      const p = parte.replace(/^,+|,+$/g, '');
      if (!p) continue;
      const comas = (p.match(/,/g) || []).length;
      if (comas && (p.includes('.') || p.includes('/') || comas > 1)) fichas.push(...p.split(',').filter(Boolean));
      else fichas.push(p);
    }
    if (!fichas.length) return { error: 'Falta completar la lista.' };
    if (fichas.length > max) return { error: `Son ${fichas.length} números y el tope es ${max}.` };
    const nums = fichas.map(leerNumero);
    const k = nums.findIndex((v) => !Number.isFinite(v));
    if (k >= 0) return { error: `«${fichas[k]}» no es un número. Escribilo como 0.4 o 1/6.` };
    return { nums };
  };

  // ----- Single-server queue (folios 7 to 13): arrival and departure, FIFO, ends at the n-th delay.
  const textoAreasCola = (dt, q, b) => {
    if (dt === 0) return 'No pasó tiempo desde el evento anterior, así que las áreas no cambian.';
    const gente = q === 0 ? 'nadie en la cola' : `${q} en la cola`;
    return `Pasaron ${f(dt)} con ${gente} y el servidor ${b ? 'ocupado' : 'libre'}: el área bajo Q(t) suma ${f(q * dt)} y la de B(t), ${f(b * dt)}.`;
  };
  /** A: times between arrivals (A1 is the first arrival). S: service times in order of entry. Needs n of each. */
  function simularCola({ A, S, n }) {
    const pasos = [];
    let reloj = 0;
    let B = 0;
    let cola = [];
    let demorados = 0;
    let demoraTotal = 0;
    let areaQ = 0;
    let areaB = 0;
    let llegados = 0;
    let enServicio = 0;
    let iA = 1;
    let iS = 0;
    let proxArribo = r9(A[0]);
    let proxPartida = INF;
    const foto = (evento, texto) => pasos.push({ reloj, evento, proxArribo, proxPartida, B, Q: cola.length, cola: cola.map((x) => x.t), demorados, demoraTotal, areaQ, areaB, texto });
    foto('Inicio', `Inicio. Reloj en 0, sistema vacío y servidor libre. La lista de eventos dice que el primer arribo es en ${f(proxArribo)} y que no hay partida.`);
    while (demorados < n && pasos.length < 500) {
      // On a tie the arrival goes first: the notes' timing routine picks the lowest-numbered event (folio 22), and arrival is 1.
      const esArribo = proxArribo <= proxPartida;
      const t = esArribo ? proxArribo : proxPartida;
      const dt = r9(t - reloj);
      const areas = textoAreasCola(dt, cola.length, B);
      areaQ = r9(areaQ + cola.length * dt);
      areaB = r9(areaB + B * dt);
      reloj = t;
      let texto;
      let evento;
      if (esArribo) {
        llegados += 1;
        evento = `Arribo ${llegados}`;
        let prox;
        if (iA < A.length) {
          proxArribo = r9(t + A[iA]);
          prox = `El próximo arribo es en ${f(t)} + ${f(A[iA])} = ${f(proxArribo)}.`;
          iA += 1;
        } else {
          proxArribo = INF;
          prox = 'No quedan tiempos entre arribos en la lista, así que no se programa otro arribo.';
        }
        if (B) {
          cola.push({ t, c: llegados });
          texto = `Arribo del cliente ${llegados}. ${areas} El servidor está ocupado, así que espera en la cola. ${prox}`;
        } else {
          demorados += 1;
          B = 1;
          enServicio = llegados;
          proxPartida = r9(t + S[iS]);
          texto = `Arribo del cliente ${llegados}. ${areas} El servidor estaba libre, así que su demora es 0 y entra directo. Sale en ${f(t)} + ${f(S[iS])} = ${f(proxPartida)}. ${prox}`;
          iS += 1;
        }
      } else {
        evento = `Partida ${enServicio}`;
        if (!cola.length) {
          texto = `Partida del cliente ${enServicio}. ${areas} No queda nadie: el servidor se libera y la próxima partida vuelve a ∞.`;
          B = 0;
          enServicio = 0;
          proxPartida = INF;
        } else {
          const p = cola[0];
          cola = cola.slice(1);
          const d = r9(t - p.t);
          demorados += 1;
          demoraTotal = r9(demoraTotal + d);
          proxPartida = r9(t + S[iS]);
          texto = `Partida del cliente ${enServicio}. ${areas} Entra el ${p.c}, que llegó en ${f(p.t)}, con demora ${f(t)} − ${f(p.t)} = ${f(d)}. Sale en ${f(t)} + ${f(S[iS])} = ${f(proxPartida)}.`;
          enServicio = p.c;
          iS += 1;
        }
      }
      if (demorados >= n) texto += ` Ya hay ${n} ${n === 1 ? 'demora' : 'demoras'}: se termina la corrida.`;
      foto(evento, texto);
    }
    const T = reloj;
    return { pasos, fin: { n, T, demoraTotal, areaQ, areaB, d: demoraTotal / n, q: areaQ / T, u: areaB / T } };
  }

  // ----- Inventory with an (s,S) policy (folios 21 to 23).
  class FaltanU extends Error {}
  const textoAreasInv = (dt, I) => {
    if (dt === 0) return 'No pasó tiempo desde el evento anterior, así que las áreas no cambian.';
    if (I > 0) return `Pasaron ${f(dt)} con I = ${I}: el área de I⁺ suma ${I} × ${f(dt)} = ${f(I * dt)}.`;
    if (I < 0) return `Pasaron ${f(dt)} con I = ${f(I)}: el área de I⁻ suma ${-I} × ${f(dt)} = ${f(-I * dt)}.`;
    return `Pasaron ${f(dt)} con I = 0: ninguna área cambia.`;
  };
  /**
   * Random numbers are used in this order, as they are needed: one for the first demand time; in each demand,
   * one for its size and one for the time to the next demand; in each order, one for the supplier delay.
   * On a tie the events go as numbered in the notes: order arrival, demand, end, evaluation.
   */
  function simularInventario(d) {
    const { I0, s, S, n, K, i: ci, h, pi, beta, a, b, dec, tamanos, acum, U } = d;
    const red = dec === null ? r9 : (x) => r9(Math.round(x * 10 ** dec) / 10 ** dec);
    const pasos = [];
    let k = 0;
    const tomar = () => {
      if (k >= U.length) throw new FaltanU();
      k += 1;
      return { u: U[k - 1], idx: k };
    };
    let reloj = 0;
    let I = I0;
    let enCamino = 0;
    let areaMas = 0;
    let areaMenos = 0;
    let costo = 0;
    let pedidos = 0;
    let proxArribo = INF;
    let proxDemanda = INF;
    let proxEval = 0;
    const foto = (evento, aleatorios, texto) => pasos.push({ reloj, evento, aleatorios, I, enCamino, proxArribo, proxDemanda, fin: n, proxEval, areaMas, areaMenos, costo, texto });
    const salto = () => {
      const u = tomar();
      return { ...u, dt: red(-beta * Math.log(u.u)) };
    };
    let corte = '';
    try {
      const u = salto();
      proxDemanda = u.dt;
      foto('Inicio', `U${u.idx} = ${f(u.u)} → ${f(u.dt)}`, `Inicio. Reloj en 0, I(0) = ${I0} y nada pedido. La primera evaluación es en 0 y el fin en ${n}. Primera demanda: −${f(beta)}·ln(${f(u.u)}) = ${f(u.dt)}.`);
      for (;;) {
        if (pasos.length > 600) throw new FaltanU();
        const lista = [proxArribo, proxDemanda, n, proxEval];
        let tipo = 0;
        for (let j = 1; j < 4; j += 1) if (lista[j] < lista[tipo]) tipo = j;
        const t = lista[tipo];
        const dt = r9(t - reloj);
        const areas = textoAreasInv(dt, I);
        if (I > 0) areaMas = r9(areaMas + I * dt);
        else if (I < 0) areaMenos = r9(areaMenos - I * dt);
        reloj = t;
        const antes = I;
        if (tipo === 0) {
          I += enCamino;
          const texto = `Llega el pedido de ${enCamino}. ${areas} I pasa de ${f(antes)} a ${f(I)}${antes < 0 ? ': primero se cubre lo que se les debía a los clientes' : ''}.`;
          enCamino = 0;
          proxArribo = INF;
          foto('Llega pedido', '', texto);
        } else if (tipo === 1) {
          const u1 = tomar();
          let j = 0;
          while (j < acum.length - 1 && u1.u >= acum[j]) j += 1;
          I -= tamanos[j];
          const u2 = salto();
          proxDemanda = r9(t + u2.dt);
          const tramo = `[${f(j ? acum[j - 1] : 0)}, ${f(acum[j])})`;
          const deuda = I < 0 ? `, así que se les deben ${-I} a los clientes` : '';
          foto('Demanda', `U${u1.idx} = ${f(u1.u)} → tamaño ${tamanos[j]}; U${u2.idx} = ${f(u2.u)} → ${f(u2.dt)}`, `Demanda. ${areas} U${u1.idx} = ${f(u1.u)} cae en ${tramo}: se llevan ${tamanos[j]}. I pasa de ${f(antes)} a ${f(I)}${deuda}. Próxima demanda: −${f(beta)}·ln(${f(u2.u)}) = ${f(u2.dt)}, en ${f(t)} + ${f(u2.dt)} = ${f(proxDemanda)}.`);
        } else if (tipo === 2) {
          const sinEval = proxEval === n ? ' La evaluación de ese mismo instante no se hace: el fin va antes.' : '';
          foto('Fin', '', `Fin de la simulación a los ${n} ${n === 1 ? 'mes' : 'meses'}. ${areas}${sinEval} Con las áreas y el costo de pedidos salen los costos.`);
          break;
        } else {
          const mes = Math.round(t) + 1;
          let al = '';
          let texto = `Evaluación al principio del mes ${mes}. ${areas} `;
          if (I < s) {
            const Z = S - I;
            const c = K + ci * Z;
            costo = r9(costo + c);
            pedidos += 1;
            enCamino = Z;
            const u = tomar();
            const lag = red(a + u.u * (b - a));
            proxArribo = r9(t + lag);
            al = `U${u.idx} = ${f(u.u)} → ${f(lag)}`;
            texto += `I = ${f(I)} es menor que s = ${s}: se piden Z = ${S} − ${entre(I)} = ${Z}, con costo ${f(K)} + ${f(ci)} × ${Z} = ${f(c)}. Demora ${f(a)} + ${f(u.u)} × (${f(b)} − ${f(a)}) = ${f(lag)}: llega en ${f(proxArribo)}.`;
          } else texto += `I = ${f(I)} no es menor que s = ${s}: no se pide.`;
          proxEval = r9(t + 1);
          foto('Evaluación', al, `${texto} La próxima evaluación es en ${f(proxEval)}.`);
        }
      }
    } catch (e) {
      if (!(e instanceof FaltanU)) throw e;
      corte = k >= U.length
        ? `Se acabaron los ${U.length} números aleatorios antes del mes ${n}. Agregá más a la lista U para llegar al final.`
        : 'La corrida tiene demasiados eventos para esta tabla. Achicá los meses o subí β.';
    }
    const fin = corte ? null : { n, costo, pedidos, areaMas, areaMenos, pedido: costo / n, mant: (h * areaMas) / n, falt: (pi * areaMenos) / n };
    if (fin) fin.total = fin.pedido + fin.mant + fin.falt;
    return { pasos, fin, corte, usados: k };
  }

  const NUCLEO = { leerNumero, leerLista, simularCola, simularInventario, f };
  if (typeof document === 'undefined') {
    module.exports = NUCLEO;
    return;
  }

  // ===== Browser
  const UTN = window.UTN;
  let contador = 0;
  const nuevoId = () => `ps${(contador += 1)}`;
  const pasoLindo = (bruto) => {
    const p = 10 ** Math.floor(Math.log10(bruto));
    const m = bruto / p;
    return (m <= 1 ? 1 : m <= 2 ? 2 : m <= 5 ? 5 : 10) * p;
  };

  // ----- In a person's own summary the piece keeps their data: the summary maker saves it in cfg.datos.
  const enResumenDe = (figura, ayuda) => ayuda.enResumen ?? figura.classList.contains('ag-pieza');
  // Caps keep the saved piece small (the summary maker drops one whose cfg passes 8000 characters of JSON).
  const TOPE = 40;
  const TOPE_JSON = 6000;
  /**
   * cfg.datos comes from the browser's storage, so it is untrusted: each known key takes a string no longer than its cap
   * (or one of its allowed values), anything else gets the default. Also the saved step: 'todo' or an index.
   */
  function datosGuardados(cfg, base, topes, validos = {}) {
    const d = cfg && typeof cfg.datos === 'object' && cfg.datos !== null && !Array.isArray(cfg.datos) ? cfg.datos : {};
    const tiene = (k) => Object.prototype.hasOwnProperty.call(d, k) && typeof d[k] === 'string';
    const ini = {};
    for (const [k, def] of Object.entries(base)) {
      const ok = tiene(k) && (validos[k] ? validos[k].includes(d[k]) : d[k].length <= (topes[k] ?? TOPE));
      ini[k] = ok ? d[k] : def;
    }
    return { ini, paso: tiene('paso') && /^(todo|\d{1,4})$/.test(d.paso) ? d.paso : '' };
  }

  /** A labelled text field with its hint and its error line. `tope` caps its length (only in a summary). */
  function campo(c, { etq, valor, pista, ancho, area, modo = 'decimal', tope }) {
    const id = nuevoId();
    const inp = area
      ? c('textarea', { id, rows: 3, spellcheck: false, autocomplete: 'off', value: valor, maxLength: tope })
      : c('input', { id, type: 'text', inputMode: modo, spellcheck: false, autocomplete: 'off', value: valor, maxLength: tope });
    const err = c('p', { className: 'w-error', id: `${id}e`, hidden: true });
    const ayu = pista ? c('p', { className: 'w-ayuda ps-pista', id: `${id}p` }, pista) : null;
    inp.setAttribute('aria-describedby', pista ? `${id}p ${id}e` : `${id}e`);
    const fila = c('div', { className: ancho ? 'w-entrada ps-ancho' : 'w-entrada' }, c('label', { htmlFor: id }, etq), inp, ayu, err);
    const marcar = (msg) => {
      err.textContent = msg || '';
      err.hidden = !msg;
      inp.setAttribute('aria-invalid', String(Boolean(msg)));
      return !msg;
    };
    return { fila, inp, marcar, valor };
  }
  /** Reads one number of a field, with the checks it needs. Returns null and marks the field when it fails. */
  function numeroDe(cp, { min = -Infinity, max = Infinity, entero = false, mayor } = {}) {
    const mal = (msg) => {
      cp.marcar(msg);
      return null;
    };
    const t = cp.inp.value.trim();
    if (!t) return mal('Falta completar este valor.');
    const v = leerNumero(t);
    if (!Number.isFinite(v)) return mal('Esto no es un número. Escribilo como 0.5.');
    if (entero && !Number.isInteger(v)) return mal('Tiene que ser un número entero.');
    if (mayor !== undefined && !(v > mayor)) return mal(`Tiene que ser mayor que ${f(mayor)}.`);
    if (v < min || v > max) return mal(`Tiene que estar entre ${f(min)} y ${f(max)}.`);
    cp.marcar('');
    return v;
  }

  /** Step graph of one level over time, drawn up to the clock, with its area shaded. */
  function graficoEscalones(ayuda, o) {
    const g = ayuda.svg;
    const W = o.ancho;
    const H = o.alto;
    const L = 40;
    const R = 20;
    const T = 22;
    const B = 26;
    const tMax = o.tMax > 0 ? o.tMax : 1;
    const vMin = o.vMin;
    const vMax = o.vMax > o.vMin ? o.vMax : o.vMin + 1;
    const x = (t) => Number((L + (Math.min(t, tMax) / tMax) * (W - L - R)).toFixed(1));
    const y = (v) => Number((T + ((vMax - v) / (vMax - vMin)) * (H - T - B)).toFixed(1));
    const red = g('g', { class: 'wg-red' });
    const num = g('g', { class: 'wg-num', 'font-size': 12 });
    const pt = pasoLindo(tMax / Math.max(2, Math.floor((W - L - R) / 44)));
    for (let t = 0; t <= tMax + 1e-9; t = r9(t + pt)) {
      red.append(g('line', { x1: x(t), x2: x(t), y1: T, y2: H - B }));
      num.append(g('text', { x: x(t), y: H - B + 16, 'text-anchor': 'middle' }, f(t)));
    }
    const pv = Math.max(1, pasoLindo((vMax - vMin) / Math.max(2, Math.floor((H - T - B) / 28))));
    for (let v = Math.ceil(vMin / pv) * pv; v <= vMax + 1e-9; v += pv) {
      red.append(g('line', { x1: L, x2: W - R, y1: y(v), y2: y(v) }));
      num.append(g('text', { x: L - 6, y: y(v) + 4, 'text-anchor': 'end' }, f(v)));
    }
    const p = o.puntos;
    let mas = '';
    let menos = '';
    let linea = `M${x(p[0].t)} ${y(p[0].v)}`;
    for (let k = 1; k < p.length; k += 1) {
      const v = p[k - 1].v;
      if (v && p[k].t > p[k - 1].t) {
        const caja = `M${x(p[k - 1].t)} ${y(0)}H${x(p[k].t)}V${y(v)}H${x(p[k - 1].t)}Z`;
        if (v > 0) mas += caja;
        else menos += caja;
      }
      linea += `H${x(p[k].t)}V${y(p[k].v)}`;
    }
    const ult = p[p.length - 1];
    const guias = (o.guias || []).flatMap((q) => [
      g('line', { class: 'wg-guia', x1: L, x2: W - R, y1: y(q.v), y2: y(q.v) }),
      g('text', { x: W - R, y: y(q.v) - 4, 'text-anchor': 'end' }, q.etq),
    ]);
    num.append(...guias.filter((e) => e.tagName === 'text'), g('text', { class: 'wg-nom', x: L + 4, y: 14 }, o.nombre), g('text', { class: 'wg-nom', x: W - R + 5, y: y(0) + 4 }, 't'));
    return g('svg', { class: 'wg ps-g', viewBox: `0 0 ${W} ${H}`, width: W, height: H, role: 'img', 'aria-label': o.desc },
      red,
      ...guias.filter((e) => e.tagName === 'line'),
      mas ? g('path', { class: o.claseMas || 'wg-area', d: mas }) : null,
      menos ? g('path', { class: 'wg-area-menos', d: menos }) : null,
      g('line', { class: 'wg-eje', x1: L, x2: W - R, y1: y(0), y2: y(0) }),
      g('line', { class: 'wg-eje', x1: L, x2: L, y1: T, y2: H - B }),
      g('line', { class: 'wg-ahora', x1: x(ult.t), x2: x(ult.t), y1: T, y2: H - B }),
      g('path', { class: 'wg-paso', d: linea }),
      g('circle', { class: 'wg-punto', cx: x(ult.t), cy: y(ult.v), r: 3.5 }),
      num);
  }
  /** Words for a screen reader: the values the level took, the jump at the clock and the area so far. */
  const contarEscalones = (nombre, p, area) => {
    const tramos = [];
    for (let k = 1; k < p.length; k += 1) {
      const prev = tramos[tramos.length - 1];
      if (prev && prev.v === p[k - 1].v) prev.b = p[k].t;
      else if (p[k].t > p[k - 1].t) tramos.push({ v: p[k - 1].v, a: p[k - 1].t, b: p[k].t });
    }
    const ult = p[p.length - 1];
    const dichos = tramos.map((q) => `${f(q.v)} de ${f(q.a)} a ${f(q.b)}`).join(', ');
    return `${nombre} hasta el reloj ${f(ult.t)}: ${dichos ? `vale ${dichos}, y ahora ${f(ult.v)}` : `vale ${f(ult.v)}`}. ${area}.`;
  };

  /** Clipboard text for Sheets and Word: numbers with the reader's own decimal mark and a plain minus. */
  const marcaDecimal = (() => {
    try {
      return new Intl.NumberFormat().formatToParts(1.5).find((x) => x.type === 'decimal')?.value || '.';
    } catch {
      return '.';
    }
  })();
  const celdaCopia = (v) => (/^−?\d+(\.\d+)?$/.test(v) ? v.replace('−', '-').replace('.', marcaDecimal) : v);
  const escHtml = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  async function copiarTabla(titulos, filas, notas) {
    const datos = filas.map((fl) => fl.map(celdaCopia));
    const tsv = [titulos, ...datos].map((fl) => fl.join('\t')).join('\n') + (notas.length ? `\n\n${notas.join('\n')}` : '');
    const html = `<table><thead><tr>${titulos.map((t) => `<th>${escHtml(t)}</th>`).join('')}</tr></thead><tbody>${datos.map((fl) => `<tr>${fl.map((v) => `<td>${escHtml(v)}</td>`).join('')}</tr>`).join('')}</tbody></table>${notas.map((l) => `<p>${escHtml(l)}</p>`).join('')}`;
    if (window.ClipboardItem && navigator.clipboard?.write) {
      try {
        await navigator.clipboard.write([new window.ClipboardItem({ 'text/plain': new Blob([tsv], { type: 'text/plain' }), 'text/html': new Blob([html], { type: 'text/html' }) })]);
        return;
      } catch {
        // Some browsers only take plain text.
      }
    }
    await navigator.clipboard.writeText(tsv);
  }

  /** One picture with the title, the table, the results and the graphs, as they are on screen. */
  async function componerImagen(ayuda, figura, { arriba, titulos, filas, abajo, graficos }) {
    const tabla = figura.querySelector('.ps-tabla');
    const mono = getComputedStyle(tabla).fontFamily;
    const sans = getComputedStyle(figura).fontFamily;
    const tinta = ayuda.color('--tinta');
    const suave = ayuda.color('--tinta-suave');
    const borde = ayuda.color('--borde');
    const linea = ayuda.color('--linea');
    const titulo = figura.querySelector('.w-t')?.textContent || '';
    const imgs = [];
    for (const gr of graficos) {
      const src = await ayuda.png(gr.svg);
      const im = new Image();
      im.src = src;
      await im.decode();
      const caja = gr.svg.getBoundingClientRect();
      imgs.push({ im, w: Math.round(caja.width), h: Math.round(caja.height), t: gr.titulo });
    }
    const med = document.createElement('canvas').getContext('2d');
    const fuenteCab = `600 12px ${sans}`;
    const fuenteCelda = `13px ${mono}`;
    const anchos = titulos.map((t, j) => {
      med.font = fuenteCab;
      let w = med.measureText(t).width;
      med.font = fuenteCelda;
      for (const fl of filas) w = Math.max(w, med.measureText(fl[j]).width);
      return Math.ceil(w) + 16;
    });
    const pad = 20;
    const anchoTabla = anchos.reduce((x, y) => x + y, 0);
    const W = Math.max(anchoTabla, ...imgs.map((x) => x.w), 480) + pad * 2;
    const altoFila = 20;
    const H = pad + 26 + arriba.length * 18 + 8 + 24 + filas.length * altoFila + 12 + abajo.length * 19 + imgs.reduce((s, x) => s + 30 + x.h, 0) + pad;
    const cv = document.createElement('canvas');
    const k = 2;
    cv.width = W * k;
    cv.height = H * k;
    const g = cv.getContext('2d');
    g.scale(k, k);
    g.fillStyle = getComputedStyle(figura).backgroundColor || '#fff';
    if (/rgba\(0, 0, 0, 0\)|transparent/.test(g.fillStyle)) g.fillStyle = '#fff';
    g.fillRect(0, 0, W, H);
    g.textBaseline = 'alphabetic';
    let yy = pad + 16;
    g.fillStyle = tinta;
    g.font = `700 16px ${sans}`;
    g.fillText(titulo, pad, yy);
    yy += 10;
    g.font = `13px ${sans}`;
    g.fillStyle = suave;
    for (const l of arriba) {
      yy += 18;
      g.fillText(l, pad, yy);
    }
    yy += 16;
    let xx = pad;
    g.font = fuenteCab;
    g.fillStyle = tinta;
    titulos.forEach((t, j) => {
      g.fillText(t, xx + 8, yy + 14);
      xx += anchos[j];
    });
    yy += 22;
    g.fillStyle = linea;
    g.fillRect(pad, yy - 2, anchoTabla, 2);
    g.font = fuenteCelda;
    for (const fl of filas) {
      xx = pad;
      g.fillStyle = tinta;
      fl.forEach((v, j) => {
        g.fillText(v, xx + 8, yy + 14);
        xx += anchos[j];
      });
      yy += altoFila;
      g.fillStyle = borde;
      g.fillRect(pad, yy - 1, anchoTabla, 1);
    }
    yy += 6;
    g.font = `500 14px ${sans}`;
    g.fillStyle = tinta;
    for (const l of abajo) {
      yy += 19;
      g.fillText(l, pad, yy);
    }
    for (const x of imgs) {
      yy += 24;
      g.font = `500 13px ${sans}`;
      g.fillStyle = tinta;
      g.fillText(x.t, pad, yy);
      yy += 6;
      g.drawImage(x.im, pad, yy, x.w, x.h);
      yy += x.h;
    }
    return cv.toDataURL('image/png');
  }

  /**
   * What both desk checks share: step buttons, the table, the explanation, the graphs and the export.
   * o.leer() gives the data or null; o.simular(data) the run; o.fila(step) the cells; o.graficos(run, i, width, data).
   * o.valores() gives the fields as typed, saved with the step each time the student changes something.
   */
  function armarPrueba(figura, ayuda, o) {
    const { crear: c, lienzo, boton } = ayuda;
    let corrida = null;
    let datos = null;
    let i = 0;
    let alFinal = false;
    let dibujados = [];
    const explica = c('p', { className: 'ps-explica', role: 'status' });
    const cuerpo = c('tbody', {});
    const tabla = c('table', { className: 'ps-tabla' },
      c('caption', {}, o.caption),
      c('thead', {}, c('tr', {}, ...o.columnas.map((t, j) => c('th', { scope: 'col', className: o.izq?.includes(j) ? 'ps-izq' : '' }, t)))),
      cuerpo);
    const marco = c('div', { className: 'ps-marco', tabIndex: 0, role: 'region', 'aria-label': `${o.caption}. Se desplaza con las flechas.` }, tabla);
    const fin = c('div', { className: 'ps-fin', 'aria-live': 'polite' });
    const grafs = c('div', { className: 'ps-grafs' });
    const avisoExp = c('p', { className: 'w-ayuda ps-aviso-exp', role: 'status' });
    const ancho = () => Math.max(260, Math.round(lienzo.clientWidth || 600));
    const ultimo = () => (corrida ? corrida.pasos.length - 1 : 0);

    const dibujar = () => {
      if (!corrida) {
        grafs.replaceChildren();
        dibujados = [];
        return;
      }
      dibujados = o.graficos(corrida, i, ancho(), datos);
      grafs.replaceChildren(...dibujados.flatMap((d) => [c('p', { className: 'ps-graf-t' }, ...d.cabeza), d.svg]));
    };
    const seguirFila = () => {
      const fila = cuerpo.lastElementChild;
      if (!fila || marco.hidden) return;
      const cab = tabla.tHead.getBoundingClientRect().height;
      const fr = fila.getBoundingClientRect();
      const mr = marco.getBoundingClientRect();
      if (fr.bottom > mr.bottom) marco.scrollTop += fr.bottom - mr.bottom + 2;
      else if (fr.top < mr.top + cab) marco.scrollTop -= mr.top + cab - fr.top;
    };
    const pintar = (extra = '') => {
      if (!corrida) {
        cuerpo.replaceChildren();
        fin.replaceChildren();
        marco.hidden = true;
        explica.textContent = 'Corregí los datos marcados en rojo para ver la corrida.';
        dibujar();
        return;
      }
      marco.hidden = false;
      const u = ultimo();
      cuerpo.replaceChildren(...corrida.pasos.slice(0, i + 1).map((p, k) => {
        const tr = c('tr', { className: k === i ? 'ps-actual' : '' }, ...o.fila(p).map((v, j) => (j === 0 ? c('th', { scope: 'row' }, v) : c('td', { className: `${o.izq?.includes(j) ? 'ps-izq' : ''}${o.ancha === j ? ' ps-ancha' : ''}`.trim() }, v))));
        if (k === i) tr.setAttribute('aria-current', 'step');
        return tr;
      }));
      const corte = i === u && corrida.corte ? ` ${corrida.corte}` : '';
      explica.textContent = `Paso ${i + 1} de ${u + 1}. ${corrida.pasos[i].texto}${corte}${extra}`;
      fin.replaceChildren(...o.resultado(corrida, i === u, datos, i));
      dibujar();
      seguirFila();
    };
    const calcular = () => {
      datos = o.leer();
      corrida = datos ? o.simular(datos) : null;
      if (corrida) i = alFinal ? ultimo() : Math.min(i, ultimo());
      pintar();
    };
    // The summary keeps the fields and the step, so its picture shows the same after a reload.
    const guardar = () => {
      if (!ayuda.guardarDatos) return;
      const d = { ...o.valores(), paso: alFinal ? 'todo' : String(i) };
      if (JSON.stringify(d).length <= TOPE_JSON) ayuda.guardarDatos(d);
    };
    const recalcular = () => {
      calcular();
      guardar();
    };
    /** First draw, at the step a summary saved (clamped by calcular). Saves nothing: the student changed nothing yet. */
    const arrancar = (pasoGuardado) => {
      if (pasoGuardado === 'todo') alFinal = true;
      else if (pasoGuardado) i = Number(pasoGuardado);
      calcular();
    };
    const paso = () => {
      if (!corrida) return;
      if (i < ultimo()) {
        i += 1;
        alFinal = i === ultimo();
        pintar();
        guardar();
      } else pintar(' La corrida ya terminó: con «Empezar de nuevo» la ves desde el principio.');
    };
    const verTodo = () => {
      if (!corrida) return;
      i = ultimo();
      alFinal = true;
      pintar();
      guardar();
    };
    const irAlPrincipio = () => {
      i = 0;
      alFinal = false;
    };
    const empezar = () => {
      irAlPrincipio();
      if (corrida) pintar();
      guardar();
    };
    /** «Volver a los datos del apunte»: the caller already put the fields back. */
    const reiniciar = () => {
      irAlPrincipio();
      recalcular();
    };
    // Copy and picture take each cell in one line.
    const filasHechas = () => corrida.pasos.slice(0, i + 1).map((q) => o.fila(q).map((v) => v.replace(/\n/g, '; ')));
    const copiar = async () => {
      if (!corrida) return;
      try {
        await copiarTabla([...o.columnas, 'Qué pasó'], filasHechas().map((fl, k) => [...fl, corrida.pasos[k].texto]), [...o.datosTexto(datos), ...o.lineasFin(corrida, i === ultimo(), datos)]);
        avisoExp.textContent = `Listo, se copiaron ${i + 1} ${i ? 'filas' : 'fila'}. Pegalas en una planilla o en Word.`;
      } catch {
        avisoExp.textContent = 'Este navegador no dejó copiar. Seleccioná la tabla con el mouse y copiala con Ctrl+C.';
      }
    };
    const imagen = () => componerImagen(ayuda, figura, { arriba: o.datosTexto(datos), titulos: o.columnas, filas: filasHechas(), abajo: o.lineasFin(corrida, i === ultimo(), datos), graficos: dibujados.map((d) => ({ svg: d.svg, titulo: d.cabeza.map((x) => x.textContent ?? x).join('') })) });
    const bajar = async () => {
      if (!corrida) return;
      avisoExp.textContent = 'Preparando la imagen…';
      try {
        const src = await imagen();
        const a = c('a', { href: src, download: o.archivo });
        a.hidden = true;
        document.body.append(a);
        a.click();
        a.remove();
        avisoExp.textContent = `Listo, se bajó ${o.archivo}, con la tabla y los gráficos como están ahora.`;
      } catch (e) {
        console.error('Prueba de escritorio, imagen:', e);
        avisoExp.textContent = 'No se pudo armar la imagen. Probá de nuevo.';
      }
    };
    // Inside a summary the maker's page is the summary itself: no link to it, and it says how the piece leaves.
    const textoExp = o.enResumen
      ? ['La tabla se pega en una planilla o en Word. Cuando bajes el resumen o lo lleves al banco, esta prueba va como una imagen de lo que se ve ahora: tocá «Ver todo» antes si querés la corrida entera.']
      : ['La tabla se pega en una planilla o en Word. La copia y la imagen llevan lo que se ve ahora: tocá «Ver todo» antes si querés la corrida entera. Para tener esta prueba en tu resumen, con los datos de tu ejercicio, sumala con «Sumar un gráfico» en ', c('a', { href: '../crear.html?materia=simulacion' }, 'Armar un resumen'), '.'];
    const piezas = {
      pasos: c('div', { className: 'w-botones ps-pasos' }, boton('Un paso', paso), boton('Ver todo', verTodo), boton('Empezar de nuevo', empezar)),
      explica,
      marco,
      fin,
      grafs,
      exportar: c('div', { className: 'ps-exportar' },
        c('div', { className: 'w-botones' }, boton('Copiar la tabla', copiar), boton('Bajar como imagen', bajar)),
        c('p', { className: 'w-ayuda' }, ...textoExp),
        avisoExp),
    };
    return { piezas, recalcular, reiniciar, arrancar, api: { redibujar: dibujar, imagen: () => (corrida ? imagen() : Promise.resolve(null)) } };
  }

  const puntosDe = (pasos, i, clave) => pasos.slice(0, i + 1).map((p) => ({ t: p.reloj, v: p[clave] }));
  const cabeza = (c, nombre, que, hasta, area) => [c('b', {}, nombre), `, ${que}. Área hasta el reloj ${f(hasta)}: `, c('b', {}, f(area))];

  // ----- The queue
  UTN.interactivo('proximo-evento', (figura, cfg, ayuda) => {
    const { crear: c, lienzo, boton } = ayuda;
    const BASE = { A: '0.4, 1.2, 0.5, 1.7, 0.2, 1.6, 0.2, 1.4, 1.9', S: '2.0, 0.7, 0.2, 1.1, 3.7, 0.6', n: '6' };
    // Up to 60 numbers per list, written with all their decimals.
    const TOPES = { A: 1200, S: 1200 };
    const enResumen = enResumenDe(figura, ayuda);
    const { ini, paso: pasoGuardado } = datosGuardados(cfg, BASE, TOPES);
    const tope = (k) => (enResumen ? TOPES[k] ?? TOPE : undefined);
    const cA = campo(c, { etq: 'Tiempos entre arribos, A', valor: ini.A, tope: tope('A'), ancho: true, modo: 'text', pista: 'A₁ es la hora del primer arribo. Hace falta al menos uno por cada demora.' });
    const cS = campo(c, { etq: 'Tiempos de servicio, S', valor: ini.S, tope: tope('S'), ancho: true, modo: 'text', pista: 'En el orden en que los clientes entran al servidor. Hace falta uno por cada demora.' });
    const cN = campo(c, { etq: 'Terminar con n demoras', valor: ini.n, tope: tope('n'), modo: 'numeric', pista: 'Un entero entre 1 y 30.' });
    const lista = (cp, nombre) => {
      const r = leerLista(cp.inp.value, 60);
      if (r.error) return cp.marcar(r.error) && null;
      if (r.nums.some((v) => v <= 0)) return cp.marcar(`Los tiempos ${nombre} tienen que ser mayores que 0.`) && null;
      cp.marcar('');
      return r.nums;
    };
    const leer = () => {
      const n = numeroDe(cN, { min: 1, max: 30, entero: true });
      const A = lista(cA, 'entre arribos');
      const S = lista(cS, 'de servicio');
      if (n === null || !A || !S) return null;
      let ok = true;
      if (A.length < n) ok = cA.marcar(`Con n = ${n} hacen falta al menos ${n} tiempos entre arribos, y hay ${A.length}.`) && ok;
      if (S.length < n) ok = cS.marcar(`Con n = ${n} hacen falta al menos ${n} tiempos de servicio, y hay ${S.length}.`) && ok;
      return ok ? { A, S, n } : null;
    };
    const p = armarPrueba(figura, ayuda, {
      caption: 'Reloj, lista de eventos, estado y contadores después de cada evento',
      columnas: ['Reloj', 'Evento', 'Próx. arribo', 'Próx. partida', 'Servidor B(t)', 'En cola Q(t)', 'Llegaron en', 'Demorados', 'Demora total', 'Área Q(t)', 'Área B(t)'],
      izq: [1, 6],
      archivo: 'cola-simple.png',
      enResumen,
      valores: () => ({ A: cA.inp.value, S: cS.inp.value, n: cN.inp.value }),
      leer,
      simular: simularCola,
      fila: (q) => [f(q.reloj), q.evento, f(q.proxArribo), f(q.proxPartida), String(q.B), String(q.Q), q.cola.map((t) => f(t)).join(' '), String(q.demorados), f(q.demoraTotal), f(q.areaQ), f(q.areaB)],
      datosTexto: (d) => [`A = ${d.A.map((v) => f(v)).join(', ')}`, `S = ${d.S.map((v) => f(v)).join(', ')}. Termina con n = ${d.n} demoras.`],
      lineasFin: (r, listo) => {
        if (!listo) return [];
        const z = r.fin;
        return [`d̂(${z.n}) = ${f(z.demoraTotal)} / ${z.n} = ${f2(z.d)}`, `q̂(${z.n}) = ${f(z.areaQ)} / ${f(z.T)} = ${f2(z.q)}`, `û(${z.n}) = ${f(z.areaB)} / ${f(z.T)} = ${f2(z.u)}`];
      },
      resultado: (r, listo, d, i) => {
        const z = r.fin;
        if (!listo) {
          const hechas = r.pasos[i].demorados;
          return [c('p', { className: 'w-ayuda' }, `Las estimaciones salen al llegar a ${z.n} demoras (van ${hechas}). Con «Ver todo» vas directo al final.`)];
        }
        const fila = (dt, dd) => [c('dt', {}, dt), c('dd', {}, dd)];
        return [c('dl', { className: 'w-salidas' },
          ...fila(`Demora promedio en cola, d̂(${z.n})`, `${f(z.demoraTotal)} / ${z.n} = ${f2(z.d)}`),
          ...fila(`Número promedio en cola, q̂(${z.n})`, `${f(z.areaQ)} / ${f(z.T)} = ${f2(z.q)}`),
          ...fila(`Utilización del servidor, û(${z.n})`, `${f(z.areaB)} / ${f(z.T)} = ${f2(z.u)}`))];
      },
      graficos: (r, i, w) => {
        const q = r.pasos[i];
        const maxQ = Math.max(1, ...r.pasos.map((x) => x.Q));
        const ptsQ = puntosDe(r.pasos, i, 'Q');
        const ptsB = puntosDe(r.pasos, i, 'B');
        return [
          { cabeza: cabeza(c, 'Q(t)', 'cantidad en la cola', q.reloj, q.areaQ), svg: graficoEscalones(ayuda, { ancho: w, alto: 64 + maxQ * 34, puntos: ptsQ, tMax: r.fin.T, vMin: 0, vMax: maxQ, nombre: 'Q(t)', desc: contarEscalones('Q(t), la cantidad en la cola,', ptsQ, `Área acumulada ${f(q.areaQ)}`) }) },
          { cabeza: cabeza(c, 'B(t)', '1 si el servidor está ocupado', q.reloj, q.areaB), svg: graficoEscalones(ayuda, { ancho: w, alto: 100, puntos: ptsB, tMax: r.fin.T, vMin: 0, vMax: 1, nombre: 'B(t)', desc: contarEscalones('B(t), que vale 1 con el servidor ocupado,', ptsB, `Área acumulada ${f(q.areaB)}`) }) },
        ];
      },
    });
    const volver = () => {
      cA.inp.value = BASE.A;
      cS.inp.value = BASE.S;
      cN.inp.value = BASE.n;
      p.reiniciar();
    };
    [cA, cS, cN].forEach((cp) => cp.inp.addEventListener('input', p.recalcular));
    lienzo.append(
      c('fieldset', { className: 'ps-datos' },
        c('legend', {}, 'Datos de la corrida'),
        c('div', { className: 'w-entradas' }, cA.fila, cS.fila, cN.fila),
        c('p', { className: 'w-ayuda' }, 'Separá los números con comas o espacios, con punto para los decimales, como 0.4. Hasta 60 por lista. Si un arribo y una partida caen a la misma hora, va primero el arribo, como en el apunte.'),
        c('div', { className: 'w-botones ps-volver' }, boton('Volver a los datos del apunte', volver))),
      p.piezas.pasos, p.piezas.explica, p.piezas.marco, p.piezas.fin, p.piezas.grafs, p.piezas.exportar);
    p.arrancar(pasoGuardado);
    return p.api;
  });

  // ----- The inventory
  UTN.interactivo('inventario', (figura, cfg, ayuda) => {
    const { crear: c, lienzo, boton } = ayuda;
    const BASE = {
      I0: '20', s: '20', S: '60', n: '2', K: '32', i: '3', h: '1', pi: '5', beta: '0.1', a: '0.5', b: '1', dec: '3',
      tam: '1 2 3 4', prob: '1/6 1/3 1/3 1/6',
      U: '0.84 0.97 0.1 0.7 0.24 0.07 0.36 0.54 0.19 0.42 0.61 0.69 0.17 0.19 0.61 0.89 0.05 0.52 0.92 0.21 0.4 0.03 0.69 0.07 0.58 0.33 0.76 0.12 0.45 0.88 0.27 0.64 0.09 0.81 0.36 0.53 0.95 0.18 0.72 0.41 0.66 0.04 0.29 0.86 0.15',
    };
    // Up to 100 numbers in U, written with all their decimals; the rest are short.
    const TOPES = { tam: 300, prob: 300, U: 2000 };
    const DECIMALES = ['2', '3', '4', ''];
    const enResumen = enResumenDe(figura, ayuda);
    const { ini, paso: pasoGuardado } = datosGuardados(cfg, BASE, TOPES, { dec: DECIMALES });
    const tope = (k) => (enResumen ? TOPES[k] ?? TOPE : undefined);
    const cs = {
      I0: campo(c, { etq: 'Inventario inicial, I(0)', valor: ini.I0, tope: tope('I0'), modo: 'text' }),
      s: campo(c, { etq: 's, se pide si I < s', valor: ini.s, tope: tope('s'), modo: 'text' }),
      S: campo(c, { etq: 'S, se pide hasta S', valor: ini.S, tope: tope('S'), modo: 'numeric' }),
      n: campo(c, { etq: 'Meses, n', valor: ini.n, tope: tope('n'), modo: 'numeric', pista: 'Entre 1 y 6.' }),
      K: campo(c, { etq: 'K, costo fijo por pedido', valor: ini.K, tope: tope('K') }),
      i: campo(c, { etq: 'i, costo por unidad pedida', valor: ini.i, tope: tope('i') }),
      h: campo(c, { etq: 'h, tener una unidad un mes', valor: ini.h, tope: tope('h') }),
      pi: campo(c, { etq: 'π, deber una unidad un mes', valor: ini.pi, tope: tope('pi') }),
      beta: campo(c, { etq: 'β, media entre demandas (meses)', valor: ini.beta, tope: tope('beta') }),
      a: campo(c, { etq: 'Demora mínima del proveedor, a', valor: ini.a, tope: tope('a') }),
      b: campo(c, { etq: 'Demora máxima del proveedor, b', valor: ini.b, tope: tope('b'), pista: 'Hasta 1 mes, así el pedido llega antes de la evaluación siguiente.' }),
      tam: campo(c, { etq: 'Tamaños posibles de la demanda', valor: ini.tam, tope: tope('tam'), modo: 'text' }),
      prob: campo(c, { etq: 'Probabilidad de cada tamaño', valor: ini.prob, tope: tope('prob'), modo: 'text', pista: 'En el mismo orden. Se puede escribir 1/6 o 0.25.' }),
      U: campo(c, { etq: 'Números aleatorios, U', valor: ini.U, tope: tope('U'), ancho: true, area: true, modo: 'text', pista: 'Se usan en este orden, a medida que hacen falta: el primero da la hora de la primera demanda; en cada demanda, uno da el tamaño y el siguiente el tiempo hasta la próxima; en cada pedido, uno da la demora del proveedor. Entre 0 y 1, sin el 0 ni el 1. Hasta 100.' }),
    };
    const idDec = nuevoId();
    const sDec = c('select', { id: idDec }, ...DECIMALES.map((v) => c('option', { value: v, selected: v === ini.dec }, v || 'Sin redondear')));
    const filaDec = c('div', { className: 'w-entrada' }, c('label', { htmlFor: idDec }, 'Decimales de los tiempos que salen de U'), sDec);
    const leer = () => {
      const d = {};
      d.I0 = numeroDe(cs.I0, { min: -999, max: 999, entero: true });
      d.s = numeroDe(cs.s, { min: -999, max: 999, entero: true });
      d.S = numeroDe(cs.S, { min: -999, max: 999, entero: true });
      d.n = numeroDe(cs.n, { min: 1, max: 6, entero: true });
      d.K = numeroDe(cs.K, { min: 0, max: 1e6 });
      d.i = numeroDe(cs.i, { min: 0, max: 1e6 });
      d.h = numeroDe(cs.h, { min: 0, max: 1e6 });
      d.pi = numeroDe(cs.pi, { min: 0, max: 1e6 });
      d.beta = numeroDe(cs.beta, { mayor: 0, max: 10 });
      d.a = numeroDe(cs.a, { min: 0, max: 1 });
      d.b = numeroDe(cs.b, { min: 0, max: 1 });
      let ok = Object.values(d).every((v) => v !== null);
      if (d.s !== null && d.S !== null && d.S <= d.s) ok = cs.S.marcar('S tiene que ser mayor que s.') && ok;
      if (d.a !== null && d.b !== null && d.b < d.a) ok = cs.b.marcar('b no puede ser menor que a.') && ok;
      const tam = leerLista(cs.tam.inp.value, 10);
      if (tam.error) ok = cs.tam.marcar(tam.error) && ok;
      else if (tam.nums.some((v) => !Number.isInteger(v) || v < 1 || v > 999)) ok = cs.tam.marcar('Los tamaños son unidades: enteros de 1 en adelante.') && ok;
      else cs.tam.marcar('');
      const pr = leerLista(cs.prob.inp.value, 10);
      if (pr.error) ok = cs.prob.marcar(pr.error) && ok;
      else if (pr.nums.some((v) => !(v > 0 && v <= 1))) ok = cs.prob.marcar('Cada probabilidad va entre 0 y 1.') && ok;
      else if (!tam.error && pr.nums.length !== tam.nums.length) ok = cs.prob.marcar(`Hay ${tam.nums.length} tamaños y ${pr.nums.length} probabilidades: tiene que haber una por tamaño.`) && ok;
      else if (Math.abs(pr.nums.reduce((x, y) => x + y, 0) - 1) > 1e-6) ok = cs.prob.marcar(`Las probabilidades tienen que sumar 1, y suman ${f(pr.nums.reduce((x, y) => x + y, 0))}.`) && ok;
      else cs.prob.marcar('');
      const U = leerLista(cs.U.inp.value, 100);
      if (U.error) ok = cs.U.marcar(U.error) && ok;
      else if (U.nums.some((v) => !(v > 0 && v < 1))) ok = cs.U.marcar('Cada U va entre 0 y 1, sin el 0 ni el 1.') && ok;
      else cs.U.marcar('');
      if (!ok) return null;
      let suma = 0;
      d.acum = pr.nums.map((v) => {
        suma += v;
        return Math.round(suma * 1e12) / 1e12;
      });
      d.acum[d.acum.length - 1] = 1;
      d.tamanos = tam.nums;
      d.probs = pr.nums;
      d.U = U.nums;
      d.dec = sDec.value === '' ? null : Number(sDec.value);
      return d;
    };
    const resumen = c('p', { className: 'ps-resumen' });
    const datosTexto = (d) => (d ? [`I(0) = ${d.I0}, (s, S) = (${d.s}, ${d.S}), n = ${d.n} ${d.n === 1 ? 'mes' : 'meses'}. K = ${f(d.K)}, i = ${f(d.i)}, h = ${f(d.h)}, π = ${f(d.pi)}.`, `β = ${f(d.beta)}, demanda ${d.tamanos.join(', ')} con probabilidades ${cs.prob.inp.value.trim()}, demora entre ${f(d.a)} y ${f(d.b)}. ${d.U.length} números U.`] : []);
    const p = armarPrueba(figura, ayuda, {
      caption: 'Reloj, evento, aleatorios usados, nivel, lista de eventos, áreas y costo de pedidos después de cada evento',
      columnas: ['Reloj', 'Evento', 'Aleatorios usados', 'I(t)', 'En camino', 'Llegada de pedido', 'Próx. demanda', 'Fin', 'Próx. evaluación', 'Área I⁺', 'Área I⁻', 'Costo de pedidos'],
      izq: [1, 2],
      ancha: 2,
      archivo: 'inventario.png',
      enResumen,
      valores: () => ({ ...Object.fromEntries(Object.entries(cs).map(([k, cp]) => [k, cp.inp.value])), dec: sDec.value }),
      leer: () => {
        const d = leer();
        resumen.textContent = d ? datosTexto(d).join(' ') : '';
        return d;
      },
      simular: simularInventario,
      fila: (q) => [f(q.reloj), q.evento, q.aleatorios.replace(/; /g, '\n'), f(q.I), String(q.enCamino), f(q.proxArribo), f(q.proxDemanda), f(q.fin), f(q.proxEval), f(q.areaMas), f(q.areaMenos), f(q.costo)],
      datosTexto,
      lineasFin: (r, listo, d) => {
        if (!listo || !r.fin) return [];
        const z = r.fin;
        return [`Pedido promedio por mes: ${f(z.costo)} / ${z.n} = ${f2(z.pedido)}`, `Mantenimiento, h·Ī⁺: ${f(d.h)} × ${f(z.areaMas)} / ${z.n} = ${f2(z.mant)}`, `Faltante, π·Ī⁻: ${f(d.pi)} × ${f(z.areaMenos)} / ${z.n} = ${f2(z.falt)}`, `Costo total promedio por mes: ${f2(z.total)}`];
      },
      resultado: (r, listo, d) => {
        if (!listo) return [c('p', { className: 'w-ayuda' }, `Los costos salen al llegar al fin, en el mes ${d.n}. Con «Ver todo» vas directo al final.`)];
        if (!r.fin) return [c('p', { className: 'w-error' }, r.corte)];
        const z = r.fin;
        const fila = (dt, dd) => [c('dt', {}, dt), c('dd', {}, dd)];
        return [c('dl', { className: 'w-salidas' },
          ...fila('Pedido promedio por mes', `${f(z.costo)} / ${z.n} = ${f2(z.pedido)}`),
          ...fila('Mantenimiento, h·Ī⁺', `${f(d.h)} × ${f(z.areaMas)} / ${z.n} = ${f2(z.mant)}`),
          ...fila('Faltante, π·Ī⁻', `${f(d.pi)} × ${f(z.areaMenos)} / ${z.n} = ${f2(z.falt)}`),
          ...fila('Costo total promedio por mes', f2(z.total)))];
      },
      graficos: (r, i, w, d) => {
        const q = r.pasos[i];
        const niveles = r.pasos.map((x) => x.I);
        const vMin = Math.min(0, ...niveles, d.s);
        const vMax = Math.max(1, ...niveles, d.S);
        const pts = puntosDe(r.pasos, i, 'I');
        const svg = graficoEscalones(ayuda, { ancho: w, alto: w < 480 ? 220 : 260, puntos: pts, tMax: d.n, vMin, vMax, nombre: 'I(t)', claseMas: 'wg-area-mas', guias: [{ v: d.S, etq: `S = ${d.S}` }, { v: d.s, etq: `s = ${d.s}` }], desc: contarEscalones('I(t), el nivel de inventario,', pts, `Área de I⁺ ${f(q.areaMas)} y área de I⁻ ${f(q.areaMenos)}`) });
        return [{ cabeza: [c('b', {}, 'I(t)'), `. Hasta el reloj ${f(q.reloj)}, `, c('span', { className: 'ps-m ps-m-mas', 'aria-hidden': 'true' }), 'área de I⁺ (arriba del 0): ', c('b', {}, f(q.areaMas)), '; ', c('span', { className: 'ps-m ps-m-menos', 'aria-hidden': 'true' }), 'área de I⁻ (abajo del 0): ', c('b', {}, f(q.areaMenos))], svg }];
      },
    });
    const recalcular = () => p.recalcular();
    const volver = () => {
      Object.entries(cs).forEach(([k, cp]) => {
        cp.inp.value = BASE[k];
      });
      sDec.value = BASE.dec;
      p.reiniciar();
    };
    Object.values(cs).forEach((cp) => cp.inp.addEventListener('input', recalcular));
    sDec.addEventListener('change', recalcular);
    const grupo = (titulo, ...hijos) => c('fieldset', { className: 'ps-grupo' }, c('legend', {}, titulo), c('div', { className: 'w-entradas' }, ...hijos));
    // In a summary the point is the student's own exercise, so the data are open from the start.
    const propio = enResumen
      ? 'Arranca con el ejemplo de la página. Poné los datos de tu ejercicio en «Cambiar los datos»: quedan guardados en tu resumen.'
      : 'Ejemplo armado para esta página, con números aleatorios propios. No es del apunte ni de un examen. Los costos y la demanda son los del apunte.';
    lienzo.append(
      c('p', { className: 'ps-propio' }, propio),
      c('details', { className: 'ps-datos', open: enResumen },
        c('summary', {}, 'Cambiar los datos'),
        grupo('Política y horizonte', cs.I0.fila, cs.s.fila, cs.S.fila, cs.n.fila),
        grupo('Costos', cs.K.fila, cs.i.fila, cs.h.fila, cs.pi.fila),
        grupo('Demanda y proveedor', cs.beta.fila, cs.tam.fila, cs.prob.fila, cs.a.fila, cs.b.fila, filaDec, cs.U.fila),
        c('p', { className: 'w-ayuda' }, 'Separá los números con espacios o comas, con punto para los decimales. Si dos eventos caen a la misma hora, van en el orden del apunte: llegada de pedido, demanda, fin y evaluación.'),
        c('div', { className: 'w-botones ps-volver' }, boton('Volver al ejemplo', volver))),
      resumen,
      p.piezas.pasos, p.piezas.explica, p.piezas.marco, p.piezas.fin, p.piezas.grafs, p.piezas.exportar);
    p.arrancar(pasoGuardado);
    return p.api;
  });
})();
