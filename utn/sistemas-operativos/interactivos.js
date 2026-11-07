// Simuladores de Sistemas Operativos para «Armá tu resumen»: planificación de la CPU, reemplazo de páginas y el
// banquero, con los datos que escribe el alumno y cada paso. Ninguna página de la materia los usa: ahí van los
// ejemplos del material, y si alguno se pone en una página, sus campos quedan fijos.
// Convenciones del apunte (parcial.md): FCFS, SJF, SRTN, Round Robin y prioridad de teoría 2b, con espera y retorno
// como en la práctica de planificación; FIFO, LRU y OPT con el desempate FIFO de la práctica de memoria virtual;
// segunda oportunidad y reloj de teoría 3a; la detección con E, A, C y R de teoría 5c (figura 6-7), que con
// R = máximo − asignación es la búsqueda de una secuencia segura del banquero.
// La parte pura de arriba también corre en Node.
(() => {
  'use strict';
  const r9 = (x) => Math.round(x * 1e9) / 1e9;
  /** Número como lo escribe el apunte: coma decimal, hasta 3 decimales y el signo menos de verdad. */
  const f = (x) => String(Number((Math.abs(x) < 1e-12 ? 0 : x).toFixed(3))).replace('.', ',').replace('-', '−');
  const listaY = (xs) => (xs.length < 2 ? xs.join('') : `${xs.slice(0, -1).join(', ')} y ${xs[xs.length - 1]}`);
  const vec = (v) => `(${v.join(' ')})`;
  const queda = (x) => `${x === 1 ? 'queda' : 'quedan'} ${f(x)}`;
  const mayus = (t) => t[0].toUpperCase() + t.slice(1);

  /** Números separados por espacios, comas o punto y coma, con punto para los decimales. */
  const leerLista = (txt, max, que) => {
    const fichas = String(txt).replace(/−/g, '-').split(/[\s,;]+/).filter(Boolean);
    if (!fichas.length) return { nums: [] };
    if (fichas.length > max) return { error: `En ${que} hay ${fichas.length} números y el tope es ${max}.` };
    const k = fichas.findIndex((p) => !/^[+-]?(\d+(\.\d*)?|\.\d+)$/.test(p));
    if (k >= 0) return { error: `En ${que}, «${fichas[k].slice(0, 12)}» no es un número. Los decimales van con punto, como 2.5.` };
    return { nums: fichas.map(Number) };
  };

  // ===== Planificación de la CPU
  const ALG = { fcfs: 'FCFS', sjf: 'SJF', srtn: 'SRTN', rr: 'Round Robin', prio: 'Prioridad sin desalojo', priod: 'Prioridad con desalojo' };
  const POR_QUE = {
    fcfs: 'FCFS toma el que llegó primero',
    sjf: 'SJF toma el de ráfaga más corta',
    srtn: 'SRTN toma el de menor tiempo restante',
    prio: 'Toma el de mayor prioridad',
    priod: 'Toma el de mayor prioridad',
  };
  /**
   * P: [{ n, ll, r, p }] en el orden en que los escribió el alumno. chicoEsMas: el número más chico es la prioridad más alta.
   * Empates: el que llegó antes y, si llegaron juntos, el que está antes en la lista (FCFS). En Round Robin, lo que llega
   * justo cuando se termina un quantum entra a la cola antes que el desalojado. SRTN y prioridad con desalojo sacan al
   * que corre solo si el que llega es estrictamente mejor: el apunte compara el tiempo total del nuevo con el restante.
   */
  function planificar(P, alg, q, chicoEsMas) {
    const n = P.length;
    const rest = P.map((p) => p.r);
    const fin = Array(n).fill(0);
    const ord = P.map((_, i) => i).sort((a, b) => P[a].ll - P[b].ll || a - b);
    const tramos = [];
    const pasos = [];
    const nom = (i) => P[i].n;
    const pk = (i) => (chicoEsMas ? P[i].p : -P[i].p);
    const clave = { fcfs: (i) => P[i].ll, sjf: (i) => P[i].r, srtn: (i) => rest[i], rr: () => 0, prio: pk, priod: pk }[alg];
    const antes = (a, b) => clave(a) - clave(b) || P[a].ll - P[b].ll || a - b;
    const mejor = (xs) => xs.reduce((a, b) => (antes(b, a) < 0 ? b : a));
    const desc = {
      fcfs: (i) => `${nom(i)} (llegó en ${f(P[i].ll)})`,
      sjf: (i) => `${nom(i)} (ráfaga ${f(P[i].r)})`,
      srtn: (i) => `${nom(i)} (le ${queda(rest[i])})`,
      rr: nom,
      prio: (i) => `${nom(i)} (prioridad ${P[i].p})`,
      priod: (i) => `${nom(i)} (prioridad ${P[i].p})`,
    }[alg];
    let t = 0;
    let k = 0;
    let hechos = 0;
    let listos = [];
    const traer = (hasta) => {
      const nuevos = [];
      while (k < n && P[ord[k]].ll <= hasta + 1e-9) {
        listos.push(ord[k]);
        nuevos.push(ord[k]);
        k += 1;
      }
      return nuevos;
    };
    const tramo = (i, a, b) => {
      if (b - a < 1e-9) return;
      const u = tramos[tramos.length - 1];
      if (u && u.i === i && alg !== 'rr' && Math.abs(u.b - a) < 1e-9) u.b = b;
      else tramos.push({ i, a, b });
    };
    const terminar = (e) => {
      t = r9(t + rest[e]);
      rest[e] = 0;
      fin[e] = t;
      hechos += 1;
    };
    while (hechos < n) {
      traer(t);
      if (!listos.length) {
        const t2 = P[ord[k]].ll;
        tramo(null, t, t2);
        pasos.push(`t = ${f(t)}. No hay procesos listos. La CPU queda ociosa hasta ${f(t2)}, cuando llega ${nom(ord[k])}.`);
        t = t2;
        continue;
      }
      if (alg === 'rr') {
        const cola = listos.map(nom);
        const e = listos.shift();
        const t0 = t;
        const corre = Math.min(q, rest[e]);
        tramo(e, t0, r9(t0 + corre));
        t = r9(t0 + corre);
        rest[e] = r9(rest[e] - corre);
        const nuevos = traer(t);
        let txt = `t = ${f(t0)}. Cola de listos ${cola.join(', ')}. Corre ${nom(e)} de ${f(t0)} a ${f(t)}`;
        txt += rest[e] > 1e-9 ? ', lo que dura el quantum.' : ' y termina.';
        if (nuevos.length) txt += ` Mientras corría ${nuevos.length === 1 ? 'llegó' : 'llegaron'} ${listaY(nuevos.map(nom))}.`;
        if (rest[e] > 1e-9) {
          txt += listos.length
            ? ` Le ${queda(rest[e])} y va al final de la cola${nuevos.length ? `, después de ${listaY(nuevos.map(nom))}` : ''}.`
            : ` Le ${queda(rest[e])}. Como la cola está vacía, vuelve a tomar la CPU.`;
          listos.push(e);
        } else {
          fin[e] = t;
          hechos += 1;
        }
        pasos.push(txt);
        continue;
      }
      const vistos = listos.slice();
      const e = mejor(listos);
      listos = listos.filter((x) => x !== e);
      const t0 = t;
      let txt = `t = ${f(t)}. ${vistos.length === 1 ? 'Listo' : 'Listos'} ${listaY(vistos.map(desc))}.`;
      if (vistos.length > 1) {
        txt += ` ${POR_QUE[alg]}, ${nom(e)}.`;
        const empate = vistos.filter((x) => x !== e && clave(x) === clave(e));
        if (empate.length) {
          const juntos = empate.filter((x) => P[x].ll === P[e].ll).length;
          const porque = alg === 'fcfs' || juntos === empate.length ? 'porque está antes en la lista' : juntos ? 'por llegada y, entre los que llegaron juntos, por estar antes en la lista' : 'porque llegó antes';
          txt += ` Empata con ${listaY(empate.map(nom))} y va primero ${porque}.`;
        }
      }
      pasos.push(txt);
      const sel = pasos.length - 1;
      let ultimo = sel;
      let desalojado = false;
      if (alg === 'srtn' || alg === 'priod') {
        while (k < n && P[ord[k]].ll < t + rest[e] - 1e-9) {
          const ta = P[ord[k]].ll;
          tramo(e, t, ta);
          rest[e] = r9(rest[e] - (ta - t));
          t = ta;
          const nuevos = traer(t);
          const m = mejor(nuevos);
          const gana = clave(m) < clave(e);
          const llega = alg === 'srtn' ? (i) => `${nom(i)} (ráfaga ${f(P[i].r)})` : desc;
          let s = `t = ${f(t)}. ${nuevos.length === 1 ? 'Llega' : 'Llegan'} ${listaY(nuevos.map(llega))}. `;
          s += alg === 'srtn' ? `${nom(e)}, que está en la CPU, tiene ${f(rest[e])} por hacer.` : `${nom(e)}, que está en la CPU, tiene prioridad ${P[e].p}.`;
          if (gana) s += ` ${nom(m)} ${alg === 'srtn' ? 'es más corto' : 'es más prioritario'} y desaloja a ${nom(e)}, que vuelve a listos.`;
          else s += ` ${nuevos.length === 1 ? 'No es' : 'Ninguno es'} ${alg === 'srtn' ? 'más corto' : 'más prioritario'}, así que ${nom(e)} sigue.`;
          pasos.push(s);
          ultimo = pasos.length - 1;
          if (gana) {
            listos.push(e);
            desalojado = true;
            break;
          }
        }
      }
      if (vistos.length === 1 && ultimo !== sel) pasos[sel] += ` Toma la CPU.`;
      if (!desalojado) {
        const desde = t;
        tramo(e, desde, r9(desde + rest[e]));
        terminar(e);
        pasos[ultimo] += ultimo === pasos.length - 1 && desde === t0 ? ` Corre de ${f(t0)} a ${f(t)} y termina.` : ` ${nom(e)} termina en ${f(t)}.`;
      }
    }
    const retorno = P.map((p, i) => r9(fin[i] - p.ll));
    const espera = P.map((p, i) => r9(retorno[i] - p.r));
    const prom = (xs) => xs.reduce((a, b) => a + b, 0) / n;
    return { tramos, pasos, fin, retorno, espera, promE: prom(espera), promR: prom(retorno), total: t };
  }

  const MAX_PROC = 12;
  const MAX_TURNOS = 400;
  /** Lee los campos de la planificación. Las prioridades hacen falta solo si el algoritmo las usa. */
  function leerProcesos(d) {
    const ra = leerLista(d.rafagas, MAX_PROC, 'las ráfagas');
    if (ra.error) return { ...ra, en: 'rafagas' };
    const n = ra.nums.length;
    if (!n) return { error: 'Escribí la ráfaga de cada proceso.', en: 'rafagas' };
    if (ra.nums.some((x) => !(x > 0) || x > 9999)) return { error: 'Cada ráfaga va de más de 0 a 9999.', en: 'rafagas' };
    const ll = leerLista(d.llegadas, MAX_PROC, 'las llegadas');
    if (ll.error) return { ...ll, en: 'llegadas' };
    const lls = ll.nums.length ? ll.nums : Array(n).fill(0);
    if (lls.length !== n) return { error: `Hay ${lls.length} ${lls.length === 1 ? 'llegada' : 'llegadas'} y ${n} ${n === 1 ? 'ráfaga' : 'ráfagas'}. Va una de cada una por proceso.`, en: 'llegadas' };
    if (lls.some((x) => x < 0 || x > 9999)) return { error: 'Cada llegada va de 0 a 9999.', en: 'llegadas' };
    const nombres = String(d.nombres).split(/[\s,;]+/).filter(Boolean);
    const ns = nombres.length ? nombres : ra.nums.map((_, i) => `P${i + 1}`);
    if (ns.length !== n) return { error: `Hay ${ns.length} ${ns.length === 1 ? 'nombre' : 'nombres'} y ${n} ${n === 1 ? 'ráfaga' : 'ráfagas'}. Va un nombre por proceso, o ninguno.`, en: 'nombres' };
    const malo = ns.find((x) => !/^[\p{L}\p{N}_-]{1,8}$/u.test(x));
    if (malo) return { error: `«${malo.slice(0, 12)}» no sirve de nombre. Usá letras y números, hasta 8.`, en: 'nombres' };
    const rep = ns.find((x, i) => ns.indexOf(x) !== i);
    if (rep) return { error: `El nombre ${rep} está repetido.`, en: 'nombres' };
    const pr = leerLista(d.prioridades, MAX_PROC, 'las prioridades');
    let prios = null;
    let errPrio = pr.error || '';
    if (!errPrio) {
      if (pr.nums.length !== n) errPrio = `Hay ${pr.nums.length} ${pr.nums.length === 1 ? 'prioridad' : 'prioridades'} y ${n} ${n === 1 ? 'proceso' : 'procesos'}. Va una por proceso.`;
      else if (pr.nums.some((x) => !Number.isInteger(x) || Math.abs(x) > 999)) errPrio = 'Las prioridades son números enteros, de −999 a 999.';
      else prios = pr.nums;
    }
    const qq = leerLista(d.quantum, 1, 'el quantum');
    let q = null;
    let errQ = qq.error || '';
    if (!errQ) {
      if (qq.nums.length !== 1 || !(qq.nums[0] > 0) || qq.nums[0] > 9999) errQ = 'El quantum es un número de más de 0 a 9999.';
      else if (ra.nums.reduce((a, r) => a + Math.ceil(r / qq.nums[0] - 1e-9), 0) > MAX_TURNOS) errQ = `Con ese quantum salen más de ${MAX_TURNOS} turnos. Probá con uno más grande.`;
      else q = qq.nums[0];
    }
    const P = ns.map((nm, i) => ({ n: nm, ll: lls[i], r: ra.nums[i], p: prios ? prios[i] : 0 }));
    return { P, q, errQ, prios, errPrio };
  }

  // ===== Reemplazo de páginas
  const ALG_P = { fifo: 'FIFO', lru: 'LRU', opt: 'Óptimo (OPT)', seg: 'Segunda oportunidad', reloj: 'Reloj' };
  const SUP = { 0: '⁰', 1: '¹' };
  /**
   * refs: páginas como textos. El bit R se pone en 1 al cargar y en cada referencia, y solo lo borra el algoritmo.
   * Cada página nueva entra en el marco de la que sale. OPT desempata con FIFO las que no vuelven, como la práctica.
   */
  function reemplazar(refs, m, alg) {
    const marcos = Array(m).fill(null);
    const R = Array(m).fill(0);
    const carga = Array(m).fill(-1);
    const uso = Array(m).fill(-1);
    let lista = [];
    let mano = 0;
    let fallos = 0;
    const pasos = [];
    const pg = (j) => `la ${marcos[j]}`;
    refs.forEach((p, k) => {
      const en = marcos.indexOf(p);
      let txt;
      let donde = en;
      if (en >= 0) {
        uso[en] = k;
        R[en] = 1;
        txt = `Ya está en el marco ${en + 1}. No hay fallo.`;
        if (alg === 'lru') txt += ' Pasa a ser la usada más recientemente.';
        if (alg === 'seg' || alg === 'reloj') txt += ' Su bit R queda en 1.';
      } else {
        fallos += 1;
        const libre = marcos.indexOf(null);
        if (libre >= 0) {
          donde = libre;
          txt = `No está y hay un marco libre. Fallo, y se carga en el marco ${libre + 1}.`;
          if (alg === 'seg') lista.push(libre);
          if (alg === 'reloj') mano = (libre + 1) % m;
        } else if (alg === 'fifo') {
          donde = carga.indexOf(Math.min(...carga));
          txt = `No está. Fallo. FIFO saca la que lleva más tiempo cargada, ${pg(donde)}, que entró en la referencia ${carga[donde] + 1}.`;
        } else if (alg === 'lru') {
          donde = uso.indexOf(Math.min(...uso));
          txt = `No está. Fallo. LRU saca la que hace más tiempo que no se usa, ${pg(donde)}, usada por última vez en la referencia ${uso[donde] + 1}.`;
        } else if (alg === 'opt') {
          const prox = marcos.map((x) => {
            const i = refs.indexOf(x, k + 1);
            return i < 0 ? Infinity : i;
          });
          const lejos = Math.max(...prox);
          const cand = marcos.map((_, j) => j).filter((j) => prox[j] === lejos);
          donde = cand.reduce((a, b) => (carga[b] < carga[a] ? b : a));
          const si = marcos.map((_, j) => j).filter((j) => prox[j] < Infinity).map((j, i) => (i ? `la ${marcos[j]} en la ${prox[j] + 1}` : `la ${marcos[j]} vuelve en la referencia ${prox[j] + 1}`));
          const nunca = marcos.filter((_, j) => prox[j] === Infinity).map((x) => `la ${x}`);
          if (nunca.length) si.push(`${listaY(nunca)} no ${nunca.length === 1 ? 'vuelve' : 'vuelven'}`);
          txt = nunca.length === m ? 'No está. Fallo. OPT mira hacia adelante y ninguna de las que están vuelve a usarse.' : `No está. Fallo. OPT mira hacia adelante. ${mayus(listaY(si))}.`;
          txt += cand.length > 1
            ? ` Se desempata con FIFO entre ${listaY(cand.map((j) => `la ${marcos[j]}`))}, y sale ${pg(donde)}, que entró antes.`
            : ` Sale ${pg(donde)}, ${lejos === Infinity ? 'que no vuelve' : 'la que más tarda en volver'}.`;
        } else if (alg === 'seg') {
          const vueltas = [];
          while (R[lista[0]]) {
            const j = lista.shift();
            R[j] = 0;
            lista.push(j);
            vueltas.push(`${pg(j)} tiene R = 1, se le pone en 0 y va al final`);
          }
          donde = lista.shift();
          lista.push(donde);
          txt = `No está. Fallo. Segunda oportunidad mira la más antigua.${vueltas.length ? ` ${vueltas.map(mayus).join('. ')}.` : ''} ${mayus(pg(donde))} tiene R = 0 y sale.`;
        } else {
          const vueltas = [];
          const desde = mano;
          while (R[mano]) {
            R[mano] = 0;
            vueltas.push(`el marco ${mano + 1} (${pg(mano)}) tiene R = 1, se pone en 0 y avanza`);
            mano = (mano + 1) % m;
          }
          donde = mano;
          mano = (mano + 1) % m;
          txt = `No está. Fallo. La manecilla está en el marco ${desde + 1}.${vueltas.length ? ` ${vueltas.map(mayus).join('. ')}.` : ''} El marco ${donde + 1} (${pg(donde)}) tiene R = 0 y sale. La manecilla pasa al marco ${mano + 1}.`;
        }
        marcos[donde] = p;
        carga[donde] = k;
        uso[donde] = k;
        R[donde] = 1;
        if (alg === 'seg') txt += ` Lista, de la más vieja a la más nueva, ${lista.map((j) => marcos[j]).join(', ')}.`;
      }
      pasos.push({ p, marcos: marcos.slice(), R: R.slice(), mano, fallo: en < 0, donde, txt });
    });
    return { pasos, fallos };
  }
  const MAX_REFS = 60;
  const MAX_MARCOS = 10;
  function leerCadena(txt) {
    const fichas = String(txt).split(/[\s,;]+/).filter(Boolean);
    if (!fichas.length) return { error: 'Escribí la cadena de referencias.' };
    if (fichas.length > MAX_REFS) return { error: `Son ${fichas.length} referencias y el tope es ${MAX_REFS}.` };
    const mala = fichas.find((x) => !/^[A-Za-z0-9]{1,4}$/.test(x));
    if (mala) return { error: `«${mala.slice(0, 10)}» no sirve como página. Usá números o letras, hasta 4.` };
    return { refs: fichas };
  }
  function leerMarcos(txt) {
    const t = String(txt).trim();
    if (!/^\d{1,2}$/.test(t) || Number(t) < 1 || Number(t) > MAX_MARCOS) return { error: `Los marcos son un número entero de 1 a ${MAX_MARCOS}.` };
    return { m: Number(t) };
  }

  // ===== Banquero y detección con matrices
  const MAX_PROC_B = 10;
  const MAX_REC = 6;
  /** Una matriz con un renglón por proceso y un entero por recurso. */
  function leerMatriz(txt, que) {
    const filas = String(txt).split('\n').map((l) => l.trim()).filter(Boolean);
    if (!filas.length) return { error: `Falta ${que}.` };
    if (filas.length > MAX_PROC_B) return { error: `${mayus(que)} tiene ${filas.length} renglones y el tope es ${MAX_PROC_B} procesos.` };
    const M = [];
    for (let i = 0; i < filas.length; i += 1) {
      const r = leerLista(filas[i], MAX_REC, `${que}, renglón ${i + 1}`);
      if (r.error) return r;
      if (r.nums.some((x) => !Number.isInteger(x) || x < 0 || x > 9999)) return { error: `En ${que}, el renglón ${i + 1} tiene algo que no es un entero de 0 a 9999.` };
      if (i && r.nums.length !== M[0].length) return { error: `En ${que}, el renglón ${i + 1} tiene ${r.nums.length} números y el primero ${M[0].length}. Va uno por recurso.` };
      M.push(r.nums);
    }
    return { M };
  }
  /**
   * Teoría 5c: se busca un proceso desmarcado cuya fila de R sea menor o igual que A. Si existe, se suma su fila de C
   * a A y se lo marca. Se recorre desde el primero cada vez, y se toma el primero que puede terminar.
   */
  function buscarSecuencia(C, R, A0) {
    const n = C.length;
    let A = A0.slice();
    const hecho = Array(n).fill(false);
    const orden = [];
    const pasos = [];
    for (;;) {
      const revisados = [];
      let e = -1;
      for (let i = 0; i < n && e < 0; i += 1) {
        if (hecho[i]) continue;
        const falta = R[i].findIndex((x, j) => x > A[j]);
        if (falta < 0) e = i;
        else revisados.push({ i, falta });
      }
      if (e < 0) {
        pasos.push({ revisados, e, antes: A.slice() });
        break;
      }
      const antes = A.slice();
      A = A.map((x, j) => x + C[e][j]);
      hecho[e] = true;
      orden.push(e);
      pasos.push({ revisados, e, antes, despues: A.slice() });
      if (orden.length === n) break;
    }
    return { orden, pasos, quedan: hecho.map((h, i) => (h ? -1 : i)).filter((i) => i >= 0), A };
  }

  const NUCLEO = { planificar, leerProcesos, reemplazar, leerCadena, leerMarcos, leerMatriz, buscarSecuencia, leerLista };
  if (typeof document === 'undefined') {
    module.exports = NUCLEO;
    return;
  }

  // ===== Navegador
  const UTN = window.UTN || (window.UTN = {});
  const enResumenDe = (figura, ayuda) => ayuda.enResumen ?? figura.classList.contains('ag-pieza');
  /** cfg.datos viene del navegador y no es confiable: un texto guardado dentro de su tope, o undefined. */
  const guardado = (cfg, clave, tope) => {
    const d = cfg && cfg.datos;
    if (!d || typeof d !== 'object' || Array.isArray(d) || !Object.prototype.hasOwnProperty.call(d, clave)) return undefined;
    return typeof d[clave] === 'string' && d[clave].length <= tope ? d[clave] : undefined;
  };
  /** Lo guardado si pasa su control, o el ejemplo. */
  const oEjemplo = (cfg, clave, tope, def, sirve) => {
    const v = guardado(cfg, clave, tope);
    return v !== undefined && sirve(v) ? v : def;
  };
  const tiene = (o, k) => Object.prototype.hasOwnProperty.call(o, k);
  let cuenta = 0;
  const nuevoId = () => `so${(cuenta += 1)}`;
  function campo(ayuda, etq, valor, tope, area) {
    const id = nuevoId();
    const inp = area
      ? ayuda.crear('textarea', { id, rows: 4, spellcheck: false, autocomplete: 'off', value: valor, maxLength: tope })
      : ayuda.crear('input', { id, type: 'text', autocomplete: 'off', spellcheck: false, autocapitalize: 'off', value: valor, maxLength: tope });
    const etiqueta = ayuda.crear('label', { htmlFor: id }, etq);
    return { inp, etiqueta, fila: ayuda.crear('div', { className: 'w-entrada' }, etiqueta, inp) };
  }
  function elegir(ayuda, etq, opciones, actual) {
    const id = nuevoId();
    const sel = ayuda.crear('select', { id }, ...opciones.map(([v, t]) => ayuda.crear('option', { value: v, selected: v === actual }, t)));
    const etiqueta = ayuda.crear('label', { htmlFor: id }, etq);
    return { sel, etiqueta, fila: ayuda.crear('div', { className: 'w-entrada' }, etiqueta, sel) };
  }
  /** Una tabla dentro de un marco que se desplaza solo, para no desbordar la página en un celular. */
  function tabla(ayuda, titulo, cab, filas, enNegrita) {
    const { crear } = ayuda;
    const celda = (c, i, j) => {
      if (j === 0) {
        // La cabecera de cada fila lleva la línea fina de las celdas, no la gruesa de las columnas.
        const th = crear('th', { scope: 'row' }, c);
        th.style.borderBottom = '1px solid var(--borde)';
        return th;
      }
      const fuerte = enNegrita && enNegrita(i, j);
      return crear('td', {}, fuerte ? crear('strong', {}, c) : c);
    };
    // El título queda a la vista, a la izquierda, aunque la tabla sea más ancha que la pantalla.
    const cap = crear('caption', {}, titulo);
    Object.assign(cap.style, { position: 'sticky', left: '0', maxWidth: '100cqi', boxSizing: 'border-box', textAlign: 'left' });
    const marco = crear('div', { className: 'w-tabla-v', tabIndex: 0, role: 'region', 'aria-label': `${titulo}. Si no entra, se desplaza con las flechas.` },
      crear('table', {},
        cap,
        crear('thead', {}, crear('tr', {}, ...cab.map((c) => crear('th', { scope: 'col' }, c)))),
        crear('tbody', {}, ...filas.map((fl, i) => crear('tr', {}, ...fl.map((c, j) => celda(c, i, j)))))));
    marco.style.containerType = 'inline-size';
    return marco;
  }
  const salidas = (ayuda, filas) => ayuda.crear('dl', { className: 'w-salidas' }, ...filas.flatMap(([t, v]) => [ayuda.crear('dt', {}, t), ayuda.crear('dd', {}, v)]));
  const pasoAPaso = (ayuda, lineas) => ayuda.crear('details', { open: true },
    ayuda.crear('summary', {}, 'Paso a paso'),
    ayuda.crear('ol', { className: 'w-pasos' }, ...lineas.map((t) => ayuda.crear('li', {}, t))));
  const rgb = (c) => (String(c).match(/[\d.]+/g) || [0, 0, 0]).slice(0, 3).map(Number);
  const mezclar = (a, b, p) => {
    const x = rgb(a);
    const y = rgb(b);
    return `rgb(${x.map((v, i) => Math.round(v * p + y[i] * (1 - p))).join(', ')})`;
  };
  /** La imagen para el archivo: el dibujo como se ve (si hay) y abajo los textos y tablas de ayuda.pngTablas. */
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
  /** Arma la pieza: datos arriba, error, resultado. En una página de la materia los campos quedan fijos. */
  function armazon(figura, ayuda, leyenda, hijos, volver) {
    const { crear, lienzo } = ayuda;
    const datos = crear('fieldset', { className: 'ps-datos' }, crear('legend', {}, leyenda), ...hijos, crear('div', { className: 'w-botones ps-volver' }, ayuda.boton('Volver al ejemplo', volver)));
    const error = crear('p', { className: 'w-error', role: 'status', hidden: true });
    const estado = crear('p', { className: 'ps-explica', role: 'status' });
    const resultado = crear('div', {});
    if (!enResumenDe(figura, ayuda)) {
      datos.disabled = true;
      lienzo.append(crear('p', { className: 'w-aviso' }, 'Con tus propios datos se usa en «Armá tu resumen».'));
    }
    lienzo.append(datos, error, estado, resultado);
    const mostrar = (msg) => {
      error.textContent = msg || '';
      error.hidden = !msg;
      resultado.hidden = !!msg;
      if (msg) estado.textContent = '';
    };
    return { error, estado, resultado, mostrar };
  }
  const tamLetra = () => Math.round((13 * (parseFloat(getComputedStyle(document.documentElement).fontSize) || 16)) / 16);

  // ----- Planificación
  const EJ_PLAN = { nombres: 'P1 P2 P3', llegadas: '0 0 0', rafagas: '24 3 3', prioridades: '3 1 2', alg: 'rr', quantum: '4', orden: 'chico' };
  UTN.interactivo('planificacion', (figura, cfg, ayuda) => {
    const { crear, svg } = ayuda;
    const lista = (v) => !leerLista(v, MAX_PROC, '').error;
    const cNom = campo(ayuda, 'Nombres', oEjemplo(cfg, 'nombres', 200, EJ_PLAN.nombres, (v) => String(v).split(/[\s,;]+/).filter(Boolean).length <= MAX_PROC), 200);
    const cLl = campo(ayuda, 'Llegadas', oEjemplo(cfg, 'llegadas', 200, EJ_PLAN.llegadas, lista), 200);
    const cRa = campo(ayuda, 'Ráfagas', oEjemplo(cfg, 'rafagas', 200, EJ_PLAN.rafagas, lista), 200);
    const cPr = campo(ayuda, 'Prioridades', oEjemplo(cfg, 'prioridades', 200, EJ_PLAN.prioridades, lista), 200);
    const cQ = campo(ayuda, 'Quantum', oEjemplo(cfg, 'quantum', 12, EJ_PLAN.quantum, (v) => /^\s*\d+(\.\d+)?\s*$/.test(v) && Number(v) > 0), 12);
    const sAlg = elegir(ayuda, 'Algoritmo', Object.entries(ALG), oEjemplo(cfg, 'alg', 8, EJ_PLAN.alg, (v) => tiene(ALG, v)));
    const sOrden = elegir(ayuda, 'Prioridad más alta', [['chico', 'El número más chico'], ['grande', 'El número más grande']], oEjemplo(cfg, 'orden', 8, EJ_PLAN.orden, (v) => v === 'chico' || v === 'grande'));
    const campos = [cNom, cLl, cRa, cPr, cQ];
    const ayudita = crear('p', { className: 'w-ayuda' }, 'Un número por proceso, en el mismo orden, separados con espacios o comas. Si todos llegan en 0, las llegadas pueden quedar vacías. Hasta 12 procesos.');
    const empates = crear('p', { className: 'w-ayuda' });
    const volver = () => {
      cNom.inp.value = EJ_PLAN.nombres;
      cLl.inp.value = EJ_PLAN.llegadas;
      cRa.inp.value = EJ_PLAN.rafagas;
      cPr.inp.value = EJ_PLAN.prioridades;
      cQ.inp.value = EJ_PLAN.quantum;
      sAlg.sel.value = EJ_PLAN.alg;
      sOrden.sel.value = EJ_PLAN.orden;
      cambio();
    };
    const pieza = armazon(figura, ayuda, 'Tus procesos', [
      crear('div', { className: 'w-entradas' }, cNom.fila, cLl.fila, cRa.fila, cPr.fila),
      ayudita,
      crear('div', { className: 'w-entradas' }, sAlg.fila, cQ.fila, sOrden.fila),
      empates,
    ], volver);
    const marco = crear('div', { className: 'w-tabla-v', tabIndex: 0, role: 'region', 'aria-label': 'Diagrama de Gantt. Si no entra, se desplaza con las flechas.' });
    let corrida = null;
    let leidos = null;
    let dibujo = null;
    const pintar = () => {
      dibujo = null;
      if (!corrida) return marco.replaceChildren();
      const fs = tamLetra();
      const tinta = ayuda.color('--tinta');
      const acento = ayuda.color('--birome');
      const papel = ayuda.color('--papel');
      const { tramos, total } = corrida;
      const P = leidos.P;
      const pad = fs * 1.2;
      const W = Math.max(260, Math.round(marco.clientWidth || 600));
      const minLargo = Math.min(...tramos.map((x) => x.b - x.a));
      const esc = Math.min(Math.max((W - 2 * pad) / total, (fs * 1.8) / minLargo), (6000 - 2 * pad) / total);
      const ancho = Math.round(total * esc + 2 * pad);
      const y0 = fs * 0.6;
      const hb = fs * 2.4;
      const alto = Math.round(y0 + hb + fs * 2.2);
      const TONOS = [0.1, 0.3, 0.18, 0.34, 0.06, 0.24];
      const enPalabras = tramos.map((x) => `${x.i === null ? 'CPU ociosa' : P[x.i].n} de ${f(x.a)} a ${f(x.b)}`).join(', ');
      const s = svg('svg', { width: ancho, height: alto, viewBox: `0 0 ${ancho} ${alto}`, role: 'img', 'aria-label': `Gantt: ${enPalabras}.` });
      // Con su ancho fijo: si no entra, se desplaza dentro de su marco en vez de achicarse.
      Object.assign(s.style, { display: 'block', width: `${ancho}px`, height: `${alto}px`, maxWidth: 'none' });
      tramos.forEach((x) => {
        const xa = pad + x.a * esc;
        const w = (x.b - x.a) * esc;
        s.append(svg('rect', { x: xa, y: y0, width: w, height: hb, fill: x.i === null ? 'none' : mezclar(acento, papel, TONOS[x.i % TONOS.length]), stroke: tinta, 'stroke-width': 1, 'stroke-dasharray': x.i === null ? '3 3' : undefined }));
        const etq = x.i === null ? '' : P[x.i].n;
        if (etq && w >= fs * 0.68 * etq.length + 4) s.append(svg('text', { x: xa + w / 2, y: y0 + hb / 2, 'text-anchor': 'middle', 'dominant-baseline': 'central', fill: tinta, 'font-size': fs, 'font-weight': 600 }, etq));
      });
      const marcas = [...new Set([0, ...tramos.flatMap((x) => [x.a, x.b])])].sort((a, b) => a - b);
      let hasta = -Infinity;
      marcas.forEach((v) => {
        const x = pad + v * esc;
        const txt = f(v);
        const medio = (txt.length * fs * 0.6) / 2;
        s.append(svg('line', { x1: x, y1: y0 + hb, x2: x, y2: y0 + hb + fs * 0.4, stroke: tinta, 'stroke-width': 1 }));
        if (x - medio >= hasta + 3) {
          s.append(svg('text', { x, y: y0 + hb + fs * 1.5, 'text-anchor': 'middle', fill: tinta, 'font-size': fs * 0.92 }, txt));
          hasta = x + medio;
        }
      });
      marco.replaceChildren(s);
      dibujo = s;
    };
    let ancho = 0;
    new ResizeObserver(() => {
      if (marco.clientWidth > 0 && Math.round(marco.clientWidth) !== ancho) {
        ancho = Math.round(marco.clientWidth);
        pintar();
      }
    }).observe(marco);
    ayuda.alCambiar(pintar);
    let filasProc = [];
    let cabProc = [];
    let comparar = [];
    const calcular = () => {
      const alg = sAlg.sel.value;
      const usaPrio = alg === 'prio' || alg === 'priod';
      cQ.fila.hidden = alg !== 'rr';
      cPr.fila.hidden = !usaPrio;
      sOrden.fila.hidden = !usaPrio;
      empates.textContent = alg === 'rr'
        ? 'Si alguien llega justo cuando se termina un quantum, entra a la cola antes que el que sale de la CPU.'
        : alg === 'srtn' || alg === 'priod'
          ? 'Desaloja solo si el que llega es estrictamente mejor. En un empate va el que llegó antes y, si llegaron juntos, el que está antes en la lista.'
          : 'En un empate va el que llegó antes y, si llegaron juntos, el que está antes en la lista.';
      corrida = null;
      leidos = leerProcesos({ nombres: cNom.inp.value, llegadas: cLl.inp.value, rafagas: cRa.inp.value, prioridades: cPr.inp.value, quantum: cQ.inp.value });
      let msg = leidos.error;
      let en = leidos.en;
      if (!msg && alg === 'rr' && leidos.errQ) [msg, en] = [leidos.errQ, 'quantum'];
      if (!msg && usaPrio && leidos.errPrio) [msg, en] = [leidos.errPrio, 'prioridades'];
      [[cNom, 'nombres'], [cLl, 'llegadas'], [cRa, 'rafagas'], [cPr, 'prioridades'], [cQ, 'quantum']].forEach(([c, k]) => c.inp.setAttribute('aria-invalid', String(!!msg && en === k)));
      pieza.mostrar(msg);
      if (msg) {
        pintar();
        return;
      }
      const chico = sOrden.sel.value === 'chico';
      const { P, q } = leidos;
      corrida = planificar(P, alg, q, chico);
      const r = corrida;
      pieza.estado.textContent = `${ALG[alg]}${alg === 'rr' ? ` con quantum ${f(q)}` : ''}. Espera promedio ${f(r.promE)} y retorno promedio ${f(r.promR)}.`;
      cabProc = ['Proceso', 'Llegada', 'Ráfaga', ...(usaPrio ? ['Prioridad'] : []), 'Fin', 'Retorno = fin − llegada', 'Espera = retorno − ráfaga'];
      filasProc = P.map((p, i) => [p.n, f(p.ll), f(p.r), ...(usaPrio ? [String(p.p)] : []), f(r.fin[i]), `${f(r.fin[i])} − ${f(p.ll)} = ${f(r.retorno[i])}`, `${f(r.retorno[i])} − ${f(p.r)} = ${f(r.espera[i])}`]);
      const n = P.length;
      const suma = (xs) => `(${xs.map(f).join(' + ')}) / ${n}`;
      comparar = Object.keys(ALG).map((a) => {
        if (a === 'rr' && leidos.errQ) return [ALG[a], 'Falta el quantum', ''];
        if ((a === 'prio' || a === 'priod') && leidos.errPrio) return [ALG[a], 'Faltan las prioridades', ''];
        const o = a === alg ? r : planificar(P, a, q, chico);
        return [`${ALG[a]}${a === 'rr' ? `, q = ${f(q)}` : ''}`, f(o.promE), f(o.promR)];
      });
      pieza.resultado.replaceChildren(
        crear('p', { className: 'ps-graf-t' }, 'Diagrama de Gantt'),
        marco,
        tabla(ayuda, 'Cada proceso', cabProc, filasProc),
        salidas(ayuda, [['Espera promedio', `${suma(r.espera)} = ${f(r.promE)}`], ['Retorno promedio', `${suma(r.retorno)} = ${f(r.promR)}`]]),
        tabla(ayuda, 'Con los mismos datos, cada algoritmo', ['Algoritmo', 'Espera promedio', 'Retorno promedio'], comparar),
        pasoAPaso(ayuda, r.pasos),
      );
      pintar();
    };
    const guardar = () => ayuda.guardarDatos({ nombres: cNom.inp.value, llegadas: cLl.inp.value, rafagas: cRa.inp.value, prioridades: cPr.inp.value, quantum: cQ.inp.value, alg: sAlg.sel.value, orden: sOrden.sel.value });
    const cambio = () => {
      calcular();
      guardar();
    };
    campos.forEach((c) => c.inp.addEventListener('input', cambio));
    [sAlg, sOrden].forEach((c) => c.sel.addEventListener('change', cambio));
    calcular();
    const imagen = () => {
      if (!corrida) return Promise.resolve(null);
      const alg = sAlg.sel.value;
      const r = corrida;
      const n = leidos.P.length;
      return apilar(ayuda, dibujo, [
        { texto: `Planificación con ${ALG[alg]}${alg === 'rr' ? `, quantum ${f(leidos.q)}` : ''}`, negrita: true },
        { cab: cabProc, tabla: filasProc },
        { texto: `Espera promedio = (${r.espera.map(f).join(' + ')}) / ${n} = ${f(r.promE)}` },
        { texto: `Retorno promedio = (${r.retorno.map(f).join(' + ')}) / ${n} = ${f(r.promR)}` },
        { texto: 'Con los mismos datos, cada algoritmo', negrita: true },
        { cab: ['Algoritmo', 'Espera promedio', 'Retorno promedio'], tabla: comparar },
        { texto: 'Paso a paso', negrita: true },
        ...r.pasos.slice(0, 80).map((t, i) => ({ texto: `${i + 1}. ${t}` })),
        r.pasos.length > 80 ? { texto: `Siguen ${r.pasos.length - 80} pasos más en el simulador.` } : null,
      ]);
    };
    return { imagen, redibujar: pintar };
  });

  // ----- Reemplazo de páginas
  const EJ_PAG = { cadena: '7 0 1 2 0 3 0 4 2 3 0 3 2 1 2 0 1 7 0 1', marcos: '3', alg: 'lru' };
  UTN.interactivo('reemplazo-paginas', (figura, cfg, ayuda) => {
    const { crear } = ayuda;
    const cCad = campo(ayuda, 'Cadena de referencias', oEjemplo(cfg, 'cadena', 400, EJ_PAG.cadena, (v) => !leerCadena(v).error), 400);
    const cMar = campo(ayuda, 'Marcos', oEjemplo(cfg, 'marcos', 4, EJ_PAG.marcos, (v) => !leerMarcos(v).error), 4);
    const sAlg = elegir(ayuda, 'Algoritmo', Object.entries(ALG_P), oEjemplo(cfg, 'alg', 8, EJ_PAG.alg, (v) => tiene(ALG_P, v)));
    const nota = crear('p', { className: 'w-ayuda' });
    const volver = () => {
      cCad.inp.value = EJ_PAG.cadena;
      cMar.inp.value = EJ_PAG.marcos;
      sAlg.sel.value = EJ_PAG.alg;
      cambio();
    };
    const pieza = armazon(figura, ayuda, 'Tus datos', [
      cCad.fila,
      crear('p', { className: 'w-ayuda' }, `Las páginas van separadas con espacios o comas, hasta ${MAX_REFS}.`),
      crear('div', { className: 'w-entradas' }, cMar.fila, sAlg.fila),
      nota,
    ], volver);
    let corrida = null;
    let cab = [];
    let filas = [];
    let comp = [];
    let compCab = [];
    let m = 0;
    let refs = [];
    const calcular = () => {
      const alg = sAlg.sel.value;
      nota.textContent = {
        fifo: 'Sale la que lleva más tiempo cargada.',
        lru: 'Sale la que hace más tiempo que no se usa.',
        opt: 'Sale la que más tarda en volver a usarse. Si varias no vuelven, se desempata con FIFO, como en la práctica.',
        seg: 'El bit R se pone en 1 al cargar y en cada referencia, y solo lo borra el algoritmo.',
        reloj: 'El bit R se pone en 1 al cargar y en cada referencia, y solo lo borra el algoritmo. La manecilla arranca en el marco 1.',
      }[alg];
      corrida = null;
      const c = leerCadena(cCad.inp.value);
      const mm = leerMarcos(cMar.inp.value);
      cCad.inp.setAttribute('aria-invalid', String(!!c.error));
      cMar.inp.setAttribute('aria-invalid', String(!!mm.error));
      const msg = c.error || mm.error;
      pieza.mostrar(msg);
      if (msg) return;
      refs = c.refs;
      m = mm.m;
      corrida = reemplazar(refs, m, alg);
      const conR = alg === 'seg' || alg === 'reloj';
      cab = ['Referencia', ...refs];
      filas = Array.from({ length: m }, (_, j) => [`Marco ${j + 1}`, ...corrida.pasos.map((p) => {
        if (p.marcos[j] === null) return '';
        return `${alg === 'reloj' && p.mano === j ? '▸' : ''}${p.marcos[j]}${conR ? SUP[p.R[j]] : ''}`;
      })]);
      filas.push(['Fallo', ...corrida.pasos.map((p) => (p.fallo ? 'F' : ''))]);
      const tasa = corrida.fallos / refs.length;
      pieza.estado.textContent = `${ALG_P[alg]} con ${m} ${m === 1 ? 'marco' : 'marcos'}. ${corrida.fallos} ${corrida.fallos === 1 ? 'fallo' : 'fallos'} en ${refs.length} referencias.`;
      const otros = [m, m + 1].filter((x) => x <= MAX_MARCOS);
      compCab = ['Algoritmo', ...otros.map((x) => `Fallos con ${x} ${x === 1 ? 'marco' : 'marcos'}`)];
      comp = Object.keys(ALG_P).map((a) => [ALG_P[a], ...otros.map((x) => String(reemplazar(refs, x, a).fallos))]);
      const leyenda = ['F marca un fallo. En negrita, la página que se acaba de cargar.'];
      if (conR) leyenda.push('El número chico es el bit R.');
      if (alg === 'reloj') leyenda.push('▸ marca dónde queda la manecilla.');
      pieza.resultado.replaceChildren(
        tabla(ayuda, 'Los marcos después de cada referencia', cab, filas, (i, j) => i < m && corrida.pasos[j - 1].fallo && corrida.pasos[j - 1].donde === i),
        crear('p', { className: 'w-ayuda' }, leyenda.join(' ')),
        salidas(ayuda, [['Fallos de página', String(corrida.fallos)], ['Tasa de fallos', `${corrida.fallos} / ${refs.length} = ${f(tasa)}`]]),
        tabla(ayuda, 'Con la misma cadena, cada algoritmo', compCab, comp),
        pasoAPaso(ayuda, corrida.pasos.map((p, k) => `Referencia ${k + 1}, página ${p.p}. ${p.txt}`)),
      );
    };
    const cambio = () => {
      calcular();
      ayuda.guardarDatos({ cadena: cCad.inp.value, marcos: cMar.inp.value, alg: sAlg.sel.value });
    };
    cCad.inp.addEventListener('input', cambio);
    cMar.inp.addEventListener('input', cambio);
    sAlg.sel.addEventListener('change', cambio);
    calcular();
    const imagen = () => {
      if (!corrida) return Promise.resolve(null);
      const alg = sAlg.sel.value;
      return apilar(ayuda, null, [
        { texto: `Reemplazo de páginas con ${ALG_P[alg]} y ${m} ${m === 1 ? 'marco' : 'marcos'}`, negrita: true },
        { texto: `Cadena: ${refs.join(' ')}` },
        { cab, tabla: filas },
        { texto: `${alg === 'seg' || alg === 'reloj' ? 'El número chico es el bit R. ' : ''}${alg === 'reloj' ? '▸ marca dónde queda la manecilla. ' : ''}F marca un fallo.` },
        { texto: `${corrida.fallos} ${corrida.fallos === 1 ? 'fallo' : 'fallos'} de página. Tasa de fallos = ${corrida.fallos} / ${refs.length} = ${f(corrida.fallos / refs.length)}`, negrita: true },
        { cab: compCab, tabla: comp },
        { texto: 'Paso a paso', negrita: true },
        ...corrida.pasos.map((p, k) => ({ texto: `${k + 1}. Página ${p.p}. ${p.txt}` })),
      ]);
    };
    return { imagen };
  });

  // ----- Banquero y detección de interbloqueos
  // Ejemplo: la figura 6-7 del apunte (teoría 5c), con el máximo igual a C + R para que la necesidad sea su R.
  const EJ_BAN = { modo: 'seguro', segunda: 'max', vector: 'A', asig: '0 0 1 0\n2 0 0 1\n0 1 2 0', otra: '2 0 1 1\n3 0 1 1\n2 2 2 0', vec: '2 1 0 0' };
  UTN.interactivo('banquero', (figura, cfg, ayuda) => {
    const { crear } = ayuda;
    const sModo = elegir(ayuda, 'Qué querés saber', [['seguro', 'Si es seguro (banquero)'], ['deteccion', 'Si hay interbloqueo']], oEjemplo(cfg, 'modo', 10, EJ_BAN.modo, (v) => v === 'seguro' || v === 'deteccion'));
    const sSeg = elegir(ayuda, 'La segunda matriz es', [['max', 'El máximo'], ['nec', 'Lo que le falta']], oEjemplo(cfg, 'segunda', 4, EJ_BAN.segunda, (v) => v === 'max' || v === 'nec'));
    const sVec = elegir(ayuda, 'El vector es', [['A', 'Lo disponible (A)'], ['E', 'Lo que existe (E)']], oEjemplo(cfg, 'vector', 2, EJ_BAN.vector, (v) => v === 'A' || v === 'E'));
    const cC = campo(ayuda, 'Asignación (C)', oEjemplo(cfg, 'asig', 600, EJ_BAN.asig, (v) => !leerMatriz(v, '').error), 600, true);
    const cO = campo(ayuda, 'Máximo', oEjemplo(cfg, 'otra', 600, EJ_BAN.otra, (v) => !leerMatriz(v, '').error), 600, true);
    const cV = campo(ayuda, 'Disponible (A)', oEjemplo(cfg, 'vec', 120, EJ_BAN.vec, (v) => !leerLista(v, MAX_REC, '').error), 120);
    const volver = () => {
      sModo.sel.value = EJ_BAN.modo;
      sSeg.sel.value = EJ_BAN.segunda;
      sVec.sel.value = EJ_BAN.vector;
      cC.inp.value = EJ_BAN.asig;
      cO.inp.value = EJ_BAN.otra;
      cV.inp.value = EJ_BAN.vec;
      cambio();
    };
    const pieza = armazon(figura, ayuda, 'Tus datos', [
      crear('div', { className: 'w-entradas' }, sModo.fila, sSeg.fila, sVec.fila),
      crear('div', { className: 'w-entradas' }, cC.fila, cO.fila),
      cV.fila,
      crear('p', { className: 'w-ayuda' }, `Un renglón por proceso y un número por recurso, separados con espacios. Hasta ${MAX_PROC_B} procesos y ${MAX_REC} recursos. El ejemplo es la figura 6-7 del apunte. Para el banquero, su máximo es C + R.`),
    ], volver);
    let corrida = null;
    let partes = [];
    const calcular = () => {
      const seguro = sModo.sel.value === 'seguro';
      const conMax = seguro && sSeg.sel.value === 'max';
      sSeg.fila.hidden = !seguro;
      const nomO = seguro ? (conMax ? 'Máximo' : 'Necesidad (R)') : 'Peticiones (R)';
      const nomV = sVec.sel.value === 'A' ? 'Disponible (A)' : 'Existente (E)';
      const artO = seguro ? (conMax ? 'el máximo' : 'la necesidad') : 'las peticiones';
      const artV = `el vector ${sVec.sel.value}`;
      cO.etiqueta.textContent = nomO;
      cV.etiqueta.textContent = nomV;
      corrida = null;
      const c = leerMatriz(cC.inp.value, 'la asignación');
      const o = leerMatriz(cO.inp.value, artO);
      const v = leerLista(cV.inp.value, MAX_REC, artV);
      cC.inp.setAttribute('aria-invalid', String(!!c.error));
      cO.inp.setAttribute('aria-invalid', String(!!o.error));
      cV.inp.setAttribute('aria-invalid', String(!!v.error));
      let msg = c.error || o.error || v.error;
      if (!msg && !v.nums.length) msg = `Falta ${artV}.`;
      if (!msg && v.nums.some((x) => !Number.isInteger(x) || x < 0 || x > 99999)) msg = `En ${artV}, las cantidades son enteros de 0 a 99999.`;
      const C = c.M;
      const n = C ? C.length : 0;
      const m = C ? C[0].length : 0;
      if (!msg && o.M.length !== n) msg = `La asignación tiene ${n} renglones y ${artO} ${o.M.length}. Va uno por proceso en cada una.`;
      if (!msg && o.M[0].length !== m) msg = `La asignación tiene ${m} recursos por renglón y ${artO} ${o.M[0].length}.`;
      if (!msg && v.nums.length !== m) msg = `${mayus(artV)} tiene ${v.nums.length} números y hay ${m} recursos.`;
      let R = null;
      if (!msg && conMax) {
        for (let i = 0; i < n && !msg; i += 1) {
          const j = C[i].findIndex((x, jj) => x > o.M[i][jj]);
          if (j >= 0) msg = `P${i + 1} tiene asignado ${C[i][j]} del recurso ${j + 1} y su máximo es ${o.M[i][j]}. La asignación no puede pasar al máximo.`;
        }
        R = o.M.map((fila, i) => fila.map((x, j) => x - C[i][j]));
      } else if (!msg) R = o.M;
      let A = null;
      const lineas = [];
      if (!msg) {
        if (sVec.sel.value === 'E') {
          const usado = C[0].map((_, j) => C.reduce((s, fila) => s + fila[j], 0));
          A = v.nums.map((x, j) => x - usado[j]);
          const j = A.findIndex((x) => x < 0);
          if (j >= 0) msg = `Del recurso ${j + 1} hay asignados ${usado[j]} y existen ${v.nums[j]}. Lo asignado no puede pasar a lo que existe.`;
          else lineas.push(`A = E − suma de las filas de C = ${vec(v.nums)} − ${vec(usado)} = ${vec(A)}.`);
        } else A = v.nums;
      }
      pieza.mostrar(msg);
      if (msg) return;
      if (conMax) lineas.push('Necesidad R = máximo − asignación, fila por fila.');
      corrida = buscarSecuencia(C, R, A);
      const nom = (i) => `P${i + 1}`;
      const pasos = corrida.pasos.map((p) => {
        const verbo = seguro ? 'necesita' : 'pide';
        const no = p.revisados.map(({ i, falta }) => `${nom(i)} ${verbo} ${vec(R[i])} y no le alcanza, porque del recurso ${falta + 1} hay ${p.antes[falta]} y ${verbo} ${R[i][falta]}.`);
        if (p.e < 0) return [`Con A = ${vec(p.antes)}.`, ...no, 'Ninguno de los que quedan puede terminar.'].join(' ');
        return [`Con A = ${vec(p.antes)}.`, ...no, `${nom(p.e)} ${verbo} ${vec(R[p.e])}, que entra en A, así que puede terminar. Devuelve su fila de C y queda A = ${vec(p.antes)} + ${vec(C[p.e])} = ${vec(p.despues)}.`].join(' ');
      });
      const quedan = corrida.quedan.map(nom);
      const orden = corrida.orden.map(nom);
      let fin;
      if (seguro) {
        fin = quedan.length
          ? `El estado no es seguro. ${listaY(quedan)} no ${quedan.length === 1 ? 'puede' : 'pueden'} terminar con lo que queda, así que no hay secuencia segura.`
          : `El estado es seguro. Una secuencia segura es ${orden.join(', ')}.`;
      } else {
        fin = quedan.length
          ? `${listaY(quedan)} ${quedan.length === 1 ? 'está' : 'están'} en interbloqueo. Con lo disponible, ${quedan.length === 1 ? 'no puede' : 'ninguno puede'} seguir.`
          : `No hay interbloqueo. Pueden terminar todos, en el orden ${orden.join(', ')}.`;
      }
      pieza.estado.textContent = fin;
      const cabDatos = ['Proceso', 'Asignación C', ...(conMax ? ['Máximo', 'Necesidad R = máx − C'] : [nomO])];
      const filasDatos = C.map((fila, i) => [nom(i), fila.join(' '), ...(conMax ? [o.M[i].join(' '), R[i].join(' ')] : [R[i].join(' ')])]);
      const cabOrden = ['Paso', 'Termina', 'A antes', 'Devuelve', 'A después'];
      const filasOrden = corrida.pasos.filter((p) => p.e >= 0).map((p, k) => [String(k + 1), nom(p.e), vec(p.antes), vec(C[p.e]), vec(p.despues)]);
      pieza.resultado.replaceChildren(
        tabla(ayuda, 'Tus datos', cabDatos, filasDatos),
        ...lineas.map((t) => crear('p', { className: 'ps-resumen' }, t)),
        filasOrden.length ? tabla(ayuda, seguro ? 'Cómo se arma la secuencia' : 'Quiénes pueden terminar', cabOrden, filasOrden) : crear('p', {}, 'Ningún proceso puede terminar con lo que hay disponible.'),
        pasoAPaso(ayuda, pasos),
      );
      partes = [
        { texto: seguro ? 'Algoritmo del banquero: ¿el estado es seguro?' : 'Detección de interbloqueos con matrices', negrita: true },
        { cab: cabDatos, tabla: filasDatos },
        ...lineas.map((t) => ({ texto: t })),
        sVec.sel.value === 'A' ? { texto: `A = ${vec(A)}` } : null,
        filasOrden.length ? { cab: cabOrden, tabla: filasOrden } : null,
        { texto: fin, negrita: true },
        { texto: 'Paso a paso', negrita: true },
        ...pasos.map((t, k) => ({ texto: `${k + 1}. ${t}` })),
      ];
    };
    const cambio = () => {
      calcular();
      ayuda.guardarDatos({ modo: sModo.sel.value, segunda: sSeg.sel.value, vector: sVec.sel.value, asig: cC.inp.value, otra: cO.inp.value, vec: cV.inp.value });
    };
    [cC, cO, cV].forEach((c) => c.inp.addEventListener('input', cambio));
    [sModo, sSeg, sVec].forEach((c) => c.sel.addEventListener('change', cambio));
    calcular();
    return { imagen: () => (corrida ? apilar(ayuda, null, partes) : Promise.resolve(null)) };
  });
})();
