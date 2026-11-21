// Votes and comments under a proposed answer, with the protocol on or off. Nothing here changes the «not verified» band.
(() => {
  const S = window.UTN_SERVICIO;
  const C = window.UTN_CUENTA;
  const caja = document.querySelector('.em-votos');
  if (!S?.hay || !C || !caja) return;
  const { m, e } = caja.dataset;
  const CATEDRA = 'Coincidir entre alumnos no reemplaza a la cátedra.';
  const MOTIVOS = { 'datos-personales': 'Tiene datos personales', ofensivo: 'Es ofensivo', derechos: 'Copia material sin permiso' };

  const el = (tag, clase, texto) => {
    const x = document.createElement(tag);
    if (clase) x.className = clase;
    if (texto !== undefined) x.textContent = texto;
    return x;
  };
  const estadoNuevo = () => {
    const p = el('p', 'es-estado');
    p.setAttribute('role', 'status');
    return p;
  };
  const decir = (nodo, t, error) => {
    nodo.textContent = t;
    if (error) nodo.dataset.error = '1';
    else nodo.removeAttribute('data-error');
  };
  const fecha = (t) => {
    const f = new Date(t);
    return Number.isNaN(f.getTime()) ? '' : f.toLocaleDateString('es-AR');
  };
  const numero = (n) => Math.max(0, Number(n) || 0);
  const parte = (n, texto) => (n === 1 ? `a 1 le dio ${texto}` : `a ${n} les dio ${texto}`);
  const totales = (d) => {
    const igual = numero(d?.igual);
    const distinto = numero(d?.distinto);
    if (!igual && !distinto) return 'Todavía nadie contó cómo le dio.';
    const t = `${parte(igual, 'igual')} y ${parte(distinto, 'distinto')}.`;
    return t[0].toUpperCase() + t.slice(1);
  };

  const refrescar = () => S.refrescar('propuesta', { m, e });
  let cargada = false;
  let votoDe = '';
  let comentarios = [];
  const dato = el('p', 'pr-dato');
  dato.setAttribute('role', 'status');
  const bIgual = el('button', 'b-sec', 'Me dio igual');
  const bDistinto = el('button', 'b-sec', 'Me dio distinto');
  const estado = estadoNuevo();
  const lista = el('ul', 'pr-lista');
  const titulo = el('h3', 'pr-t', 'Comentarios');

  const marcar = (v) => {
    bIgual.setAttribute('aria-pressed', String(v === 'igual'));
    bDistinto.setAttribute('aria-pressed', String(v === 'distinto'));
  };
  const votar = async (voto) => {
    bIgual.disabled = true;
    bDistinto.disabled = true;
    const r = await C.conCuenta('Para contar cómo te dio hace falta una cuenta. Tu voto queda elegido.', () => S.pedir('votar-propuesta', { json: { m, e, voto }, cuenta: true }));
    bIgual.disabled = false;
    bDistinto.disabled = false;
    if (r.ok) {
      votoDe = S.usuario();
      marcar(voto);
      dato.textContent = totales(r.datos);
      refrescar();
      decir(estado, 'Voto guardado.');
    } else if (r.cancelado) decir(estado, 'Tu voto no se guardó porque no ingresaste.');
    else decir(estado, S.mensaje(r, { ...S.SIN_TEXTO, 404: 'Esta propuesta ya no admite votos.', 429: 'Hubo demasiados votos seguidos. Probá de nuevo en un rato.' }), true);
  };
  [[bIgual, 'igual'], [bDistinto, 'distinto']].forEach(([b, v]) => {
    b.type = 'button';
    b.setAttribute('aria-pressed', 'false');
    b.addEventListener('click', () => votar(v));
  });

  const denuncia = (id) => {
    const det = el('details', 'pr-mas');
    det.append(el('summary', '', 'Denunciar'));
    const form = el('form', 'pr-denuncia');
    const motivoId = `prMotivo${id}`;
    const et = el('label', '', 'Motivo');
    et.htmlFor = motivoId;
    const motivo = el('select');
    motivo.id = motivoId;
    Object.entries(MOTIVOS).forEach(([v, t]) => {
      const o = el('option', '', t);
      o.value = v;
      motivo.append(o);
    });
    const enviar = el('button', 'b-sec b-chico', 'Enviar denuncia');
    enviar.type = 'submit';
    const salida = estadoNuevo();
    form.append(et, motivo, enviar, salida);
    form.addEventListener('submit', async (ev) => {
      ev.preventDefault();
      enviar.disabled = true;
      const r = await C.conCuenta('Para denunciar hace falta una cuenta.', () => S.pedir('denunciar', { json: { comentario: id, motivo: motivo.value }, cuenta: true }));
      enviar.disabled = false;
      if (r.ok) {
        const hecho = estadoNuevo();
        hecho.textContent = 'Denuncia enviada.';
        hecho.tabIndex = -1;
        det.replaceWith(hecho);
        hecho.focus();
      } else if (!r.cancelado) decir(salida, S.mensaje(r, { ...S.SIN_TEXTO, 404: 'Ese comentario ya no está.', 429: 'Hubo demasiadas denuncias seguidas. Probá de nuevo en un rato.' }), true);
    });
    det.append(form);
    return det;
  };

  const fila = (c) => {
    const li = el('li', 'pr-com');
    const cab = el('p', 'pr-cab');
    cab.append(el('b', '', c.usuario || 'anónimo'), ` ${fecha(c.creado)}`);
    li.append(cab, el('p', 'pr-texto', c.texto));
    const yo = S.usuario();
    if (yo && yo === c.usuario) {
      const b = el('button', 'b-sec b-chico', 'Borrar');
      b.type = 'button';
      const salida = estadoNuevo();
      b.addEventListener('click', async () => {
        if (!window.confirm('¿Seguro?')) return;
        b.disabled = true;
        const r = await C.conCuenta('Para borrar un comentario hace falta una cuenta.', () => S.pedir('borrar-comentario', { json: { id: c.id }, cuenta: true }));
        b.disabled = false;
        if (r.ok) {
          comentarios = comentarios.filter((x) => x !== c);
          pintarLista();
          refrescar();
          decir(formEstado, 'Comentario borrado.');
          texto.focus();
        } else if (!r.cancelado) decir(salida, S.mensaje(r, { ...S.SIN_TEXTO, 403: 'Solo podés borrar los tuyos.', 404: 'Ese comentario ya no está.' }), true);
      });
      li.append(b, salida);
    } else li.append(denuncia(c.id));
    return li;
  };
  const pintarLista = () => {
    lista.replaceChildren(...comentarios.map(fila));
    lista.hidden = !comentarios.length;
    titulo.textContent = comentarios.length ? `Comentarios (${comentarios.length})` : 'Comentarios';
  };

  // The text stays in the box while the visitor signs in.
  const form = el('form', 'pr-form');
  const et = el('label', '', 'Qué querés decir');
  et.htmlFor = 'prTexto';
  const texto = el('textarea');
  texto.id = 'prTexto';
  texto.rows = 3;
  texto.maxLength = 2000;
  const enviar = el('button', 'b-sec', 'Publicar');
  enviar.type = 'submit';
  const formEstado = estadoNuevo();
  form.append(et, texto, enviar, formEstado);
  form.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const t = texto.value.trim();
    if (!t) {
      decir(formEstado, 'Escribí algo antes de publicar.', true);
      texto.focus();
      return;
    }
    decir(formEstado, '');
    enviar.disabled = true;
    const r = await C.conCuenta('Para comentar hace falta una cuenta. Tu texto queda escrito.', () => S.pedir('comentar-propuesta', { json: { m, e, texto: t }, cuenta: true }));
    enviar.disabled = false;
    if (r.cancelado) return;
    if (r.ok) {
      const nuevo = r.datos?.comentario || r.datos;
      texto.value = '';
      if (nuevo?.id !== undefined) {
        comentarios.push({ usuario: S.usuario(), creado: new Date().toISOString(), ...nuevo });
        pintarLista();
      }
      refrescar();
      decir(formEstado, 'Publicado.');
      return;
    }
    decir(formEstado, S.mensaje(r, { 400: 'El comentario puede tener hasta 2000 caracteres, sin caracteres raros.', 404: 'Esta propuesta ya no admite comentarios.', 429: 'Llegaste al tope de comentarios por hoy. Probá de nuevo mañana.' }), true);
  });

  const pintarPropio = async () => {
    const mias = (await C.misVotos()).propuestas || {};
    if (votoDe && votoDe === S.usuario()) return;
    votoDe = '';
    marcar(mias[`${m}/${e}`] || '');
  };
  // While the votes are on their way the box already has its shape (.esq in utn.css): the title, both buttons, the
  // count, the note, the comments title and the form. Each part sits in an element with the real class, so it is as tall.
  const esq = (ancho, clase = '') => {
    const s = el('span', clase ? `esq ${clase}` : 'esq');
    if (ancho) s.style.setProperty('--ancho', ancho);
    s.textContent = ' ';
    return s;
  };
  const con = (tag, clase, ...hijos) => {
    const x = el(tag, clase);
    x.append(...hijos);
    return x;
  };
  const esqueleto = () => {
    const partes = [
      con('h3', 'pr-t', esq('7.5em')),
      con('div', 'pr-botones', esq('7.3rem', 'esq-boton'), esq('8.4rem', 'esq-boton')),
      // In two pieces as long as the text, so they wrap where the words would on a narrow screen.
      con('p', 'pr-dato', esq('8em'), ' ', esq('7.4em')),
      con('p', 'pr-catedra', esq('12.5em'), ' ', esq('11.3em')),
      con('h3', 'pr-t', esq('6.5em')),
      con('div', 'pr-form', con('label', '', esq('8em')), esq('', 'esq-bloque pr-esq-texto'), esq('5.4rem', 'esq-boton')),
    ];
    partes.forEach((p) => p.setAttribute('aria-hidden', 'true'));
    caja.replaceChildren(el('span', 'vh', 'Cargando los votos y los comentarios.'), ...partes);
  };

  const cargar = async () => {
    if (cargada) return;
    cargada = true;
    esqueleto();
    caja.hidden = false;
    caja.setAttribute('aria-busy', 'true');
    const r = await S.pedir('propuesta', { datos: { m, e } });
    caja.removeAttribute('aria-busy');
    // Without an answer the proposal keeps showing as it is, with its band.
    if (!r.ok) {
      cargada = false;
      caja.hidden = true;
      caja.replaceChildren();
      return;
    }
    comentarios = Array.isArray(r.datos?.comentarios) ? r.datos.comentarios : [];
    dato.textContent = totales(r.datos);
    const titVotos = el('h3', 'pr-t', '¿Cómo te dio?');
    const botones = el('div', 'pr-botones');
    botones.append(bIgual, bDistinto);
    caja.replaceChildren(titVotos, botones, dato, el('p', 'pr-catedra', CATEDRA), estado, titulo, lista, form);
    pintarLista();
    caja.hidden = false;
    pintarPropio();
    window.addEventListener('utn:sesion', () => {
      pintarLista();
      pintarPropio();
    });
  };

  cargar();
})();
