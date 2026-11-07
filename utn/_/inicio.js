// Home page: the theme button, the emergency card goes to the map after turning the protocol on, and the 3D notebook
// loads when there is time.
const escena = document.getElementById('inEscena');

// Night and day, as on the other pages (secciones.js): tema.js already applied the saved choice before painting.
const bTema = document.getElementById('tema');
if (bTema) {
  const raiz = document.documentElement;
  const pintarTema = () => {
    bTema.textContent = raiz.dataset.tema === 'noche' ? 'Modo día' : 'Modo noche';
  };
  bTema.addEventListener('click', () => {
    const noche = raiz.dataset.tema === 'noche';
    if (noche) delete raiz.dataset.tema;
    else raiz.dataset.tema = 'noche';
    try {
      localStorage.setItem('utn:tema', noche ? 'dia' : 'noche');
    } catch {
      /* No storage: the choice lasts until the page closes. */
    }
    pintarTema();
  });
  pintarTema();
}

document.addEventListener('click', (e) => {
  const b = e.target.closest?.('[data-in-ir]');
  // emergencia.js saves the protocol on the same click. If it could not, it shows why and the visitor stays.
  if (b) setTimeout(() => {
    if (document.documentElement.hasAttribute('data-emergencia')) location.href = b.dataset.inIr;
  }, 0);
});

const conWebgl = () => {
  try {
    const c = document.createElement('canvas');
    return Boolean(c.getContext('webgl2') || c.getContext('webgl'));
  } catch {
    return false;
  }
};

if (escena && conWebgl()) {
  // Until the drawing shows, a skeleton of the notebook (.in-esq in inicio.css) holds its place. It goes once the cover is in.
  const esq = document.createElement('span');
  esq.className = 'esq in-esq';
  escena.append(esq);
  escena.setAttribute('aria-busy', 'true');
  new MutationObserver((_, mirar) => {
    if (!escena.classList.contains('in-lista')) return;
    mirar.disconnect();
    escena.removeAttribute('aria-busy');
    setTimeout(() => esq.remove(), 700);
  }).observe(escena, { attributes: true, attributeFilter: ['class'] });
  const cargar =() => import('./inicio3d.js').then((m) => m.armar(escena)).catch((e) => {
    // Without the drawing the page still works. The reason stays in the console for whoever looks.
    console.error('Portada 3D:', e);
    escena.closest('.in-heroe')?.classList.add('in-sin-escena');
    escena.remove();
  });
  // The page paints first. The 690 KB of three.js come after, when the browser is free.
  if ('requestIdleCallback' in window) requestIdleCallback(cargar, { timeout: 1200 });
  else setTimeout(cargar, 300);
}
