// Step-by-step binary search over a sorted array. On the subject's pages, teaching data only, never exam data.
// In a person's own summary (ayuda.enResumen) the student types the array and the key, and sees every step.
(() => {
  // cfg.datos is untrusted: only known keys with a string within its cap.
  const leerDatos = (cfg) => {
    const d = cfg && cfg.datos && typeof cfg.datos === 'object' && !Array.isArray(cfg.datos) ? cfg.datos : {};
    return (k, def, tope = 40) => (Object.prototype.hasOwnProperty.call(d, k) && typeof d[k] === 'string' && d[k].length <= tope ? d[k] : def);
  };
  const TOPE_ARREGLO = 600;
  const MAX_ELEMENTOS = 64;
  const NUM = /^[+-]?\d+(\.\d+)?$/;
  const NUM_COMA = /^[+-]?\d+(,\d+)?$/;

  /** The array as typed: numbers or names, split by semicolons, commas or spaces (in that order of preference). */
  function leerArreglo(texto) {
    const t = String(texto).trim();
    if (!t) return { error: 'Escribí el arreglo.' };
    const conPuntoYComa = t.includes(';');
    const partes = (conPuntoYComa ? t.split(';') : t.includes(',') ? t.split(',') : t.split(/\s+/)).map((p) => p.trim());
    if (partes.some((p) => !p)) return { error: 'Hay un lugar vacío entre dos separadores.' };
    if (partes.length > MAX_ELEMENTOS) return { error: `Son ${partes.length} elementos: hasta ${MAX_ELEMENTOS}.` };
    const numeros = partes.every((p) => NUM.test(p) || (conPuntoYComa && NUM_COMA.test(p)));
    return { numeros, v: numeros ? partes.map((p) => Number(p.replace(',', '.'))) : partes };
  }

  function dicotomicaPropia(figura, cfg, ayuda) {
    const { crear, lienzo, numero } = ayuda;
    const g = leerDatos(cfg);
    let n = 0;
    const id = () => `dico-p${Math.random().toString(36).slice(2, 7)}${(n += 1)}`;
    const campo = (etq, valor, tope) => {
      const i = id();
      const inp = crear('input', { id: i, type: 'text', autocomplete: 'off', spellcheck: false, value: valor, maxLength: tope });
      inp.style.width = '100%';
      inp.style.boxSizing = 'border-box';
      return { inp, fila: crear('div', { className: 'w-entrada' }, crear('label', { htmlFor: i }, etq), inp) };
    };
    const elegir = (etq, opciones, actual) => {
      const i = id();
      const sel = crear('select', { id: i }, ...opciones.map(([v, t]) => crear('option', { value: v, selected: v === actual }, t)));
      sel.style.maxWidth = '100%';
      return { sel, fila: crear('div', { className: 'w-fila' }, crear('span', { className: 'w-campo' }, crear('label', { htmlFor: i }, etq), sel)) };
    };
    const cV = campo('Arreglo, ordenado de menor a mayor', g('valores', '3, 7, 12, 18, 21, 25, 30, 34, 41, 47, 52, 58, 63, 70, 76', TOPE_ARREGLO), TOPE_ARREGLO);
    const cD = campo('Dato a buscar', g('dato', '47', 80), 80);
    const base = elegir('Las posiciones arrancan en', [['0', '0'], ['1', '1']], g('base', '0', 1) === '1' ? '1' : '0');
    const ver = elegir('Ver el paso', [['0', '1']], '0');
    let verGuardado = g('paso', '0', 4);
    const ayudaTexto = crear('p', { className: 'w-ayuda' }, 'Separá los elementos con coma o espacio; los decimales, con punto (o separá con punto y coma y usá la coma). También pueden ser nombres, separados por coma.');
    const error = crear('p', { className: 'w-error', role: 'status' });
    const arreglo = crear('div', {});
    arreglo.style.overflowX = 'auto';
    const titular = crear('p', { className: 'w-titular', 'aria-live': 'polite' });
    const pasos = crear('div', { className: 'w-tabla-v' });
    let corrida = null;

    const muestra = (x, numeros) => (numeros ? numero(x) : `«${x}»`);
    const leer = () => {
      const a = leerArreglo(cV.inp.value);
      if (a.error) return a;
      const { v, numeros } = a;
      const crudo = cD.inp.value.trim();
      if (!crudo) return { error: 'Escribí el dato a buscar.' };
      let dato = crudo;
      if (numeros) {
        if (!NUM.test(crudo) && !NUM_COMA.test(crudo)) return { error: 'El arreglo es de números: el dato también tiene que ser un número.' };
        dato = Number(crudo.replace(',', '.'));
      }
      const b = Number(base.sel.value);
      for (let i = 0; i + 1 < v.length; i += 1) {
        if (v[i] > v[i + 1]) return { error: `No está ordenado: V[${i + b}] = ${muestra(v[i], numeros)} va antes que V[${i + 1 + b}] = ${muestra(v[i + 1], numeros)}. La búsqueda dicotómica necesita el arreglo ordenado de menor a mayor.` };
      }
      const filas = [];
      const estados = [];
      let comienzo = b;
      let fin = v.length - 1 + b;
      let hallado = -1;
      while (comienzo <= fin) {
        const medio = Math.floor((comienzo + fin) / 2);
        const m = v[medio - b];
        const fila = [String(filas.length + 1), String(comienzo), String(fin), `(${comienzo} + ${fin}) DIV 2 = ${medio}`, muestra(m, numeros)];
        estados.push({ comienzo, fin, medio });
        if (m === dato) {
          filas.push([...fila, 'Es el dato', `Lo encontró en la posición ${medio}`]);
          hallado = medio;
          break;
        }
        if (dato < m) {
          filas.push([...fila, numeros ? `${numero(dato)} < ${numero(m)}` : `${muestra(dato, false)} va antes`, `fin = ${medio} - 1 = ${medio - 1}`]);
          fin = medio - 1;
        } else {
          filas.push([...fila, numeros ? `${numero(dato)} > ${numero(m)}` : `${muestra(dato, false)} va después`, `comienzo = ${medio} + 1 = ${medio + 1}`]);
          comienzo = medio + 1;
        }
      }
      if (hallado < 0) {
        filas.push([String(filas.length + 1), String(comienzo), String(fin), '', '', 'comienzo > fin', 'No está: devuelve -1']);
        estados.push({ comienzo, fin, medio: null });
      }
      const k = filas.length - (hallado < 0 ? 1 : 0);
      const veces = k === 1 ? 'una comparación' : `${k} comparaciones`;
      const tit = hallado < 0
        ? `${muestra(dato, numeros)} no está en el arreglo: después de ${veces}, comienzo = ${comienzo} quedó mayor que fin = ${fin} y la función devuelve -1.`
        : `${muestra(dato, numeros)} está en la posición ${hallado}. ${k === 1 ? 'Hizo' : 'Hicieron'} falta ${veces}, y una búsqueda secuencial habría hecho ${v.indexOf(dato) + 1}.`;
      return { v, numeros, b, filas, estados, hallado, titular: tit };
    };

    const pintarArreglo = () => {
      if (!corrida || corrida.error) {
        arreglo.replaceChildren();
        return;
      }
      const { v, b, estados } = corrida;
      const e = estados[Math.min(Number(ver.sel.value) || 0, estados.length - 1)];
      const celdas = v.map((x, i) => {
        const p = i + b;
        const c = crear('td', {}, corrida.numeros ? numero(x) : x);
        const adentro = p >= e.comienzo && p <= e.fin;
        c.style.opacity = adentro ? '1' : '0.35';
        c.style.fontWeight = p === e.medio ? '700' : '400';
        c.style.outline = p === e.medio ? '2px solid var(--tinta)' : 'none';
        c.style.textDecoration = adentro ? 'none' : 'line-through';
        return c;
      });
      arreglo.replaceChildren(crear('table', {},
        crear('caption', {}, `Paso ${Number(ver.sel.value) + 1}: lo tachado ya se descartó y el recuadro es el medio`),
        crear('thead', {}, crear('tr', {}, ...v.map((_, i) => crear('th', { scope: 'col' }, String(i + b))))),
        crear('tbody', {}, crear('tr', {}, ...celdas))));
    };

    const calcular = () => {
      corrida = leer();
      error.textContent = corrida.error || '';
      error.hidden = !corrida.error;
      titular.textContent = corrida.error ? '' : corrida.titular;
      const cuantos = corrida.error ? 1 : corrida.estados.length;
      const actual = verGuardado ?? ver.sel.value;
      verGuardado = null;
      ver.sel.replaceChildren(...Array.from({ length: cuantos }, (_, k) => crear('option', { value: String(k) }, String(k + 1))));
      ver.sel.value = String(Math.min(Number(actual) || 0, cuantos - 1));
      ver.fila.hidden = Boolean(corrida.error) || cuantos < 2;
      pasos.replaceChildren(...(corrida.error ? [] : [crear('table', {},
        crear('thead', {}, crear('tr', {}, ...CAB.map((c) => crear('th', { scope: 'col' }, c)))),
        crear('tbody', {}, ...corrida.filas.map((f) => crear('tr', {}, ...f.map((c) => crear('td', {}, c))))))]));
      pintarArreglo();
    };
    const CAB = ['Paso', 'comienzo', 'fin', 'medio', 'V[medio]', 'Comparación', 'Entonces'];
    const datos = () => ({ valores: cV.inp.value, dato: cD.inp.value, base: base.sel.value, paso: ver.sel.value });
    const cambio = () => {
      calcular();
      ayuda.guardarDatos?.(datos());
    };
    cV.inp.addEventListener('input', cambio);
    cD.inp.addEventListener('input', cambio);
    base.sel.addEventListener('change', cambio);
    ver.sel.addEventListener('change', () => {
      pintarArreglo();
      ayuda.guardarDatos?.(datos());
    });

    lienzo.append(cV.fila, ayudaTexto, crear('div', { className: 'w-entradas' }, cD.fila, base.fila), error, arreglo, ver.fila, titular, pasos);
    calcular();

    const imagen = () => {
      if (!corrida || corrida.error || !ayuda.pngTablas) return Promise.resolve(null);
      const { v, b, hallado } = corrida;
      return ayuda.pngTablas([
        { texto: `Búsqueda dicotómica de ${muestra(corrida.numeros ? Number(cD.inp.value.trim().replace(',', '.')) : cD.inp.value.trim(), corrida.numeros)}`, negrita: true },
        { cab: v.map((_, i) => String(i + b)), tabla: [v.map((x) => (corrida.numeros ? numero(x) : x))], resaltar: hallado < 0 ? undefined : hallado - b },
        { cab: CAB, tabla: corrida.filas },
        { texto: corrida.titular },
      ]);
    };
    return { imagen };
  }

  UTN.interactivo('dicotomica', (figura, cfg, ayuda) => {
    if (ayuda.enResumen ?? figura.classList.contains('ag-pieza')) return dicotomicaPropia(figura, cfg, ayuda);
    const { crear, lienzo, boton } = ayuda;
    const v = cfg.valores;
    let dato = cfg.dato;
    let comienzo;
    let fin;
    let medio;
    let termino;

    const celdas = v.map((n) => crear('td', {}, String(n)));
    const indices = v.map((_, i) => crear('th', { scope: 'col' }, String(i)));
    const tabla = crear('table', {},
      crear('caption', {}, 'Arreglo ordenado, con su índice arriba'),
      crear('thead', {}, crear('tr', {}, ...indices)),
      crear('tbody', {}, crear('tr', {}, ...celdas)));
    const marco = crear('div', {}, tabla);
    marco.style.overflowX = 'auto';
    const estado = crear('p', { role: 'status' }, '');

    const pintar = () => {
      celdas.forEach((c, i) => {
        const adentro = i >= comienzo && i <= fin;
        c.style.opacity = adentro ? '1' : '0.35';
        c.style.fontWeight = i === medio ? '700' : '400';
        c.style.outline = i === medio ? '2px solid var(--tinta)' : 'none';
        c.style.textDecoration = adentro ? 'none' : 'line-through';
      });
    };

    const empezar = () => {
      comienzo = 0;
      fin = v.length - 1;
      medio = -1;
      termino = false;
      estado.textContent = `Buscás el ${dato}. comienzo = 0, fin = ${fin}. Tocá «Un paso».`;
      pintar();
    };

    const paso = () => {
      if (termino) return;
      if (comienzo > fin) {
        termino = true;
        medio = -1;
        estado.textContent = `comienzo > fin, así que el ${dato} no está. La función devuelve -1.`;
        pintar();
        return;
      }
      medio = Math.floor((comienzo + fin) / 2);
      const m = v[medio];
      let texto = `medio = (${comienzo} + ${fin}) DIV 2 = ${medio}, y V[${medio}] = ${m}. `;
      if (m === dato) {
        termino = true;
        texto += `Lo encontró en la posición ${medio}.`;
        estado.textContent = texto;
        pintar();
        return;
      }
      if (dato < m) {
        texto += `${dato} es menor, así que fin = ${medio - 1}.`;
        estado.textContent = texto;
        fin = medio - 1;
        pintar();
      } else {
        texto += `${dato} es mayor, así que comienzo = ${medio + 1}.`;
        estado.textContent = texto;
        comienzo = medio + 1;
        pintar();
      }
    };

    const idEntrada = `dico-${Math.random().toString(36).slice(2, 8)}`;
    const entrada = crear('input', { type: 'number', id: idEntrada, value: String(dato) });
    entrada.addEventListener('change', () => {
      const n = Number(entrada.value);
      if (Number.isFinite(n)) {
        dato = n;
        empezar();
      }
    });

    lienzo.append(
      marco,
      crear('p', {}, crear('label', { htmlFor: idEntrada }, 'Dato a buscar '), entrada),
      crear('div', { className: 'w-botones' }, boton('Un paso', paso), boton('Empezar de nuevo', empezar)),
      estado,
    );
    empezar();
  });
})();
