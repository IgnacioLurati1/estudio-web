// «Guardar para leer sin internet»: the whole subject (its pages, exercises, emergency protocol, figures and pictures) in
// this device, listed at build time in <subject>/sin-internet.json. The service worker (../sw.js) answers from it when
// there is no connection. What was saved is in utn:sin-internet, by subject, with its version and date; a new version is
// fetched again by itself the next time the subject opens with a connection.
(() => {
  const materia = document.body.dataset.materia;
  if (!materia || materia === '_' || !('serviceWorker' in navigator) || !('caches' in window)) return;
  const CLAVE = 'utn:sin-internet';
  const PREFIJO = `utn-mat-${materia}-`;
  const PARALELO = 6;
  const raiz = new URL('../', location.href);
  const caja = document.getElementById('sinInternet');

  const leer = () => {
    try {
      const x = JSON.parse(localStorage.getItem(CLAVE));
      return x && typeof x === 'object' ? x : {};
    } catch {
      return {};
    }
  };
  // False when the browser does not let it write: the subject still opens without internet, it just does not show as saved.
  let recuerda = true;
  const anotar = (dato) => {
    const todo = leer();
    if (dato) todo[materia] = dato;
    else delete todo[materia];
    try {
      localStorage.setItem(CLAVE, JSON.stringify(todo));
      recuerda = true;
    } catch {
      recuerda = false;
    }
    return todo;
  };
  // One save or removal at a time, also against the quiet update below.
  let ocupado = false;
  const propio = () => {
    const d = leer()[materia];
    return d && typeof d.v === 'string' && Number.isFinite(d.fecha) ? d : null;
  };
  const fechaCorta = (ms) => new Date(ms).toLocaleDateString('es-AR', { day: 'numeric', month: 'numeric' });
  const megas = (b) => `${Math.max(1, Math.round(b / 1048576))} MB`;
  const lista = () => fetch(new URL('sin-internet.json', new URL(`${materia}/`, raiz)), { cache: 'no-store' }).then((r) => (r.ok ? r.json() : Promise.reject(new Error('lista'))));
  const borrarViejas = async (salvo) => {
    for (const k of await caches.keys()) if (k.startsWith(PREFIJO) && k !== salvo) await caches.delete(k);
  };

  // Everything into a fresh cache, a few at a time; only when all of it is in does it replace the old one.
  const guardar = async (m, alAvanzar) => {
    await navigator.serviceWorker.register(new URL('sw.js', raiz), { scope: raiz.pathname });
    const nombre = `${PREFIJO}${m.v}`;
    const cache = await caches.open(nombre);
    let hechos = 0;
    const pendientes = [...m.archivos];
    try {
      await Promise.all(
        Array.from({ length: PARALELO }, async () => {
          while (pendientes.length) {
            const url = new URL(pendientes.shift(), raiz).href;
            const r = await fetch(url, { cache: 'no-cache' });
            if (!r.ok) throw new Error(`falta ${url}`);
            await cache.put(url, r);
            hechos += 1;
            alAvanzar?.(hechos, m.archivos.length);
          }
        }),
      );
    } catch (e) {
      await caches.delete(nombre);
      throw e;
    }
    await borrarViejas(nombre);
    anotar({ v: m.v, fecha: Date.now() });
  };
  const sacar = async () => {
    await borrarViejas('');
    const quedan = anotar(null);
    if (!Object.keys(quedan).length) {
      const reg = await navigator.serviceWorker.getRegistration(raiz.pathname);
      await reg?.unregister();
    }
  };

  // Without a connection, a line on top says what is being read. It lives inside a status region that is always there,
  // so a screen reader hears it when it shows up.
  const vivo = document.createElement('div');
  vivo.className = 'si-vivo';
  vivo.setAttribute('role', 'status');
  const aviso = document.createElement('p');
  aviso.className = 'si-aviso';
  aviso.hidden = true;
  vivo.append(aviso);
  const pintarAviso = () => {
    const d = propio();
    aviso.hidden = navigator.onLine || !d;
    aviso.textContent = d ? `Sin internet. Estás leyendo lo que guardaste el ${fechaCorta(d.fecha)}.` : '';
  };
  (document.querySelector('main') || document.body).prepend(vivo);
  addEventListener('online', pintarAviso);
  addEventListener('offline', pintarAviso);
  pintarAviso();

  // A saved subject that changed is fetched again quietly, when there is a connection.
  const d0 = propio();
  if (d0 && navigator.onLine) {
    ocupado = true;
    lista()
      .then((m) => (m.v !== d0.v ? guardar(m) : null))
      .catch(() => {})
      .finally(() => {
        ocupado = false;
      });
  }

  if (!caja) return;
  // ----- The control on the subject's cover, next to the PDF.
  const boton = document.createElement('button');
  boton.type = 'button';
  boton.className = 'b-sec si-boton';
  const estado = document.createElement('p');
  estado.className = 'si-estado';
  estado.setAttribute('role', 'status');
  caja.append(boton, estado);
  let tam = 0;
  const pintar = (texto) => {
    const d = propio();
    boton.textContent = d ? 'Sacarla de este dispositivo' : 'Guardar para leer sin internet';
    estado.textContent = texto ?? (d ? `Guardada para leer sin internet el ${fechaCorta(d.fecha)}.` : tam ? `Ocupa unos ${megas(tam)} en este dispositivo.` : '');
  };
  caja.hidden = false;
  pintar();
  lista()
    .then((m) => {
      tam = m.bytes;
      if (!ocupado) pintar();
    })
    .catch(() => {});

  boton.addEventListener('click', async () => {
    if (ocupado) return;
    ocupado = true;
    boton.setAttribute('aria-disabled', 'true');
    try {
      if (propio()) {
        await sacar();
        pintar('Se sacó de este dispositivo.');
      } else {
        pintar('Guardando la materia…');
        const m = await lista();
        tam = m.bytes;
        let ultimo = 0;
        await guardar(m, (n, total) => {
          // The status line speaks every tenth, not on every file.
          const decimo = Math.floor((n / total) * 10);
          if (decimo !== ultimo || n === total) {
            ultimo = decimo;
            estado.textContent = `Guardando la materia… ${n} de ${total}.`;
          }
        });
        pintar(recuerda ? 'Guardada. Ya la podés leer sin internet.' : 'Se guardó, pero este navegador no recuerda que la guardaste.');
      }
    } catch (e) {
      const lleno = e && (e.name === 'QuotaExceededError' || /quota/i.test(String(e.message)));
      pintar(lleno ? 'No hay lugar en este dispositivo para guardarla.' : 'No se pudo guardar. Revisá la conexión y probá de nuevo.');
    } finally {
      ocupado = false;
      boton.removeAttribute('aria-disabled');
    }
  });
})();
