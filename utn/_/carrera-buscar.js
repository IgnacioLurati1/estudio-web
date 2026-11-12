// The entry page's search box also looks through every subject. The index is a separate file, downloaded the first time it is
// needed, and it never contains proposed answers. The list of subjects below keeps filtering as before.
(() => {
  const inp = document.getElementById('cBuscar');
  const lista = document.getElementById('cResultados');
  const cuenta = document.getElementById('cResCuenta');
  if (!inp || !lista) return;
  const POR_MATERIA = 4;
  const TOPE = 40;
  const ESPERA = 120;
  const d = document.documentElement;
  const normal = (s) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

  // With the protocol on, the pages of a subject go to its emergency page, so this box goes back to subjects only.
  const pintarRotulo = () => {
    const t = d.hasAttribute('data-emergencia') ? 'Buscar materia' : 'Buscar materia o tema';
    inp.placeholder = t;
    document.querySelector('label[for="cBuscar"]').textContent = t;
  };
  pintarRotulo();
  new MutationObserver(pintarRotulo).observe(d, { attributes: true, attributeFilter: ['data-emergencia'] });

  let indice = null;
  let bajando = null;
  const bajar = () => {
    if (indice) return Promise.resolve(indice);
    if (!bajando) {
      bajando = fetch('_/indice-carrera.json', { credentials: 'omit' })
        .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
        .then((datos) => {
          indice = datos.map((m) => ({
            ...m,
            nn: normal(m.n),
            e: m.e.map(([p, pn, id, t, x]) => ({ p, pn, id, t, x, nt: normal(t), nx: normal(x) })),
          }));
          return indice;
        })
        .finally(() => {
          bajando = null;
        });
    }
    return bajando;
  };

  let activo = -1;
  const opciones = () => [...lista.querySelectorAll('[role="option"]')];
  const cerrar = () => {
    lista.hidden = true;
    activo = -1;
    inp.setAttribute('aria-expanded', 'false');
    inp.removeAttribute('aria-activedescendant');
  };
  const abrir = () => {
    lista.hidden = false;
    inp.setAttribute('aria-expanded', 'true');
  };
  const nota = (t) => {
    const p = document.createElement('p');
    p.className = 'res-vacio';
    p.textContent = t;
    lista.replaceChildren(p);
    lista.removeAttribute('aria-busy');
    activo = -1;
    inp.removeAttribute('aria-activedescendant');
    abrir();
    cuenta.textContent = t;
  };
  // The index weighs more than 1 MB the first time. Meanwhile the list shows a subject and three results in grey (.esq
  // in utn.css, in «i» so the list's own span rule leaves it alone). The status says it in words.
  const esq = (ancho) => {
    const i = document.createElement('i');
    i.className = 'esq';
    i.style.setProperty('--ancho', ancho);
    return i;
  };
  const con = (tag, clase, ...hijos) => {
    const x = document.createElement(tag);
    if (clase) x.className = clase;
    x.append(...hijos);
    return x;
  };
  const esperando = (t) => {
    const filas = ['78%', '62%', '70%'].map((w) => con('a', '', con('strong', '', esq(w)), con('small', '', esq('5.5em')), con('span', '', esq('94%'))));
    const grupo = con('div', 'res-grupo', con('p', 'res-materia', esq('10em')), ...filas);
    grupo.setAttribute('aria-hidden', 'true');
    lista.replaceChildren(grupo);
    lista.setAttribute('aria-busy', 'true');
    activo = -1;
    inp.removeAttribute('aria-activedescendant');
    abrir();
    cuenta.textContent = t;
  };
  const trozo = (e, palabras) => {
    const i = palabras.map((w) => e.nx.indexOf(w)).filter((n) => n >= 0).sort((a, b) => a - b)[0];
    if (i === undefined) return e.x.slice(0, 100);
    const desde = Math.max(0, i - 40);
    return `${desde ? '…' : ''}${e.x.slice(desde, i + 80)}${i + 80 < e.x.length ? '…' : ''}`;
  };
  const buscar = (q) => {
    const palabras = normal(q).split(/\s+/).filter(Boolean);
    const grupos = [];
    for (const m of indice) {
      const hallados = [];
      for (const e of m.e) {
        let puntos = 0;
        const todas = palabras.every((w) => {
          const enTitulo = e.nt.includes(w);
          const enTexto = e.nx.includes(w);
          const enMateria = m.nn.includes(w);
          puntos += (enTitulo ? 3 : 0) + (enTexto ? 1 : 0) + (enMateria ? 1 : 0);
          return enTitulo || enTexto || enMateria;
        });
        if (todas) hallados.push({ e, puntos });
      }
      if (hallados.length) {
        hallados.sort((a, b) => b.puntos - a.puntos);
        grupos.push({ m, total: hallados.length, mejor: hallados[0].puntos, hallados: hallados.slice(0, POR_MATERIA) });
      }
    }
    return grupos.sort((a, b) => b.mejor - a.mejor || b.total - a.total);
  };
  const pintar = (q) => {
    const grupos = buscar(q);
    if (!grupos.length) {
      nota('No aparece en ninguna materia. Probá con otra palabra.');
      return;
    }
    const palabras = normal(q).split(/\s+/).filter(Boolean);
    const frag = document.createDocumentFragment();
    let n = 0;
    let vistas = 0;
    for (const g of grupos) {
      if (n >= TOPE) break;
      vistas += 1;
      const grupo = document.createElement('div');
      grupo.setAttribute('role', 'group');
      grupo.className = 'res-grupo';
      const tit = document.createElement('p');
      tit.className = 'res-materia';
      tit.id = `cResG${vistas}`;
      tit.textContent = g.m.n;
      grupo.setAttribute('aria-labelledby', tit.id);
      grupo.append(tit);
      for (const { e } of g.hallados) {
        if (n >= TOPE) break;
        const a = document.createElement('a');
        a.href = `${g.m.s}/${e.p}#${e.id}`;
        a.id = `cRes${n}`;
        a.setAttribute('role', 'option');
        a.setAttribute('aria-selected', 'false');
        a.tabIndex = -1;
        const b = document.createElement('strong');
        b.textContent = e.t;
        const pn = document.createElement('small');
        pn.textContent = e.pn;
        const sp = document.createElement('span');
        sp.textContent = trozo(e, palabras);
        a.append(b, pn, sp);
        grupo.append(a);
        n += 1;
      }
      frag.append(grupo);
    }
    lista.replaceChildren(frag);
    lista.removeAttribute('aria-busy');
    activo = -1;
    inp.removeAttribute('aria-activedescendant');
    abrir();
    const enTotal = grupos.reduce((s, g) => s + g.total, 0);
    const materias = grupos.length === 1 ? '1 materia' : `${grupos.length} materias`;
    cuenta.textContent = `${enTotal === 1 ? '1 resultado' : `${enTotal} resultados`} en ${materias}.`;
  };

  let reloj = 0;
  let ronda = 0;
  inp.addEventListener('input', () => {
    clearTimeout(reloj);
    ronda += 1;
    const esta = ronda;
    const q = inp.value.trim();
    if (q.length < 2 || d.hasAttribute('data-emergencia')) {
      cerrar();
      cuenta.textContent = '';
      // A skeleton never stays behind for the next time the box gets the focus.
      if (lista.hasAttribute('aria-busy')) {
        lista.replaceChildren();
        lista.removeAttribute('aria-busy');
      }
      return;
    }
    reloj = setTimeout(async () => {
      if (!indice) esperando('Bajando el índice de búsqueda.');
      try {
        await bajar();
      } catch {
        if (esta === ronda) nota('No se pudo bajar el índice de búsqueda. Probá de nuevo.');
        return;
      }
      if (esta === ronda) pintar(q);
    }, ESPERA);
  });
  inp.addEventListener('keydown', (e) => {
    const ops = opciones();
    if (e.key === 'Escape') {
      if (!lista.hidden) {
        e.preventDefault();
        cerrar();
      }
    } else if (ops.length && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
      e.preventDefault();
      if (lista.hidden) abrir();
      ops[activo]?.classList.remove('activo');
      ops[activo]?.setAttribute('aria-selected', 'false');
      activo = (activo + (e.key === 'ArrowDown' ? 1 : -1) + ops.length) % ops.length;
      if (e.key === 'ArrowUp' && activo < 0) activo = ops.length - 1;
      ops[activo].classList.add('activo');
      ops[activo].setAttribute('aria-selected', 'true');
      ops[activo].scrollIntoView({ block: 'nearest' });
      inp.setAttribute('aria-activedescendant', ops[activo].id);
    } else if (e.key === 'Enter' && ops[activo] && !lista.hidden) {
      e.preventDefault();
      ops[activo].click();
    }
  });
  inp.addEventListener('blur', () => {
    // A click on a result lands after the blur.
    setTimeout(() => {
      if (document.activeElement !== inp) cerrar();
    }, 150);
  });
  inp.addEventListener('focus', () => {
    if (lista.children.length && inp.value.trim().length >= 2 && !d.hasAttribute('data-emergencia')) abrir();
  });
})();
