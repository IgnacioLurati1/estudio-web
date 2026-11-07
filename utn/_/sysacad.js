// Sysacad Lindo, the browser extension, hands over in this same browser which subjects the student passed or has as
// regular in Sysacad. This matches its names with the subjects here and mixes them with what the student marked by
// hand, which always wins. Pure: it works as a classic script (window.UTN_SYSACAD) and from Node, for the tests.
(function (raiz) {
  const FUENTE = 'sysacad-lindo';
  const MAX_MATERIAS = 200;
  // Sysacad cuts names at 40 characters.
  const CORTE = 40;
  // Names that Sysacad writes differently (its own typos included), already without accents.
  const ALIAS = {
    'direccion de rescursos humanos': 'direccion-de-recursos-humanos',
    'practica profesional supervisada': 'practicas-profesionales-supervisadas',
  };

  const normal = (t) =>
    String(t ?? '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/\((elec|ord)[^)]*\)?/g, ' ')
      .replace(/[^a-z0-9]+/g, ' ')
      .trim();

  /** What the extension sent, if it looks right: { fecha, materias: [{ nombre, tipo }] }, or null. */
  function leerMensaje(data) {
    if (!data || typeof data !== 'object' || data.fuente !== FUENTE || !Array.isArray(data.materias)) return null;
    const fecha = Number(data.fecha);
    if (!Number.isFinite(fecha) || fecha <= 0) return null;
    const materias = data.materias
      .slice(0, MAX_MATERIAS)
      .filter((m) => m && typeof m.nombre === 'string' && (m.tipo === 'aprobada' || m.tipo === 'regular'))
      .map((m) => ({ nombre: m.nombre.slice(0, 120), tipo: m.tipo }));
    return { fecha, materias };
  }

  /** Matches Sysacad's names with ours ([{ slug, nombre }]). { estados: { slug: 'a' or 'c' }, sueltas: [names not found] }. */
  function emparejar(materias, nuestras) {
    const lista = nuestras.map((m) => ({ slug: m.slug, n: normal(m.nombre) }));
    const estados = {};
    const sueltas = [];
    for (const m of materias) {
      const tipo = m.tipo === 'aprobada' ? 'a' : 'c';
      const n = normal(m.nombre);
      if (!n) continue;
      let slug = ALIAS[n] ?? lista.find((x) => x.n === n)?.slug;
      // A cut name is the start of the whole one, but only if it is the start of a single subject.
      if (!slug && m.nombre.trim().length >= CORTE - 2) {
        const empiezan = lista.filter((x) => x.n.startsWith(n));
        if (empiezan.length === 1) slug = empiezan[0].slug;
      }
      if (!slug || !lista.some((x) => x.slug === slug)) {
        sueltas.push(m.nombre);
        continue;
      }
      // The same subject twice (two plans, or a regular and then passed): passed wins.
      if (estados[slug] !== 'a') estados[slug] = tipo;
    }
    return { estados, sueltas };
  }

  /** The state that shows: what was marked by hand ('x' is «sin cursar» on purpose), or else what Sysacad says. */
  const efectivo = (manual, sysacad, slug) => {
    const propio = manual?.[slug];
    if (propio === 'x') return '';
    if (propio === 'a' || propio === 'c') return propio;
    const traido = sysacad?.[slug];
    return traido === 'a' || traido === 'c' ? traido : '';
  };

  /** What to keep by hand after choosing `valor` ('' 'c' 'a'): nothing if it is what Sysacad says, so Sysacad keeps it
   * up to date. Returns the new value to store, or null to drop it. */
  const aGuardar = (valor, sysacad, slug) => {
    const traido = sysacad?.[slug] ?? '';
    if (valor === traido) return null;
    return valor || 'x';
  };

  const API = { FUENTE, normal, leerMensaje, emparejar, efectivo, aGuardar };
  if (typeof module === 'object' && module.exports) module.exports = API;
  else raiz.UTN_SYSACAD = API;
})(typeof window === 'undefined' ? globalThis : window);
