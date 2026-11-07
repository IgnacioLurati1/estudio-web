// Account dialog: sign up, sign in, sign out and delete. Username and password only, with no way to recover them.
(() => {
  const S = window.UTN_SERVICIO;
  if (!S?.hay) return;
  const RESERVADOS = ['admin', 'luta', 'lutastudios', 'utn', 'catedra', 'docente', 'moderador'];
  const CLAVE_LARGA = 'La contraseña es demasiado larga. Los acentos, la ñ y los emojis cuentan como más de un carácter. Probá con una más corta.';

  const el = (tag, props = {}, ...hijos) => {
    const x = document.createElement(tag);
    Object.assign(x, props);
    x.append(...hijos);
    return x;
  };
  const dlg = el('dialog', { className: 'dlg dlg-cuenta' });
  let resolver = null;
  let motivo = '';

  const terminar = (ok) => {
    const r = resolver;
    resolver = null;
    motivo = '';
    if (dlg.open) dlg.close();
    r?.(ok);
  };
  dlg.addEventListener('close', () => terminar(Boolean(S.usuario())));

  const campo = (texto, input, ayuda) => {
    const id = input.id;
    const hijos = [el('label', { htmlFor: id, textContent: texto }), input];
    if (ayuda) {
      const a = el('small', { id: `${id}Ayuda`, textContent: ayuda });
      input.setAttribute('aria-describedby', a.id);
      hijos.push(a);
    }
    const error = el('p', { id: `${id}Error`, className: 'cu-error', hidden: true });
    hijos.push(error);
    return el('div', { className: 'cu-campo' }, ...hijos);
  };
  const marcar = (input, texto) => {
    const e = document.getElementById(`${input.id}Error`);
    e.textContent = texto;
    e.hidden = !texto;
    if (texto) {
      input.setAttribute('aria-invalid', 'true');
      input.setAttribute('aria-describedby', [input.getAttribute('aria-describedby'), e.id].filter(Boolean).join(' '));
    } else input.removeAttribute('aria-invalid');
  };
  const mostrarClave = (clave) => {
    const c = el('input', { type: 'checkbox' });
    c.addEventListener('change', () => {
      clave.type = c.checked ? 'text' : 'password';
    });
    return el('label', { className: 'cu-mostrar' }, c, ' Mostrar la contraseña');
  };
  // The alert role is there from the start, so a screen reader hears the message when it shows up.
  const pie = () => {
    const p = el('p', { className: 'dlg-estado cu-salida', hidden: true });
    p.setAttribute('role', 'alert');
    return p;
  };
  const decir = (nodo, texto) => {
    nodo.textContent = texto;
    nodo.hidden = !texto;
  };
  // While a request runs the button says so and keeps the focus. A request that fails to even go out reads as no connection.
  const esperar = async (boton, texto, pedido) => {
    const antes = boton.textContent;
    boton.setAttribute('aria-disabled', 'true');
    boton.textContent = texto;
    try {
      return await pedido();
    } catch {
      return { ok: false, status: 503, error: '' };
    } finally {
      boton.removeAttribute('aria-disabled');
      boton.textContent = antes;
    }
  };
  const ocupado = (boton) => boton.getAttribute('aria-disabled') === 'true';
  const revisarUsuario = (u, alta) => {
    if (u.length < 3 || u.length > 24) return 'El usuario tiene que tener de 3 a 24 caracteres.';
    if (!/^[a-z0-9_.-]+$/.test(u)) return 'Usá solo minúsculas, números, guion, guion bajo y punto.';
    if (alta && RESERVADOS.includes(u)) return 'Ese usuario está reservado. Probá con otro.';
    return '';
  };
  const usuarioInput = (id, autocomplete) => {
    const i = el('input', { id, type: 'text', autocomplete, spellcheck: false, autocapitalize: 'none', maxLength: 24 });
    // Lowercase and without spaces, keeping the cursor where it was.
    const limpiar = (t) => t.toLowerCase().replace(/\s+/g, '');
    i.addEventListener('input', () => {
      const limpio = limpiar(i.value);
      if (limpio !== i.value) {
        const lugar = limpio.length - limpiar(i.value.slice(i.selectionEnd ?? i.value.length)).length;
        i.value = limpio;
        i.setSelectionRange(lugar, lugar);
      }
      marcar(i, '');
    });
    return i;
  };
  const claveInput = (id, autocomplete) => {
    const i = el('input', { id, type: 'password', autocomplete, maxLength: 72 });
    i.addEventListener('input', () => marcar(i, ''));
    return i;
  };
  const botonCerrar = (texto = 'Cancelar') => {
    const b = el('button', { type: 'button', className: 'b-sec', textContent: texto });
    b.addEventListener('click', () => dlg.close());
    return b;
  };
  const enfocar = (x) => requestAnimationFrame(() => x.focus());
  // Without an account, one line on what it is for. Only where progress is kept (progreso.js).
  const P = () => window.UTN_PROGRESO;
  const invitacion = () => (P() ? [el('p', { className: 'cu-nota', textContent: 'Con una cuenta, tu progreso se guarda y lo ves en cualquier dispositivo.' })] : []);

  const vistaIngresar = () => {
    const u = usuarioInput('cuUsuario', 'username');
    const c = claveInput('cuClave', 'current-password');
    const salida = pie();
    const enviar = el('button', { type: 'submit', className: 'b-pri', textContent: 'Ingresar' });
    const crear = el('button', { type: 'button', className: 'cu-enlace', textContent: 'Crear una cuenta' });
    crear.addEventListener('click', () => pintar(vistaAlta));
    const form = el('form', { noValidate: true },
      el('h2', { textContent: 'Ingresar' }),
      ...(motivo ? [el('p', { className: 'cu-motivo', textContent: motivo })] : []),
      campo('Usuario', u),
      campo('Contraseña', c),
      mostrarClave(c),
      salida,
      el('div', { className: 'dlg-botones' }, enviar, botonCerrar()),
      el('p', { className: 'cu-otra' }, '¿Todavía no tenés cuenta? ', crear),
      ...invitacion());
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (ocupado(enviar)) return;
      decir(salida, '');
      const eu = revisarUsuario(u.value, false);
      marcar(u, eu);
      marcar(c, c.value ? '' : 'Escribí tu contraseña.');
      if (eu || !c.value) {
        (eu ? u : c).focus();
        return;
      }
      const r = await esperar(enviar, 'Ingresando…', () => S.ingresar(u.value, c.value));
      if (r.ok) {
        terminar(true);
        return;
      }
      decir(salida, S.mensaje(r, { 400: 'El usuario o la contraseña no coinciden.', 401: 'El usuario o la contraseña no coinciden.', 429: 'Hubo demasiados intentos. Probá de nuevo en un rato.' }));
      c.focus();
    });
    enfocar(u);
    return form;
  };

  const vistaAlta = () => {
    const u = usuarioInput('cuNuevo', 'username');
    const c = claveInput('cuNuevaClave', 'new-password');
    const ok = el('input', { type: 'checkbox', id: 'cuAcepto' });
    ok.addEventListener('change', () => marcar(ok, ''));
    const salida = pie();
    const enviar = el('button', { type: 'submit', className: 'b-pri', textContent: 'Crear cuenta' });
    const volver = el('button', { type: 'button', className: 'cu-enlace', textContent: 'Ingresá' });
    volver.addEventListener('click', () => pintar(vistaIngresar));
    const priv = el('a', { href: new URL(document.querySelector('.pie a[href$="privacidad.html"]')?.getAttribute('href') || 'privacidad.html', location.href).href, textContent: 'privacidad', target: '_blank', rel: 'noopener' });
    priv.setAttribute('aria-label', 'privacidad (se abre en otra pestaña)');
    const form = el('form', { noValidate: true },
      el('h2', { textContent: 'Crear una cuenta' }),
      ...(motivo ? [el('p', { className: 'cu-motivo', textContent: motivo })] : []),
      el('p', { className: 'cu-aviso', textContent: 'No pedimos mail. Si olvidás la contraseña no hay forma de recuperarla y vas a tener que crear otra cuenta.' }),
      ...invitacion(),
      campo('Usuario', u, 'De 3 a 24 caracteres, en minúscula. Se ve al lado de lo que publiques.'),
      campo('Contraseña', c, 'De 8 a 72 caracteres.'),
      mostrarClave(c),
      el('div', { className: 'cu-campo' },
        el('label', { className: 'cu-casilla' }, ok, el('span', {}, 'Leí la página de ', priv, ' y acepto lo que dice.')),
        el('p', { id: 'cuAceptoError', className: 'cu-error', hidden: true })),
      salida,
      el('div', { className: 'dlg-botones' }, enviar, botonCerrar()),
      el('p', { className: 'cu-otra' }, '¿Ya tenés cuenta? ', volver));
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (ocupado(enviar)) return;
      decir(salida, '');
      const eu = revisarUsuario(u.value, true);
      // Like the service: at least 8 characters and at most 72 bytes, where an accent, a ñ or an emoji takes more than one.
      const ec = [...c.value].length < 8 ? 'La contraseña tiene que tener de 8 a 72 caracteres.' : new TextEncoder().encode(c.value).length > 72 ? CLAVE_LARGA : '';
      const ea = ok.checked ? '' : 'Hace falta que lo aceptes para crear la cuenta.';
      marcar(u, eu);
      marcar(c, ec);
      marcar(ok, ea);
      const primero = [[eu, u], [ec, c], [ea, ok]].find(([t]) => t);
      if (primero) {
        primero[1].focus();
        return;
      }
      const r = await esperar(enviar, 'Creando la cuenta…', () => S.pedir('registrar', { json: { usuario: u.value, contrasena: c.value, acepto: true } }));
      if (!r.ok) {
        const texto = S.mensaje(r, {
          'usuario-tomado': 'Ese usuario ya existe. Probá con otro.',
          contrasena: 'Esa contraseña no se puede usar. Probá con otra, de 8 a 72 caracteres.',
          acepto: 'Hace falta que lo aceptes para crear la cuenta.',
          400: 'Ese usuario no se puede usar. Probá con otro.',
          409: 'Ese usuario ya existe. Probá con otro.',
          429: 'Se crearon demasiadas cuentas hoy. Probá de nuevo mañana.',
        });
        // A refused password or a missing consent go next to their own field, not the username's.
        const donde = r.error === 'contrasena' ? c : r.error === 'acepto' ? ok : r.status === 400 || r.status === 409 ? u : null;
        if (donde) {
          marcar(donde, texto);
          donde.focus();
        } else decir(salida, texto);
        return;
      }
      const i = await esperar(enviar, 'Ingresando…', () => S.ingresar(u.value, c.value));
      if (i.ok) terminar(true);
      else {
        pintar(vistaIngresar);
        decir(dlg.querySelector('.cu-salida'), 'La cuenta se creó. Ingresá con tu usuario y contraseña.');
      }
    });
    enfocar(u);
    return form;
  };

  const vistaCuenta = () => {
    const salir = el('button', { type: 'button', className: 'b-pri', textContent: 'Salir' });
    // What is safe in the account leaves this browser first, so nothing of it stays on a shared computer.
    salir.addEventListener('click', async () => {
      salir.disabled = true;
      let recargar = false;
      try {
        recargar = (await P()?.alSalir())?.recargar === true;
      } catch {
        /* Signing out goes on: what did not go up stays here. */
      }
      S.salir();
      dlg.close();
      if (recargar) location.reload();
    });
    const c = claveInput('cuBorrarClave', 'current-password');
    const salida = pie();
    const borrar = el('button', { type: 'submit', className: 'b-peligro', textContent: 'Borrar mi cuenta' });
    const form = el('form', { noValidate: true, className: 'cu-borrar' },
      el('p', { textContent: 'Se van tus votos, tus comentarios y el progreso guardado. Lo que mandaste a Super CVG queda desvinculado. Lo que hay en este navegador queda. Tus resúmenes quedan con autor anónimo y tus reportes, sin tu nombre. No se puede deshacer.' }),
      campo('Tu contraseña', c),
      salida,
      borrar);
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (ocupado(borrar)) return;
      decir(salida, '');
      if (!c.value) {
        marcar(c, 'Escribí tu contraseña para confirmar.');
        c.focus();
        return;
      }
      if (!window.confirm('¿Seguro? Tu cuenta se borra para siempre.')) return;
      const r = await esperar(borrar, 'Borrando…', () => S.pedir('borrar-cuenta', { json: { contrasena: c.value }, cuenta: true }));
      if (r.ok) {
        P()?.desvincular();
        S.salir();
        dlg.close();
        return;
      }
      const texto = S.mensaje(r, { 400: 'La contraseña no coincide.', 403: 'La contraseña no coincide.' });
      if (r.status === 400 || (r.status === 403 && r.error !== 'bloqueada')) {
        marcar(c, texto);
        c.focus();
      } else decir(salida, texto);
    });
    const abre = el('details', { className: 'cu-det' }, el('summary', { textContent: 'Borrar mi cuenta' }), form);
    // How the progress is going, kept up to date while the dialog is open.
    const progreso = P() ? el('p', { className: 'cu-progreso', textContent: P().texto() }) : null;
    if (progreso) {
      progreso.setAttribute('role', 'status');
      const pintarProgreso = () => {
        if (!progreso.isConnected) {
          window.removeEventListener('utn:progreso', pintarProgreso);
          return;
        }
        progreso.textContent = P().texto();
        progreso.dataset.falla = P().estado().fase === 'listo' ? '' : '1';
      };
      progreso.dataset.falla = P().estado().fase === 'listo' ? '' : '1';
      window.addEventListener('utn:progreso', pintarProgreso);
    }
    // Coming from Super CVG (#cuenta), its part takes the focus once it knows whether the account is linked.
    const aCvg = irACvg;
    irACvg = false;
    const vista = el('div', {},
      el('h2', { textContent: 'Tu cuenta' }),
      el('p', {}, 'Ingresaste como ', el('b', { textContent: S.usuario() }), '.'),
      ...(progreso ? [progreso] : []),
      el('div', { className: 'dlg-botones' }, salir, botonCerrar('Cerrar')),
      ...(P() ? [el('p', { className: 'cu-nota', textContent: 'Al salir, tu progreso se borra de este navegador y sigue en tu cuenta.' })] : []),
      parteSuperCvg(aCvg),
      listaReportes(),
      abre);
    if (!aCvg) enfocar(salir);
    return vista;
  };

  // ----- Super CVG (013): linked, it shows what you uploaded to the bank and what you send it from there.

  const SUPER_CVG = 'https://supercvg.lutastudios.com/resumenes';
  const CODIGO_CVG = /^[A-Za-z0-9_-]{32}$/;
  let irACvg = false;
  const horaDe = (f) => f.toLocaleTimeString('es-AR', { hour: 'numeric', minute: '2-digit', hourCycle: 'h23' });
  // «hoy, a las 14:05», «ayer, a las 09:30» or «el 3/11, a las 18:20».
  const cuandoFue = (iso) => {
    const f = new Date(iso);
    if (Number.isNaN(f.getTime())) return '';
    const dia = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
    const dias = Math.round((dia(new Date()) - dia(f)) / 86400e3);
    const fecha = dias === 0 ? 'hoy' : dias === 1 ? 'ayer' : `el ${f.toLocaleDateString('es-AR', { day: 'numeric', month: 'numeric', ...(f.getFullYear() === new Date().getFullYear() ? {} : { year: 'numeric' }) })}`;
    return `${fecha}, a las ${horaDe(f)}`;
  };

  const parteSuperCvg = (enfocarAlCargar) => {
    const caja = el('section', { className: 'cu-cvg' });
    caja.setAttribute('aria-labelledby', 'cuCvgT');
    const cuerpo = el('div', { className: 'cu-cvg-cuerpo' });
    const salida = pie();
    caja.append(el('h3', { id: 'cuCvgT', textContent: 'Super CVG' }), cuerpo, salida);
    let primera = enfocarAlCargar;
    // Each paint counts: a reading that comes back after a newer one, or after linking or unlinking, is dropped.
    let vuelta = 0;
    let leido = 0;
    // Swaps what is shown. The button of the new state takes the focus if the old one had it, so it never falls out
    // of the dialog, and the first time when coming from Super CVG.
    const poner = (boton, ...nodos) => {
      const tenia = cuerpo.contains(document.activeElement);
      cuerpo.removeAttribute('aria-busy');
      cuerpo.replaceChildren(...nodos);
      if (primera) {
        primera = false;
        caja.scrollIntoView({ block: 'nearest' });
        boton?.focus();
      } else if (tenia) boton?.focus();
    };

    // Two lines and a button, the size of either state.
    const pintarCargando = () => {
      const esq = (clase, ancho) => {
        const s = el('span', { className: clase, textContent: ' ' });
        s.style.setProperty('--ancho', ancho);
        return s;
      };
      cuerpo.replaceChildren(
        el('p', { className: 'cu-nota' }, esq('esq', '100%'), ' ', esq('esq', '62%')),
        esq('esq esq-boton', '11.5rem'),
        el('span', { className: 'vh', textContent: 'Viendo si tu cuenta está vinculada.' }));
      cuerpo.setAttribute('aria-busy', 'true');
    };

    const pintarSinVincular = () => {
      const vincular = el('button', { type: 'button', className: 'b-sec', textContent: 'Vincular con Super CVG' });
      const enlace = el('p', { className: 'cu-nota cu-cvg-enlace' });
      enlace.setAttribute('role', 'status');
      vincular.addEventListener('click', async () => {
        if (ocupado(vincular)) return;
        vuelta += 1;
        decir(salida, '');
        enlace.replaceChildren();
        // The tab opens on this same press, before waiting: later the browser would block it. Without the opener,
        // the page over there cannot reach this one.
        let ventana = null;
        try {
          ventana = window.open('about:blank', '_blank');
          if (ventana) ventana.opener = null;
        } catch {
          ventana = null;
        }
        const r = await esperar(vincular, 'Vinculando…', () => S.pedir('cvg-codigo', { json: {}, cuenta: true }));
        const codigo = r.ok ? r.datos?.codigo : '';
        if (typeof codigo !== 'string' || !CODIGO_CVG.test(codigo)) {
          ventana?.close();
          decir(salida, S.mensaje(r.ok ? { status: 503, error: '' } : r, S.SIN_TEXTO));
          return;
        }
        // The code goes after the «#», which never reaches a server, and works once.
        const destino = `${SUPER_CVG}#vincular=${codigo}`;
        if (ventana && !ventana.closed) {
          ventana.location.href = destino;
          enlace.textContent = 'Seguí en la pestaña de Super CVG.';
          return;
        }
        const a = el('a', { href: destino, target: '_blank', rel: 'noopener', textContent: 'Seguir en Super CVG' });
        a.setAttribute('aria-label', 'Seguir en Super CVG (se abre en otra pestaña)');
        enlace.replaceChildren('Tu navegador no abrió la pestaña. ', a);
        a.focus();
      });
      poner(vincular,
        el('p', { className: 'cu-nota', textContent: 'Vinculá tu cuenta y en Super CVG ves los resúmenes que subiste y los que mandás desde el banco. No tenés que escribir tu contraseña ahí.' }),
        vincular,
        enlace);
    };

    const pintarVinculado = (ultimo) => {
      const desvincular = el('button', { type: 'button', className: 'b-sec', textContent: 'Desvincular' });
      desvincular.addEventListener('click', async () => {
        if (ocupado(desvincular)) return;
        decir(salida, '');
        if (!window.confirm('¿Seguro? Super CVG deja de mostrar tus resúmenes hasta que lo vincules de nuevo.')) return;
        vuelta += 1;
        const r = await esperar(desvincular, 'Desvinculando…', () => S.pedir('cvg-desvincular-todo', { json: {}, cuenta: true }));
        if (!r.ok) {
          decir(salida, S.mensaje(r, S.SIN_TEXTO));
          return;
        }
        vuelta += 1;
        pintarSinVincular();
      });
      const cuando = cuandoFue(ultimo);
      poner(desvincular,
        el('p', { className: 'cu-cvg-si' }, el('b', { textContent: 'Vinculado con Super CVG.' }), cuando ? ` Lo usaste por última vez ${cuando}.` : ''),
        desvincular);
    };

    const pintarFalla = (r) => {
      const otra = el('button', { type: 'button', className: 'b-sec', textContent: 'Probar de nuevo' });
      otra.addEventListener('click', () => {
        if (!ocupado(otra)) esperar(otra, 'Probando…', leer);
      });
      poner(otra, el('p', { className: 'cu-nota', textContent: `No se pudo ver si tu cuenta está vinculada. ${S.mensaje(r, S.SIN_TEXTO)}` }), otra);
    };

    const leer = async () => {
      vuelta += 1;
      const esta = vuelta;
      leido = Date.now();
      if (!cuerpo.childElementCount) pintarCargando();
      const r = await S.pedir('cvg-estado', { cuenta: true });
      if (esta !== vuelta || !caja.isConnected) return;
      if (!r.ok) pintarFalla(r);
      else if (Number(r.datos?.llaves) > 0) pintarVinculado(r.datos.ultimo_uso);
      else pintarSinVincular();
    };
    // Linking ends in the other tab. Back here, it reads the state again while this part is on screen, unless a press
    // is on its way.
    const alVolver = () => {
      if (!caja.isConnected) {
        window.removeEventListener('focus', alVolver);
        document.removeEventListener('visibilitychange', alVolver);
        return;
      }
      if (!dlg.open || document.visibilityState === 'hidden' || Date.now() - leido < 2000) return;
      if (cuerpo.querySelector('[aria-disabled="true"]')) return;
      leer();
    };
    window.addEventListener('focus', alVolver);
    document.addEventListener('visibilitychange', alVolver);
    leer();
    return caja;
  };

  // ----- Your corrections (012): what you reported and what we answered.

  // Where the site lives, from this script's own address: …/utn/_/cuenta.js.
  const raiz = (() => {
    const s = [...document.scripts].find((x) => /\/cuenta\.js(\?|$)/.test(x.src));
    return s ? new URL('../', s.src).href : new URL('./', location.href).href;
  })();
  const NOMBRE = /^[a-z0-9_-]{1,100}$/;
  const enlaceDe = (r) => {
    if (!NOMBRE.test(r.materia || '') || !NOMBRE.test(r.pagina || '')) return '';
    const seccion = typeof r.seccion === 'string' && /^[a-z0-9-]{1,100}$/.test(r.seccion) ? `#${r.seccion}` : '';
    return new URL(`${r.materia === '_' ? '' : `${r.materia}/`}${r.pagina}.html${seccion}`, raiz).href;
  };
  const lugarDe = (r) => [r.materia_nombre, r.pagina_nombre].filter((x) => typeof x === 'string' && x).join(', ') || 'el sitio';
  const ESTADO_REPORTE = { abierto: 'Pendiente', resuelto: 'Arreglado', descartado: 'Descartado' };
  // Closed and not seen yet. A discarded one only says something when it brings an answer.
  const novedad = (r) => !r.visto && (r.estado === 'resuelto' || (r.estado === 'descartado' && r.respuesta));

  const misReportes = async () => {
    const r = await S.pedir('mis-reportes', { cuenta: true });
    return r.ok && Array.isArray(r.datos?.reportes) ? r.datos.reportes : null;
  };
  const marcarVistos = (lista) => {
    const ids = lista.filter((r) => !r.visto && r.estado !== 'abierto').map((r) => r.id).slice(0, 50);
    // keepalive: «Ver» goes to another page right after.
    if (ids.length) S.pedir('reportes-vistos', { json: { ids }, cuenta: true, keepalive: true });
  };

  // Shown only when there is something: the last ten, newest first, and seeing them counts as seen.
  const listaReportes = () => {
    const caja = el('section', { className: 'cu-reportes', hidden: true });
    caja.setAttribute('aria-labelledby', 'cuRepT');
    misReportes().then((lista) => {
      if (!lista?.length || !caja.isConnected) return;
      const items = lista.slice(0, 10).map((r) => {
        const enlace = enlaceDe(r);
        const donde = enlace ? el('a', { href: enlace, textContent: lugarDe(r) }) : el('span', { textContent: lugarDe(r) });
        const hijos = [
          el('p', { className: 'cu-rep-donde' }, donde, ' ', el('span', { className: `cu-rep-estado cu-rep-${r.estado}`, textContent: ESTADO_REPORTE[r.estado] || '' })),
          el('p', { className: 'cu-rep-texto', textContent: [...String(r.texto || '')].length > 140 ? `${[...String(r.texto)].slice(0, 139).join('')}…` : String(r.texto || '') }),
        ];
        if (r.estado !== 'abierto' && r.respuesta) hijos.push(el('p', { className: 'cu-rep-respuesta' }, el('b', { textContent: 'Respuesta: ' }), String(r.respuesta)));
        return el('li', {}, ...hijos);
      });
      caja.replaceChildren(el('h3', { id: 'cuRepT', textContent: 'Tus correcciones' }), el('ul', { className: 'dlg-lista cu-rep-lista' }, ...items));
      caja.hidden = false;
      marcarVistos(lista);
    });
    return caja;
  };

  // A discreet notice when something you reported was closed. At most every ten minutes, and closing it or going to it
  // counts as seen.
  const MIRADO = 'utn:reportes-mirado';
  const avisarReportes = async () => {
    const A = P()?.aviso;
    if (!A || !S.usuario()) return;
    let antes = null;
    try {
      antes = localStorage.getItem(MIRADO);
      if (Date.now() - Number(antes || 0) < 10 * 60_000) return;
      localStorage.setItem(MIRADO, String(Date.now()));
    } catch {
      return;
    }
    const lista = await misReportes();
    const nuevas = (lista || []).filter(novedad);
    if (!nuevas.length || dlg.open) return;
    // Another notice is on screen (asking to reload, for one): it stays, and this one waits for the next page.
    if (document.querySelector('.pg-aviso')) {
      try {
        if (antes === null) localStorage.removeItem(MIRADO);
        else localStorage.setItem(MIRADO, antes);
      } catch {
        /* It comes back in ten minutes. */
      }
      return;
    }
    const vistos = () => marcarVistos(nuevas);
    if (nuevas.length === 1) {
      const [r] = nuevas;
      const enlace = enlaceDe(r);
      A({
        texto: r.estado === 'resuelto' ? `Arreglamos lo que reportaste en ${lugarDe(r)}.` : `Revisamos lo que reportaste en ${lugarDe(r)}.`,
        detalle: r.respuesta ? String(r.respuesta) : '',
        accion: enlace ? { texto: 'Ver', href: enlace, alHacer: vistos } : null,
        alCerrar: vistos,
      });
      return;
    }
    const todas = nuevas.every((r) => r.estado === 'resuelto');
    const aviso = A({
      texto: todas ? `Arreglamos ${nuevas.length} cosas que reportaste.` : `Revisamos ${nuevas.length} cosas que reportaste.`,
      accion: {
        texto: 'Ver cuáles',
        alHacer: () => {
          aviso.cerrar();
          abrir();
        },
      },
      alCerrar: vistos,
    });
  };

  // The title of each view names the dialog.
  const pintar = (vista) => {
    dlg.replaceChildren(vista());
    const h = dlg.querySelector('h2');
    if (h) {
      h.id = 'cuTitulo';
      dlg.setAttribute('aria-labelledby', h.id);
    }
  };

  // Opens the dialog, on the sign-up form with `alta`. Resolves true once there is a session. With `parte: 'cvg'` and a
  // session, the Super CVG part takes the focus.
  const abrir = (texto = '', { alta = false, parte = '' } = {}) => new Promise((resolve) => {
    if (dlg.open) {
      resolve(Boolean(S.usuario()));
      return;
    }
    resolver = resolve;
    motivo = texto;
    irACvg = parte === 'cvg' && Boolean(S.usuario());
    if (!dlg.isConnected) document.body.append(dlg);
    pintar(S.usuario() ? vistaCuenta : alta ? vistaAlta : vistaIngresar);
    dlg.showModal();
  });

  // Super CVG sends here with #cuenta to link the account. Without a session it asks to sign in first. The address
  // loses the hash at once, so a reload does not open the dialog again.
  const desdeCvg = async () => {
    if (location.hash !== '#cuenta') return;
    history.replaceState(history.state, '', location.pathname + location.search);
    if (dlg.open) return;
    if (S.usuario()) {
      abrir('', { parte: 'cvg' });
      return;
    }
    // The dialog's close event comes after the sign-in resolves. Opening again before it would get closed by it.
    const cerrado = new Promise((r) => dlg.addEventListener('close', r, { once: true }));
    if (!(await abrir('Ingresá para vincular tu cuenta con Super CVG.'))) return;
    await cerrado;
    abrir('', { parte: 'cvg' });
  };

  // Runs an action that needs an account, asking to sign in first and once more if the session expired.
  const conCuenta = async (texto, accion) => {
    if (!S.usuario() && !(await abrir(texto))) return { ok: false, cancelado: true, status: 401, error: '' };
    let r = await accion();
    if (r.status === 401) {
      S.salir();
      if (!(await abrir('Tu sesión venció. Ingresá de nuevo.'))) return { ok: false, cancelado: true, status: 401, error: '' };
      r = await accion();
    }
    return r;
  };

  let votos = null;
  const misVotos = () => {
    if (!S.usuario()) return Promise.resolve({ materias: {}, resumenes: {}, propuestas: {}, consejos: {} });
    if (!votos) {
      votos = S.pedir('mis-votos', { cuenta: true }).then((r) => ({ materias: r.datos?.materias || {}, resumenes: r.datos?.resumenes || {}, propuestas: r.datos?.propuestas || {}, consejos: r.datos?.consejos || {} }));
    }
    return votos;
  };

  const botones = () => document.querySelectorAll('[data-cuenta]');
  const pintarBotones = () => {
    const u = S.usuario();
    botones().forEach((b) => {
      b.hidden = false;
      b.textContent = u || 'Ingresar';
      if (u) b.setAttribute('aria-label', `Tu cuenta, ${u}`);
      else b.removeAttribute('aria-label');
    });
  };
  window.addEventListener('utn:sesion', () => {
    votos = null;
    pintarBotones();
    avisarReportes();
  });
  document.addEventListener('click', (e) => {
    if (e.target.closest?.('[data-cuenta]')) abrir();
  });
  pintarBotones();
  avisarReportes();
  window.addEventListener('hashchange', desdeCvg);
  desdeCvg();

  window.UTN_CUENTA = { abrir, conCuenta, misVotos };
})();
