// Entry page: theme, subject search, the local record of passed subjects and the study plan map.
(() => {
  const d = document.documentElement;
  const $$ = (s) => [...document.querySelectorAll(s)];
  // Reading mode belongs to the study pages. Here it would only hide the footer.
  delete d.dataset.foco;

  const bTema = document.getElementById('tema');
  const pintarTema = () => {
    const noche = d.dataset.tema === 'noche';
    bTema.textContent = noche ? 'Modo día' : 'Modo noche';
  };
  bTema.addEventListener('click', () => {
    const noche = d.dataset.tema === 'noche';
    if (noche) delete d.dataset.tema;
    else d.dataset.tema = 'noche';
    try {
      localStorage.setItem('utn:tema', noche ? 'dia' : 'noche');
    } catch {
      /* No storage: the choice lasts until the page closes. */
    }
    pintarTema();
  });
  pintarTema();

  // What the student marked by hand ('x' is «sin cursar» on purpose), and what Sysacad Lindo brought from Sysacad.
  // The hand always wins (sysacad.js).
  const CLAVE = 'utn:carrera';
  const CLAVE_SYSACAD = 'utn:carrera-sysacad';
  const CLAVE_OCULTAR = 'utn:ocultar-aprobadas';
  const S = window.UTN_SYSACAD;
  const leerJson = (clave) => {
    try {
      const x = JSON.parse(localStorage.getItem(clave));
      return x && typeof x === 'object' ? x : null;
    } catch {
      return null;
    }
  };
  const guardar = (clave, valor) => {
    try {
      if (valor === null) localStorage.removeItem(clave);
      else localStorage.setItem(clave, typeof valor === 'string' ? valor : JSON.stringify(valor));
    } catch {
      /* No storage: nothing to remember. */
    }
  };
  const leer = () => leerJson(CLAVE) || {};
  const leerSysacad = () => {
    const x = leerJson(CLAVE_SYSACAD);
    return x && Number.isFinite(x.fecha) && x.estados && typeof x.estados === 'object' ? x : null;
  };
  const filas = $$('.c-fila');
  const numeros = (t) => (t ? t.split(',').map(Number) : []);
  const cuenta = document.getElementById('cCuenta');
  const avisoSysacad = document.getElementById('cSysacad');
  const textoSysacad = document.getElementById('cSysacadTexto');
  const bOcultar = document.getElementById('cOcultar');
  let ocultarAprobadas = (() => {
    try {
      return localStorage.getItem(CLAVE_OCULTAR) === 'true';
    } catch {
      return false;
    }
  })();
  const fechaCorta = (ms) => new Date(ms).toLocaleDateString('es-AR', { day: 'numeric', month: 'numeric' });
  const estados = () => {
    const manual = leer();
    const traidos = leerSysacad()?.estados ?? {};
    return Object.fromEntries(filas.map((f) => [f.dataset.slug, S.efectivo(manual, traidos, f.dataset.slug)]));
  };

  // «¡Te recibiste!» (recibido.js): every compulsory subject of years 1 to 5 passed, without the electives or the old
  // ones. It shows by itself once, when the last one gets passed (by hand, from Sysacad or from the account) or on
  // arriving with all of them passed. Undoing one forgets it, so finishing again brings it back. «Volver a festejar»
  // opens it whenever.
  const R = window.UTN_RECIBIDO;
  const CLAVE_RECIBIDO = 'utn:recibido';
  const obligatorias = filas.filter((f) => f.dataset.obligatoria).map((f) => f.dataset.slug);
  const bFestejo = document.getElementById('cFestejo');
  const festejar = () => R.abrir({ materias: obligatorias.length });
  bFestejo.addEventListener('click', festejar);
  let vista = (() => {
    try {
      return Boolean(localStorage.getItem(CLAVE_RECIBIDO));
    } catch {
      return false;
    }
  })();
  let toca = 0;
  const revisarRecibido = (estado) => {
    const recibido = R.completa(estado, obligatorias);
    bFestejo.hidden = !recibido;
    if (!recibido) {
      clearTimeout(toca);
      if (vista) guardar(CLAVE_RECIBIDO, null);
      vista = false;
      return;
    }
    if (vista) return;
    vista = true;
    // A moment to see the last one turn green, and the letters of the stamp loaded. It is remembered only once it
    // opened: leaving in that moment brings it on the next visit.
    toca = setTimeout(() => (document.fonts?.ready ?? Promise.resolve()).then(() => {
      if (!vista) return;
      festejar();
      guardar(CLAVE_RECIBIDO, '1');
    }), 450);
  };

  const pintarEstados = () => {
    const estado = estados();
    revisarRecibido(estado);
    const porN = new Map();
    filas.forEach((f) => {
      if (f.dataset.n) porN.set(Number(f.dataset.n), estado[f.dataset.slug] || '');
    });
    const valores = Object.values(estado);
    const hayMarcas = valores.some(Boolean);
    filas.forEach((f) => {
      const propio = estado[f.dataset.slug] || '';
      f.dataset.estado = propio;
      f.querySelector('select').value = propio;
      // A prerequisite with no tile in the plan cannot be marked, so it does not hold the subject back.
      const enPlan = (t) => numeros(t).filter((n) => porN.has(n));
      const cursadas = enPlan(f.dataset.c).every((n) => porN.get(n));
      const aprobadas = enPlan(f.dataset.a).every((n) => porN.get(n) === 'a');
      // A subject no longer in the plan cannot be taken, whatever its old prerequisites say.
      const puede = f.querySelector('.c-puede');
      if (puede) puede.hidden = !(hayMarcas && !propio && cursadas && aprobadas);
    });
    const a = valores.filter((v) => v === 'a').length;
    const c = valores.filter((v) => v === 'c').length;
    cuenta.hidden = !hayMarcas;
    cuenta.textContent = `Llevás ${a} ${a === 1 ? 'aprobada' : 'aprobadas'} y ${c} ${c === 1 ? 'regular' : 'regulares'}.${ocultarAprobadas && a && !document.body.classList.contains('marcando') ? ' Las aprobadas están ocultas.' : ''}`;
    const traido = leerSysacad();
    avisoSysacad.hidden = !traido;
    if (traido) textoSysacad.textContent = `Tus aprobadas y regulares llegaron de Sysacad el ${fechaCorta(traido.fecha)}. Lo que cambies a mano queda así.`;
    bOcultar.hidden = !a;
    bOcultar.textContent = ocultarAprobadas ? 'Mostrar las aprobadas' : 'Ocultar las aprobadas';
    filtrar();
    pintarPuedo();
  };
  $$('.c-fila select').forEach((s) => {
    s.addEventListener('change', () => {
      const manual = leer();
      const valor = S.aGuardar(s.value, leerSysacad()?.estados ?? {}, s.dataset.slug);
      if (valor === null) delete manual[s.dataset.slug];
      else manual[s.dataset.slug] = valor;
      guardar(CLAVE, manual);
      pintarEstados();
    });
  });
  bOcultar.addEventListener('click', () => {
    ocultarAprobadas = !ocultarAprobadas;
    guardar(CLAVE_OCULTAR, ocultarAprobadas ? 'true' : null);
    pintarEstados();
  });
  document.getElementById('cSysacadSacar').addEventListener('click', () => {
    guardar(CLAVE_SYSACAD, null);
    pintarEstados();
    // With no marks left the count hides, so the focus goes to «Marcar lo que ya hice».
    (cuenta.hidden ? document.getElementById('cMarcar') : cuenta).focus();
  });

  const bMarcar = document.getElementById('cMarcar');
  const ayuda = document.getElementById('cAyuda');
  bMarcar.addEventListener('click', () => {
    const on = !document.body.classList.contains('marcando');
    document.body.classList.toggle('marcando', on);
    bMarcar.textContent = on ? 'Dejar de marcar' : 'Marcar lo que ya hice';
    ayuda.hidden = !on;
    // While marking, the passed ones stay in sight: one just marked does not vanish under the pointer.
    pintarEstados();
  });

  // The map: pointing at a subject lights up what it asks for and what it unlocks.
  const plano = document.getElementById('cPlano');
  const lineas = document.getElementById('cLineas');
  const ficha = document.getElementById('cFicha');
  const ayudaFicha = ficha.innerHTML;
  const ancho = window.matchMedia('(min-width: 1100px) and (hover: hover)');
  const SVG = 'http://www.w3.org/2000/svg';
  const nombre = (f) => f.querySelector('.c-nom').textContent;
  const porNumero = new Map(filas.filter((f) => f.dataset.n).map((f) => [Number(f.dataset.n), f]));
  const pideDe = (f) => {
    const a = numeros(f.dataset.a);
    const c = numeros(f.dataset.c).filter((n) => !a.includes(n));
    const buscar = (ns) => ns.map((n) => porNumero.get(n)).filter(Boolean);
    return { aprobadas: buscar(a), cursadas: buscar(c) };
  };
  const habilitaDe = (f) => {
    const n = Number(f.dataset.n);
    if (!n) return [];
    return filas.filter((o) => numeros(o.dataset.a).includes(n) || numeros(o.dataset.c).includes(n));
  };
  const parrafo = (texto, clase) => {
    const p = document.createElement('p');
    if (clase) p.className = clase;
    p.textContent = texto;
    return p;
  };
  const limpiar = () => {
    plano.classList.remove('viendo');
    filas.forEach((f) => {
      f.classList.remove('es-actual');
      delete f.dataset.rol;
    });
    lineas.replaceChildren();
    ficha.innerHTML = ayudaFicha;
  };
  const dibujar = (de, a, clase) => {
    const base = plano.getBoundingClientRect();
    const r = de.getBoundingClientRect();
    const s = a.getBoundingClientRect();
    let cuerpo;
    let fin;
    if (s.left >= r.right) {
      const y1 = r.top + r.height / 2 - base.top;
      const y2 = s.top + s.height / 2 - base.top;
      const x1 = r.right - base.left;
      const x2 = s.left - base.left;
      const dx = Math.max(18, (x2 - x1) / 2);
      cuerpo = `M${x1} ${y1}C${x1 + dx} ${y1} ${x2 - dx} ${y2} ${x2} ${y2}`;
      fin = [x2, y2];
    } else if (s.right <= r.left) {
      const y1 = r.top + r.height / 2 - base.top;
      const y2 = s.top + s.height / 2 - base.top;
      const x1 = r.left - base.left;
      const x2 = s.right - base.left;
      const dx = Math.max(18, (x1 - x2) / 2);
      cuerpo = `M${x1} ${y1}C${x1 - dx} ${y1} ${x2 + dx} ${y2} ${x2} ${y2}`;
      fin = [x2, y2];
    } else {
      const baja = s.top >= r.top;
      const x1 = r.left + r.width / 2 - base.left;
      const x2 = s.left + s.width / 2 - base.left;
      const y1 = (baja ? r.bottom : r.top) - base.top;
      const y2 = (baja ? s.top : s.bottom) - base.top;
      const dy = Math.max(14, Math.abs(y2 - y1) / 2) * (baja ? 1 : -1);
      cuerpo = `M${x1} ${y1}C${x1} ${y1 + dy} ${x2} ${y2 - dy} ${x2} ${y2}`;
      fin = [x2, y2];
    }
    const p = document.createElementNS(SVG, 'path');
    p.setAttribute('d', cuerpo);
    if (clase) p.setAttribute('class', clase);
    const c = document.createElementNS(SVG, 'circle');
    c.setAttribute('cx', fin[0]);
    c.setAttribute('cy', fin[1]);
    c.setAttribute('r', '3.5');
    lineas.append(p, c);
  };
  const ver = (f) => {
    limpiar();
    plano.classList.add('viendo');
    f.classList.add('es-actual');
    const { aprobadas, cursadas } = pideDe(f);
    const visibles = (l) => l.filter((o) => !o.hidden);
    visibles(cursadas).forEach((o) => {
      o.dataset.rol = 'Pide cursada';
      dibujar(o, f);
    });
    visibles(aprobadas).forEach((o) => {
      o.dataset.rol = 'Pide aprobada';
      dibujar(o, f);
    });
    const habilita = habilitaDe(f);
    visibles(habilita).forEach((o) => {
      o.dataset.rol = 'Habilita';
      dibujar(f, o, 'habilita');
    });
    const partes = [parrafo(nombre(f), 'c-ficha-nom')];
    const pide = [];
    if (cursadas.length) pide.push(`cursadas ${cursadas.map(nombre).join(', ')}`);
    if (aprobadas.length) pide.push(`aprobadas ${aprobadas.map(nombre).join(', ')}`);
    partes.push(parrafo(pide.length ? `Para cursarla: ${pide.join('; ')}.` : 'No pide ninguna correlativa.'));
    if (habilita.length) partes.push(parrafo(`Habilita: ${habilita.map(nombre).join(', ')}.`));
    if (f.dataset.niveles) partes.push(parrafo(`${f.dataset.niveles.split('\n').map((x) => x.replace(/\.\s*$/, '')).join('. ')}.`));
    if (f.dataset.votos) partes.push(parrafo(f.dataset.votos));
    ficha.replaceChildren(...partes);
  };
  const seguir = (e) => {
    if (!ancho.matches) return;
    const f = e.target.closest('.c-fila');
    if (f) {
      if (!f.classList.contains('es-actual')) ver(f);
    } else if (e.type === 'mouseover' && e.target === plano) limpiar();
  };
  plano.addEventListener('mouseover', seguir);
  plano.addEventListener('focusin', seguir);
  plano.addEventListener('mouseleave', limpiar);
  plano.addEventListener('focusout', (e) => {
    if (!plano.contains(e.relatedTarget)) limpiar();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') limpiar();
  });
  window.addEventListener('resize', limpiar);

  const buscar = document.getElementById('cBuscar');
  const vacio = document.getElementById('cVacio');
  const secciones = $$('.c-anio');
  const sinMarcas = (t) => t.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();
  // The search and «Ocultar las aprobadas» together decide what shows.
  function filtrar() {
    const q = sinMarcas(buscar.value);
    const hay = filas.filter((f) => !q || f.dataset.busca.includes(q)).length;
    // A word that names no subject is a topic: the search across the degree answers it, and the map stays where it is.
    const esTema = !hay && !d.hasAttribute('data-emergencia');
    const sinAprobadas = ocultarAprobadas && !document.body.classList.contains('marcando');
    filas.forEach((f) => {
      f.hidden = (!esTema && Boolean(q) && !f.dataset.busca.includes(q)) || (sinAprobadas && f.dataset.estado === 'a');
    });
    secciones.forEach((s) => {
      s.hidden = !s.querySelector('.c-fila:not([hidden])');
    });
    // With the passed ones hidden, a search may only find those: say so instead of leaving the map blank.
    const visibles = filas.filter((f) => !f.hidden).length;
    vacio.hidden = visibles > 0 || esTema;
    vacio.textContent = !hay ? 'Ninguna materia con ese nombre.' : q ? 'Lo que buscás está entre tus aprobadas. Mostralas con el botón de arriba.' : 'Están todas aprobadas. Mostralas con el botón de arriba.';
  }
  buscar.addEventListener('input', () => {
    limpiar();
    filtrar();
    pintarPuedo();
  });

  // «¿Qué puedo cursar?» lights up the subjects that can be taken now, the ones with «Ya la podés cursar», and steps the
  // rest back. Pressed again, it turns off. It follows the marks, Sysacad and «Ocultar las aprobadas» as they change.
  const bPuedo = document.getElementById('cPuedo');
  const textoPuedo = document.getElementById('cPuedoTexto');
  let puedo = false;
  let dijo = '';
  function pintarPuedo() {
    const brillan = filas.filter((f) => {
      const on = puedo && Boolean(f.querySelector('.c-puede:not([hidden])'));
      f.classList.toggle('c-brilla', on);
      return on;
    });
    plano.classList.toggle('puedo', brillan.length > 0);
    bPuedo.setAttribute('aria-pressed', String(puedo));
    const hayMarcas = Object.values(estados()).some(Boolean);
    // The count follows what is in sight: a search may leave some of them out.
    const total = brillan.length;
    const n = brillan.filter((f) => !f.hidden).length;
    const materias = (k) => `${k} ${k === 1 ? 'materia' : 'materias'}`;
    const texto = !puedo
      ? ''
      : !hayMarcas
        ? 'sin-marcas'
        : !total
          ? 'Con lo que marcaste, todavía no se habilita ninguna materia nueva.'
          : n === total
            ? `Ya podés cursar ${materias(total)}.`
            : `Ya podés cursar ${materias(total)} en total. ${n ? `Con esta búsqueda se ${n === 1 ? 've' : 'ven'} ${n}.` : 'Con esta búsqueda no se ve ninguna.'}`;
    // The status line is only rewritten when what it says changes, so a screen reader does not repeat it.
    if (texto === dijo) return;
    dijo = texto;
    if (texto === 'sin-marcas') {
      const a = document.createElement('a');
      a.href = 'sysacad-lindo.html';
      a.textContent = 'Sysacad Lindo';
      textoPuedo.replaceChildren('Marcá lo que ya hiciste o vinculá ', a, ' para saber qué podés cursar.');
    } else textoPuedo.textContent = texto;
  }
  bPuedo.addEventListener('click', () => {
    puedo = !puedo;
    limpiar();
    pintarPuedo();
  });
  pintarEstados();

  // Sysacad Lindo, if the student linked it, answers this with what it read in Sysacad (and sends it on its own too).
  window.addEventListener('message', (e) => {
    if (e.source !== window || e.origin !== location.origin) return;
    const datos = S.leerMensaje(e.data);
    if (!datos) return;
    const antes = leerSysacad();
    if (antes && antes.fecha >= datos.fecha) return;
    const { estados: traidos } = S.emparejar(datos.materias, filas.map((f) => ({ slug: f.dataset.slug, nombre: nombre(f) })));
    guardar(CLAVE_SYSACAD, { fecha: datos.fecha, estados: traidos });
    pintarEstados();
  });
  window.postMessage({ fuente: 'santo-resumen', pide: 'sysacad' }, location.origin);
})();
