// General pages: theme, table filter and the teacher emails.
(() => {
  const d = document.documentElement;
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

  document.querySelectorAll('.s-mail').forEach((a) => {
    a.addEventListener('click', () => {
      const mail = [...a.dataset.m.replace(' ', '@')].reverse().join('');
      const enlace = document.createElement('a');
      enlace.textContent = mail;
      enlace.href = `mailto:${mail}`;
      a.replaceWith(enlace);
      enlace.focus();
    });
  });

  const entrada = document.querySelector('[data-filtro]');
  if (entrada) {
    const sinMarcas = (t) => t.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\b(de|las|los|la|el|en|y)\b/g, ' ').replace(/\s+/g, ' ').trim();
    const filas = [...document.querySelectorAll('[data-filtro-texto]')];
    const grupos = [...document.querySelectorAll('[data-filtro-grupo]')];
    const vacio = document.querySelector('[data-filtro-vacio]');
    entrada.addEventListener('input', () => {
      const q = sinMarcas(entrada.value);
      let hay = 0;
      filas.forEach((f) => {
        const ve = !q || f.dataset.filtroTexto.includes(q);
        f.hidden = !ve;
        if (ve) hay += 1;
      });
      grupos.forEach((g) => {
        g.hidden = !g.querySelector('[data-filtro-texto]:not([hidden])');
      });
      vacio.hidden = hay > 0;
    });
  }
})();
