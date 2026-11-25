// Runs before first paint so saved choices do not flash. Night is the default and comes in the HTML.
(() => {
  const d = document.documentElement;
  const fuente = 'https://fonts.googleapis.com/css2?family=Atkinson+Hyperlegible:ital,wght@0,400;0,700;1,400&display=swap';
  const PALETAS = ['sepia', 'pizarron', 'plano', 'grafito', 'rosa'];
  // The style (key «forma», attribute data-estilo): the shape of sheets, buttons, fields and cards, apart from the theme.
  const ESTILOS = ['limpio', 'redondo', 'brutal'];
  const HOJAS = ['rayada', 'punteada', 'lisa'];
  // The darkest day paper and the lightest night card of all the palettes (utn.css): an ink that reads on them reads
  // on every palette.
  const CLARO = '#e2d3b6';
  const OSCURO = '#144a83';
  const canales = (c) => [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16));
  const luz = (c) => {
    const [r, g, b] = canales(c).map((v) => v / 255).map((x) => (x <= 0.04045 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4));
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };
  const contraste = (a, b) => {
    const [x, y] = [luz(a), luz(b)].sort((m, n) => n - m);
    return (x + 0.05) / (y + 0.05);
  };
  const mezclar = (c, otro, parte) => {
    const b = canales(otro);
    return `#${canales(c).map((v, i) => Math.round(v + (b[i] - v) * parte).toString(16).padStart(2, '0')).join('')}`;
  };
  // Moves the colour towards black (day) or white (night) until it reaches 4.5:1 on that paper.
  const legible = (c, hacia, fondo) => {
    for (let p = 0; p <= 1; p += 0.05) {
      const m = mezclar(c, hacia, p);
      if (contraste(m, fondo) >= 4.5) return m;
    }
    return hacia;
  };
  // The browser's bar takes the paper of the palette in use, by day or by night.
  const BARRA = { birome: ['#f3f6fb', '#06122b'], sepia: ['#efe4cf', '#1a140e'], pizarron: ['#e9edef', '#173129'], plano: ['#e6eef5', '#0c3866'], grafito: ['#eeeeec', '#151515'], rosa: ['#fbf0f5', '#1d1520'] };
  const pintarBarra = () => {
    const c = (BARRA[d.dataset.paleta] || BARRA.birome)[d.dataset.tema === 'noche' ? 1 : 0];
    document.querySelectorAll('meta[name="theme-color"]').forEach((m) => m.setAttribute('content', c));
  };
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
    // Palette and sheet. Before they were one choice, «estilo»: an old one still says which of each.
    const viejo = { lisa: ['', 'lisa'], rayada: ['', 'rayada'], sepia: ['sepia', 'lisa'], pizarron: ['pizarron', 'lisa'] }[s.estilo] || ['', ''];
    const paleta = 'paleta' in s ? s.paleta : viejo[0];
    const hoja = 'hoja' in s ? s.hoja : viejo[1];
    if (PALETAS.includes(paleta)) d.dataset.paleta = paleta;
    else delete d.dataset.paleta;
    if (HOJAS.includes(hoja)) d.dataset.hoja = hoja;
    else delete d.dataset.hoja;
    if (ESTILOS.includes(s.forma)) d.dataset.estilo = s.forma;
    else delete d.dataset.estilo;
    pintarBarra();
    // How bright the letters are at night (utn.css mixes the ink with the paper): 0 is the softest, none is the look's own.
    if ([0, 1, 2, 3].includes(s.claridad)) d.dataset.claridad = String(s.claridad);
    else delete d.dataset.claridad;
    const color = (vars, c) => vars.forEach((v) => {
      if (/^#[0-9a-f]{6}$/i.test(c || '')) d.style.setProperty(v, c);
      else d.style.removeProperty(v);
    });
    color(['--titulo'], s.colorTitulos);
    color(['--linea', '--borde', '--borde-control'], s.colorBordes);
    // Own ink: one version for day and one for night, each pushed until it reads on the paper of every palette.
    const tinta = /^#[0-9a-f]{6}$/i.test(s.tinta || '') ? s.tinta : '';
    prender('tinta', Boolean(tinta));
    color(['--u-tinta-d'], tinta && legible(tinta, '#000000', CLARO));
    color(['--u-tinta-n'], tinta && legible(tinta, '#ffffff', OSCURO));
    // Own highlighter: the same colour day and night, with whichever letter reads best on it.
    const res = /^#[0-9a-f]{6}$/i.test(s.resaltador || '') ? s.resaltador : '';
    prender('resaltador', Boolean(res));
    color(['--u-res'], res);
    color(['--u-res-letra'], res && (contraste(res, '#15191e') >= contraste(res, '#ffffff') ? '#15191e' : '#ffffff'));
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
  // Day, night or like the device («sistema», chosen in Ajustes). The button in the bar always picks one of the first two.
  const claro = window.matchMedia && window.matchMedia('(prefers-color-scheme: light)');
  const tema = () => {
    try {
      return localStorage.getItem('utn:tema') || 'noche';
    } catch {
      return 'noche';
    }
  };
  const aplicarTema = () => {
    const t = tema();
    const noche = t === 'sistema' ? !(claro && claro.matches) : t !== 'dia';
    if (noche) d.dataset.tema = 'noche';
    else delete d.dataset.tema;
    pintarBarra();
    window.dispatchEvent(new Event('utn:tema'));
  };
  window.UTN_AJUSTES = { aplicar, leer, guardar, tema, aplicarTema };
  aplicar(leer());
  aplicarTema();
  if (claro) {
    claro.addEventListener('change', () => {
      if (tema() === 'sistema') aplicarTema();
    });
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
