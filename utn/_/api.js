// The only place that knows where the service lives. Empty means no requests at all: no stars, and the bank says so.
// `UTN_API=<url> UTN_CLAVE=<publishable key> node scripts/utn/armar.mjs` fills them in at build time.
(() => {
  const BASE = "https://lomhlulbgfovtnljbqzp.supabase.co/functions/v1/utn";
  const CLAVE = "sb_publishable_fjUOOwzJTnFp8V5b0c0bUA_6mnkeiaF";
  const SESION = 'utn:sesion';
  const DOMINIO_CUENTAS = 'cuentas.lutastudios.com';

  const url = (a, datos = {}) => {
    const u = new URL(BASE);
    u.searchParams.set('a', a);
    Object.entries(datos).forEach(([k, v]) => {
      if (v) u.searchParams.set(k, v);
    });
    return u.href;
  };

  const leerSesion = () => {
    try {
      const s = JSON.parse(localStorage.getItem(SESION));
      return s?.access_token && s.refresh_token ? s : null;
    } catch {
      return null;
    }
  };
  const avisarSesion = () => window.dispatchEvent(new CustomEvent('utn:sesion'));
  const guardarSesion = (s) => {
    try {
      if (s) localStorage.setItem(SESION, JSON.stringify(s));
      else localStorage.removeItem(SESION);
    } catch {
      /* No storage: the session is lost when the page closes. */
    }
  };
  window.addEventListener('storage', (e) => {
    if (e.key === SESION || e.key === null) avisarSesion();
  });

  // The network filter in front of the service answers an HTML 403 without CORS headers, so the browser only reports a
  // failed request. If the service answers right after, what failed was that request and not the connection.
  const respondeElServicio = async () => {
    try {
      await fetch(url('votos'), { credentials: 'omit', cache: 'no-store', signal: AbortSignal.timeout(6000) });
      return true;
    } catch {
      return false;
    }
  };
  const FRENADO = { ok: false, status: 403, datos: null, error: 'filtro', motivo: '' };

  // Login and renewal go straight to Auth, which limits these requests by IP.
  const token = async (tipo, cuerpo) => {
    try {
      const r = await fetch(`${new URL(BASE).origin}/auth/v1/token?grant_type=${tipo}`, {
        method: 'POST',
        credentials: 'omit',
        headers: { apikey: CLAVE, 'Content-Type': 'application/json' },
        body: JSON.stringify(cuerpo),
        signal: AbortSignal.timeout(12000),
      });
      const datos = await r.json().catch(() => null);
      if (r.status === 403 && !datos) return FRENADO;
      return { ok: r.ok && Boolean(datos?.access_token), status: r.status, datos };
    } catch (e) {
      if (e?.name !== 'TimeoutError' && (await respondeElServicio())) return FRENADO;
      return { ok: false, status: 0, datos: null, error: e?.name === 'TimeoutError' ? 'lento' : '' };
    }
  };
  const armarSesion = (d, usuario) => ({
    access_token: d.access_token,
    refresh_token: d.refresh_token,
    expires_at: d.expires_at || Math.floor(Date.now() / 1000) + (d.expires_in || 3600),
    usuario,
  });
  const ingresar = async (usuario, contrasena) => {
    if (!CLAVE) return { ok: false, status: 503 };
    const r = await token('password', { email: `${usuario}@${DOMINIO_CUENTAS}`, password: contrasena });
    if (r.ok) {
      guardarSesion(armarSesion(r.datos, usuario));
      avisarSesion();
    }
    return r;
  };
  const salir = () => {
    guardarSesion(null);
    avisarSesion();
  };

  // A single renewal at a time. Another tab may have renewed first, so storage is read again before asking.
  let renovando = null;
  const renovar = (vencido) => {
    if (!renovando) {
      renovando = (async () => {
        const s = leerSesion();
        if (!s) return null;
        if (s.access_token !== vencido) return s;
        const r = await token('refresh_token', { refresh_token: s.refresh_token });
        if (r.ok) {
          const nueva = armarSesion(r.datos, s.usuario);
          guardarSesion(nueva);
          return nueva;
        }
        // Only a real refusal ends the session. A network failure can be tried again later.
        if (r.status >= 400 && r.status < 500 && r.error !== 'filtro') salir();
        return null;
      })().finally(() => {
        renovando = null;
      });
    }
    return renovando;
  };
  const tokenVigente = async () => {
    const s = leerSesion();
    if (!s) return null;
    if (s.expires_at - 60 > Date.now() / 1000) return s.access_token;
    return (await renovar(s.access_token))?.access_token || null;
  };

  // Never throws: status 0 means the service did not answer. `cuenta` sends the session, and without one answers 401 by itself.
  // `keepalive` lets a small request outlive the page, for what is sent while it closes.
  const pedir = async (a, { datos, json, form, cuenta = false, espera = 12000, keepalive = false } = {}) => {
    if (!BASE) return { ok: false, status: 0, datos: null, error: '' };
    const llamar = async (bearer) => {
      const init = { credentials: 'omit', signal: AbortSignal.timeout(espera), headers: {}, ...(keepalive ? { keepalive: true } : {}) };
      if (bearer) init.headers.Authorization = `Bearer ${bearer}`;
      if (json) {
        init.method = 'POST';
        init.headers['Content-Type'] = 'application/json';
        init.body = JSON.stringify(json);
      }
      if (form) {
        init.method = 'POST';
        init.body = form;
      }
      try {
        const r = await fetch(url(a, datos), init);
        let cuerpo = null;
        try {
          if (r.status !== 204) cuerpo = await r.json();
        } catch {
          /* An answer without JSON still has its status. */
        }
        if (r.status === 403 && !cuerpo) return FRENADO;
        return { ok: r.ok, status: r.status, datos: cuerpo, error: String(cuerpo?.error || ''), motivo: String(cuerpo?.motivo || '') };
      } catch (e) {
        if ((json || form) && e?.name !== 'TimeoutError' && (await respondeElServicio())) return FRENADO;
        // A timeout is the service taking too long, not this person's connection.
        return { ok: false, status: 0, datos: null, error: e?.name === 'TimeoutError' ? 'lento' : '' };
      }
    };
    if (!cuenta) return llamar();
    const bearer = await tokenVigente();
    if (!bearer) return { ok: false, status: 401, datos: null, error: 'sin-sesion' };
    const r = await llamar(bearer);
    if (r.status !== 401) return r;
    const nueva = await renovar(bearer);
    return nueva ? llamar(nueva.access_token) : r;
  };

  // Plain text, for what is read and never run. The caller decides where it goes.
  const pedirTexto = async (a, datos) => {
    if (!BASE) return { ok: false, status: 0, texto: '' };
    try {
      const r = await fetch(url(a, datos), { credentials: 'omit', signal: AbortSignal.timeout(20000) });
      return { ok: r.ok, status: r.status, texto: r.ok ? await r.text() : '' };
    } catch {
      return { ok: false, status: 0, texto: '' };
    }
  };

  // Public answers stay in the browser cache for minutes. After a change by this person, that copy is replaced, so
  // a reload shows it. Never throws, and a failure only means the old number lasts until the cache expires.
  const refrescar = async (a, datos) => {
    if (!BASE) return;
    try {
      const r = await fetch(url(a, datos), { credentials: 'omit', cache: 'reload', signal: AbortSignal.timeout(12000) });
      await r.arrayBuffer();
    } catch {
      /* The numbers on screen are already right. */
    }
  };

  const MENSAJES = {
    bloqueada: 'Tu cuenta está bloqueada. Si creés que es un error, escribinos a info@lutastudios.com.',
    filtro: 'El servicio no recibió este envío. Puede que un filtro de seguridad de la red lo haya frenado porque se parece a un ataque, aunque no lo sea. Pasa con ejemplos de código, como los de inyección SQL. Reescribí esa parte y probá de nuevo. Si es un archivo HTML, probá subirlo como PDF o como enlace de Google.',
    lento: 'El servicio está tardando demasiado en contestar. Probá de nuevo en un rato.',
    0:'No hay conexión con el servicio. Revisá tu internet y probá de nuevo.',
    400: 'Algo del pedido no es válido. Recargá la página y probá de nuevo.',
    401: 'Tenés que ingresar con tu cuenta para hacer esto.',
    403: 'El servicio rechazó el pedido desde esta página. Recargá y probá de nuevo.',
    404: 'Eso ya no está disponible.',
    409: 'Eso ya está tomado. Probá con otro.',
    413: 'El archivo es demasiado grande. PDF, Word y PowerPoint hasta 15 MB, HTML hasta 5 MB.',
    429: 'Hubo demasiados pedidos seguidos. Probá de nuevo en un rato.',
    503: 'El servicio no está disponible ahora. Probá de nuevo en un rato.',
    507: 'El banco se quedó sin espacio. Por ahora no entran archivos nuevos.',
  };
  const mensaje = (r, propios = {}) => propios[r.error] || MENSAJES[r.error] || propios[r.status] || MENSAJES[r.status] || MENSAJES[503];
  // For a press with nothing typed (a like, a vote, a report), spread into `mensaje`: the filter's advice about
  // rewriting a text or a file does not apply there.
  const SIN_TEXTO = { filtro: 'El servicio no recibió el pedido. Probá de nuevo en un rato.' };
  const usuario = () => leerSesion()?.usuario || '';

  window.UTN_SERVICIO = { hay: Boolean(BASE), url, pedir, pedirTexto, refrescar, mensaje, usuario, ingresar, salir, SIN_TEXTO };
})();
