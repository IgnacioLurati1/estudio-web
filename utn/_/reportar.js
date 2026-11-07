// «Sugerir una corrección», a small flag next to each section title of a summary. Never in edit mode, so it cannot be
// taken for editing.
(() => {
  const S = window.UTN_SERVICIO;
  const C = window.UTN_CUENTA;
  const hoja = document.querySelector('main[data-reportable]');
  if (!S?.hay || !C || !hoja) return;
  const MINIMO = 5;
  const MAXIMO = 1000;
  const FUERA = '.quiz,.cae,.em-examenes,.es-materia,[data-sacado]';

  const el = (tag, props = {}, ...hijos) => {
    const x = document.createElement(tag);
    Object.assign(x, props);
    x.append(...hijos);
    return x;
  };
  const sinBoton = (h) => {
    const c = h.cloneNode(true);
    c.querySelector('.rep-b')?.remove();
    return c.textContent.trim();
  };

  const dlg = el('dialog', { className: 'dlg dlg-cuenta dlg-reporte' });
  dlg.setAttribute('aria-labelledby', 'repTitulo');
  const abrir = (h) => {
    const motivoId = 'repTexto';
    const titulo = el('h2', { id: 'repTitulo', textContent: 'Sugerir una corrección' });
    const donde = el('p', { className: 'cu-motivo', textContent: `En «${sinBoton(h)}».` });
    const texto = el('textarea', { id: motivoId, rows: 4, maxLength: MAXIMO });
    const ayuda = el('small', { id: 'repAyuda', textContent: `Contá qué hay que corregir y, si lo sabés, cómo debería decir. De ${MINIMO} a ${MAXIMO} caracteres.` });
    texto.setAttribute('aria-describedby', 'repAyuda repEstado');
    const campo = el('div', { className: 'cu-campo' }, el('label', { htmlFor: motivoId, textContent: 'Qué hay que corregir' }), texto, ayuda);
    const estado = el('p', { id: 'repEstado', className: 'es-estado' });
    estado.setAttribute('role', 'status');
    const enviar = el('button', { type: 'submit', className: 'b-pri', textContent: 'Enviar' });
    const cancelar = el('button', { type: 'button', className: 'b-sec', textContent: 'Cancelar' });
    cancelar.addEventListener('click', () => dlg.close());
    const form = el('form', { noValidate: true }, titulo, donde, campo, estado, el('div', { className: 'dlg-botones' }, enviar, cancelar));
    // An error is announced at once and marks the field; a plain message waits its turn.
    const decir = (t, error) => {
      estado.setAttribute('role', error ? 'alert' : 'status');
      estado.textContent = t;
      if (error) estado.dataset.error = '1';
      else estado.removeAttribute('data-error');
      if (error) texto.setAttribute('aria-invalid', 'true');
      else texto.removeAttribute('aria-invalid');
    };
    texto.addEventListener('input', () => texto.removeAttribute('aria-invalid'));
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const t = texto.value.trim();
      if (t.length < MINIMO) {
        decir(`Escribí al menos ${MINIMO} caracteres.`, true);
        texto.focus();
        return;
      }
      decir('');
      enviar.disabled = true;
      let r;
      try {
        r = await C.conCuenta('Para sugerir una corrección hace falta una cuenta. Lo que escribiste queda acá.', () =>
          S.pedir('reportar', { json: { materia: document.body.dataset.materia, pagina: document.body.dataset.pagina, seccion: h.id, texto: t }, cuenta: true }),
        );
      } catch {
        r = { ok: false, status: 503 };
      } finally {
        enviar.disabled = false;
      }
      if (r.ok) {
        const cerrar = el('button', { type: 'button', className: 'b-pri', textContent: 'Cerrar' });
        cerrar.addEventListener('click', () => dlg.close());
        dlg.replaceChildren(el('h2', { id: 'repTitulo', textContent: 'Gracias' }), el('p', { textContent: 'Lo vamos a revisar.' }), el('div', { className: 'dlg-botones' }, cerrar));
        cerrar.focus();
        return;
      }
      if (r.cancelado) {
        decir('No se envió porque no ingresaste. Lo que escribiste sigue acá.', true);
        texto.focus();
        return;
      }
      decir(S.mensaje(r, { 400: `El texto tiene que tener de ${MINIMO} a ${MAXIMO} caracteres, sin caracteres raros.`, 404: 'Esta página ya no está en la lista. Recargá y probá de nuevo.', 429: 'Llegaste al tope de 10 sugerencias por día. Probá de nuevo mañana.' }), true);
      texto.focus();
    });
    dlg.replaceChildren(form);
    if (!dlg.isConnected) document.body.append(dlg);
    dlg.showModal();
    texto.focus();
  };

  // A small flag, not a sentence: text next to every title read as if the whole page were wrong.
  const SVG = 'http://www.w3.org/2000/svg';
  const bandera = () => {
    const s = document.createElementNS(SVG, 'svg');
    s.setAttribute('viewBox', '0 0 24 24');
    s.setAttribute('aria-hidden', 'true');
    s.setAttribute('focusable', 'false');
    const p = document.createElementNS(SVG, 'path');
    p.setAttribute('d', 'M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1zM4 22v-7');
    s.append(p);
    return s;
  };

  const poner = () => {
    if (document.body.classList.contains('editando')) return;
    hoja.querySelectorAll('h2[id], h3[id]').forEach((h) => {
      if (h.closest(FUERA) || !/^[a-z0-9-]{1,100}$/.test(h.id) || h.querySelector('.rep-b')) return;
      const b = el('button', { type: 'button', className: 'rep-b', title: 'Sugerir una corrección' }, bandera());
      // Short on purpose: it is read as part of the title, and the dialog already names the section.
      b.setAttribute('aria-label', 'Sugerir corrección');
      b.addEventListener('click', () => abrir(h));
      h.append(b);
    });
  };
  const quitar = () => hoja.querySelectorAll('.rep-b').forEach((b) => b.remove());

  poner();
  // The edit script works on clean titles: this runs before its click, and comes back when it repaints after leaving.
  document.getElementById('editar')?.addEventListener('click', () => {
    if (!document.body.classList.contains('editando')) quitar();
  }, true);
  document.addEventListener('utn:recalcular', poner);
})();
