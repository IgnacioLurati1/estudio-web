// Field of two point charges: every arrow is the vector sum at that point, in one colour so the direction is what stands out.
UTN.interactivo('campo-cargas', (figura, cfg, ayuda) => {
  const { lienzo, svg, crear, deslizador, numero } = ayuda;
  const ANCHO = 560;
  const ALTO = 380;
  const ESCALA = 80;
  const px = (x) => ANCHO / 2 + x * ESCALA;
  const py = (y) => ALTO / 2 - y * ESCALA;
  const TINTA = 'stroke:var(--tinta);fill:none;stroke-width:1.8;stroke-linecap:round';
  // In a person's summary the slider comes back where it was left. cfg.datos is untrusted: only a number of the slider.
  const enResumen = ayuda.enResumen ?? figura.classList.contains('ag-pieza');

  // A summary's piece may bring no desc: then the drawing takes its name from the caption.
  const nombre = cfg.desc ? { 'aria-label': cfg.desc } : { 'aria-labelledby': figura.querySelector('figcaption')?.id || undefined };
  const plano = svg('svg', { viewBox: `0 0 ${ANCHO} ${ALTO}`, width: '100%', role: 'img', ...nombre });
  const flechas = [];
  for (let gy = -2; gy <= 2.01; gy += 0.5) {
    for (let gx = -3.25; gx <= 3.26; gx += 0.5) {
      if (Math.hypot(gx - 1, gy) < 0.3 || Math.hypot(gx + 1, gy) < 0.3) continue;
      const trazo = svg('path', { style: TINTA });
      plano.append(trazo);
      flechas.push({ gx, gy, trazo });
    }
  }
  const carga = (x, texto) => {
    const circulo = svg('circle', { cx: px(x), cy: py(0), r: 13, style: 'fill:var(--papel);stroke:var(--tinta);stroke-width:2' });
    const rotulo = svg('text', { x: px(x), y: py(0) + 6, 'text-anchor': 'middle', style: 'fill:var(--tinta);font:600 17px var(--texto, sans-serif)' }, texto);
    plano.append(circulo, rotulo);
    return rotulo;
  };
  carga(1, '+');
  const rotuloIzq = carga(-1, '−');

  const dibujar = (q2) => {
    rotuloIzq.textContent = q2 > 0 ? '+' : q2 < 0 ? '−' : '0';
    for (const { gx, gy, trazo } of flechas) {
      const d1 = Math.hypot(gx - 1, gy) ** 3;
      const d2 = Math.hypot(gx + 1, gy) ** 3;
      const ex = (gx - 1) / d1 + (q2 * (gx + 1)) / d2;
      const ey = gy / d1 + (q2 * gy) / d2;
      const modulo = Math.hypot(ex, ey) || 1e-9;
      const largo = Math.min(0.42, 0.34 * Math.sqrt(modulo)) * ESCALA;
      const ux = ex / modulo;
      const uy = -ey / modulo;
      const x0 = px(gx);
      const y0 = py(gy);
      const x1 = x0 + ux * largo;
      const y1 = y0 + uy * largo;
      const punta = Math.min(6, largo * 0.45);
      const ax = x1 - ux * punta - uy * punta * 0.6;
      const ay = y1 - uy * punta + ux * punta * 0.6;
      const bx = x1 - ux * punta + uy * punta * 0.6;
      const by = y1 - uy * punta - ux * punta * 0.6;
      trazo.setAttribute('d', `M${x0} ${y0}L${x1} ${y1}M${ax} ${ay}L${x1} ${y1}L${bx} ${by}`);
    }
  };

  const guardado = cfg.datos && typeof cfg.datos === 'object' && !Array.isArray(cfg.datos) && Object.prototype.hasOwnProperty.call(cfg.datos, 'q2') ? cfg.datos.q2 : undefined;
  const leido = typeof guardado === 'string' && guardado.length <= 8 && guardado.trim() !== '' ? Number(guardado.replace(',', '.')) : NaN;
  const INICIAL = Number.isFinite(leido) && leido >= -2 && leido <= 2 ? Math.round(leido * 10) / 10 : -1;
  let q2 = INICIAL;
  lienzo.append(
    crear('div', { className: 'w-plano' }, plano),
    deslizador({ id: 'q2', etq: 'Carga de la izquierda, comparada con la de la derecha', min: -2, max: 2, paso: 0.1, valor: INICIAL }, (v) => {
      q2 = v;
      dibujar(v);
      if (enResumen) ayuda.guardarDatos?.({ q2: String(v) });
    }),
  );
  dibujar(INICIAL);

  // Picture for the summary: the drawing and, under it, the value of the slider, which the drawing does not show.
  const imagen = async () => {
    const img = new Image();
    img.src = await ayuda.png(plano);
    await img.decode();
    const k = 2;
    const W = Math.round(img.width / k);
    const H = Math.round(img.height / k);
    const fs = 15;
    const pie = Math.round(fs * 2.4);
    const c = document.createElement('canvas');
    c.width = W * k;
    c.height = (H + pie) * k;
    const g = c.getContext('2d');
    g.scale(k, k);
    g.drawImage(img, 0, 0, W, H);
    // The bottom strip takes the background the drawing has, as ayuda.png does.
    let fondo = '#fff';
    for (let n = plano; n && n.nodeType === 1; n = n.parentElement) {
      const bg = getComputedStyle(n).backgroundColor;
      if (bg && !/^(transparent|rgba\(0, 0, 0, 0\))$/.test(bg)) {
        fondo = bg;
        break;
      }
    }
    g.fillStyle = fondo;
    g.fillRect(0, H, W, pie);
    g.fillStyle = ayuda.color('--tinta');
    g.textBaseline = 'middle';
    g.font = `400 ${fs}px ${getComputedStyle(lienzo).fontFamily || 'sans-serif'}`;
    g.fillText(`Carga de la izquierda, comparada con la de la derecha: ${numero(q2)}.`, 14, H + pie / 2, W - 28);
    return c.toDataURL('image/png');
  };
  return { imagen };
});
