// Formula parser that never turns text into code: recursive descent to plain closures, as the site's CSP requires.
// Works as a classic script (window.UTN_EXPR) and from Node (the build validates with it).
(function (raiz) {
  'use strict';
  const MAX_LARGO = 1000;
  const MAX_PROFUNDIDAD = 48;

  class ErrorExpr extends Error {}
  const falla = (m) => {
    throw new ErrorExpr(m);
  };

  const CONSTANTES = new Map([['pi', Math.PI], ['e', Math.E]]);
  const log = (x, b) => (b === undefined ? Math.log10(x) : Math.log(x) / Math.log(b));
  // name: [min args, max args, function]
  const FUNCIONES = new Map([
    ...['sin', 'cos', 'tan', 'asin', 'acos', 'atan', 'sinh', 'cosh', 'tanh', 'sqrt', 'cbrt', 'abs', 'exp', 'floor', 'ceil', 'sign', 'log10'].map((n) => [n, [1, 1, Math[n]]]),
    ['ln', [1, 1, Math.log]],
    ['log', [1, 2, log]],
    ['pow', [2, 2, Math.pow]],
    ['min', [1, 16, Math.min]],
    ['max', [1, 16, Math.max]],
  ]);
  const PARECIDOS = new Map([['sen', 'sin'], ['tg', 'tan'], ['arcsen', 'asin'], ['arcsin', 'asin'], ['arccos', 'acos'], ['arctan', 'atan'], ['arctg', 'atan'], ['raiz', 'sqrt'], ['modulo', 'abs'], ['if', 'si']]);
  // Names that mean something on every JavaScript object: never variables, whatever the scope is.
  const PROHIBIDOS = /^(__.*|constructor|prototype|hasOwnProperty|isPrototypeOf|propertyIsEnumerable|toString|toLocaleString|valueOf)$/;

  const esReservado = (n) => CONSTANTES.has(n) || FUNCIONES.has(n) || n === 'si' || PROHIBIDOS.test(n);

  function tokens(src) {
    const out = [];
    let i = 0;
    while (i < src.length) {
      const c = src[i];
      if (/\s/.test(c)) {
        i += 1;
        continue;
      }
      const num = /^(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?/.exec(src.slice(i, i + 40));
      if (num) {
        out.push({ t: 'num', v: Number(num[0]), x: num[0], i });
        i += num[0].length;
        continue;
      }
      const id = /^[A-Za-z_][A-Za-z0-9_]*/.exec(src.slice(i, i + 40));
      if (id) {
        if (id[0].length >= 40) falla('Ese nombre es demasiado largo.');
        out.push({ t: 'id', x: id[0], i });
        i += id[0].length;
        continue;
      }
      const dos = src.slice(i, i + 2);
      if (['<=', '>=', '==', '!='].includes(dos)) {
        out.push({ t: 'op', x: dos, i });
        i += 2;
        continue;
      }
      if ('+-*/^()<>,'.includes(c)) {
        out.push({ t: 'op', x: c, i });
        i += 1;
        continue;
      }
      if (c === '=') falla('Para comparar usá «==», no «=».');
      if (c === '×' || c === '·') falla('Para multiplicar usá «*».');
      if (c === 'π') falla('Para el número pi escribí «pi».');
      if (c === '√') falla('Para la raíz escribí «sqrt(x)».');
      if (c === '−' || c === '–') falla('Para restar usá el guion común «-».');
      falla(`No entiendo el carácter «${c}».`);
    }
    return out;
  }

  /**
   * Parses and returns a function of one scope object. The result is always a number: a missing variable gives NaN.
   * `permitidas`, when given, is the list of variables the expression may use. Anything else is an error.
   */
  function compilar(fuente, permitidas) {
    if (typeof fuente === 'number') {
      const v = fuente;
      const f = () => v;
      f.vars = [];
      f.fuente = String(fuente);
      return f;
    }
    if (typeof fuente !== 'string') falla('La fórmula tiene que ser un texto.');
    if (!fuente.trim()) falla('La fórmula está vacía.');
    if (fuente.length > MAX_LARGO) falla(`La fórmula es demasiado larga (más de ${MAX_LARGO} caracteres).`);
    const lista = tokens(fuente);
    const usadas = new Set();
    const validas = permitidas ? new Set(permitidas) : null;
    let p = 0;
    let prof = 0;
    const ver = () => lista[p];
    const esOp = (x) => ver()?.t === 'op' && ver().x === x;
    const hondo = () => {
      prof += 1;
      if (prof > MAX_PROFUNDIDAD) falla('La fórmula tiene demasiados niveles anidados.');
    };

    const atomo = () => {
      const t = ver();
      if (!t) falla('La fórmula termina antes de tiempo: falta un valor al final.');
      if (t.t === 'num') {
        p += 1;
        const v = t.v;
        return () => v;
      }
      if (t.t === 'op' && t.x === '(') {
        p += 1;
        const dentro = comparar();
        if (!esOp(')')) falla('Falta cerrar un paréntesis.');
        p += 1;
        return dentro;
      }
      if (t.t === 'id') {
        p += 1;
        if (esOp('(')) return llamada(t.x);
        return nombre(t.x);
      }
      if (t.x === ')') falla('Sobra un paréntesis que cierra, o falta un valor antes de él.');
      if (t.x === ',') falla('Sobra una coma. Los decimales van con punto, como 3.5.');
      return falla(`Falta un valor antes de «${t.x}».`);
    };

    const nombre = (n) => {
      if (FUNCIONES.has(n)) falla(`«${n}» es una función: lleva paréntesis, como ${n}(x).`);
      if (n === 'si') falla('«si» se usa así: si(condición, a, b).');
      if (PROHIBIDOS.test(n)) falla(`«${n}» no se puede usar como nombre.`);
      if (CONSTANTES.has(n)) {
        const v = CONSTANTES.get(n);
        return () => v;
      }
      if (validas && !validas.has(n)) {
        const alt = PARECIDOS.get(n);
        const donde = validas.size ? `Acá se puede usar: ${[...validas].join(', ')}.` : 'Acá no se puede usar ninguna variable.';
        falla(alt ? `No conozco «${n}». Usá ${alt}.` : `No conozco la variable «${n}». ${donde}`);
      }
      usadas.add(n);
      return (s) => {
        const v = s ? s[n] : undefined;
        return typeof v === 'number' ? v : NaN;
      };
    };

    const llamada = (n) => {
      if (PROHIBIDOS.test(n)) falla(`«${n}» no se puede usar como nombre.`);
      p += 1;
      const args = [];
      if (!esOp(')')) {
        for (;;) {
          args.push(comparar());
          if (!esOp(',')) break;
          p += 1;
        }
      }
      if (!esOp(')')) falla(`Falta cerrar el paréntesis de ${n}(…).`);
      p += 1;
      if (n === 'si') {
        if (args.length !== 3) falla('«si» lleva tres partes: si(condición, a, b).');
        const [c, a, b] = args;
        return (s) => {
          const v = c(s);
          if (v !== v) return NaN;
          return v ? a(s) : b(s);
        };
      }
      const def = FUNCIONES.get(n);
      if (!def) {
        const alt = PARECIDOS.get(n);
        falla(alt ? `No conozco la función «${n}». Usá ${alt}.` : `No conozco la función «${n}». Si querías multiplicar, poné «*» antes del paréntesis.`);
      }
      const [min, max, fn] = def;
      if (args.length < min || args.length > max) falla(min === max ? `${n}(…) lleva ${min === 1 ? 'un valor' : `${min} valores`}.` : `${n}(…) lleva entre ${min} y ${max} valores.`);
      if (args.length === 1) {
        const [a] = args;
        return (s) => fn(a(s));
      }
      if (args.length === 2) {
        const [a, b] = args;
        return (s) => fn(a(s), b(s));
      }
      return (s) => fn(...args.map((a) => a(s)));
    };

    const potencia = () => {
      const base = atomo();
      if (!esOp('^')) return base;
      p += 1;
      hondo();
      const exp = unario();
      prof -= 1;
      return (s) => Math.pow(base(s), exp(s));
    };

    const unario = () => {
      if (esOp('-') || esOp('+')) {
        const menos = ver().x === '-';
        p += 1;
        hondo();
        const v = unario();
        prof -= 1;
        return menos ? (s) => -v(s) : v;
      }
      hondo();
      const v = potencia();
      prof -= 1;
      return v;
    };

    const faltaPor = (t) => t && (t.t === 'num' || t.t === 'id' || t.x === '(');
    const factor = () => {
      let a = unario();
      for (;;) {
        const t = ver();
        if (faltaPor(t)) {
          const antes = lista[p - 1];
          falla(`Falta un «*» entre «${antes.x}» y «${t.x}». La multiplicación se escribe siempre.`);
        }
        if (t?.t === 'op' && (t.x === '*' || t.x === '/')) {
          p += 1;
          if (esOp('*')) falla('Para la potencia usá «^», no «**».');
          const izq = a;
          const der = unario();
          a = t.x === '*' ? (s) => izq(s) * der(s) : (s) => izq(s) / der(s);
        } else return a;
      }
    };

    const suma = () => {
      let a = factor();
      while (esOp('+') || esOp('-')) {
        const mas = ver().x === '+';
        p += 1;
        const izq = a;
        const der = factor();
        a = mas ? (s) => izq(s) + der(s) : (s) => izq(s) - der(s);
      }
      return a;
    };

    const COMPARA = {
      '<': (a, b) => a < b,
      '<=': (a, b) => a <= b,
      '>': (a, b) => a > b,
      '>=': (a, b) => a >= b,
      '==': (a, b) => a === b,
      '!=': (a, b) => a !== b,
    };
    function comparar() {
      hondo();
      const a = suma();
      prof -= 1;
      const t = ver();
      if (t?.t !== 'op' || !Object.hasOwn(COMPARA, t.x)) return a;
      p += 1;
      const b = suma();
      const n = ver();
      if (n?.t === 'op' && Object.hasOwn(COMPARA, n.x)) falla('Las comparaciones no se encadenan. Usá si(…) una dentro de otra.');
      const cmp = COMPARA[t.x];
      return (s) => {
        const x = a(s);
        const y = b(s);
        if (x !== x || y !== y) return NaN;
        return cmp(x, y) ? 1 : 0;
      };
    }

    const raizArbol = comparar();
    if (p < lista.length) {
      const t = ver();
      if (t.x === ')') falla('Sobra un paréntesis que cierra.');
      if (t.x === ',') falla('Sobra una coma. Los decimales van con punto, como 3.5.');
      falla(`No entiendo lo que sigue a partir de «${t.x}».`);
    }
    const f = (s) => raizArbol(s);
    f.vars = [...usadas];
    f.fuente = fuente;
    return f;
  }

  const evaluar = (fuente, vars = {}) => compilar(fuente, Object.keys(vars))(vars);
  /** The error message in words, or null when the formula is fine. */
  const revisar = (fuente, permitidas) => {
    try {
      compilar(fuente, permitidas);
      return null;
    } catch (e) {
      if (e instanceof ErrorExpr) return e.message;
      throw e;
    }
  };

  const API = { compilar, evaluar, revisar, esReservado, ErrorExpr };
  if (typeof module === 'object' && module.exports) module.exports = API;
  else raiz.UTN_EXPR = API;
})(typeof globalThis === 'object' ? globalThis : this);
