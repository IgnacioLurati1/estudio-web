// Advice per subject: one per account, with stars, and links to the pages and bank summaries that helped.
// Without a subject the page shows the general ones, for the whole degree, which mark nothing.
// Nothing is uploaded here. Everything that comes from a person goes through textContent.
(() => {
  const S = window.UTN_SERVICIO;
  const C = window.UTN_CUENTA;
  const E = window.UTN_ESTRELLAS;
  const $ = (id) => document.getElementById(id);
  if (!S?.hay || !C || !E) return;
  $('coSin').hidden = true;
  $('coTodo').hidden = false;

  const fMateria = $('coMateria');
  const lista = $('coLista');
  const cuenta = $('coCuenta');
  const vacio = $('coVacio');
  const falla = $('coFalla');
  const escribir = $('coEscribir');
  const form = $('coForm');
  const texto = $('coTexto');
  const opciones = $('coOpciones');
  const enviar = $('coEnviar');
  const salida = $('coSalida');
  const TOPE = 3;
  const MOTIVOS = { 'datos-personales': 'Tiene datos personales', ofensivo: 'Es ofensivo', derechos: 'Copia material sin permiso' };
  const YA_NO = 'Ese consejo ya no está.';
  const YA_MATERIA = 'Ya dejaste tu consejo en esta materia. Si querés cambiarlo, borralo y escribí otro.';
  const YA_GENERAL = 'Ya dejaste tu consejo general. Si querés cambiarlo, borralo y escribí otro.';
  let serie = 0;
  let materias = [];
  let actuales = [];

  const el = (tag, clase, t) => {
    const x = document.createElement(tag);
    if (clase) x.className = clase;
    if (t !== undefined) x.textContent = t;
    return x;
  };
  const decir = (nodo, t, error) => {
    nodo.textContent = t;
    nodo.hidden = !t;
    if (error) nodo.dataset.error = '1';
    else nodo.removeAttribute('data-error');
  };
  const fecha = (t) => {
    const f = new Date(t);
    return Number.isNaN(f.getTime()) ? '' : f.toLocaleDateString('es-AR');
  };

  // Skeletons (.esq in utn.css) while the advice or the bank's summaries are on their way. Each part sits in an element
  // with the real class, so it is as tall. The words are only for screen readers.
  const esq = (ancho) => {
    const s = el('span', 'esq', ' ');
    if (ancho) s.style.setProperty('--ancho', ancho);
    return s;
  };
  const con = (tag, clase, ...hijos) => {
    const x = el(tag, clase);
    x.append(...hijos);
    return x;
  };
  // The advice text in pieces as long as words, so it wraps in as many lines as a real one: two wide, about six narrow.
  const PEDAZOS = [['12em', '10em', '13.5em', '11em', '12.5em', '9.5em'], ['13em', '9.5em', '12em', '10.5em', '13em', '8em', '11em']];
  const consejoEsq = (_, i) => {
    const li = el('li', 'co-item ba-esq');
    li.setAttribute('aria-hidden', 'true');
    const texto = el('p', 'co-texto');
    PEDAZOS[i % PEDAZOS.length].forEach((w, n) => texto.append(...(n ? [' '] : []), esq(w)));
    const estrellas = con('span', 'es-grupo', ...[1, 2, 3, 4, 5].map(() => con('span', 'estrella', esq())));
    // A subject's advice usually says what helped: that box goes too, with three links.
    const sirvio = general() ? null : con('div', 'co-sirvio', con('p', 'co-sirvio-t', esq('5em')), con('ul', '', ...['70%', '55%', '62%'].map((w) => con('li', '', esq(w)))));
    li.append(
      con('div', 'ba-nota', con('b', 'ba-prom', esq('1.4em')), con('span', 'ba-votos', esq('3.6em'))),
      con('div', 'co-cuerpo', texto, con('p', 'ba-meta', esq('11em')), ...(sirvio ? [sirvio] : []), con('div', 'es-fila', estrellas, con('span', 'es-dato', esq('10.5em')))),
      con('div', 'ba-pie', con('div', '', con('span', 'ba-esq-enlace', esq('5.2em'))))
    );
    return li;
  };
  const casillaEsq = (ancho) => con('span', 'ba-casilla', esq(), con('span', '', esq(ancho)));
  const sinControles = (t) => !/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(t);
  // No subject chosen is the general advice. The service is always told which, so the cache has one address.
  const general = () => !fMateria.value;
  const clave = () => fMateria.value || 'general';
  const materia = () => materias.find((m) => m.s === fMateria.value);
  const paginaDe = (id) => materia()?.p.find((p) => p[2] === id);

  const denuncia = (id) => {
    serie += 1;
    const caja = el('details', 'ba-mas');
    caja.append(el('summary', '', 'Denunciar'));
    const f = el('form', 'ba-form-chico');
    const sel = el('select');
    sel.id = `coMotivo${serie}`;
    const et = el('label', '', 'Motivo');
    et.htmlFor = sel.id;
    Object.entries(MOTIVOS).forEach(([v, t]) => {
      const o = el('option', '', t);
      o.value = v;
      sel.append(o);
    });
    const b = el('button', 'b-sec', 'Enviar denuncia');
    b.type = 'submit';
    const estado = el('p', 'es-estado');
    estado.setAttribute('role', 'status');
    f.append(et, sel, b, estado);
    f.addEventListener('submit', async (e) => {
      e.preventDefault();
      b.disabled = true;
      const r = await C.conCuenta('Para denunciar hace falta una cuenta.', () => S.pedir('denunciar', { json: { consejo: id, motivo: sel.value }, cuenta: true }));
      b.disabled = false;
      if (r.cancelado) return;
      if (r.ok) {
        const hecho = el('p', 'es-estado', 'Denuncia enviada.');
        hecho.setAttribute('role', 'status');
        hecho.tabIndex = -1;
        caja.replaceWith(hecho);
        hecho.focus();
        return;
      }
      decir(estado, S.mensaje(r, { ...S.SIN_TEXTO, 404: YA_NO, 429: 'Hubo demasiadas denuncias seguidas. Probá de nuevo en un rato.' }), true);
    });
    caja.append(f);
    return caja;
  };

  // What helped this person: pages of the subject and summaries from the bank, as plain links.
  const sirvio = (c) => {
    const enlaces = [];
    (c.paginas || []).forEach((p) => {
      const pag = paginaDe(p.id);
      if (!pag) return;
      const a = el('a', '', `${pag[1]}, resumen de la materia`);
      a.href = `${fMateria.value}/${pag[0]}`;
      enlaces.push(a);
    });
    (c.resumenes || []).forEach((r) => {
      const a = el('a', '', `${r.titulo}, del banco`);
      a.href = `banco.html?materia=${encodeURIComponent(fMateria.value)}#r-${encodeURIComponent(r.id)}`;
      enlaces.push(a);
    });
    if (!enlaces.length) return null;
    const caja = el('div', 'co-sirvio');
    caja.append(el('p', 'co-sirvio-t', 'Le sirvió'));
    const ul = el('ul');
    enlaces.forEach((a) => {
      const li = el('li');
      li.append(a);
      ul.append(li);
    });
    caja.append(ul);
    return caja;
  };

  const item = (c) => {
    const li = el('li', 'co-item');
    li.dataset.id = c.id;
    const n = Number(c.n) || 0;
    const nota = el('div', 'ba-nota');
    nota.setAttribute('aria-hidden', 'true');
    nota.append(el('b', 'ba-prom', n ? E.uno(c.prom) : '–'), el('span', 'ba-votos', n ? (n === 1 ? '1 voto' : `${n} votos`) : 'sin votos'));
    const cuerpo = el('div', 'co-cuerpo');
    cuerpo.append(el('p', 'co-texto', c.texto), el('p', 'ba-meta', `De ${c.usuario || 'anónimo'}. ${fecha(c.creado)}`));
    const s = sirvio(c);
    if (s) cuerpo.append(s);
    const pie = el('div', 'ba-pie');
    const yo = S.usuario();
    if (yo && yo === c.usuario) {
      cuerpo.append(el('p', 'ba-ayuda', 'Es tu consejo. Los demás lo votan.'));
      const b = el('button', 'b-sec b-chico', 'Borrar mi consejo');
      b.type = 'button';
      const estado = el('p', 'es-estado');
      estado.setAttribute('role', 'status');
      b.addEventListener('click', async () => {
        if (!window.confirm('¿Seguro?')) return;
        b.disabled = true;
        const r = await C.conCuenta('Para borrar tu consejo hace falta una cuenta.', () => S.pedir('borrar-consejo', { json: { id: c.id }, cuenta: true }));
        b.disabled = false;
        if (r.ok) {
          S.refrescar('consejos', { materia: clave() });
          await cargar();
          decir(salida, 'Consejo borrado. Podés escribir otro.');
          texto.focus();
          return;
        }
        if (!r.cancelado) decir(estado, S.mensaje(r, { ...S.SIN_TEXTO, 403: 'Solo podés borrar el tuyo.', 404: YA_NO }), true);
      });
      pie.append(b, estado);
    } else {
      const estrellas = E.crear({
        rotulo: `Votar el consejo de ${c.usuario || 'anónimo'}`,
        pedir: async (cuantas) => {
          const r = await S.pedir('votar-consejo', { json: { id: c.id, estrellas: cuantas }, cuenta: true });
          if (r.ok) {
            hechos.set(c.id, { de: S.usuario(), n: cuantas });
            S.refrescar('consejos', { materia: clave() });
          }
          return r;
        },
        mensajes: { 403: 'No podés votar tu propio consejo.', 404: YA_NO, 429: 'Votaste muchas veces seguidas. Probá de nuevo en un rato.' },
      });
      estrellas.pintar(c);
      cuerpo.append(estrellas.caja);
      li.fijarPropio = estrellas.fijarPropio;
      pie.append(denuncia(c.id));
    }
    li.append(nota, cuerpo, pie);
    return li;
  };

  // The votes this tab saved, per advice and account. They win over mis-votos, which was asked once and does not know
  // them, so a vote still shows as yours when the list is painted again after you write or delete your own advice.
  const hechos = new Map();
  const pintarPropios = async () => {
    const mias = (await C.misVotos()).consejos || {};
    const yo = S.usuario();
    [...lista.children].forEach((li) => {
      const hecho = hechos.get(li.dataset.id);
      li.fijarPropio?.(hecho && hecho.de === yo ? hecho.n : mias[li.dataset.id]);
    });
  };

  const marcar = (nombre, valor, etiqueta) => {
    const l = el('label', 'ba-casilla');
    const i = el('input');
    i.type = 'checkbox';
    i.name = nombre;
    i.value = valor;
    l.append(i, el('span', '', etiqueta));
    return l;
  };
  // Up to three of each kind. The rest of that kind waits until one is unchecked.
  const topes = () => {
    ['coPag', 'coRes'].forEach((nombre) => {
      const todas = [...form.querySelectorAll(`input[name="${nombre}"]`)];
      const llenas = todas.filter((i) => i.checked).length >= TOPE;
      todas.forEach((i) => {
        i.disabled = llenas && !i.checked;
      });
    });
  };
  opciones.addEventListener('change', topes);

  // A general one marks nothing: no pages and no summaries to choose from.
  let vueltaOpciones = 0;
  const pintarOpciones = async () => {
    vueltaOpciones += 1;
    const esta = vueltaOpciones;
    $('coSirvio').hidden = general();
    if (general()) {
      opciones.replaceChildren();
      return;
    }
    const m = materia();
    const grupo = (titulo, filas) => {
      const g = el('div', 'co-grupo');
      g.append(el('p', 'co-grupo-t', titulo), ...filas);
      return g;
    };
    const paginas = (m?.p || []).map(([, nombre, id]) => marcar('coPag', id, nombre));
    // The bank's summaries arrive later: three boxes in grey hold their place meanwhile.
    const filasEsq = [casillaEsq('16em'), casillaEsq('11em'), casillaEsq('14em')];
    filasEsq.forEach((f) => f.setAttribute('aria-hidden', 'true'));
    const espera = grupo('Resúmenes del banco', [...filasEsq, el('span', 'vh', 'Cargando los resúmenes del banco.')]);
    espera.setAttribute('aria-busy', 'true');
    opciones.replaceChildren(grupo('Páginas de la materia', paginas), espera);
    const r = await S.pedir('banco', { datos: { materia: fMateria.value } });
    if (esta !== vueltaOpciones) return;
    const resumenes = Array.isArray(r.datos?.resumenes) ? r.datos.resumenes : [];
    const banco = resumenes.length ? resumenes.map((x) => marcar('coRes', x.id, x.titulo)) : [el('p', 'ba-ayuda', 'Todavía no hay resúmenes de esta materia en el banco.')];
    espera.replaceWith(grupo('Resúmenes del banco', banco));
    topes();
  };

  const pintarEscribir = () => {
    const yo = S.usuario();
    const mio = yo && actuales.some((c) => c.usuario === yo);
    escribir.hidden = false;
    $('coEscribirTitulo').textContent = general() ? 'Dejá un consejo general' : 'Dejá tu consejo';
    document.querySelectorAll('[data-co-modo]').forEach((p) => {
      p.hidden = p.dataset.coModo !== (general() ? 'general' : 'materia');
    });
    form.hidden = Boolean(mio);
    $('coYaEsta')?.remove();
    if (mio) {
      const p = el('p', 'c-ayuda', general() ? YA_GENERAL : YA_MATERIA);
      p.id = 'coYaEsta';
      form.before(p);
    }
  };

  let vuelta = 0;
  let relojEsq = 0;
  let primera = true;
  // Three sheets fill the screen, so what is below the list is already out of sight when the advice arrives.
  const ponerEsqueleto = () => {
    lista.replaceChildren(...[0, 1, 2].map(consejoEsq));
    vacio.hidden = true;
    cuenta.replaceChildren(esq('9em'), el('span', 'vh', 'Cargando los consejos.'));
  };
  async function cargar() {
    vuelta += 1;
    const esta = vuelta;
    falla.hidden = true;
    lista.setAttribute('aria-busy', 'true');
    clearTimeout(relojEsq);
    // The first skeleton is already up from the start. Later, the old list stays dimmed for 150 ms before it.
    if (!primera) relojEsq = setTimeout(ponerEsqueleto, 150);
    const r = await S.pedir('consejos', { datos: { materia: clave() } });
    if (esta !== vuelta) return;
    clearTimeout(relojEsq);
    primera = false;
    lista.removeAttribute('aria-busy');
    const consejos = Array.isArray(r.datos?.consejos) ? r.datos.consejos : null;
    if (!r.ok || !consejos) {
      falla.hidden = false;
      $('coFallaTexto').textContent = `No se pudieron cargar los consejos. ${S.mensaje(r, { 404: 'El servicio todavía no tiene consejos.' })}`;
      lista.replaceChildren();
      vacio.hidden = true;
      cuenta.textContent = '';
      return;
    }
    actuales = consejos;
    // The server already sorted them, best voted first.
    lista.replaceChildren(...consejos.map(item));
    vacio.textContent = general() ? 'Todavía no hay consejos generales. Dejá el primero.' : 'Todavía no hay consejos para esta materia. Dejá el primero.';
    vacio.hidden = consejos.length > 0;
    const n = consejos.length;
    cuenta.textContent = !n ? '' : general() ? (n === 1 ? '1 consejo general' : `${n} consejos generales`) : n === 1 ? '1 consejo' : `${n} consejos`;
    pintarEscribir();
    pintarPropios();
  }
  $('coReintentar').addEventListener('click', cargar);

  const errorTexto = $('coTextoError');
  const marcarError = (t) => {
    errorTexto.textContent = t;
    errorTexto.hidden = !t;
    if (t) texto.setAttribute('aria-invalid', 'true');
    else texto.removeAttribute('aria-invalid');
  };
  texto.addEventListener('input', () => marcarError(''));

  const MENSAJES = {
    texto: 'El consejo tiene que tener de 10 a 1500 caracteres.',
    resumenes: 'Uno de los resúmenes que marcaste ya no está en el banco. Recargá la página y marcalos de nuevo.',
    paginas: 'Una de las páginas que marcaste no es de esta materia. Recargá la página y probá de nuevo.',
    429: 'Llegaste al tope de consejos por hoy. Probá de nuevo mañana.',
  };
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    decir(salida, '');
    const t = texto.value.trim();
    if ([...t].length < 10 || [...t].length > 1500) {
      marcarError('El consejo tiene que tener de 10 a 1500 caracteres.');
      texto.focus();
      return;
    }
    if (!sinControles(t)) {
      marcarError('El texto tiene caracteres que no se pueden usar.');
      texto.focus();
      return;
    }
    const elegidos = (nombre) => [...form.querySelectorAll(`input[name="${nombre}"]:checked`)].map((i) => i.value);
    const marcas = general() ? {} : { resumenes: elegidos('coRes'), paginas: elegidos('coPag') };
    enviar.disabled = true;
    const r = await C.conCuenta('Para dejar un consejo hace falta una cuenta. Tu texto queda escrito.', () => S.pedir('aconsejar', { json: { materia: clave(), texto: t, ...marcas }, cuenta: true }));
    enviar.disabled = false;
    if (r.cancelado) return;
    if (r.ok) {
      form.reset();
      topes();
      S.refrescar('consejos', { materia: clave() });
      await cargar();
      decir(salida, 'Publicado. Gracias por dejarlo.');
      salida.focus();
      return;
    }
    if (r.error === 'texto') {
      marcarError(MENSAJES.texto);
      texto.focus();
      return;
    }
    decir(salida, S.mensaje(r, { ...MENSAJES, 'ya-aconsejaste': general() ? YA_GENERAL : YA_MATERIA }), true);
    salida.focus();
  });

  const elegirDeUrl = () => {
    const v = new URLSearchParams(location.search).get('materia') || '';
    if ([...fMateria.options].some((o) => o.value === v)) fMateria.value = v;
  };
  const cambiar = () => {
    history.replaceState(null, '', `${location.pathname}${fMateria.value ? `?materia=${encodeURIComponent(fMateria.value)}` : ''}`);
    document.querySelectorAll('[data-con-materia]').forEach((a) => {
      a.href = `subir.html${fMateria.value ? `?materia=${encodeURIComponent(fMateria.value)}` : ''}`;
    });
    decir(salida, '');
    cargar();
    pintarOpciones();
  };
  fMateria.addEventListener('change', cambiar);
  window.addEventListener('utn:sesion', () => cargar());

  // The list's place is taken now, before the list of subjects and the advice come.
  elegirDeUrl();
  ponerEsqueleto();
  lista.setAttribute('aria-busy', 'true');
  fetch('_/materias.json', { credentials: 'omit' })
    .then((r) => (r.ok ? r.json() : []))
    .catch(() => [])
    .then((datos) => {
      materias = Array.isArray(datos) ? datos : [];
      elegirDeUrl();
      cambiar();
    });
})();
