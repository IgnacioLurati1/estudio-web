// The home page's 3D scene: a spiral-bound summary like the ones from the photocopy shop, with a halo, sheets that turn over
// the coil, and one sheet per subject in orbit, grouped by year. Hover or tap a sheet to see the subject, click it to open it.
// Real sizes, 1 unit = 100 mm: ISO 216 A4 (210 x 297 mm), 18 mm thick, plastic spiral coil of 4:1 pitch (6.35 mm),
// 20 mm across and 1.8 mm thick, holes 6 mm from the spine. Axes: x to the right, y up, z toward whoever looks.
import * as T from './three/three.module.min.js';

const ANCHO = 2.1;
const ALTO = 2.97;
const GRUESO = 0.18;
const PASO = 0.0635;
const RADIO_ARO = 0.1;
const CENTRO_ARO = -ANCHO / 2 + 0.02;
const VUELTAS = Math.floor((ALTO - 0.08) / PASO);
const TEX_ANCHO = 1024;
const TEX_ALTO = Math.round((TEX_ANCHO * ALTO) / ANCHO);
const CADA = 5.5;
const DURA = 1.7;

const suave = (a, b, x) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};
const ida = (t) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);

// Where the coil crosses the front cover, for the holes printed on each page.
const HUECOS = (() => {
  const t = Math.asin(GRUESO / 2 / RADIO_ARO);
  const x = CENTRO_ARO + RADIO_ARO * Math.cos(t);
  const y0 = -ALTO / 2 + 0.04;
  return Array.from({ length: VUELTAS }, (_, k) => [x, y0 + (k + t / (2 * Math.PI)) * PASO]);
})();

const lienzo = () => {
  const c = document.createElement('canvas');
  c.width = TEX_ANCHO;
  c.height = TEX_ALTO;
  return [c, c.getContext('2d')];
};
const aPx = (x, y) => [((x + ANCHO / 2) / ANCHO) * TEX_ANCHO, ((ALTO / 2 - y) / ALTO) * TEX_ALTO];

const cuadricula = (g, fondo, linea) => {
  g.fillStyle = fondo;
  g.fillRect(0, 0, TEX_ANCHO, TEX_ALTO);
  g.strokeStyle = linea;
  g.lineWidth = 1.5;
  const lado = TEX_ANCHO / 42;
  g.beginPath();
  for (let x = lado; x < TEX_ANCHO; x += lado) {
    g.moveTo(x, 0);
    g.lineTo(x, TEX_ALTO);
  }
  for (let y = lado; y < TEX_ALTO; y += lado) {
    g.moveTo(0, y);
    g.lineTo(TEX_ANCHO, y);
  }
  g.stroke();
};
const huecos = (g) => {
  g.fillStyle = '#0d1630';
  for (const [x, y] of HUECOS) {
    const [px, py] = aPx(x, y);
    g.beginPath();
    g.ellipse(px, py, 7, 9, 0, 0, Math.PI * 2);
    g.fill();
  }
};
// A pen line that wobbles a little, like handwriting that nobody can read.
const garabato = (g, x, y, largo, azar) => {
  g.beginPath();
  g.moveTo(x, y);
  for (let i = 1; i <= 12; i++) g.lineTo(x + (largo * i) / 12, y + Math.sin(i * 1.7 + azar) * 5 + (azar % 3));
  g.stroke();
};
const resaltar = (g, x, y, largo, color) => {
  g.fillStyle = color;
  g.globalAlpha = 0.75;
  g.beginPath();
  g.moveTo(x, y + 6);
  g.lineTo(x + largo, y);
  g.lineTo(x + largo + 4, y + 40);
  g.lineTo(x - 2, y + 44);
  g.fill();
  g.globalAlpha = 1;
};

const MANO = '"Shantell Sans", "Segoe Print", cursive';
const LETRA = '"Bricolage Grotesque", "Segoe UI", sans-serif';
const BIROME = '#1f3a9e';

const portada = () => {
  const [c, g] = lienzo();
  g.fillStyle = '#f4f6fb';
  g.fillRect(0, 0, TEX_ANCHO, TEX_ALTO);
  g.fillStyle = BIROME;
  g.fillRect(0, TEX_ALTO - 150, TEX_ANCHO, 150);
  resaltar(g, 120, 520, 470, '#ffe45c');
  g.fillStyle = BIROME;
  g.font = `800 150px ${LETRA}`;
  g.fillText('El', 120, 400);
  g.fillText('Santo', 120, 560);
  g.fillText('Resumen', 120, 720);
  g.font = `600 52px ${MANO}`;
  g.fillText('Ingeniería en Sistemas', 124, 850);
  g.fillText('UTN', 124, 920);
  g.save();
  g.translate(700, 1110);
  g.rotate(-0.12);
  g.strokeStyle = '#e0578f';
  g.lineWidth = 6;
  g.beginPath();
  g.ellipse(0, 0, 170, 70, 0, 0, Math.PI * 2);
  g.stroke();
  g.fillStyle = '#e0578f';
  g.font = `600 46px ${MANO}`;
  g.textAlign = 'center';
  g.fillText('¡todas!', 0, 16);
  g.restore();
  g.fillStyle = '#f4f6fb';
  g.font = `600 42px ${MANO}`;
  g.fillText('fotocopiadora del centro', 124, TEX_ALTO - 60);
  huecos(g);
  return c;
};

const hoja = (titulo, dibujo) => () => {
  const [c, g] = lienzo();
  cuadricula(g, '#f8fafd', '#d6e0f2');
  g.strokeStyle = '#e0578f';
  g.lineWidth = 3;
  g.beginPath();
  g.moveTo(110, 0);
  g.lineTo(110, TEX_ALTO);
  g.stroke();
  g.fillStyle = BIROME;
  g.font = `600 64px ${MANO}`;
  g.fillText(titulo, 150, 150);
  g.strokeStyle = BIROME;
  g.lineWidth = 4;
  g.lineCap = 'round';
  dibujo(g);
  huecos(g);
  return c;
};

const hoja1 = hoja('Lo que siempre toman', (g) => {
  resaltar(g, 150, 230, 520, '#ffe45c');
  for (let i = 0; i < 8; i++) garabato(g, 150, 270 + i * 62, 600 + ((i * 97) % 180), i);
  g.strokeRect(170, 860, 220, 110);
  g.strokeRect(640, 860, 220, 110);
  g.beginPath();
  g.moveTo(515, 860);
  g.lineTo(590, 915);
  g.lineTo(515, 970);
  g.lineTo(440, 915);
  g.closePath();
  g.moveTo(390, 915);
  g.lineTo(440, 915);
  g.moveTo(590, 915);
  g.lineTo(640, 915);
  g.stroke();
  for (let i = 0; i < 5; i++) garabato(g, 150, 1080 + i * 62, 640 - ((i * 53) % 160), i + 4);
});

const hoja2 = hoja('Para el final', (g) => {
  for (let i = 0; i < 6; i++) {
    const y = 260 + i * 110;
    g.beginPath();
    g.moveTo(160, y);
    g.lineTo(180, y + 22);
    g.lineTo(215, y - 18);
    g.stroke();
    garabato(g, 250, y, 520 + ((i * 71) % 200), i + 2);
  }
  g.fillStyle = 'rgba(255, 194, 218, .8)';
  g.fillRect(150, 970, 720, 230);
  g.strokeStyle = '#e0578f';
  g.strokeRect(150, 970, 720, 230);
  g.fillStyle = '#bf2a5e';
  g.font = `600 56px ${MANO}`;
  g.fillText('¡Ojo!', 185, 1045);
  g.strokeStyle = BIROME;
  for (let i = 0; i < 2; i++) garabato(g, 185, 1100 + i * 56, 560, i + 9);
});

const cantos = () => {
  const c = document.createElement('canvas');
  c.width = 32;
  c.height = 512;
  const g = c.getContext('2d');
  g.fillStyle = '#eef1f7';
  g.fillRect(0, 0, 32, 512);
  for (let y = 0; y < 512; y += 3) {
    g.fillStyle = y % 6 ? '#dfe4ee' : '#f7f9fc';
    g.fillRect(0, y, 32, 1);
  }
  return c;
};

const textura = (c, renderer) => {
  const t = new T.CanvasTexture(c);
  t.colorSpace = T.SRGBColorSpace;
  t.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  return t;
};

class Helice extends T.Curve {
  getPoint(u, out = new T.Vector3()) {
    const t = u * VUELTAS * Math.PI * 2;
    return out.set(CENTRO_ARO + RADIO_ARO * Math.cos(t), -ALTO / 2 + 0.04 + (t / (Math.PI * 2)) * PASO, RADIO_ARO * Math.sin(t));
  }
}

const brillo = () => {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d');
  const r = g.createRadialGradient(128, 128, 60, 128, 128, 128);
  r.addColorStop(0, 'rgba(255, 228, 92, 0)');
  r.addColorStop(0.55, 'rgba(255, 228, 92, .55)');
  r.addColorStop(0.7, 'rgba(255, 228, 92, .18)');
  r.addColorStop(1, 'rgba(255, 228, 92, 0)');
  g.fillStyle = r;
  g.fillRect(0, 0, 256, 256);
  return c;
};

const ANIOS = { '-1': 'Ya no está en el plan', 0: 'Electiva' };
const anioDe = (a) => ANIOS[a] || `${a}° año`;

export async function armar(caja) {
  const materias = await fetch('_/materias.json', { credentials: 'omit' }).then((r) => (r.ok ? r.json() : []));
  // The cover uses the site's fonts. It waits a little for them, never forever.
  await Promise.race([Promise.all([document.fonts.load(`800 150px ${LETRA}`), document.fonts.load(`600 52px ${MANO}`)]), new Promise((r) => setTimeout(r, 1500))]).catch(() => {});

  const reducido = matchMedia('(prefers-reduced-motion: reduce)');
  const renderer = new T.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'low-power' });
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 1.75));
  const lienzoGl = renderer.domElement;
  caja.append(lienzoGl);

  const escena = new T.Scene();
  // Near and far hug the scene: with 0.1 the depth buffer had no precision left for sheets a millimeter apart.
  const camara = new T.PerspectiveCamera(32, 1, 4, 24);
  escena.add(new T.HemisphereLight('#dfe8ff', '#0b1636', 1.4));
  const sol = new T.DirectionalLight('#fff6e8', 2.2);
  sol.position.set(-4, 5, 6);
  escena.add(sol);
  const contra = new T.DirectionalLight('#9db8ff', 1.1);
  contra.position.set(5, 2, -4);
  escena.add(contra);

  const todo = new T.Group();
  escena.add(todo);
  const libro = new T.Group();
  libro.rotation.set(-0.12, -0.42, 0.06);
  todo.add(libro);

  const paginas = [portada, hoja1, hoja2].map((f) => textura(f(), renderer));
  const canto = textura(cantos(), renderer);
  const papel = new T.MeshStandardMaterial({ color: '#f3f5fa', roughness: 0.92 });
  const frente = new T.MeshStandardMaterial({ map: paginas[1], roughness: 0.9 });
  const tapa = new T.MeshStandardMaterial({ color: '#1f3a9e', roughness: 0.8 });
  const lado = new T.MeshStandardMaterial({ map: canto, roughness: 0.95 });
  const bloque = new T.Mesh(new T.BoxGeometry(ANCHO, ALTO, GRUESO), [lado, lado, lado, lado, frente, tapa]);
  libro.add(bloque);

  const aro = new T.Mesh(new T.TubeGeometry(new Helice(), VUELTAS * 20, 0.009, 6, false), new T.MeshStandardMaterial({ color: '#dfe4ee', roughness: 0.35, metalness: 0.1 }));
  libro.add(aro);

  // The sheet that turns: a rigid sheet hinged on the coil, printed in front and plain paper behind. It is one mesh
  // drawn from both sides, and the back paints plain paper (#e9edf5 in linear color).
  const bisagra = new T.Group();
  bisagra.position.x = -ANCHO / 2;
  const geoHoja = new T.PlaneGeometry(ANCHO, ALTO);
  geoHoja.translate(ANCHO / 2, 0, 0);
  const ladoA = new T.MeshStandardMaterial({ map: paginas[0], roughness: 0.9, side: T.DoubleSide });
  ladoA.onBeforeCompile = (s) => {
    s.fragmentShader = s.fragmentShader.replace('#include <map_fragment>', `#include <map_fragment>
  if (!gl_FrontFacing) diffuseColor.rgb = vec3(0.815, 0.846, 0.913);`);
  };
  const hojaA = new T.Mesh(geoHoja, ladoA);
  bisagra.add(hojaA);
  libro.add(bisagra);
  const doblar = (angulo) => {
    bisagra.rotation.y = -angulo;
    // Around the coil the hinge goes from the front cover to the back one.
    bisagra.position.z = T.MathUtils.lerp(GRUESO / 2 + 0.012, -GRUESO / 2 - 0.012, suave(0.75 * Math.PI, 1.6 * Math.PI, angulo));
  };
  doblar(0);
  let vuelta = 0;
  // Never without a texture: a material first drawn without one stays without it, even after it gets one.
  const ponerPaginas = () => {
    const k = ((vuelta % 3) + 3) % 3;
    ladoA.map = paginas[k];
    frente.map = paginas[(k + 1) % 3];
  };

  const aureola = new T.Group();
  aureola.position.set(0.05, ALTO / 2 + 0.5, 0.05);
  aureola.rotation.x = Math.PI / 2 - 0.35;
  const anillo = new T.Mesh(new T.TorusGeometry(0.62, 0.032, 12, 96), new T.MeshBasicMaterial({ color: '#ffe45c' }));
  const luz = new T.Sprite(new T.SpriteMaterial({ map: textura(brillo(), renderer), blending: T.AdditiveBlending, depthWrite: false, transparent: true }));
  luz.scale.set(2.3, 2.3, 1);
  luz.position.set(0.05, ALTO / 2 + 0.5, 0.05);
  aureola.add(anillo);
  libro.add(aureola, luz);

  // One sheet per subject. Each year is its own orbit, tilted a little more than the one before.
  const N = materias.length;
  const hojas = new T.InstancedMesh(new T.PlaneGeometry(0.3, 0.42), new T.MeshStandardMaterial({ color: '#ffffff', emissive: '#8f9bb8', emissiveIntensity: 0.35, roughness: 0.9, side: T.DoubleSide }), Math.max(1, N));
  hojas.count = N;
  const orbitas = new Map();
  materias.forEach((m, i) => {
    const k = m.a > 0 ? m.a - 1 : 5;
    if (!orbitas.has(k)) orbitas.set(k, []);
    orbitas.get(k).push(i);
  });
  const lugar = new Array(N);
  for (const [k, ids] of orbitas) {
    const giro = new T.Quaternion().setFromEuler(new T.Euler(1.15 + k * 0.07, 0, -0.5 + k * 0.17));
    ids.forEach((id, j) => {
      lugar[id] = { radio: 2.05 + k * 0.27, fase: (j / ids.length) * Math.PI * 2 + k * 0.9, giro, vel: 0.06 - k * 0.006 };
    });
  }
  const PAPEL = new T.Color('#eef3fb');
  const RESALTADO = new T.Color('#ffe45c');
  for (let i = 0; i < N; i++) hojas.setColorAt(i, PAPEL);
  todo.add(hojas);

  // Dots on a sphere far behind, like the planet on the Luta Studios page.
  const puntos = (() => {
    const n = 700;
    const p = new Float32Array(n * 3);
    const oro = Math.PI * (3 - Math.sqrt(5));
    for (let i = 0; i < n; i++) {
      const y = 1 - (i / (n - 1)) * 2;
      const r = Math.sqrt(1 - y * y);
      p.set([Math.cos(oro * i) * r * 6.5, y * 6.5, Math.sin(oro * i) * r * 6.5], i * 3);
    }
    const g = new T.BufferGeometry();
    g.setAttribute('position', new T.BufferAttribute(p, 3));
    return new T.Points(g, new T.PointsMaterial({ color: '#ffffff', size: 0.028, transparent: true, opacity: 0.35, depthWrite: false }));
  })();
  todo.add(puntos);

  const colores = () => {
    const noche = document.documentElement.dataset.tema === 'noche';
    puntos.material.color.set(noche ? '#ffffff' : '#1f3a9e');
    puntos.material.opacity = noche ? 0.35 : 0.28;
    anillo.material.color.set(noche ? '#ffe45c' : '#e8b800');
    luz.visible = noche;
    pedir();
  };

  const ficha = document.getElementById('inFicha');
  const fichaNombre = document.getElementById('inFichaNombre');
  const fichaAnio = document.getElementById('inFichaAnio');
  const heroe = caja.closest('.in-heroe');
  let elegida = -1;
  let fijada = false;

  const medida = { ancho: 1, alto: 1 };
  const acomodar = () => {
    const r = caja.getBoundingClientRect();
    medida.ancho = Math.max(1, r.width);
    medida.alto = Math.max(1, r.height);
    renderer.setSize(medida.ancho, medida.alto, false);
    camara.aspect = medida.ancho / medida.alto;
    const angosto = camara.aspect < 1.25 || medida.ancho < 760;
    const mitad = Math.tan(T.MathUtils.degToRad(16));
    camara.position.set(0, 0.3, angosto ? Math.max(11.5, 4.1 / (mitad * camara.aspect)) : 11.5);
    camara.near = camara.position.z - 7.5;
    camara.far = camara.position.z + 7.5;
    camara.lookAt(0, 0, 0);
    camara.updateProjectionMatrix();
    todo.position.x = angosto ? 0 : mitad * 11.5 * camara.aspect * 0.45;
    pedir();
  };

  const m4 = new T.Matrix4();
  const v = new T.Vector3();
  const q = new T.Quaternion();
  const s = new T.Vector3();
  const mirar = new T.Matrix4();
  const arriba = new T.Vector3(0, 1, 0);
  const centro = new T.Vector3();
  const vaiven = new T.Quaternion();
  const ubicar = (t) => {
    for (let i = 0; i < N; i++) {
      const l = lugar[i];
      const a = l.fase + t * l.vel;
      v.set(Math.cos(a) * l.radio, 0, Math.sin(a) * l.radio).applyQuaternion(l.giro);
      mirar.lookAt(v, centro, arriba);
      q.setFromRotationMatrix(mirar);
      q.multiply(vaiven.setFromAxisAngle(arriba, Math.sin(t * 0.8 + i) * 0.35));
      const grande = i === elegida ? 1.45 : 1;
      s.set(grande, grande, grande);
      m4.compose(v, q, s);
      hojas.setMatrixAt(i, m4);
    }
    hojas.instanceMatrix.needsUpdate = true;
  };

  const mostrarFicha = () => {
    if (elegida < 0) {
      ficha.hidden = true;
      return;
    }
    const m = materias[elegida];
    fichaNombre.textContent = m.n;
    fichaAnio.textContent = anioDe(m.a);
    ficha.href = `${m.s}/index.html`;
    ficha.setAttribute('aria-label', `Abrir ${m.n}`);
    hojas.getMatrixAt(elegida, m4);
    v.setFromMatrixPosition(m4).applyMatrix4(hojas.matrixWorld).project(camara);
    const cr = caja.getBoundingClientRect();
    const hr = heroe.getBoundingClientRect();
    const x = cr.left - hr.left + ((v.x + 1) / 2) * medida.ancho;
    const y = cr.top - hr.top + ((1 - v.y) / 2) * medida.alto;
    ficha.hidden = false;
    const w = ficha.offsetWidth;
    ficha.style.transform = `translate(${Math.round(Math.min(Math.max(8, x - w / 2), hr.width - w - 8))}px, ${Math.round(Math.max(8, y - ficha.offsetHeight - 26))}px)`;
  };

  const elegir = (i) => {
    if (i === elegida) return;
    if (elegida >= 0) hojas.setColorAt(elegida, PAPEL);
    elegida = i;
    if (i >= 0) hojas.setColorAt(i, RESALTADO);
    hojas.instanceColor.needsUpdate = true;
    lienzoGl.style.cursor = i >= 0 && !fijada ? 'pointer' : '';
    pedir();
  };

  const rayo = new T.Raycaster();
  const puntero = new T.Vector2();
  const tocada = (e) => {
    const r = lienzoGl.getBoundingClientRect();
    puntero.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    rayo.setFromCamera(puntero, camara);
    return rayo.intersectObject(hojas)[0]?.instanceId ?? -1;
  };

  // Dragging sideways turns everything. Up and down stays for the page's scroll on a phone.
  let arrastre = null;
  let impulso = 0;
  let giroY = 0;
  lienzoGl.addEventListener('pointerdown', (e) => {
    arrastre = { x: e.clientX, y: e.clientY, antes: e.clientX, movido: false, id: e.pointerId };
  });
  lienzoGl.addEventListener('pointermove', (e) => {
    if (arrastre && arrastre.id === e.pointerId) {
      const dx = e.clientX - arrastre.antes;
      arrastre.antes = e.clientX;
      if (Math.abs(e.clientX - arrastre.x) > 6) {
        if (!arrastre.movido) lienzoGl.setPointerCapture(e.pointerId);
        arrastre.movido = true;
      }
      if (arrastre.movido) {
        giroY += dx * 0.006;
        impulso = dx * 0.006;
        pedir();
      }
      return;
    }
    if (e.pointerType === 'mouse' && !fijada) elegir(tocada(e));
  });
  const soltar = (e) => {
    if (!arrastre || arrastre.id !== e.pointerId) return;
    const toque = !arrastre.movido;
    arrastre = null;
    if (!toque || e.type === 'pointercancel') return;
    const i = tocada(e);
    if (e.pointerType === 'mouse') {
      if (i >= 0) location.href = `${materias[i].s}/index.html`;
      return;
    }
    // On a touch screen the first tap shows the subject, and its card is the link.
    fijada = i >= 0;
    elegir(i);
  };
  lienzoGl.addEventListener('pointerup', soltar);
  lienzoGl.addEventListener('pointercancel', soltar);
  lienzoGl.addEventListener('pointerleave', (e) => {
    if (e.pointerType === 'mouse' && !fijada && !arrastre) elegir(-1);
  });

  let visible = true;
  let cuadro = 0;
  let reloj = 0;
  let previo = performance.now();
  let pendiente = false;
  function pedir() {
    if (!cuadro && visible) cuadro = requestAnimationFrame(dibujar);
    pendiente = true;
  }
  function dibujar(ahora) {
    cuadro = 0;
    // The first frame's time can come before the moment the scene started. Time never goes back.
    const dt = Math.max(0, Math.min(0.05, (ahora - previo) / 1000));
    previo = ahora;
    // The system setting or the site's own «Sin animaciones»: either one freezes the scene, dragging still turns it.
    const quieto = reducido.matches || document.documentElement.hasAttribute('data-quieto');
    if (!quieto) reloj += dt;
    if (!arrastre) {
      giroY += impulso;
      impulso *= 0.92;
      if (Math.abs(impulso) < 1e-4) impulso = 0;
    }
    todo.rotation.y = giroY + (quieto ? 0 : Math.sin(reloj * 0.15) * 0.12);
    libro.position.y = quieto ? 0 : Math.sin(reloj * 0.7) * 0.06;
    anillo.rotation.z = reloj * 0.4;
    puntos.rotation.y = reloj * 0.02;

    if (quieto) {
      // Still, it shows the cover. When the motion comes back, the next frame puts the right pages again.
      doblar(0);
      ladoA.map = paginas[0];
      frente.map = paginas[1];
      vuelta = -1;
    } else {
      const fase = reloj % CADA;
      const nueva = Math.floor(reloj / CADA);
      if (nueva !== vuelta) {
        vuelta = nueva;
        ponerPaginas();
      }
      // Each page rests first and turns at the end of its turn, so the cover is read before it goes.
      const giro = fase - (CADA - DURA);
      doblar(giro > 0 ? ida(giro / DURA) * Math.PI * 2 : 0);
    }
    ubicar(reloj);
    renderer.render(escena, camara);
    mostrarFicha();
    caja.classList.add('in-lista');
    pendiente = false;
    if (!quieto || impulso || arrastre) pedir();
  }

  new ResizeObserver(acomodar).observe(caja);
  new IntersectionObserver(([e]) => {
    visible = e.isIntersecting;
    if (visible) {
      previo = performance.now();
      pedir();
    }
  }).observe(caja);
  document.addEventListener('visibilitychange', () => {
    visible = !document.hidden;
    if (visible) {
      previo = performance.now();
      pedir();
    }
  });
  new MutationObserver(colores).observe(document.documentElement, { attributes: true, attributeFilter: ['data-tema', 'data-quieto'] });
  reducido.addEventListener('change', pedir);
  document.addEventListener('pointerdown', (e) => {
    if (fijada && !caja.contains(e.target) && !ficha.contains(e.target)) {
      fijada = false;
      elegir(-1);
    }
  });
  colores();
  acomodar();
  if (pendiente) pedir();
}
