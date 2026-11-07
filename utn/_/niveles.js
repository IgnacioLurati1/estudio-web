// Levels and fast-changing subjects come from the service, so a change shows up without publishing. The page already has
// what was built, and that stays if the service does not answer. The last answer is reused at once to avoid a visible swap.
(() => {
  const S = window.UTN_SERVICIO;
  if (!S?.hay) return;
  const TEXTOS = {"fuerte":{"nombre":"Fuerte","texto":"Resumen fuerte. Alcanza para estudiar todo sin depender del material original."},"normal":{"nombre":"Normal","texto":"Resumen normal. Se puede estudiar de acá, pero conviene constatar con el material original."},"debil":{"nombre":"Débil","texto":"Resumen débil. Da un pantallazo general. No se recomienda como fuente única."},"no-juzgado":{"nombre":"No juzgado","texto":"Resumen no juzgado. Todavía nadie evaluó si alcanza para estudiar solo con esto."}};
  const RAPIDA = "Materia de cambio rápido. El temario cambia seguido. Confirmá con tu comisión qué entra este año.";
  const CACHE = 'utn:niveles';
  const FRESCA = 10 * 60 * 1000;

  const aplicarMateria = (d) => {
    const banda = document.querySelector('.nivel[data-nivel]');
    if (!banda) return;
    const { materia, pagina } = document.body.dataset;
    const nivel = TEXTOS[d.niveles[materia]?.[pagina]] ? d.niveles[materia][pagina] : 'no-juzgado';
    if (banda.dataset.nivel !== nivel) {
      banda.dataset.nivel = nivel;
      banda.textContent = TEXTOS[nivel].texto;
    }
    const rapida = d.rapidas.includes(materia);
    const hay = document.querySelector('.nivel[data-rapida]');
    if (rapida && !hay) {
      const p = document.createElement('p');
      p.className = 'nivel nivel-rapido';
      p.dataset.rapida = '1';
      p.textContent = RAPIDA;
      banda.after(p);
    } else if (!rapida) hay?.remove();
  };

  // One mark per subject: its level if every judged summary agrees, «Varía» if not, nothing if none was judged.
  const aplicarFila = (f, d) => {
    const marcas = f.querySelector('.c-marcas');
    const propios = d.niveles[f.dataset.slug] || {};
    const juzgados = (f.dataset.paginas ? f.dataset.paginas.split('|') : [])
      .map((x) => {
        const corte = x.indexOf('=');
        return { nombre: x.slice(corte + 1), nivel: propios[x.slice(0, corte)] };
      })
      .filter((x) => TEXTOS[x.nivel] && x.nivel !== 'no-juzgado');
    const distintos = [...new Set(juzgados.map((x) => x.nivel))];
    const ahora = marcas.querySelector('.c-nivel');
    const quiero = distintos.length === 1 ? distintos[0] : '';
    const texto = distintos.length > 1 ? 'Varía' : quiero ? TEXTOS[quiero].nombre : '';
    if (!texto) ahora?.remove();
    else if (ahora?.textContent !== texto) {
      const m = ahora || document.createElement('span');
      m.className = 'c-marca c-nivel';
      if (quiero) m.dataset.nivel = quiero;
      else delete m.dataset.nivel;
      m.textContent = texto;
      if (!ahora) marcas.prepend(m);
    }
    f.dataset.niveles = juzgados.map((x) => `${x.nombre}: ${TEXTOS[x.nivel].nombre}`).join('\n');
    const rapida = d.rapidas.includes(f.dataset.slug);
    const marcaRapida = marcas.querySelector('.c-rapida');
    if (rapida) f.dataset.rapida = '1';
    else delete f.dataset.rapida;
    if (rapida && !marcaRapida) {
      const r = document.createElement('span');
      r.className = 'c-marca c-rapida';
      r.textContent = 'Cambio rápido';
      (marcas.querySelector('.c-nivel') || { after: (x) => marcas.prepend(x) }).after(r);
    } else if (!rapida) marcaRapida?.remove();
  };

  const valido = (d) => d && typeof d.niveles === 'object' && d.niveles !== null && Array.isArray(d.rapidas);
  const aplicar = (d) => {
    if (!valido(d)) return;
    aplicarMateria(d);
    document.querySelectorAll('.c-fila').forEach((f) => aplicarFila(f, d));
  };

  if (!document.querySelector('.nivel[data-nivel], .c-fila')) return;
  // A copy younger than FRESCA is enough: the levels change a few times per term, so the next pages skip the question.
  let edad = Infinity;
  try {
    const guardado = JSON.parse(localStorage.getItem(CACHE));
    aplicar(guardado);
    if (valido(guardado) && Number.isFinite(guardado.cuando)) edad = Date.now() - guardado.cuando;
  } catch {
    /* Nothing saved, or storage is off: the built page stays until the answer arrives. */
  }
  if (edad >= 0 && edad < FRESCA) return;
  S.pedir('niveles').then((r) => {
    if (!r.ok || !valido(r.datos)) return;
    aplicar(r.datos);
    try {
      localStorage.setItem(CACHE, JSON.stringify({ cuando: Date.now(), niveles: r.datos.niveles, rapidas: r.datos.rapidas }));
    } catch {
      /* No storage: the next visit starts from the built page. */
    }
  });
})();
