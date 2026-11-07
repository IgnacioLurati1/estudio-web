// Study page behaviour: filter, search, quiz, mock exam, flashcards. Progress stays in this browser.
(() => {
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const materia = document.body.dataset.materia;
  const guardar = (k, v) => {
    try {
      localStorage.setItem(`utn:${materia}:${k}`, JSON.stringify(v));
    } catch {
      /* No storage: progress just is not remembered. */
    }
  };
  const leer = (k, d) => {
    try {
      const v = localStorage.getItem(`utn:${materia}:${k}`);
      return v === null ? d : JSON.parse(v);
    } catch {
      return d;
    }
  };
  const mezclar = (a) => {
    const c = [...a];
    for (let i = c.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [c[i], c[j]] = [c[j], c[i]];
    }
    return c;
  };

  // Night mode. The button says where it takes you, so it is not a pressed or unpressed toggle: «Modo día» pressed
  // would read as day mode being on.
  const bTema = $('#tema');
  const pintarTema = () => {
    const noche = document.documentElement.dataset.tema === 'noche';
    bTema.textContent = noche ? 'Modo día' : 'Modo noche';
  };
  bTema.addEventListener('click', () => {
    const noche = document.documentElement.dataset.tema === 'noche';
    if (noche) delete document.documentElement.dataset.tema;
    else document.documentElement.dataset.tema = 'noche';
    try {
      localStorage.setItem('utn:tema', noche ? 'dia' : 'noche');
    } catch {
      /* No storage: the choice lasts until the page closes. */
    }
    pintarTema();
  });
  pintarTema();

  // Exercise index: filters, and which ones are done.
  const filas = $$('.ej-fila');
  let soloNuevo = false;
  if (filas.length) {
    let tema = '';
    let conSol = false;
    const cuenta = $('#ejCuenta');
    const aplicar = () => {
      let n = 0;
      filas.forEach((f) => {
        const ok = (!tema || f.dataset.temas.split(' ').includes(tema)) && (!conSol || f.dataset.sol === '1') && (!soloNuevo || f.dataset.viejo !== '1');
        f.hidden = !ok;
        if (ok) n++;
      });
      $$('.ej-grupo').forEach((g) => {
        g.hidden = !$$('.ej-fila', g).some((f) => !f.hidden);
      });
      cuenta.textContent = n === 1 ? '1 ejercicio' : `${n} ejercicios`;
    };
    $$('.b-filtro[data-tema]').forEach((b) =>
      b.addEventListener('click', () => {
        tema = b.dataset.tema;
        $$('.b-filtro[data-tema]').forEach((o) => o.setAttribute('aria-pressed', String(o === b)));
        aplicar();
      }),
    );
    const bNuevo = $('#ejNuevo');
    if (bNuevo) {
      bNuevo.addEventListener('click', () => {
        soloNuevo = !soloNuevo;
        bNuevo.setAttribute('aria-pressed', String(soloNuevo));
        aplicar();
      });
    }
    $('#ejSol').addEventListener('click', (e) => {
      conSol = !conSol;
      e.currentTarget.setAttribute('aria-pressed', String(conSol));
      aplicar();
    });
    filas.forEach((f) => {
      if (leer(`hecho:${f.dataset.slug}`, false)) {
        f.classList.add('hecho');
        const v = document.createElement('span');
        v.className = 'vh';
        v.textContent = 'Hecho. ';
        $('.ej-nom', f).prepend(v);
      }
    });
    aplicar();
  }

  // One exercise: mark it as done and copy its SQL.
  const bHecho = $('#ejHecho');
  if (bHecho) {
    const k = `hecho:${bHecho.dataset.slug}`;
    const pintar = () => {
      const on = leer(k, false);
      bHecho.setAttribute('aria-pressed', String(on));
      bHecho.textContent = on ? 'Hecho' : 'Marcar como hecho';
    };
    bHecho.addEventListener('click', () => {
      guardar(k, !leer(k, false));
      pintar();
    });
    pintar();
  }
  $$('.sol-bloque pre.codigo').forEach((pre) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'b-copiar';
    b.textContent = 'Copiar';
    b.addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText($('code', pre).textContent);
        b.textContent = 'Copiado';
      } catch {
        b.textContent = 'No se pudo copiar';
      }
      setTimeout(() => {
        b.textContent = 'Copiar';
      }, 1800);
    });
    pre.parentElement.append(b);
  });

  // "Only what gets asked": hides everything that is not marked as taken in exams.
  const bSolo = $('#soloTomado');
  const hoja = $('.hoja');
  const tieneTomado = !!$('.tomado', hoja) && !document.documentElement.hasAttribute('data-em-solo');
  const CON_TOMA = '.tomado:not(.no-toma), .pregunta:not(.no-toma), .ejercicio:not(.no-toma), .marca-toma';
  const marcarVacios = () => {
    $$('.sec:not(.quiz)', hoja).forEach((sec) => {
      const hay = !!$(CON_TOMA, sec);
      sec.classList.toggle('sin-tomado', !hay);
      $$(':scope > h3', sec).forEach((h) => {
        let n = h.nextElementSibling;
        let con = false;
        while (n && !/^H[23]$/.test(n.tagName)) {
          if (n.matches(CON_TOMA)) con = true;
          n = n.nextElementSibling;
        }
        h.classList.toggle('sin-tomado', !con);
      });
    });
  };
  const aplicarSolo = (on) => {
    document.body.classList.toggle('solo', on);
    bSolo.setAttribute('aria-pressed', String(on));
    bSolo.textContent = on ? 'Ver todo' : 'Solo lo que se toma';
  };
  if (tieneTomado) {
    marcarVacios();
    document.addEventListener('utn:recalcular', marcarVacios);
    aplicarSolo(leer('solo', false));
    bSolo.addEventListener('click', () => {
      const on = !document.body.classList.contains('solo');
      aplicarSolo(on);
      guardar('solo', on);
    });
  } else bSolo.hidden = true;

  $('#imprimir')?.addEventListener('click', () => window.print());

  // Search
  const inp = $('#buscar');
  const res = $('#resultados');
  const normal = (s) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  let idx = -1;
  const cerrar = () => {
    res.hidden = true;
    idx = -1;
    inp.setAttribute('aria-expanded', 'false');
    inp.removeAttribute('aria-activedescendant');
  };
  const trozo = (x, t) => {
    const i = normal(x).indexOf(t);
    if (i < 0) return x.slice(0, 90);
    const d = Math.max(0, i - 40);
    return (d ? '…' : '') + x.slice(d, i + 70) + '…';
  };
  inp.addEventListener('input', () => {
    const t = normal(inp.value.trim());
    res.textContent = '';
    if (t.length < 2 || !window.UTN_BUSCAR) return cerrar();
    const puntos = window.UTN_BUSCAR.map((s) => ({ s, p: (normal(s.t).includes(t) ? 3 : 0) + (normal(s.x).includes(t) ? 1 : 0) }))
      .filter((r) => r.p)
      .sort((a, b) => b.p - a.p)
      .slice(0, 8);
    res.hidden = false;
    idx = -1;
    inp.setAttribute('aria-expanded', 'true');
    inp.removeAttribute('aria-activedescendant');
    $('#resCuenta').textContent = puntos.length ? `${puntos.length} resultados` : 'Sin resultados';
    if (!puntos.length) {
      const li = document.createElement('li');
      li.className = 'res-vacio';
      li.textContent = 'No aparece. Probá con otra palabra.';
      res.append(li);
      return undefined;
    }
    for (const { s } of puntos) {
      const li = document.createElement('li');
      const a = document.createElement('a');
      a.href = `${s.p}#${s.id}`;
      a.id = `res-${res.children.length}`;
      a.setAttribute('role', 'option');
      const b = document.createElement('strong');
      b.textContent = s.t;
      const pn = document.createElement('small');
      pn.textContent = s.pn;
      const sp = document.createElement('span');
      sp.textContent = trozo(s.x, t);
      a.append(b, pn, sp);
      li.append(a);
      res.append(li);
    }
    return undefined;
  });
  inp.addEventListener('keydown', (e) => {
    const links = $$('a', res);
    if (e.key === 'Escape') {
      cerrar();
      inp.value = '';
    } else if (links.length && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
      e.preventDefault();
      idx = (idx + (e.key === 'ArrowDown' ? 1 : -1) + links.length) % links.length;
      links.forEach((l, i) => l.classList.toggle('activo', i === idx));
      inp.setAttribute('aria-activedescendant', links[idx].id);
    } else if (e.key === 'Enter' && links.length) {
      e.preventDefault();
      links[Math.max(idx, 0)].click();
      cerrar();
    }
  });
  document.addEventListener('click', (e) => {
    if (!e.target.closest('.b-buscar')) cerrar();
  });
  res.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      cerrar();
      inp.focus();
    }
  });

  // Wide tables, code and drawings scroll on their own, so they must take keyboard focus.
  const scrolls = () =>
    $$('.tabla, pre.codigo, figure, .katex-display').forEach((el) => {
      // Hidden blocks measure zero: a drawing behind the protocol keeps the focus it was built with.
      if (!el.offsetParent) return;
      if (el.scrollWidth > el.clientWidth + 1) el.tabIndex = 0;
      else el.removeAttribute('tabindex');
    });
  scrolls();
  addEventListener('resize', scrolls);

  // A button or a link takes its name from its text, and the browser leaves the formulas out of it: a quiz option that
  // is only a formula would be read as an empty button. Each formula in one of them gets the words it says.
  const MAYOR = { '∑': 'suma', '∫': 'integral', '∏': 'productoria', '∮': 'integral cerrada' };
  const decir = (n) => {
    const h = [...n.children];
    const d = (i) => (h[i] ? decir(h[i]) : '');
    switch (n.localName) {
      case 'annotation':
      case 'annotation-xml':
        return '';
      case 'semantics':
        return d(0);
      case 'mi':
      case 'mn':
      case 'mo':
      case 'mtext':
        return ` ${n.textContent.replace(/[\u2061-\u2064]/g, ' ')} `;
      case 'mspace':
        return ' ';
      case 'mfrac':
        return ` ${d(0)} sobre ${d(1)} `;
      case 'msqrt':
        return ` raíz de ${h.map(decir).join('')} `;
      case 'mroot':
        return ` raíz ${d(1)} de ${d(0)} `;
      case 'msup': {
        const e = d(1).trim();
        if (e === '2') return ` ${d(0)} al cuadrado `;
        if (e === '3') return ` ${d(0)} al cubo `;
        if (/^′+$/.test(e)) return ` ${d(0)} ${e.length > 1 ? 'segunda' : 'prima'} `;
        return ` ${d(0)} a la ${e} `;
      }
      case 'msub':
      case 'munder': {
        const b = d(0).trim();
        return /^(lim|máx|mín|max|min|sup|inf)/.test(b) ? ` ${b} cuando ${d(1)} ` : ` ${MAYOR[b] || b} ${n.localName === 'msub' ? 'sub' : 'de'} ${d(1)} `;
      }
      case 'msubsup':
      case 'munderover': {
        const b = d(0).trim();
        return MAYOR[b] ? ` ${MAYOR[b]} de ${d(1)} a ${d(2)} ` : ` ${b} sub ${d(1)} a la ${d(2)} `;
      }
      case 'mtr':
        return h.map(decir).join(', ');
      case 'mtable':
        return h.map(decir).join('; ');
      default:
        return h.map(decir).join('');
    }
  };
  // «sen» written as three letters is read as one word, like the other function names.
  const FUNCIONES = new Set(['sen', 'cos', 'tg', 'tan', 'cotg', 'sec', 'cosec', 'ln', 'log', 'arcsen', 'arccos', 'arctg', 'senh', 'cosh', 'tgh', 'exp', 'det', 'rg', 'dim', 'mod', 'mcd', 'mcm']);
  const juntar = (t) => t.replace(/(?<![\p{L}])(?:\p{L} ){1,5}\p{L}(?![\p{L}])/gu, (m) => (FUNCIONES.has(m.replace(/ /g, '')) ? m.replace(/ /g, '') : m));
  // Header cells too: a column whose header is a formula would have no name.
  $$('button math, a math, summary math, label math, th math').forEach((m) => {
    if (!m.hasAttribute('aria-label')) m.setAttribute('aria-label', juntar(decir(m).replace(/\s+/g, ' ').trim()));
  });

  // Current section in the side index
  const links = $$('.toc a');
  if (links.length && 'IntersectionObserver' in window) {
    const porId = new Map(links.map((a) => [a.getAttribute('href').slice(1), a]));
    const obs = new IntersectionObserver(
      (es) => {
        for (const e of es) {
          if (e.isIntersecting) {
            links.forEach((l) => l.removeAttribute('aria-current'));
            porId.get(e.target.id)?.setAttribute('aria-current', 'true');
          }
        }
      },
      { rootMargin: '-15% 0px -75% 0px' },
    );
    porId.forEach((_, id) => {
      const el = document.getElementById(id);
      if (el) obs.observe(el);
    });
  }

  // Writes the result as real text so screen readers get it too.
  const veredicto = (q, ok) => {
    const ex = $('.q-expl', q);
    if (!ex) return;
    $('.q-veredicto', ex)?.remove();
    const p = document.createElement('p');
    p.className = `q-veredicto ${ok ? 'bien' : 'mal'}`;
    p.textContent = ok ? 'Correcta.' : 'Incorrecta.';
    ex.prepend(p);
  };

  // Answer one multiple choice question. Shows the explanation unless told not to.
  const responder = (q, boton, mostrar) => {
    if (q.dataset.hecha || boton.getAttribute('aria-disabled') === 'true') return;
    q.dataset.hecha = boton.dataset.ok === '1' ? 'bien' : 'mal';
    if (mostrar) {
      $$('.op', q).forEach((o) => {
        o.setAttribute('aria-disabled', 'true');
        if (o.dataset.ok === '1') o.classList.add('correcta');
      });
      if (boton.dataset.ok !== '1') boton.classList.add('incorrecta');
      veredicto(q, boton.dataset.ok === '1');
      const ex = $('.q-expl', q);
      if (ex) {
        ex.hidden = false;
        ex.focus();
      }
    } else {
      $$('.op', q).forEach((o) => {
        o.classList.remove('elegida');
        o.setAttribute('aria-pressed', 'false');
      });
      boton.classList.add('elegida');
      boton.setAttribute('aria-pressed', 'true');
    }
  };

  // What was answered wrong, per subject, until it is answered right. Only in this browser.
  const erradas = () => new Set(leer('erradas', []));
  const anotar = (q) => {
    const id = q.dataset.q;
    if (!id || !q.dataset.hecha) return;
    const lista = erradas();
    if (q.dataset.hecha === 'mal') lista.add(id);
    else lista.delete(id);
    guardar('erradas', [...lista]);
  };

  // Page quizzes
  $$('.quiz').forEach((box) => {
    const id = box.dataset.quiz;
    const qs = $$('.q', box);
    const salida = $('.quiz-res', box);
    const bRepaso = $('.quiz-repasar', box);
    let repaso = false;
    const enJuego = () => (repaso ? qs.filter((q) => !q.hidden) : qs);
    const pintarRepaso = () => {
      if (!bRepaso) return;
      const lista = erradas();
      const n = qs.filter((q) => lista.has(q.dataset.q)).length;
      bRepaso.hidden = !repaso && !n;
      bRepaso.textContent = repaso ? 'Ver todas las preguntas' : `Repasar lo que erraste (${n})`;
    };
    const total = () => {
      const activas = enJuego();
      const hechas = activas.filter((q) => q.dataset.hecha);
      const bien = activas.filter((q) => q.dataset.hecha === 'bien').length;
      if (repaso) {
        const quedan = qs.filter((q) => erradas().has(q.dataset.q)).length;
        if (!quedan) salida.textContent = 'Listo. Ya no te queda ninguna errada en este quiz.';
        else if (hechas.length < activas.length) salida.textContent = `Te quedan ${quedan} por responder bien.`;
        else salida.textContent = `Te quedan ${quedan} por responder bien. Con «Empezar de nuevo» salen otra vez.`;
        pintarRepaso();
        return;
      }
      if (!hechas.length) salida.textContent = id === 'abiertas' ? '' : 'Todavía no respondiste ninguna.';
      else salida.textContent = `Llevás ${bien} de ${hechas.length} bien. Faltan ${qs.length - hechas.length}.`;
      if (hechas.length === qs.length) {
        const mejor = Math.max(leer(`quiz:${id}`, { bien: 0 }).bien, bien);
        guardar(`quiz:${id}`, { bien: mejor, de: qs.length });
        salida.textContent = `Terminaste: ${bien} de ${qs.length}. Tu mejor marca es ${mejor}.`;
      }
      pintarRepaso();
    };
    const limpiar = (q) => {
      delete q.dataset.hecha;
      $$('.op', q).forEach((o) => {
        o.removeAttribute('aria-disabled');
        o.classList.remove('correcta', 'incorrecta');
      });
      $$('.b-auto', q).forEach((b) => {
        b.classList.remove('elegida');
        b.setAttribute('aria-pressed', 'false');
      });
      const ex = $('.q-expl', q);
      if (ex) ex.hidden = true;
      const d = $('details', q);
      if (d) d.open = false;
    };
    // Reviewing starts each wrong question from zero. Whatever goes right leaves the list, and stays on screen until the next round.
    const filtrar = () => {
      const lista = erradas();
      qs.forEach((q) => {
        limpiar(q);
        q.hidden = repaso && !lista.has(q.dataset.q);
      });
    };
    bRepaso?.addEventListener('click', () => {
      repaso = !repaso;
      filtrar();
      total();
      bRepaso.focus();
    });
    box.addEventListener('click', (e) => {
      const op = e.target.closest('.op');
      const auto = e.target.closest('.b-auto');
      if (op) {
        const q = op.closest('.q');
        const yaEstaba = Boolean(q.dataset.hecha);
        responder(q, op, true);
        if (!yaEstaba) anotar(q);
        total();
      } else if (auto) {
        const q = auto.closest('.q');
        q.dataset.hecha = auto.dataset.ok === '1' ? 'bien' : 'mal';
        $$('.b-auto', q).forEach((b) => {
          b.classList.toggle('elegida', b === auto);
          b.setAttribute('aria-pressed', String(b === auto));
        });
        anotar(q);
        total();
      } else if (e.target.closest('.quiz-reset')) {
        filtrar();
        total();
      }
    });
    total();
  });

  // Progress on the subject home
  $$('[data-progreso]').forEach((el) => {
    const r = leer(`quiz:${el.dataset.progreso}`, null);
    el.textContent = r ? `Tu mejor marca en el quiz: ${r.bien} de ${r.de}` : 'Quiz sin hacer';
  });

  // Mock exam
  const banco = $('#simBanco');
  if (banco) {
    const lista = $('.qs', banco);
    const todas = $$('.q', banco);
    const bFin = $('#simFin');
    const bIr = $('#simIr');
    const reloj = $('#simReloj');
    const salida = $('#simRes');
    let activas = [];
    let t = null;
    const parar = () => {
      if (t) clearInterval(t);
      t = null;
    };
    const entregar = () => {
      parar();
      reloj.hidden = true;
      bFin.hidden = true;
      bIr.textContent = 'Otro simulacro';
      let bien = 0;
      const flojos = new Map();
      for (const q of activas) {
        const elegida = $('.op.elegida', q);
        const ok = q.dataset.hecha === 'bien';
        anotar(q);
        if (ok) bien++;
        else {
          const k = q.dataset.tema;
          flojos.set(k, { n: (flojos.get(k)?.n || 0) + 1, enlace: q.dataset.enlace });
        }
        $$('.op', q).forEach((o) => {
          o.setAttribute('aria-disabled', 'true');
          o.removeAttribute('aria-pressed');
          if (o.dataset.ok === '1') o.classList.add('correcta');
        });
        if (elegida && !ok) elegida.classList.add('incorrecta');
        veredicto(q, ok);
        const ex = $('.q-expl', q);
        if (ex) ex.hidden = false;
      }
      salida.textContent = '';
      const h = document.createElement('p');
      h.className = 'sim-nota';
      h.textContent = `Sacaste ${bien} de ${activas.length}.`;
      salida.append(h);
      if (flojos.size) {
        const p = document.createElement('p');
        p.textContent = 'Para repasar:';
        const ul = document.createElement('ul');
        [...flojos.entries()]
          .sort((a, b) => b[1].n - a[1].n)
          .forEach(([tema, v]) => {
            const li = document.createElement('li');
            const a = document.createElement(v.enlace ? 'a' : 'span');
            if (v.enlace) a.href = v.enlace;
            a.textContent = tema;
            li.append(a, ` (${v.n === 1 ? '1 error' : `${v.n} errores`})`);
            ul.append(li);
          });
        salida.append(p, ul);
      } else {
        const p = document.createElement('p');
        p.textContent = 'Ningún error. Pasá a las preguntas para escribir. En el teórico cuenta cómo lo explicás.';
        salida.append(p);
      }
      const hist = leer('sim', []);
      hist.push({ bien, de: activas.length, f: Date.now() });
      guardar('sim', hist.slice(-20));
      h.tabIndex = -1;
      h.focus();
    };
    bIr.addEventListener('click', () => {
      parar();
      salida.textContent = '';
      const n = +$('#simN').value;
      const min = +$('#simT').value;
      activas = mezclar(todas).slice(0, n);
      todas.forEach((q) => {
        q.hidden = true;
        delete q.dataset.hecha;
        $$('.op', q).forEach((o) => {
          o.removeAttribute('aria-disabled');
          o.setAttribute('aria-pressed', 'false');
          o.classList.remove('correcta', 'incorrecta', 'elegida');
        });
        const ex = $('.q-expl', q);
        if (ex) ex.hidden = true;
      });
      activas.forEach((q, i) => {
        q.hidden = false;
        $('.q-n', q).textContent = i + 1;
        lista.append(q);
      });
      banco.hidden = false;
      bFin.hidden = false;
      bIr.textContent = 'Empezar otro';
      if (min) {
        let resto = min * 60;
        const pintar = () => {
          reloj.textContent = `${Math.floor(resto / 60)}:${String(resto % 60).padStart(2, '0')}`;
        };
        reloj.hidden = false;
        pintar();
        t = setInterval(() => {
          resto--;
          pintar();
          if (resto <= 0) entregar();
        }, 1000);
      } else reloj.hidden = true;
      activas[0].scrollIntoView({ block: 'nearest' });
    });
    banco.addEventListener('click', (e) => {
      const op = e.target.closest('.op');
      if (!op || op.getAttribute('aria-disabled') === 'true') return;
      const q = op.closest('.q');
      delete q.dataset.hecha;
      responder(q, op, false);
    });
    bFin.addEventListener('click', entregar);
  }

  // Flashcards: unknown cards go back into the pile.
  const lista = $('#tarjetas');
  if (lista) {
    const cartas = $$('.tarjeta', lista);
    const bV = $('#tVuelta');
    const bS = $('#tSi');
    const bN = $('#tNo');
    const est = $('#tEstado');
    let pila = [];
    let actual = null;
    let sabidas = 0;
    const mostrar = () => {
      cartas.forEach((c) => {
        c.hidden = true;
        $('.t-dorso', c).hidden = true;
      });
      bS.hidden = true;
      bN.hidden = true;
      if (!pila.length) {
        actual = null;
        bV.hidden = true;
        est.textContent = `Repasaste las ${cartas.length} tarjetas.`;
        $('#tOtra').focus();
        return;
      }
      actual = pila[0];
      actual.hidden = false;
      bV.hidden = false;
      est.textContent = `Sabidas ${sabidas} de ${cartas.length}. Quedan ${pila.length} en la pila.`;
    };
    const iniciar = () => {
      pila = mezclar(cartas);
      sabidas = 0;
      mostrar();
    };
    bV.addEventListener('click', () => {
      if (!actual) return;
      const dorso = $('.t-dorso', actual);
      dorso.hidden = false;
      bV.hidden = true;
      bS.hidden = false;
      bN.hidden = false;
      dorso.focus();
    });
    bS.addEventListener('click', () => {
      pila.shift();
      sabidas++;
      mostrar();
      if (actual) bV.focus();
    });
    bN.addEventListener('click', () => {
      pila.push(pila.shift());
      mostrar();
      bV.focus();
    });
    $('#tOtra').addEventListener('click', iniciar);
    iniciar();
  }
})();
