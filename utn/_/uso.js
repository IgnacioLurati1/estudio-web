// Page view counters: no cookies, no IP and no identifier. A failure here never reaches the person reading.
(() => {
  const S = window.UTN_SERVICIO;
  const html = document.documentElement;
  // Automated browsers (tests, robots that run the page) are not people reading.
  const hay = () => S?.hay && !navigator.globalPrivacyControl && !navigator.webdriver;
  const avisar = (m, p, marcas) => {
    try {
      if (!hay()) return;
      const cuerpo = { m, p };
      if (marcas?.nuevo) cuerpo.nuevo = true;
      if (marcas?.nuevaMateria) cuerpo.nuevaMateria = true;
      if (marcas?.nuevoDia) cuerpo.nuevoDia = true;
      navigator.sendBeacon(S.url('visita'), JSON.stringify(cuerpo));
    } catch {
      /* The count is not worth bothering anyone. */
    }
  };
  // One key that starts over each day, so the browser keeps no history of past days. From the list of today's
  // pages it knows whether this is the first view of the page, of the subject and of the day: the panel counts
  // devices with the last two.
  const primeraDeHoy = (materia, pagina) => {
    try {
      const hoy = new Date().toLocaleDateString('sv');
      const guardado = JSON.parse(localStorage.getItem('utn:uso') || 'null');
      const vistas = guardado?.dia === hoy && Array.isArray(guardado.vistas) ? guardado.vistas : [];
      const clave = `${materia}/${pagina}`;
      if (vistas.includes(clave)) return {};
      localStorage.setItem('utn:uso', JSON.stringify({ dia: hoy, vistas: [...vistas, clave] }));
      return {
        nuevo: true,
        nuevaMateria: !vistas.some((v) => typeof v === 'string' && v.startsWith(`${materia}/`)),
        nuevoDia: vistas.length === 0,
      };
    } catch {
      // No storage: it cannot tell, so the view goes without marks.
      return null;
    }
  };
  window.UTN_USO = { avisar };
  // A link with data-uso (the download of Sysacad Lindo) is an event, counted when it is clicked. The service only
  // takes the events it knows; the device mark is only for that event, never for the subject or the day.
  document.addEventListener('click', (e) => {
    const a = e.target instanceof Element ? e.target.closest('a[data-uso]') : null;
    if (!a) return;
    const evento = a.dataset.uso;
    avisar('_', evento, { nuevo: primeraDeHoy('_', evento)?.nuevo });
  });
  // A page on its way to a redirect was not really seen.
  const sale = html.hasAttribute('data-emergencia') ? html.hasAttribute('data-em-fuera') : html.hasAttribute('data-em-solo');
  const { materia = '_', pagina } = document.body.dataset;
  if (sale || !pagina || !hay()) return;
  // Each page counts once per device and day: coming back to it later the same day sends nothing.
  const marcas = primeraDeHoy(materia, pagina);
  if (!marcas || marcas.nuevo) avisar(materia, pagina, marcas);
})();
