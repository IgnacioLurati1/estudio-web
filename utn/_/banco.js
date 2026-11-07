// The bank of student summaries. Everything that comes from a person goes through textContent.
(() => {
  const S = window.UTN_SERVICIO;
  const C = window.UTN_CUENTA;
  const E = window.UTN_ESTRELLAS;
  const $ = (id) => document.getElementById(id);
  if (!S?.hay || !C || !E) return;
  $('baSin').hidden = true;
  $('baTodo').hidden = false;

  const fMateria = $('baMateria');
  const fInstancia = $('baInstancia');
  const lista = $('baLista');
  const cuenta = $('baCuenta');
  const vacio = $('baVacio');
  const falla = $('baFalla');
  const fallaTexto = $('baFallaTexto');
  const aviso = $('baAviso');
  const chips = [...document.querySelectorAll('.ba-chip')];
  const irSubir = [$('baIrSubir'), ...document.querySelectorAll('[data-con-materia]')].filter(Boolean);
  const opcion = (sel, valor) => [...sel.options].find((o) => o.value === valor)?.textContent || valor;
  const MB = 1024 * 1024;
  const FORMATOS = { pdf: { nombre: 'PDF', tope: 15 * MB }, docx: { nombre: 'Word', tope: 15 * MB }, pptx: { nombre: 'PowerPoint', tope: 15 * MB }, html: { nombre: 'HTML', tope: 5 * MB }, gdoc: { nombre: 'Google Docs' }, gslides: { nombre: 'Google Slides' } };
  const ENLACE_GOOGLE = /^https:\/\/docs\.google\.com\/(document|presentation)\/d\/[A-Za-z0-9_-]{20,100}(?:[/?#]|$)/;
  // The real type comes from the server. Mime or short name, both are understood.
  const formatoDe = (tipo) => {
    const t = String(tipo || '').toLowerCase();
    if (/google|^g-?doc|^g-?slide/.test(t)) return /slide|presentation/.test(t) ? 'gslides' : 'gdoc';
    if (t.includes('pdf')) return 'pdf';
    if (/pptx|presentation|powerpoint/.test(t)) return 'pptx';
    if (t.includes('word') || t.includes('docx')) return 'docx';
    if (t.includes('html')) return 'html';
    return '';
  };
  const RECHAZOS = {
    formato: 'Ese formato no entra. Subí un PDF, un Word .docx, un PowerPoint .pptx, un HTML o un enlace de Google Docs o Google Slides.',
    macros: 'Ese archivo trae macros. Guardalo como .docx o .pptx sin macros y probá de nuevo.',
    'contenido-activo': 'El archivo trae partes que se ejecutan solas, como objetos incrustados o campos automáticos. Sacalas y probá de nuevo.',
    'enlace-externo': 'El archivo carga algo de afuera, como una plantilla, un audio o un video. Sacalo y probá de nuevo.',
    cifrado: 'El archivo tiene contraseña y así no se puede revisar. Sacásela y probá de nuevo.',
    'demasiado-grande': 'El archivo es demasiado grande. PDF, Word y PowerPoint hasta 15 MB, HTML hasta 5 MB.',
    sospechoso: 'No se pudo revisar el archivo, así que no entró. Probá exportarlo de nuevo.',
  };
  const rechazoDe = (r, conEnlace) => {
    if (r.error !== 'archivo-rechazado') return '';
    if (conEnlace && r.motivo === 'formato') return 'Ese enlace no es de un Google Docs ni de un Google Slides.';
    return RECHAZOS[r.motivo] || RECHAZOS.sospechoso;
  };
  const YA_NO = 'Ese resumen ya no está en el banco.';
  const MOTIVOS = { 'datos-personales': 'Tiene datos personales', 'no-es-resumen': 'No es un resumen', ofensivo: 'Es ofensivo', derechos: 'Copia material sin permiso' };
  let serie = 0;

  // Uploaded HTML usually writes its formulas for KaTeX or MathJax, which came from outside and the cleaning takes
  // out. They are drawn here as MathML, which needs no fonts or styles: it shows inside the frame and offline too.
  // The document is parsed with DOMParser, which runs and loads nothing, and only ever ends up inside the frame.
  const KATEX = new URL('katex/', document.currentScript?.src || location.href).href;
  const FORMULA = /\\\[|\\\(|\$\$|\\begin\{/;
  let katexListo = null;
  const cargarScript = (src) => new Promise((listo, falla) => {
    const s = document.createElement('script');
    s.src = src;
    s.addEventListener('load', listo);
    s.addEventListener('error', () => falla(new Error(`no cargó ${src}`)));
    document.head.append(s);
  });
  const conKatex = () => {
    katexListo ??= cargarScript(`${KATEX}katex.min.js`).then(() => cargarScript(`${KATEX}auto-render.min.js`));
    return katexListo;
  };
  // The same rule the service writes on top of every cleaned HTML: nothing from outside, not even fonts.
  const CSP_HTML = "default-src 'none'; img-src data:; font-src data:; style-src 'unsafe-inline'";
  // The links the service keeps (enlaceSeguro in revision-html.ts): a jump inside the summary, or another site.
  const enlaceQueQueda = (href) => {
    if (/^#[A-Za-z0-9_-]{1,120}$/.test(href)) return true;
    try {
      return ['http:', 'https:', 'mailto:'].includes(new URL(href).protocol);
    } catch {
      return false;
    }
  };
  // Inside a frame made from text, «#x» points at this page: a click loads this page inside the frame. Written as
  // «about:srcdoc#x» it only moves inside the summary. Only for the frame: a downloaded file keeps its «#x».
  const ANCLA = /\shref\s*=\s*["']?\s*#/i;
  // `crudo` is a file not yet cleaned by the service (the preview before uploading): what the cleaning would take
  // out goes here too, so it looks the way it will in the bank. `marco` is for showing it, not for saving it.
  const armarHtml = async (texto, { crudo = false, marco = false } = {}) => {
    const formulas = FORMULA.test(texto);
    const anclas = marco && ANCLA.test(texto);
    if (!formulas && !crudo && !anclas) return texto;
    const doc = new DOMParser().parseFromString(texto, 'text/html');
    if (crudo) {
      doc.querySelectorAll('script, noscript, link, base, meta[http-equiv], iframe, frame, frameset, object, embed').forEach((n) => n.remove());
      doc.querySelectorAll('a[href], area[href]').forEach((a) => {
        if (!enlaceQueQueda(a.getAttribute('href'))) a.removeAttribute('href');
      });
      const regla = doc.createElement('meta');
      regla.httpEquiv = 'Content-Security-Policy';
      regla.content = CSP_HTML;
      doc.head.prepend(regla);
    }
    if (marco) {
      doc.querySelectorAll('a[href^="#"], area[href^="#"]').forEach((a) => a.setAttribute('href', `about:srcdoc${a.getAttribute('href')}`));
    }
    if (formulas) {
      try {
        await conKatex();
        window.renderMathInElement(doc.body, { output: 'mathml', throwOnError: false, trust: false, strict: 'ignore' });
      } catch (e) {
        // Without the formulas drawn the summary still reads. The reason stays in the console.
        console.error('Fórmulas del resumen:', e);
        katexListo = null;
      }
    }
    return `<!doctype html>\n${doc.documentElement.outerHTML}`;
  };
  const nombreArchivo = (titulo) => String(titulo || '').replace(/[\\/:*?"<>|\u0000-\u001f\u007f]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 80) || 'resumen';

  const el = (tag, clase, texto) => {
    const x = document.createElement(tag);
    if (clase) x.className = clase;
    if (texto !== undefined) x.textContent = texto;
    return x;
  };
  const estadoNuevo = () => {
    const e = el('p', 'es-estado');
    e.setAttribute('role', 'status');
    return e;
  };
  const decir = (nodo, texto, error) => {
    nodo.textContent = texto;
    if (error) nodo.dataset.error = '1';
    else nodo.removeAttribute('data-error');
  };

  // Skeletons (.esq in utn.css) while the list or the comments are on their way. Each part goes inside an element with
  // the real class, so it is as tall as the text that replaces it. The words are only for screen readers.
  const esq = (ancho, clase = '') => {
    const s = el('span', clase ? `esq ${clase}` : 'esq');
    if (ancho) s.style.setProperty('--ancho', ancho);
    // A space inside, so a box with padding (a button, a tag) gets the height of its line.
    s.textContent = ' ';
    return s;
  };
  const con = (tag, clase, ...hijos) => {
    const x = el(tag, clase);
    x.append(...hijos);
    return x;
  };
  const oculto = (texto) => el('span', 'vh', texto);
  // Like a «details» with its summary: a block with the sheet's line, and the link's own box inside.
  const enlaceEsq = (ancho) => con('div', '', con('span', 'ba-esq-enlace', esq(ancho)));
  const ANCHOS_ESQ = [['74%', '88%'], ['58%', '80%'], ['66%', '92%']];
  const itemEsq = (_, i) => {
    const [titulo, meta] = ANCHOS_ESQ[i % ANCHOS_ESQ.length];
    const li = el('li', 'ba-item ba-esq');
    li.setAttribute('aria-hidden', 'true');
    li.append(
      con('div', 'ba-texto',
        con('p', 'ba-etiquetas', esq('4.1em'), esq('5.8em')),
        con('h3', 'ba-titulo', esq(titulo), ' ', esq('45%', 'esq-angosto')),
        con('p', 'ba-meta', esq(meta), ' ', esq('70%', 'esq-angosto'), ' ', esq('40%', 'esq-angosto'))),
      con('div', 'ba-gusto', con('span', 'ba-gusta', esq('1.45rem', 'esq-redondo'), con('span', 'ba-gusta-n', esq('1.1em')))),
      con('div', 'ba-acciones', esq('7rem', 'esq-boton'), con('div', 'ba-cvg', esq('9.6rem', 'esq-boton esq-chico'))),
      con('div', 'ba-pie', enlaceEsq('6.6em'), enlaceEsq('5.2em'))
    );
    return li;
  };
  const comentarioEsq = () => {
    const li = el('li', 'ba-com ba-esq');
    li.setAttribute('aria-hidden', 'true');
    li.append(con('p', 'ba-com-cab', esq('13em'), ' ', esq('60%', 'esq-angosto')), con('p', 'ba-com-texto', esq('82%'), ' ', esq('55%', 'esq-angosto')), con('div', 'ba-com-acciones', enlaceEsq('5.2em')));
    return li;
  };
  const peso = (b) => {
    const n = Number(b);
    if (!n) return '';
    return n < 1024 * 1024 ? `${Math.max(1, Math.round(n / 1024))} KB` : `${E.uno(n / (1024 * 1024))} MB`;
  };
  const fecha = (t) => {
    const f = new Date(t);
    return Number.isNaN(f.getTime()) ? '' : f.toLocaleDateString('es-AR');
  };
  const sinControles = (t) => !/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(t);
  // The server decides from the content. This only saves a trip when the answer is obvious.
  const revisarArchivo = async (f) => {
    if (!f) return 'Elegí el archivo.';
    const ext = /\.([a-z0-9]+)$/i.exec(f.name)?.[1].toLowerCase() || '';
    if (['doc', 'docm', 'dot', 'dotm', 'ppt', 'pptm', 'pps', 'ppsm', 'ppsx', 'pot', 'potm'].includes(ext)) return 'Los .doc, .docm, .ppt y .pptm no entran, porque pueden traer programas que se ejecutan solos al abrirlos. Guardalos como .docx, .pptx o PDF.';
    const formato = ext === 'htm' ? 'html' : ext;
    if (!FORMATOS[formato]?.tope) return 'Ese formato no entra. Subí un PDF, un Word .docx, un PowerPoint .pptx o un HTML.';
    if (f.size > FORMATOS[formato].tope) return `El archivo pasa de ${FORMATOS[formato].tope / MB} MB. Probá con uno más liviano.`;
    const inicio = await f.slice(0, 5).text();
    if (formato === 'pdf' && inicio !== '%PDF-') return 'Ese archivo no es un PDF.';
    if (formato === 'docx' && !inicio.startsWith('PK')) return 'Ese archivo no es un Word .docx.';
    if (formato === 'pptx' && !inicio.startsWith('PK')) return 'Ese archivo no es un PowerPoint .pptx.';
    return '';
  };
  const revisarEnlace = (u) => {
    if (!u) return 'Pegá el enlace del documento.';
    return ENLACE_GOOGLE.test(u) ? '' : 'Ese enlace no es de un Google Docs ni de un Google Slides. Copialo desde el botón Compartir del documento.';
  };
  const ACEPTA = '.pdf,.docx,.pptx,.html,.htm,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.openxmlformats-officedocument.presentationml.presentation,text/html';
  const AVISO_GOOGLE = 'El documento vive en Google y su dueño lo puede cambiar.';

  // Report form, for a summary or a comment. `cuerpo` is what identifies it in the request.
  const denuncia = (cuerpo, motivos, alListo) => {
    serie += 1;
    const caja = el('details', 'ba-mas');
    caja.append(el('summary', '', 'Denunciar'));
    const form = el('form', 'ba-form-chico');
    const id = `baMotivo${serie}`;
    const etiqueta = el('label', '', 'Motivo');
    etiqueta.htmlFor = id;
    const motivo = el('select');
    motivo.id = id;
    motivos.forEach((v) => {
      const o = el('option', '', MOTIVOS[v]);
      o.value = v;
      motivo.append(o);
    });
    const enviar = el('button', 'b-sec', 'Enviar denuncia');
    enviar.type = 'submit';
    const estado = estadoNuevo();
    form.append(etiqueta, motivo, enviar, estado);
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      enviar.disabled = true;
      const res = await C.conCuenta('Para denunciar hace falta una cuenta.', () => S.pedir('denunciar', { json: { ...cuerpo, motivo: motivo.value }, cuenta: true }));
      enviar.disabled = false;
      if (res.cancelado) return;
      if (res.ok) {
        const hecho = estadoNuevo();
        hecho.textContent = 'Denuncia enviada.';
        hecho.tabIndex = -1;
        caja.replaceWith(hecho);
        hecho.focus();
        alListo?.();
        return;
      }
      decir(estado, S.mensaje(res, { ...S.SIN_TEXTO, 400: 'Elegí un motivo de la lista y probá de nuevo.', 404: 'Eso ya no está disponible.', 429: 'Hubo demasiadas denuncias seguidas. Probá de nuevo en un rato.' }), true);
    });
    caja.append(form);
    return caja;
  };

  // Comments of one summary. They load the first time the section opens.
  const refrescarBanco = () => {
    S.refrescar('banco', { materia: fMateria.value, instancia: fInstancia.value });
    if (fMateria.value || fInstancia.value) S.refrescar('banco');
  };

  const comentarios = (r, sumarCantidad) => {
    const caja = el('details', 'ba-mas ba-comentarios');
    const resumen = el('summary');
    let cantidad = Number(r.comentarios) || 0;
    const titulo = () => {
      resumen.textContent = cantidad ? `Comentarios (${cantidad})` : 'Comentarios';
    };
    titulo();
    const lista2 = el('ul', 'ba-com-lista');
    const cargando = estadoNuevo();
    let datos = null;
    const cambiarCantidad = (d) => {
      cantidad = Math.max(0, cantidad + d);
      titulo();
      sumarCantidad?.(cantidad);
    };

    const fila = (c) => {
      const li = el('li', 'ba-com');
      li.dataset.tipo = c.tipo === 'propuesta' ? 'propuesta' : 'comentario';
      const pintar = () => {
        const cab = el('p', 'ba-com-cab');
        cab.append(el('b', '', c.usuario || 'anónimo'), ` ${c.tipo === 'propuesta' ? 'Propuesta de cambio' : 'Comentario'}. ${fecha(c.creado)}`);
        if (c.tipo === 'propuesta' && c.resuelta) cab.append(' ', el('span', 'ba-resuelta', 'Resuelta'));
        const acciones = el('div', 'ba-com-acciones');
        const yo = S.usuario();
        const estado = estadoNuevo();
        if (yo && yo === r.autor && c.tipo === 'propuesta' && !c.resuelta) {
          const b = el('button', 'b-sec b-chico', 'Marcar como resuelta');
          b.type = 'button';
          b.addEventListener('click', async () => {
            b.disabled = true;
            const res = await C.conCuenta('Para resolver una propuesta hace falta una cuenta.', () => S.pedir('resolver-propuesta', { json: { id: c.id }, cuenta: true }));
            b.disabled = false;
            if (res.ok) {
              c.resuelta = true;
              pintar();
              li.querySelector('.ba-resuelta')?.setAttribute('tabindex', '-1');
              li.querySelector('.ba-resuelta')?.focus();
            } else if (!res.cancelado) decir(estado, S.mensaje(res, { ...S.SIN_TEXTO, 403: 'Solo quien subió el resumen puede resolver una propuesta.', 404: 'Esa propuesta ya no está.' }), true);
          });
          acciones.append(b);
        }
        if (yo && yo === c.usuario) {
          const b = el('button', 'b-sec b-chico', 'Borrar');
          b.type = 'button';
          b.addEventListener('click', async () => {
            if (!window.confirm('¿Seguro?')) return;
            b.disabled = true;
            const res = await C.conCuenta('Para borrar un comentario hace falta una cuenta.', () => S.pedir('borrar-comentario', { json: { id: c.id }, cuenta: true }));
            b.disabled = false;
            if (res.ok) {
              li.remove();
              datos = datos.filter((x) => x !== c);
              cambiarCantidad(-1);
              refrescarBanco();
              decir(formEstado, 'Comentario borrado.');
              // The button went with the comment: the focus goes to the box for writing, not to the top of the page.
              texto.focus();
            } else if (!res.cancelado) decir(estado, S.mensaje(res, { ...S.SIN_TEXTO, 403: 'Solo podés borrar los tuyos.', 404: 'Ese comentario ya no está.' }), true);
          });
          acciones.append(b);
        } else {
          acciones.append(denuncia({ comentario: c.id }, ['datos-personales', 'ofensivo', 'derechos']));
        }
        li.replaceChildren(cab, el('p', 'ba-com-texto', c.texto), acciones, estado);
      };
      li.repintar = pintar;
      pintar();
      return li;
    };
    const pintarLista = () => {
      lista2.replaceChildren(...datos.map(fila));
    };

    // Writing a comment. The text stays in the box while the visitor signs in.
    serie += 1;
    const form = el('form', 'ba-form-com');
    const tipoId = `baTipo${serie}`;
    const textoId = `baTexto${serie}`;
    const tipoEt = el('label', '', 'Tipo');
    tipoEt.htmlFor = tipoId;
    const tipo = el('select');
    tipo.id = tipoId;
    [['comentario', 'Comentario'], ['propuesta', 'Propuesta de cambio']].forEach(([v, t]) => {
      const o = el('option', '', t);
      o.value = v;
      tipo.append(o);
    });
    const textoEt = el('label', '', 'Qué querés decir');
    textoEt.htmlFor = textoId;
    const texto = el('textarea');
    texto.id = textoId;
    texto.rows = 3;
    texto.maxLength = 2000;
    const enviar = el('button', 'b-sec', 'Publicar');
    enviar.type = 'submit';
    const formEstado = estadoNuevo();
    form.append(tipoEt, tipo, textoEt, texto, enviar, formEstado);
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const t = texto.value.trim();
      if (!t) {
        decir(formEstado, 'Escribí algo antes de publicar.', true);
        texto.focus();
        return;
      }
      if (!sinControles(t)) {
        decir(formEstado, 'El texto tiene caracteres que no se pueden usar.', true);
        texto.focus();
        return;
      }
      decir(formEstado, '');
      enviar.disabled = true;
      const res = await C.conCuenta('Para comentar hace falta una cuenta. Tu texto queda escrito.', () => S.pedir('comentar', { json: { id: r.id, tipo: tipo.value, texto: t }, cuenta: true }));
      enviar.disabled = false;
      if (res.cancelado) return;
      if (res.ok) {
        const nuevo = res.datos?.comentario || res.datos;
        texto.value = '';
        if (datos && nuevo?.id !== undefined) {
          datos.push(nuevo);
          lista2.append(fila(nuevo));
        }
        cambiarCantidad(1);
        refrescarBanco();
        decir(formEstado, 'Publicado.');
        return;
      }
      decir(formEstado, S.mensaje(res, { 400: 'El comentario puede tener hasta 2000 caracteres.', 404: YA_NO, 429: 'Llegaste al tope de comentarios por hoy. Probá de nuevo mañana.' }), true);
    });

    // The count is known, so the skeleton has as many comments as are coming (up to three), or the line of «no comments yet».
    const cargar = async () => {
      cargando.removeAttribute('data-error');
      cargando.replaceChildren(oculto('Cargando comentarios.'));
      if (cantidad) lista2.replaceChildren(...Array.from({ length: Math.min(cantidad, 3) }, comentarioEsq));
      else cargando.prepend(esq('14.4em'), ' ', esq('11em'));
      lista2.setAttribute('aria-busy', 'true');
      const res = await S.pedir('comentarios', { datos: { id: r.id } });
      lista2.removeAttribute('aria-busy');
      if (res.ok && Array.isArray(res.datos?.comentarios)) {
        datos = res.datos.comentarios;
        pintarLista();
        decir(cargando, datos.length ? '' : 'Todavía no hay comentarios. Podés ser el primero.');
        return;
      }
      lista2.replaceChildren();
      decir(cargando, `No se pudieron cargar los comentarios. ${S.mensaje(res, { 404: YA_NO })}`, true);
    };
    caja.addEventListener('toggle', () => {
      if (caja.open && !datos) cargar();
    });
    caja.append(resumen, cargando, lista2, form);
    caja.alCambiarSesion = () => {
      if (datos) pintarLista();
    };
    return caja;
  };

  // A new version, only for whoever uploaded the summary.
  const nuevaVersion = (r) => {
    serie += 1;
    const caja = el('details', 'ba-mas');
    caja.append(el('summary', '', 'Subir una versión nueva'));
    const form = el('form', 'ba-form-chico');
    form.noValidate = true;
    const aId = `baVersion${serie}`;
    const nId = `baNota${serie}`;
    const nombreOrigen = `baOrigen${serie}`;
    const opcionOrigen = (valor, texto, marcada) => {
      const l = el('label', 'ba-casilla');
      const i = el('input');
      i.type = 'radio';
      i.name = nombreOrigen;
      i.value = valor;
      i.checked = marcada;
      l.append(i, el('span', '', texto));
      return l;
    };
    const origen = el('fieldset', 'ba-origen');
    origen.append(el('legend', '', 'Qué vas a subir'), opcionOrigen('archivo', 'Un archivo', true), opcionOrigen('enlace', 'Un enlace de Google', false));
    const conEnlace = () => form.elements[nombreOrigen].value === 'enlace';
    const eId = `baVersionEnlace${serie}`;
    const eEt = el('label', '', 'Enlace de Google Docs o Google Slides');
    eEt.htmlFor = eId;
    const enlace = el('input');
    enlace.type = 'url';
    enlace.id = eId;
    enlace.autocomplete = 'off';
    const aEt = el('label', '', 'Archivo. PDF, Word .docx o PowerPoint .pptx hasta 15 MB, HTML hasta 5 MB');
    aEt.htmlFor = aId;
    const archivo = el('input');
    archivo.type = 'file';
    archivo.accept = ACEPTA;
    archivo.id = aId;
    const nEt = el('label', '', 'Qué cambió, si querés contarlo');
    nEt.htmlFor = nId;
    const nota = el('input');
    nota.type = 'text';
    nota.id = nId;
    nota.maxLength = 200;
    const enviar = el('button', 'b-sec', 'Subir versión');
    enviar.type = 'submit';
    const estado = estadoNuevo();
    const pintarOrigen = () => {
      const e = conEnlace();
      [aEt, archivo].forEach((x) => {
        x.hidden = e;
      });
      [eEt, enlace].forEach((x) => {
        x.hidden = !e;
      });
      if (e) previa.hidden = true;
      else if (archivo.files[0]) archivo.dispatchEvent(new Event('change'));
    };
    const previa = previaHtml(archivo, form);
    origen.addEventListener('change', pintarOrigen);
    form.append(origen, aEt, archivo, previa, eEt, enlace, nEt, nota, enviar, estado);
    pintarOrigen();
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const porEnlace = conEnlace();
      const err = porEnlace ? revisarEnlace(enlace.value.trim()) : await revisarArchivo(archivo.files[0]);
      if (err) {
        decir(estado, err, true);
        (porEnlace ? enlace : archivo).focus();
        return;
      }
      decir(estado, 'Subiendo.');
      enviar.disabled = true;
      const pedir = () => {
        const fd = new FormData();
        fd.set('id', r.id);
        if (porEnlace) fd.set('enlace', enlace.value.trim());
        else fd.set('archivo', archivo.files[0]);
        if (nota.value.trim()) fd.set('nota', nota.value.trim());
        return S.pedir('actualizar', { form: fd, cuenta: true, espera: 180000 });
      };
      const res = await C.conCuenta('Para subir una versión hace falta una cuenta.', pedir);
      enviar.disabled = false;
      if (res.cancelado) {
        decir(estado, '');
        return;
      }
      if (res.ok) {
        if (res.datos?.estado === 'publicado') {
          decir(aviso, 'La versión nueva ya está publicada.');
          cargarLista();
          return;
        }
        form.reset();
        pintarOrigen();
        decir(estado, 'Recibimos la versión nueva. La anterior sigue visible hasta que la revisemos.');
        return;
      }
      decir(estado, rechazoDe(res, porEnlace) || S.mensaje(res, { 400: 'Revisá lo que subiste. No es un formato que entre.', 403: 'Solo quien subió el resumen puede actualizarlo.', 404: YA_NO, 429: 'Se llegó al tope de subidas de hoy. Probá de nuevo mañana.' }), true);
    });
    caja.append(form);
    return caja;
  };

  // An HTML whose scripts the panel turned on is read from another address, made only for this, inside a frame that
  // may run scripts and nothing else: what it runs has nothing of this site at hand. That page shows only what this
  // one hands it, once it says it is ready. Returns how to let go of the HTML if the frame closes first.
  const VISOR = 'https://demo.lutastudios.com/visor/';
  const conSusScripts = (marco, html, titulo) => {
    marco.setAttribute('sandbox', 'allow-scripts');
    const entregar = (e) => {
      if (e.source !== marco.contentWindow || e.data?.tipo !== 'visor-listo') return;
      soltar();
      marco.contentWindow.postMessage({ tipo: 'resumen', html, titulo }, '*');
    };
    const soltar = () => window.removeEventListener('message', entregar);
    window.addEventListener('message', entregar);
    marco.src = VISOR;
    return soltar;
  };
  // Its original only where the service says its scripts run; anything else, the cleaned copy as always. The service
  // counts a reading, or a download when it is `para` saving it.
  const leerHtml = async (r, para) => {
    const cuenta = para ? { para } : {};
    if (r.js) {
      const original = await S.pedirTexto('ver', { id: r.id, js: 1, ...cuenta });
      if (original.ok) return { ...original, js: true };
    }
    const limpio = await S.pedirTexto('ver', { id: r.id, ...cuenta });
    return limpio.ok ? { ...limpio, texto: await armarHtml(limpio.texto, { marco: !para }), js: false } : limpio;
  };

  // An uploaded HTML only ever lives inside an iframe with no permissions at all, not even its own origin.
  const lector = (r) => {
    const caja = el('div', 'ba-lector');
    const cerrar = el('button', 'b-sec b-chico', 'Cerrar');
    cerrar.type = 'button';
    const marco = document.createElement('iframe');
    marco.setAttribute('sandbox', '');
    marco.setAttribute('referrerpolicy', 'no-referrer');
    marco.title = `Resumen: ${r.titulo}`;
    return { caja, cerrar, marco };
  };
  const botonLeer = (r, li) => {
    const b = el('button', 'b-pri ba-bajar', 'Leer');
    b.type = 'button';
    b.setAttribute('aria-label', `Leer ${r.titulo}`);
    b.setAttribute('aria-expanded', 'false');
    const estado = estadoNuevo();
    let abierto = null;
    let soltar = null;
    // While it loads the button stays focusable (a disabled one drops the keyboard focus) and ignores presses.
    let cargando = false;
    const cerrar = () => {
      soltar?.();
      soltar = null;
      abierto?.remove();
      abierto = null;
      b.setAttribute('aria-expanded', 'false');
      b.textContent = 'Leer';
      b.setAttribute('aria-label', `Leer ${r.titulo}`);
    };
    b.addEventListener('click', async () => {
      if (cargando) return;
      if (abierto) {
        cerrar();
        return;
      }
      decir(estado, '');
      estado.append(oculto('Cargando el resumen.'));
      cargando = true;
      b.setAttribute('aria-disabled', 'true');
      // The reader's place is taken at once, with the size of the frame and its button.
      const espera = con('div', 'ba-lector', esq('', 'esq-bloque ba-esq-marco'), esq('4.3rem', 'esq-boton esq-chico'));
      [...espera.children].forEach((x) => x.setAttribute('aria-hidden', 'true'));
      espera.setAttribute('aria-busy', 'true');
      li.querySelector('.ba-pie').before(espera);
      const res = await leerHtml(r);
      cargando = false;
      b.removeAttribute('aria-disabled');
      if (!res.ok) {
        espera.remove();
        decir(estado, S.mensaje(res, { 404: YA_NO }), true);
        return;
      }
      decir(estado, '');
      const { caja, cerrar: bCerrar, marco } = lector(r);
      if (res.js) soltar = conSusScripts(marco, res.texto, `Resumen: ${r.titulo}`);
      else marco.srcdoc = res.texto;
      bCerrar.addEventListener('click', () => {
        cerrar();
        b.focus();
      });
      const botones = el('div', 'ba-lector-botones');
      botones.append(botonCompleta(caja, 'el resumen'), bCerrar);
      caja.append(marco, botones);
      espera.replaceWith(caja);
      abierto = caja;
      b.setAttribute('aria-expanded', 'true');
      b.textContent = 'Cerrar lectura';
      b.setAttribute('aria-label', `Cerrar lectura de ${r.titulo}`);
      caja.scrollIntoView({ block: 'nearest' });
    });
    return { b, estado };
  };
  // Full screen for a reader or a preview: the box itself goes full screen with its buttons, so the way out stays in
  // sight. Where the browser cannot (the iPhone), the box covers the window instead, and Escape takes it back.
  const botonCompleta = (caja, que) => {
    const b = el('button', 'b-sec b-chico');
    b.type = 'button';
    const enCompleta = () => document.fullscreenElement === caja || caja.classList.contains('ba-completa');
    const pintar = () => {
      const on = enCompleta();
      b.textContent = on ? 'Salir de pantalla completa' : 'Pantalla completa';
      b.setAttribute('aria-label', on ? 'Salir de pantalla completa' : `Ver ${que} en pantalla completa`);
    };
    const salirDeLaVentana = () => {
      caja.classList.remove('ba-completa');
      pintar();
    };
    caja.addEventListener('keydown', (e) => {
      if (e.key !== 'Escape' || !caja.classList.contains('ba-completa')) return;
      e.stopPropagation();
      salirDeLaVentana();
      b.focus();
    }, true);
    b.addEventListener('click', async () => {
      if (document.fullscreenElement === caja) {
        await document.exitFullscreen().catch(() => {});
        return;
      }
      if (caja.classList.contains('ba-completa')) {
        salirDeLaVentana();
        return;
      }
      if (document.fullscreenEnabled && caja.requestFullscreen) {
        try {
          await caja.requestFullscreen();
          return;
        } catch {
          /* Refused: the box covers the window instead. */
        }
      }
      caja.classList.add('ba-completa');
      pintar();
      b.focus();
    });
    document.addEventListener('fullscreenchange', pintar);
    pintar();
    return b;
  };
  // HTML is not downloaded from the service (it is only read, through `ver`): the page saves the same copy the reader
  // shows, so it opens offline. The cleaned one with its formulas drawn, or the original where its scripts run.
  const botonBajarHtml = (r) => {
    const b = el('button', 'b-sec ba-bajar', 'Bajar');
    b.type = 'button';
    b.setAttribute('aria-label', `Bajar ${r.titulo}`);
    const estado = estadoNuevo();
    let cargando = false;
    b.addEventListener('click', async () => {
      if (cargando) return;
      cargando = true;
      b.setAttribute('aria-disabled', 'true');
      decir(estado, '');
      const res = await leerHtml(r, 'bajar');
      cargando = false;
      b.removeAttribute('aria-disabled');
      if (!res.ok) {
        decir(estado, S.mensaje(res, { 404: YA_NO }), true);
        return;
      }
      const a = document.createElement('a');
      a.href = URL.createObjectURL(new Blob([res.texto], { type: 'text/html;charset=utf-8' }));
      a.download = `${nombreArchivo(r.titulo)}.html`;
      document.body.append(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 60000);
    });
    return { b, estado };
  };
  // Before uploading an HTML, how it will look in the bank: the file never leaves the computer for this. One with
  // scripts of its own runs them in the same isolated reader the bank uses once they are turned on: without them,
  // a page its scripts build shows empty.
  const previaHtml = (input, form = input.form) => {
    const caja = el('div', 'ba-previa');
    caja.hidden = true;
    const nota = el('p', 'ba-ayuda', 'Así se va a ver en el banco. Lo que el archivo trae de otras páginas, como tipografías, imágenes o programas, no se carga.');
    const notaJs = el('p', 'ba-ayuda', 'Trae programas propios. Acá andan aislados y sin internet, como en el banco una vez que los revisemos. Hasta entonces se ve sin ellos.');
    notaJs.hidden = true;
    // A new frame for each file: a frame that ran scripts never shows another one.
    const marcoNuevo = () => {
      const m = document.createElement('iframe');
      m.setAttribute('sandbox', '');
      m.setAttribute('referrerpolicy', 'no-referrer');
      m.title = 'Vista previa de tu HTML';
      return m;
    };
    let marco = marcoNuevo();
    let soltar = null;
    const botones = el('div', 'ba-lector-botones');
    botones.append(botonCompleta(caja, 'la vista previa'));
    caja.append(nota, notaJs, marco, botones);
    const cambiarMarco = () => {
      soltar?.();
      soltar = null;
      const m = marcoNuevo();
      marco.replaceWith(m);
      marco = m;
    };
    let vuelta = 0;
    const pintar = async () => {
      const f = input.files[0];
      const n = ++vuelta;
      const esHtml = Boolean(f) && /\.html?$/i.test(f.name) && f.size <= FORMATOS.html.tope;
      if (!esHtml) {
        caja.hidden = true;
        cambiarMarco();
        return;
      }
      const crudo = await f.text();
      const conJs = /<script\b/i.test(crudo);
      const texto = conJs ? crudo : await armarHtml(crudo, { crudo: true, marco: true });
      if (n !== vuelta) return;
      cambiarMarco();
      notaJs.hidden = !conJs;
      if (conJs) soltar = conSusScripts(marco, texto, 'Vista previa de tu HTML');
      else marco.srcdoc = texto;
      caja.hidden = false;
    };
    input.addEventListener('change', pintar);
    form?.addEventListener('reset', () => setTimeout(pintar, 0));
    return caja;
  };

  // Word and PowerPoint: the start of the text taken out at upload, which the service sends inside JSON. It comes from a
  // file, so it only ever goes in through textContent. A PDF has no such text, so it has no preview.
  const ANCHOS_VISTA = ['97%', '91%', '99%', '84%', '95%', '62%', '93%', '98%', '76%'];
  const verInicio = (caja) => {
    // Only when the box starts down at the bottom of the screen, and just enough to see its first lines: the button stays in sight.
    const falta = caja.getBoundingClientRect().top + 160 - window.innerHeight;
    if (falta > 0) window.scrollBy({ top: falta });
  };
  const botonVista = (r, li) => {
    serie += 1;
    const id = `baVista${serie}`;
    const b = el('button', 'b-sec ba-vista-boton');
    b.type = 'button';
    const rotular = (abierta) => {
      b.textContent = abierta ? 'Cerrar vista previa' : 'Vista previa';
      b.setAttribute('aria-label', `${abierta ? 'Cerrar vista previa' : 'Vista previa'} de ${r.titulo}`);
      b.setAttribute('aria-expanded', String(abierta));
      if (abierta) b.setAttribute('aria-controls', id);
      else b.removeAttribute('aria-controls');
    };
    rotular(false);
    const estado = estadoNuevo();
    let datos = null;
    let abierta = null;
    let vuelta = 0;
    const cerrar = () => {
      vuelta += 1;
      decir(estado, '');
      abierta?.remove();
      abierta = null;
      rotular(false);
    };
    const poner = (caja) => {
      caja.id = id;
      if (abierta) abierta.replaceWith(caja);
      else li.querySelector('.ba-pie').before(caja);
      abierta = caja;
      rotular(true);
    };
    const pintar = () => {
      const caja = el('div', 'ba-vista');
      const hoja = el('div', 'ba-vista-hoja');
      if (datos.texto) {
        hoja.append(el('p', 'ba-vista-texto', datos.texto));
        if (datos.cortado) hoja.dataset.cortado = '1';
      } else hoja.append(el('p', 'ba-vista-vacia', 'Este resumen no trae texto para mostrar. Puede que sea de imágenes.'));
      caja.append(hoja);
      if (datos.texto) caja.append(el('p', 'ba-vista-nota', datos.cortado ? 'Es solo el comienzo del texto, sin formato.' : 'Es solo el texto, sin formato ni imágenes.'));
      const bCerrar = el('button', 'b-sec b-chico', 'Cerrar');
      bCerrar.type = 'button';
      bCerrar.setAttribute('aria-label', `Cerrar vista previa de ${r.titulo}`);
      const volver = () => {
        cerrar();
        b.focus();
      };
      bCerrar.addEventListener('click', volver);
      caja.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') volver();
      });
      const botones = el('div', 'ba-lector-botones');
      botones.append(botonCompleta(caja, 'la vista previa'), bCerrar);
      caja.append(botones);
      return caja;
    };
    b.addEventListener('click', async () => {
      if (abierta) {
        cerrar();
        return;
      }
      decir(estado, '');
      // Already seen once: it opens again without asking.
      if (datos) {
        poner(pintar());
        verInicio(abierta);
        return;
      }
      vuelta += 1;
      const esta = vuelta;
      estado.append(oculto('Cargando la vista previa.'));
      const espera = con('div', 'ba-vista',
        con('div', 'ba-vista-hoja', ...ANCHOS_VISTA.map((ancho) => esq(ancho, 'ba-vista-linea'))),
        con('p', 'ba-vista-nota', esq('17em')),
        esq('4.3rem', 'esq-boton esq-chico'));
      [...espera.children].forEach((x) => x.setAttribute('aria-hidden', 'true'));
      espera.setAttribute('aria-busy', 'true');
      poner(espera);
      verInicio(espera);
      const res = await S.pedir('vista', { datos: { id: r.id } });
      // Closed while it was on its way.
      if (esta !== vuelta) return;
      if (!res.ok || typeof res.datos?.texto !== 'string') {
        cerrar();
        decir(estado, S.mensaje(res, { 'sin-vista': 'Este resumen no tiene vista previa. Bajalo para verlo.', 404: YA_NO }), true);
        return;
      }
      decir(estado, '');
      datos = { texto: res.datos.texto, cortado: res.datos.cortado === true };
      poner(pintar());
    });
    return { b, estado };
  };
  const AVISOS_BAJAR = {
    docx: 'Si Word lo abre en Vista protegida, dejalo así y no toques «Habilitar edición».',
    pptx: 'Si PowerPoint lo abre en Vista protegida, dejalo así y no toques «Habilitar edición».',
    pdf: 'Abrilo en el navegador o en un lector de PDF actualizado.',
  };

  const metaDe = (r) => {
    const partes = [];
    if (!fMateria.value) partes.push(`${opcion(fMateria, r.materia)}.`);
    partes.push(`De ${r.autor || 'anónimo'}.`);
    const version = Number(r.version) || 1;
    const creado = fecha(r.creado);
    const actualizado = fecha(r.actualizado);
    if (version > 1) partes.push(`Versión ${version}${actualizado ? `, actualizada el ${actualizado}` : ''}.`);
    else if (creado) partes.push(`Subido el ${creado}.`);
    const p = peso(r.bytes);
    const n = Number(r.descargas) || 0;
    if (p) partes.push(`${p}.`);
    // Only what can be read in the page counts views: an HTML, and the preview of a Word or a PowerPoint.
    if (['html', 'docx', 'pptx'].includes(formatoDe(r.tipo))) {
      const v = Number(r.lecturas) || 0;
      partes.push(v === 1 ? '1 visualización.' : `${v} visualizaciones.`);
    }
    partes.push(n === 1 ? '1 descarga.' : `${n} descargas.`);
    return partes.join(' ');
  };

  // A summary only collects likes, so nobody sees a low score. A filled heart against an outlined one, and the button
  // says whether it is pressed, so colour is never the only difference.
  const SVG = 'http://www.w3.org/2000/svg';
  const CORAZON = 'M12 20.4l-1.35-1.23C5.85 14.82 2.7 11.97 2.7 8.48 2.7 5.63 4.93 3.4 7.78 3.4c1.6 0 3.15.75 4.22 1.93A5.7 5.7 0 0 1 16.22 3.4c2.85 0 5.08 2.23 5.08 5.08 0 3.49-3.15 6.34-7.95 10.7z';
  const corazon = () => {
    const svg = document.createElementNS(SVG, 'svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('aria-hidden', 'true');
    const p = document.createElementNS(SVG, 'path');
    p.setAttribute('d', CORAZON);
    svg.append(p);
    return svg;
  };
  const cuantosGusta = (n) => (n === 1 ? '1 me gusta' : `${n.toLocaleString('es-AR')} me gusta`);
  // What this tab saved, per summary and account. It wins over mis-votos, which may have been asked before.
  const hechos = new Map();
  const meGusta = (r) => {
    const caja = el('div', 'ba-gusto');
    const b = el('button', 'ba-gusta');
    b.type = 'button';
    const numero = el('span', 'ba-gusta-n');
    b.append(corazon(), numero);
    caja.append(b);
    const estado = estadoNuevo();
    let total = Math.max(0, Number(r.me_gusta) || 0);
    let mio = false;
    let enviando = false;
    // While a press is on its way, what to go back to if it fails.
    let respaldo = null;
    let estadoDe = S.usuario() || '';
    const pintar = () => {
      b.setAttribute('aria-pressed', String(mio));
      b.setAttribute('aria-label', `Me gusta: ${r.titulo}. ${cuantosGusta(total)}.`);
      numero.textContent = total.toLocaleString('es-AR');
    };
    const fijarPropio = (v) => {
      const yo = S.usuario() || '';
      const hecho = hechos.get(r.id);
      const valor = hecho && hecho.de === yo ? hecho.mio : v === true;
      if (estadoDe !== yo) {
        estadoDe = yo;
        decir(estado, '');
      }
      if (enviando) {
        respaldo.mio = valor;
        return;
      }
      mio = valor;
      pintar();
    };
    b.addEventListener('click', async () => {
      // One press at a time: a double click does not undo itself.
      if (enviando) return;
      enviando = true;
      respaldo = { total, mio };
      const si = !mio;
      decir(estado, '');
      // With a session the press shows at once and the answer confirms it. Without one, the account comes first.
      if (S.usuario()) {
        mio = si;
        total = Math.max(0, total + (si ? 1 : -1));
        pintar();
      }
      const res = await C.conCuenta('Para marcar que te gusta hace falta una cuenta.', () => S.pedir('me-gusta', { json: { id: r.id, si }, cuenta: true }));
      enviando = false;
      estadoDe = S.usuario() || '';
      if (res.ok) {
        const d = res.datos || {};
        mio = typeof d.mio === 'boolean' ? d.mio : si;
        if (d.me_gusta !== null && d.me_gusta !== undefined && Number.isFinite(Number(d.me_gusta))) total = Math.max(0, Number(d.me_gusta));
        hechos.set(r.id, { de: estadoDe, mio });
        pintar();
        // The button already says it. This is only for screen readers, so the line does not push the sheet.
        estado.replaceChildren(oculto(mio ? 'Marcaste que te gusta.' : 'Sacaste el me gusta.'));
        refrescarBanco();
        return;
      }
      ({ total, mio } = respaldo);
      pintar();
      if (res.cancelado) {
        decir(estado, 'Tu me gusta no se guardó porque no ingresaste.');
        return;
      }
      decir(estado, S.mensaje(res, { ...S.SIN_TEXTO, 404: YA_NO, 429: 'Marcaste muchos me gusta seguidos. Probá de nuevo en un rato.' }), true);
    });
    fijarPropio();
    return { caja, estado, fijarPropio };
  };

  // ----- Super CVG (013): a summary sent from here shows there, next to the ones this person uploaded.
  const YA_NO_CVG = 'Ese resumen ya no está.';
  const TOPE_CVG = 'Llegaste al tope de 300 resúmenes en Super CVG. Sacá alguno para sumar otro.';
  // A plus that turns into a check once it is there.
  const MAS = 'M12 5v14M5 12h14';
  const TILDE = 'M5 12.5l4.5 4.5L19 7.5';
  const iconoCvg = () => {
    const svg = document.createElementNS(SVG, 'svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('aria-hidden', 'true');
    svg.append(document.createElementNS(SVG, 'path'));
    return svg;
  };
  // What this tab sent or took out, per summary and account. It wins over «enviados», which may have been asked before.
  const hechosCvg = new Map();
  // One request per page and account. A failure is forgotten, so the next list load asks again.
  let enviados = null;
  const misEnviados = () => {
    const de = S.usuario();
    if (!de) return Promise.resolve({ de: '', ids: new Set() });
    if (enviados?.de !== de) {
      const pedido = S.pedir('enviados', { cuenta: true }).then((r) => {
        if (r.ok && Array.isArray(r.datos?.ids)) return { de, ids: new Set(r.datos.ids.map(String)) };
        if (enviados?.pedido === pedido) enviados = null;
        return null;
      });
      enviados = { de, pedido };
    }
    return enviados.pedido;
  };
  const botonCvg = (r) => {
    const caja = el('div', 'ba-cvg');
    const b = el('button', 'ba-cvg-b');
    b.type = 'button';
    const icono = iconoCvg();
    const texto = el('span', '');
    // The title only for screen readers, so each card's button says which summary it sends.
    b.append(icono, texto, oculto(`, ${r.titulo}`));
    const estado = estadoNuevo();
    caja.append(b, estado);
    // true or false once known; null while «enviados» has not answered or if it failed, so the button never claims a
    // state it does not know. Without an account nothing is sent.
    let mio = S.usuario() ? null : false;
    let enviando = false;
    let respaldo = mio;
    let estadoDe = S.usuario() || '';
    // The words stay put and aria-pressed says whether it is there; the check shows it. While a press is on its way it
    // says so, as esperar() does in cuenta.js.
    const pintar = (ocupado = '') => {
      if (mio === null) b.removeAttribute('aria-pressed');
      else b.setAttribute('aria-pressed', String(mio));
      if (ocupado) b.setAttribute('aria-disabled', 'true');
      else b.removeAttribute('aria-disabled');
      texto.textContent = ocupado || 'Enviar a Super CVG';
      icono.firstChild.setAttribute('d', mio ? TILDE : MAS);
    };
    // `lista` is what «enviados» answered for an account, or null if it failed: then only this tab's presses count.
    const fijar = (lista) => {
      const yo = S.usuario() || '';
      if (lista && lista.de !== yo) return;
      const hecho = hechosCvg.get(r.id);
      const valor = hecho && hecho.de === yo ? hecho.mio : !yo ? false : lista ? lista.ids.has(r.id) : null;
      if (estadoDe !== yo) {
        estadoDe = yo;
        decir(estado, '');
      }
      if (enviando) {
        respaldo = valor;
        return;
      }
      mio = valor;
      pintar();
    };
    // Another account, or none: until «enviados» answers for it, nothing is known.
    const alCambiarSesion = () => fijar(S.usuario() ? null : { de: '', ids: new Set() });
    b.addEventListener('click', async () => {
      if (enviando) return;
      enviando = true;
      respaldo = mio;
      // Unknown counts as not there: sending again is harmless.
      const si = !mio;
      decir(estado, '');
      const res = await C.conCuenta('Para mandarlo a Super CVG hace falta una cuenta.', () => {
        pintar(si ? 'Enviando…' : 'Sacando…');
        return S.pedir('enviar-cvg', { json: { id: r.id, si }, cuenta: true });
      });
      enviando = false;
      estadoDe = S.usuario() || '';
      if (res.ok) {
        mio = typeof res.datos?.enviado === 'boolean' ? res.datos.enviado : si;
        hechosCvg.set(r.id, { de: estadoDe, mio });
        pintar();
        estado.replaceChildren(oculto(mio ? 'Lo mandaste a Super CVG.' : 'Lo sacaste de Super CVG.'));
        return;
      }
      mio = respaldo;
      pintar();
      if (res.cancelado) {
        decir(estado, 'No se mandó porque no ingresaste.');
        return;
      }
      decir(estado, S.mensaje(res, { ...S.SIN_TEXTO, 'no-existe': YA_NO_CVG, 404: YA_NO_CVG, 'tope-cuenta': TOPE_CVG }), true);
    });
    pintar();
    return { caja, fijar, alCambiarSesion };
  };

  // Tags compare like the service does: without case and without the accents of Spanish, keeping the ñ.
  const SIN_TILDE = new Map([...'ÁÀÂÄÉÈÊËÍÌÎÏÓÒÔÖÚÙÛÜÑáàâäéèêëíìîïóòôöúùûü'].map((c, i) => [c, 'aaaaeeeeiiiioooouuuuñaaaaeeeeiiiioooouuuu'[i]]));
  const claveTema = (t) => [...String(t).normalize('NFC')].map((c) => SIN_TILDE.get(c) ?? c).join('').toLowerCase();
  // The same cleaning the service does, so what is seen here is what gets saved: no invisible marks, one space.
  const MAX_TEMAS = 8;
  const limpiarTema = (t) => [...String(t ?? '').normalize('NFC').replace(/\u00ad/g, '').replace(/[\u0000- \u007f-\u00a0\u1680\u2000-\u200f\u2028-\u202f\u205f-\u206f\u3000\ufeff\ud800-\udfff]+/gu, ' ').trim()].slice(0, 30).join('').trim();
  // The search sends back plain text with two marks around each match. It goes in as text nodes, never as HTML.
  const pintarFragmento = (p, f) => {
    p.replaceChildren();
    p.hidden = typeof f !== 'string' || !f.includes('\u0002');
    if (p.hidden) return;
    let mark = null;
    for (const parte of f.split(/([\u0002\u0003])/)) {
      if (parte === '\u0002') mark = el('mark');
      else if (parte === '\u0003') {
        if (mark) p.append(mark);
        mark = null;
      } else if (parte) {
        if (mark) mark.append(parte);
        else p.append(parte);
      }
    }
    if (mark) p.append(mark);
  };

  const item = (r, i) => {
    const li = el('li', 'ba-item');
    const formato = formatoDe(r.tipo);
    li.dataset.formato = formato || 'otro';
    const gusta = meGusta(r);
    // The order already says it, so screen readers go on to the title.
    if (i === 0 && Number(r.me_gusta) > 0) {
      const primero = el('span', 'ba-primero', 'el goat');
      primero.setAttribute('aria-hidden', 'true');
      gusta.caja.append(primero);
    }
    const textoBox = el('div', 'ba-texto');
    const etiquetas = el('p', 'ba-etiquetas');
    if (FORMATOS[formato]) etiquetas.append(el('span', 'ba-formato', `${FORMATOS[formato].nombre}${formato === 'html' && r.js ? ' interactivo' : ''}`));
    etiquetas.append(el('span', 'ba-instancia', opcion(fInstancia, r.instancia)));
    const reco = Number(r.recomendado) || 0;
    if (reco) etiquetas.append(el('span', 'ba-reco', reco === 1 ? 'Lo recomienda 1 consejo' : `Lo recomiendan ${reco} consejos`));
    li.id = `r-${r.id}`;
    // The tags whoever uploaded it chose. A service without them sends none, and the card looks as before.
    const temas = Array.isArray(r.etiquetas) ? r.etiquetas.filter((t) => typeof t === 'string' && t) : [];
    li.temas = temas.map(claveTema);
    const fragmento = el('p', 'ba-fragmento');
    fragmento.hidden = true;
    li.pintarFragmento = (f) => pintarFragmento(fragmento, f);
    textoBox.append(etiquetas, el('h3', 'ba-titulo', r.titulo));
    if (temas.length) {
      const ul = el('ul', 'ba-temas-r');
      ul.setAttribute('aria-label', 'Etiquetas');
      ul.append(...temas.map((t) => el('li', '', t)));
      textoBox.append(ul);
    }
    textoBox.append(el('p', 'ba-meta', metaDe(r)), fragmento, gusta.estado);
    const acciones = el('div', 'ba-acciones');
    let principal;
    if (formatoDe(r.tipo) === 'html') {
      const leer = botonLeer(r, li);
      const bajarHtml = botonBajarHtml(r);
      principal = [leer.b, bajarHtml.b, leer.estado, bajarHtml.estado];
    } else if (['gdoc', 'gslides'].includes(formatoDe(r.tipo))) {
      // It lives on Google: another tab, no referrer, and never inside this page.
      const abrir = el('a', 'b-pri ba-bajar', 'Abrir en Google');
      abrir.href = S.url('bajar', { id: r.id });
      abrir.target = '_blank';
      abrir.rel = 'noopener noreferrer nofollow';
      abrir.setAttribute('aria-label', `Abrir ${r.titulo} en Google, en otra pestaña`);
      principal = [abrir, el('p', 'ba-aviso-bajar', AVISO_GOOGLE)];
    } else {
      const bajar = el('a', 'b-pri ba-bajar', 'Bajar');
      bajar.href = S.url('bajar', { id: r.id });
      bajar.setAttribute('aria-label', `Bajar ${r.titulo}`);
      bajar.rel = 'nofollow';
      principal = [bajar];
      if (formato === 'docx' || formato === 'pptx') {
        const vista = botonVista(r, li);
        principal.push(vista.b, vista.estado);
      }
      if (AVISOS_BAJAR[formato]) principal.push(el('p', 'ba-aviso-bajar', AVISOS_BAJAR[formato]));
    }
    const denunciar = denuncia({ id: r.id }, Object.keys(MOTIVOS));
    const com = comentarios(r);
    const version = nuevaVersion(r);
    const cvg = botonCvg(r);
    acciones.append(...principal, cvg.caja);
    const pie = el('div', 'ba-pie');
    pie.append(com, denunciar, version);
    const pintarDueno = () => {
      version.hidden = !S.usuario() || S.usuario() !== r.autor;
    };
    pintarDueno();
    // The like sits on the left of the sheet (carrera.css) but comes after the title, which is what a screen reader
    // should hear first.
    li.append(textoBox, gusta.caja, acciones, pie);
    li.alCambiarSesion = () => {
      pintarDueno();
      com.alCambiarSesion();
      cvg.alCambiarSesion();
    };
    li.fijarPropio = gusta.fijarPropio;
    li.fijarCvg = cvg.fijar;
    li.dataset.id = r.id;
    return li;
  };

  // Every card of the loaded list by id, also the ones a tag or a search leaves out of sight.
  let filas = [];
  let items = new Map();
  const pintarPropios = async () => {
    if (!lista) return;
    // Each one paints when it arrives: the likes do not wait for Super CVG.
    misEnviados().then((cvg) => items.forEach((li) => li.fijarCvg?.(cvg)));
    const mias = (await C.misVotos()).resumenes;
    items.forEach((li) => li.fijarPropio?.(mias[li.dataset.id]));
  };
  window.addEventListener('utn:sesion', () => {
    if (!lista) return;
    items.forEach((li) => li.alCambiarSesion?.());
    pintarPropios();
  });

  // Tags and search come with the service's migration 010. Until it sends `etiquetas`, the bank works as before.
  const temasCaja = $('baTemas');
  const temasChips = $('baTemasChips');
  const temasMas = $('baTemasMas');
  const busca = $('baBusca');
  const iBusca = $('baBuscar');
  const bBorrarBusca = $('baBorrarBusqueda');
  const errBusca = $('baBuscarError');
  const nada = $('baNada');
  // On a phone, six fill four lines at most, so the search and the list stay close.
  const temasALaVista = () => (matchMedia('(max-width: 40rem)').matches ? 6 : 10);
  let hayTemas = false;
  let todosLosTemas = false;
  // The chosen tags by key, with how they are written.
  const elegidas = new Map();
  let buscado = '';
  let resultados = null;
  let vuelta = 0;
  let vueltaBusca = 0;
  let relojEsq = 0;
  let primera = true;
  let cargando = false;

  const elegirDeUrl = () => {
    const q = new URLSearchParams(location.search);
    [[fMateria, 'materia'], [fInstancia, 'instancia']].forEach(([sel, k]) => {
      const v = q.get(k) || '';
      if ([...sel.options].some((o) => o.value === v)) sel.value = v;
    });
    elegidas.clear();
    for (const t of q.getAll('etiqueta').map(limpiarTema).filter(Boolean)) {
      if (elegidas.size < MAX_TEMAS && !elegidas.has(claveTema(t))) elegidas.set(claveTema(t), t);
    }
  };
  // The tags go in the address, so a filtered bank can be shared. What is searched never does.
  const escribirUrl = () => {
    const q = new URLSearchParams();
    if (fMateria.value) q.set('materia', fMateria.value);
    if (fInstancia.value) q.set('instancia', fInstancia.value);
    elegidas.forEach((t) => q.append('etiqueta', t));
    const t = q.toString();
    history.replaceState(null, '', `${location.pathname}${t ? `?${t}` : ''}`);
    pintarFiltros();
  };
  // The instance buttons write to the hidden select, which stays the only place the value lives.
  const pintarFiltros = () => {
    chips.forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.instancia === fInstancia.value)));
    irSubir.forEach((a) => {
      a.href = `subir.html${fMateria?.value ? `?materia=${encodeURIComponent(fMateria.value)}` : ''}`;
    });
  };
  chips.forEach((b) => b.addEventListener('click', () => {
    if (fInstancia.value === b.dataset.instancia) return;
    fInstancia.value = b.dataset.instancia;
    fInstancia.dispatchEvent(new Event('change'));
  }));

  // The tags of the loaded summaries, the most used first. A chosen one always shows, even when nothing has it.
  const pintarTemas = () => {
    if (!temasCaja) return;
    const usos = new Map();
    for (const r of filas) {
      const vistas = new Set();
      for (const t of Array.isArray(r.etiquetas) ? r.etiquetas : []) {
        if (typeof t !== 'string' || !t) continue;
        const k = claveTema(t);
        if (vistas.has(k)) continue;
        vistas.add(k);
        const u = usos.get(k) || { texto: t, n: 0 };
        u.n += 1;
        usos.set(k, u);
      }
    }
    elegidas.forEach((t, k) => {
      if (!usos.has(k)) usos.set(k, { texto: t, n: 0 });
    });
    const orden = [...usos].sort(([, a], [, b]) => b.n - a.n || a.texto.localeCompare(b.texto, 'es'));
    const tope = temasALaVista();
    const vista = todosLosTemas ? orden : orden.filter(([k], i) => i < tope || elegidas.has(k));
    temasChips.replaceChildren(...vista.map(([k, { texto, n }]) => {
      const b = el('button', 'ba-chip ba-tema');
      b.type = 'button';
      b.dataset.clave = k;
      b.dataset.texto = texto;
      b.setAttribute('aria-pressed', String(elegidas.has(k)));
      const num = el('span', 'ba-tema-n', String(n));
      b.append(el('span', '', texto), el('span', 'vh', ', '), num, el('span', 'vh', n === 1 ? ' resumen' : ' resúmenes'));
      return b;
    }));
    temasMas.hidden = orden.length <= tope;
    temasMas.textContent = todosLosTemas ? 'Ver menos' : `Ver todas (${orden.length})`;
    temasMas.setAttribute('aria-expanded', String(todosLosTemas));
    temasCaja.hidden = !hayTemas || !orden.length;
  };

  const pasaTemas = (li) => !hayTemas || [...elegidas.keys()].every((k) => li.temas.includes(k));
  const hayFiltro = () => Boolean(fMateria.value || fInstancia.value || (hayTemas && elegidas.size));
  // Paints the loaded cards: all of them, the ones with the chosen tags, or the search results in their order.
  const aplicar = () => {
    clearTimeout(relojEsq);
    items.forEach((li) => li.pintarFragmento(null));
    let orden;
    if (resultados) {
      orden = [];
      for (const x of resultados) {
        const li = items.get(x.id);
        if (!li || !pasaTemas(li) || orden.includes(li)) continue;
        li.pintarFragmento(x.fragmento);
        orden.push(li);
      }
    } else orden = [...items.values()].filter(pasaTemas);
    // Moving a card reloads an open reader, so the list is only rebuilt when something changed.
    const ahora = [...lista.children];
    if (ahora.length !== orden.length || ahora.some((li, i) => li !== orden[i])) lista.replaceChildren(...orden);
    const n = orden.length;
    if (resultados) {
      cuenta.textContent = n ? `${n === 1 ? '1 resultado' : `${n} resultados`} para «${buscado}»` : `Ningún resumen tiene «${buscado}»${hayFiltro() ? ' con estos filtros' : ''}.`;
      if (nada) {
        nada.textContent = hayFiltro() ? 'Probá con otras palabras o sacá algún filtro.' : 'Probá con otras palabras.';
        nada.hidden = n > 0;
      }
      vacio.hidden = true;
    } else {
      cuenta.textContent = !n ? '' : n === 1 ? '1 resumen' : `${n} resúmenes`;
      if (nada) nada.hidden = true;
      vacio.hidden = n > 0;
    }
    if (bBorrarBusca) bBorrarBusca.hidden = !resultados;
  };

  const MENSAJES_BUSCA = {
    filtro: 'Puede que un filtro de seguridad de la red haya frenado la búsqueda. Probá con otras palabras.',
    400: 'Escribí de 2 a 100 caracteres.',
    404: 'La búsqueda todavía no está disponible.',
    429: 'Hubo muchas búsquedas seguidas. Probá de nuevo en un rato.',
  };
  const decirBusca = (t) => {
    if (errBusca) errBusca.textContent = t;
  };
  // Asks the service and keeps the answer, which `aplicar` paints. False when a newer search came after this one.
  const correrBusqueda = async () => {
    vueltaBusca += 1;
    const esta = vueltaBusca;
    const json = { q: buscado };
    if (fMateria.value) json.materia = fMateria.value;
    if (fInstancia.value) json.instancia = fInstancia.value;
    if (elegidas.size) json.etiquetas = [...elegidas.values()];
    const r = await S.pedir('buscar', { json });
    if (esta !== vueltaBusca) return false;
    if (r.ok && Array.isArray(r.datos?.resultados)) {
      resultados = r.datos.resultados.filter((x) => x && typeof x.id === 'string');
      decirBusca('');
      return true;
    }
    resultados = null;
    buscado = '';
    decirBusca(S.mensaje(r, MENSAJES_BUSCA));
    return true;
  };
  const buscar = async () => {
    lista.setAttribute('aria-busy', 'true');
    cuenta.textContent = 'Buscando…';
    if (await correrBusqueda()) {
      if (!cargando) lista.removeAttribute('aria-busy');
      aplicar();
    }
  };
  const borrarBusqueda = () => {
    // A search still on its way no longer counts.
    vueltaBusca += 1;
    buscado = '';
    resultados = null;
    if (!cargando) lista.removeAttribute('aria-busy');
    aplicar();
  };

  async function cargarLista() {
    vuelta += 1;
    const esta = vuelta;
    cargando = true;
    lista.setAttribute('aria-busy', 'true');
    clearTimeout(relojEsq);
    // The first time the place is taken at once. A new filter keeps the old list, dimmed, for 150 ms before the skeleton.
    if (primera) ponerEsqueleto();
    else relojEsq = setTimeout(ponerEsqueleto, 150);
    const r = await S.pedir('banco', { datos: { materia: fMateria.value, instancia: fInstancia.value } });
    if (esta !== vuelta) return;
    const resumenes = Array.isArray(r.datos?.resumenes) ? r.datos.resumenes : null;
    // False when a newer search came while this one was on its way: that one paints.
    let alDia = true;
    if (r.ok && resumenes) {
      // The server already sorted them. With no search, the order stays as it came.
      filas = resumenes;
      items = new Map(resumenes.map((x, i) => [x.id, item(x, i)]));
      if (resumenes.some((x) => Array.isArray(x.etiquetas))) hayTemas = true;
      if (busca && hayTemas) busca.hidden = false;
      pintarTemas();
      // A search on screen follows the new filters.
      if (buscado) alDia = await correrBusqueda();
      if (esta !== vuelta) return;
    }
    clearTimeout(relojEsq);
    primera = false;
    cargando = false;
    lista.removeAttribute('aria-busy');
    if (!r.ok || !resumenes) {
      filas = [];
      items = new Map();
      pintarTemas();
      falla.hidden = false;
      fallaTexto.textContent = `No se pudo cargar el banco. ${S.mensaje(r, { 404: 'El servicio no encontró el banco.' })}`;
      lista.replaceChildren();
      vacio.hidden = true;
      if (nada) nada.hidden = true;
      cuenta.textContent = '';
      return;
    }
    falla.hidden = true;
    // A search cleared while this load was on its way: the list is painted again here, with the new summaries.
    if (alDia || !buscado) aplicar();
    if (location.hash.startsWith('#r-')) document.getElementById(location.hash.slice(1))?.scrollIntoView({ block: 'start' });
    pintarPropios();
  }
  // Three sheets fill the screen, so whatever is below the list is already out of sight when the summaries arrive.
  const ponerEsqueleto = () => {
    lista.replaceChildren(...[0, 1, 2].map(itemEsq));
    vacio.hidden = true;
    if (nada) nada.hidden = true;
    cuenta.replaceChildren(esq('6.5em'), oculto('Cargando resúmenes.'));
  };
  $('baReintentar')?.addEventListener('click', cargarLista);

  temasChips?.addEventListener('click', async (e) => {
    const b = e.target.closest('button[data-clave]');
    if (!b) return;
    const k = b.dataset.clave;
    if (elegidas.has(k)) elegidas.delete(k);
    else if (elegidas.size >= MAX_TEMAS) {
      cuenta.textContent = `Podés elegir hasta ${MAX_TEMAS} etiquetas.`;
      return;
    } else elegidas.set(k, b.dataset.texto);
    b.setAttribute('aria-pressed', String(elegidas.has(k)));
    escribirUrl();
    if (buscado) await buscar();
    else aplicar();
  });
  temasMas?.addEventListener('click', () => {
    todosLosTemas = !todosLosTemas;
    pintarTemas();
  });
  busca?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const q = iBusca.value.replace(/\s+/g, ' ').trim();
    iBusca.removeAttribute('aria-invalid');
    decirBusca('');
    if (!q) {
      if (buscado || resultados) borrarBusqueda();
      return;
    }
    if ([...q].length < 2) {
      iBusca.setAttribute('aria-invalid', 'true');
      decirBusca('Escribí al menos 2 caracteres.');
      return;
    }
    buscado = q;
    await buscar();
  });
  // Emptying the field, with the keyboard or its own cross, goes back to the whole list.
  iBusca?.addEventListener('input', () => {
    iBusca.removeAttribute('aria-invalid');
    if (!iBusca.value && (buscado || resultados)) {
      decirBusca('');
      borrarBusqueda();
    }
  });
  bBorrarBusca?.addEventListener('click', () => {
    iBusca.value = '';
    decirBusca('');
    borrarBusqueda();
    iBusca.focus();
  });
  if (lista) {
    fMateria.addEventListener('change', () => {
      // Each subject has its own tags.
      elegidas.clear();
      todosLosTemas = false;
      escribirUrl();
      cargarLista();
    });
    fInstancia.addEventListener('change', () => {
      escribirUrl();
      cargarLista();
    });
    elegirDeUrl();
    pintarFiltros();
    cargarLista();
  }

  // Upload form, on its own page. Mirrors what the server checks, so most errors show up next to their field.
  const form = $('baForm');
  if (!form) return;
  const sMateria = $('suMateria');
  const sInstancia = $('suInstancia');
  const sTitulo = $('suTitulo');
  const sArchivo = $('suArchivo');
  const sEnlace = $('suEnlace');
  const cArchivo = $('suCampoArchivo');
  const cEnlace = $('suCampoEnlace');
  cArchivo.append(previaHtml(sArchivo));
  const subeEnlace = () => form.elements.suOrigen.value === 'enlace';
  const pintarOrigen = () => {
    cArchivo.hidden = subeEnlace();
    cEnlace.hidden = !subeEnlace();
  };
  $('suFormatos').addEventListener('change', pintarOrigen);
  pintarOrigen();
  const sAcepto = $('suAcepto');
  const bSubir = $('suEnviar');
  const salida = $('suSalida');
  const iTema = $('suEtiqueta');
  const campos = [sMateria, sInstancia, sTitulo, iTema, sArchivo, sEnlace, sAcepto];
  const marcarError = (c, texto) => {
    const p = $(`${c.id}Error`);
    p.textContent = texto;
    p.hidden = !texto;
    if (texto) c.setAttribute('aria-invalid', 'true');
    else c.removeAttribute('aria-invalid');
  };
  campos.forEach((c) => {
    c.addEventListener('input', () => marcarError(c, ''));
    c.addEventListener('change', () => marcarError(c, ''));
  });

  // Tags, up to 8 of up to 30 characters. A file made with «Armar un resumen» brings its own, and they can be changed.
  const chipsTema = $('suChips');
  const vozTema = $('suEtiquetaVoz');
  let temas = [];
  // The keys that came with the chosen file: they give way when another file is chosen, and the typed ones stay.
  let delArchivo = [];
  const decirTema = (t) => {
    vozTema.textContent = t;
  };
  const pintarTemasSubir = () => {
    chipsTema.replaceChildren(...temas.map((t, i) => {
      const li = el('li', 'cr-chip');
      const sacar = el('button', 'cr-chip-x', '×');
      sacar.type = 'button';
      sacar.setAttribute('aria-label', `Sacar la etiqueta ${t}`);
      sacar.addEventListener('click', () => {
        temas.splice(i, 1);
        pintarTemasSubir();
        iTema.focus();
        decirTema(`Se sacó la etiqueta ${t}.`);
      });
      li.append(el('span', '', t), sacar);
      return li;
    }));
    chipsTema.hidden = !temas.length;
    iTema.disabled = temas.length >= MAX_TEMAS;
    iTema.placeholder = iTema.disabled ? 'Ya tiene 8' : 'Por ejemplo: Parcial 1';
  };
  // Adds the ones that fit and are not there yet, and says which.
  const sumarTemas = (nuevas) => {
    const sumadas = [];
    for (const t of nuevas.map(limpiarTema).filter(Boolean)) {
      if (temas.length >= MAX_TEMAS) break;
      if (temas.some((x) => claveTema(x) === claveTema(t))) continue;
      temas.push(t);
      sumadas.push(t);
    }
    return sumadas;
  };
  const cuantasTemas = (n) => (n === 1 ? '1 etiqueta' : `${n} etiquetas`);
  // What is typed, split at the commas. With Enter or a comma the focus stays; leaving the field keeps what was typed.
  const sumarEscrito = (enfocar) => {
    const sumadas = sumarTemas(iTema.value.split(','));
    iTema.value = '';
    if (!sumadas.length) return;
    pintarTemasSubir();
    decirTema(sumadas.length === 1 ? `Se sumó la etiqueta ${sumadas[0]}.` : `Se sumaron ${cuantasTemas(sumadas.length)}.`);
    if (!enfocar) return;
    if (iTema.disabled) chipsTema.querySelector('li:last-child .cr-chip-x')?.focus();
    else iTema.focus();
  };
  iTema.addEventListener('keydown', (e) => {
    if (e.isComposing) return;
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      sumarEscrito(true);
    } else if (e.key === 'Backspace' && !iTema.value && temas.length) {
      const t = temas.pop();
      pintarTemasSubir();
      decirTema(`Se sacó la etiqueta ${t}.`);
    }
  });
  iTema.addEventListener('blur', () => sumarEscrito(false));
  // An HTML lists its tags in `ul.etiquetas`, as «Armar un resumen» writes them. DOMParser runs and loads nothing.
  let vueltaTemas = 0;
  const temasDelArchivo = async () => {
    vueltaTemas += 1;
    const esta = vueltaTemas;
    const f = sArchivo.files[0];
    let nuevas = [];
    if (f && /\.html?$/i.test(f.name) && f.size <= FORMATOS.html.tope) {
      try {
        const doc = new DOMParser().parseFromString(await f.text(), 'text/html');
        nuevas = [...doc.querySelectorAll('ul.etiquetas > li')].map((li) => li.textContent);
      } catch {
        nuevas = [];
      }
    }
    if (esta !== vueltaTemas) return;
    temas = temas.filter((t) => !delArchivo.includes(claveTema(t)));
    const sumadas = sumarTemas(nuevas);
    delArchivo = sumadas.map(claveTema);
    pintarTemasSubir();
    if (sumadas.length) decirTema(`Se ${sumadas.length === 1 ? 'cargó' : 'cargaron'} ${cuantasTemas(sumadas.length)} del archivo.`);
  };
  sArchivo.addEventListener('change', temasDelArchivo);
  const vaciarTemas = () => {
    vueltaTemas += 1;
    temas = [];
    delArchivo = [];
    pintarTemasSubir();
  };
  // Coming from a subject's bank, the form starts on that subject.
  const subirConFiltro = () => {
    const q = new URLSearchParams(location.search);
    [[sMateria, 'materia'], [sInstancia, 'instancia']].forEach(([sel, k]) => {
      const v = q.get(k) || '';
      if (v && [...sel.options].some((o) => o.value === v)) sel.value = v;
    });
  };

  const revisar = async () => {
    const errores = [];
    if (!sMateria.value) errores.push([sMateria, 'Elegí la materia.']);
    if (!sInstancia.value) errores.push([sInstancia, 'Elegí la instancia.']);
    const t = sTitulo.value.trim();
    if ([...t].length < 3) errores.push([sTitulo, 'El título tiene que tener al menos 3 caracteres.']);
    else if ([...t].length > 120) errores.push([sTitulo, 'El título puede tener hasta 120 caracteres.']);
    else if (!sinControles(t)) errores.push([sTitulo, 'El título tiene caracteres que no se pueden usar.']);
    if (subeEnlace()) {
      const errEnlace = revisarEnlace(sEnlace.value.trim());
      if (errEnlace) errores.push([sEnlace, errEnlace]);
    } else {
      const errArchivo = await revisarArchivo(sArchivo.files[0]);
      if (errArchivo) errores.push([sArchivo, errArchivo]);
    }
    if (!sAcepto.checked) errores.push([sAcepto, 'Hace falta que lo confirmes para subirlo.']);
    return errores;
  };

  const MENSAJES_SUBIR = {
    400: 'Revisá los campos. Falta algo o el archivo no es válido.',
    404: 'Esa materia no está en la lista. Recargá la página y elegí de nuevo.',
    429: 'Se llegó al tope de subidas de hoy. Probá de nuevo mañana.',
    503: 'El banco no está disponible ahora. Tu resumen no se subió. Probá de nuevo en un rato.',
  };
  const CAMPOS_ERROR = { titulo: sTitulo, archivo: sArchivo, 'archivo-rechazado': sArchivo, pdf: sArchivo, multipart: sArchivo, 'muy-grande': sArchivo, materia: sMateria, instancia: sInstancia, acepto: sAcepto, etiquetas: iTema };
  const TEXTOS_ERROR = {
    titulo: 'El título tiene que tener de 3 a 120 caracteres, sin caracteres raros.',
    archivo: 'Elegí el archivo.',
    pdf: 'Ese archivo no es un PDF.',
    materia: 'Esa materia no está en la lista.',
    instancia: 'Elegí una instancia de la lista.',
    acepto: 'Hace falta que lo confirmes para subirlo.',
    etiquetas: 'Revisá las etiquetas. Van hasta 8, de hasta 30 caracteres.',
  };
  const decirSalida = (texto, error) => {
    decir(salida, texto, error);
    salida.hidden = !texto;
  };

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    decirSalida('');
    sumarEscrito(false);
    campos.forEach((c) => marcarError(c, ''));
    bSubir.disabled = true;
    const errores = await revisar();
    if (errores.length) {
      errores.forEach(([c, t]) => marcarError(c, t));
      errores[0][0].focus();
      bSubir.disabled = false;
      return;
    }
    bSubir.textContent = 'Subiendo';
    const pedir = () => {
      const datos = new FormData();
      datos.set('materia', sMateria.value);
      datos.set('instancia', sInstancia.value);
      datos.set('titulo', sTitulo.value.trim());
      datos.set('acepto', '1');
      if (subeEnlace()) datos.set('enlace', sEnlace.value.trim());
      else datos.set('archivo', sArchivo.files[0]);
      temas.forEach((t) => datos.append('etiqueta', t));
      return S.pedir('subir', { form: datos, cuenta: true, espera: 180000 });
    };
    const r = await C.conCuenta('Para subir un resumen hace falta una cuenta. Lo que completaste queda.', pedir);
    bSubir.disabled = false;
    bSubir.textContent = 'Subir resumen';
    if (r.cancelado) return;
    if (r.ok) {
      const publicado = r.datos?.estado === 'publicado';
      // A service from before the tags answers without them, and the summary went up without them.
      const sinTemas = temas.length > 0 && !Array.isArray(r.datos?.etiquetas);
      try {
        sessionStorage.removeItem('utn:creado');
      } catch {
        /* Nothing to clean. */
      }
      form.reset();
      vaciarTemas();
      pintarOrigen();
      subirConFiltro();
      if (sinTemas) decirSalida(publicado ? 'Tu resumen ya está publicado, sin las etiquetas. El banco todavía no las guarda.' : 'Recibimos tu resumen, sin las etiquetas, porque el banco todavía no las guarda. Aparece cuando lo revisemos.');
      else decirSalida(publicado ? 'Tu resumen ya está publicado. Lo ves en el banco.' : 'Recibimos tu resumen. Queda pendiente hasta que lo revisemos y recién ahí aparece en el banco.');
      salida.focus();
      return;
    }
    const campoSubida = subeEnlace() ? sEnlace : sArchivo;
    const campo = r.status === 413 ? sArchivo : r.error === 'archivo-rechazado' ? campoSubida : r.status === 400 ? CAMPOS_ERROR[r.error] : null;
    const texto = rechazoDe(r, subeEnlace()) || TEXTOS_ERROR[r.error] || S.mensaje(r, MENSAJES_SUBIR);
    if (campo) {
      marcarError(campo, texto);
      // With 8 tags the field is off and can't take the focus: it goes to the last tag's button.
      (campo === iTema && iTema.disabled ? chipsTema.querySelector('li:last-child .cr-chip-x') ?? campo : campo).focus();
    } else {
      decirSalida(texto, true);
      salida.focus();
    }
  });

  subirConFiltro();

  // The summary maker (crear.html) leaves its file here for this tab, and the form starts with it loaded.
  const irCrear = $('suIrCrear');
  const pintarIrCrear = () => {
    if (irCrear) irCrear.href = `crear.html${sMateria.value ? `?materia=${encodeURIComponent(sMateria.value)}` : ''}`;
  };
  sMateria.addEventListener('change', pintarIrCrear);
  pintarIrCrear();
  const traerCreado = () => {
    if (new URLSearchParams(location.search).get('creado') !== '1') return;
    let c = null;
    try {
      c = JSON.parse(sessionStorage.getItem('utn:creado'));
    } catch {
      c = null;
    }
    if (!c || typeof c.html !== 'string' || typeof c.nombre !== 'string' || !/^[a-z0-9-]{1,60}\.html$/.test(c.nombre)) return;
    try {
      const dt = new DataTransfer();
      dt.items.add(new File([c.html], c.nombre, { type: 'text/html' }));
      sArchivo.files = dt.files;
      temasDelArchivo();
    } catch {
      decirSalida('No se pudo cargar solo el resumen que armaste. Volvé a «Armar un resumen», bajalo y elegilo acá.', true);
      return;
    }
    if (typeof c.titulo === 'string' && c.titulo.trim() && !sTitulo.value) sTitulo.value = c.titulo.trim().slice(0, 120);
    decirSalida(`Ya está cargado el resumen que armaste (${c.nombre}). Elegí la instancia, confirmá y subilo.`);
  };
  traerCreado();
})();
