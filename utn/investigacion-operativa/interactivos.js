// Calculator with empty fields: the student types every value. :::calculadora requires a preloaded number,
// so this subject uses this instead. Shows results only, never a procedure.
let calculadorasVacias = 0;

// The models a person's own summary offers, when its piece brings no fields of its own.
// Same fields and formulas as the blocks of parcial-3.md and emergencia.md: change both together.
const MODELOS_STOCK = {
  basico: {
    t: 'Modelo básico',
    nota: 'Demanda, tasa y plazo van en la misma unidad de tiempo.',
    entradas: [{ id: 'dem', etq: 'Demanda D', min: 0 }, { id: 'fijo', etq: 'Costo fijo L', unidad: '$', min: 0 }, { id: 'costo', etq: 'Costo unitario C', unidad: '$', min: 0 }, { id: 'tasa', etq: 'Tasa i', min: 0 }, { id: 'plazo', etq: 'Plazo LT', min: 0 }],
    salidas: [
      { etq: 'Lote óptimo Q*', f: 'sqrt(2*dem*fijo/(costo*tasa))', unidad: 'unidades', dec: 0 },
      { etq: 'CT(Q*)', f: 'costo+fijo/sqrt(2*dem*fijo/(costo*tasa))+costo*tasa*sqrt(2*dem*fijo/(costo*tasa))/(2*dem)', unidad: '$/unidad', dec: 3 },
      { etq: 'Período T*', f: 'sqrt(2*dem*fijo/(costo*tasa))/dem', dec: 2 },
      { etq: 'Punto de pedido PP', f: 'dem*plazo', unidad: 'unidades', dec: 0 },
    ],
  },
  ingreso: {
    t: 'Consumo durante el ingreso',
    nota: 'V tiene que ser mayor que D. Probá acercar V a D y mirá cómo crece el lote.',
    entradas: [{ id: 'dem', etq: 'Demanda D', min: 0 }, { id: 'vel', etq: 'Velocidad de ingreso V', min: 0 }, { id: 'fijo', etq: 'Costo fijo L', unidad: '$', min: 0 }, { id: 'costo', etq: 'Costo unitario C', unidad: '$', min: 0 }, { id: 'tasa', etq: 'Tasa i', min: 0 }],
    salidas: [
      { etq: 'Lote óptimo Q*', f: 'sqrt(2*dem*fijo/(costo*tasa*(1-dem/vel)))', unidad: 'unidades', dec: 0 },
      { etq: 'Existencia máxima M', f: 'sqrt(2*dem*fijo/(costo*tasa*(1-dem/vel)))*(1-dem/vel)', unidad: 'unidades', dec: 0 },
    ],
  },
  escalon: {
    t: 'Descuento por cantidad, un escalón',
    nota: 'La decisión sigue la regla del apunte, págs. 18 y 19, y queda a tu cargo.',
    entradas: [{ id: 'dem', etq: 'Demanda D', min: 0 }, { id: 'fijo', etq: 'Costo fijo L', unidad: '$', min: 0 }, { id: 'tasa', etq: 'Tasa i', min: 0 }, { id: 'c1', etq: 'Precio C1', unidad: '$', min: 0 }, { id: 'c2', etq: 'Precio C2', unidad: '$', min: 0 }, { id: 'quiebre', etq: 'Cantidad a', min: 0 }],
    salidas: [
      { etq: 'Q1*', f: 'sqrt(2*dem*fijo/(c1*tasa))', unidad: 'unidades', dec: 0 },
      { etq: 'Q2*', f: 'sqrt(2*dem*fijo/(c2*tasa))', unidad: 'unidades', dec: 0 },
      { etq: 'CT1(Q1*)', f: 'c1+fijo/sqrt(2*dem*fijo/(c1*tasa))+c1*tasa*sqrt(2*dem*fijo/(c1*tasa))/(2*dem)', unidad: '$/unidad', dec: 2 },
      { etq: 'CT2(a)', f: 'c2+fijo/quiebre+c2*tasa*quiebre/(2*dem)', unidad: '$/unidad', dec: 2 },
    ],
  },
  excedente: {
    t: 'Descuento sobre la cantidad excedente',
    nota: 'La tabla de casos del apunte, págs. 22 y 23, dice cuál mirar.',
    entradas: [{ id: 'dem', etq: 'Demanda D', min: 0 }, { id: 'fijo', etq: 'Costo fijo L', unidad: '$', min: 0 }, { id: 'tasa', etq: 'Tasa i', min: 0 }, { id: 'c1', etq: 'Precio C1', unidad: '$', min: 0 }, { id: 'c2', etq: 'Precio C2', unidad: '$', min: 0 }, { id: 'quiebre', etq: 'Cantidad a', min: 0 }],
    salidas: [
      { etq: 'k', f: '((c1-c2)*quiebre)', unidad: '$', dec: 0 },
      { etq: 'Q1*', f: 'sqrt(2*dem*fijo/(c1*tasa))', dec: 2 },
      { etq: 'Q2*', f: 'sqrt(2*dem*(fijo+((c1-c2)*quiebre))/(c2*tasa))', dec: 2 },
      { etq: 'CT1(Q1*)', f: 'c1+fijo/sqrt(2*dem*fijo/(c1*tasa))+c1*tasa*sqrt(2*dem*fijo/(c1*tasa))/(2*dem)', unidad: '$/unidad', dec: 2 },
      { etq: 'CT2(Q2*)', f: 'c2+((c1-c2)*quiebre)*tasa/(2*dem)+(fijo+((c1-c2)*quiebre))/sqrt(2*dem*(fijo+((c1-c2)*quiebre))/(c2*tasa))+c2*tasa*sqrt(2*dem*(fijo+((c1-c2)*quiebre))/(c2*tasa))/(2*dem)', unidad: '$/unidad', dec: 2 },
    ],
  },
  periodo: {
    t: 'Período común para varios artículos',
    entradas: [{ id: 'sumac', etq: 'C, suma de Cj·Dj', unidad: '$', min: 0 }, { id: 'fijo', etq: 'L, suma de Lj', unidad: '$', min: 0 }, { id: 'sumas', etq: 'S, suma de δj·Dj', min: 0 }, { id: 'elegido', etq: 'Período que querés probar', min: 0 }],
    salidas: [
      { etq: 'T*', f: 'sqrt(2*fijo/sumas)', dec: 2 },
      { etq: 'CT(T*)', f: 'sumac+fijo/sqrt(2*fijo/sumas)+sumas*sqrt(2*fijo/sumas)/2', dec: 2 },
      { etq: 'CT del período elegido', f: 'sumac+fijo/elegido+sumas*elegido/2', dec: 2 },
    ],
  },
  lambda: {
    t: 'Restricción financiera, con dos artículos',
    nota: 'Compará la inversión media con tu tope. Si redondeás los lotes, como el apunte, las últimas cifras cambian.',
    entradas: [{ id: 'tasa', etq: 'Tasa i', min: 0 }, { id: 'lam', etq: 'Lambda', min: 0 }, { id: 'd1', etq: 'Demanda D1', min: 0 }, { id: 'l1', etq: 'Costo fijo L1', unidad: '$', min: 0 }, { id: 'c1', etq: 'Costo C1', unidad: '$', min: 0 }, { id: 'd2', etq: 'Demanda D2', min: 0 }, { id: 'l2', etq: 'Costo fijo L2', unidad: '$', min: 0 }, { id: 'c2', etq: 'Costo C2', unidad: '$', min: 0 }],
    salidas: [
      { etq: 'Q1', f: 'sqrt(2*d1*l1/(c1*(tasa+lam)))', unidad: 'unidades', dec: 0 },
      { etq: 'Q2', f: 'sqrt(2*d2*l2/(c2*(tasa+lam)))', unidad: 'unidades', dec: 0 },
      { etq: 'Inversión media I', f: 'c1*sqrt(2*d1*l1/(c1*(tasa+lam)))/2+c2*sqrt(2*d2*l2/(c2*(tasa+lam)))/2', unidad: '$', dec: 0 },
    ],
  },
  seguridad: {
    t: 'Stock de seguridad, con plazo constante',
    nota: 'El factor de seguridad sale de la tabla de la pág. 49 del apunte.',
    entradas: [{ id: 'media', etq: 'Demanda media por período', min: 0 }, { id: 'desvio', etq: 'Desvío por período', min: 0 }, { id: 'plazo', etq: 'Plazo LT en períodos', min: 0 }, { id: 'fs', etq: 'Factor de seguridad', min: 0 }],
    salidas: [
      { etq: 'Desvío durante el plazo', f: 'sqrt(plazo)*desvio', dec: 2 },
      { etq: 'Stock de seguridad', f: 'fs*sqrt(plazo)*desvio', dec: 2 },
      { etq: 'Punto de pedido', f: 'media*plazo+fs*sqrt(plazo)*desvio', dec: 2 },
    ],
  },
};

UTN.interactivo('calculadora-vacia', (figura, cfg, ayuda) => {
  const { crear, lienzo, expr, numero } = ayuda;
  const base = `calc-vacia-${(calculadorasVacias += 1)}`;
  // In a person's summary the fields come back as they were left (cfg.datos, untrusted: strings within a cap only).
  const enResumen = ayuda.enResumen ?? figura.classList.contains('ag-pieza');
  const TOPE = 40;
  const datos = cfg.datos && typeof cfg.datos === 'object' && !Array.isArray(cfg.datos) ? cfg.datos : {};
  const guardado = (k) => (Object.prototype.hasOwnProperty.call(datos, k) && typeof datos[k] === 'string' && datos[k].length <= TOPE ? datos[k] : undefined);
  // A piece without fields of its own lets the student choose one of the notes' models.
  const conModelos = enResumen && !Array.isArray(cfg.entradas);
  let modelo = conModelos && Object.prototype.hasOwnProperty.call(MODELOS_STOCK, guardado('modelo')) ? guardado('modelo') : 'basico';
  // What the student typed, by field: a field with the same name keeps its value when the model changes.
  const escrito = {};

  const leer = (texto) => {
    const t = texto.trim().replace('−', '-');
    if (!t) return { falta: true };
    const conPunto = /^[+-]?\d+,\d+$/.test(t) ? t.replace(',', '.') : t;
    try {
      const v = expr.evaluar(conPunto);
      return Number.isFinite(v) ? { v } : { mal: true };
    } catch {
      return { mal: true };
    }
  };

  let entradas = [];
  let salidas = [];
  let nota = '';
  let vuelta = 0;
  const guardar = () => {
    if (!enResumen) return;
    entradas.forEach((en) => { escrito[en.id] = en.inp.value; });
    ayuda.guardarDatos?.({ ...(conModelos ? { modelo } : {}), ...Object.fromEntries(entradas.map((en) => [en.id, en.inp.value])) });
  };

  const armar = (conf) => {
    vuelta += 1;
    entradas = conf.entradas.map((en, i) => {
      const id = vuelta === 1 ? `${base}-${i}` : `${base}-${vuelta}-${i}`;
      const inp = crear('input', { id, type: 'text', inputMode: 'decimal', autocomplete: 'off', spellcheck: false, value: escrito[en.id] ?? guardado(en.id) ?? '', maxLength: enResumen ? TOPE : undefined });
      const err = crear('p', { className: 'w-error', id: `${id}e`, hidden: true });
      inp.setAttribute('aria-describedby', err.id);
      const fila = crear('div', { className: 'w-entrada' },
        crear('label', { htmlFor: id }, en.etq),
        crear('div', { className: 'w-con-unidad' }, inp, en.unidad ? crear('span', { className: 'w-unidad' }, en.unidad) : null),
        err);
      return { ...en, inp, err, fila };
    });
    const ids = entradas.map((e) => e.id);
    const vistas = [];
    salidas = conf.salidas.map((s) => {
      const val = crear('dd', {});
      vistas.push(crear('dt', {}, s.etq), val);
      return { ...s, f: expr.compilar(s.f, ids), val };
    });
    entradas.forEach((en) => en.inp.addEventListener('input', () => {
      calcular();
      guardar();
    }));
    nota = `${conf.nota ? `${conf.nota} ` : ''}Sirve para chequear un resultado. En el examen va el desarrollo que pide la cátedra.`;
    return [
      crear('div', { className: 'w-entradas' }, ...entradas.map((e) => e.fila)),
      crear('dl', { className: 'w-salidas', 'aria-live': 'polite' }, ...vistas),
      crear('p', { className: 'w-nota' }, nota),
    ];
  };

  const avisar = (s, texto, esError) => {
    s.val.textContent = texto;
    s.val.classList.add('w-sin-valor');
    s.val.style.color = esError ? '' : 'var(--tinta-suave)';
  };

  const calcular = () => {
    const esc = Object.create(null);
    let faltan = false;
    let hayMal = false;
    entradas.forEach((en) => {
      const r = leer(en.inp.value);
      let msg = '';
      if (r.falta) faltan = true;
      else if (r.mal) msg = 'Esto no es un número. Escribilo como 3,5.';
      else if (en.min !== undefined && r.v < en.min) msg = `Tiene que ser ${numero(en.min)} o más.`;
      else if (en.max !== undefined && r.v > en.max) msg = `Tiene que ser ${numero(en.max)} o menos.`;
      en.err.textContent = msg;
      en.err.hidden = !msg;
      en.inp.setAttribute('aria-invalid', String(Boolean(msg)));
      if (msg) hayMal = true;
      else if (!r.falta) esc[en.id] = r.v;
    });
    salidas.forEach((s) => {
      s.val.classList.remove('w-sin-valor');
      s.val.style.color = '';
      if (hayMal) return avisar(s, 'Corregí los valores de arriba.', true);
      if (faltan) return avisar(s, 'Faltan valores.', false);
      const v = s.f(esc);
      if (Number.isFinite(v)) {
        s.val.textContent = `${numero(v, s.dec)}${s.unidad ? ` ${s.unidad}` : ''}`;
        return undefined;
      }
      return avisar(s, Number.isNaN(v) ? 'Con estos valores no da un número real.' : 'Con estos valores da infinito: revisá si hay una división por cero.', true);
    });
  };

  if (conModelos) {
    const cuerpo = crear('div', {});
    const idSel = `${base}-modelo`;
    const sel = crear('select', { id: idSel }, ...Object.entries(MODELOS_STOCK).map(([v, m]) => crear('option', { value: v, selected: v === modelo }, m.t)));
    sel.style.maxWidth = '100%';
    sel.addEventListener('change', () => {
      entradas.forEach((en) => { escrito[en.id] = en.inp.value; });
      modelo = sel.value;
      cuerpo.replaceChildren(...armar(MODELOS_STOCK[modelo]));
      calcular();
      guardar();
    });
    cuerpo.append(...armar(MODELOS_STOCK[modelo]));
    const elegir = crear('div', { className: 'w-entrada' }, crear('label', { htmlFor: idSel }, 'Modelo del apunte de Gestión de Stocks'), sel);
    elegir.style.marginBottom = '.9rem';
    lienzo.append(elegir, cuerpo);
  } else {
    lienzo.append(...armar(cfg));
  }
  calcular();

  // Picture for the summary, as text and tables like the other pieces: the model, what was typed and what came out.
  const imagen = () => (ayuda.pngTablas
    ? ayuda.pngTablas([
        ...(conModelos ? [{ texto: MODELOS_STOCK[modelo].t, negrita: true }] : []),
        { cab: ['Dato', 'Valor'], tabla: entradas.map((en) => [en.etq, en.inp.value.trim() ? `${en.inp.value.trim()}${en.unidad ? ` ${en.unidad}` : ''}` : 'sin completar']) },
        { cab: ['Resultado', 'Valor'], tabla: salidas.map((s) => [s.etq, s.val.textContent]), resaltar: 1 },
      ])
    : null);
  return { imagen };
});

