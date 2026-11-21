// Simuladores de Bases de Datos para «Armá tu resumen». El alumno escribe su relación y sus dependencias funcionales
// (DF) y cada pieza muestra el procedimiento con las palabras del material (parcial-1.md, «Claves y reglas de
// integridad» y «Normalización»). Lo que escribe se lee con un parser propio. En una página de la materia los campos
// quedan fijos en el ejemplo, así que ahí no se puede resolver un ejercicio de examen.
(() => {
  const MAX_ATR = 12;
  const MAX_DF = 20;
  const MAX_TABLAS = 16;
  const TOPE = { relacion: 300, df: 1200, conjunto: 200, cp: 300 };
  const NOMBRE = /^[\p{L}_][\p{L}\p{N}_]{0,29}$/u;
  // Los ejemplos salen del quiz del 1° parcial: 25/09/2023 (ETAPAS) y 29/09/2025 (PRODUCTO), adaptados.
  const EJEMPLO = {
    claves: { relacion: 'ETAPAS(nroProyecto, nroEtapa, descProyecto, detalleEtapa)', df: 'nroProyecto, nroEtapa -> detalleEtapa\nnroProyecto -> descProyecto', conjunto: 'nroProyecto' },
    normalizacion: { relacion: 'PRODUCTO(idProducto, nombre, codCategoria, nombreCategoria)', df: 'idProducto -> nombre, codCategoria\ncodCategoria -> nombreCategoria' },
  };

  let cuenta = 0;
  const nuevoId = () => `bd-${(cuenta += 1)}`;
  const enResumenDe = (figura, ayuda) => ayuda.enResumen ?? figura.classList.contains('ag-pieza');
  /** cfg.datos comes from the browser's storage: a saved string within its cap, or undefined. */
  const guardado = (cfg, clave) => {
    const d = cfg && cfg.datos;
    if (!d || typeof d !== 'object' || Array.isArray(d) || !Object.prototype.hasOwnProperty.call(d, clave)) return undefined;
    return typeof d[clave] === 'string' && d[clave].length <= TOPE[clave] ? d[clave] : undefined;
  };
  const corto = (t) => (t.length > 40 ? `${t.slice(0, 40)}…` : t);

  // ----- Sets of attributes as bit masks (at most 12 attributes)
  const bits = (m) => {
    const r = [];
    for (let i = 0; i < MAX_ATR; i += 1) if ((m >> i) & 1) r.push(i);
    return r;
  };
  const cuantos = (m) => bits(m).length;
  const subconjuntos = (m) => {
    const b = bits(m);
    const r = [];
    for (let s = 1; s < 1 << b.length; s += 1) r.push(b.reduce((a, x, j) => ((s >> j) & 1 ? a | (1 << x) : a), 0));
    return r.sort((x, y) => cuantos(x) - cuantos(y) || x - y);
  };

  function leerRelacion(texto) {
    const t = texto.trim();
    if (!t) return { error: 'Escribí la relación, como R(a, b, c).' };
    const m = /^([^\s(),]*)\s*\(([^()]*)\)$/.exec(t);
    if (!m && /[()]/.test(t)) return { error: 'Revisá los paréntesis de la relación. Va así, R(a, b, c).' };
    const nombre = m ? m[1] || 'R' : 'R';
    if (!NOMBRE.test(nombre)) return { error: `«${corto(nombre)}» no sirve como nombre. Usá letras, números y guion bajo.` };
    const attrs = (m ? m[2] : t).split(/[\s,;]+/).filter(Boolean);
    if (!attrs.length) return { error: 'La relación no tiene atributos.' };
    const malo = attrs.find((a) => !NOMBRE.test(a));
    if (malo) return { error: `«${corto(malo)}» no es un nombre de atributo. Usá letras, números y guion bajo, sin espacios.` };
    const rep = attrs.find((a, i) => attrs.indexOf(a) !== i);
    if (rep) return { error: `«${rep}» está dos veces en la relación.` };
    if (attrs.length > MAX_ATR) return { error: `Son ${attrs.length} atributos y el tope es ${MAX_ATR}. Probá con una parte de la relación.` };
    return { nombre, attrs };
  }

  const ladoDe = (s) => s.replace(/[(){}]/g, ' ').split(/[\s,]+/).filter(Boolean);
  function leerAtributos(texto, attrs) {
    const idx = new Map(attrs.map((a, i) => [a, i]));
    let m = 0;
    for (const a of ladoDe(texto)) {
      if (!idx.has(a)) {
        const parecido = attrs.find((b) => b.toLowerCase() === a.toLowerCase());
        return { error: `«${corto(a)}» no está en la relación.${parecido ? ` ¿Es «${parecido}»?` : ''}` };
      }
      m |= 1 << idx.get(a);
    }
    return { m };
  }

  function leerDF(texto, attrs) {
    const lineas = texto.split(/[\n;]+/).map((l) => l.trim()).filter(Boolean);
    if (lineas.length > MAX_DF) return { error: `Son ${lineas.length} dependencias y el tope es ${MAX_DF}.` };
    const dfs = [];
    for (const l of lineas) {
      const partes = l.split(/->|→/);
      if (partes.length > 2) return { error: `«${corto(l)}» tiene más de una flecha. Poné una DF por renglón.` };
      if (partes.length !== 2) return { error: `A «${corto(l)}» le falta la flecha, como en a -> b.` };
      const izq = leerAtributos(partes[0], attrs);
      if (izq.error) return izq;
      const der = leerAtributos(partes[1], attrs);
      if (der.error) return der;
      if (!izq.m) return { error: `A «${corto(l)}» le falta el determinante, a la izquierda.` };
      if (!der.m) return { error: `A «${corto(l)}» le falta lo que determina, a la derecha.` };
      const solo = der.m & ~izq.m;
      if (!solo) return { error: `«${corto(l)}» no dice nada nuevo, porque lo de la derecha ya está a la izquierda.` };
      dfs.push({ izq: izq.m, der: solo });
    }
    return { dfs };
  }

  // ----- What the dependencies give: closure, candidate keys, normal form and decomposition
  function motor(attrs, dfs) {
    const U = (1 << attrs.length) - 1;
    const memo = new Map();
    const cierre = (m) => {
      if (memo.has(m)) return memo.get(m);
      let c = m;
      let otra = true;
      while (otra) {
        otra = false;
        for (const d of dfs) {
          if ((d.izq & c) === d.izq && d.der & ~c) {
            c |= d.der;
            otra = true;
          }
        }
      }
      memo.set(m, c);
      return c;
    };
    const nombres = (m) => bits(m).map((i) => attrs[i]);
    const lista = (m) => nombres(m).join(', ');
    const conj = (m) => `{${lista(m)}}`;
    const det = (m) => (cuantos(m) > 1 ? `(${lista(m)})` : lista(m));
    const df = (d) => `${lista(d.izq)} -> ${lista(d.der)}`;
    /** Candidate keys of the table T: the least sets inside T whose closure covers T. */
    const clavesDe = (T) => {
      const nucleo = bits(T).reduce((a, i) => ((cierre(T & ~(1 << i)) >> i) & 1 ? a : a | (1 << i)), 0);
      if ((cierre(nucleo) & T) === T) return [nucleo];
      const ks = [];
      for (const s of subconjuntos(T & ~nucleo)) {
        const m = nucleo | s;
        if (ks.some((k) => (k & m) === k)) continue;
        if ((cierre(m) & T) === T) ks.push(m);
      }
      return ks;
    };
    return { U, cierre, nombres, lista, conj, det, df, clavesDe };
  }

  function pasosCierre(e, dfs, X) {
    let c = X;
    const pasos = [];
    let otra = true;
    while (otra) {
      otra = false;
      for (const d of dfs) {
        if ((d.izq & c) === d.izq && d.der & ~c) {
          const suma = d.der & ~c;
          c |= d.der;
          pasos.push(`Por ${e.df(d)}, como ${e.det(d.izq)} ya está, sumás ${e.lista(suma)}. Queda ${e.conj(c)}.`);
          otra = true;
        }
      }
    }
    return { c, pasos };
  }

  /** The steps the notes use to find the key: who nobody determines, who only appears on the right, and what is left. */
  function pasosClaves(e, attrs, dfs) {
    const { U } = e;
    let derecha = 0;
    let izquierda = 0;
    dfs.forEach((d) => {
      derecha |= d.der;
      izquierda |= d.izq;
    });
    const nucleo = U & ~derecha;
    const soloDer = derecha & ~izquierda;
    const medio = U & ~nucleo & ~soloDer;
    const lineas = [];
    if (nucleo) lineas.push(`${e.lista(nucleo)} no ${cuantos(nucleo) > 1 ? 'están' : 'está'} a la derecha de ninguna DF. Nadie ${cuantos(nucleo) > 1 ? 'los' : 'lo'} determina, así que ${cuantos(nucleo) > 1 ? 'van' : 'va'} en toda clave.`);
    else lineas.push('Todos los atributos aparecen a la derecha de alguna DF, así que no hay ninguno que vaya sí o sí en la clave.');
    if (soloDer) lineas.push(`${e.lista(soloDer)} ${cuantos(soloDer) > 1 ? 'aparecen' : 'aparece'} solo a la derecha. Ninguna clave ${cuantos(soloDer) > 1 ? 'los' : 'lo'} necesita.`);
    const ks = [];
    const pruebas = [];
    if (nucleo && e.cierre(nucleo) === U) {
      ks.push(nucleo);
      lineas.push(`${e.conj(nucleo)}⁺ = ${e.conj(U)}. Ya determina todo, así que es la única clave candidata.`);
    } else {
      if (nucleo) lineas.push(`${e.conj(nucleo)}⁺ = ${e.conj(e.cierre(nucleo))}. No alcanza, así que le sumás de los que están de los dos lados, ${e.conj(medio)}, de menos a más.`);
      else lineas.push(`Se prueban los que están de los dos lados, ${e.conj(medio)}, de menos a más.`);
      for (const s of subconjuntos(medio)) {
        const m = nucleo | s;
        if (ks.some((k) => (k & m) === k)) continue;
        const c = e.cierre(m);
        if (c === U) ks.push(m);
        pruebas.push(`${e.conj(m)}⁺ = ${c === U ? 'todos los atributos. Es clave candidata' : `${e.conj(c)}. No alcanza`}.`);
      }
      const MOSTRAR = 10;
      lineas.push(...pruebas.slice(0, MOSTRAR));
      if (pruebas.length > MOSTRAR) lineas.push(`Y se prueban ${pruebas.length - MOSTRAR} combinaciones más. Las que contienen una clave ya encontrada se saltean.`);
    }
    return { ks, lineas };
  }

  const nombreClaves = (e, ks) => {
    const t = ks.map((k) => e.det(k));
    if (t.length > 6) return `${t.slice(0, 5).join(', ')} y ${t.length - 5} más`;
    return t.length > 1 ? `${t.slice(0, -1).join(', ')} y ${t[t.length - 1]}` : t[0];
  };

  /** 2FN, 3FN and FNBC of the whole relation, each with the dependency that breaks it. */
  function formas(e, dfs, ks) {
    const { U } = e;
    const primos = ks.reduce((a, k) => a | k, 0);
    const noClave = U & ~primos;
    const compuestas = ks.filter((k) => cuantos(k) > 1);
    // Partial: a non-key attribute that a proper part of a key already determines, with the least such part.
    const partes = [...new Set(compuestas.flatMap((k) => subconjuntos(k).filter((s) => s !== k)))].sort((x, y) => cuantos(x) - cuantos(y) || x - y);
    const parciales = [];
    let puestos = 0;
    for (const S of partes) {
      const D = e.cierre(S) & noClave & ~S & ~puestos;
      if (!D) continue;
      puestos |= D;
      const clave = compuestas.find((k) => (k & S) === S);
      const dada = dfs.some((d) => d.izq === S && d.der & D);
      parciales.push({ S, D, clave, dada });
    }
    const esParte = (X) => compuestas.some((k) => (k & X) === X && X !== k);
    const transitivas = [];
    dfs.forEach((d) => {
      const A = d.der & noClave;
      if (A && e.cierre(d.izq) !== U && !esParte(d.izq)) transitivas.push({ d, A });
    });
    const fnbc = dfs.filter((d) => e.cierre(d.izq) !== U);
    const nivel = parciales.length ? 1 : transitivas.length ? 2 : fnbc.length ? 3 : 4;
    return { primos, noClave, compuestas, parciales, transitivas, fnbc, nivel };
  }

  const NIVEL = ['', 'Está en 1FN, pero no en 2FN.', 'Está en 2FN, pero no en 3FN.', 'Está en 3FN, pero no en FNBC.', 'Está en FNBC.'];

  function pasosFormas(e, f, cp) {
    const l = [];
    l.push('1FN. Se supone que cada valor es atómico, porque eso no se ve en las DF. Si hay un atributo multivaluado o un grupo repetido, no llega ni a 1FN.');
    if (!f.noClave) l.push('2FN. Sí, porque no hay atributos no clave.');
    else if (!f.compuestas.length) l.push(`2FN. Sí, porque la clave es simple y no hay «parte» de la clave de la que depender.`);
    else if (!f.parciales.length) l.push('2FN. Sí, cada no clave depende de toda la clave.');
    else {
      f.parciales.forEach((p) => {
        const plural = cuantos(p.D) > 1;
        l.push(`2FN. No, ${e.lista(p.D)} ${plural ? 'dependen' : 'depende'} de ${e.det(p.S)}, que es solo una parte de la clave ${e.det(p.clave)}. Es parcial, ${e.det(p.S)} -> ${e.lista(p.D)}${p.dada ? '' : `, que sale de ${e.conj(p.S)}⁺`}.`);
      });
    }
    if (!f.transitivas.length) l.push(f.parciales.length ? '3FN. Ninguna DF tiene un no clave que dependa de algo que no es clave. Igual no llega, porque antes falla 2FN.' : '3FN. Sí, ningún no clave depende de algo que no sea clave.');
    else {
      f.transitivas.slice(0, 3).forEach(({ d, A }) => {
        l.push(`3FN. No, por ${e.df(d)}. ${e.lista(A)} ${cuantos(A) > 1 ? 'son no clave y dependen' : 'es no clave y depende'} de ${e.det(d.izq)}, que no es clave. Es transitiva, ${e.det(cp)} -> ${e.det(d.izq)} -> ${e.lista(A)}.`);
      });
      if (f.transitivas.length > 3) l.push(`3FN. Pasa lo mismo con ${f.transitivas.slice(3).map((t) => e.df(t.d)).join('; ')}.`);
    }
    if (!f.fnbc.length) l.push('FNBC. Sí, todo determinante es clave candidata o la contiene.');
    else {
      const d = f.fnbc[0];
      l.push(`FNBC. No, por ${e.df(d)}. ${e.det(d.izq)} es un determinante que no es clave candidata ni la contiene.${f.fnbc.length > 1 ? ` Pasa lo mismo con ${f.fnbc.slice(1).map((x) => e.df(x)).join('; ')}.` : ''}`);
    }
    return l;
  }

  /** The method of the notes: for each problem dependency a new table with the determinant as key and what it
   * determines, and the determinant stays in the original as a foreign key. First the partial ones, then the rest. */
  function descomponer(e, dfs, rel, cp, f) {
    const tablas = [{ nombre: rel.nombre, attrs: e.U, cp, cfs: [] }];
    const pasos = [];
    let n = 0;
    const nueva = (attrs, clave) => {
      n += 1;
      const t = { nombre: `R${n}`, attrs, cp: clave, cfs: [] };
      tablas.push(t);
      return t;
    };
    const mudar = (T, R, mover) => {
      T.cfs = T.cfs.filter((cf) => {
        if (!(cf.attrs & mover) || cf.attrs & ~R.attrs) return true;
        R.cfs.push(cf);
        return false;
      });
      T.attrs &= ~mover;
      T.cfs.push({ attrs: R.cp, ref: R.nombre });
    };
    for (const p of f.parciales) {
      const T = tablas[0];
      const mover = p.D & T.attrs;
      if (!mover) continue;
      const R = nueva(p.S | mover, p.S);
      mudar(T, R, mover);
      pasos.push(`Por ${e.det(p.S)} -> ${e.lista(mover)}, que es parcial, sacás ${R.nombre} con ${e.lista(R.attrs)} y CP ${e.det(p.S)}. En ${T.nombre}, ${e.det(p.S)} queda en la CP y es CF a ${R.nombre}.`);
    }
    // In each table, a dependency whose determinant is not a key of that table and that gives a non-key attribute.
    const falla = (T) => {
      const ks = e.clavesDe(T.attrs);
      const primos = ks.reduce((a, k) => a | k, 0);
      const esSuper = (X) => (e.cierre(X) & T.attrs) === T.attrs;
      const candidatos = [...dfs.map((d) => d.izq).filter((X) => (X & T.attrs) === X), ...subconjuntos(T.attrs)];
      for (const X of candidatos) {
        if (esSuper(X)) continue;
        const A = e.cierre(X) & T.attrs & ~X & ~primos;
        if (A) return { X, A, ks, parcial: ks.some((k) => (k & X) === X), dada: dfs.some((d) => d.izq === X && d.der & A) };
      }
      return null;
    };
    for (let i = 0, vueltas = 0; i < tablas.length && vueltas < 60; vueltas += 1) {
      const T = tablas[i];
      const v = tablas.length < MAX_TABLAS ? falla(T) : null;
      if (!v) {
        i += 1;
        continue;
      }
      const R = nueva(v.X | v.A, v.X);
      mudar(T, R, v.A);
      const tipo = v.parcial ? 'parcial' : 'transitiva';
      pasos.push(`En ${T.nombre}, ${e.det(v.X)} -> ${e.lista(v.A)} es ${tipo}${v.dada ? '' : ` (sale de ${e.conj(v.X)}⁺)`}, porque ${e.det(v.X)} no es clave de ${T.nombre}. Sacás ${R.nombre} con ${e.lista(R.attrs)} y CP ${e.det(v.X)}. En ${T.nombre} queda ${e.det(v.X)} como CF a ${R.nombre}.`);
    }
    // The keys of each new table, for the CP line, and whether it reaches FNBC.
    tablas.forEach((T) => {
      const ks = e.clavesDe(T.attrs);
      if (!ks.some((k) => k === T.cp)) T.cp = ks.find((k) => (k & T.cp) === k) || ks[0];
      const X = [...dfs.map((d) => d.izq).filter((m) => (m & T.attrs) === m), ...subconjuntos(T.attrs)].find((m) => (e.cierre(m) & T.attrs) !== T.attrs && e.cierre(m) & T.attrs & ~m);
      T.noBC = X ? { X, A: e.cierre(X) & T.attrs & ~X } : null;
    });
    return { tablas, pasos };
  }

  /** A table as the notes write it: name (attributes), CP -> …, CF(…) -> table(…). */
  const renglonesTabla = (e, T) => {
    const orden = [...bits(T.cp), ...bits(T.attrs & ~T.cp)];
    return [
      `${T.nombre} (${orden.map((i) => e.nombres(1 << i)[0]).join(', ')})`,
      `CP -> ${e.lista(T.cp)}`,
      ...T.cfs.map((cf) => `CF(${e.lista(cf.attrs)}) -> ${cf.ref}(${e.lista(cf.attrs)})`),
    ];
  };

  // ----- Dependency diagram: the attributes in a row and, under them, one line per DF with arrows to what it determines
  function diagrama(ayuda, e, attrs, dfs, op) {
    const { svg } = ayuda;
    const FS = 13;
    const ALTO = 26;
    const SEP = 10;
    const M = 8;
    const CARRIL = 15;
    const anchos = attrs.map((a) => Math.max(40, Math.round(a.length * 7.9 + 18)));
    const xs = [];
    let x = M;
    anchos.forEach((w) => {
      xs.push(x);
      x += w + SEP;
    });
    const W = Math.max(120, x - SEP + M);
    const base = M + ALTO;
    const H = dfs.length ? base + 14 + (dfs.length - 1) * CARRIL + 10 : base + M;
    const usos = attrs.map(() => []);
    dfs.forEach((d, i) => bits(d.izq | d.der).forEach((b) => usos[b].push(i)));
    const lugar = (b, i) => {
      const u = usos[b];
      const paso = Math.min(8, (anchos[b] - 14) / Math.max(1, u.length - 1));
      return xs[b] + anchos[b] / 2 + (u.indexOf(i) - (u.length - 1) / 2) * paso;
    };
    const hijos = [];
    attrs.forEach((a, b) => {
      const marcado = (op.resaltar >> b) & 1;
      hijos.push(
        svg('rect', { x: xs[b], y: M, width: anchos[b], height: ALTO, rx: 3, fill: marcado ? 'var(--resaltador)' : 'var(--papel)', stroke: 'var(--tinta-suave)', 'stroke-width': 1.2 }),
        svg('text', { x: xs[b] + anchos[b] / 2, y: M + ALTO / 2 + 4.5, 'text-anchor': 'middle', 'font-size': FS, fill: marcado ? 'var(--sobre-resaltador)' : 'var(--tinta)', style: 'font-family: var(--mono)' }, a),
      );
      if ((op.clave >> b) & 1) hijos.push(svg('line', { x1: xs[b] + 7, x2: xs[b] + anchos[b] - 7, y1: M + ALTO - 4, y2: M + ALTO - 4, stroke: marcado ? 'var(--sobre-resaltador)' : 'var(--tinta)', 'stroke-width': 1.4 }));
    });
    dfs.forEach((d, i) => {
      const y = base + 14 + i * CARRIL;
      const tipo = op.tipo ? op.tipo(i) : '';
      const color = tipo === 'parcial' ? 'var(--mal)' : tipo === 'transitiva' ? 'var(--birome)' : 'var(--tinta-suave)';
      const trazo = { stroke: color, 'stroke-width': tipo ? 2 : 1.5, 'stroke-dasharray': tipo === 'parcial' ? '7 3' : tipo === 'transitiva' ? '2 3' : null, fill: 'none' };
      const todos = bits(d.izq | d.der).map((b) => lugar(b, i));
      hijos.push(svg('line', { x1: Math.min(...todos), x2: Math.max(...todos), y1: y, y2: y, ...trazo }));
      bits(d.izq).forEach((b) => {
        const sx = lugar(b, i);
        hijos.push(svg('line', { x1: sx, x2: sx, y1: base, y2: y, ...trazo }), svg('circle', { cx: sx, cy: y, r: 2.6, fill: color }));
      });
      bits(d.der).forEach((b) => {
        const sx = lugar(b, i);
        hijos.push(svg('line', { x1: sx, x2: sx, y1: y, y2: base + 7, ...trazo }), svg('polygon', { points: `${sx},${base + 1} ${sx - 4},${base + 8} ${sx + 4},${base + 8}`, fill: color }));
      });
    });
    const s = svg('svg', { viewBox: `0 0 ${W} ${H}`, width: W, height: H, role: 'img', 'aria-label': op.etiqueta }, ...hijos);
    s.style.cssText = `display:block;width:${W}px;height:${H}px;max-width:none`;
    return s;
  }

  /** The picture: the diagram as on screen and, under it, the texts (ayuda.pngTablas, dark on white). */
  async function apilar(ayuda, dibujo, partes) {
    const urls = [dibujo ? await ayuda.png(dibujo) : null, ayuda.pngTablas ? await ayuda.pngTablas(partes.filter(Boolean)) : null].filter(Boolean);
    const imgs = await Promise.all(urls.map(async (u) => {
      const i = new Image();
      i.src = u;
      await i.decode();
      return i;
    }));
    if (!imgs.length) return null;
    const c = document.createElement('canvas');
    c.width = Math.max(...imgs.map((i) => i.width));
    c.height = imgs.reduce((a, i) => a + i.height, 0);
    const g = c.getContext('2d');
    g.fillStyle = '#fff';
    g.fillRect(0, 0, c.width, c.height);
    let y = 0;
    imgs.forEach((i) => {
      g.drawImage(i, 0, y);
      y += i.height;
    });
    return c.toDataURL('image/png');
  }

  // ----- The fields both pieces share: the relation and its dependencies
  function entradas(figura, cfg, ayuda, ejemplo, conConjunto) {
    const { crear } = ayuda;
    const propio = enResumenDe(figura, ayuda);
    // The relation and its DF go together: if one of them came back broken, the whole example comes back, so the
    // fields never mix the student's relation with the example's DF.
    const suyos = propio && guardado(cfg, 'relacion') !== undefined && guardado(cfg, 'df') !== undefined;
    const valor = (k) => (suyos ? guardado(cfg, k) ?? '' : typeof cfg[k] === 'string' && cfg[k].length <= TOPE[k] ? cfg[k] : ejemplo[k]);
    const campo = (etq, k, largo) => {
      const id = nuevoId();
      const inp = crear(largo ? 'textarea' : 'input', { id, spellcheck: false, autocomplete: 'off', autocapitalize: 'off', maxLength: TOPE[k], readOnly: !propio });
      if (largo) inp.rows = 4;
      else inp.type = 'text';
      inp.value = valor(k) ?? '';
      inp.style.cssText = 'width:100%;box-sizing:border-box';
      const fila = crear('div', { className: 'w-entrada' }, crear('label', { htmlFor: id }, etq), inp);
      fila.style.marginBottom = '.5rem';
      return { inp, fila };
    };
    const rel = campo('Relación', 'relacion');
    const dfs = campo('Dependencias funcionales, una por renglón', 'df', true);
    const conj = conConjunto ? campo('Conjunto para calcular su cierre', 'conjunto') : null;
    const nota = crear('p', { className: 'w-ayuda' }, propio ? 'La relación va como R(a, b, c). Cada DF, como a, b -> c, y los atributos con el mismo nombre que en la relación.' : 'Es el ejemplo del material. En «Armá tu resumen» lo cambiás por tu relación.');
    nota.style.margin = '0 0 .5rem';
    const error = crear('p', { className: 'w-error', role: 'status' });
    error.hidden = true;
    return { rel, dfs, conj, nota, error, propio, suyos, filas: [rel.fila, dfs.fila, conj && conj.fila, nota, error].filter(Boolean) };
  }

  /** Reads the relation and the DF of the fields. Shows the error under them, marking the field it comes from. */
  function leer(en) {
    [en.rel, en.dfs, en.conj].filter(Boolean).forEach((c) => c.inp.setAttribute('aria-invalid', 'false'));
    const mal = (c, error) => {
      c.inp.setAttribute('aria-invalid', 'true');
      en.error.textContent = error;
      en.error.hidden = false;
      return null;
    };
    const r = leerRelacion(en.rel.inp.value);
    if (r.error) return mal(en.rel, r.error);
    const d = leerDF(en.dfs.inp.value, r.attrs);
    if (d.error) return mal(en.dfs, d.error);
    let X = null;
    if (en.conj && en.conj.inp.value.trim()) {
      const x = leerAtributos(en.conj.inp.value, r.attrs);
      if (x.error) return mal(en.conj, x.error);
      X = x.m;
    }
    en.error.textContent = '';
    en.error.hidden = true;
    return { rel: r, dfs: d.dfs, X };
  }

  const marco = (ayuda) => {
    const m = ayuda.crear('div', {});
    m.style.cssText = 'max-width:100%;overflow-x:auto;margin:.5rem 0';
    return m;
  };
  const titulo = (ayuda, t) => {
    const h = ayuda.crear('p', { className: 'w-titular' }, t);
    h.style.margin = '.8rem 0 .3rem';
    return h;
  };
  const listaDe = (ayuda, lineas, numerada = true) => ayuda.crear(numerada ? 'ol' : 'ul', {}, ...lineas.map((t) => ayuda.crear('li', {}, t)));

  // ----- Closure of a set and candidate keys
  UTN.interactivo('claves', (figura, cfg, ayuda) => {
    const { crear, lienzo } = ayuda;
    const en = entradas(figura, cfg, ayuda, EJEMPLO.claves, true);
    const titular = crear('p', { className: 'w-titular', 'aria-live': 'polite' });
    const dibujo = marco(ayuda);
    const salida = crear('div', { className: 'w-resultado' });
    let hecho = null;
    const calcular = () => {
      hecho = null;
      const d = leer(en);
      if (!d) {
        titular.textContent = '';
        dibujo.replaceChildren();
        salida.replaceChildren();
        return;
      }
      const { rel, dfs, X } = d;
      const e = motor(rel.attrs, dfs);
      const k = pasosClaves(e, rel.attrs, dfs);
      const cierreX = X ? pasosCierre(e, dfs, X) : null;
      const lineasX = [];
      if (cierreX) {
        lineasX.push(`Empezás con ${e.conj(X)}.`, ...cierreX.pasos, `Ninguna DF suma nada más. ${e.conj(X)}⁺ = ${e.conj(cierreX.c)}.`);
        if (cierreX.c !== e.U) lineasX.push(`No determina ${e.lista(e.U & ~cierreX.c)}, así que no es superclave.`);
        else {
          const sobra = bits(X).find((i) => e.cierre(X & ~(1 << i)) === e.U);
          lineasX.push(sobra === undefined ? 'Determina todos los atributos y no le sobra ninguno. Es clave candidata.' : `Determina todos los atributos, así que es superclave. Pero le sobra ${rel.attrs[sobra]}, así que no es candidata.`);
        }
      }
      const sk = `${k.ks.length > 1 ? 'Las claves candidatas son' : 'La clave candidata es'} ${nombreClaves(e, k.ks)}.`;
      titular.textContent = sk;
      const primos = k.ks.reduce((a, x) => a | x, 0);
      const etiqueta = `Diagrama de dependencias de ${rel.nombre}. ${dfs.map((x) => `${e.lista(x.izq)} determina ${e.lista(x.der)}`).join('. ')}.`;
      const s = diagrama(ayuda, e, rel.attrs, dfs, { clave: k.ks[0], resaltar: cierreX ? cierreX.c : 0, etiqueta });
      dibujo.replaceChildren(s);
      const pie = crear('p', { className: 'w-ayuda' }, cierreX ? `Subrayada, la clave ${e.det(k.ks[0])}. Resaltado, el cierre de ${e.conj(X)}.` : `Subrayada, la clave ${e.det(k.ks[0])}.`);
      const final = `Cualquier conjunto que contenga ${k.ks.length > 1 ? 'una de ellas' : 'a la clave'} es superclave. Atributos clave, ${e.lista(primos)}.${primos !== e.U ? ` No clave, ${e.lista(e.U & ~primos)}.` : ''}`;
      salida.replaceChildren(
        pie,
        ...(cierreX ? [titulo(ayuda, `Cierre de ${e.conj(X)}`), listaDe(ayuda, lineasX)] : [crear('p', { className: 'w-ayuda' }, 'Escribí un conjunto arriba para ver su cierre paso a paso.')]),
        titulo(ayuda, 'Claves candidatas, paso a paso'),
        listaDe(ayuda, k.lineas),
        crear('p', {}, final),
      );
      hecho = { rel, dfs, e, X, lineasX, k, s, final, sk };
    };
    const cambio = () => {
      calcular();
      if (en.propio) ayuda.guardarDatos?.({ relacion: en.rel.inp.value, df: en.dfs.inp.value, conjunto: en.conj.inp.value });
    };
    [en.rel, en.dfs, en.conj].forEach((c) => c.inp.addEventListener('input', cambio));
    lienzo.append(...en.filas, titular, dibujo, salida);
    calcular();
    const imagen = () => {
      if (!hecho) return Promise.resolve(null);
      const { rel, dfs, e, X, lineasX, k, s, final, sk } = hecho;
      return apilar(ayuda, s, [
        { texto: `${rel.nombre}(${rel.attrs.join(', ')})`, negrita: true },
        ...dfs.map((d) => ({ texto: e.df(d) })),
        { texto: sk, negrita: true },
        ...(X ? [{ texto: `Cierre de ${e.conj(X)}`, negrita: true }, ...lineasX.map((t, i) => ({ texto: `${i + 1}. ${t}` }))] : []),
        { texto: 'Claves candidatas, paso a paso', negrita: true },
        ...k.lineas.map((t, i) => ({ texto: `${i + 1}. ${t}` })),
        { texto: final },
      ]);
    };
    return { imagen };
  });

  // ----- Normal form, with the dependency that breaks each one, and the decomposition into 3FN
  UTN.interactivo('normalizacion', (figura, cfg, ayuda) => {
    const { crear, lienzo } = ayuda;
    const en = entradas(figura, cfg, ayuda, EJEMPLO.normalizacion, false);
    let cpTexto = (en.suyos ? guardado(cfg, 'cp') : undefined) ?? '';
    const idCp = nuevoId();
    const selCp = crear('select', { id: idCp });
    selCp.style.maxWidth = '100%';
    const filaCp = crear('div', { className: 'w-fila' }, crear('span', { className: 'w-campo' }, crear('label', { htmlFor: idCp }, 'Clave primaria'), selCp));
    filaCp.hidden = true;
    const titular = crear('p', { className: 'w-titular', 'aria-live': 'polite' });
    const dibujo = marco(ayuda);
    const leyenda = crear('p', { className: 'w-ayuda' });
    const salida = crear('div', { className: 'w-resultado' });
    let hecho = null;
    const calcular = () => {
      hecho = null;
      const d = leer(en);
      if (!d) {
        titular.textContent = '';
        filaCp.hidden = true;
        dibujo.replaceChildren();
        leyenda.textContent = '';
        salida.replaceChildren();
        return;
      }
      const { rel, dfs } = d;
      const e = motor(rel.attrs, dfs);
      const k = pasosClaves(e, rel.attrs, dfs);
      const ks = k.ks;
      const cp = ks.find((x) => e.lista(x) === cpTexto) ?? ks[0];
      filaCp.hidden = ks.length < 2;
      selCp.replaceChildren(...ks.map((x) => crear('option', { value: e.lista(x), selected: x === cp }, e.det(x))));
      const f = formas(e, dfs, ks);
      titular.textContent = NIVEL[f.nivel];
      const tipoDe = (i) => {
        const x = dfs[i];
        if (f.parciales.some((p) => p.S === x.izq && x.der & p.D) || (f.compuestas.some((kk) => (kk & x.izq) === x.izq && kk !== x.izq) && x.der & f.noClave)) return 'parcial';
        return f.transitivas.some((t) => t.d === x) ? 'transitiva' : '';
      };
      const hay = { parcial: false, transitiva: false };
      dfs.forEach((x, i) => {
        const t = tipoDe(i);
        if (t) hay[t] = true;
      });
      const etiqueta = `Diagrama de dependencias de ${rel.nombre}. ${dfs.map((x, i) => `${e.lista(x.izq)} determina ${e.lista(x.der)}${tipoDe(i) ? `, ${tipoDe(i)}` : ''}`).join('. ')}.`;
      const s = diagrama(ayuda, e, rel.attrs, dfs, { clave: cp, resaltar: 0, tipo: tipoDe, etiqueta });
      dibujo.replaceChildren(s);
      leyenda.textContent = [`Subrayada, la CP ${e.det(cp)}.`, hay.parcial ? 'En raya cortada, las parciales.' : '', hay.transitiva ? 'En línea de puntos, las transitivas.' : ''].filter(Boolean).join(' ');
      const claveTxt = `${ks.length > 1 ? 'Claves candidatas' : 'Clave'} ${nombreClaves(e, ks)}, porque ${ks.map((x) => `${e.conj(x)}⁺`).join(' y ')} ${ks.length > 1 ? 'tienen' : 'tiene'} todos los atributos. Atributos clave, ${e.lista(f.primos)}.${f.noClave ? ` No clave, ${e.lista(f.noClave)}.` : ''}`;
      const lineas = pasosFormas(e, f, cp);
      const partes = [titulo(ayuda, 'La clave'), crear('p', {}, claveTxt), titulo(ayuda, 'Forma por forma'), listaDe(ayuda, lineas, false)];
      let desc = null;
      if (f.nivel < 3) {
        desc = descomponer(e, dfs, rel, cp, f);
        const bloques = desc.tablas.map((T) => {
          const p = crear('p', {}, ...renglonesTabla(e, T).flatMap((t, i) => (i ? [crear('br'), t] : [t])));
          p.style.cssText = 'margin:.4rem 0;font-family:var(--mono);font-size:.92rem;overflow-wrap:anywhere';
          return p;
        });
        const bc = desc.tablas.filter((T) => T.noBC);
        desc.cierre = bc.length ? bc.map((T) => `${T.nombre} queda en 3FN, pero no en FNBC, por ${e.det(T.noBC.X)} -> ${e.lista(T.noBC.A)}. Partirla puede perder una dependencia. Consultá con tu cátedra si la piden.`) : ['Todas las tablas quedan en FNBC.'];
        partes.push(titulo(ayuda, 'Normalización hasta 3FN'), listaDe(ayuda, desc.pasos), ...bloques, ...desc.cierre.map((t) => crear('p', {}, t)), crear('p', { className: 'w-ayuda' }, 'Las tablas nuevas salen como R1, R2. Poneles el nombre que corresponda.'));
      }
      salida.replaceChildren(...partes);
      hecho = { rel, dfs, e, f, s, claveTxt, lineas, desc };
    };
    const guardar = () => {
      if (en.propio) ayuda.guardarDatos?.({ relacion: en.rel.inp.value, df: en.dfs.inp.value, cp: cpTexto });
    };
    [en.rel, en.dfs].forEach((c) => c.inp.addEventListener('input', () => {
      calcular();
      guardar();
    }));
    selCp.addEventListener('change', () => {
      cpTexto = selCp.value;
      calcular();
      guardar();
    });
    lienzo.append(...en.filas, filaCp, titular, dibujo, leyenda, salida);
    calcular();
    const imagen = () => {
      if (!hecho) return Promise.resolve(null);
      const { rel, dfs, e, f, s, claveTxt, lineas, desc } = hecho;
      return apilar(ayuda, s, [
        { texto: `${rel.nombre}(${rel.attrs.join(', ')})`, negrita: true },
        ...dfs.map((d) => ({ texto: e.df(d) })),
        { texto: NIVEL[f.nivel], negrita: true },
        { texto: leyenda.textContent },
        { texto: claveTxt },
        ...lineas.map((t) => ({ texto: t })),
        ...(desc ? [{ texto: 'Normalización hasta 3FN', negrita: true }, ...desc.pasos.map((t, i) => ({ texto: `${i + 1}. ${t}` })), ...desc.tablas.flatMap((T) => renglonesTabla(e, T).map((t, i) => ({ texto: t, negrita: i === 0 }))), ...desc.cierre.map((t) => ({ texto: t }))] : []),
      ]);
    };
    return { imagen };
  });
})();
