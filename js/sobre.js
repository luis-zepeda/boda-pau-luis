// Apertura de la invitación: sobre 3D con sello de lacre (Three.js).
// Si algo falla (sin WebGL, sin red), main.js muestra un botón para abrir sin 3D.

const root = document.documentElement;
const overlay = document.getElementById("sobre");

if (overlay && root.classList.contains("sobre-activo")) {
  start().catch((err) => {
    console.warn("Sobre 3D no disponible:", err);
    window.mostrarRespaldoSobre?.();
  });
}

/* ---------- Utilidades ---------- */
const clamp01 = (x) => Math.min(1, Math.max(0, x));
const seg = (s, start, dur) => clamp01((s - start) / dur);
const lerp = (a, b, t) => a + (b - a) * t;
const easeIn = (t) => t * t;
const easeOut = (t) => 1 - (1 - t) ** 3;
const easeInOut = (t) => (t < 0.5 ? 4 * t ** 3 : 1 - (-2 * t + 2) ** 3 / 2);

const COLORS = {
  paper: "#EFE3CC",
  paperLight: "#F4EBDA",
  card: "#FFFDF9",
  olive: "#5E6B4A",
  cream: "#F6F0E6",
  terracotta: "#A8573A",
  wax: "#9A3B25",
  ink: "#3B2A20",
  inkSoft: "#6B5646",
};

// Medidas del sobre en unidades de la escena.
const W = 3.2;            // ancho del sobre
const H = 2.1;            // alto del sobre
const FH = H * 0.62;      // alto de la solapa
const NOTCH_Y = -0.05;    // vértice de la "V" del bolsillo
const CW = 2.9;           // ancho de la tarjeta
const CH = 1.9;           // alto de la tarjeta
const PX = 500;           // pixeles de textura por unidad

function makeCanvas(w, h) {
  const c = document.createElement("canvas");
  c.width = Math.round(w);
  c.height = Math.round(h);
  return [c, c.getContext("2d")];
}

function paper(ctx, w, h, base, amount = 10) {
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, w, h);
  const img = ctx.getImageData(0, 0, w, h);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const n = (Math.random() - 0.5) * amount;
    d[i] += n; d[i + 1] += n; d[i + 2] += n;
  }
  ctx.putImageData(img, 0, 0);
  // Fibras del papel
  ctx.globalAlpha = 0.06;
  ctx.strokeStyle = "#8A7358";
  ctx.lineWidth = 1;
  for (let i = 0; i < (w * h) / 5000; i++) {
    const x = Math.random() * w, y = Math.random() * h;
    const a = Math.random() * Math.PI, l = 6 + Math.random() * 18;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
}

function fitFont(ctx, text, family, size, maxWidth) {
  do {
    ctx.font = `${size}px ${family}`;
    size -= 4;
  } while (ctx.measureText(text).width > maxWidth && size > 20);
}

function waitFonts() {
  const fonts = [
    '400 100px "Great Vibes"',
    '500 100px "Cormorant Garamond"',
    '500 40px "Montserrat"',
  ].map((f) => document.fonts.load(f));
  return Promise.race([Promise.all(fonts), new Promise((r) => setTimeout(r, 2500))]);
}

// El nombre viene de Google Sheets (js/main.js); si tarda más de 4 s, el sobre dice "Pau & Luis".
function guestName() {
  const timeout = new Promise((r) => setTimeout(() => r(null), 4000));
  return Promise.race([window.invitadoListo || null, timeout])
    .then((guest) => guest?.nombre || null)
    .catch(() => null);
}

/* ---------- Escena ---------- */
async function start() {
  const [THREE, , guest] = await Promise.all([import("three"), waitFonts(), guestName()]);

  // Si mientras cargaba ya se mostró el respaldo o se cerró el sobre, no hacer nada.
  if (window.__sobreRespaldo || !overlay.isConnected || root.classList.contains("sobre-saliendo")) return;

  const canvas = overlay.querySelector(".sobre__canvas");
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setClearColor(0x000000, 0);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  const maxAniso = Math.min(8, renderer.capabilities.getMaxAnisotropy());

  const texture = (c) => {
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = maxAniso;
    return t;
  };

  // Ajusta las UV de un ShapeGeometry para que la textura cubra el rectángulo dado.
  const fitUV = (geom, x0, y0, w, h) => {
    const pos = geom.attributes.position;
    const uv = geom.attributes.uv;
    for (let i = 0; i < pos.count; i++) {
      uv.setXY(i, (pos.getX(i) - x0) / w, (pos.getY(i) - y0) / h);
    }
    uv.needsUpdate = true;
  };

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(30, 1, 0.5, 100);

  scene.add(new THREE.HemisphereLight(0xfff6ea, 0xb89a7a, 1.6));
  const sun = new THREE.DirectionalLight(0xffffff, 1.5);
  sun.position.set(-3, 4, 6);
  scene.add(sun);

  /* ----- Texturas ----- */

  // Forro interior: verde olivo con rombos crema.
  const [linerC, lx] = makeCanvas(256, 256);
  lx.fillStyle = COLORS.olive;
  lx.fillRect(0, 0, 256, 256);
  lx.fillStyle = "rgba(246, 240, 230, 0.35)";
  for (let y = 0; y < 256; y += 64) {
    for (let x = 0; x < 256; x += 64) {
      for (const [ox, oy] of [[0, 0], [32, 32]]) {
        lx.save();
        lx.translate(x + ox + 16, y + oy + 16);
        lx.rotate(Math.PI / 4);
        lx.fillRect(-5, -5, 10, 10);
        lx.restore();
      }
    }
  }
  const linerTex = texture(linerC);
  linerTex.wrapS = linerTex.wrapT = THREE.RepeatWrapping;
  linerTex.repeat.set(5, 3.3);

  // Bolsillo (frente visible del reverso del sobre) con el nombre del invitado.
  const [pocketC, px] = makeCanvas(W * PX, H * PX);
  const pw = pocketC.width, ph = pocketC.height;
  paper(px, pw, ph, COLORS.paper);
  const toCanvasY = (y) => (H / 2 - y) * PX;
  // Pliegue de la solapa inferior
  px.strokeStyle = "rgba(59, 42, 32, 0.14)";
  px.lineWidth = 3;
  px.beginPath();
  px.moveTo(0, ph);
  px.lineTo(pw / 2, toCanvasY(-0.2));
  px.lineTo(pw, ph);
  px.stroke();
  // Borde de la "V"
  px.strokeStyle = "rgba(59, 42, 32, 0.2)";
  px.lineWidth = 5;
  px.beginPath();
  px.moveTo(0, 0);
  px.lineTo(pw / 2, toCanvasY(NOTCH_Y));
  px.lineTo(pw, 0);
  px.stroke();
  // Nombre
  const name = guest || "Pau & Luis";
  px.fillStyle = COLORS.ink;
  px.textAlign = "center";
  px.textBaseline = "middle";
  fitFont(px, name, '"Great Vibes", cursive', 0.26 * PX, pw * 0.78);
  px.fillText(name, pw / 2, toCanvasY(-0.74));
  const pocketTex = texture(pocketC);

  // Solapa
  const [flapC, fx] = makeCanvas(W * PX, FH * PX);
  paper(fx, flapC.width, flapC.height, COLORS.paperLight);
  const hingeShade = fx.createLinearGradient(0, 0, 0, flapC.height * 0.35);
  hingeShade.addColorStop(0, "rgba(59, 42, 32, 0.08)");
  hingeShade.addColorStop(1, "rgba(59, 42, 32, 0)");
  fx.fillStyle = hingeShade;
  fx.fillRect(0, 0, flapC.width, flapC.height);
  fx.strokeStyle = "rgba(59, 42, 32, 0.22)";
  fx.lineWidth = 6;
  fx.beginPath();
  fx.moveTo(0, 0);
  fx.lineTo(flapC.width / 2, flapC.height);
  fx.lineTo(flapC.width, 0);
  fx.stroke();
  const flapTex = texture(flapC);

  // Tarjeta
  const [cardC, cx] = makeCanvas(CW * PX, CH * PX);
  const cw = cardC.width, ch = cardC.height;
  paper(cx, cw, ch, COLORS.card, 4);
  cx.strokeStyle = "rgba(168, 87, 58, 0.55)";
  cx.lineWidth = 3;
  cx.strokeRect(34, 34, cw - 68, ch - 68);
  cx.lineWidth = 1.5;
  cx.strokeRect(48, 48, cw - 96, ch - 96);
  cx.textAlign = "center";
  cx.textBaseline = "middle";
  cx.fillStyle = COLORS.terracotta;
  cx.font = '500 34px "Montserrat", sans-serif';
  if ("letterSpacing" in cx) cx.letterSpacing = "12px";
  cx.fillText("NOS CASAMOS", cw / 2, ch * 0.24);
  if ("letterSpacing" in cx) cx.letterSpacing = "0px";
  cx.fillStyle = COLORS.ink;
  cx.font = '400 200px "Great Vibes", cursive';
  cx.fillText("Pau & Luis", cw / 2, ch * 0.47);
  // Ornamento línea — rombo — línea
  cx.strokeStyle = "#D9C7A7";
  cx.lineWidth = 2;
  cx.beginPath();
  cx.moveTo(cw / 2 - 170, ch * 0.63); cx.lineTo(cw / 2 - 22, ch * 0.63);
  cx.moveTo(cw / 2 + 22, ch * 0.63); cx.lineTo(cw / 2 + 170, ch * 0.63);
  cx.stroke();
  cx.save();
  cx.translate(cw / 2, ch * 0.63);
  cx.rotate(Math.PI / 4);
  cx.fillStyle = COLORS.terracotta;
  cx.fillRect(-7, -7, 14, 14);
  cx.restore();
  cx.fillStyle = COLORS.ink;
  cx.font = '500 72px "Cormorant Garamond", serif';
  if ("letterSpacing" in cx) cx.letterSpacing = "10px";
  cx.fillText("20 · 03 · 2027", cw / 2, ch * 0.74);
  cx.fillStyle = COLORS.inkSoft;
  cx.font = '400 26px "Montserrat", sans-serif';
  if ("letterSpacing" in cx) cx.letterSpacing = "8px";
  cx.fillText("HACIENDA CHIMALPA · HIDALGO", cw / 2, ch * 0.84);
  const cardTex = texture(cardC);

  // Cara del sello: relieve con "P&L".
  const [sealC, sx] = makeCanvas(512, 512);
  const wax = sx.createRadialGradient(220, 210, 20, 256, 256, 256);
  wax.addColorStop(0, "#B24E33");
  wax.addColorStop(1, "#80311D");
  sx.fillStyle = wax;
  sx.fillRect(0, 0, 512, 512);
  const emboss = (draw) => {
    sx.save(); sx.translate(4, 4); sx.fillStyle = sx.strokeStyle = "rgba(40, 10, 4, 0.45)"; draw(); sx.restore();
    sx.save(); sx.translate(-3, -3); sx.fillStyle = sx.strokeStyle = "rgba(255, 190, 160, 0.35)"; draw(); sx.restore();
    sx.save(); sx.fillStyle = sx.strokeStyle = "#8E3620"; draw(); sx.restore();
  };
  emboss(() => {
    sx.lineWidth = 8;
    sx.beginPath();
    sx.arc(256, 256, 214, 0, Math.PI * 2);
    sx.stroke();
  });
  emboss(() => {
    sx.textAlign = "center";
    sx.textBaseline = "middle";
    sx.font = '400 200px "Great Vibes", cursive';
    sx.fillText("P&L", 256, 272);
  });
  const sealTex = texture(sealC);

  // Sombra suave debajo del sobre.
  const [shadowC, shx] = makeCanvas(256, 256);
  const sg = shx.createRadialGradient(128, 128, 0, 128, 128, 128);
  sg.addColorStop(0, "rgba(59, 42, 32, 0.35)");
  sg.addColorStop(0.6, "rgba(59, 42, 32, 0.12)");
  sg.addColorStop(1, "rgba(59, 42, 32, 0)");
  shx.fillStyle = sg;
  shx.fillRect(0, 0, 256, 256);
  const shadowTex = texture(shadowC);

  /* ----- Geometría ----- */
  const envelope = new THREE.Group();
  scene.add(envelope);

  const shadow = new THREE.Mesh(
    new THREE.PlaneGeometry(W * 1.6, H * 1.7),
    new THREE.MeshBasicMaterial({ map: shadowTex, transparent: true, depthWrite: false }),
  );
  shadow.position.set(0.08, -0.18, -0.4);
  scene.add(shadow);

  // Fondo interior del sobre (forro)
  const back = new THREE.Mesh(
    new THREE.PlaneGeometry(W, H),
    new THREE.MeshStandardMaterial({ map: linerTex, roughness: 0.9, side: THREE.DoubleSide }),
  );
  envelope.add(back);

  // Tarjeta
  const card = new THREE.Mesh(
    new THREE.PlaneGeometry(CW, CH),
    new THREE.MeshStandardMaterial({ map: cardTex, roughness: 0.85, emissive: 0xffffff, emissiveMap: cardTex, emissiveIntensity: 0.3 }),
  );
  card.position.set(0, -0.08, 0.01);
  envelope.add(card);

  // Bolsillo con la "V"
  const pocketShape = new THREE.Shape();
  pocketShape.moveTo(-W / 2, -H / 2);
  pocketShape.lineTo(W / 2, -H / 2);
  pocketShape.lineTo(W / 2, H / 2);
  pocketShape.lineTo(0, NOTCH_Y);
  pocketShape.lineTo(-W / 2, H / 2);
  pocketShape.closePath();
  const pocketGeom = new THREE.ShapeGeometry(pocketShape);
  fitUV(pocketGeom, -W / 2, -H / 2, W, H);
  const pocket = new THREE.Mesh(
    pocketGeom,
    new THREE.MeshStandardMaterial({ map: pocketTex, roughness: 0.9, side: THREE.DoubleSide }),
  );
  pocket.position.z = 0.02;
  envelope.add(pocket);

  // Solapa: gira sobre la bisagra (borde superior del sobre).
  const tipX = 0.2;
  const flapShape = new THREE.Shape();
  flapShape.moveTo(-W / 2, 0);
  flapShape.lineTo(-tipX, -FH * (1 - tipX / (W / 2)));
  flapShape.quadraticCurveTo(0, -FH - 0.02, tipX, -FH * (1 - tipX / (W / 2)));
  flapShape.lineTo(W / 2, 0);
  flapShape.closePath();
  const flapGeom = new THREE.ShapeGeometry(flapShape, 16);
  fitUV(flapGeom, -W / 2, -FH, W, FH);

  const flap = new THREE.Group();
  flap.position.set(0, H / 2, 0.03);
  envelope.add(flap);
  flap.add(new THREE.Mesh(flapGeom, new THREE.MeshStandardMaterial({ map: flapTex, roughness: 0.9, side: THREE.FrontSide })));
  flap.add(new THREE.Mesh(flapGeom, new THREE.MeshStandardMaterial({ map: linerTex, roughness: 0.9, side: THREE.BackSide })));
  const flapShadowMat = new THREE.MeshBasicMaterial({ color: 0x3b2a20, transparent: true, opacity: 0.12, depthWrite: false });
  const flapShadow = new THREE.Mesh(flapGeom, flapShadowMat);
  flapShadow.position.set(0, -0.035, -0.005);
  flapShadow.scale.set(1.01, 1.02, 1);
  flap.add(flapShadow);

  // Sello de lacre, hecho de dos mitades que se separan al abrir.
  const R = 0.36, T = 0.08;
  const profile = [
    [0, -T / 2], [R * 0.92, -T / 2], [R, -T / 2 + 0.018],
    [R * 1.01, T / 2 - 0.022], [R * 0.93, T / 2], [0, T / 2],
  ].map(([x, y]) => new THREE.Vector2(x, y));
  const wobble = (a) => 1 + 0.05 * Math.sin(5 * a) + 0.03 * Math.sin(9 * a + 1.3) + 0.02 * Math.sin(14 * a + 0.4);
  const sealBodyMat = new THREE.MeshStandardMaterial({ color: COLORS.wax, roughness: 0.35, transparent: true, side: THREE.DoubleSide });
  const sealFaceMat = new THREE.MeshStandardMaterial({ map: sealTex, roughness: 0.45, transparent: true });

  const seal = new THREE.Group();
  seal.position.set(0, H / 2 - FH + 0.12, 0.03 + T / 2 + 0.01);
  envelope.add(seal);

  const halves = [0, 1].map((i) => {
    const body = new THREE.LatheGeometry(profile, 36, i * Math.PI, Math.PI);
    body.rotateX(Math.PI / 2); // eje del torno hacia la cámara
    const pos = body.attributes.position;
    for (let v = 0; v < pos.count; v++) {
      const x = pos.getX(v), y = pos.getY(v);
      const f = wobble(Math.atan2(y, x));
      pos.setXY(v, x * f, y * f);
    }
    body.computeVertexNormals();

    const face = new THREE.CircleGeometry(R * 0.82, 36, i === 0 ? -Math.PI / 2 : Math.PI / 2, Math.PI);
    const cut = new THREE.PlaneGeometry(T * 0.9, 2 * R * 0.95);
    cut.rotateY(Math.PI / 2);

    const half = new THREE.Group();
    half.add(new THREE.Mesh(body, sealBodyMat));
    const faceMesh = new THREE.Mesh(face, sealFaceMat);
    faceMesh.position.z = T / 2 + 0.002;
    half.add(faceMesh);
    half.add(new THREE.Mesh(cut, sealBodyMat));
    seal.add(half);
    return half;
  });

  /* ----- Cámara ----- */
  const vfov = THREE.MathUtils.degToRad(camera.fov);
  const fitDistance = (w, h) =>
    Math.max(h / 2 / Math.tan(vfov / 2), w / 2 / (Math.tan(vfov / 2) * camera.aspect));

  let viewW = 0, viewH = 0;
  function onResize() {
    viewW = overlay.clientWidth;
    viewH = overlay.clientHeight;
    renderer.setSize(viewW, viewH, false);
    camera.aspect = viewW / viewH;
    camera.updateProjectionMatrix();
  }
  window.addEventListener("resize", onResize);
  onResize();

  /* ----- Interacción ----- */
  const pointer = { x: 0, y: 0, tx: 0, ty: 0 };
  overlay.addEventListener("pointermove", (e) => {
    pointer.tx = (e.clientX / viewW) * 2 - 1;
    pointer.ty = (e.clientY / viewH) * 2 - 1;
  });

  const hint = document.getElementById("sobre-hint");
  let openedAt = null;
  let closeCalled = false;

  overlay.addEventListener("click", () => {
    if (openedAt !== null) return;
    openedAt = performance.now();
    hint.hidden = true;
    window.iniciarMusica?.();
  });

  /* ----- Animación ----- */
  const clock = new THREE.Clock();
  const cardWorld = new THREE.Vector3();

  function frame() {
    const t = clock.getElapsedTime();
    const s = openedAt === null ? 0 : (performance.now() - openedAt) / 1000;

    pointer.x = lerp(pointer.x, pointer.tx, 0.06);
    pointer.y = lerp(pointer.y, pointer.ty, 0.06);

    // Flotación e inclinación mientras está cerrado
    const idle = 1 - easeInOut(seg(s, 0, 0.8));
    envelope.rotation.y = idle * (0.06 * Math.sin(t * 0.7) + pointer.x * 0.2);
    envelope.rotation.x = idle * (-0.06 + 0.04 * Math.sin(t * 0.9) + pointer.y * 0.14);
    envelope.position.y = idle * 0.05 * Math.sin(t * 1.1);
    shadow.position.x = 0.08 - envelope.rotation.y * 0.6;
    shadow.scale.setScalar(1 - envelope.position.y * 0.5);

    // 1. El sello se parte y cae
    const fall = easeIn(seg(s, 0.05, 0.8));
    const crack = easeOut(seg(s, 0, 0.25));
    halves.forEach((half, i) => {
      const dir = i === 0 ? 1 : -1;
      half.position.x = dir * (0.03 * crack + 0.35 * fall);
      half.position.y = -2.4 * fall;
      half.position.z = 0.4 * fall;
      half.rotation.z = -dir * 1.1 * fall;
      half.rotation.y = dir * 0.7 * fall;
    });
    const sealOpacity = 1 - seg(s, 0.45, 0.4);
    sealBodyMat.opacity = sealFaceMat.opacity = sealOpacity;
    seal.visible = sealOpacity > 0;

    // 2. Se abre la solapa
    const open = easeInOut(seg(s, 0.35, 1.1));
    flap.rotation.x = -Math.PI * 1.03 * open;
    flap.position.z = flap.rotation.x < -Math.PI / 2 ? -0.05 : 0.03;
    flapShadowMat.opacity = 0.12 * (1 - seg(s, 0.35, 0.3));

    // 3. Sale la tarjeta
    const slide = easeInOut(seg(s, 1.3, 1.1));
    const zoom = easeInOut(seg(s, 2.35, 1.0));
    card.position.y = -0.08 + 1.85 * slide + 0.3 * zoom;
    card.position.z = 0.01 + 0.4 * zoom;

    shadow.material.opacity = 1 - seg(s, 1.2, 0.8);

    // Cámara: sigue la tarjeta y al final se acerca a ella
    const reveal = easeInOut(seg(s, 1.2, 1.2));
    const idleDist = fitDistance(W * 1.15, H * 2.0);
    const openDist = fitDistance(W * 1.3, 4.4);
    card.getWorldPosition(cardWorld);
    const cardDist = fitDistance(CW * 1.06, CH * 1.06);
    const targetY = lerp(lerp(0, 0.85, reveal), cardWorld.y, zoom);
    const dist = lerp(lerp(idleDist, openDist, reveal), cardDist + cardWorld.z, zoom);
    camera.position.set(0, targetY, dist);
    camera.lookAt(0, targetY, 0);

    renderer.render(scene, camera);

    if (!window.__sobreListo) {
      window.__sobreListo = true;
      overlay.classList.add("is-3d");
      hint.hidden = false;
    }

    // 4. Se desvanece el sobre y aparece la invitación
    if (s > 2.9 && !closeCalled) {
      closeCalled = true;
      window.cerrarSobre?.();
    }
  }
  renderer.setAnimationLoop(frame);

  window.__sobreCleanup = () => {
    renderer.setAnimationLoop(null);
    window.removeEventListener("resize", onResize);
    scene.traverse((o) => {
      o.geometry?.dispose();
      [].concat(o.material || []).forEach((m) => {
        m.map?.dispose();
        m.dispose();
      });
    });
    renderer.dispose();
  };
}
