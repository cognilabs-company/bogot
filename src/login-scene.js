// "Quyosh fermasi" — the 3D solar-farm scene behind the login card.
// Loaded lazily (dynamic import) by Login in src/shell.jsx after the form has rendered,
// so three.js lives in its own chunk. Everything here is decorative: the host element is
// aria-hidden and the form never waits for this module.
import {
  WebGLRenderer, Scene, PerspectiveCamera, Color, Vector2, Vector3, Matrix4, Quaternion, Euler,
  BoxGeometry, PlaneGeometry, SphereGeometry, BufferGeometry, BufferAttribute, InstancedBufferAttribute,
  InstancedMesh, Mesh, Points, ShaderMaterial, MeshBasicMaterial, CanvasTexture,
  AdditiveBlending, NormalBlending, BackSide, DoubleSide, Raycaster, Plane, ACESFilmicToneMapping,
  SRGBColorSpace, RepeatWrapping, MathUtils,
} from "three";

const clamp01 = (v) => Math.min(1, Math.max(0, v));
const smooth = (t) => { t = clamp01(t); return t * t * (3 - 2 * t); };
const easeOut = (t) => 1 - Math.pow(1 - clamp01(t), 3);
const damp = (cur, target, lambda, dt) => cur + (target - cur) * (1 - Math.exp(-lambda * dt));

// Colour palettes. "night" is the pre-dawn start of the intro; the theme palette is where it ends.
const PALETTES = {
  night: { top: "#03050d", mid: "#0a0f24", horizon: "#1b1a36", ground: "#07080c", sun: "#ff7a3d", fog: "#0d0f22", cell: "#050b1c", hemiSky: "#1a2040", sunEl: -0.05 },
  dark: { top: "#0b1233", mid: "#33295a", horizon: "#ff9d5c", ground: "#141412", sun: "#ffc98a", fog: "#4a3552", cell: "#173a7c", hemiSky: "#6a5a8a", sunEl: 0.085, exposure: 1.0, energy: "#ffc152" },
  light: { top: "#1560c4", mid: "#4f98e6", horizon: "#bcd9f0", ground: "#5f7a3c", sun: "#fff1cc", fog: "#a9c8e6", cell: "#1b3f86", hemiSky: "#bcd7f2", sunEl: 0.2, exposure: 0.88, energy: "#ff9b1a" },
};

const ROW_GAP = 7.6;
const ROWS = 13;
const ROW_Z0 = -1.5; // nearest row (camera sits at z = 10)
const MOD_W = 1.0, MOD_D = 1.66, MOD_GAP = 0.035, TILT = 0.36;
const SUN_DIST = 300;

function webglOk() {
  try {
    const c = document.createElement("canvas");
    return !!(window.WebGLRenderingContext && (c.getContext("webgl2") || c.getContext("webgl")));
  } catch { return false; }
}

function cloudTexture() {
  const c = document.createElement("canvas");
  c.width = 512; c.height = 256;
  const g = c.getContext("2d");
  const blobs = [[150, 160, 80], [230, 130, 100], [320, 150, 85], [390, 170, 60], [100, 185, 50], [260, 185, 95], [190, 190, 70]];
  for (const [x, y, r] of blobs) {
    const grd = g.createRadialGradient(x, y, r * 0.1, x, y, r);
    grd.addColorStop(0, "rgba(255,255,255,0.95)");
    grd.addColorStop(0.55, "rgba(255,255,255,0.6)");
    grd.addColorStop(1, "rgba(255,255,255,0)");
    g.fillStyle = grd;
    g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
  }
  const t = new CanvasTexture(c);
  t.colorSpace = SRGBColorSpace;
  return t;
}

function groundTexture() {
  const c = document.createElement("canvas");
  c.width = c.height = 256;
  const g = c.getContext("2d");
  const img = g.createImageData(256, 256);
  for (let i = 0; i < img.data.length; i += 4) {
    const v = 200 + Math.random() * 55;
    img.data[i] = img.data[i + 1] = img.data[i + 2] = v; img.data[i + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  const t = new CanvasTexture(c);
  t.wrapS = t.wrapT = RepeatWrapping;
  t.repeat.set(120, 120);
  return t;
}

const FOG_GLSL = `
  uniform vec3 uFogColor; uniform float uFogNear; uniform float uFogFar;
  vec3 applyFog(vec3 col, float dist) { return mix(col, uFogColor, smoothstep(uFogNear, uFogFar, dist)); }
`;

export function createSolarScene(host, opts = {}) {
  if (!webglOk()) throw new Error("webgl-unavailable");
  const still = !!opts.still;
  const renderer = new WebGLRenderer({ antialias: true, alpha: false, powerPreference: "high-performance" });
  let dpr = Math.min(window.devicePixelRatio || 1, 2);
  renderer.setPixelRatio(dpr);
  renderer.toneMapping = ACESFilmicToneMapping;
  renderer.outputColorSpace = SRGBColorSpace;
  const canvas = renderer.domElement;
  canvas.className = "tg-login-canvas";
  canvas.setAttribute("aria-hidden", "true");
  host.appendChild(canvas);

  const scene = new Scene();
  const camera = new PerspectiveCamera(40, 1, 0.1, 700);
  const disposables = [];
  const track = (o) => { disposables.push(o); return o; };

  // ---------- shared uniforms ----------
  const U = {
    uTime: { value: 0 },
    uSunDir: { value: new Vector3(0, 0.1, -1).normalize() },
    uSunColor: { value: new Color() },
    uEnergy: { value: new Color() },
    uFogColor: { value: new Color() },
    uFogNear: { value: 28 },
    uFogFar: { value: 108 },
    uSkyLow: { value: new Color() },
    uSkyHigh: { value: new Color() },
  };

  // ---------- sky ----------
  const skyMat = track(new ShaderMaterial({
    side: BackSide, depthWrite: false, fog: false,
    uniforms: {
      ...U,
      uTop: { value: new Color() }, uMid: { value: new Color() }, uHorizon: { value: new Color() }, uGround: { value: new Color() },
      uNight: { value: 1 }, uCloud: { value: 0 }, uFlash: { value: 0 }, uGlow: { value: 1 },
    },
    vertexShader: `varying vec3 vDir; void main(){ vDir = position; vec4 p = projectionMatrix * modelViewMatrix * vec4(position,1.); gl_Position = p.xyww; }`,
    fragmentShader: `
      varying vec3 vDir;
      uniform vec3 uTop, uMid, uHorizon, uGround, uSunColor, uSunDir;
      uniform float uNight, uCloud, uFlash, uTime, uGlow;
      float hash(vec3 p){ return fract(sin(dot(p, vec3(12.9898,78.233,37.719))) * 43758.5453); }
      void main(){
        vec3 d = normalize(vDir);
        float h = d.y;
        vec3 col = mix(uHorizon, uMid, smoothstep(0.0, 0.09, h));
        col = mix(col, uTop, smoothstep(0.07, 0.32, h));
        col = mix(col, uGround, smoothstep(0.0, -0.04, h));
        float s = max(dot(d, uSunDir), 0.0);
        float veil = 1.0 - uCloud * 0.55;
        col += uSunColor * (pow(s, 6.0) * 0.28 * uGlow + pow(s, 48.0) * 0.55) * veil;
        col += uSunColor * 0.22 * exp(-abs(h) * 16.0) * pow(s, 3.0) * veil;
        vec3 q = floor(d * 420.0);
        float st = step(0.9982, hash(q)) * smoothstep(0.03, 0.25, h);
        st *= 0.6 + 0.4 * sin(uTime * 2.0 + hash(q + 3.1) * 40.0);
        col += vec3(st) * uNight * 0.9;
        col = mix(col, uSunColor * 1.6, uFlash * (0.35 + 0.65 * pow(s, 2.0)));
        gl_FragColor = vec4(col, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  }));
  const sky = new Mesh(track(new SphereGeometry(600, 32, 16)), skyMat);
  sky.frustumCulled = false;
  scene.add(sky);

  // ---------- sun ----------
  const sunMat = track(new ShaderMaterial({
    transparent: true, depthWrite: false, blending: AdditiveBlending, fog: false,
    uniforms: { ...U, uOpacity: { value: 1 }, uFlare: { value: 0 } },
    vertexShader: `varying vec2 vUv; void main(){ vUv = uv * 2.0 - 1.0; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.); }`,
    fragmentShader: `
      varying vec2 vUv; uniform vec3 uSunColor; uniform float uOpacity, uFlare, uTime;
      void main(){
        float r = length(vUv);
        float core = smoothstep(0.16, 0.13, r);
        float halo = exp(-r * 5.5) * 0.85 + exp(-r * 14.0) * 0.6;
        float a = atan(vUv.y, vUv.x);
        float rays = pow(abs(sin(a * 7.0 + uTime * 0.08)), 14.0) * exp(-r * 3.2) * (0.18 + uFlare * 0.6);
        float glow = core * 1.6 + halo + rays + uFlare * exp(-r * 2.0) * 1.4;
        vec3 col = mix(uSunColor, vec3(1.0, 0.98, 0.94), core);
        gl_FragColor = vec4(col * glow * uOpacity, 1.0);
      }`,
  }));
  const sun = new Mesh(track(new PlaneGeometry(1, 1)), sunMat);
  sun.renderOrder = 1;
  scene.add(sun);

  // ---------- cloud (password focus / error) ----------
  const cloudTex = track(cloudTexture());
  const cloudMat = track(new MeshBasicMaterial({ map: cloudTex, transparent: true, depthWrite: false, fog: false, opacity: 0, color: new Color("#ffffff") }));
  const cloud = new Mesh(track(new PlaneGeometry(1, 0.5)), cloudMat);
  cloud.renderOrder = 2;
  scene.add(cloud);

  // ---------- ground ----------
  const groundTex = track(groundTexture());
  const groundMat = track(new ShaderMaterial({
    uniforms: { ...U, uMap: { value: groundTex }, uGround: { value: new Color() }, uDim: { value: 0 }, uGrey: { value: 0 }, uFlash: { value: 0 }, uLight: { value: 0 } },
    vertexShader: `varying vec3 vWorld; varying vec2 vUv; void main(){ vUv = uv * 120.0; vec4 w = modelMatrix * vec4(position,1.); vWorld = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`,
    fragmentShader: `
      varying vec3 vWorld; varying vec2 vUv;
      uniform sampler2D uMap; uniform vec3 uGround, uSunColor, uSunDir; uniform float uDim, uGrey, uFlash, uLight;
      ${FOG_GLSL}
      void main(){
        float n = texture2D(uMap, vUv).r;
        vec3 col = uGround * (0.75 + 0.35 * n);
        // soft sun reflection column toward the sun direction
        vec3 V = normalize(cameraPosition - vWorld);
        vec3 R = reflect(-V, vec3(0.0, 1.0, 0.0));
        float s = max(dot(R, uSunDir), 0.0);
        col += uSunColor * pow(s, 30.0) * 0.18 * uLight;
        col *= 0.35 + 0.65 * uLight;
        float l = dot(col, vec3(0.299, 0.587, 0.114));
        col = mix(col, vec3(l), uGrey * 0.8);
        col *= 1.0 - uDim * 0.35;
        col = applyFog(col, length(vWorld - cameraPosition));
        col = mix(col, uSunColor * 1.4, uFlash * 0.55);
        gl_FragColor = vec4(col, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  }));
  const ground = new Mesh(track(new PlaneGeometry(1400, 1400)), groundMat);
  ground.rotation.x = -Math.PI / 2;
  ground.position.z = -300;
  scene.add(ground);

  // ---------- solar panel field ----------
  const modules = [];
  const rowInfo = [];
  for (let r = 0; r < ROWS; r++) {
    const z = ROW_Z0 - r * ROW_GAP;
    const dist = 10 - z;
    const half = Math.min(52, dist * 0.85 + 5);
    rowInfo.push({ z, half });
    const n = Math.floor((half * 2) / (MOD_W + MOD_GAP));
    const x0 = -(n * (MOD_W + MOD_GAP)) / 2 + (MOD_W + MOD_GAP) / 2 + (r % 2 ? 0.3 : 0);
    for (let i = 0; i < n; i++) {
      for (let k = 0; k < 2; k++) modules.push({ x: x0 + i * (MOD_W + MOD_GAP), z, k, row: r, col: i / n });
    }
  }
  const N = modules.length;
  const panelGeo = track(new BoxGeometry(MOD_W, 0.045, MOD_D));
  const aRow = new Float32Array(N), aSeed = new Float32Array(N), aHit = new Float32Array(N);
  const panelMat = track(new ShaderMaterial({
    uniforms: {
      ...U,
      uCell: { value: new Color() }, uSweep: { value: 0 }, uFull: { value: 0 }, uGrey: { value: 0 }, uDim: { value: 0 },
      uSpec: { value: 1 }, uFlash: { value: 0 }, uRows: { value: ROWS }, uPointer: { value: new Vector2() },
    },
    vertexShader: `
      attribute float aRow; attribute float aSeed; attribute float aHit;
      varying vec2 vUv; varying vec3 vN; varying vec3 vWorld; varying float vTop; varying float vRow; varying float vSeed; varying float vHit;
      void main(){
        vUv = uv; vRow = aRow; vSeed = aSeed; vHit = aHit;
        vTop = step(0.5, normal.y);
        mat4 m = modelMatrix * instanceMatrix;
        vec4 w = m * vec4(position, 1.0);
        vWorld = w.xyz;
        vN = normalize(mat3(m) * normal);
        gl_Position = projectionMatrix * viewMatrix * w;
      }`,
    fragmentShader: `
      varying vec2 vUv; varying vec3 vN; varying vec3 vWorld; varying float vTop; varying float vRow; varying float vSeed; varying float vHit;
      uniform vec3 uCell, uSunColor, uSunDir, uEnergy, uSkyLow, uSkyHigh;
      uniform float uSweep, uFull, uGrey, uDim, uSpec, uFlash, uTime;
      uniform vec2 uPointer;
      ${FOG_GLSL}
      float gridLine(vec2 g, float w){
        vec2 f = fract(g); vec2 fw = fwidth(g) * 1.2;
        vec2 e = smoothstep(vec2(w) + fw, vec2(w), min(f, 1.0 - f));
        return max(e.x, e.y);
      }
      void main(){
        vec3 N = normalize(vN);
        vec3 V = normalize(cameraPosition - vWorld);
        float p = uSweep - vRow;                    // >0 once sunlight has reached this row
        float lit = smoothstep(0.0, 0.9, p);
        float dist = length(vWorld - cameraPosition);
        vec3 col;
        if (vTop > 0.5) {
          vec2 uv = vUv;
          float fx = 0.035, fz = 0.022;
          float frame = 1.0 - step(fx, uv.x) * step(fx, 1.0 - uv.x) * step(fz, uv.y) * step(fz, 1.0 - uv.y);
          vec2 g = vec2(uv.x * 6.0, uv.y * 10.0);
          float grid = gridLine(g, 0.035) * (1.0 - frame);
          float bus = gridLine(vec2(uv.x * 18.0, 0.5), 0.02) * (1.0 - frame) * 0.5;
          vec3 base = uCell * (0.85 + 0.3 * vSeed);
          // mostly-up normal for a calm "water-like" sun reflection that slides with the camera
          vec3 Ne = normalize(mix(N, vec3(0.0, 1.0, 0.0), 0.62) + vec3(uPointer.x * 0.04, 0.0, 0.0));
          vec3 R = reflect(-V, Ne);
          float sd = max(dot(R, uSunDir), 0.0);
          float spec = (pow(sd, 300.0) * 3.4 + pow(sd, 60.0) * 0.5) * uSpec;
          float fres = pow(1.0 - max(dot(N, V), 0.0), 3.0);
          vec3 skyR = mix(uSkyLow, uSkyHigh, clamp(R.y * 2.2, 0.0, 1.0));
          float diff = max(dot(N, uSunDir), 0.0);
          col = base * (0.55 + 0.6 * diff) + skyR * (0.16 + 0.55 * fres);
          col += uSunColor * spec * (1.0 - frame * 0.5);
          col = mix(col, vec3(0.62, 0.66, 0.72) * (0.5 + 0.6 * diff) + skyR * 0.2, frame);
          col += mix(uSkyHigh, uSunColor, 0.4) * grid * 0.16;
          col += uSunColor * bus * 0.05;
          // sunrise sweep: a glint runs diagonally along the cell grid as the light arrives
          float gp = mix(-0.35, 1.35, clamp(p, 0.0, 1.0));
          float s = (uv.x + uv.y) * 0.5;
          float glint = exp(-pow((s - gp) * 7.0, 2.0)) * step(0.0, p) * step(p, 1.05);
          col += uSunColor * glint * (0.45 + grid * 2.2 + bus * 1.2);
          // photon hits + success charge
          col += uEnergy * vHit * vHit * (0.1 + grid * 0.55 + frame * 0.9);
          col += uEnergy * uFull * (0.28 + grid * 1.6 + bus);
        } else {
          float diff = max(dot(N, uSunDir), 0.0);
          col = vec3(0.5, 0.53, 0.58) * (0.35 + 0.65 * diff) + uSkyLow * 0.12;
        }
        col *= mix(0.22, 1.0, lit);
        float l = dot(col, vec3(0.299, 0.587, 0.114));
        col = mix(col, vec3(l) * 0.85, uGrey);
        col *= 1.0 - uDim * 0.35;
        col = applyFog(col, dist);
        col = mix(col, uSunColor * 1.5, uFlash * 0.5);
        gl_FragColor = vec4(col, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  }));
  const panels = new InstancedMesh(panelGeo, panelMat, N);
  const m4 = new Matrix4(), q = new Quaternion(), e = new Euler(), pos = new Vector3(), scl = new Vector3(1, 1, 1);
  const tableCenterY = 1.02;
  const modulePos = [];
  modules.forEach((m, i) => {
    // two modules per table, stacked along the tilted slope
    const off = (m.k === 0 ? 0.5 : -0.5) * (MOD_D + MOD_GAP);
    const y = tableCenterY - off * Math.sin(TILT);
    const z = m.z + off * Math.cos(TILT);
    pos.set(m.x, y, z);
    aRow[i] = (ROWS - 1) - m.row; // far rows catch the light first
    aSeed[i] = Math.random();
    modulePos.push(pos.clone());
  });
  panelGeo.setAttribute("aRow", new InstancedBufferAttribute(aRow, 1));
  panelGeo.setAttribute("aSeed", new InstancedBufferAttribute(aSeed, 1));
  const hitAttr = new InstancedBufferAttribute(aHit, 1);
  panelGeo.setAttribute("aHit", hitAttr);
  const tiltQ = new Quaternion().setFromEuler(e.set(TILT, 0, 0));
  const ZERO = new Vector3(0, 0, 0), ONE = new Vector3(1, 1, 1);
  const ROAD_HALF = 1.5;
  const roadA = new Vector2(0, 4), roadB = new Vector2(0, -12);
  const segDist = (x, z) => {
    const abx = roadB.x - roadA.x, abz = roadB.y - roadA.y;
    const t = MathUtils.clamp(((x - roadA.x) * abx + (z - roadA.y) * abz) / (abx * abx + abz * abz || 1), 0, 1.08);
    return Math.hypot(x - (roadA.x + abx * t), z - (roadA.y + abz * t));
  };
  panels.frustumCulled = false;
  scene.add(panels);

  // support posts (front + back leg every ~3.2 m)
  const legs = [];
  for (const r of rowInfo) {
    for (let x = -r.half; x <= r.half; x += 3.2) {
      legs.push([x, r.z + 1.45, 0.48]);
      legs.push([x, r.z - 1.45, 1.55]);
    }
  }
  const legGeo = track(new BoxGeometry(0.07, 1, 0.07));
  const legMat = track(new ShaderMaterial({
    uniforms: { ...U, uDim: { value: 0 }, uLight: { value: 0 }, uShade: { value: new Color("#3a3f48") } },
    vertexShader: `varying vec3 vWorld; varying vec3 vN; void main(){ mat4 m = modelMatrix * instanceMatrix; vec4 w = m * vec4(position,1.); vWorld = w.xyz; vN = normalize(mat3(m)*normal); gl_Position = projectionMatrix * viewMatrix * w; }`,
    fragmentShader: `varying vec3 vWorld; varying vec3 vN; uniform vec3 uShade, uSunDir, uSkyLow; uniform float uDim, uLight; ${FOG_GLSL}
      void main(){ float d = max(dot(normalize(vN), uSunDir), 0.0); vec3 col = uShade * (0.5 + 0.8 * d) + uSkyLow * 0.08; col *= (0.3 + 0.7 * uLight) * (1.0 - uDim * 0.35);
      col = applyFog(col, length(vWorld - cameraPosition)); gl_FragColor = vec4(col, 1.0);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
      }`,
  }));
  const legMesh = new InstancedMesh(legGeo, legMat, legs.length);
  // A service road is cut through the field under the login card; the trunk cable runs along it.
  function layoutField(ax, az) {
    roadB.set(ax, az);
    roadA.set(ax * 0.15, 4);
    const cut = (x, z) => segDist(x, z) < ROAD_HALF + 0.35;
    modules.forEach((m, i) => {
      m4.compose(modulePos[i], tiltQ, cut(modulePos[i].x, modulePos[i].z) ? ZERO : ONE);
      panels.setMatrixAt(i, m4);
    });
    panels.instanceMatrix.needsUpdate = true;
    legs.forEach(([lx, z, h], i) => {
      m4.compose(pos.set(lx, h / 2, z), q.identity(), cut(lx, z) ? ZERO : scl.set(1, h, 1));
      legMesh.setMatrixAt(i, m4);
    });
    legMesh.instanceMatrix.needsUpdate = true;
    visibleModules.length = 0;
    modules.forEach((m, i) => { if (m.row < 8 && !cut(modulePos[i].x, modulePos[i].z) && Math.abs(m.x) < 4 + (10 - m.z) * 0.55) visibleModules.push(i); });
  }
  legMesh.frustumCulled = false;
  scene.add(legMesh);

  // ---------- energy cables in the ground ----------
  const cableMat = track(new ShaderMaterial({
    transparent: true, depthWrite: false, blending: AdditiveBlending, side: DoubleSide,
    uniforms: { ...U, uPulses: { value: new Float32Array(10).fill(-999) }, uFlow: { value: 1 }, uStrength: { value: 0 }, uLen: { value: 1 }, uGrey: { value: 0 }, uFull: { value: 0 } },
    vertexShader: `attribute float aDist; attribute float aAcross; attribute float aTrunk; varying float vDist; varying float vAcross; varying float vTrunk; varying vec3 vWorld;
      void main(){ vDist = aDist; vAcross = aAcross; vTrunk = aTrunk; vec4 w = modelMatrix * vec4(position,1.); vWorld = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`,
    fragmentShader: `varying float vDist; varying float vAcross; varying float vTrunk; varying vec3 vWorld;
      uniform vec3 uEnergy; uniform float uPulses[10]; uniform float uTime, uFlow, uStrength, uLen, uGrey, uFull;
      uniform float uFogFar;
      void main(){
        float core = exp(-vAcross * vAcross * 9.0);
        float flow = smoothstep(0.82, 1.0, fract(vDist * 0.32 - uTime * 0.9 * uFlow)) * 0.55;
        float glow = (vTrunk > 0.5 ? 0.42 : 0.2) + flow;
        if (vTrunk > 0.5) {
          for (int i = 0; i < 10; i++) { float d = vDist - uPulses[i]; glow += exp(-d * d * 0.55) * 2.4; }
        }
        glow += uFull * 1.5;
        float fade = 1.0 - smoothstep(uFogFar * 0.45, uFogFar * 0.85, length(vWorld - cameraPosition));
        vec3 col = mix(uEnergy, vec3(dot(uEnergy, vec3(0.33))), uGrey);
        float a = core * glow * uStrength * fade;
        gl_FragColor = vec4(col * a, a);
      }`,
  }));
  let cableMesh = null, roadMesh = null;
  const roadMat = track(new ShaderMaterial({
    transparent: true, depthWrite: false,
    uniforms: { ...U, uGround: groundMat.uniforms.uGround, uLight: groundMat.uniforms.uLight, uDim: groundMat.uniforms.uDim, uGrey: groundMat.uniforms.uGrey },
    vertexShader: `attribute float aAcross; varying float vAcross; varying vec3 vWorld; void main(){ vAcross = aAcross; vec4 w = modelMatrix * vec4(position,1.); vWorld = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`,
    fragmentShader: `varying float vAcross; varying vec3 vWorld; uniform vec3 uGround, uSunColor; uniform float uLight, uDim, uGrey; ${FOG_GLSL}
      void main(){
        vec3 col = uGround * 2.2 + uSunColor * 0.06;
        col *= (0.35 + 0.65 * uLight) * (1.0 - uDim * 0.35);
        float l = dot(col, vec3(0.299, 0.587, 0.114)); col = mix(col, vec3(l), uGrey * 0.8);
        col = applyFog(col, length(vWorld - cameraPosition));
        float a = smoothstep(1.0, 0.6, abs(vAcross));
        gl_FragColor = vec4(col, a);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  }));
  let trunkLen = 1;
  const raycaster = new Raycaster();
  const groundPlane = new Plane(new Vector3(0, 1, 0), 0);
  const anchor = new Vector3(3, 0, 2);

  function ribbon(points, width, trunk, out, distStart = 0) {
    // points: Vector3[] along the ground; emits a flat strip
    let d = distStart;
    for (let i = 0; i < points.length; i++) {
      const p = points[i];
      const nxt = points[Math.min(i + 1, points.length - 1)];
      const prv = points[Math.max(i - 1, 0)];
      const dir = new Vector3().subVectors(nxt, prv).setY(0).normalize();
      const side = new Vector3(-dir.z, 0, dir.x).multiplyScalar(width / 2);
      if (i > 0) d += p.distanceTo(points[i - 1]);
      out.pos.push(p.x + side.x, 0.035, p.z + side.z, p.x - side.x, 0.035, p.z - side.z);
      out.dist.push(d, d); out.across.push(1, -1); out.trunk.push(trunk, trunk);
      if (i > 0) {
        const b = out.vcount + (i - 1) * 2;
        out.idx.push(b, b + 1, b + 2, b + 1, b + 3, b + 2);
      }
    }
    out.vcount += points.length * 2;
    return d;
  }

  function buildCables() {
    const out = { pos: [], dist: [], across: [], trunk: [], idx: [], vcount: 0 };
    // trunk: diagonally across the field along the service road, ending under the card
    const pts = [];
    for (let i = 0; i <= 60; i++) {
      const t = i / 60;
      pts.push(new Vector3(MathUtils.lerp(roadA.x, roadB.x, t), 0, MathUtils.lerp(roadA.y, roadB.y, t)));
    }
    trunkLen = ribbon(pts, 0.42, 1, out);
    const rOut = { pos: [], dist: [], across: [], trunk: [], idx: [], vcount: 0 };
    ribbon(pts, ROAD_HALF * 3.4, 0, rOut);
    for (let i = 1; i < rOut.pos.length; i += 3) rOut.pos[i] = 0.015;
    const rgeo = new BufferGeometry();
    rgeo.setAttribute("position", new BufferAttribute(new Float32Array(rOut.pos), 3));
    rgeo.setAttribute("aAcross", new BufferAttribute(new Float32Array(rOut.across), 1));
    rgeo.setIndex(rOut.idx);
    if (roadMesh) { roadMesh.geometry.dispose(); scene.remove(roadMesh); }
    roadMesh = new Mesh(rgeo, roadMat);
    roadMesh.material.side = DoubleSide;
    roadMesh.frustumCulled = false;
    roadMesh.renderOrder = 2;
    scene.add(roadMesh);
    // feeders in front of each row, flowing in toward the road from both sides
    for (let r = 0; r < ROWS; r++) {
      const z = rowInfo[r].z + 2.4;
      const t = (z - roadA.y) / (roadB.y - roadA.y);
      if (t < 0 || t > 1) continue;
      const rx = MathUtils.lerp(roadA.x, roadB.x, t);
      const span = Math.min(rowInfo[r].half, 10 + r * 1.8);
      for (const sgn of [-1, 1]) {
        const fp = [];
        for (let k = 0; k <= 24; k++) fp.push(new Vector3(rx + sgn * (0.3 + span * (1 - k / 24)), 0, z));
        ribbon(fp, 0.12, 0, out);
      }
    }
    const geo = new BufferGeometry();
    geo.setAttribute("position", new BufferAttribute(new Float32Array(out.pos), 3));
    geo.setAttribute("aDist", new BufferAttribute(new Float32Array(out.dist), 1));
    geo.setAttribute("aAcross", new BufferAttribute(new Float32Array(out.across), 1));
    geo.setAttribute("aTrunk", new BufferAttribute(new Float32Array(out.trunk), 1));
    geo.setIndex(out.idx);
    if (cableMesh) { cableMesh.geometry.dispose(); scene.remove(cableMesh); }
    cableMesh = new Mesh(geo, cableMat);
    cableMesh.frustumCulled = false;
    cableMesh.renderOrder = 3;
    scene.add(cableMesh);
    cableMat.uniforms.uLen.value = trunkLen;
  }

  // ---------- photons ----------
  const PHOTONS = still ? 0 : 20, TRAIL = 6;
  const photonPos = new Float32Array(Math.max(1, PHOTONS * TRAIL) * 3);
  const photonA = new Float32Array(Math.max(1, PHOTONS * TRAIL));
  const photonGeo = new BufferGeometry();
  photonGeo.setAttribute("position", new BufferAttribute(photonPos, 3));
  photonGeo.setAttribute("aAlpha", new BufferAttribute(photonA, 1));
  const photonMat = track(new ShaderMaterial({
    transparent: true, depthWrite: false, blending: AdditiveBlending,
    uniforms: { ...U, uScale: { value: 1 } },
    vertexShader: `attribute float aAlpha; varying float vA; uniform float uScale;
      void main(){ vA = aAlpha; vec4 mv = modelViewMatrix * vec4(position,1.); gl_PointSize = clamp(260.0 / -mv.z, 1.5, 9.0) * uScale * (0.4 + 0.6 * aAlpha); gl_Position = projectionMatrix * mv; }`,
    fragmentShader: `varying float vA; uniform vec3 uSunColor;
      void main(){ vec2 c = gl_PointCoord * 2.0 - 1.0; float r = dot(c,c); float a = exp(-r * 3.5) * vA; gl_FragColor = vec4(mix(uSunColor, vec3(1.0), 0.35) * a, a); }`,
  }));
  const photonPts = new Points(photonGeo, photonMat);
  photonPts.frustumCulled = false;
  photonPts.renderOrder = 4;
  scene.add(photonPts);
  track(photonGeo);
  const photons = [];
  const visibleModules = [];
  layoutField(3, -12);
  const spawnPhoton = (p, t0) => {
    const idx = visibleModules[(Math.random() * visibleModules.length) | 0];
    p.idx = idx;
    p.target = modulePos[idx];
    p.t0 = t0;
    p.dur = 1.3 + Math.random() * 0.9;
  };
  for (let i = 0; i < PHOTONS; i++) { const p = {}; spawnPhoton(p, -Math.random() * 2.2); photons.push(p); }
  const hits = new Map(); // instance index -> energy

  // ---------- state ----------
  const S = {
    theme: opts.theme === "light" ? "light" : "dark",
    t: 0, intro: still ? 10 : 0,
    pointer: new Vector2(), pointerS: new Vector2(),
    cloudTarget: 0, cloud: 0, dimTarget: 0, dim: 0,
    grey: 0, greyHold: 0,
    submitting: false, success: -1, full: 0, flash: 0,
    pulses: [], nextPulse: 0.6,
    camPush: 0, lowFpsCheck: { start: 0, frames: 0, done: still, downgraded: false },
    running: false, raf: 0, last: 0,
    w: 1, h: 1, disposed: false,
  };
  const tmpC = new Color();
  const lerpC = (key, a, b, t, target) => target.set(a).lerp(tmpC.set(b), t);

  function applyPalette() {
    const pal = PALETTES[S.theme];
    const night = PALETTES.night;
    const k = still ? 1 : smooth(S.intro / 1.25); // dawn progress
    const su = skyMat.uniforms;
    lerpC("top", night.top, pal.top, k, su.uTop.value);
    lerpC("mid", night.mid, pal.mid, k, su.uMid.value);
    lerpC("hz", night.horizon, pal.horizon, k, su.uHorizon.value);
    lerpC("gr", night.ground, pal.ground, k, su.uGround.value);
    lerpC("sun", night.sun, pal.sun, k, U.uSunColor.value);
    lerpC("fog", night.fog, pal.fog, k, U.uFogColor.value);
    U.uFogColor.value.lerp(su.uHorizon.value, 0.6);
    U.uSkyLow.value.copy(su.uHorizon.value).lerp(su.uMid.value, 0.35);
    U.uSkyHigh.value.copy(su.uMid.value).lerp(su.uTop.value, 0.5);
    panelMat.uniforms.uCell.value.set(pal.cell);
    groundMat.uniforms.uGround.value.copy(su.uGround.value);
    su.uNight.value = 1 - k * (S.theme === "light" ? 1 : 0.85);
    U.uEnergy.value.set(pal.energy);
    const lightTheme = S.theme === "light";
    cableMat.blending = lightTheme ? NormalBlending : AdditiveBlending;
    cloudMat.color.set(lightTheme ? "#ffffff" : "#d9b7b0");
    legMat.uniforms.uShade.value.set(lightTheme ? "#6b7280" : "#3a3f48");
    renderer.toneMappingExposure = pal.exposure;
    su.uGlow.value = lightTheme ? 0.35 : 1;
    U.uFogNear.value = lightTheme ? 40 : 28;
    U.uFogFar.value = lightTheme ? 150 : 108;
    return k;
  }

  function sunDirection() {
    const pal = PALETTES[S.theme];
    const rise = still ? 1 : easeOut((S.intro - 0.05) / 1.35);
    const el = MathUtils.lerp(PALETTES.night.sunEl, pal.sunEl, rise);
    const az = 0.13 + Math.sin(S.t * 0.012) * 0.07; // slow drift across the sky
    return U.uSunDir.value.set(Math.sin(az) * Math.cos(el), Math.sin(el), -Math.cos(az) * Math.cos(el)).normalize();
  }

  function updateAnchor() {
    if (!opts.getAnchor) return;
    const a = opts.getAnchor();
    if (!a) return;
    const ndc = new Vector2((a.x / S.w) * 2 - 1, -(a.y / S.h) * 2 + 1);
    baseCamera();
    raycaster.setFromCamera(ndc, camera);
    const hit = new Vector3();
    if (raycaster.ray.intersectPlane(groundPlane, hit) && hit.z < 6) anchor.copy(hit);
    else anchor.set(3, 0, -12);
    layoutField(anchor.x, anchor.z);
    buildCables();
  }

  const camBase = new Vector3(0, 6.6, 10), lookBase = new Vector3(0, 1.6, -34);
  const look = new Vector3();
  function baseCamera() {
    camera.position.copy(camBase);
    camera.lookAt(lookBase);
    camera.updateMatrixWorld();
  }

  function resize() {
    const r = host.getBoundingClientRect();
    S.w = Math.max(1, r.width); S.h = Math.max(1, r.height);
    renderer.setSize(S.w, S.h, false);
    camera.aspect = S.w / S.h;
    // keep the field wide enough on narrow/tall viewports
    camera.fov = camera.aspect < 1.2 ? 52 : 40;
    camera.updateProjectionMatrix();
    updateAnchor();
    if (still) render(0);
  }

  function emitSun() {
    if (!opts.onSun) return;
    const p = sun.position.clone().project(camera);
    opts.onSun(((p.x + 1) / 2) * 100, ((1 - p.y) / 2) * 100);
  }

  function step(dt) {
    S.t += dt;
    if (!still) S.intro += dt;
    applyPalette();
    const sd = sunDirection();

    // pointer parallax
    S.pointerS.x = damp(S.pointerS.x, S.pointer.x, 3, dt);
    S.pointerS.y = damp(S.pointerS.y, S.pointer.y, 3, dt);
    const push = S.success >= 0 ? easeOut((S.t - S.success) / 1.1) : 0;
    camera.position.set(camBase.x + S.pointerS.x * 0.9, camBase.y - S.pointerS.y * 0.35 + push * 0.6, camBase.z - push * 6.5);
    look.set(lookBase.x + S.pointerS.x * 2.2, lookBase.y - S.pointerS.y * 0.8 + push * 7, lookBase.z);
    camera.lookAt(look);
    camera.updateMatrixWorld();
    panelMat.uniforms.uPointer.value.copy(S.pointerS);

    // sun + cloud placement
    sun.position.copy(sd).multiplyScalar(SUN_DIST).add(new Vector3(camera.position.x, 0, camera.position.z));
    sun.quaternion.copy(camera.quaternion);
    const flare = S.success >= 0 ? smooth((S.t - S.success) / 0.45) : 0;
    const sunScale = 44 * (1 + flare * 1.8);
    sun.scale.set(sunScale, sunScale, 1);
    S.cloud = damp(S.cloud, S.cloudTarget, S.cloudTarget > S.cloud ? 2.6 : 1.8, dt);
    S.dim = damp(S.dim, S.dimTarget, 3, dt);
    const cloudAz = -0.55 * (1 - S.cloud);
    const cdir = sd.clone().applyAxisAngle(new Vector3(0, 1, 0), -cloudAz).setY(sd.y + 0.012);
    cloud.position.copy(cdir).multiplyScalar(SUN_DIST * 0.8).add(new Vector3(camera.position.x, 0, camera.position.z));
    cloud.quaternion.copy(camera.quaternion);
    cloud.scale.set(62, 62, 1);
    cloudMat.opacity = clamp01(S.cloud * 1.6) * 0.95;
    const cover = clamp01(S.cloud);
    sunMat.uniforms.uOpacity.value = (1 - cover * 0.7) * (still ? 1 : smooth(S.intro / 0.35));
    sunMat.uniforms.uFlare.value = flare;
    skyMat.uniforms.uCloud.value = cover;

    // grey moment after an error
    if (S.greyHold > 0) S.greyHold -= dt;
    S.grey = damp(S.grey, S.greyHold > 0 ? 1 : 0, S.greyHold > 0 ? 7 : 2.2, dt);

    // success flash
    S.flash = S.success >= 0 ? clamp01((S.t - S.success - 0.15) / 0.8) : 0;
    S.full = S.success >= 0 ? smooth((S.t - S.success) / 0.35) : damp(S.full, 0, 2, dt);

    const sweep = still ? ROWS + 2 : (S.intro - 0.45) / 0.9 * (ROWS + 1);
    const light = still ? 1 : smooth((S.intro - 0.15) / 1.0);
    const pm = panelMat.uniforms;
    pm.uSweep.value = sweep;
    pm.uFull.value = S.full;
    pm.uGrey.value = S.grey;
    pm.uDim.value = S.dim;
    pm.uSpec.value = 1 - cover * 0.8;
    pm.uFlash.value = S.flash * 0.6;
    groundMat.uniforms.uDim.value = S.dim;
    groundMat.uniforms.uGrey.value = S.grey;
    groundMat.uniforms.uLight.value = light;
    groundMat.uniforms.uFlash.value = S.flash * 0.5;
    legMat.uniforms.uDim.value = S.dim;
    legMat.uniforms.uLight.value = light;
    skyMat.uniforms.uFlash.value = S.flash * 0.7;
    U.uTime.value = S.t;
    renderer.toneMappingExposure = PALETTES[S.theme].exposure * (1 - S.dim * 0.15) * (1 + S.flash * 1.1);

    // photons → panels
    const active = !still && S.intro > 1.2 && S.success < 0;
    for (let i = 0; i < PHOTONS; i++) {
      const p = photons[i];
      let t = (S.t - p.t0) / p.dur;
      if (t >= 1) {
        if (active && S.grey < 0.3) {
          const e = Math.min(1, (hits.get(p.idx) || 0) + 0.9);
          hits.set(p.idx, e);
        }
        spawnPhoton(p, S.t + Math.random() * (S.submitting ? 0.2 : 0.9));
        t = (S.t - p.t0) / p.dur;
      }
      const from = sun.position;
      for (let k = 0; k < TRAIL; k++) {
        const tk = clamp01(t - k * 0.022);
        const u = tk * tk; // accelerate toward the panel
        const j = (i * TRAIL + k) * 3;
        photonPos[j] = MathUtils.lerp(from.x, p.target.x, u);
        photonPos[j + 1] = MathUtils.lerp(from.y, p.target.y + 0.05, u);
        photonPos[j + 2] = MathUtils.lerp(from.z, p.target.z, u);
        const vis = t > 0 && t < 1 && active ? Math.min(1, t * 3) * (1 - k / TRAIL) * (1 - cover * 0.6) * (1 - S.grey) : 0;
        photonA[i * TRAIL + k] = vis * (0.35 + 0.65 * smooth(u));
      }
    }
    photonGeo.attributes.position.needsUpdate = true;
    photonGeo.attributes.aAlpha.needsUpdate = true;
    photonMat.uniforms.uScale.value = Math.min(2, renderer.getPixelRatio());

    // decay panel energy
    if (hits.size) {
      for (const [i, v] of hits) {
        const nv = v - dt * 1.5;
        if (nv <= 0) { hits.delete(i); aHit[i] = 0; } else aHit[i] = nv;
      }
      hitAttr.needsUpdate = true;
    } else if (aHit.some((v) => v)) { aHit.fill(0); hitAttr.needsUpdate = true; }

    // pulses along the trunk toward the card
    if (active) {
      S.nextPulse -= dt * (S.submitting ? 3 : 1);
      if (S.nextPulse <= 0) { S.pulses.push({ d: 0, v: 9 + Math.random() * 3 }); S.nextPulse = 1.2 + Math.random() * 1.0; }
    }
    for (let i = S.pulses.length - 1; i >= 0; i--) {
      const p = S.pulses[i];
      p.d += p.v * dt * (S.submitting ? 1.6 : 1);
      if (p.d >= trunkLen + 1) { S.pulses.splice(i, 1); opts.onArrive && opts.onArrive(); }
    }
    const pu = cableMat.uniforms.uPulses.value;
    pu.fill(-999);
    S.pulses.slice(-10).forEach((p, i) => { pu[i] = p.d; });
    cableMat.uniforms.uStrength.value = still ? 1 : smooth((S.intro - 1.0) / 0.6);
    cableMat.uniforms.uFlow.value = S.submitting ? 3 : 1;
    cableMat.uniforms.uGrey.value = S.grey;
    cableMat.uniforms.uFull.value = S.full;
    if ((S.t * 4 | 0) !== ((S.t - dt) * 4 | 0)) emitSun();
  }

  function render(dt) {
    step(dt);
    renderer.render(scene, camera);
  }

  function frame(now) {
    if (!S.running) return;
    S.raf = requestAnimationFrame(frame);
    const dt = Math.min(0.05, (now - (S.last || now)) / 1000);
    S.last = now;
    render(dt);
    // low-FPS watchdog: after the intro, measure ~2.5 s; first drop DPR, then give up
    const L = S.lowFpsCheck;
    if (!L.done && S.intro > 1.8) {
      if (!L.start) { L.start = now; L.frames = 0; }
      L.frames++;
      const el = now - L.start;
      if (el > 2500) {
        const fps = (L.frames * 1000) / el;
        if (fps < 24) {
          if (!L.downgraded && dpr > 1) { L.downgraded = true; dpr = 1; renderer.setPixelRatio(1); resize(); L.start = 0; }
          else if (fps < 18) { L.done = true; opts.onLowFps && opts.onLowFps(fps); }
          else L.done = true;
        } else L.done = true;
      }
    }
  }

  function start() {
    if (S.running || S.disposed || still) return;
    S.running = true; S.last = 0;
    S.raf = requestAnimationFrame(frame);
  }
  function stop() { S.running = false; cancelAnimationFrame(S.raf); }
  const onVis = () => { if (document.hidden) stop(); else start(); };
  const onPointer = (ev) => {
    S.pointer.set((ev.clientX / window.innerWidth) * 2 - 1, (ev.clientY / window.innerHeight) * 2 - 1);
  };
  const ro = new ResizeObserver(() => resize());
  ro.observe(host);
  document.addEventListener("visibilitychange", onVis);
  if (!still) window.addEventListener("pointermove", onPointer, { passive: true });

  applyPalette();
  resize();
  if (still) { render(0); emitSun(); } else if (!document.hidden) start();

  const rerenderStill = () => { if (still) { S.cloud = S.cloudTarget; S.dim = S.dimTarget; render(0); } };

  return {
    canvas,
    setTheme(theme) { S.theme = theme === "light" ? "light" : "dark"; rerenderStill(); },
    setMood({ cloud = 0, dim = 0 } = {}) { S.cloudTarget = cloud; S.dimTarget = dim; rerenderStill(); },
    setSubmitting(v) { S.submitting = !!v; },
    pulse() {
      if (still) return;
      S.pulses.push({ d: 0, v: 22 });
      // light a few near panels as if the keystroke drew from them
      for (let i = 0; i < 3; i++) { const idx = visibleModules[(Math.random() * visibleModules.length) | 0]; hits.set(idx, 1); }
    },
    error() { S.greyHold = 0.9; S.cloudTarget = 1; S.dimTarget = 0.4; rerenderStill(); },
    success() { S.success = S.t; S.cloudTarget = 0; S.dimTarget = 0; S.greyHold = 0; if (still) { S.full = 1; render(0); } },
    refreshAnchor() { updateAnchor(); if (still) render(0); },
    dispose() {
      if (S.disposed) return;
      S.disposed = true;
      stop();
      ro.disconnect();
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("pointermove", onPointer);
      if (cableMesh) cableMesh.geometry.dispose();
      if (roadMesh) roadMesh.geometry.dispose();
      panels.dispose && panels.dispose();
      legMesh.dispose && legMesh.dispose();
      for (const d of disposables) d.dispose && d.dispose();
      renderer.dispose();
      renderer.forceContextLoss();
      canvas.remove();
    },
  };
}
