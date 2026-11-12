// Runs before first paint so saved choices do not flash. Night is the default and comes in the HTML.
(() => {
  const d = document.documentElement;
  const fuente = 'https://fonts.googleapis.com/css2?family=Atkinson+Hyperlegible:ital,wght@0,400;0,700;1,400&display=swap';
  const aplicar = (s) => {
    const prender = (k, on) => {
      if (on) d.dataset[k] = '1';
      else delete d.dataset[k];
    };
    prender('contraste', s.contraste === true);
    prender('interlineado', s.interlineado === true);
    prender('legible', s.legible === true);
    prender('quieto', s.quieto === true);
    prender('foco', s.foco === true);
    if (s.daltonismo === 'rg' || s.daltonismo === 'ay') d.dataset.daltonismo = s.daltonismo;
    else delete d.dataset.daltonismo;
    if (['125', '150', '175'].includes(s.texto)) d.dataset.texto = s.texto;
    else delete d.dataset.texto;
    if (['lisa', 'rayada', 'sepia', 'pizarron'].includes(s.estilo)) d.dataset.estilo = s.estilo;
    else delete d.dataset.estilo;
    // How bright the letters are at night (utn.css mixes the ink with the paper): 0 is the softest, none is the look's own.
    if ([0, 1, 2, 3].includes(s.claridad)) d.dataset.claridad = String(s.claridad);
    else delete d.dataset.claridad;
    const color = (vars, c) => vars.forEach((v) => {
      if (/^#[0-9a-f]{6}$/i.test(c || '')) d.style.setProperty(v, c);
      else d.style.removeProperty(v);
    });
    color(['--titulo'], s.colorTitulos);
    color(['--linea', '--borde', '--borde-control'], s.colorBordes);
    if (s.legible === true && !document.getElementById('fuenteLegible')) {
      const l = document.createElement('link');
      l.id = 'fuenteLegible';
      l.rel = 'stylesheet';
      l.href = fuente;
      document.head.append(l);
    }
  };
  const leer = () => {
    try {
      const s = JSON.parse(localStorage.getItem('utn:ajustes'));
      return s && typeof s === 'object' ? s : {};
    } catch {
      return {};
    }
  };
  const guardar = (s) => {
    try {
      localStorage.setItem('utn:ajustes', JSON.stringify(s));
    } catch {
      /* No storage: the choice lasts until the page closes. */
    }
  };
  window.UTN_AJUSTES = { aplicar, leer, guardar };
  aplicar(leer());
  try {
    if (localStorage.getItem('utn:tema') === 'dia') delete d.dataset.tema;
  } catch {
    /* Private mode without storage: keep the night theme. */
  }

  // Emergency protocol. Each page says what it is: `data-em-fuera` is out while the protocol is on, `data-em-solo` only exists with it.
  const emergencia = () => {
    try {
      return localStorage.getItem('utn:emergencia') === '1';
    } catch {
      return false;
    }
  };
  const aplicarEmergencia = () => {
    const on = emergencia();
    if (on) d.dataset.emergencia = '1';
    else delete d.dataset.emergencia;
    if (on && d.hasAttribute('data-em-fuera')) location.replace('emergencia.html');
    if (!on && d.hasAttribute('data-em-solo')) location.replace('index.html');
  };
  aplicarEmergencia();
  // Back button and other tabs: the page may have been left with the protocol in another state.
  window.addEventListener('pageshow', (e) => {
    if (e.persisted) aplicarEmergencia();
  });
  window.addEventListener('storage', (e) => {
    if (e.key === 'utn:emergencia' || e.key === null) aplicarEmergencia();
  });

  // Exam mode (examen.js): an exam page being taken comes back in exam mode before the first paint, so its
  // resolution never flashes on a reload.
  const examen = /\/([a-z0-9-]+)\/ej-([a-z0-9_.-]+)\.html$/.exec(location.pathname);
  if (examen) {
    try {
      const e = JSON.parse(localStorage.getItem(`utn:${examen[1]}:examen`));
      if (e && e.slug === examen[2] && ['rindiendo', 'corrigiendo', 'listo'].includes(e.fase)) d.dataset.examen = e.fase;
    } catch {
      /* Nothing stored: the page shows as always. */
    }
  }
})();
