// Stars: a real radio group so keyboard and screen readers work. Anyone sees them; voting asks for an account.
// Nothing shows if the service does not answer.
(() => {
  const S = window.UTN_SERVICIO;
  const C = window.UTN_CUENTA;
  const SVG = 'http://www.w3.org/2000/svg';
  const RUTA = 'M12 2.8l2.85 5.9 6.45.92-4.67 4.6 1.1 6.48L12 17.62 6.27 20.7l1.1-6.48L2.7 9.62l6.45-.92z';
  const ESPERA_TECLADO = 1000;
  const PIDE_CUENTA = 'Para votar hace falta una cuenta. Tu voto queda elegido.';
  let serie = 0;

  const uno = (x) => Number(x).toLocaleString('es-AR', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  const textoVotos = (v) => {
    const n = Number(v?.n) || 0;
    if (!n) return 'Sin votos todavía.';
    return `Promedio ${uno(v.prom)} de 5, ${n === 1 ? '1 voto' : `${n} votos`}.`;
  };

  // escala names each star («Muy mala»…«Muy buena»), read aloud and shown on hover, so the direction of the scale is clear.
  const estrella = (nombre, n, escala) => {
    const label = document.createElement('label');
    label.className = 'estrella';
    if (escala) label.title = escala[n - 1];
    const input = document.createElement('input');
    input.type = 'radio';
    input.name = nombre;
    input.value = String(n);
    const svg = document.createElementNS(SVG, 'svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('aria-hidden', 'true');
    const p = document.createElementNS(SVG, 'path');
    p.setAttribute('d', RUTA);
    svg.append(p);
    const texto = document.createElement('span');
    texto.className = 'vh';
    texto.textContent = `${n === 1 ? '1 estrella' : `${n} estrellas`}${escala ? `, ${escala[n - 1].toLowerCase()}` : ''}`;
    label.append(input, svg, texto);
    return label;
  };

  // pedir(n) sends the vote and returns the answer from api.js. mensajes overrides the texts per status.
  const crear = ({ rotulo, rotuloVisible, escala, pedir, mensajes }) => {
    serie += 1;
    const caja = document.createElement('div');
    caja.className = 'es-fila';
    const grupo = document.createElement('div');
    grupo.className = 'es-grupo';
    grupo.setAttribute('role', 'radiogroup');
    if (rotuloVisible) {
      const t = document.createElement('span');
      t.id = `esRotulo${serie}`;
      t.className = 'es-rotulo';
      t.textContent = rotuloVisible;
      grupo.setAttribute('aria-labelledby', t.id);
      caja.append(t);
    } else grupo.setAttribute('aria-label', rotulo);
    const nombre = `voto${serie}`;
    const radios = [1, 2, 3, 4, 5].map((n) => {
      const l = estrella(nombre, n, escala);
      grupo.append(l);
      return l.firstChild;
    });
    const dato = document.createElement('span');
    dato.className = 'es-dato';
    const estado = document.createElement('span');
    estado.className = 'es-estado';
    estado.setAttribute('role', 'status');
    // On a phone nobody sees the hover names, so the two ends of the scale are also written. A screen reader already
    // hears the name of each star.
    const extremos = [];
    if (escala) {
      const e = document.createElement('span');
      e.className = 'es-escala';
      e.setAttribute('aria-hidden', 'true');
      e.textContent = `1 es ${escala[0].toLowerCase()} y 5, ${escala[4].toLowerCase()}`;
      extremos.push(e);
    }
    caja.append(grupo, ...extremos, dato, estado);

    let propio = 0;
    let promedio = 0;
    // Without a vote of your own, the stars show the average, lighter.
    const pintarPromedio = () => {
      const lleno = radios.some((r) => r.checked) ? 0 : Math.round(promedio);
      radios.forEach((r, i) => r.parentElement.classList.toggle('es-prom', i < lleno));
    };
    const marcar = (n) => {
      radios.forEach((r) => {
        r.checked = Number(r.value) === n;
      });
      pintarPromedio();
    };
    let enCurso = false;
    let votoDe = '';
    // mis-votos may have been asked before a vote that just got saved: what this widget saved wins for that account.
    const fijarPropio = (n) => {
      const yo = S.usuario();
      if (votoDe && votoDe === yo) return;
      if (votoDe) {
        votoDe = '';
        estado.textContent = '';
      }
      propio = Number(n) || 0;
      if (!enCurso) marcar(propio);
    };
    const pintar = (v) => {
      dato.textContent = textoVotos(v);
      promedio = Number(v?.n) ? Number(v.prom) || 0 : 0;
      pintarPromedio();
    };

    let reloj = 0;
    let conPuntero = false;
    let vuelta = 0;
    const enviar = async (n) => {
      vuelta += 1;
      const esta = vuelta;
      const r = await C.conCuenta(PIDE_CUENTA, () => pedir(n));
      if (esta !== vuelta) return;
      enCurso = false;
      if (r.ok) {
        propio = n;
        votoDe = S.usuario();
        marcar(n);
        estado.removeAttribute('data-error');
        estado.textContent = 'Voto guardado.';
        pintar(r.datos);
        return;
      }
      marcar(propio);
      if (r.cancelado) {
        estado.removeAttribute('data-error');
        estado.textContent = 'Tu voto no se guardó porque no ingresaste.';
        return;
      }
      estado.dataset.error = '1';
      estado.textContent = S.mensaje(r, { ...S.SIN_TEXTO, ...mensajes });
    };
    grupo.addEventListener('pointerdown', () => {
      conPuntero = true;
    });
    // Arrow keys move the choice one star at a time, so the keyboard waits for the last one before sending.
    grupo.addEventListener('change', (e) => {
      clearTimeout(reloj);
      enCurso = true;
      estado.textContent = '';
      const n = Number(e.target.value);
      pintarPromedio();
      if (conPuntero) enviar(n);
      else reloj = setTimeout(() => enviar(n), ESPERA_TECLADO);
      conPuntero = false;
    });
    return { caja, pintar, fijarPropio };
  };

  window.UTN_ESTRELLAS = { crear, textoVotos, uno };
  if (!S?.hay || !C) return;

  const portada = document.querySelector('[data-estrellas-materia]');
  const filas = [...document.querySelectorAll('.c-fila[data-slug]')];
  if (!portada && !filas.length) return;

  // The numbers of every subject stay a few minutes in this browser: the next pages paint them at once and do not ask
  // again. A vote of this person updates that copy, so it never shows an older number than the one just saved.
  const COPIA = 'utn:votos';
  const FRESCA = 10 * 60 * 1000;
  const validas = (m) => m !== null && typeof m === 'object' && !Array.isArray(m);
  const leerCopia = () => {
    try {
      const d = JSON.parse(localStorage.getItem(COPIA));
      return d && validas(d.materias) && Number.isFinite(d.cuando) ? d : null;
    } catch {
      return null;
    }
  };
  const guardarCopia = (materias, cuando = Date.now()) => {
    try {
      localStorage.setItem(COPIA, JSON.stringify({ cuando, materias }));
    } catch {
      /* No storage: the next page asks again. */
    }
  };

  // The widget shows right away, so the page does not jump when the numbers arrive.
  let widget;
  if (portada) {
    const materia = portada.dataset.estrellasMateria;
    widget = crear({
      // The stars rate the subject itself, not the summary: how hard or pleasant it was to take.
      rotuloVisible: '¿Qué tal la materia?',
      escala: ['Muy mala', 'Mala', 'Más o menos', 'Buena', 'Muy buena'],
      pedir: async (estrellas) => {
        const r = await S.pedir('votar', { json: { materia, estrellas }, cuenta: true });
        if (r.ok) {
          S.refrescar('votos');
          const copia = leerCopia();
          if (copia && r.datos) guardarCopia({ ...copia.materias, [materia]: r.datos }, copia.cuando);
        }
        return r;
      },
      mensajes: { 429: 'Votaste muchas veces seguidas. Probá de nuevo en un rato.' },
    });
    portada.append(widget.caja);
    portada.hidden = false;
    // Until the numbers arrive, the line of votes is a skeleton (.esq in utn.css) on its own line, like the text.
    const esq = document.createElement('span');
    esq.className = 'esq';
    esq.style.setProperty('--ancho', '11em');
    const leido = document.createElement('span');
    leido.className = 'vh';
    leido.textContent = 'Cargando los votos.';
    widget.caja.querySelector('.es-dato').append(esq, leido);
    portada.setAttribute('aria-busy', 'true');
  }

  let todas = null;
  const pintarMapa = (mias) => {
    filas.forEach((f) => {
      f.querySelector('.c-votos')?.remove();
      delete f.dataset.votos;
      const v = todas[f.dataset.slug];
      const propio = Number(mias[f.dataset.slug]) || 0;
      const n = Number(v?.n) || 0;
      if (!n && !propio) return;
      f.dataset.votos = `${textoVotos(v)}${propio ? ` Tu voto: ${propio}.` : ''}`;
      if (!n) return;
      const marca = document.createElement('span');
      marca.className = 'c-marca c-votos';
      const visible = document.createElement('span');
      visible.setAttribute('aria-hidden', 'true');
      visible.textContent = `★ ${uno(v.prom)} (${n})`;
      const leido = document.createElement('span');
      leido.className = 'vh';
      leido.textContent = textoVotos(v);
      marca.append(visible, leido);
      f.querySelector('.c-marcas')?.prepend(marca);
    });
  };
  const pintarPropios = async () => {
    const mias = (await C.misVotos()).materias;
    if (portada) widget.fijarPropio(mias[portada.dataset.estrellasMateria]);
    if (todas) pintarMapa(mias);
  };

  let escuchando = false;
  const aplicar = (materias) => {
    portada?.removeAttribute('aria-busy');
    todas = materias;
    if (portada) widget.pintar(todas[portada.dataset.estrellasMateria]);
    pintarPropios();
    if (escuchando) return;
    escuchando = true;
    window.addEventListener('utn:sesion', pintarPropios);
  };
  const copia = leerCopia();
  if (copia) aplicar(copia.materias);
  const edad = copia ? Date.now() - copia.cuando : Infinity;
  if (edad >= 0 && edad < FRESCA) return;
  S.pedir('votos').then((r) => {
    if (!r.ok || !validas(r.datos?.materias)) {
      if (copia) return;
      portada?.removeAttribute('aria-busy');
      if (portada) portada.hidden = true;
      return;
    }
    guardarCopia(r.datos.materias);
    aplicar(r.datos.materias);
  });
})();
