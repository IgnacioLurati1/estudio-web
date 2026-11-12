// «¡Te recibiste!»: when every compulsory subject of years 1 to 5 is passed on the map, a sheet of the binder comes up
// with the halo drawn in pen, the degree written by hand, a violet stamp and torn bits of notes flying. carrera.js
// decides when; this file has the check (pure, also for the tests in Node) and the moment itself (recibido.css).
// One sequence of about 3 seconds; the bits of paper are gone by 5.5. Nothing keeps running once it closes.
((raiz) => {
  /** True when every subject in `obligatorias` (slugs) is passed ('a') in `estados`. An empty list never counts. */
  const completa = (estados, obligatorias) =>
    Array.isArray(obligatorias) && obligatorias.length > 0 && obligatorias.every((s) => estados?.[s] === 'a');

  const API = { completa };
  if (typeof module === 'object' && module.exports) {
    module.exports = API;
    return;
  }

  const d = document.documentElement;
  const quieto = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches || d.hasAttribute('data-quieto');
  // When the stamp lands, in ms from the opening. The bits of paper fly from there (recibido.css has the same beat).
  const GOLPE = 2650;
  const AUREOLA = 'M40 48C32 34 72 18 132 17C194 16 236 26 234 41C232 56 186 65 126 64C68 63 24 54 28 39C31 29 58 21 92 18';
  const RAYOS = ['M14 27 4 21', 'M12 43 2 44', 'M70 11 66 3', 'M192 11 196 3', 'M248 25 258 19', 'M250 43 260 44'];
  const CARRERA = [['Ingeniería', 'en', 'Sistemas'], ['de', 'Información']];

  const plantilla = (n) => `
<div class="rc-hoja"><div class="rc-golpe"><div class="rc-papel">
<div class="rc-santo" aria-hidden="true">
<svg class="rc-brillo" viewBox="0 0 262 80"><path d="${AUREOLA}"/></svg>
<svg class="rc-aureola" viewBox="0 0 262 80">
<path class="rc-a-resaltador" pathLength="1" d="${AUREOLA}"/>
<path class="rc-a-birome" pathLength="1" d="${AUREOLA}"/>
${RAYOS.map((r, i) => `<path class="rc-rayo" style="--i:${i}" d="${r}"/>`).join('')}
</svg>
</div>
<h2 id="rcTitulo" class="rc-titulo"><span class="rc-p"><span>¡Te</span></span> <span class="rc-p"><span>recibiste!</span></span></h2>
<p id="rcCarrera" class="rc-carrera">${CARRERA.map((r) => `<span class="rc-renglon">${r.map((w) => `<span class="rc-w">${w}</span>`).join(' ')}</span>`).join(' ')}<svg class="rc-subrayado" viewBox="0 0 200 14" preserveAspectRatio="none" aria-hidden="true"><path pathLength="1" d="M4 9C40 5 92 4 128 6C156 7 178 9 196 7"/></svg></p>
<p id="rcTexto" class="rc-texto">Aprobaste las ${n} materias obligatorias. Andá a festejar.</p>
<button type="button" class="b-pri rc-cerrar">Cerrar</button>
<div class="rc-sello" aria-hidden="true"><svg viewBox="0 0 120 120">
<defs><filter id="rcGastado" x="-5%" y="-5%" width="110%" height="110%"><feTurbulence type="fractalNoise" baseFrequency=".85" numOctaves="2" seed="11"/><feColorMatrix values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 -3.5 2.55"/><feComposite in="SourceGraphic" operator="in"/></filter>
<path id="rcArriba" d="M16 60A44 44 0 0 1 104 60"/><path id="rcAbajo" d="M8 60A52 52 0 0 0 112 60"/></defs>
<g filter="url(#rcGastado)"><circle cx="60" cy="60" r="56" class="rc-s-aro"/><circle cx="60" cy="60" r="38.5" class="rc-s-aro rc-s-fino"/>
<text class="rc-s-arco"><textPath href="#rcArriba" startOffset="50%" text-anchor="middle">El Santo Resumen</textPath></text>
<text class="rc-s-arco"><textPath href="#rcAbajo" startOffset="50%" text-anchor="middle">todas aprobadas</textPath></text>
<circle cx="12.5" cy="60" r="2.2" class="rc-s-punto"/><circle cx="107.5" cy="60" r="2.2" class="rc-s-punto"/>
<ellipse cx="60" cy="45" rx="13" ry="4" class="rc-s-aro rc-s-fino"/>
<text x="60" y="71" text-anchor="middle" class="rc-s-centro">${n}/${n}</text></g>
</svg></div>
</div></div></div>
<canvas class="rc-papelitos" aria-hidden="true"></canvas>
<span class="rc-tintas" aria-hidden="true"><i data-c="papel"></i><i data-c="cuadro"></i><i data-c="tinta"></i><i data-c="tilde"></i><i data-c="resaltador"></i><i data-c="sello"></i></span>`;

  // The colours of the bits of paper come from the stylesheet (each theme has its own), read as rgb() by the browser.
  const tintas = (dlg) =>
    Object.fromEntries([...dlg.querySelectorAll('.rc-tintas i')].map((i) => [i.dataset.c, getComputedStyle(i).color]));

  // ----- Bits of paper: torn squares of graph paper, bits with a line in pen, strips of highlighter and pen ticks.
  // Drawn once each at the screen's density, then only moved. Thrown from both bottom corners, they slow down in
  // the air, flutter and fall; at the end they fade and the loop stops.
  const azar = (a, b) => a + Math.random() * (b - a);
  const lienzo = (w, h, dpr, dibujar) => {
    const c = document.createElement('canvas');
    c.width = Math.ceil(w * dpr);
    c.height = Math.ceil(h * dpr);
    const x = c.getContext('2d');
    x.scale(dpr, dpr);
    dibujar(x);
    return { c, w, h };
  };
  const roto = (x, w, h) => {
    x.beginPath();
    x.moveTo(0, 0);
    x.lineTo(w, 0);
    for (let y = 0; y <= h; y += 3) x.lineTo(w - azar(0, 2.6), y);
    x.lineTo(0, h);
    x.closePath();
  };
  const figuras = (t, dpr) => {
    const lista = [];
    for (let k = 0; k < 3; k++) {
      const w = azar(14, 22);
      const h = azar(10, 16);
      lista.push(
        lienzo(w, h, dpr, (x) => {
          roto(x, w, h);
          x.fillStyle = t.papel;
          x.fill();
          x.save();
          x.clip();
          x.strokeStyle = t.cuadro;
          x.lineWidth = 0.8;
          const paso = 5.5;
          const o = azar(0, paso);
          for (let i = o; i < w; i += paso) x.strokeRect(i, -1, 0, h + 2);
          for (let i = o; i < h; i += paso) x.strokeRect(-1, i, w + 2, 0);
          x.restore();
        }),
      );
    }
    for (let k = 0; k < 2; k++) {
      const w = azar(18, 24);
      const h = azar(11, 14);
      lista.push(
        lienzo(w, h, dpr, (x) => {
          roto(x, w, h);
          x.fillStyle = t.papel;
          x.fill();
          x.strokeStyle = t.tinta;
          x.lineWidth = 1.3;
          x.lineCap = 'round';
          x.beginPath();
          x.moveTo(3, h / 2);
          for (let i = 3; i < w - 4; i += 1.5) x.lineTo(i, h / 2 + Math.sin(i * 1.1) * 1.8);
          x.stroke();
        }),
      );
    }
    for (let k = 0; k < 2; k++) {
      const w = azar(16, 22);
      lista.push(
        lienzo(w, 6, dpr, (x) => {
          x.fillStyle = t.resaltador;
          x.globalAlpha = 0.92;
          x.beginPath();
          if (x.roundRect) x.roundRect(0, 0, w, 6, [1, 3, 1, 3]);
          else x.rect(0, 0, w, 6);
          x.fill();
        }),
      );
    }
    lista.push(
      lienzo(14, 12, dpr, (x) => {
        x.strokeStyle = t.tilde;
        x.lineWidth = 2.2;
        x.lineCap = 'round';
        x.lineJoin = 'round';
        x.beginPath();
        x.moveTo(2, 6.5);
        x.lineTo(5.5, 10);
        x.lineTo(12, 2);
        x.stroke();
      }),
      lienzo(12, 12, dpr, (x) => {
        x.strokeStyle = t.sello;
        x.lineWidth = 1.6;
        x.beginPath();
        x.arc(6, 6, 4.6, 0, Math.PI * 2);
        x.stroke();
      }),
    );
    // How often each kind shows: mostly graph paper, then pen lines, highlighter and ticks.
    return [0, 0, 1, 1, 2, 2, 3, 3, 4, 5, 5, 6, 7, 7, 8].map((i) => lista[i]);
  };

  const volar = (lienzoGrande, t, demora) => {
    const ctx = lienzoGrande.getContext('2d');
    if (!ctx) return () => {};
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    let W = 0;
    let H = 0;
    const medir = () => {
      W = window.innerWidth;
      H = window.innerHeight;
      lienzoGrande.width = Math.round(W * dpr);
      lienzoGrande.height = Math.round(H * dpr);
    };
    medir();
    window.addEventListener('resize', medir);
    const tipos = figuras(t, dpr);
    // A little bigger on a big screen, so they still read as bits of paper.
    const escala = Math.min(1.4, Math.max(1, W / 950));
    // An ordinary phone gets fewer: the same moment, lighter.
    const pocos = (navigator.hardwareConcurrency || 4) <= 4;
    const n = Math.round(Math.min(130, Math.max(60, (W * H) / 8000)) * (pocos ? 0.65 : 1));
    const DURA = 2500;
    const APAGA = 650;
    const g = H * 1.45;
    const bits = Array.from({ length: n }, (_, i) => {
      const izq = i % 2 === 0;
      const a = azar(0.12, 0.62);
      const v = H * azar(2.1, 3.5);
      return {
        f: tipos[Math.floor(Math.random() * tipos.length)],
        x: izq ? azar(-12, W * 0.08) : W - azar(-12, W * 0.08),
        y: H + azar(4, 30),
        vx: (izq ? 1 : -1) * Math.sin(a) * v,
        vy: -Math.cos(a) * v,
        r: azar(0, Math.PI * 2),
        vr: azar(-7, 7),
        giro: azar(0, Math.PI * 2),
        vgiro: azar(5, 11),
        ola: azar(0, Math.PI * 2),
        amp: azar(30, 80),
        sale: i < n * 0.7 ? azar(0, 90) : azar(220, 340),
      };
    });
    let cuadro = 0;
    let espera = 0;
    let inicio = 0;
    let previo = 0;
    const paso = (ahora) => {
      if (!inicio) {
        inicio = ahora;
        previo = ahora;
      }
      const dt = Math.min(0.034, (ahora - previo) / 1000);
      previo = ahora;
      const vida = ahora - inicio;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, lienzoGrande.width, lienzoGrande.height);
      ctx.globalAlpha = vida > DURA - APAGA ? Math.max(0, (DURA - vida) / APAGA) : 1;
      for (const b of bits) {
        if (vida < b.sale) continue;
        b.vy += g * dt;
        b.vy *= Math.exp(-2.4 * dt);
        b.vx *= Math.exp(-1.7 * dt);
        b.ola += 5 * dt;
        b.x += (b.vx + (b.vy > 0 ? Math.sin(b.ola) * b.amp : 0)) * dt;
        b.y += b.vy * dt;
        b.r += b.vr * dt;
        b.giro += b.vgiro * dt;
        if (b.y > H + 40) continue;
        const c = Math.cos(b.r);
        const s = Math.sin(b.r);
        const alto = Math.cos(b.giro);
        ctx.setTransform(dpr * c, dpr * s, -dpr * s * alto, dpr * c * alto, dpr * b.x, dpr * b.y);
        ctx.drawImage(b.f.c, (-b.f.w / 2) * escala, (-b.f.h / 2) * escala, b.f.w * escala, b.f.h * escala);
      }
      if (vida < DURA) cuadro = requestAnimationFrame(paso);
      else ctx.clearRect(0, 0, lienzoGrande.width, lienzoGrande.height);
    };
    espera = setTimeout(() => {
      cuadro = requestAnimationFrame(paso);
    }, demora);
    return () => {
      clearTimeout(espera);
      cancelAnimationFrame(cuadro);
      window.removeEventListener('resize', medir);
    };
  };

  // ----- The dialog. Built each time it opens and removed when it closes: Escape, «Cerrar» or a tap outside.
  let abierto = null;
  const abrir = ({ materias }) => {
    if (abierto) return;
    const antes = document.activeElement;
    const sinMovimiento = quieto();
    const dlg = document.createElement('dialog');
    dlg.className = sinMovimiento ? 'rc rc-quieto' : 'rc';
    dlg.setAttribute('aria-labelledby', 'rcTitulo');
    dlg.setAttribute('aria-describedby', 'rcCarrera rcTexto');
    dlg.innerHTML = plantilla(Number(materias) || 0);
    // The degree is written word by word, each word taking as long as its letters.
    let t = 0;
    dlg.querySelectorAll('.rc-w').forEach((w) => {
      const largo = w.textContent.length * 30;
      w.style.setProperty('--d', `${t}ms`);
      w.style.setProperty('--t', `${largo}ms`);
      t += largo + 70;
    });
    document.body.append(dlg);
    abierto = dlg;
    dlg.showModal();
    const bCerrar = dlg.querySelector('.rc-cerrar');
    bCerrar.focus();
    // The bits of paper are a bonus: if this browser cannot draw them, the sheet still opens and closes.
    let parar = () => {};
    if (!sinMovimiento) {
      try {
        parar = volar(dlg.querySelector('.rc-papelitos'), tintas(dlg), GOLPE);
      } catch {
        /* No bits of paper. */
      }
    }
    const cerrar = () => {
      if (dlg.classList.contains('rc-sale')) return;
      dlg.classList.add('rc-sale');
      parar();
      setTimeout(() => {
        if (dlg.open) dlg.close();
      }, sinMovimiento ? 0 : 160);
    };
    let desde = null;
    dlg.addEventListener('pointerdown', (e) => {
      desde = e.target;
    });
    dlg.addEventListener('click', (e) => {
      // Only a tap that starts and ends outside the sheet: selecting text and letting go outside does not close it.
      if (e.target === dlg && desde === dlg) cerrar();
    });
    dlg.addEventListener('cancel', (e) => {
      e.preventDefault();
      cerrar();
    });
    bCerrar.addEventListener('click', cerrar);
    dlg.addEventListener('close', () => {
      parar();
      dlg.remove();
      abierto = null;
      if (antes instanceof HTMLElement && antes !== document.body && antes.isConnected) antes.focus();
    });
  };

  API.abrir = abrir;
  raiz.UTN_RECIBIDO = API;
})(typeof window === 'undefined' ? globalThis : window);
