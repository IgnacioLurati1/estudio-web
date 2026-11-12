// Your progress in your account (012). What the page keeps in this browser (the career map, study progress, changes
// to a summary, the summary being built) also goes to the account, key by key, and shows on any device. Without a
// session it stays as before, only here. Contract: docs/ESPEC-SERVICIO.md, «Progreso en la cuenta y respuestas».
//
// It never touches the scripts that write those keys: it compares a fingerprint of each one when the page loads, when
// it is hidden and every little while. By key, the newest change wins. What was in a browser before this existed
// counts as older than anything already in the account. It also owns the small notice at the bottom of the page.
(() => {
  const S = window.UTN_SERVICIO;
  if (!S?.hay) return;
  try {
    if (!window.localStorage) return;
  } catch {
    return;
  }

  // The keys that travel. `script` or `materia` say which page has to reload to show one that came from the account.
  // One more key is one more line here: the service only checks the shape (FORMA, the same as the table). Never device
  // settings, the session or caches: utn:ajustes, utn:tema, utn:emergencia, utn:uso, utn:sesion, utn:niveles.
  const PATRONES = [
    { re: /^utn:carrera$/, script: 'carrera.js' }, // the career map
    { re: /^utn:carrera-sysacad$/, script: 'carrera.js' }, // what Sysacad Lindo brought to the map
    { re: /^utn:crear$/, script: 'crear.js' }, // the summary being built
    { re: /^utn:[a-z0-9_-]+:(erradas|sim|solo|cambios)$/, materia: true }, // study progress and changes to a summary
    { re: /^utn:[a-z0-9_-]+:senaladores$/, materia: true }, // the bookmarks of a subject (senaladores.js)
    { re: /^utn:[a-z0-9_-]+:(hecho|quiz):[a-z0-9_.-]{1,100}$/, materia: true }, // exercises done, best quiz marks
  ];
  const FORMA = /^utn:[a-z0-9][a-z0-9:._-]{0,149}$/;
  const patron = (k) => (typeof k === 'string' && FORMA.test(k) ? PATRONES.find((p) => p.re.test(k)) : undefined);

  // This browser's note on each key, never synced: { v: 1, cuenta, desde, claves: { <key>: { h, c, s, g } } }.
  //   cuenta: the account `s` refers to ('' for none). desde: what the service said to ask from next time.
  //   h: fingerprint of the value last seen here (null: deleted here). c: when this browser saw it (0: before this existed).
  //   s: the account's time for that same value, once it is there; missing means it still has to go up.
  //   g: the fingerprint that did not fit in the account, so it is not sent again until it changes.
  const META = 'utn:progreso';
  const INVITADO = 'utn:progreso-invitado';
  // Up to this much base64 per request; a bigger key goes alone (the service takes up to 3 MiB).
  const TANDA = 1_000_000;
  const TANDA_CLAVES = 200;
  // A request that outlives the page has to be small.
  const MAX_KEEPALIVE = 60_000;
  const CADA = 20_000;
  const TRAER_CADA = 120_000;
  const PAUSA = 5 * 60_000;

  const ahora = () => Date.now();
  const nueva = () => ({ v: 1, cuenta: '', desde: 0, claves: {} });
  const leerMeta = () => {
    try {
      const m = JSON.parse(localStorage.getItem(META));
      if (m && m.v === 1 && m.claves && typeof m.claves === 'object' && !Array.isArray(m.claves)) return m;
    } catch {
      /* A broken note starts over. */
    }
    return null;
  };
  const guardarMeta = (m) => {
    try {
      localStorage.setItem(META, JSON.stringify(m));
      return true;
    } catch {
      return false;
    }
  };
  const leer = (k) => {
    try {
      return localStorage.getItem(k);
    } catch {
      return null;
    }
  };

  // 53 bits of a fast hash and the length: enough to notice a change, never sent anywhere.
  const huella = (s) => {
    let a = 0xdeadbeef ^ s.length;
    let b = 0x41c6ce57 ^ s.length;
    for (let i = 0; i < s.length; i++) {
      const c = s.charCodeAt(i);
      a = Math.imul(a ^ c, 2654435761);
      b = Math.imul(b ^ c, 1597334677);
    }
    a = Math.imul(a ^ (a >>> 16), 2246822507) ^ Math.imul(b ^ (b >>> 13), 3266489909);
    b = Math.imul(b ^ (b >>> 16), 2246822507) ^ Math.imul(a ^ (a >>> 13), 3266489909);
    return `${s.length.toString(36)}.${(4294967296 * (2097151 & b) + (a >>> 0)).toString(36)}`;
  };
  const huellaDe = (v) => (v === null ? null : huella(v));

  // Notes what changed since the last look, and when. The first look ever dates everything as «before» (0).
  const mirar = () => {
    let m = leerMeta();
    const primera = !m;
    if (!m) m = nueva();
    const t = ahora();
    const hay = new Set();
    let cambio = primera;
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (!patron(k)) continue;
      hay.add(k);
      const h = huella(leer(k) ?? '');
      if (m.claves[k]?.h === h) continue;
      m.claves[k] = { h, c: primera ? 0 : t };
      cambio = true;
    }
    for (const [k, e] of Object.entries(m.claves)) {
      if (hay.has(k) || e.h === null) continue;
      m.claves[k] = { h: null, c: t };
      cambio = true;
    }
    if (cambio) guardarMeta(m);
    return cambio;
  };

  // Which page shows a key: the subject's for its keys, the one with the script for the rest.
  const relevante = (k) => {
    const p = patron(k);
    if (!p) return false;
    if (p.materia) return k.split(':')[1] === document.body.dataset.materia;
    return [...document.scripts].some((s) => (s.getAttribute('src') || '').endsWith(p.script));
  };

  // ----- How it is going, for the account dialog.
  let topes = { clave: 2_000_000, cuenta: 4_000_000 };
  let estado = { fase: 'listo', clave: '' };
  const mb = (b) => `${Math.round(b / 1e6)} MB`;
  const nombreMateria = (slug) => {
    if (slug === document.body.dataset.materia) {
      const n = document.querySelector('.b-materia')?.textContent.trim();
      if (n) return n;
    }
    return slug.replace(/-/g, ' ');
  };
  const que = (k) => {
    if (k === 'utn:crear') return 'El resumen que estás armando';
    if (/:cambios$/.test(k)) return `Lo que cambiaste en ${nombreMateria(k.split(':')[1])}`;
    return 'Una parte de tu progreso';
  };
  const texto = () => {
    switch (estado.fase) {
      case 'error':
        return 'Ahora no se pudo guardar en tu cuenta. Queda en este navegador y se vuelve a probar solo.';
      case 'grande':
        return `${que(estado.clave)} pesa más de ${mb(topes.clave)} y no entra en tu cuenta. Queda en este navegador. Si sacás alguna foto, se guarda sola.`;
      case 'lleno':
        return `Tu cuenta llegó al tope de ${mb(topes.cuenta)} de progreso. Lo nuevo queda solo en este navegador. Sacar fotos de tus cambios hace lugar.`;
      case 'sin-espacio':
        return 'Se llenó el espacio para guardar progreso. Por ahora, lo nuevo queda solo en este navegador.';
      case 'sin-lugar':
        return 'Este navegador no tiene lugar para traer todo tu progreso. Lo que no entró sigue en tu cuenta.';
      default:
        return 'Tu progreso se guarda en tu cuenta y lo ves en cualquier dispositivo.';
    }
  };
  const decir = (fase, clave = '') => {
    if (estado.fase === fase && estado.clave === clave) return;
    estado = { fase, clave };
    window.dispatchEvent(new CustomEvent('utn:progreso'));
  };

  // ----- The notice at the bottom: one at a time, until it is closed. Whatever comes from outside goes as text.
  let caja = null;
  const cerrarAviso = () => {
    caja?.remove();
    caja = null;
  };
  const aviso = ({ texto: t, detalle = '', accion = null, alCerrar = null }) => {
    cerrarAviso();
    const p = document.createElement('p');
    p.className = 'pg-texto';
    const cuerpo = document.createElement('div');
    cuerpo.className = 'pg-cuerpo';
    cuerpo.append(p);
    const d = detalle ? Object.assign(document.createElement('p'), { className: 'pg-detalle' }) : null;
    if (d) cuerpo.append(d);
    if (accion) {
      const b = accion.href ? document.createElement('a') : document.createElement('button');
      if (accion.href) b.href = accion.href;
      else b.type = 'button';
      b.className = 'b-pri b-chico';
      b.textContent = accion.texto;
      b.addEventListener('click', (e) => accion.alHacer?.(e));
      const fila = document.createElement('div');
      fila.className = 'pg-acciones';
      fila.append(b);
      cuerpo.append(fila);
    }
    const x = document.createElement('button');
    x.type = 'button';
    x.className = 'pg-cerrar';
    x.textContent = '×';
    x.setAttribute('aria-label', 'Cerrar el aviso');
    const propia = document.createElement('div');
    propia.className = 'pg-aviso';
    propia.setAttribute('role', 'status');
    propia.append(cuerpo, x);
    x.addEventListener('click', () => {
      if (caja === propia) cerrarAviso();
      alCerrar?.();
    });
    caja = propia;
    document.body.append(propia);
    // Filled after it is on the page, so a screen reader reads it as news.
    requestAnimationFrame(() => {
      p.textContent = t;
      if (d) d.textContent = detalle;
    });
    return { cerrar: () => caja === propia && cerrarAviso() };
  };

  let avisoRecarga = false;
  const pedirRecarga = () => {
    if (avisoRecarga) return;
    avisoRecarga = true;
    aviso({ texto: 'Trajimos tu progreso de tu cuenta. Actualizá la página para verlo.', accion: { texto: 'Actualizar', alHacer: () => location.reload() } });
  };

  // ----- With the account.

  // A failure leaves everything noted here, to try again later. 401 is handled by the account itself.
  let pausaHasta = 0;
  const fallo = (r) => {
    pausaHasta = ahora() + PAUSA;
    if (r.status !== 401) decir('error');
    return false;
  };

  // Writes here what came from the account, unless the key changed here in the meantime: then it goes up later.
  // True when what this browser had is different now.
  let sinLugar = false;
  const aplicar = (m, k, v, t) => {
    const e = m.claves[k];
    const actual = leer(k);
    if (huellaDe(actual) !== (e ? e.h : null)) return false;
    if (actual !== v) {
      try {
        if (v === null) localStorage.removeItem(k);
        else localStorage.setItem(k, v);
      } catch {
        sinLugar = true;
        return false;
      }
    }
    if (v === null) delete m.claves[k];
    else m.claves[k] = { h: huella(v), c: t, s: t };
    return actual !== v;
  };

  // Brings the values of those keys, a few at a time, and keeps the ones that still apply. True if all came.
  const bajar = async (lista) => {
    let traidas = false;
    const borrar = lista.filter((q) => q.d);
    if (borrar.length) {
      const m = leerMeta();
      for (const q of borrar) if (aplicar(m, q.k, null, q.t)) traidas ||= relevante(q.k);
      guardarMeta(m);
    }
    const resto = lista.filter((q) => !q.d);
    for (let i = 0; i < resto.length;) {
      const tanda = [];
      let peso = 0;
      while (i < resto.length && tanda.length < 300 && (!tanda.length || peso + resto[i].b <= 1_500_000)) {
        peso += resto[i].b;
        tanda.push(resto[i++]);
      }
      const r = await S.pedir('progreso-leer', { json: { claves: tanda.map((q) => q.k) }, cuenta: true, espera: 30000 });
      if (!r.ok) return { ok: fallo(r), traidas };
      const valores = r.datos?.valores || {};
      const m = leerMeta();
      for (const q of tanda) {
        const x = valores[q.k];
        if (!x || typeof x.t !== 'number' || (x.v !== null && typeof x.v !== 'string')) continue;
        if (aplicar(m, q.k, x.v, x.t)) traidas ||= relevante(q.k);
      }
      guardarMeta(m);
    }
    return { ok: true, traidas };
  };

  // What changed in the account since the last time. By key, the newest wins.
  const traer = async () => {
    const m = leerMeta();
    const r = await S.pedir('progreso', { datos: { desde: m.desde ? String(m.desde) : '' }, cuenta: true });
    if (!r.ok) return fallo(r);
    const d = r.datos || {};
    if (d.topes && typeof d.topes.clave === 'number') topes = d.topes;
    const quiero = [];
    for (const [k, x] of Object.entries(d.claves || {})) {
      if (!patron(k) || !x || typeof x.t !== 'number') continue;
      const e = m.claves[k];
      // The same version, or a newer change here that is still going up.
      if (e && (e.s === x.t || (e.s === undefined && e.c >= x.t))) continue;
      quiero.push({ k, t: x.t, b: Number(x.b) || 0, d: x.d === true });
    }
    sinLugar = false;
    const { ok, traidas } = await bajar(quiero);
    if (traidas) pedirRecarga();
    if (!ok) return false;
    const fin = leerMeta();
    if (typeof d.desde === 'number' && !sinLugar) fin.desde = d.desde;
    guardarMeta(fin);
    if (sinLugar) decir('sin-lugar');
    return true;
  };

  const base64 = (bytes) => {
    let bin = '';
    for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
    return btoa(bin);
  };

  // The keys too big for the account already told about at the bottom of this page.
  const avisadas = new Set();

  // Sends what changed here. Values travel as base64 of their UTF-8: a note with SQL or a script in it would look like
  // an attack to the network filter in front of the service.
  const subir = async ({ alCerrar = false } = {}) => {
    const m = leerMeta();
    if (!m) return true;
    const tandas = [];
    let tanda = [];
    let peso = 0;
    let grande = '';
    for (const [k, e] of Object.entries(m.claves)) {
      if (e.s !== undefined || (e.g && e.g === e.h)) continue;
      const v = leer(k);
      // Changed since the last look: it goes in the next round, with its own time.
      if (huellaDe(v) !== e.h) continue;
      let v64 = null;
      if (v !== null) {
        const bytes = new TextEncoder().encode(v);
        if (bytes.length > topes.clave) {
          e.g = e.h;
          grande = k;
          continue;
        }
        v64 = base64(bytes);
      }
      const n = (v64?.length || 0) + k.length + 48;
      if (tanda.length && (peso + n > TANDA || tanda.length >= TANDA_CLAVES)) {
        tandas.push({ tanda, peso });
        tanda = [];
        peso = 0;
      }
      tanda.push({ k, v: v64, t: e.c, h: e.h });
      peso += n;
    }
    if (tanda.length) tandas.push({ tanda, peso });
    if (grande) guardarMeta(m);
    const viejas = [];
    let problema = '';
    for (const { tanda: t, peso: p } of tandas) {
      const r = await S.pedir('progreso', {
        json: { cambios: t.map(({ k, v, t: c }) => ({ k, v, t: c })) },
        cuenta: true,
        espera: 30000,
        keepalive: alCerrar && p < MAX_KEEPALIVE,
      });
      if (!r.ok) return fallo(r);
      const res = r.datos?.claves || {};
      const m2 = leerMeta();
      for (const c of t) {
        const x = res[c.k];
        const e = m2.claves[c.k];
        // Changed meanwhile: the new value goes in the next round.
        if (!x || !e || e.h !== c.h || e.s !== undefined) continue;
        if (x.r === 'ok' && typeof x.t === 'number') {
          if (c.h === null) delete m2.claves[c.k];
          else e.s = x.t;
        } else if (x.r === 'viejo') viejas.push({ k: c.k, t: 0, b: c.v?.length || 0, d: false });
        else if (x.r === 'grande') {
          e.g = c.h;
          grande ||= c.k;
        } else if (x.r === 'lleno' || x.r === 'sin-espacio') problema ||= x.r;
      }
      guardarMeta(m2);
    }
    // The account had something newer: it comes here.
    if (viejas.length && !alCerrar) {
      const { traidas } = await bajar(viejas);
      if (traidas) pedirRecarga();
    }
    if (problema) {
      pausaHasta = ahora() + PAUSA;
      decir(problema);
      return true;
    }
    // A key that still does not fit keeps saying so, here and once per page at the bottom.
    const pegada = Object.entries(leerMeta()?.claves || {}).find(([, e]) => e.g && e.g === e.h && e.s === undefined)?.[0];
    if (!pegada) {
      decir('listo');
      return true;
    }
    decir('grande', pegada);
    if (!avisadas.has(pegada)) {
      avisadas.add(pegada);
      aviso({ texto: texto() });
    }
    return true;
  };

  // The progress here belongs to one account at a time. When another one comes in, what was in sync with the previous
  // one leaves this browser (it is safe in that account) and what never got there stays and joins the new one.
  const atar = () => {
    const u = S.usuario();
    const m = leerMeta() || nueva();
    if (!u || m.cuenta === u) return;
    let quito = false;
    for (const [k, e] of Object.entries(m.claves)) {
      if (e.s !== undefined && m.cuenta) {
        if (huellaDe(leer(k)) === e.h) {
          try {
            localStorage.removeItem(k);
            quito ||= relevante(k);
          } catch {
            /* It stays here, as this browser's. */
          }
        }
        delete m.claves[k];
        continue;
      }
      delete e.s;
      delete e.g;
    }
    m.cuenta = u;
    m.desde = 0;
    guardarMeta(m);
    if (quito) pedirRecarga();
  };

  let enCurso = null;
  let traidaEl = 0;
  const sincronizar = (conTraer = true) => {
    if (enCurso) return enCurso;
    const vuelta = (async () => {
      try {
        mirar();
        if (!S.usuario()) return;
        atar();
        if (conTraer) {
          traidaEl = ahora();
          if (!(await traer())) return;
        }
        await subir();
      } catch {
        decir('error');
      }
    })();
    // Freed once it ends, never before it is stored: a round without a session ends without waiting for anything.
    enCurso = vuelta;
    vuelta.finally(() => {
      if (enCurso === vuelta) enCurso = null;
    });
    return vuelta;
  };

  // «Salir»: first whatever is still to go up, then the progress that is safe in the account leaves this browser.
  // What could not go up stays. Says whether the page has to reload so nothing of that account is left on screen.
  const alSalir = async () => {
    try {
      mirar();
      if (S.usuario()) await Promise.race([subir(), new Promise((r) => setTimeout(r, 5000))]);
    } catch {
      /* What did not go up stays here. */
    }
    const m = leerMeta() || nueva();
    let recargar = false;
    for (const [k, e] of Object.entries(m.claves)) {
      if (e.s === undefined) continue;
      if (huellaDe(leer(k)) === e.h) {
        try {
          localStorage.removeItem(k);
          recargar ||= relevante(k);
        } catch {
          /* It stays. */
        }
      }
      delete m.claves[k];
    }
    m.cuenta = '';
    m.desde = 0;
    guardarMeta(m);
    return { recargar };
  };

  // The account was deleted: what is here stays as this browser's, as before there were accounts.
  const desvincular = () => {
    const m = leerMeta() || nueva();
    for (const e of Object.values(m.claves)) {
      delete e.s;
      delete e.g;
    }
    m.cuenta = '';
    m.desde = 0;
    guardarMeta(m);
  };

  // Once ever, and only after this browser saw some real progress: a short note that an account keeps it.
  const invitar = () => {
    if (S.usuario() || !window.UTN_CUENTA || !document.querySelector('[data-cuenta]') || leer(INVITADO)) return;
    const m = leerMeta();
    if (!m || !Object.values(m.claves).some((e) => e.c > 0 && e.h !== null)) return;
    try {
      localStorage.setItem(INVITADO, '1');
    } catch {
      return;
    }
    const a = aviso({
      texto: 'Tu progreso queda solo en este navegador. Con una cuenta lo ves en cualquier dispositivo.',
      accion: {
        texto: 'Crear una cuenta',
        alHacer: () => {
          a.cerrar();
          window.UTN_CUENTA.abrir('', { alta: true });
        },
      },
    });
  };

  const ronda = () => {
    if (document.hidden) return;
    const cambio = mirar();
    if (S.usuario()) {
      if (ahora() - traidaEl > TRAER_CADA) sincronizar(true);
      else if (cambio || ahora() > pausaHasta) sincronizar(false);
    } else invitar();
  };
  const alOcultar = () => {
    try {
      mirar();
      if (S.usuario()) subir({ alCerrar: true });
    } catch {
      /* The next visit sends it, with the time it was noted. */
    }
  };

  window.addEventListener('utn:sesion', () => {
    if (S.usuario()) sincronizar(true);
  });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) alOcultar();
    else if (S.usuario() && ahora() - traidaEl > 60_000) sincronizar(true);
  });
  window.addEventListener('pagehide', alOcultar);
  setInterval(ronda, CADA);

  window.UTN_PROGRESO = { estado: () => ({ ...estado }), texto, sincronizar, alSalir, desvincular, aviso };

  sincronizar(true);
  if (!S.usuario()) setTimeout(invitar, 3000);
})();
