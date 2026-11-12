// Exam mode: take a real old exam with a clock, then correct yourself. construir.mjs puts the pieces in each exam page
// (the button, the questions with options of that exam, the topics to mark with their theory). The attempt lives in
// utn:<subject>:examen, so a reload never loses it; one attempt per subject. The pure part (time, score, what to
// review) also runs from Node, for the tests and for construir.mjs, like sysacad.js.
(function (raiz) {
  'use strict';
  // Minutes offered; 0 is «sin reloj».
  const OPCIONES = [60, 90, 120, 180, 0];
  // A reload keeps the clock running. A page closed for longer than this comes back paused.
  const RECARGA = 90 * 1000;
  const NOTAS = ['bien', 'medio', 'mal'];
  const FASES = ['rindiendo', 'corrigiendo', 'listo'];

  const normal = (t) =>
    String(t ?? '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9]+/g, ' ')
      .trim();

  /** The time chosen first. A final or a globalizador takes 3 hours, a parcial 2, a theory sheet or a short quiz 1.
   * The exam's own title wins over its instance: a «3° parcial» filed under «3° parcial y final» is a parcial. */
  function minutosSugeridos(titulo, instancia) {
    const t = normal(titulo);
    const g = normal(instancia);
    if (/formativa|autotest|parcialito|aula virtual|moodle|cuestionario/.test(`${t} ${g}`)) return 60;
    if (/teori|teoric/.test(t) && !/practic/.test(t)) return 60;
    if (/\b(final|global)/.test(t)) return 180;
    if (/parcial|recuperatorio|regulariz|aprobacion directa/.test(t)) return 120;
    if (/\b(final|global)/.test(g)) return 180;
    return 120;
  }
  const etiqueta = (min) => ({ 60: '1 h', 90: '1:30', 120: '2 h', 180: '3 h' })[min] || 'Sin reloj';
  const duracion = (min) => ({ 60: '1 hora', 90: '1 hora y media', 120: '2 horas', 180: '3 horas' })[min] || '';

  // ----- The clock. It runs only while the exam is open and not paused: `acumulado` is what ran before `desde`.
  const transcurrido = (e, ahora) => Math.max(0, (e.acumulado || 0) + (e.desde ? Math.max(0, ahora - e.desde) : 0));
  const restante = (e, ahora) => (e.min ? Math.max(0, e.min * 60000 - transcurrido(e, ahora)) : null);
  const vencido = (e, ahora) => Boolean(e.min) && restante(e, ahora) === 0;

  const empezar = (datos, min, ahora) => ({
    v: 1,
    slug: datos.slug,
    titulo: datos.titulo || '',
    min: OPCIONES.includes(min) ? min : 0,
    fase: 'rindiendo',
    acumulado: 0,
    desde: ahora,
    visto: ahora,
    vencio: false,
    respuestas: {},
    notas: {},
  });
  const pausar = (e, ahora) => (e.fase === 'rindiendo' && e.desde ? { ...e, acumulado: transcurrido(e, ahora), desde: null, visto: ahora } : e);
  const seguir = (e, ahora) => (e.fase === 'rindiendo' && !e.desde ? { ...e, desde: ahora, visto: ahora } : e);
  const latido = (e, ahora) => (e.fase === 'rindiendo' && e.desde ? { ...e, visto: ahora } : e);
  function entregar(e, ahora) {
    if (e.fase !== 'rindiendo') return e;
    const usado = e.min ? Math.min(transcurrido(e, ahora), e.min * 60000) : transcurrido(e, ahora);
    return { ...e, fase: 'corrigiendo', acumulado: usado, desde: null, visto: ahora, vencio: vencido(e, ahora) };
  }
  // On load. A reload keeps the clock running; if nothing showed the exam for longer, that time does not count.
  function alVolver(e, ahora) {
    if (!e || e.fase !== 'rindiendo' || !e.desde) return e;
    const visto = Math.min(Math.max(Number(e.visto) || e.desde, e.desde), ahora);
    if (ahora - visto <= RECARGA) return e;
    return { ...e, acumulado: (e.acumulado || 0) + (visto - e.desde), desde: null, visto: ahora };
  }

  /** What was stored, if it looks right, or null. Unknown values go away one by one. */
  function leerEstado(x) {
    if (!x || typeof x !== 'object' || x.v !== 1 || typeof x.slug !== 'string' || !x.slug || !FASES.includes(x.fase)) return null;
    const num = (n) => (Number.isFinite(n) && n >= 0 ? n : 0);
    const objeto = (o) => (o && typeof o === 'object' && !Array.isArray(o) ? o : {});
    const notas = {};
    for (const [k, v] of Object.entries(objeto(x.notas))) if (NOTAS.includes(v)) notas[k] = v;
    const respuestas = {};
    for (const [k, v] of Object.entries(objeto(x.respuestas))) if (Number.isInteger(v) && v >= 0 && v < 20) respuestas[k] = v;
    return {
      v: 1,
      slug: x.slug.slice(0, 120),
      titulo: typeof x.titulo === 'string' ? x.titulo.slice(0, 200) : '',
      min: OPCIONES.includes(x.min) ? x.min : 0,
      fase: x.fase,
      acumulado: num(x.acumulado),
      desde: x.fase === 'rindiendo' && Number.isFinite(x.desde) && x.desde > 0 ? x.desde : null,
      visto: num(x.visto),
      vencio: x.vencio === true,
      respuestas,
      notas,
    };
  }

  // ----- Texts of the clock.
  const dos = (n) => String(n).padStart(2, '0');
  /** «1 h 58 min», «42 min»: whole minutes rounded up, so it never says 0 while there is time left. Seconds only in the
   * last 5 minutes («4:05»). */
  function textoQueda(ms) {
    if (ms <= 5 * 60000) {
      const s = Math.ceil(ms / 1000);
      return `${Math.floor(s / 60)}:${dos(s % 60)}`;
    }
    const min = Math.ceil(ms / 60000);
    const h = Math.floor(min / 60);
    const m = min % 60;
    if (!h) return `${m} min`;
    return m ? `${h} h ${m} min` : `${h} h`;
  }
  /** How long it took: «1 h 24 min», «42 min», «menos de un minuto». */
  function textoDuracion(ms) {
    const min = Math.floor(ms / 60000);
    if (!min) return 'menos de un minuto';
    const h = Math.floor(min / 60);
    const m = min % 60;
    if (!h) return `${m} min`;
    return m ? `${h} h ${m} min` : `${h} h`;
  }
  const textoHora = (fecha) => `${fecha.getHours()}:${dos(fecha.getMinutes())}`;

  // ----- The result.
  /** temas: names. notas: { name: 'bien' | 'medio' | 'mal' }. preguntas: [{ ok }], the ones with options, which grade
   * themselves (one left blank counts as wrong). «Más o menos» is worth half. Topics left unmarked do not count. */
  function puntaje(temas, notas, preguntas = []) {
    const c = { bien: 0, medio: 0, mal: 0 };
    for (const t of temas) if (NOTAS.includes(notas?.[t])) c[notas[t]]++;
    const marcados = c.bien + c.medio + c.mal;
    const mcBien = preguntas.filter((p) => p.ok === true).length;
    const total = marcados + preguntas.length;
    const puntos = c.bien + c.medio / 2 + mcBien;
    return { ...c, sinMarcar: temas.length - marcados, mcBien, mcTotal: preguntas.length, puntos, total, proporcion: total ? puntos / total : null };
  }
  function veredicto(p) {
    if (p === null || p === undefined) return null;
    if (p >= 0.8) return 'muy-bien';
    if (p >= 0.6) return 'bien';
    if (p >= 0.4) return 'medio';
    return 'flojo';
  }
  const VEREDICTOS = {
    'muy-bien': ['Te fue muy bien.', 'Probá con otro examen de la misma instancia.'],
    bien: ['Te fue bien.', 'Repasá lo que quedó flojo y probá con otro.'],
    medio: ['Te fue más o menos.', 'Repasá estos temas antes de rendir otro.'],
    flojo: ['Te costó bastante.', 'Arrancá por la teoría de estos temas y volvé a intentarlo.'],
  };
  /** temas: [{ nombre, enlace, donde }]. preguntas: [{ ok, tema, enlace, donde }], with ok null for one left blank.
   * What did not come out first, then the so-so, then the topics of missed questions that are not there yet. Each topic
   * once, with how many questions it got wrong or left blank. A question joins a topic by name or by where its theory
   * is. */
  function queRepasar(temas, notas, preguntas = []) {
    const lista = [];
    const vistos = new Map();
    const buscar = (nombre, enlace) => vistos.get(normal(nombre)) || (enlace && vistos.get(enlace));
    const anotar = (x) => {
      lista.push(x);
      vistos.set(normal(x.nombre), x);
      if (x.enlace && !vistos.has(x.enlace)) vistos.set(x.enlace, x);
    };
    for (const nivel of ['mal', 'medio']) {
      for (const t of temas) {
        if (notas?.[t.nombre] !== nivel || vistos.has(normal(t.nombre))) continue;
        anotar({ nombre: t.nombre, enlace: t.enlace || '', donde: t.donde || '', nivel, errores: 0, blancos: 0 });
      }
    }
    for (const p of preguntas) {
      if (p.ok === true || !p.tema) continue;
      const campo = p.ok === null ? 'blancos' : 'errores';
      const ya = buscar(p.tema, p.enlace);
      if (ya) {
        ya[campo]++;
        continue;
      }
      anotar({ nombre: p.tema, enlace: p.enlace || '', donde: p.donde || '', nivel: 'pregunta', errores: 0, blancos: 0, [campo]: 1 });
    }
    return lista;
  }

  const API = {
    OPCIONES,
    RECARGA,
    minutosSugeridos,
    etiqueta,
    duracion,
    transcurrido,
    restante,
    vencido,
    empezar,
    pausar,
    seguir,
    latido,
    entregar,
    alVolver,
    leerEstado,
    textoQueda,
    textoDuracion,
    textoHora,
    puntaje,
    veredicto,
    VEREDICTOS,
    queRepasar,
  };
  if (typeof module === 'object' && module.exports) {
    module.exports = API;
    return;
  }
  raiz.UTN_EXAMEN = API;
  if (typeof document === 'undefined' || !document.body) return;

  // ====================================================================== In the page.
  const d = document.documentElement;
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const materia = document.body.dataset.materia;
  if (!materia || materia === '_') return;
  const CLAVE = `utn:${materia}:examen`;
  const leer = () => {
    try {
      return leerEstado(JSON.parse(localStorage.getItem(CLAVE)));
    } catch {
      return null;
    }
  };
  const guardar = (e) => {
    try {
      if (e) localStorage.setItem(CLAVE, JSON.stringify(e));
      else localStorage.removeItem(CLAVE);
    } catch {
      /* No storage: the exam lasts while the page is open. */
    }
  };
  const el = (tag, attrs = {}, ...hijos) => {
    const n = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) {
      if (v === false || v === null || v === undefined) continue;
      if (k === 'class') n.className = v;
      else if (k === 'text') n.textContent = v;
      else n.setAttribute(k, v === true ? '' : v);
    }
    n.append(...hijos);
    return n;
  };
  const main = $('#contenido');
  const emergencia = () => d.hasAttribute('data-emergencia');

  // Another page of the subject, or another exam: a line on top says there is one started.
  const banda = (e) =>
    el(
      'div',
      { class: 'ex-banda', role: 'region', 'aria-label': 'Examen empezado' },
      el('p', {}, 'Tenés un examen empezado, ', el('b', { text: e.titulo || 'sin nombre' }), '.'),
      el('a', { class: 'b-sec', href: `ej-${e.slug}.html` }, e.fase === 'rindiendo' ? 'Seguirlo' : 'Terminar de corregirlo'),
    );

  const ir = $('[data-ex-ir]');
  if (!ir) {
    const e = leer();
    if (e && e.fase !== 'listo' && main) main.prepend(banda(e));
    return;
  }

  // ----- One exam's page.
  const datos = { slug: ir.dataset.slug, titulo: ir.dataset.titulo || '', min: Number(ir.dataset.min), otro: ir.dataset.otro || 'ejercicios.html', sol: ir.dataset.sol || 'sin' };
  if (!OPCIONES.includes(datos.min)) datos.min = 120;
  const h1 = $('h1', main);
  const corregir = $('#exCorregir');
  const seccionPreguntas = $('#exPreguntas');
  const seccionCaso = $('#exCaso');
  const preguntas = seccionPreguntas ? $$('.q', seccionPreguntas) : [];
  const filasTema = corregir ? $$('.ex-tema', corregir) : [];
  const temas = filasTema.map((f) => ({ nombre: f.dataset.tema, enlace: f.dataset.enlace || '', donde: f.dataset.donde || '' }));
  const nombrePagina = new Map($$('.lado .nav a[href]').map((a) => [a.getAttribute('href').split('#')[0], a.textContent.trim()]));
  const correcta = (q) => $$('.op', q).findIndex((o) => o.dataset.ok === '1');

  let estado = leer();
  const propio = () => (estado && estado.slug === datos.slug ? estado : null);
  if (propio()) {
    estado = alVolver(estado, Date.now());
    guardar(estado);
  }
  const otro = () => (estado && estado.slug !== datos.slug && estado.fase !== 'listo' ? estado : null);

  // Spoken notices: the start, the last minutes, the end of the time.
  const aviso = el('p', { class: 'vh', role: 'status' });
  const decir = (t) => {
    aviso.textContent = '';
    setTimeout(() => {
      aviso.textContent = t;
    }, 60);
  };

  // The bar at the bottom while the exam runs. It says the time to hand in, as a teacher writes it on the board, and
  // how much is left; it only shows seconds in the last 5 minutes.
  const dFin = el('span', { class: 'ex-d-fin' });
  const dQueda = el('span', { class: 'ex-d-queda' });
  const dLinea = el('span');
  const bPausa = el('button', { type: 'button', class: 'b-sec' }, 'Pausar');
  const bEntregar = el('button', { type: 'button', class: 'b-pri' }, 'Entregar');
  const dock = el(
    'div',
    { class: 'ex-dock', role: 'region', 'aria-label': 'Reloj del examen', hidden: true },
    el('span', { class: 'ex-d-linea', 'aria-hidden': 'true' }, dLinea),
    el('p', { class: 'ex-d-nom', text: datos.titulo }),
    // The comma is only heard: on screen the two parts sit apart.
    el('p', { class: 'ex-d-reloj', role: 'timer' }, dFin, el('span', { class: 'vh', text: ',' }), ' ', dQueda),
    el('div', { class: 'ex-d-botones' }, bPausa, bEntregar),
  );

  // Paused: the statement is covered and the clock stands still.
  const pQueda = el('p', { class: 'ex-p-queda', id: 'exPausaQ' });
  const bSeguir = el('button', { type: 'button', class: 'b-pri' }, 'Seguir');
  const bDejar = el('button', { type: 'button', class: 'b-sec' }, 'Dejar el examen');
  const pausa = el(
    'dialog',
    { class: 'ex-pausa', 'aria-labelledby': 'exPausaT', 'aria-describedby': 'exPausaD exPausaQ' },
    el('p', { class: 'ex-p-t', id: 'exPausaT', text: 'En pausa' }),
    el('p', { id: 'exPausaD', text: 'El reloj está quieto y el enunciado, tapado.' }),
    pQueda,
    el('div', { class: 'ex-p-botones' }, bSeguir, bDejar),
  );

  // Before starting: how long.
  const tiempos = el('fieldset', { class: 'ex-tiempos' }, el('legend', { text: '¿Cuánto tiempo?' }));
  for (const m of OPCIONES) tiempos.append(el('label', { class: 'ex-chip' }, el('input', { type: 'radio', name: 'exMin', value: String(m) }), el('span', { text: etiqueta(m) })));
  const dlg = el(
    'dialog',
    { class: 'dlg ex-dlg', 'aria-labelledby': 'exDlgT' },
    el(
      'form',
      { method: 'dialog' },
      el('h2', { id: 'exDlgT', text: 'Rendir con reloj' }),
      el('p', { text: datos.sol === 'sin' ? 'Ves solo el enunciado. Al entregar te corregís tema por tema, con la teoría de cada uno a mano.' : 'Ves solo el enunciado. Al entregar aparece la resolución y te corregís tema por tema.' }),
      tiempos,
      el('p', { class: 'dlg-nota', text: 'Podés pausarlo. Si cerrás la página, sigue donde quedó.' }),
      el('div', { class: 'dlg-botones' }, el('button', { type: 'submit', class: 'b-pri', value: 'ok' }, 'Empezar'), el('button', { type: 'submit', class: 'b-sec', value: 'no' }, 'Cancelar')),
    ),
  );
  document.body.append(dock, pausa, dlg, aviso);

  // After handing in: what to do now, then the result. Both go under the title.
  const caja = el('div', { class: 'ex-estado', tabindex: '-1', hidden: true });
  const resultado = el('section', { class: 'ex-resultado', 'aria-labelledby': 'exResT', tabindex: '-1', hidden: true });
  const ancla = $('.ej-acciones', main) || h1.nextElementSibling;
  ancla.before(caja, resultado);
  const bandaOtro = otro() ? banda(otro()) : null;
  if (bandaOtro) main.prepend(bandaOtro);

  const abrir = () => {
    if (otro() && !window.confirm('Tenés otro examen empezado. ¿Lo dejás y empezás este?')) return;
    const elegido = propio()?.min ?? datos.min;
    $$('input', tiempos).forEach((i) => {
      i.checked = Number(i.value) === elegido;
    });
    dlg.returnValue = '';
    dlg.showModal();
    // The dialog would focus the first chip; the chosen one is where arrows should start.
    $('input:checked', tiempos)?.focus();
  };
  dlg.addEventListener('close', () => {
    if (dlg.returnValue !== 'ok') return;
    const min = Number($('input:checked', tiempos)?.value ?? datos.min);
    estado = empezar(datos, min, Date.now());
    guardar(estado);
    bandaOtro?.remove();
    marca = undefined;
    pintar();
    h1.tabIndex = -1;
    h1.focus();
    h1.scrollIntoView({ block: 'start' });
    decir(min ? `Empezó el examen. Tenés ${duracion(min)}.` : 'Empezó el examen, sin reloj.');
  });
  ir.addEventListener('click', abrir);

  bPausa.addEventListener('click', () => {
    estado = pausar(estado, Date.now());
    guardar(estado);
    pintar();
  });
  const seguirExamen = () => {
    estado = seguir(estado, Date.now());
    guardar(estado);
    pintar();
    bPausa.focus();
  };
  bSeguir.addEventListener('click', seguirExamen);
  // Escape on the pause goes back to the exam, the same as «Seguir».
  pausa.addEventListener('cancel', (ev) => {
    ev.preventDefault();
    seguirExamen();
  });
  bDejar.addEventListener('click', () => {
    if (!window.confirm('¿Seguro?')) return;
    salir();
  });
  bEntregar.addEventListener('click', () => {
    if (!window.confirm('¿Entregás el examen? Después aparece la resolución.')) return;
    terminar();
  });

  // Handing in: wrong answers go to the same list as the quizzes (utn.js), so «Repasar lo que erraste» picks them up
  // and progreso.js takes them to the account. The exam counts as done, like «Marcar como hecho».
  function terminar() {
    estado = entregar(estado, Date.now());
    guardar(estado);
    try {
      const k = `utn:${materia}:erradas`;
      const lista = new Set(JSON.parse(localStorage.getItem(k)) || []);
      for (const q of preguntas) {
        const r = estado.respuestas[q.dataset.q];
        if (r === undefined) continue;
        if (r === correcta(q)) lista.delete(q.dataset.q);
        else lista.add(q.dataset.q);
      }
      localStorage.setItem(k, JSON.stringify([...lista]));
      localStorage.setItem(`utn:${materia}:hecho:${datos.slug}`, 'true');
      const bHecho = $('#ejHecho');
      if (bHecho) {
        bHecho.setAttribute('aria-pressed', 'true');
        bHecho.textContent = 'Hecho';
      }
    } catch {
      /* No storage: nothing to remember. */
    }
    pintar();
    caja.focus();
    caja.scrollIntoView({ block: 'start' });
  }

  function salir() {
    estado = null;
    guardar(null);
    pintar();
    h1.tabIndex = -1;
    h1.focus();
  }

  // Questions with options: chosen while the exam runs, corrected after it.
  seccionPreguntas?.addEventListener('click', (ev) => {
    const op = ev.target.closest('.op');
    const e = propio();
    if (!op || !e || e.fase !== 'rindiendo') return;
    const q = op.closest('.q');
    estado = { ...e, respuestas: { ...e.respuestas, [q.dataset.q]: $$('.op', q).indexOf(op) } };
    guardar(estado);
    pintarPreguntas();
  });
  function pintarPreguntas() {
    const e = propio();
    const corregida = Boolean(e) && e.fase !== 'rindiendo';
    for (const q of preguntas) {
      const r = e?.respuestas[q.dataset.q];
      $$('.op', q).forEach((o, j) => {
        o.classList.toggle('elegida', !corregida && r === j);
        o.classList.toggle('correcta', corregida && o.dataset.ok === '1');
        o.classList.toggle('incorrecta', corregida && r === j && o.dataset.ok !== '1');
        if (corregida) {
          o.setAttribute('aria-disabled', 'true');
          o.removeAttribute('aria-pressed');
        } else {
          o.removeAttribute('aria-disabled');
          o.setAttribute('aria-pressed', String(r === j));
        }
      });
      const ex = $('.q-expl', q);
      if (!ex) continue;
      ex.hidden = !corregida;
      $('.q-veredicto', ex)?.remove();
      if (corregida) {
        const ok = r === correcta(q);
        ex.prepend(el('p', { class: `q-veredicto ${ok ? 'bien' : 'mal'}`, text: r === undefined ? 'No la respondiste.' : ok ? 'Correcta.' : 'Incorrecta.' }));
      }
    }
  }

  // Each topic of the exam: «Me salió», «Más o menos» or «No me salió».
  corregir?.addEventListener('change', (ev) => {
    const r = ev.target;
    const fila = r.closest?.('.ex-tema');
    const e = propio();
    if (!fila || !e || r.type !== 'radio') return;
    estado = { ...e, notas: { ...e.notas, [fila.dataset.tema]: r.value } };
    guardar(estado);
    pintarFalta();
    if (estado.fase === 'listo') pintarResultado(false);
  });
  const bVer = $('#exVer');
  const falta = $('#exFalta');
  bVer?.addEventListener('click', () => {
    estado = { ...propio(), fase: 'listo' };
    guardar(estado);
    pintar();
    resultado.focus();
    resultado.scrollIntoView({ block: 'start' });
  });
  function pintarNotas() {
    const e = propio();
    for (const f of filasTema) {
      const v = e?.notas[f.dataset.tema];
      $$('input', f).forEach((i) => {
        i.checked = i.value === v;
      });
    }
    pintarFalta();
  }
  function pintarFalta() {
    if (!falta) return;
    const e = propio();
    const n = e ? temas.filter((t) => !e.notas[t.nombre]).length : 0;
    const texto = n ? (n === 1 ? 'Falta marcar 1 tema.' : `Faltan marcar ${n} temas.`) : '';
    // A status line: it is only rewritten when what it says changes, so a screen reader does not repeat it.
    if (falta.textContent !== texto) falta.textContent = texto;
  }

  const TEXTO_ESTADO = {
    oficial: 'Mirá la resolución y marcá cómo te fue en cada tema.',
    alumno: 'Abajo está la resolución de un alumno, no oficial. Comparala y marcá cómo te fue en cada tema.',
    propuesta: 'No hay resolución oficial, pero abajo hay una propuesta sin verificar. Comparala y marcá cómo te fue en cada tema.',
    sin: 'Este examen no tiene resolución en el Drive. Marcá cómo te fue en cada tema y chequealo con su teoría.',
  };
  function pintarEstado() {
    const e = propio();
    caja.hidden = !e || e.fase !== 'corrigiendo';
    if (caja.hidden) return;
    caja.replaceChildren(
      el('p', { class: 'ex-e-t', text: e.vencio ? 'Se terminó el tiempo.' : 'Entregaste.' }),
      el('p', { text: TEXTO_ESTADO[datos.sol] || TEXTO_ESTADO.sin }),
      el('p', { class: 'ex-e-ir' }, el('a', { class: 'b-pri', href: '#corregir' }, 'Ir a corregirme')),
    );
  }

  const plural = (n, uno, varios) => (n === 1 ? uno : varios);
  // The advice of each verdict when no topic is left to review: the usual ones speak of «estos temas».
  const SIN_LISTA = {
    'muy-bien': VEREDICTOS['muy-bien'][1],
    bien: 'Probá con otro examen de la misma instancia.',
    medio: 'Repasá la teoría de este examen antes de rendir otro.',
    flojo: 'Arrancá por la teoría de este examen y volvé a intentarlo.',
  };
  function cuentaTemas(p) {
    const n = temas.length;
    if (!n) return '';
    let t;
    if (p.bien === n) t = n === 1 ? 'Te salió el tema.' : `Te salieron los ${n} temas.`;
    else if (p.medio === n) t = n === 1 ? 'El tema te salió más o menos.' : `Los ${n} temas te salieron más o menos.`;
    else if (p.mal === n) t = n === 1 ? 'No te salió el tema.' : `No te salió ninguno de los ${n} temas.`;
    else {
      const partes = [];
      if (p.bien) p.bien === 1 ? partes.push('1 te salió') : partes.push(`${p.bien} te salieron`);
      if (p.medio) partes.push(`${p.medio} más o menos`);
      if (p.mal) partes.push(`${p.mal} no`);
      t = partes.length ? `De los ${n} temas, ${partes.length > 1 ? `${partes.slice(0, -1).join(', ')} y ${partes.at(-1)}` : partes[0]}.` : '';
    }
    if (p.sinMarcar && p.sinMarcar < n) t += ` ${plural(p.sinMarcar, 'Te quedó 1 sin marcar.', `Te quedaron ${p.sinMarcar} sin marcar.`)}`;
    return t.trim();
  }
  // The result, under the title. The verdict is handwritten, as a teacher's mark on top of the sheet; it is written
  // once when it appears and stays still when a mark changes afterwards.
  function pintarResultado(escribir = true) {
    const e = propio();
    resultado.hidden = !e || e.fase !== 'listo';
    if (resultado.hidden) return;
    const respuestas = preguntas.map((q) => {
      const enlace = q.dataset.enlace || '';
      const r = e.respuestas[q.dataset.q];
      return { ok: r === undefined ? null : r === correcta(q), tema: q.dataset.tema, enlace, donde: nombrePagina.get(enlace.split('#')[0]) || '' };
    });
    const p = puntaje(
      temas.map((t) => t.nombre),
      e.notas,
      respuestas,
    );
    const v = veredicto(p.proporcion);
    const [nota, consejo] = v ? VEREDICTOS[v] : ['Sin corregir.', 'Marcá cómo te fue en cada tema para ver el resultado.'];
    const lineas = [cuentaTemas(p), p.mcTotal ? `En las preguntas con opciones acertaste ${p.mcBien} de ${p.mcTotal}.` : ''].filter(Boolean).join(' ');
    const tiempo = e.vencio ? `Usaste ${duracion(e.min)}, todo el tiempo.` : `Lo hiciste en ${textoDuracion(e.acumulado)}${e.min ? ` de ${duracion(e.min)}` : ''}.`;
    const lista = queRepasar(temas, e.notas, respuestas);
    const POR = { mal: 'No te salió', medio: 'Más o menos' };
    const items = lista.map((x) => {
      const por = [
        x.nivel === 'pregunta' ? '' : POR[x.nivel],
        x.errores ? plural(x.errores, 'erraste 1 pregunta', `erraste ${x.errores} preguntas`) : '',
        x.blancos ? plural(x.blancos, 'dejaste 1 pregunta sin responder', `dejaste ${x.blancos} preguntas sin responder`) : '',
      ].filter(Boolean).join(', ');
      const motivo = `${por.charAt(0).toUpperCase()}${por.slice(1)}.${x.donde && !emergencia() ? ` Está en ${x.donde}.` : ''}`;
      const nombre = x.enlace && !emergencia() ? el('a', { href: x.enlace, class: 'ex-r-tema' }, x.nombre) : el('b', { class: 'ex-r-tema', text: x.nombre });
      return el('li', { 'data-nivel': x.nivel }, nombre, ' ', el('span', { class: 'ex-r-por', text: motivo }));
    });
    const notaEl = el('p', { class: 'ex-r-nota', id: 'exResT', 'data-veredicto': v || 'nada' }, nota);
    if (!escribir) notaEl.classList.add('quieta');
    const otroLink = el('a', { class: 'b-sec', href: emergencia() ? 'emergencia.html' : datos.otro }, 'Otro examen');
    const bOtra = el('button', { type: 'button', class: 'b-pri' }, 'Rendirlo de nuevo');
    const bSalir = el('button', { type: 'button', class: 'b-sec' }, 'Salir del modo examen');
    bOtra.addEventListener('click', abrir);
    bSalir.addEventListener('click', salir);
    resultado.replaceChildren(
      el('h2', { class: 'vh', text: 'Cómo te fue' }),
      notaEl,
      el('p', { class: 'ex-r-cuenta', text: [lineas, tiempo].filter(Boolean).join(' ') }),
      // With nothing to review, only the advice, in words that do not point at a list.
      ...(v && lista.length ? [el('h3', { class: 'ex-r-sub', text: 'Para repasar' }), el('ul', { class: 'ex-r-lista' }, ...items)] : []),
      el('p', { class: 'ex-r-consejo', text: v && !lista.length ? SIN_LISTA[v] : consejo }),
      el('div', { class: 'ex-r-botones' }, bOtra, otroLink, bSalir),
    );
  }

  // ----- The clock ticks once a second, but the text only changes when its minute does.
  let reloj = null;
  let ultimoLatido = 0;
  let marca;
  function tic() {
    const e = propio();
    if (!e || e.fase !== 'rindiendo') {
      if (reloj) clearInterval(reloj);
      reloj = null;
      return;
    }
    if (!reloj) reloj = setInterval(tic, 1000);
    const ahora = Date.now();
    // terminar() takes the focus to «Se terminó el tiempo.», which reads it.
    if (vencido(e, ahora)) {
      terminar();
      return;
    }
    if (e.min) {
      const queda = restante(e, ahora);
      const fin = e.desde ? `Entregás a las ${textoHora(new Date(ahora + queda))}` : 'Reloj en pausa';
      if (dFin.textContent !== fin) dFin.textContent = fin;
      const t = `quedan ${textoQueda(queda)}`;
      if (dQueda.textContent !== t) dQueda.textContent = t;
      pQueda.textContent = `Quedan ${textoQueda(queda)}.`;
      dLinea.style.transform = `scaleX(${(queda / (e.min * 60000)).toFixed(4)})`;
      dock.dataset.poco = queda <= 10 * 60000 ? '1' : '';
      const ahoraMarca = queda <= 60000 ? 1 : queda <= 5 * 60000 ? 5 : queda <= 10 * 60000 ? 10 : 0;
      if (marca !== undefined && ahoraMarca && ahoraMarca !== marca) decir(ahoraMarca === 1 ? 'Queda 1 minuto.' : `Quedan ${ahoraMarca} minutos.`);
      marca = ahoraMarca;
    } else {
      const lleva = transcurrido(e, ahora);
      dFin.textContent = e.desde ? 'Sin reloj' : 'En pausa';
      dQueda.textContent = `llevás ${textoDuracion(lleva)}`;
      pQueda.textContent = `Llevás ${textoDuracion(lleva)}.`;
      dock.dataset.poco = '';
    }
    dock.dataset.conReloj = e.min ? '1' : '';
    if (e.desde && ahora - ultimoLatido > 10000) {
      ultimoLatido = ahora;
      estado = latido(e, ahora);
      guardar(estado);
    }
  }

  function pintar() {
    const e = propio();
    // Time ran out while nothing showed the page: it is handed in, and terminar() paints again.
    if (e?.fase === 'rindiendo' && vencido(e, Date.now())) {
      terminar();
      return;
    }
    const fase = e?.fase || '';
    if (fase) d.dataset.examen = fase;
    else delete d.dataset.examen;
    if (!otro()) bandaOtro?.remove();
    dock.hidden = fase !== 'rindiendo';
    if (seccionPreguntas) seccionPreguntas.hidden = !fase;
    if (seccionCaso) seccionCaso.hidden = !fase;
    if (corregir) corregir.hidden = fase !== 'corrigiendo' && fase !== 'listo';
    // After handing in, the resolution opens by itself.
    if (fase && fase !== 'rindiendo') $$('#resolucion-s details.sol-grande').forEach((x) => (x.open = true));
    pintarPreguntas();
    pintarNotas();
    pintarEstado();
    pintarResultado();
    const pausado = fase === 'rindiendo' && !e.desde;
    tic();
    if (pausado && !pausa.open) pausa.showModal();
    else if (!pausado && pausa.open) pausa.close();
  }

  // Another tab with the same exam keeps both in step. The note of being seen is kept when the page hides.
  window.addEventListener('storage', (ev) => {
    if (ev.key !== CLAVE) return;
    estado = leer();
    pintar();
  });
  document.addEventListener('visibilitychange', () => {
    const e = propio();
    if (document.visibilityState === 'hidden' && e?.desde) {
      estado = latido(e, Date.now());
      guardar(estado);
    }
  });

  pintar();
  // «Rendirlo con reloj» from the list of exams opens this page with #rendir.
  if (location.hash === '#rendir') {
    history.replaceState(null, '', location.pathname + location.search);
    if (!propio() || propio().fase === 'listo') abrir();
  }
})(typeof window === 'undefined' ? globalThis : window);
