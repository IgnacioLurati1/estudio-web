// Photos, graphs and simulators that a person adds: in edit mode (editar.js) and in the summary maker (crear.js).
// Everything that arrives from storage, a link or a file is untrusted and goes through objeto() first.
// Captions and titles are plain text and go into the page with textContent. Formulas go through expr.js, never eval.
(() => {
  // A photo is re-drawn here as a JPEG (that drops its metadata) and has a cap. All of a subject's photos together
  // have another, so the browser's storage does not fill up.
  const FOTO = /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/]+={0,2}$/;
  const MAX_FOTO = 420000;
  const MAX_FOTOS = 1600000;
  const MAX_CFG = 8000;
  const TIPOS_G = ['grafico', 'grafico3d'];
  const NOMBRE = /^[a-z0-9-]{1,40}$/;
  const MATERIA = /^[a-z0-9-]{1,80}$/;
  const CLAVE_DATO = /^[A-Za-z0-9_-]{1,40}$/;
  const BASE = new URL((document.currentScript && document.currentScript.src.replace(/[^/]*$/, '')) || '../_/', location.href).href;

  const corto = (s, n) => (typeof s === 'string' ? s.replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, n) : '');
  const esObjeto = (x) => !!x && typeof x === 'object' && !Array.isArray(x);
  /** What a simulator saved of itself: { datos: { key: text } } and nothing else. Null if it is something else. */
  const cfgSimulador = (c) => {
    if (c === undefined) return {};
    if (!esObjeto(c) || Object.keys(c).some((k) => k !== 'datos')) return null;
    if (c.datos === undefined) return {};
    if (!esObjeto(c.datos)) return null;
    const datos = {};
    for (const [k, v] of Object.entries(c.datos)) {
      if (!CLAVE_DATO.test(k) || k === '__proto__' || typeof v !== 'string') return null;
      datos[k] = v;
    }
    return { datos };
  };
  /** A photo {f, t}, a graph {g, c, t, d, p} or a simulator {g: 'interactivo', n, m, c, t, d, p}, checked. Null if it is
   * something else or does not fit. */
  const objeto = (x) => {
    if (!esObjeto(x)) return null;
    if (typeof x.f === 'string') return x.f.length <= MAX_FOTO && FOTO.test(x.f) ? { f: x.f, t: corto(x.t, 300) } : null;
    if (TIPOS_G.includes(x.g) && esObjeto(x.c)) {
      const j = JSON.stringify(x.c);
      if (j.length > MAX_CFG) return null;
      return { g: x.g, c: JSON.parse(j), t: corto(x.t, 200), d: corto(x.d, 800), p: corto(x.p, 80) };
    }
    if (x.g === 'interactivo' && typeof x.n === 'string' && NOMBRE.test(x.n) && typeof x.m === 'string' && MATERIA.test(x.m)) {
      if (x.c !== undefined && (!esObjeto(x.c) || JSON.stringify(x.c).length > MAX_CFG)) return null;
      const c = cfgSimulador(x.c);
      return c ? { g: 'interactivo', n: x.n, m: x.m, c, t: corto(x.t, 200), d: corto(x.d, 800), p: corto(x.p, 80) } : null;
    }
    return null;
  };

  // ----- Drawing the graphs. w.js does it; on pages that do not have it, it is loaded the first time.
  // While the deferred scripts run the page already says «interactive», but w.js may come after the one calling here:
  // only DOMContentLoaded says it ran.
  let paginaLista = document.readyState === 'complete';
  if (!paginaLista) document.addEventListener('DOMContentLoaded', () => (paginaLista = true), { once: true });
  let cargaW = null;
  const cargarW = () =>
    cargaW ||
    (cargaW = new Promise((ok, mal) => {
      if (window.UTN && window.UTN.montarFigura) return ok();
      if (document.querySelector('script[src$="/w.js"]')) {
        const listo = () => (window.UTN && window.UTN.montarFigura ? ok() : mal(new Error('w.js')));
        if (paginaLista) listo();
        else document.addEventListener('DOMContentLoaded', listo, { once: true });
        return;
      }
      if (!document.querySelector('link[href$="/w.css"]')) {
        const l = document.createElement('link');
        l.rel = 'stylesheet';
        l.href = `${BASE}w.css`;
        document.head.append(l);
      }
      const poner = (archivo, ultimo) => {
        const s = document.createElement('script');
        s.src = `${BASE}${archivo}`;
        s.async = false;
        if (ultimo) {
          s.dataset.tarde = '1';
          s.addEventListener('load', () => ok());
        }
        s.addEventListener('error', () => mal(new Error(archivo)));
        document.head.append(s);
      };
      if (!window.UTN_EXPR) poner('expr.js');
      poner('w.js', true);
    }));
  // A subject's simulators live in its own interactivos.js, next to the assets folder. Each one is loaded once, after w.js.
  const archivos = new Map();
  const cargarSimuladores = (m) => {
    if (!MATERIA.test(m)) return Promise.reject(new Error('materia'));
    if (!archivos.has(m)) {
      archivos.set(
        m,
        new Promise((ok, mal) => {
          const s = document.createElement('script');
          s.src = new URL(`../${m}/interactivos.js`, BASE).href;
          s.async = false;
          s.addEventListener('load', () => ok());
          s.addEventListener('error', () => {
            archivos.delete(m);
            s.remove();
            mal(new Error(m));
          });
          document.head.append(s);
        }),
      );
    }
    return archivos.get(m);
  };
  const simuladorListo = (fig) => window.UTN && typeof window.UTN.hayInteractivo === 'function' && window.UTN.hayInteractivo(fig.dataset.nombre || '', fig.dataset.materia || '');
  const montar = (fig) => {
    const simulador = fig.dataset.w === 'interactivo';
    cargarW()
      .then(() => (simulador && !simuladorListo(fig) ? cargarSimuladores(fig.dataset.materia || '') : null))
      .then(() => {
        if (!fig.isConnected) return;
        // The subject's file loaded but does not have it: the simulator was taken out of the site.
        if (simulador && !simuladorListo(fig)) throw new Error('ya no está');
        window.UTN.montarFigura(fig);
      })
      .catch((e) => {
        // A figure the page already drew keeps its drawing.
        const l = fig.querySelector('.w-lienzo');
        if (!l || fig.classList.contains('w-listo')) return;
        if (!simulador) l.textContent = 'Este gráfico no se pudo dibujar ahora. Probá recargar la página.';
        else l.textContent = e && e.message === 'ya no está' ? 'Este simulador ya no está en el sitio. Podés sacarlo.' : 'Este simulador no se pudo abrir ahora. Probá recargar la página.';
      });
  };
  const soltar = (fig) => {
    if (fig.classList.contains('ag-w') && window.UTN && window.UTN.soltarFigura) window.UTN.soltarFigura(fig);
  };
  /** PNG of a graph as it looks now, or null. */
  const imagen = async (fig) => (window.UTN && window.UTN.imagenFigura ? window.UTN.imagenFigura(fig) : null);

  /** The figure of a photo, a graph or a simulator. Graphs and simulators are mounted by the caller, once the figure is
   * in the page. */
  const figura = (p, clases = '') => {
    const fig = document.createElement('figure');
    const cap = document.createElement('figcaption');
    if (p.f !== undefined) {
      fig.className = `${clases} ag-pieza ag-foto`.trim();
      const img = document.createElement('img');
      img.src = p.f;
      img.alt = p.t || 'Foto agregada';
      img.decoding = 'async';
      cap.textContent = p.t;
      cap.dataset.ph = 'Escribí qué muestra la foto (opcional)';
      fig.append(img, cap);
      return fig;
    }
    const simulador = p.g === 'interactivo';
    fig.className = `${clases} ag-pieza ag-w w w-${p.g}`.trim();
    fig.dataset.w = p.g;
    if (simulador) {
      fig.dataset.nombre = p.n;
      fig.dataset.materia = p.m;
    }
    fig.dataset.cfg = JSON.stringify(p.c);
    const t = document.createElement('span');
    t.className = 'w-t';
    t.textContent = p.t || (simulador ? 'Simulador' : p.g === 'grafico3d' ? 'Gráfico en 3D' : 'Gráfico');
    const f = document.createElement('span');
    f.className = 'w-f';
    f.textContent = p.p ? `Del resumen, ${p.p}` : simulador ? 'Con tus datos' : 'Armado con una fórmula';
    cap.append(t, f);
    const lienzo = document.createElement('div');
    lienzo.className = 'w-lienzo';
    const desc = document.createElement('div');
    desc.className = 'w-desc';
    desc.textContent = p.d || (simulador ? 'Simulador con tus propios datos.' : 'Gráfico armado con una fórmula.');
    fig.append(cap, lienzo, desc);
    return fig;
  };

  // ----- Photos: re-drawn on a canvas, smaller, as a JPEG and without the camera's data (place, date, device).
  const achicar = async (archivo) => {
    if (!archivo || archivo.size > 25000000) return { error: 'Esa foto pesa demasiado. Probá con una de menos de 25 MB.' };
    let bmp;
    try {
      bmp = await createImageBitmap(archivo);
    } catch {
      return { error: 'Esa imagen no se pudo abrir. Probá con una foto en JPG o PNG.' };
    }
    try {
      for (const [lado, q] of [[1400, 0.82], [1100, 0.75], [800, 0.7]]) {
        const k = Math.min(1, lado / Math.max(bmp.width, bmp.height));
        const c = document.createElement('canvas');
        c.width = Math.max(1, Math.round(bmp.width * k));
        c.height = Math.max(1, Math.round(bmp.height * k));
        const g = c.getContext('2d');
        g.fillStyle = '#fff';
        g.fillRect(0, 0, c.width, c.height);
        g.drawImage(bmp, 0, 0, c.width, c.height);
        const url = c.toDataURL('image/jpeg', q);
        if (url.length <= MAX_FOTO && FOTO.test(url)) return { url };
      }
      return { error: 'Esa foto no se pudo achicar lo suficiente. Probá con otra.' };
    } finally {
      if (bmp.close) bmp.close();
    }
  };
  const elegirArchivo = () =>
    new Promise((ok) => {
      const i = document.createElement('input');
      i.type = 'file';
      i.accept = 'image/jpeg,image/png,image/webp,image/gif';
      i.hidden = true;
      document.body.append(i);
      i.addEventListener('change', () => {
        ok(i.files[0] || null);
        i.remove();
      });
      i.addEventListener('cancel', () => {
        ok(null);
        i.remove();
      });
      i.click();
    });

  // ----- Graphs: the subject's simulators and page graphs (its figuras.json, made by the build) or one made from a
  // formula, with the kinds the subject offers.
  const leerCatalogo = (x) => {
    // Builds before simulators wrote a plain list of graphs, and a browser may still have one.
    const viejo = Array.isArray(x);
    const lista = viejo ? x : esObjeto(x) && Array.isArray(x.figuras) ? x.figuras : [];
    const formula = viejo ? TIPOS_G.slice() : esObjeto(x) && Array.isArray(x.formula) ? TIPOS_G.filter((t) => x.formula.includes(t)) : [];
    const graficos = lista.filter((f) => esObjeto(f) && TIPOS_G.includes(f.tipo) && esObjeto(f.cfg));
    const simuladores = viejo ? [] : lista.filter((f) => esObjeto(f) && f.tipo === 'interactivo' && typeof f.nombre === 'string' && NOMBRE.test(f.nombre));
    return { formula, graficos, simuladores };
  };
  const catalogos = new Map();
  const catalogo = (url) => {
    if (!catalogos.has(url)) {
      const pedido = fetch(url)
        .then((r) => {
          if (!r.ok) throw new Error(String(r.status));
          return r.json();
        })
        .then(leerCatalogo);
      // A failed fetch is not kept, so the next try asks again.
      pedido.catch(() => catalogos.delete(url));
      catalogos.set(url, pedido);
    }
    return catalogos.get(url);
  };
  const sinMarcas = (s, n = 200) => corto(String(s || '').replace(/\\[a-zA-Z]+/g, ' ').replace(/[$*_`{}^]/g, ''), n);
  const numeroDe = (s) => {
    const t = String(s).trim().replace('−', '-').replace(',', '.');
    return /^[+-]?(\d+(\.\d*)?|\.\d+)$/.test(t) ? Number(t) : NaN;
  };
  /** The settings of a graph made from a formula, or the text of what is wrong. */
  const armarPropio = (tipo, escrita, rx, ry) => {
    const E = window.UTN_EXPR;
    // As written in class: sen and tg are sin and tan for the parser.
    const f = escrita.replace(/\bsen(?=\s*\()/g, 'sin').replace(/\btg(?=\s*\()/g, 'tan');
    const vars = tipo === 'grafico3d' ? ['x', 'y'] : ['x'];
    if (!f.trim()) return 'Escribí la fórmula.';
    if (f.length > 200) return 'La fórmula es muy larga.';
    const mal = E.revisar(f, vars);
    if (mal) return `La fórmula no se entiende. ${mal}`;
    for (const [a, b] of tipo === 'grafico3d' ? [rx, ry] : [rx]) {
      if (!Number.isFinite(a) || !Number.isFinite(b)) return 'Los extremos tienen que ser números, como -2 o 3,5.';
      if (a >= b) return 'El primer extremo tiene que ser menor que el segundo.';
      if (Math.abs(a) > 1e6 || Math.abs(b) > 1e6) return 'Los extremos son demasiado grandes.';
    }
    const fn = E.compilar(f, vars);
    let alguno = false;
    for (let i = 0; i <= 60 && !alguno; i += 1) {
      const x = rx[0] + ((rx[1] - rx[0]) * i) / 60;
      const y = ry ? ry[0] + ((ry[1] - ry[0]) * ((i * 37) % 61)) / 60 : 0;
      try {
        alguno = Number.isFinite(fn({ x, y }));
      } catch {
        alguno = false;
      }
    }
    if (!alguno) return 'Con esos extremos la fórmula no da ningún valor. Probá con otros.';
    return tipo === 'grafico3d' ? { x: rx, y: ry, superficies: [{ z: f }] } : { x: rx, curvas: [{ f }] };
  };

  const crear = (tag, clase, texto) => {
    const e = document.createElement(tag);
    if (clase) e.className = clase;
    if (texto !== undefined) e.textContent = texto;
    return e;
  };
  const boton = (texto, clase) => {
    const b = crear('button', clase, texto);
    b.type = 'button';
    return b;
  };
  const fila = (...hijos) => {
    const f = crear('div', 'dlg-botones');
    f.append(...hijos);
    return f;
  };
  const campo = (etq, valor, ancho) => {
    const l = crear('label', 'dlg-campo', etq);
    const i = document.createElement('input');
    i.type = 'text';
    i.value = valor;
    i.autocomplete = 'off';
    i.spellcheck = false;
    if (ancho) i.size = ancho;
    l.append(i);
    return [l, i];
  };
  // The formula part of the dialog, with the kinds of graph the subject offers. Two buttons say which one is on, so Tab
  // and Enter are all it takes; with a single kind there is nothing to choose.
  const NOMBRES_TIPO = { grafico: 'Curva en el plano', grafico3d: 'Superficie en 3D' };
  const DE_EJEMPLO = { grafico: 'x^2 - 1', grafico3d: 'x^2 + y^2' };
  // A curve only takes x; a surface takes x and y.
  const AYUDAS = {
    grafico: 'Podés usar x, números y funciones como sen, cos, ln, sqrt o abs. La potencia va con ^, por ejemplo x^3.',
    grafico3d: 'Podés usar x e y, números y funciones como sen, cos, ln, sqrt o abs. La potencia va con ^, por ejemplo x^3.',
  };
  let cuentaError = 0;
  const partesFormula = (formula, terminar, bCerrar) => {
    let tipo = formula[0];
    const [lf, iF] = campo(tipo === 'grafico3d' ? 'z = f(x, y)' : 'y = f(x)', DE_EJEMPLO[tipo]);
    const [lx0, ix0] = campo('x desde', '-3', 6);
    const [lx1, ix1] = campo('x hasta', '3', 6);
    const [ly0, iy0] = campo('y desde', '-3', 6);
    const [ly1, iy1] = campo('y hasta', '3', 6);
    const [lt, iT] = campo('Título (opcional)', '');
    iT.maxLength = 200;
    const filaY = fila(ly0, ly1);
    filaY.hidden = tipo !== 'grafico3d';
    const ayuda = crear('p', 'dlg-nota', AYUDAS[tipo]);
    const error = crear('p', 'dlg-estado');
    error.setAttribute('aria-live', 'polite');
    const partes = [crear('h3', '', 'Armalo con una fórmula')];
    if (formula.length > 1) {
      const tipos = crear('div', 'dlg-tipos');
      tipos.setAttribute('role', 'group');
      tipos.setAttribute('aria-label', 'Qué gráfico');
      formula.forEach((valor) => {
        const b = boton(NOMBRES_TIPO[valor], 'b-sec');
        b.setAttribute('aria-pressed', String(valor === tipo));
        b.addEventListener('click', () => {
          tipo = valor;
          [...tipos.children].forEach((o) => o.setAttribute('aria-pressed', String(o === b)));
          lf.firstChild.nodeValue = valor === 'grafico3d' ? 'z = f(x, y)' : 'y = f(x)';
          if (Object.values(DE_EJEMPLO).includes(iF.value)) iF.value = DE_EJEMPLO[valor];
          filaY.hidden = valor !== 'grafico3d';
          ayuda.textContent = AYUDAS[valor];
          error.textContent = '';
        });
        tipos.append(b);
      });
      partes.push(tipos);
    }
    const bSumar = boton('Sumar el gráfico', 'b-pri');
    // A wrong value marks its field, ties the message to it and takes the focus there. Editing clears the mark, and
    // Enter in any field adds the graph.
    error.id = `dlgError${(cuentaError += 1)}`;
    const campos = [iF, ix0, ix1, iy0, iy1];
    const marcar = (malos) => {
      campos.forEach((i) => {
        const mal = malos.includes(i);
        i.toggleAttribute('aria-invalid', mal);
        if (mal) i.setAttribute('aria-describedby', error.id);
        else i.removeAttribute('aria-describedby');
      });
      malos[0]?.focus();
    };
    [...campos, iT].forEach((i) => {
      i.addEventListener('input', () => {
        if (i.hasAttribute('aria-invalid')) marcar([]);
      });
      i.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          bSumar.click();
        }
      });
    });
    bSumar.addEventListener('click', () => {
      const rx = [numeroDe(ix0.value), numeroDe(ix1.value)];
      const ry = tipo === 'grafico3d' ? [numeroDe(iy0.value), numeroDe(iy1.value)] : null;
      const f = iF.value.trim();
      const cfg = armarPropio(tipo, f, rx, ry);
      if (typeof cfg === 'string') {
        error.textContent = cfg;
        // Which ends are wrong: not a number, too big, or a pair out of order.
        const pares = [[ix0, ix1, rx], ...(ry ? [[iy0, iy1, ry]] : [])];
        const malos = pares.flatMap(([i0, i1, [a, b]]) => {
          const fuera = [[i0, a], [i1, b]].filter(([, v]) => !Number.isFinite(v) || Math.abs(v) > 1e6).map(([i]) => i);
          return fuera.length ? fuera : a >= b ? [i0, i1] : [];
        });
        marcar(/extremo/.test(cfg) && malos.length ? malos : [iF]);
        return;
      }
      marcar([]);
      const t = corto(iT.value, 200) || `${tipo === 'grafico3d' ? 'z' : 'y'} = ${f}`;
      terminar({ g: tipo, c: cfg, t, d: `${tipo === 'grafico3d' ? 'Superficie' : 'Curva'} ${t}, para x entre ${rx[0]} y ${rx[1]}${ry ? ` e y entre ${ry[0]} y ${ry[1]}` : ''}.` });
    });
    partes.push(lf, fila(lx0, lx1), filaY, ayuda, lt, error, fila(bSumar, bCerrar));
    return partes;
  };
  const listaDe = (items, armar, terminar, clase = '') => {
    const ul = crear('ul', `dlg-lista ${clase}`.trim());
    items.forEach((x) => {
      const [texto, detalle, pieza] = armar(x);
      const b = boton('', 'dlg-opcion');
      b.append(crear('span', '', texto), crear('small', '', detalle));
      b.addEventListener('click', () => terminar(pieza));
      const li = crear('li');
      li.append(b);
      ul.append(li);
    });
    return ul;
  };
  /** Opens the dialog to add a graph: the subject's simulators, the graphs of its pages and one made from a formula, as
   * far as the subject has each. Simulators need the subject they come from. Resolves with the piece, or null if the
   * person cancels. */
  const elegirGrafico = async (urlCatalogo, materia, alAbrir) => {
    const cat = urlCatalogo ? await catalogo(urlCatalogo) : leerCatalogo(null);
    const simuladores = typeof materia === 'string' && MATERIA.test(materia) ? cat.simuladores : [];
    const { graficos, formula } = cat;
    await cargarW();
    return new Promise((ok) => {
      let elegido = null;
      const d = crear('dialog', 'dlg dlg-ancho');
      d.addEventListener('close', () => {
        d.remove();
        ok(elegido);
      });
      const terminar = (p) => {
        elegido = p;
        d.close();
      };
      const h = crear('h2', '', 'Sumar un gráfico');
      h.id = 'pzGraficoTitulo';
      d.setAttribute('aria-labelledby', h.id);
      const partes = [h];
      const bCerrar = boton('Cancelar', 'b-sec');
      bCerrar.addEventListener('click', () => d.close());
      if (simuladores.length) {
        partes.push(
          crear('h3', '', 'Con tus datos'),
          crear('p', 'dlg-nota', 'Los completás con los datos de tu ejercicio y quedan así en tu resumen.'),
          listaDe(
            simuladores,
            (s) => {
              const t = sinMarcas(s.titulo) || 'Simulador';
              const desc = sinMarcas(s.desc, 800);
              return [t, desc, { g: 'interactivo', n: s.nombre, m: materia, c: {}, t, d: desc, p: '' }];
            },
            terminar,
            'dlg-sim',
          ),
        );
      }
      if (graficos.length) {
        partes.push(
          crear('h3', '', 'De este resumen'),
          listaDe(graficos, (f) => [sinMarcas(f.titulo) || 'Gráfico', `${corto(f.pagina, 80)}${f.tipo === 'grafico3d' ? ', en 3D' : ''}`, { g: f.tipo, c: f.cfg, t: sinMarcas(f.titulo), d: sinMarcas(f.desc, 800), p: corto(f.pagina, 80) }], terminar),
        );
      }
      if (formula.length) partes.push(...partesFormula(formula, terminar, bCerrar));
      else if (simuladores.length || graficos.length) partes.push(fila(bCerrar));
      else {
        bCerrar.textContent = 'Cerrar';
        partes.push(crear('p', '', 'Esta materia todavía no tiene gráficos para sumar.'), fila(bCerrar));
      }
      d.append(...partes);
      document.body.append(d);
      d.showModal();
      if (typeof alAbrir === 'function') alAbrir();
    });
  };

  window.UTN_PIEZAS = { MAX_FOTOS, MAX_CFG, corto, objeto, cargarW, montar, soltar, imagen, figura, achicar, elegirArchivo, elegirGrafico };
})();
