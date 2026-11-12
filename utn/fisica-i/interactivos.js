// Simulador de Física I para «Armá tu resumen»: tiro oblicuo con los datos del alumno, la trayectoria dibujada y cada
// cuenta. Ninguna página de la materia lo usa; si alguno se pone en una página, sus campos quedan fijos.
// Notación del apunte (parcial-1.md, «Cinemática - resumen», págs. 4 y 5, y la «Teoría Ampliada» de proyectiles):
// φ sobre la horizontal, v₀ₓ = v₀·cos φ, v₀ᵧ = v₀·sen φ, y = y₀ + v₀ᵧ·t − ½·g·t², h_MÁX y el alcance d.
// La parte pura de arriba también corre en Node.
(() => {
  'use strict';
  const RAD = Math.PI / 180;
  /** Número como en las resoluciones del Drive: coma decimal y dos decimales, con el signo menos de verdad. */
  const f = (x, dec = 2) => {
    const v = Math.abs(x) < 0.5 * 10 ** -dec ? 0 : x;
    return v.toFixed(dec).replace('.', ',').replace('-', '−');
  };
  /** Un dato como lo escribió el alumno, sin ceros de más: 20, 9,8, 22. */
  const fd = (x) => f(x, 4).replace(/,?0+$/, '') || '0';
  /** Un número escrito con coma o con punto: «9,8», «9.8», «-5». NaN si no es un número. */
  const leer = (txt) => {
    const t = String(txt).trim().replace(/−/g, '-').replace(',', '.');
    return /^[+-]?(\d+(\.\d*)?|\.\d+)$/.test(t) ? Number(t) : NaN;
  };
  const LIM = {
    v0: [0, 10000, 'La velocidad inicial va de más de 0 a 10000 m/s.'],
    ang: [-90, 90, 'El ángulo va de −90° (para abajo) a 90° (para arriba).'],
    y0: [0, 100000, 'La altura de partida va de 0 a 100000 m, medida desde el suelo.'],
    g: [0, 100, 'g va de más de 0 a 100 m/s².'],
  };
  /** Lee los datos. t puede quedar vacío. */
  function leerTiro(d) {
    const out = {};
    for (const k of ['v0', 'ang', 'y0', 'g']) {
      const v = leer(d[k]);
      const [lo, hi, msg] = LIM[k];
      if (!Number.isFinite(v)) return { error: `Escribí ${{ v0: 'la velocidad inicial', ang: 'el ángulo', y0: 'la altura de partida', g: 'g' }[k]} con un número, como 20 o 9,8.`, en: k };
      if (v < lo || v > hi || ((k === 'v0' || k === 'g') && v === 0)) return { error: msg, en: k };
      out[k] = v;
    }
    out.t = null;
    if (String(d.t ?? '').trim()) {
      const t = leer(d.t);
      if (!Number.isFinite(t) || t < 0) return { error: 'El instante t es un número de 0 en adelante, en segundos. Si no lo usás, dejalo vacío.', en: 't' };
      out.t = t;
    }
    return out;
  }
  /** Todas las cuentas del tiro, con el suelo en y = 0. */
  function calcularTiro({ v0, ang, y0, g, t }) {
    const fi = ang * RAD;
    const vx = Math.abs(ang) === 90 ? 0 : v0 * Math.cos(fi);
    const vy = v0 * Math.sin(fi);
    const disc = vy * vy + 2 * g * y0;
    const tv = (vy + Math.sqrt(disc)) / g;
    if (!(tv > 1e-12)) return { error: 'Con altura 0 y el tiro horizontal o para abajo, el cuerpo no llega a volar. Subí la altura o el ángulo.' };
    const ts = vy > 0 ? vy / g : 0;
    const hmax = vy > 0 ? y0 + (vy * vy) / (2 * g) : y0;
    const d = vx * tv;
    const v1y = vy - g * tv;
    const en = (tt) => {
      const vyt = vy - g * tt;
      return { t: tt, x: vx * tt, y: y0 + vy * tt - 0.5 * g * tt * tt, dy: vy * tt - 0.5 * g * tt * tt, vy: vyt, v: Math.hypot(vx, vyt), fi: Math.atan2(vyt, vx) / RAD };
    };
    const r = { v0, ang, y0, g, vx, vy, ts, hmax, tv, d, v1y, v1: Math.hypot(vx, v1y), fi1: Math.atan2(v1y, vx) / RAD, punto: null, tarde: false };
    if (t !== null) {
      if (t > tv + 1e-9) r.tarde = true;
      else r.punto = en(t);
    }
    r.en = en;
    return r;
  }
  /** Las cuentas con la notación del apunte, una por renglón. */
  function cuentas(r) {
    const { v0, ang, y0, g, vx, vy } = r;
    const L = [];
    L.push(`v₀ₓ = v₀·cos φ = ${fd(v0)}·cos ${fd(ang)}° = ${f(vx)} m/s. v₀ᵧ = v₀·sen φ = ${fd(v0)}·sen ${fd(ang)}° = ${f(vy)} m/s.`);
    if (vy > 0) {
      L.push(`Altura máxima. Arriba vᵧ = 0, así que 0 = v₀ᵧ − g·t y t_s = v₀ᵧ / g = ${f(vy)} / ${fd(g)} = ${f(r.ts)} s.`);
      L.push(y0 > 0
        ? `h_MÁX = y₀ + v₀ᵧ² / (2·g) = ${fd(y0)} + ${f(vy)}² / (2·${fd(g)}) = ${fd(y0)} + ${f(r.hmax - y0)} = ${f(r.hmax)} m sobre el suelo.`
        : `h_MÁX = v₀ᵧ² / (2·g) = ${f(vy)}² / (2·${fd(g)}) = ${f(r.hmax)} m.`);
    } else L.push(`Como v₀ᵧ no es positiva, no sube. La altura máxima es la de partida, y₀ = ${fd(y0)} m.`);
    if (y0 === 0) L.push(`Tiempo de vuelo. Vuelve al suelo cuando 0 = v₀ᵧ·t − ½·g·t², o sea t_v = 2·v₀ᵧ / g = 2·${f(vy)} / ${fd(g)} = ${f(r.tv)} s.`);
    else L.push(`Tiempo de vuelo. Llega al suelo cuando 0 = y₀ + v₀ᵧ·t − ½·g·t². La raíz positiva es t_v = (v₀ᵧ + √(v₀ᵧ² + 2·g·y₀)) / g = (${f(vy)} + √(${f(vy)}² + 2·${fd(g)}·${fd(y0)})) / ${fd(g)} = ${f(r.tv)} s.`);
    L.push(y0 === 0 && vx > 0
      ? `Alcance. d = v₀ₓ·t_v = ${f(vx)}·${f(r.tv)} = ${f(r.d)} m. Es lo mismo que d = v₀²·sen 2φ / g = ${fd(v0)}²·sen ${fd(2 * ang)}° / ${fd(g)}.`
      : `Alcance. d = v₀ₓ·t_v = ${f(vx)}·${f(r.tv)} = ${f(r.d)} m.`);
    L.push(`Al llegar, v₁ₓ = v₀ₓ = ${f(vx)} m/s y v₁ᵧ = v₀ᵧ − g·t_v = ${f(vy)} − ${fd(g)}·${f(r.tv)} = ${f(r.v1y)} m/s. |v₁| = √(v₁ₓ² + v₁ᵧ²) = ${f(r.v1)} m/s, con φ₁ = arctg(v₁ᵧ / v₁ₓ) = ${f(r.fi1, 1)}°.`);
    if (vx > 0) L.push(`Ecuación de la trayectoria. y = y₀ + (v₀ᵧ / v₀ₓ)·x − g / (2·v₀ₓ²)·x² = ${y0 ? `${fd(y0)} + ` : ''}${f(vy / vx, 4)}·x − ${f(g / (2 * vx * vx), 4)}·x².`);
    const p = r.punto;
    if (p) {
      L.push(`En t = ${fd(p.t)} s. x = v₀ₓ·t = ${f(vx)}·${fd(p.t)} = ${f(p.x)} m. y = y₀ + v₀ᵧ·t − ½·g·t² = ${fd(y0)} + ${f(vy)}·${fd(p.t)} − ½·${fd(g)}·${fd(p.t)}² = ${f(p.y)} m, o sea ${f(Math.abs(p.dy))} m ${p.dy < 0 ? 'por debajo' : 'por encima'} de la salida.`);
      L.push(`vᵧ = v₀ᵧ − g·t = ${f(vy)} − ${fd(g)}·${fd(p.t)} = ${f(p.vy)} m/s. |v| = √(vₓ² + vᵧ²) = ${f(p.v)} m/s, con φ = arctg(vᵧ / vₓ) = ${f(p.fi, 1)}°.`);
    }
    return L;
  }

  const NUCLEO = { leerTiro, calcularTiro, cuentas };
  if (typeof document === 'undefined') {
    module.exports = NUCLEO;
    return;
  }

  // ===== Navegador
  const UTN = window.UTN || (window.UTN = {});
  const enResumenDe = (figura, ayuda) => ayuda.enResumen ?? figura.classList.contains('ag-pieza');
  /** cfg.datos viene del navegador y no es confiable: un texto guardado dentro de su tope, o undefined. */
  const guardado = (cfg, clave, tope) => {
    const d = cfg && cfg.datos;
    if (!d || typeof d !== 'object' || Array.isArray(d) || !Object.prototype.hasOwnProperty.call(d, clave)) return undefined;
    return typeof d[clave] === 'string' && d[clave].length <= tope ? d[clave] : undefined;
  };
  const pasoLindo = (bruto) => {
    const p = 10 ** Math.floor(Math.log10(bruto));
    const n = bruto / p;
    return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10) * p;
  };
  /** La imagen para el archivo: el dibujo como se ve y abajo los textos de ayuda.pngTablas. */
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

  // Ejemplo: el problema 3 del final del 22/04/2025, que tiene su resolución en Ejercicios.
  const EJ = { v0: '20', ang: '40', y0: '22', g: '9,8', t: '3' };
  let cuenta = 0;
  UTN.interactivo('tiro-oblicuo', (figura, cfg, ayuda) => {
    const { crear, svg, lienzo } = ayuda;
    const enResumen = enResumenDe(figura, ayuda);
    const CAMPOS = [
      ['v0', 'Velocidad inicial, v₀', 'm/s'],
      ['ang', 'Ángulo sobre la horizontal, φ', '°'],
      ['y0', 'Altura de partida, y₀', 'm'],
      ['g', 'Gravedad, g', 'm/s²'],
      ['t', 'Un instante t (opcional)', 's'],
    ];
    const inp = {};
    const filas = CAMPOS.map(([k, etq, unidad]) => {
      const id = `fis-t${(cuenta += 1)}`;
      const v = guardado(cfg, k, 20);
      const sirve = v !== undefined && (k === 't' ? !v.trim() || leer(v) >= 0 : Number.isFinite(leer(v)));
      inp[k] = crear('input', { id, type: 'text', inputMode: 'decimal', autocomplete: 'off', spellcheck: false, value: sirve ? v : EJ[k], maxLength: 20 });
      return crear('div', { className: 'w-entrada' }, crear('label', { htmlFor: id }, etq), crear('div', { className: 'w-con-unidad' }, inp[k], crear('span', { className: 'w-unidad', 'aria-hidden': 'true' }, unidad)));
    });
    const volver = () => {
      Object.keys(EJ).forEach((k) => (inp[k].value = EJ[k]));
      cambio();
    };
    const datos = crear('fieldset', { className: 'ps-datos' }, crear('legend', {}, 'Tus datos'),
      crear('div', { className: 'w-entradas' }, ...filas),
      crear('p', { className: 'w-ayuda' }, 'Sin aire y con el suelo en y = 0. Un ángulo negativo es un tiro para abajo. El instante t sirve para ver dónde está y con qué velocidad va.'),
      crear('div', { className: 'w-botones ps-volver' }, ayuda.boton('Volver al ejemplo', volver)));
    if (!enResumen) {
      datos.disabled = true;
      lienzo.append(crear('p', { className: 'w-aviso' }, 'Con tus propios datos se usa en «Armá tu resumen».'));
    }
    const error = crear('p', { className: 'w-error', role: 'status', hidden: true });
    const estado = crear('p', { className: 'ps-explica', role: 'status' });
    const cont = crear('div', {});
    const res = crear('dl', { className: 'w-salidas' });
    const pasos = crear('ol', { className: 'w-pasos' });
    const det = crear('details', { open: true }, crear('summary', {}, 'Las cuentas'), pasos);
    const resultado = crear('div', {}, cont, res, det);
    lienzo.append(datos, error, estado, resultado);
    let r = null;
    let lineas = [];
    let salidas = [];
    let dibujo = null;
    let ancho = 0;
    const pintar = () => {
      dibujo = null;
      if (!r) return cont.replaceChildren();
      const W = Math.max(260, Math.round(cont.clientWidth || 600));
      ancho = W;
      const fs = Math.round((13 * (parseFloat(getComputedStyle(document.documentElement).fontSize) || 16)) / 16);
      const tinta = ayuda.color('--tinta');
      const suave = ayuda.color('--tinta-suave');
      const acento = ayuda.color('--birome');
      const borde = ayuda.color('--borde');
      // Escala: la misma en los dos ejes si el dibujo no queda ni muy chato ni muy alto.
      let x0 = 0;
      let x1 = Math.max(r.d, 1e-9);
      const y1 = Math.max(r.hmax, 1e-9);
      if (r.d < 1e-6) {
        x0 = -y1 * 0.3;
        x1 = y1 * 0.3;
      }
      const izq = fs * 3.4;
      const der = fs * 1.4;
      const arriba = fs * 2.2;
      const abajo = fs * 2.6;
      const anchoUtil = W - izq - der;
      const H = Math.round(Math.min(Math.max((anchoUtil * (y1 * 1.12)) / ((x1 - x0) * 1.04), W * 0.42, 190), W * 0.75) + arriba + abajo);
      const altoUtil = H - arriba - abajo;
      const X = (x) => izq + ((x - x0) / ((x1 - x0) * 1.04)) * anchoUtil;
      const Y = (y) => H - abajo - (y / (y1 * 1.12)) * altoUtil;
      const s = svg('svg', { viewBox: `0 0 ${W} ${H}`, width: '100%', 'aria-hidden': 'true' });
      s.style.display = 'block';
      const linea = (a, b, c, d, color, w = 1, trazo) => s.append(svg('line', { x1: a, y1: b, x2: c, y2: d, stroke: color, 'stroke-width': w, 'stroke-dasharray': trazo }));
      const texto = (x, y, t, color, ancla = 'middle', peso = 400, tam = fs * 0.92) => s.append(svg('text', { x, y, fill: color, 'font-size': tam, 'text-anchor': ancla, 'font-weight': peso }, t));
      // Cuadrícula y ejes, en metros.
      const px = pasoLindo((x1 - x0) / 5);
      for (let v = Math.ceil(x0 / px) * px; v <= x1 * 1.04 + 1e-9; v += px) {
        linea(X(v), Y(0), X(v), Y(y1 * 1.12), borde, 1);
        texto(X(v), Y(0) + fs * 1.3, f(v, px < 1 ? 1 : 0).replace(/,0$/, ''), suave);
      }
      const py = pasoLindo(y1 / 4);
      for (let v = py; v <= y1 * 1.12 + 1e-9; v += py) {
        linea(X(x0), Y(v), X(x1 * 1.04), Y(v), borde, 1);
        texto(X(x0) - fs * 0.4, Y(v) + fs * 0.32, f(v, py < 1 ? 1 : 0).replace(/,0$/, ''), suave, 'end');
      }
      linea(X(x0), Y(0), X(x1 * 1.04), Y(0), tinta, 1.5);
      linea(X(Math.max(x0, 0)), Y(0), X(Math.max(x0, 0)), Y(y1 * 1.12), tinta, 1);
      texto(W - der, Y(0) + fs * 2.3, 'x (m)', suave, 'end');
      texto(izq - fs * 0.4, arriba - fs * 0.8, 'y (m)', suave, 'end');
      // Trayectoria.
      const pts = [];
      for (let i = 0; i <= 120; i += 1) {
        const p = r.en((r.tv * i) / 120);
        pts.push(`${X(p.x).toFixed(1)},${Y(Math.max(p.y, 0)).toFixed(1)}`);
      }
      s.append(svg('polyline', { points: pts.join(' '), fill: 'none', stroke: acento, 'stroke-width': 2.4, 'stroke-linejoin': 'round' }));
      const punto = (x, y, color, lleno = true) => s.append(svg('circle', { cx: X(x), cy: Y(y), r: fs * 0.3, fill: lleno ? color : 'none', stroke: color, 'stroke-width': 1.5 }));
      punto(0, r.y0, tinta);
      if (r.vy > 0) {
        const xs = r.vx * r.ts;
        linea(X(xs), Y(0), X(xs), Y(r.hmax), suave, 1, '4 3');
        punto(xs, r.hmax, tinta);
        texto(X(xs), Y(r.hmax) - fs * 0.7, `h_MÁX = ${f(r.hmax)} m`, tinta, X(xs) > W * 0.7 ? 'end' : X(xs) < W * 0.3 ? 'start' : 'middle', 600);
      }
      punto(r.d, 0, tinta);
      if (r.d >= 0.005) {
        // El alcance va adentro de la parábola, a la izquierda de donde la curva cruza la altura del texto.
        const yTexto = (fs * 1.3 * y1 * 1.12) / altoUtil;
        const disc = r.vy * r.vy + 2 * r.g * (r.y0 - yTexto);
        const xCurva = r.hmax > yTexto && disc >= 0 ? Math.min(r.d, (r.vx * (r.vy + Math.sqrt(disc))) / r.g) : null;
        if (xCurva !== null && X(xCurva) - fs * 0.5 - fs * 6 > izq) texto(X(xCurva) - fs * 0.5, Y(0) - fs * 0.4, `d = ${f(r.d)} m`, tinta, 'end', 600);
        else texto(X(r.d), Y(0) - fs * 1.6, `d = ${f(r.d)} m`, tinta, X(r.d) > W * 0.5 ? 'end' : 'start', 600);
      }
      if (r.punto) {
        const p = r.punto;
        punto(p.x, p.y, acento, false);
        // Del lado de la curva que queda libre: abajo a la izquierda si baja, abajo a la derecha si sube.
        const baja = p.vy < 0;
        texto(X(p.x) + (baja ? -fs * 0.6 : fs * 0.6), Y(p.y) + fs * 1.2, `t = ${fd(p.t)} s`, acento, baja ? 'end' : 'start', 600);
      }
      cont.replaceChildren(s);
      dibujo = s;
    };
    new ResizeObserver(() => {
      if (cont.clientWidth > 0 && Math.round(cont.clientWidth) !== ancho) pintar();
    }).observe(cont);
    ayuda.alCambiar(pintar);
    const calcular = () => {
      r = null;
      const d = leerTiro(Object.fromEntries(Object.keys(inp).map((k) => [k, inp[k].value])));
      Object.keys(inp).forEach((k) => inp[k].setAttribute('aria-invalid', String(d.en === k)));
      const c = d.error ? d : calcularTiro(d);
      const msg = c.error || (c.tarde ? `Ese instante es después de que llega al suelo, a los ${f(c.tv)} s. Probá con uno menor o dejalo vacío.` : '');
      error.textContent = msg;
      error.hidden = !msg;
      resultado.hidden = !!msg;
      if (c.tarde) inp.t.setAttribute('aria-invalid', 'true');
      if (msg) {
        estado.textContent = '';
        pintar();
        return;
      }
      r = c;
      estado.textContent = `Vuela ${f(r.tv)} s, ${r.d < 0.005 ? 'vuelve al mismo lugar' : `llega a ${f(r.d)} m`} y ${r.vy > 0 ? `sube hasta ${f(r.hmax)} m` : `sale desde ${fd(r.y0)} m de altura`}.`;
      salidas = [
        ['v₀ₓ y v₀ᵧ', `${f(r.vx)} y ${f(r.vy)} m/s`],
        ...(r.vy > 0 ? [['Tiempo de subida, t_s', `${f(r.ts)} s`]] : []),
        ['Altura máxima, h_MÁX', `${f(r.hmax)} m`],
        ['Tiempo de vuelo, t_v', `${f(r.tv)} s`],
        ['Alcance, d', `${f(r.d)} m`],
        ['Velocidad al llegar, |v₁|', `${f(r.v1)} m/s a ${f(r.fi1, 1)}°`],
        ...(r.punto ? [
          [`Posición en t = ${fd(r.punto.t)} s`, `x = ${f(r.punto.x)} m, y = ${f(r.punto.y)} m`],
          [`Velocidad en t = ${fd(r.punto.t)} s`, `vᵧ = ${f(r.punto.vy)} m/s, |v| = ${f(r.punto.v)} m/s a ${f(r.punto.fi, 1)}°`],
        ] : []),
      ];
      res.replaceChildren(...salidas.flatMap(([t, v]) => [crear('dt', {}, t), crear('dd', {}, v)]));
      lineas = cuentas(r);
      pasos.replaceChildren(...lineas.map((t) => crear('li', {}, t)));
      pintar();
    };
    const cambio = () => {
      calcular();
      ayuda.guardarDatos(Object.fromEntries(Object.keys(inp).map((k) => [k, inp[k].value])));
    };
    Object.values(inp).forEach((i) => i.addEventListener('input', cambio));
    calcular();
    const imagen = () => {
      if (!r) return Promise.resolve(null);
      return apilar(ayuda, dibujo, [
        { texto: `Tiro oblicuo con v₀ = ${fd(r.v0)} m/s, φ = ${fd(r.ang)}°, y₀ = ${fd(r.y0)} m y g = ${fd(r.g)} m/s²`, negrita: true },
        { cab: ['Qué', 'Valor'], tabla: salidas },
        { texto: 'Las cuentas', negrita: true },
        ...lineas.map((t, i) => ({ texto: `${i + 1}. ${t}` })),
      ]);
    };
    return { imagen, redibujar: pintar };
  });
})();
