// «Mis resúmenes»: what this account uploaded to the bank, with its state, and from there edit its title, instance
// and tags or upload a new version. The sheets and dialogs are the bank's (banco.js, window.UTN_BANCO). Everything
// that comes from the service goes through textContent.
(() => {
  const S = window.UTN_SERVICIO;
  const C = window.UTN_CUENTA;
  const B = window.UTN_BANCO;
  const $ = (id) => document.getElementById(id);
  const lista = $('miLista');
  if (!S?.hay || !C || !B || !lista) return;
  const { el, con, esq, oculto, decir, estadoNuevo, boton, botones, dialogo, hojaDe, hojaEsq, peso, fecha, formatoDe, FORMATOS, nombreMateria, nombreInstancia, sinControles, abrirVersion, campoTemas, YA_NO } = B;

  const ingresar = $('miIngresar');
  const noEsta = $('miNoEsta');
  const falla = $('miFalla');
  const fallaTexto = $('miFallaTexto');
  const cuenta = $('miCuenta');
  const vacio = $('miVacio');
  const instancias = [...document.getElementById('baOpciones').content.getElementById('baInstancia').options].map((o) => [o.value, o.textContent]);

  // A service from before these actions answers 404 «ruta-desconocida»: the page says it is not there yet, and the
  // edit button goes away if only «editar» is missing.
  const sinRuta = (r) => r.status === 404 && ['ruta-desconocida', 'accion-desconocida'].includes(r.error);
  let puedeEditar = true;

  // The state, as a stamp on the sheet: in review, published or not published.
  const SELLOS = { pendiente: 'En revisión', publicado: 'Publicado', oculto: 'No publicado' };
  const estadoDe = (r) => (SELLOS[r.estado] ? r.estado : 'pendiente');

  const filaEsq = (_, i) => {
    const li = el('li', 'mi-item ba-esq');
    li.setAttribute('aria-hidden', 'true');
    li.append(
      con('div', 'ba-hoja mi-hoja', hojaEsq()),
      con('div', 'mi-texto',
        con('p', 'mi-sello-esq', esq('6.5em')),
        con('h3', 'mi-titulo', esq(['72%', '58%', '66%'][i % 3])),
        con('p', 'mi-meta', esq('88%')),
        con('p', 'mi-numeros', esq('40%')),
        con('div', 'mi-acciones', esq('4.6rem', 'esq-boton esq-chico'), esq('11rem', 'esq-boton esq-chico'))));
    return li;
  };

  const cuantos = (n, uno, varios) => (n === 1 ? `1 ${uno}` : `${n.toLocaleString('es-AR')} ${varios}`);
  const metaDe = (r) => {
    const partes = [`${nombreMateria(r.materia)}.`, `${nombreInstancia(r.instancia)}.`];
    const formato = FORMATOS[formatoDe(r.tipo)]?.nombre;
    const p = peso(r.bytes);
    if (formato || p) partes.push(`${[formato, p].filter(Boolean).join(', ')}.`);
    const version = Number(r.version) || 1;
    const creado = fecha(r.creado);
    const actualizado = fecha(r.actualizado);
    const cuando = actualizado || creado;
    if (version > 1) partes.push(`Versión ${version}${cuando ? `, del ${cuando}` : ''}.`);
    else if (creado) partes.push(`Subido el ${creado}.`);
    return partes.join(' ');
  };
  const numerosDe = (r) => [
    cuantos(Number(r.me_gusta) || 0, 'me gusta', 'me gusta'),
    cuantos(Number(r.descargas) || 0, 'descarga', 'descargas'),
    cuantos(Number(r.comentarios) || 0, 'comentario', 'comentarios'),
  ].join('. ') + '.';

  const filas = new Map();
  const botonVersion = (li) => [...li.querySelectorAll('.mi-acciones button')].pop();
  const fila = (r) => {
    const li = el('li', 'mi-item');
    li.id = `m-${r.id}`;
    li.tabIndex = -1;
    const estado = estadoNuevo();
    let editar = null;
    const pintar = () => {
      const e = estadoDe(r);
      li.dataset.estado = e;
      const sello = el('p', 'mi-sello', SELLOS[e]);
      sello.dataset.estado = e;
      const titulo = el('h3', 'mi-titulo', r.titulo);
      const texto = con('div', 'mi-texto', sello, titulo, el('p', 'mi-meta', metaDe(r)));
      const temas = Array.isArray(r.etiquetas) ? r.etiquetas.filter((t) => typeof t === 'string' && t) : [];
      if (temas.length) {
        const ul = el('ul', 'ba-temas-r');
        ul.setAttribute('aria-label', 'Etiquetas');
        ul.append(...temas.map((t) => el('li', '', t)));
        texto.append(ul);
      }
      if (e === 'publicado') texto.append(el('p', 'mi-numeros', numerosDe(r)));
      if (e === 'pendiente') texto.append(el('p', 'mi-nota', 'Aparece en el banco cuando lo revisemos.'));
      if (e === 'oculto') texto.append(el('p', 'mi-nota', 'Si creés que es un error, escribinos a info@lutastudios.com.'));
      if (r.version_pendiente === true) texto.append(el('p', 'mi-nota mi-nota-version', e === 'publicado' ? 'Tu versión nueva está en revisión. Mientras, se ve la anterior.' : 'Tu versión nueva está en revisión.'));

      const acciones = el('div', 'mi-acciones');
      editar = null;
      if (puedeEditar) {
        editar = boton('b-sec b-chico', 'Editar');
        editar.setAttribute('aria-label', `Editar ${r.titulo}`);
        editar.addEventListener('click', () => abrirEditar(r, editar, alGuardar));
        acciones.append(editar);
      }
      const version = boton('b-sec b-chico', 'Subir una versión nueva');
      version.setAttribute('aria-label', `Subir una versión nueva de ${r.titulo}`);
      version.addEventListener('click', () => abrirVersion(r, version, (como) => {
        if (como === 'publicado') {
          cargar({ quieto: true, foco: r.id, aviso: 'La versión nueva ya está publicada.' });
          return;
        }
        r.version_pendiente = true;
        pintar();
        botonVersion(li)?.focus();
        decir(estado, estadoDe(r) === 'publicado' ? 'Recibimos la versión nueva. La anterior sigue en el banco hasta que la revisemos.' : 'Recibimos la versión nueva.');
      }));
      acciones.append(version);
      if (e === 'publicado') {
        const ver = el('a', 'mi-ver', 'Ver en el banco');
        ver.href = `banco.html?materia=${encodeURIComponent(r.materia)}#r-${encodeURIComponent(r.id)}`;
        ver.setAttribute('aria-label', `Ver ${r.titulo} en el banco`);
        acciones.append(ver);
      }
      texto.append(acciones, estado);
      li.replaceChildren(hojaDe(r), texto);
      li.querySelector('.ba-hoja').classList.add('mi-hoja');
    };
    const alGuardar = (nuevo) => {
      Object.assign(r, nuevo);
      pintar();
      decir(estado, 'Guardado.');
      li.querySelector('.mi-acciones button')?.focus();
    };
    li.repintar = pintar;
    pintar();
    return li;
  };

  // Title, instance and tags, in a dialog. The service checks the same; its answer is what gets painted.
  const abrirEditar = (r, desde, alGuardar) => {
    const caja = dialogo('Editar resumen', 'dlg-ancho');
    const form = el('form', 'ba-form-editar');
    form.noValidate = true;
    const campo = (id, texto, control) => {
      const et = el('label', '', texto);
      et.htmlFor = id;
      control.id = id;
      const error = el('p', 'ba-error');
      error.id = `${id}Error`;
      // Empty, it takes no room (carrera.css); it stays in the page so its message is heard.
      error.setAttribute('aria-live', 'polite');
      control.setAttribute('aria-describedby', error.id);
      return { caja: con('div', 'ba-campo', et, control, error), control, error };
    };
    const tIn = el('input');
    tIn.type = 'text';
    tIn.maxLength = 120;
    tIn.autocomplete = 'off';
    tIn.value = r.titulo || '';
    const titulo = campo('miEdTitulo', 'Título', tIn);
    const sel = el('select');
    instancias.forEach(([v, t]) => {
      const o = el('option', '', t);
      o.value = v;
      sel.append(o);
    });
    sel.value = r.instancia;
    const instancia = campo('miEdInstancia', 'Instancia', sel);
    const temas = campoTemas('miEdEtiquetas', 'Escribí una y tocá Enter, hasta 8. Sirven para encontrarlo en el banco.');
    temas.editor.poner(Array.isArray(r.etiquetas) ? r.etiquetas.filter((t) => typeof t === 'string') : []);
    const errTemas = { control: temas.input, error: temas.caja.querySelector('.ba-error') };
    const guardar = boton('b-pri', 'Guardar', 'submit');
    const cancelar = boton('b-sec', 'Cancelar');
    cancelar.addEventListener('click', caja.cerrar);
    const salida = estadoNuevo();
    form.append(el('p', 'ba-dlg-de', nombreMateria(r.materia)), titulo.caja, instancia.caja, temas.caja, botones(guardar, cancelar), salida);
    const marcar = (c, texto) => {
      c.error.textContent = texto;
      if (texto) c.control.setAttribute('aria-invalid', 'true');
      else c.control.removeAttribute('aria-invalid');
    };
    [titulo, instancia].forEach((c) => c.control.addEventListener('input', () => marcar(c, '')));
    const CAMPOS = { titulo, instancia, etiquetas: errTemas };
    const TEXTOS = {
      titulo: 'El título va de 3 a 120 caracteres.',
      instancia: 'Elegí una instancia de la lista.',
      etiquetas: 'Hasta 8 etiquetas, de hasta 30 caracteres.',
    };
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (caja.ocupado) return;
      temas.editor.sumarEscrito(false);
      [titulo, instancia, errTemas].forEach((c) => marcar(c, ''));
      decir(salida, '');
      const t = tIn.value.trim();
      const err = [...t].length < 3 ? 'El título tiene que tener al menos 3 caracteres.' : [...t].length > 120 ? 'El título puede tener hasta 120 caracteres.' : !sinControles(t) ? 'El título tiene caracteres que no se pueden usar.' : '';
      if (err) {
        marcar(titulo, err);
        tIn.focus();
        return;
      }
      guardar.disabled = true;
      decir(salida, 'Guardando.');
      caja.ocupado = true;
      const json = { id: r.id, titulo: t, instancia: sel.value, etiquetas: temas.editor.lista() };
      let res = null;
      try {
        res = await C.conCuenta('Para editar hace falta una cuenta.', () => S.pedir('editar', { json, cuenta: true }));
      } catch (err) {
        console.error('Editar:', err);
      } finally {
        guardar.disabled = false;
        caja.ocupado = false;
      }
      if (!res) {
        decir(salida, 'No se pudo guardar. Probá de nuevo.', true);
        return;
      }
      decir(salida, '');
      if (res.cancelado) return;
      if (res.ok) {
        const nuevo = res.datos?.resumen;
        caja.cerrar();
        alGuardar(nuevo && nuevo.id === r.id ? nuevo : { titulo: json.titulo, instancia: json.instancia, etiquetas: json.etiquetas });
        return;
      }
      if (sinRuta(res)) {
        // This service can't edit yet: the buttons go away and the dialog says so.
        puedeEditar = false;
        decir(salida, 'Editar todavía no está disponible.', true);
        guardar.hidden = true;
        const suyo = desde.closest('li');
        caja.alCerrar = () => {
          filas.forEach((li) => li.repintar());
          botonVersion(suyo)?.focus();
        };
        return;
      }
      const c = res.status === 400 ? CAMPOS[res.error] : null;
      if (c) {
        marcar(c, TEXTOS[res.error]);
        (c === errTemas ? temas.editor.enfocable() : c.control).focus();
        return;
      }
      decir(salida, S.mensaje(res, {
        'no-autor': 'Solo podés editar los resúmenes que subiste vos.',
        'no-existe': YA_NO,
        'tope-cuenta': 'Llegaste al tope de 30 cambios por día. Probá de nuevo mañana.',
        400: 'Algo de lo que mandaste no es válido. Probá de nuevo.',
        413: 'Lo que mandaste es demasiado largo.',
      }), true);
    });
    caja.cuerpo.append(form);
    const antes = JSON.stringify([tIn.value, sel.value, temas.editor.lista()]);
    caja.sucio = () => JSON.stringify([tIn.value, sel.value, temas.editor.lista()]) !== antes || Boolean(temas.input.value.trim());
    caja.abrir(desde);
    tIn.focus();
  };

  let vuelta = 0;
  const mostrar = (que) => {
    ingresar.hidden = que !== 'ingresar';
    noEsta.hidden = que !== 'no-esta';
    falla.hidden = que !== 'falla';
    vacio.hidden = que !== 'vacio';
    if (que !== 'lista') {
      lista.replaceChildren();
      cuenta.textContent = '';
    }
  };
  // `quieto` reloads without the skeleton, after a new version, so the list does not jump.
  // `aviso` is said in the count, which is a live region, once the list is back.
  async function cargar({ quieto = false, foco = '', aviso = '' } = {}) {
    vuelta += 1;
    const esta = vuelta;
    if (!S.usuario()) {
      mostrar('ingresar');
      return;
    }
    mostrar('lista');
    lista.setAttribute('aria-busy', 'true');
    if (!quieto) {
      lista.replaceChildren(...[0, 1, 2].map(filaEsq));
      cuenta.replaceChildren(esq('9em'), oculto('Cargando tus resúmenes.'));
    }
    const r = await S.pedir('mis-resumenes', { cuenta: true });
    if (esta !== vuelta) return;
    lista.removeAttribute('aria-busy');
    if (r.status === 401) {
      mostrar('ingresar');
      return;
    }
    if (r.status === 404) {
      mostrar('no-esta');
      return;
    }
    const resumenes = Array.isArray(r.datos?.resumenes) ? r.datos.resumenes.filter((x) => x && typeof x.id === 'string') : null;
    if (!r.ok || !resumenes) {
      mostrar('falla');
      fallaTexto.textContent = `No se pudieron cargar tus resúmenes. ${S.mensaje(r)}`;
      return;
    }
    if (!resumenes.length) {
      mostrar('vacio');
      return;
    }
    filas.clear();
    resumenes.forEach((x) => filas.set(x.id, fila(x)));
    lista.replaceChildren(...filas.values());
    const enRevision = resumenes.filter((x) => estadoDe(x) === 'pendiente').length;
    cuenta.textContent = `${cuantos(resumenes.length, 'resumen', 'resúmenes')}${enRevision ? `. ${enRevision} en revisión` : ''}.${aviso ? ` ${aviso}` : ''}`;
    if (foco && filas.has(foco)) botonVersion(filas.get(foco))?.focus();
    // Coming from a card of the bank: that summary, in sight and with the focus.
    if (!quieto && location.hash.startsWith('#m-')) {
      const li = document.getElementById(decodeURIComponent(location.hash.slice(1)));
      if (li) {
        li.scrollIntoView({ block: 'center' });
        li.focus({ preventScroll: true });
      }
    }
  }

  $('miIngresarB').addEventListener('click', () => C.abrir('Ingresá para ver lo que subiste.'));
  $('miReintentar').addEventListener('click', () => cargar());
  window.addEventListener('utn:sesion', () => cargar());
  cargar();
})();
