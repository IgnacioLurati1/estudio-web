// The PDF page of a subject. Once the fonts, the pictures and the figures are ready it says which figures go as words
// on paper and opens the print window once. The button opens it again.
(() => {
  const boton = document.getElementById('pdfGuardar');
  const estado = document.getElementById('pdfEstado');
  if (!boton) return;
  const plazo = (ms) => new Promise((r) => {
    setTimeout(r, ms);
  });
  const imagenes = () => Promise.all([...document.images].map((i) => (i.complete ? null : i.decode().catch(() => null))));
  const figuras = () => window.UTN?.figurasListas || null;
  const CAMPOS = 'input[type="text"], textarea';

  const linea = (f, texto) => {
    const p = document.createElement('p');
    p.className = 'w-en-la-web';
    p.textContent = texto;
    f.querySelector('.w-desc')?.before(p);
  };
  // A figure that could not be drawn, or that starts empty waiting for data, goes as its description and a line that
  // sends to the web.
  const marcar = () => {
    document.querySelectorAll('figure.w').forEach((f) => {
      const lienzo = f.querySelector('.w-lienzo');
      const campos = [...(lienzo?.querySelectorAll(CAMPOS) || [])];
      if (campos.length && campos.every((c) => !c.value.trim())) {
        f.classList.add('w-palabras');
        linea(f, 'En la web esta calculadora se usa con tus datos. Acá va contada con palabras.');
        return;
      }
      const dibujada = f.dataset.w === 'grafico3d' ? f.dataset.wEstado === 'foto' : f.dataset.wEstado === 'listo' && lienzo?.offsetHeight > 8;
      if (dibujada) {
        f.classList.add('w-papel');
        return;
      }
      f.classList.add('w-palabras');
      linea(f, 'En la web esta figura se puede mover. Acá va contada con palabras.');
    });
  };

  // On paper a field shows its whole value, wrapped if it is long. It is copied again right before printing.
  const copiarValores = () => {
    document.querySelectorAll(`figure.w-papel :is(${CAMPOS})`).forEach((c) => {
      let s = c.nextElementSibling;
      if (!s?.classList.contains('w-valor-papel')) {
        s = document.createElement('span');
        s.className = 'w-valor-papel';
        s.setAttribute('aria-hidden', 'true');
        c.after(s);
      }
      s.textContent = c.value;
    });
  };
  window.addEventListener('beforeprint', copiarValores);

  // A formula wider than the printed column goes smaller on paper, down to 80 %; past that it breaks into lines (pdf.css).
  // Otherwise the browser shrinks every page to fit it. It is measured on screen with the paper's letter size
  // (`pdf-midiendo` in pdf.css), all in one go, so nothing flickers. The column is A4 minus the margins of pdf.css.
  const ajustarFormulas = () => {
    const hoja = document.querySelector('.pdf-hoja');
    if (!hoja) return;
    const raiz = document.documentElement;
    const regla = document.createElement('div');
    regla.style.position = 'absolute';
    regla.style.visibility = 'hidden';
    regla.style.width = '180mm';
    document.body.append(regla);
    const papel = regla.getBoundingClientRect().width;
    regla.remove();
    raiz.classList.add('pdf-midiendo');
    const c = getComputedStyle(hoja);
    const pantalla = hoja.clientWidth - parseFloat(c.paddingLeft) - parseFloat(c.paddingRight);
    const formulas = [...document.querySelectorAll('.pdf-hoja .katex-display')];
    const lugares = formulas.map((k) => k.clientWidth + papel - pantalla);
    // Each formula's own width, with the boxes shrunk to their content.
    raiz.classList.add('pdf-midiendo-ancho');
    const anchos = formulas.map((k) => k.getBoundingClientRect().width);
    raiz.classList.remove('pdf-midiendo', 'pdf-midiendo-ancho');
    formulas.forEach((k, i) => {
      if (anchos[i] > lugares[i]) k.style.setProperty('--achicar', Math.max(0.8, lugares[i] / anchos[i]).toFixed(3));
    });
  };

  // On screen wide formulas, tables and code scroll on their own, so they take the keyboard focus, as in utn.js.
  const desplazables = () =>
    document.querySelectorAll('.pdf-hoja :is(.tabla, pre.codigo, .katex-display)').forEach((el) => {
      if (el.scrollWidth > el.clientWidth + 1) el.tabIndex = 0;
      else el.removeAttribute('tabindex');
    });
  addEventListener('resize', desplazables);

  const listo = Promise.race([Promise.all([document.fonts?.ready, imagenes(), figuras()]), plazo(25000)]).then(() => {
    marcar();
    copiarValores();
    ajustarFormulas();
    desplazables();
    estado.textContent = '';
    estado.hidden = true;
  });
  const imprimir = () => listo.then(() => window.print());
  boton.addEventListener('click', imprimir);
  imprimir();
})();
