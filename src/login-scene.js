// "Quyosh sizning qo'lingizda" — the sun follows your hand.
// A stylized floating hex island with a honeycomb of solar trackers hovers in the void; the sun is a
// living plasma orb that follows the cursor (spring inertia) and every panel turns on its tracker to
// face it in a staggered wave. Panels that face the sun glow and push energy pulses through veins into
// the central tower, which sends a ribbon of light to the login card.
//
// Loaded lazily (dynamic import) by Login in src/shell.jsx after the form has rendered, so three.js
// and the post-processing live in their own chunk. Everything here is decorative: the host element is
// aria-hidden and the form never waits for this module.
import {
  WebGLRenderer, WebGLRenderTarget, Scene, PerspectiveCamera, Color, Vector2, Vector3, Vector4, Quaternion, Euler, Matrix4,
  Shape, Path, ExtrudeGeometry, CylinderGeometry, SphereGeometry, PlaneGeometry, BoxGeometry, TorusGeometry, RingGeometry,
  IcosahedronGeometry, TubeGeometry, CatmullRomCurve3, BufferGeometry, BufferAttribute, InstancedBufferAttribute,
  InstancedMesh, Mesh, Points, Line, Group,
  ShaderMaterial, MeshStandardMaterial, MeshPhysicalMaterial, MeshBasicMaterial, LineBasicMaterial,
  DirectionalLight, HemisphereLight, PointLight, PMREMGenerator,
  BackSide, AdditiveBlending, PCFSoftShadowMap, ACESFilmicToneMapping, SRGBColorSpace, HalfFloatType,
  Raycaster, Plane, MathUtils,
} from "three";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { ShaderPass } from "three/addons/postprocessing/ShaderPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";

const clamp01 = (v) => Math.min(1, Math.max(0, v));
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const smooth = (t) => { t = clamp01(t); return t * t * (3 - 2 * t); };
const easeOut = (t) => 1 - Math.pow(1 - clamp01(t), 3);
const easeBack = (t) => { t = clamp01(t); const c = 1.9; return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2); };
const damp = (cur, target, lambda, dt) => cur + (target - cur) * (1 - Math.exp(-lambda * dt));

// ---------- art direction ----------
const THEMES = {
  dark: {
    skyTop: "#02031a", skyMid: "#080a36", skyLow: "#191052", skyGlow: "#ff8a3a", nebulaA: "#2c2a9a", nebulaB: "#6a2a9a", stars: 1,
    sunCore: "#fff4dc", sunMid: "#ffb63c", sunEdge: "#ff5b26", corona: "#ff9636", sunBright: 1.0,
    top: "#3a3380", side: "#211b4c", rock: "#3b3188", vein: "#ffb43a", rim: "#ffc45c",
    panel: "#121a5c", cell: "#ffc861", frame: "#f0c27c", pole: "#9a93c9", tower: "#f3eefe",
    hemiSky: "#7a66e0", hemiGround: "#3a2470", hemiI: 1.0, sunI: 3.4, exposure: 1.0,
    bloom: [0.6, 0.4, 1.05], rays: 0.9, dust: "#ffd49a", moon: "#06051a", moonRim: "#8f7cff", cloud: "#4f4672",
    envTop: "#1c1650", envLow: "#4b2368",
  },
  light: {
    skyTop: "#f6e3da", skyMid: "#f3bfa6", skyLow: "#c7a8e4", skyGlow: "#ffa64a", nebulaA: "#ffd9c4", nebulaB: "#e2c4ff", stars: 0,
    sunCore: "#fff8e8", sunMid: "#ffc23e", sunEdge: "#ff6a1f", corona: "#ff9a3a", sunBright: 0.85,
    top: "#f3e1cc", side: "#efd4c6", rock: "#a985cf", vein: "#ff9a28", rim: "#ffb03f",
    panel: "#1a2370", cell: "#ffc35a", frame: "#e0a640", pole: "#b8a7a2", tower: "#ffffff",
    hemiSky: "#ffe9dc", hemiGround: "#b18fd0", hemiI: 0.75, sunI: 1.55, exposure: 0.9,
    bloom: [0.4, 0.35, 1.15], rays: 0.22, dust: "#ffa65a", moon: "#3a2f6b", moonRim: "#ffffff", cloud: "#7a6f99",
    envTop: "#f6d2c0", envLow: "#9b86c9",
  },
};

// Honeycomb: axial hex coordinates (pointy-top layout), spacing 1 world unit * HEX_D.
const HEX_D = 1.08;
const PIVOT_Y = 0.66;
export function islandCells(rings) {
  const out = [];
  for (let q = -rings; q <= rings; q++) {
    for (let r = Math.max(-rings, -q - rings); r <= Math.min(rings, -q + rings); r++) {
      const x = HEX_D * (q + r / 2), z = HEX_D * (r * Math.sqrt(3) / 2);
      out.push({ q, r, x, z, ring: Math.max(Math.abs(q), Math.abs(r), Math.abs(q + r)) });
    }
  }
  return out;
}
export const TRANSFORMER_CELL = { q: -1, r: 1 };

function hexShape(radius, rot = 0, hole = 0) {
  const s = new Shape();
  for (let k = 0; k < 6; k++) {
    const a = rot + (k * Math.PI) / 3, x = Math.cos(a) * radius, y = Math.sin(a) * radius;
    k ? s.lineTo(x, y) : s.moveTo(x, y);
  }
  s.closePath();
  if (hole) {
    const h = new Path();
    for (let k = 0; k < 6; k++) {
      const a = rot + (k * Math.PI) / 3, x = Math.cos(a) * hole, y = Math.sin(a) * hole;
      k ? h.lineTo(x, y) : h.moveTo(x, y);
    }
    h.closePath();
    s.holes.push(h);
  }
  return s;
}

function webglOk() {
  try {
    const c = document.createElement("canvas");
    return !!(window.WebGLRenderingContext && c.getContext("webgl2"));
  } catch { return false; }
}

// Cheap value noise shared by several shaders.
const NOISE_GLSL = `
  float hash3(vec3 p){ p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
  float vnoise(vec3 x){
    vec3 i = floor(x); vec3 f = fract(x); f = f * f * (3.0 - 2.0 * f);
    return mix(mix(mix(hash3(i), hash3(i + vec3(1,0,0)), f.x), mix(hash3(i + vec3(0,1,0)), hash3(i + vec3(1,1,0)), f.x), f.y),
               mix(mix(hash3(i + vec3(0,0,1)), hash3(i + vec3(1,0,1)), f.x), mix(hash3(i + vec3(0,1,1)), hash3(i + vec3(1,1,1)), f.x), f.y), f.z);
  }
  float fbm(vec3 p){ float a = 0.5, s = 0.0; for (int i = 0; i < 5; i++){ s += a * vnoise(p); p = p * 2.03 + 0.17; a *= 0.5; } return s; }
`;

export function createSunScene(hostEl, opts = {}) {
  let host = hostEl;
  if (!webglOk()) throw new Error("webgl-unavailable");
  const still = !!opts.still;
  const lite = !!opts.lite;
  const RINGS = lite ? 2 : 3;
  const ISLAND_R = (RINGS * HEX_D + 0.62) / 0.866 + 0.28;
  const SUN_Z = 2.6; // the sun lives on a plane between the island and the viewer

  const renderer = new WebGLRenderer({ antialias: false, alpha: false, powerPreference: "high-performance", stencil: false });
  let dpr = Math.min(window.devicePixelRatio || 1, lite ? 1.5 : 1.75);
  renderer.setPixelRatio(dpr);
  renderer.toneMapping = ACESFilmicToneMapping;
  renderer.outputColorSpace = SRGBColorSpace;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = PCFSoftShadowMap;
  const canvas = renderer.domElement;
  canvas.className = "tg-login-canvas";
  canvas.setAttribute("aria-hidden", "true");
  host.appendChild(canvas);

  const scene = new Scene();
  const camera = new PerspectiveCamera(30, 1, 0.1, 400);
  const disposables = [];
  const track = (o) => { disposables.push(o); return o; };
  const T = () => THEMES[S.theme];

  const S = {
    theme: opts.theme === "light" ? "light" : "dark",
    w: 1, h: 1, t: 0, intro: still ? 99 : 0, last: 0, raf: 0, running: false, disposed: false,
    pointer: null, pointerT: -99, sunTarget: new Vector3(2.2, 4.4, 0), sun: new Vector3(2.2, 4.4, 0), sunVel: new Vector3(),
    eclipse: 0, eclipseTarget: 0, storm: 0, stormHold: 0, grey: 0, submitting: false, success: -1, flare: 0,
    bolt: 0, nextBolt: 0, towerPulse: 0, ribbonPulses: [], arriveCooldown: 0,
    spot: { x: 0.5, y: 0.65, size: 0.5 }, anchor: null, sunScreen: { x: 0, y: 0, r: 0 },
    lowFps: { done: false, start: 0, frames: 0, downgraded: false },
  };

  // ---------- environment (glossy reflections) ----------
  const pmrem = new PMREMGenerator(renderer);
  let envRT = null;
  function buildEnv() {
    const th = T();
    const envScene = new Scene();
    const g = new SphereGeometry(10, 32, 16);
    const m = new ShaderMaterial({
      side: BackSide, depthWrite: false,
      uniforms: { uTop: { value: new Color(th.envTop) }, uLow: { value: new Color(th.envLow) }, uSun: { value: new Color(th.sunMid).multiplyScalar(6) } },
      vertexShader: `varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }`,
      fragmentShader: `varying vec3 vP; uniform vec3 uTop, uLow, uSun;
        void main(){ float h = vP.y * .5 + .5; vec3 c = mix(uLow, uTop, smoothstep(.2, .85, h));
          float s = pow(max(dot(vP, normalize(vec3(.35, .55, .4))), 0.), 64.); float s2 = pow(max(dot(vP, normalize(vec3(-.6, .3, .5))), 0.), 24.);
          c += uSun * s + uSun * .08 * s2; c += vec3(.9, .85, 1.) * .35 * smoothstep(.97, 1., abs(sin(vP.x * 9.)) * step(.2, vP.y)) * .0;
          gl_FragColor = vec4(c, 1.); }`,
    });
    envScene.add(new Mesh(g, m));
    const rt = pmrem.fromScene(envScene, 0.03);
    g.dispose(); m.dispose();
    if (envRT) envRT.dispose();
    envRT = rt;
    scene.environment = rt.texture;
  }

  // ---------- sky (fullscreen gradient + nebula + stars + glow around the sun) ----------
  const skyMat = track(new ShaderMaterial({
    depthTest: false, depthWrite: false,
    uniforms: {
      uTop: { value: new Color() }, uMid: { value: new Color() }, uLow: { value: new Color() }, uGlow: { value: new Color() },
      uNebA: { value: new Color() }, uNebB: { value: new Color() }, uStars: { value: 1 }, uSun: { value: new Vector2(0.6, 0.7) },
      uAspect: { value: 1 }, uTime: { value: 0 }, uVis: { value: 0 }, uGlowMix: { value: 0 }, uEclipse: { value: 0 }, uStorm: { value: 0 }, uFlare: { value: 0 }, uSunVis: { value: 1 },
    },
    vertexShader: `varying vec2 vUv; void main(){ vUv = position.xy * .5 + .5; gl_Position = vec4(position.xy, .9999, 1.); }`,
    fragmentShader: `varying vec2 vUv;
      uniform vec3 uTop, uMid, uLow, uGlow, uNebA, uNebB; uniform vec2 uSun; uniform float uAspect, uTime, uVis, uEclipse, uStorm, uFlare, uStars, uSunVis, uGlowMix;
      ${NOISE_GLSL}
      void main(){
        vec2 uv = vUv;
        vec3 c = mix(uLow, uMid, smoothstep(0., .55, uv.y));
        c = mix(c, uTop, smoothstep(.45, 1., uv.y));
        vec2 q = vec2(uv.x * uAspect, uv.y);
        float n = fbm(vec3(q * 1.6, uTime * .015));
        float n2 = fbm(vec3(q * 3.1 + 4.2, uTime * .02));
        c += uNebA * smoothstep(.45, .85, n) * .32 + uNebB * smoothstep(.58, .92, n2) * .16;
        vec2 d = (uv - uSun) * vec2(uAspect, 1.);
        float r = length(d);
        float glow = exp(-r * 4.2) * .55 + exp(-r * 13.) * .75;
        float gk = glow * uSunVis * (1. - uEclipse * .75) * (1. - uStorm * .6);
        c = mix(c, uGlow, clamp(gk, 0., .9) * uGlowMix) + uGlow * gk * (1. - uGlowMix);
        // stars
        vec2 g = q * 180.; vec2 id = floor(g); vec2 f = fract(g) - .5;
        float h = hash3(vec3(id, 7.));
        float st = step(.985, h) * smoothstep(.12, 0., length(f)) * (.6 + .4 * sin(uTime * (1. + h * 3.) + h * 40.));
        c += vec3(1., .95, .9) * st * uStars * (1. - uv.y * .2 < 2. ? 1. : 0.);
        // eclipse: deep cool blue-violet; storm: dull
        vec3 cool = vec3(.05, .07, .22) + c * vec3(.35, .45, 1.0) * .6;
        c = mix(c, cool, uEclipse * .8);
        c = mix(c, vec3(dot(c, vec3(.3, .59, .11))) * vec3(.85, .85, .95), uStorm * .55);
        c += vec3(1., .96, .9) * uFlare * exp(-r * 1.2) * 2.5;
        gl_FragColor = vec4(c * uVis, 1.);
      }`,
  }));
  const fsTri = track(new BufferGeometry());
  fsTri.setAttribute("position", new BufferAttribute(new Float32Array([-1, -1, 0, 3, -1, 0, -1, 3, 0]), 3));
  const sky = new Mesh(fsTri, skyMat);
  sky.frustumCulled = false; sky.renderOrder = -10;
  scene.add(sky);

  // ---------- lights ----------
  const hemi = new HemisphereLight(0xffffff, 0x000000, 1);
  scene.add(hemi);
  const sunLight = new DirectionalLight(0xffffff, 3);
  sunLight.castShadow = true;
  sunLight.shadow.mapSize.set(lite ? 512 : 1024, lite ? 512 : 1024);
  const sc = sunLight.shadow.camera;
  sc.left = -ISLAND_R - 1; sc.right = ISLAND_R + 1; sc.top = ISLAND_R + 1; sc.bottom = -ISLAND_R - 1; sc.near = 0.5; sc.far = 60;
  sunLight.shadow.bias = -0.0006; sunLight.shadow.normalBias = 0.025; sunLight.shadow.radius = 3;
  scene.add(sunLight);
  const fillLight = new DirectionalLight(0x8a6cff, 1.4);
  fillLight.position.set(-3, -6, 8);
  scene.add(fillLight);
  const towerLight = new PointLight(0xffb84d, 6, 6, 2);
  scene.add(towerLight);

  // ---------- island ----------
  const island = new Group();
  scene.add(island);
  const islandTilt = new Group(); // gentle wobble
  island.add(islandTilt);
  const cells = islandCells(RINGS).filter((c) => !(c.q === 0 && c.r === 0) && !(c.q === TRANSFORMER_CELL.q && c.r === TRANSFORMER_CELL.r));
  const N = cells.length;
  const VEIN_N = 36;

  const veinUniforms = {
    uTime: { value: 0 }, uVeinCol: { value: new Color() }, uVeinOn: { value: 0 },
    uVein: { value: Array.from({ length: VEIN_N }, () => new Vector4(0, 0, 0, 0)) },
    uPk: { value: Array.from({ length: VEIN_N / 4 }, () => new Vector4(-1, -1, -1, -1)) },
  };
  cells.forEach((c, i) => { veinUniforms.uVein.value[i].set(c.x, c.z, 0, Math.random()); });
  for (let i = N; i < VEIN_N; i++) veinUniforms.uVein.value[i].set(0, 0, -1, 0);

  // top slab with soft bevel
  const slabDepth = 0.42, bevel = 0.16;
  const slabGeo = track(new ExtrudeGeometry(hexShape(ISLAND_R, 0), { depth: slabDepth, bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 3, curveSegments: 1 }));
  slabGeo.rotateX(-Math.PI / 2);
  slabGeo.translate(0, -(slabDepth + bevel), 0);
  const topMat = track(new MeshStandardMaterial({ roughness: 0.55, metalness: 0.05, envMapIntensity: 0.6 }));
  topMat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, veinUniforms);
    sh.vertexShader = sh.vertexShader
      .replace("#include <common>", "#include <common>\nvarying vec3 vLP; varying vec3 vLN;")
      .replace("#include <begin_vertex>", "#include <begin_vertex>\nvLP = position; vLN = normal;");
    sh.fragmentShader = sh.fragmentShader
      .replace("#include <common>", `#include <common>
        varying vec3 vLP; varying vec3 vLN; uniform vec4 uVein[${VEIN_N}]; uniform vec4 uPk[${VEIN_N / 4}]; uniform float uTime, uVeinOn; uniform vec3 uVeinCol;`)
      .replace("#include <emissivemap_fragment>", `#include <emissivemap_fragment>
        if (vLN.y > 0.6 && vLP.y > -0.05) {
          vec2 p = vLP.xz; float acc = 0.;
          for (int i = 0; i < ${VEIN_N}; i++) {
            vec4 v = uVein[i];
            if (v.z < -0.5) continue;
            vec2 a = v.xy; vec2 ab = -a;
            float t = clamp(dot(p - a, ab) / dot(ab, ab), 0., 1.);
            float d = length(p - (a + ab * t));
            float line = smoothstep(.034, .008, d) + smoothstep(.12, .0, d) * .12;
            float flow = pow(.5 + .5 * sin((t * 5. - v.w) * 6.2831), 10.);
            float pkT = uPk[i / 4][i - (i / 4) * 4];
            float pk = pkT >= 0. ? exp(-((t - pkT) * 12.) * ((t - pkT) * 12.)) : 0.;
            acc += line * (.08 + v.z * (.35 + 1.5 * flow) + pk * 5.);
          }
          // faint hex inlay near the rim
          float hx = max(abs(p.y) * 1.1547, abs(p.y) * .57735 + abs(p.x)) ;
          float inlay = smoothstep(.03, .0, abs(hx - ${(ISLAND_R * 0.94).toFixed(3)})) * .5;
          totalEmissiveRadiance += uVeinCol * (acc + inlay * (.3 + .2 * sin(uTime * 1.7))) * uVeinOn;
        }`);
  };
  const slab = new Mesh(slabGeo, topMat);
  slab.receiveShadow = true; slab.castShadow = true;
  islandTilt.add(slab);

  // glowing rim around the top edge
  const rimGeo = track(new ExtrudeGeometry(hexShape(ISLAND_R + 0.07, 0, ISLAND_R - 0.03), { depth: 0.03, bevelEnabled: false }));
  rimGeo.rotateX(-Math.PI / 2);
  rimGeo.translate(0, 0.004, 0);
  const rimMat = track(new MeshBasicMaterial({ color: 0xffffff, toneMapped: true }));
  const rim = new Mesh(rimGeo, rimMat);
  islandTilt.add(rim);
  // a second, lower rim where the slab meets the rock
  const rim2Geo = track(new ExtrudeGeometry(hexShape(ISLAND_R + 0.17, 0, ISLAND_R + 0.11), { depth: 0.02, bevelEnabled: false }));
  rim2Geo.rotateX(-Math.PI / 2);
  rim2Geo.translate(0, -(slabDepth + bevel) - 0.01, 0);
  const rim2Mat = track(new MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.55 }));
  islandTilt.add(new Mesh(rim2Geo, rim2Mat));

  // low-poly rock underneath with energy veins
  let seed = 11;
  const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  const ROCK_H = 4.4;
  const rockGeo0 = new CylinderGeometry(ISLAND_R + 0.12, ISLAND_R + 0.12, ROCK_H, 6, 5, false, Math.PI / 2);
  const rp = rockGeo0.attributes.position;
  const jit = new Map();
  for (let i = 0; i < rp.count; i++) {
    const y = rp.getY(i);
    const t = Math.min(1, Math.max(0, (ROCK_H / 2 - y) / ROCK_H)); // 0 top → 1 tip
    const prof = Math.max(0.04, 1 - Math.pow(t, 1.35) * 0.97);
    const key = `${rp.getX(i).toFixed(3)},${y.toFixed(3)},${rp.getZ(i).toFixed(3)}`; // keep shared vertices welded
    if (!jit.has(key)) jit.set(key, [(rnd() - 0.5) * 0.3, (rnd() - 0.5) * 0.3, (rnd() - 0.5) * 0.4]);
    const [jx, jz, jy] = jit.get(key);
    const top = t < 0.01;
    rp.setX(i, rp.getX(i) * prof * (top ? 1 : 1 + jx * 0.6) + (top ? 0 : jz * 0.4));
    rp.setZ(i, rp.getZ(i) * prof * (top ? 1 : 1 + jz * 0.6) + (top ? 0 : jx * 0.4));
    rp.setY(i, y + (top ? 0 : jy * (1 - t * 0.5)));
  }
  const rockGeo = track(rockGeo0.toNonIndexed());
  rockGeo0.dispose();
  rockGeo.computeVertexNormals();
  { // barycentric coords → glowing veins along the facet edges
    const n = rockGeo.attributes.position.count, b = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) b[i * 3 + (i % 3)] = 1;
    rockGeo.setAttribute("bary", new BufferAttribute(b, 3));
  }
  rockGeo.translate(0, -(slabDepth + bevel) - ROCK_H / 2 + 0.05, 0);
  const rockMat = track(new MeshStandardMaterial({ roughness: 0.85, metalness: 0.0, flatShading: true }));
  rockMat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, veinUniforms);
    sh.vertexShader = sh.vertexShader
      .replace("#include <common>", "#include <common>\nattribute vec3 bary; varying vec3 vLP; varying vec3 vBary;")
      .replace("#include <begin_vertex>", "#include <begin_vertex>\nvLP = position; vBary = bary;");
    sh.fragmentShader = sh.fragmentShader
      .replace("#include <common>", `#include <common>\nvarying vec3 vLP; varying vec3 vBary; uniform float uTime, uVeinOn; uniform vec3 uVeinCol;`)
      .replace("#include <emissivemap_fragment>", `#include <emissivemap_fragment>
        vec3 bw = fwidth(vBary);
        vec3 bb = smoothstep(vec3(0.), bw * 1.6, vBary);
        float edge = 1. - min(min(bb.x, bb.y), bb.z);
        float flow = pow(.5 + .5 * sin(uTime * 2.4 + vLP.y * 3.2 + atan(vLP.z, vLP.x) * 2.), 3.);
        float depthFade = smoothstep(-5.6, -.7, vLP.y);
        totalEmissiveRadiance += uVeinCol * edge * depthFade * (.35 + 1.4 * flow) * uVeinOn;
        totalEmissiveRadiance += uVeinCol * .04 * smoothstep(-1.4, -.6, vLP.y) * uVeinOn;`);
  };
  const rock = new Mesh(rockGeo, rockMat);
  islandTilt.add(rock);

  // small floating rocks (designer-toy feel)
  const pebbleGeo = track(new IcosahedronGeometry(0.32, 0));
  const pebbles = [];
  for (let i = 0; i < (lite ? 2 : 4); i++) {
    const m = new Mesh(pebbleGeo, rockMat);
    const a = (i / 4) * Math.PI * 2 + 0.6;
    m.userData = { a, r: ISLAND_R * (0.75 + 0.15 * (i % 2)), y: -2.1 - (i % 2) * 0.9, s: 0.55 + 0.35 * ((i * 7) % 3) / 2, ph: i * 1.7 };
    m.scale.setScalar(m.userData.s);
    island.add(m);
    pebbles.push(m);
  }

  // ---------- panels (instanced) ----------
  const PANEL_R = 0.455;
  const plateGeo = track(new ExtrudeGeometry(hexShape(PANEL_R, Math.PI / 6), { depth: 0.035, bevelEnabled: false }));
  plateGeo.rotateX(-Math.PI / 2);
  plateGeo.translate(0, 0.045, 0);
  const frameA = new ExtrudeGeometry(hexShape(PANEL_R + 0.045, Math.PI / 6, PANEL_R - 0.01), { depth: 0.06, bevelEnabled: true, bevelThickness: 0.012, bevelSize: 0.012, bevelSegments: 2, curveSegments: 1 });
  frameA.rotateX(-Math.PI / 2);
  frameA.translate(0, 0.03, 0);
  const tube = new BoxGeometry(0.05, 0.04, 0.62).toNonIndexed();
  const head = new BoxGeometry(0.16, 0.08, 0.16).toNonIndexed();
  head.translate(0, -0.03, 0);
  const frameGeo = track(mergeGeometries([frameA, tube, head]));
  frameA.dispose(); tube.dispose(); head.dispose();
  const poleA = new CylinderGeometry(0.032, 0.05, PIVOT_Y, 8).toNonIndexed();
  poleA.translate(0, PIVOT_Y / 2, 0);
  const footA = new CylinderGeometry(0.13, 0.15, 0.05, 6).toNonIndexed();
  footA.translate(0, 0.025, 0);
  const poleGeo = track(mergeGeometries([poleA, footA]));
  poleA.dispose(); footA.dispose();

  const aGlow = new Float32Array(N), aHit = new Float32Array(N);
  const glowAttr = new InstancedBufferAttribute(aGlow, 1), hitAttr = new InstancedBufferAttribute(aHit, 1);
  plateGeo.setAttribute("aGlow", glowAttr); plateGeo.setAttribute("aHit", hitAttr);
  frameGeo.setAttribute("aGlow", glowAttr); frameGeo.setAttribute("aHit", hitAttr);
  const panelU = { uCell: { value: new Color() }, uTime: veinUniforms.uTime, uGrey: { value: 0 } };
  const instVaryings = (sh) => {
    Object.assign(sh.uniforms, panelU);
    sh.vertexShader = sh.vertexShader
      .replace("#include <common>", "#include <common>\nattribute float aGlow; attribute float aHit; varying float vGlow; varying float vHit; varying vec3 vLoc; varying float vUp;")
      .replace("#include <begin_vertex>", "#include <begin_vertex>\nvLoc = position; vUp = normal.y; vGlow = aGlow; vHit = aHit;");
  };
  const plateMat = track(new MeshPhysicalMaterial({ roughness: 0.16, metalness: 0.25, clearcoat: 1, clearcoatRoughness: 0.08, envMapIntensity: 1.25 }));
  plateMat.onBeforeCompile = (sh) => {
    instVaryings(sh);
    sh.fragmentShader = sh.fragmentShader
      .replace("#include <common>", "#include <common>\nvarying float vGlow; varying float vHit; varying vec3 vLoc; varying float vUp; uniform vec3 uCell; uniform float uTime, uGrey;")
      .replace("#include <emissivemap_fragment>", `#include <emissivemap_fragment>
        if (vUp > 0.5) {
          vec2 g = vLoc.xz / vec2(.118, .098);
          vec2 f = abs(fract(g) - .5);
          float line = smoothstep(.455, .5, max(f.x, f.y));
          float bus = smoothstep(.016, .0, abs(vLoc.x)) + smoothstep(.012, .0, abs(abs(vLoc.x) - .2));
          float sweep = .5 + .5 * sin(vLoc.z * 7. + vLoc.x * 3. - uTime * 3.2);
          float gl = vGlow;
          vec3 e = uCell * (line * (.05 + gl * 1.6 + vHit * 3.) + bus * (gl * .6 + vHit * .8));
          e += uCell * (gl * .035 * (.4 + .6 * sweep) + vHit * .25);
          totalEmissiveRadiance += e * (1. - uGrey);
          diffuseColor.rgb = mix(diffuseColor.rgb, vec3(dot(diffuseColor.rgb, vec3(.3, .59, .11))) * 1.4, uGrey);
        }`);
  };
  const frameMat = track(new MeshStandardMaterial({ roughness: 0.3, metalness: 0.9, envMapIntensity: 0.9 }));
  frameMat.onBeforeCompile = (sh) => {
    instVaryings(sh);
    sh.fragmentShader = sh.fragmentShader
      .replace("#include <common>", "#include <common>\nvarying float vGlow; varying float vHit; varying vec3 vLoc; varying float vUp; uniform vec3 uCell; uniform float uTime, uGrey;")
      .replace("#include <emissivemap_fragment>", `#include <emissivemap_fragment>
        totalEmissiveRadiance += uCell * (vGlow * .22 + vHit * .9) * smoothstep(.3, .45, length(vLoc.xz)) * (1. - uGrey);
        diffuseColor.rgb = mix(diffuseColor.rgb, vec3(dot(diffuseColor.rgb, vec3(.3, .59, .11))), uGrey * .8);`);
  };
  const poleMat = track(new MeshStandardMaterial({ roughness: 0.35, metalness: 0.8 }));
  const plates = new InstancedMesh(plateGeo, plateMat, N);
  const frames = new InstancedMesh(frameGeo, frameMat, N);
  const poles = new InstancedMesh(poleGeo, poleMat, N);
  for (const m of [plates, frames, poles]) { m.castShadow = true; m.receiveShadow = true; m.frustumCulled = false; islandTilt.add(m); }

  const panels = cells.map((c, i) => ({
    i, x: c.x, z: c.z, ring: c.ring, roll: (i % 2 ? 1 : -1) * 1.3, rollV: 0, pitch: -0.5, pitchV: 0,
    seen: new Vector3(), glow: 0, hit: 0, unfold: still ? 1 : 0, phase: Math.random(), order: 0,
  }));
  // intro order: centre-out with a little jitter
  panels.slice().sort((a, b) => (a.x * a.x + a.z * a.z) - (b.x * b.x + b.z * b.z)).forEach((p, k) => { p.order = k; });
  const m4 = new Matrix4(), q4 = new Quaternion(), e4 = new Euler(0, 0, 0, "ZXY"), v4 = new Vector3(), s4 = new Vector3();
  panels.forEach((p) => { m4.makeTranslation(p.x, 0, p.z); poles.setMatrixAt(p.i, m4); });
  poles.instanceMatrix.needsUpdate = true;

  // ---------- tower ----------
  const tower = new Group();
  islandTilt.add(tower);
  const towerMat = track(new MeshPhysicalMaterial({ roughness: 0.2, metalness: 0.1, clearcoat: 1, clearcoatRoughness: 0.1 }));
  const towerBaseGeo = track(new CylinderGeometry(0.42, 0.5, 0.22, 6));
  const towerBase = new Mesh(towerBaseGeo, towerMat); towerBase.position.y = 0.11; towerBase.castShadow = true; tower.add(towerBase);
  const towerShaftGeo = track(new CylinderGeometry(0.09, 0.2, 2.5, 6));
  const shaft = new Mesh(towerShaftGeo, towerMat); shaft.position.y = 1.43; shaft.castShadow = true; tower.add(shaft);
  const towerGlowMat = track(new MeshBasicMaterial({ color: 0xffffff }));
  const ringGeo = track(new TorusGeometry(0.2, 0.025, 8, 24));
  const towerRings = [0.7, 1.35, 2.0].map((y, k) => {
    const r = new Mesh(ringGeo, towerGlowMat); r.rotation.x = Math.PI / 2; r.position.y = y; r.scale.setScalar(1.25 - k * 0.22); tower.add(r); return r;
  });
  const orbGeo = track(new SphereGeometry(0.2, 24, 16));
  const orbMat = track(new MeshBasicMaterial({ color: 0xffffff }));
  const towerOrb = new Mesh(orbGeo, orbMat); towerOrb.position.y = 2.88; tower.add(towerOrb);
  const TOWER_TOP = new Vector3(0, 2.88, 0);
  towerLight.position.set(0, 2.2, 0);

  // ---------- transformer ----------
  const tcell = { x: HEX_D * (TRANSFORMER_CELL.q + TRANSFORMER_CELL.r / 2), z: HEX_D * (TRANSFORMER_CELL.r * Math.sqrt(3) / 2) };
  const transformer = new Group();
  transformer.position.set(tcell.x, 0, tcell.z);
  transformer.rotation.y = 0.5;
  islandTilt.add(transformer);
  const tBoxGeo = track(new BoxGeometry(0.62, 0.44, 0.44));
  const tBody = new Mesh(tBoxGeo, towerMat); tBody.position.y = 0.24; tBody.castShadow = true; transformer.add(tBody);
  const finGeo = track(new BoxGeometry(0.035, 0.36, 0.5));
  const finMat = track(new MeshStandardMaterial({ roughness: 0.4, metalness: 0.7 }));
  for (let k = 0; k < 5; k++) { const f = new Mesh(finGeo, finMat); f.position.set(-0.24 + k * 0.12, 0.24, 0); f.castShadow = true; transformer.add(f); }
  const insGeo = track(new CylinderGeometry(0.03, 0.05, 0.22, 8));
  for (let k = 0; k < 3; k++) { const c = new Mesh(insGeo, finMat); c.position.set(-0.18 + k * 0.18, 0.57, 0); transformer.add(c); }
  const ledGeo = track(new BoxGeometry(0.4, 0.03, 0.01));
  const led = new Mesh(ledGeo, towerGlowMat); led.position.set(0, 0.36, 0.226); transformer.add(led);

  // ---------- sun ----------
  const SUN_R = 0.95;
  const sunGroup = new Group();
  scene.add(sunGroup);
  const sunMat = track(new ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uCore: { value: new Color() }, uMid: { value: new Color() }, uEdge: { value: new Color() }, uBright: { value: 1 }, uFlare: { value: 0 } },
    vertexShader: `varying vec3 vN; varying vec3 vP; varying vec3 vV;
      void main(){ vP = position; vN = normalize(normalMatrix * normal); vec4 mv = modelViewMatrix * vec4(position, 1.); vV = normalize(-mv.xyz); gl_Position = projectionMatrix * mv; }`,
    fragmentShader: `varying vec3 vN; varying vec3 vP; varying vec3 vV; uniform float uTime, uBright, uFlare; uniform vec3 uCore, uMid, uEdge;
      ${NOISE_GLSL}
      void main(){
        float fres = clamp(1. - dot(vN, vV), 0., 1.);
        vec3 p = normalize(vP) * 2.6;
        float n = fbm(p + vec3(0., uTime * .22, uTime * .14));
        float n2 = fbm(p * 2.2 - vec3(uTime * .3, 0., uTime * .17));
        float gran = clamp(n * .8 + n2 * .5 - .15, 0., 1.);
        vec3 c = mix(uEdge, uMid, smoothstep(.12, .6, gran));
        c = mix(c, uCore, smoothstep(.45, .9, gran) * (1. - fres * .7));
        c += uEdge * pow(fres, 2.2) * 2.2;
        c *= uBright * (1.25 + 1.1 * smoothstep(.35, .85, n2));
        c = mix(c, vec3(14., 13., 12.), uFlare);
        gl_FragColor = vec4(c, 1.);
      }`,
  }));
  const sunGeo = track(new SphereGeometry(SUN_R, 48, 32));
  const sunOrb = new Mesh(sunGeo, sunMat);
  sunGroup.add(sunOrb);
  const coronaMat = track(new ShaderMaterial({
    transparent: true, depthWrite: false, blending: AdditiveBlending,
    uniforms: { uTime: { value: 0 }, uCol: { value: new Color() }, uBright: { value: 1 }, uEclipse: { value: 0 }, uFlare: { value: 0 } },
    vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }`,
    fragmentShader: `varying vec2 vUv; uniform float uTime, uBright, uEclipse, uFlare; uniform vec3 uCol;
      void main(){
        vec2 p = vUv * 2. - 1.; float r = length(p); float a = atan(p.y, p.x);
        float glow = exp(-r * 6.) * 1.4 + exp(-r * 2.4) * .35;
        float rays = pow(.5 + .5 * sin(a * 14. + sin(a * 5. + uTime * .6) * 1.6 + uTime * .15), 7.) * exp(-r * 3.2) * .9;
        rays += pow(.5 + .5 * sin(a * 9. - uTime * .22 + 1.3), 9.) * exp(-r * 2.4) * .5;
        float streak = exp(-abs(p.y) * 55.) * exp(-abs(p.x) * 2.6) * .9;
        float ring = exp(-((r - .17) * 30.) * ((r - .17) * 30.)) * (1.2 + uEclipse * 5.);
        float v = (glow + rays + streak) * (1. - uEclipse * .55) + ring * uEclipse;
        v *= smoothstep(1., .55, r);
        vec3 c = uCol * v * uBright + vec3(1.) * uFlare * exp(-r * 3.) * 3.;
        gl_FragColor = vec4(c, 1.);
      }`,
  }));
  const quadGeo = track(new PlaneGeometry(1, 1));
  const corona = new Mesh(quadGeo, coronaMat);
  corona.scale.setScalar(SUN_R * 9.5);
  corona.renderOrder = 2;
  sunGroup.add(corona);

  // eclipse moon
  const moonMat = track(new ShaderMaterial({
    uniforms: { uCol: { value: new Color() }, uRim: { value: new Color() } },
    vertexShader: `varying vec3 vN; varying vec3 vV; void main(){ vN = normalize(normalMatrix * normal); vec4 mv = modelViewMatrix * vec4(position, 1.); vV = normalize(-mv.xyz); gl_Position = projectionMatrix * mv; }`,
    fragmentShader: `varying vec3 vN; varying vec3 vV; uniform vec3 uCol, uRim; void main(){ float f = pow(clamp(1. - dot(vN, vV), 0., 1.), 3.); gl_FragColor = vec4(uCol + uRim * f * .9, 1.); }`,
  }));
  const moon = new Mesh(track(new SphereGeometry(SUN_R * 1.04, 40, 24)), moonMat);
  moon.visible = false;
  sunGroup.add(moon);

  // storm cloud + lightning
  const cloudMat = track(new ShaderMaterial({
    transparent: true, depthWrite: false, depthTest: false,
    uniforms: { uTime: { value: 0 }, uCol: { value: new Color() }, uA: { value: 0 }, uBolt: { value: 0 } },
    vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }`,
    fragmentShader: `varying vec2 vUv; uniform float uTime, uA, uBolt; uniform vec3 uCol;
      ${NOISE_GLSL}
      void main(){
        vec2 p = vUv * 2. - 1.;
        float n = fbm(vec3(p * vec2(2.2, 3.2), uTime * .25));
        float shape = smoothstep(1.05, .35, length(p * vec2(1., 1.55)) + (n - .5) * .9);
        float body = smoothstep(.05, .6, shape);
        vec3 c = uCol * (.55 + .7 * n) + vec3(.75, .8, 1.) * uBolt * 3.5 * smoothstep(.2, .9, n) * shape;
        float rimL = smoothstep(.0, .3, shape) * (1. - smoothstep(.3, .8, shape));
        c += vec3(1., .72, .4) * rimL * 1.4 * (1. - uBolt);
        gl_FragColor = vec4(c, body * uA);
      }`,
  }));
  const cloud = new Mesh(quadGeo, cloudMat);
  cloud.scale.set(SUN_R * 7.5, SUN_R * 4.6, 1);
  cloud.renderOrder = 4;
  cloud.visible = false;
  scene.add(cloud);
  const boltGeo = track(new BufferGeometry());
  const boltPos = new Float32Array(12 * 3);
  boltGeo.setAttribute("position", new BufferAttribute(boltPos, 3));
  const boltMat = track(new LineBasicMaterial({ color: new Color(6, 6.5, 9), transparent: true, opacity: 0 }));
  const bolt = new Line(boltGeo, boltMat);
  bolt.frustumCulled = false; bolt.renderOrder = 5;
  scene.add(bolt);

  // lens-flare ghosts (screen-aligned, placed along the sun → centre line)
  const ghostMat = (col, ring) => track(new ShaderMaterial({
    transparent: true, depthTest: false, depthWrite: false, blending: AdditiveBlending,
    uniforms: { uCol: { value: new Color(col) }, uA: { value: 0 } },
    vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }`,
    fragmentShader: `varying vec2 vUv; uniform vec3 uCol; uniform float uA;
      void main(){ float r = length(vUv * 2. - 1.); float v = ${ring ? "exp(-((r - .82) * 9.) * ((r - .82) * 9.)) * .8 + smoothstep(1., .0, r) * .05" : "smoothstep(1., .55, r) * .55 + smoothstep(1., .9, r) * .0"};
        gl_FragColor = vec4(uCol * v * uA, 1.); }`,
  }));
  const GHOSTS = [
    { k: 0.55, s: 0.07, c: "#ff9a5a", ring: false }, { k: 0.2, s: 0.04, c: "#ffd27a", ring: false },
    { k: -0.3, s: 0.06, c: "#8f7bff", ring: false }, { k: -0.62, s: 0.035, c: "#ff7a9a", ring: false },
  ].map((g) => { const m = new Mesh(quadGeo, ghostMat(g.c, g.ring)); m.renderOrder = 20; m.frustumCulled = false; scene.add(m); return { ...g, m }; });

  // ---------- photons: sun → panels ----------
  const PHOTONS = still ? 0 : lite ? 12 : 26, TRAIL = 6;
  const photonGeo = track(new BufferGeometry());
  const photonPos = new Float32Array(Math.max(1, PHOTONS * TRAIL) * 3), photonA = new Float32Array(Math.max(1, PHOTONS * TRAIL));
  photonGeo.setAttribute("position", new BufferAttribute(photonPos, 3));
  photonGeo.setAttribute("aA", new BufferAttribute(photonA, 1));
  const pointVS = `attribute float aA; varying float vA; uniform float uScale; uniform float uSize;
    void main(){ vA = aA; vec4 mv = modelViewMatrix * vec4(position, 1.); gl_PointSize = uSize * uScale * (10. / -mv.z) * (.4 + .6 * aA); gl_Position = projectionMatrix * mv; }`;
  const pointFS = `varying float vA; uniform vec3 uCol; void main(){ float d = length(gl_PointCoord - .5); float a = smoothstep(.5, .0, d); gl_FragColor = vec4(uCol * a * a * vA, 1.); }`;
  const photonMat = track(new ShaderMaterial({ transparent: true, depthWrite: false, blending: AdditiveBlending, uniforms: { uCol: { value: new Color(5, 3.6, 1.6) }, uScale: { value: 1 }, uSize: { value: 9 } }, vertexShader: pointVS, fragmentShader: pointFS }));
  const photonPts = new Points(photonGeo, photonMat);
  photonPts.frustumCulled = false;
  scene.add(photonPts);
  const photons = Array.from({ length: PHOTONS }, () => ({ t0: 0, dur: 1, idx: 0, from: new Vector3(), to: new Vector3() }));

  // ---------- dust ----------
  const DUST = lite ? 70 : 220;
  const dustGeo = track(new BufferGeometry());
  const dustPos = new Float32Array(DUST * 3), dustA = new Float32Array(DUST), dustSeed = new Float32Array(DUST * 3);
  for (let i = 0; i < DUST; i++) {
    const a = rnd() * Math.PI * 2, r = Math.sqrt(rnd()) * (ISLAND_R + 3.5);
    dustSeed[i * 3] = Math.cos(a) * r; dustSeed[i * 3 + 1] = -3 + rnd() * 9; dustSeed[i * 3 + 2] = Math.sin(a) * r;
    dustA[i] = rnd();
  }
  dustGeo.setAttribute("position", new BufferAttribute(dustPos, 3));
  dustGeo.setAttribute("aA", new BufferAttribute(dustA, 1));
  const dustMat = track(new ShaderMaterial({ transparent: true, depthWrite: false, blending: AdditiveBlending, uniforms: { uCol: { value: new Color() }, uScale: { value: 1 }, uSize: { value: 3.2 } }, vertexShader: pointVS, fragmentShader: pointFS }));
  const dust = new Points(dustGeo, dustMat);
  dust.frustumCulled = false;
  scene.add(dust);

  // ---------- energy ribbon: tower → login card ----------
  const ribbonMat = track(new ShaderMaterial({
    transparent: true, depthWrite: false, blending: AdditiveBlending,
    uniforms: { uTime: { value: 0 }, uCol: { value: new Color() }, uOn: { value: 0 }, uFlow: { value: 1 }, uPulses: { value: new Array(8).fill(-9) }, uGrey: { value: 0 }, uWide: { value: 0 } },
    vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }`,
    fragmentShader: `varying vec2 vUv; uniform float uTime, uOn, uFlow, uPulses[8], uGrey, uWide; uniform vec3 uCol;
      void main(){
        float u = vUv.x;
        float across = max(sin(vUv.y * 3.14159), 0.);
        float core = uWide > .5 ? pow(across, 3.) * .22 : pow(across, 1.5);
        float bands = .35 + .65 * pow(.5 + .5 * sin((u * 26. - uTime * 3.2 * uFlow) * 1.), 6.);
        float p = 0.;
        for (int i = 0; i < 8; i++) p += exp(-((u - uPulses[i]) * 28.) * ((u - uPulses[i]) * 28.));
        float ends = smoothstep(0., .04, u) * smoothstep(1., .96, u);
        vec3 c = mix(uCol, vec3(dot(uCol, vec3(.3,.59,.11))), uGrey) * core * ends * uOn * (bands * .7 + p * 4.);
        gl_FragColor = vec4(c, 1.);
      }`,
  }));
  let ribbonGeo = null, ribbonGlowGeo = null;
  const ribbon = new Mesh(new BufferGeometry(), ribbonMat);
  const ribbonGlow = new Mesh(new BufferGeometry(), ribbonMat.clone());
  disposables.push(ribbonGlow.material);
  ribbonGlow.material.uniforms = { ...ribbonMat.uniforms, uWide: { value: 1 } };
  ribbon.frustumCulled = false; ribbonGlow.frustumCulled = false;
  ribbon.visible = ribbonGlow.visible = false;
  scene.add(ribbon, ribbonGlow);

  // ---------- shockwave ring (success) ----------
  const shockMat = track(new ShaderMaterial({
    transparent: true, depthWrite: false, blending: AdditiveBlending, side: 2,
    uniforms: { uA: { value: 0 }, uCol: { value: new Color(4, 3.2, 2) } },
    vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }`,
    fragmentShader: `varying vec2 vUv; uniform float uA; uniform vec3 uCol; void main(){ float r = length(vUv * 2. - 1.); float v = exp(-((r - .9) * 18.) * ((r - .9) * 18.)) + exp(-((r - .9) * 5.) * ((r - .9) * 5.)) * .25; gl_FragColor = vec4(uCol * v * uA, 1.); }`,
  }));
  const shock = new Mesh(quadGeo, shockMat);
  shock.rotation.x = -Math.PI / 2;
  shock.position.y = 0.05;
  shock.visible = false;
  islandTilt.add(shock);

  // ---------- post-processing ----------
  const rt = new WebGLRenderTarget(1, 1, { type: HalfFloatType, samples: lite ? 2 : 4 });
  const composer = new EffectComposer(renderer, rt);
  composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(new Vector2(256, 256), 1, 0.6, 0.7);
  composer.addPass(bloom);
  const fx = new ShaderPass({
    uniforms: {
      tDiffuse: { value: null }, uSun: { value: new Vector2(0.5, 0.5) }, uRays: { value: 0.5 }, uAspect: { value: 1 },
      uEclipse: { value: 0 }, uGrey: { value: 0 }, uFlash: { value: 0 }, uShockR: { value: -1 }, uShockA: { value: 0 }, uLight: { value: 0 }, uVis: { value: 1 },
    },
    vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }`,
    fragmentShader: `varying vec2 vUv; uniform sampler2D tDiffuse; uniform vec2 uSun; uniform float uRays, uAspect, uEclipse, uGrey, uFlash, uShockR, uShockA, uLight, uVis;
      void main(){
        vec2 uv = vUv;
        vec2 dv = (uv - uSun) * vec2(uAspect, 1.);
        float dist = length(dv);
        float ring = uShockA > 0. ? exp(-((dist - uShockR) * 16.) * ((dist - uShockR) * 16.)) * uShockA : 0.;
        uv -= normalize(dv + 1e-5) / vec2(uAspect, 1.) * ring * .02;
        vec3 col = texture2D(tDiffuse, uv).rgb;
        // god rays: march toward the sun, accumulate bright light
        const int NS = ${lite ? 14 : 24};
        vec2 delta = (uv - uSun) / float(NS) * .62;
        float jit = fract(sin(dot(gl_FragCoord.xy, vec2(12.9898, 78.233))) * 43758.5453);
        vec2 suv = uv - delta * jit; float illum = 1.; vec3 acc = vec3(0.);
        for (int i = 0; i < NS; i++) {
          suv -= delta;
          vec3 s = texture2D(tDiffuse, clamp(suv, 0., 1.)).rgb;
          float l = max(dot(s, vec3(.3, .59, .11)) - 1.1, 0.);
          float near = exp(-length((suv - uSun) * vec2(uAspect, 1.)) * 12.);
          acc += s * min(l, 3.) * illum * near;
          illum *= .96;
        }
        col += acc / float(NS) * uRays * 1.2;
        col += vec3(1., .86, .62) * ring * 2.5;
        // eclipse: cool blue-violet grade
        float lum = dot(col, vec3(.3, .59, .11));
        vec3 cool = vec3(lum) * vec3(.55, .62, 1.25) + vec3(.01, .012, .04);
        col = mix(col, cool, uEclipse * (.78 - uLight * .25));
        // storm / error: desaturate
        col = mix(col, vec3(lum) * vec3(.9, .9, 1.), uGrey * .85);
        // vignette
        float vig = smoothstep(1.25, .35, length((vUv - .5) * vec2(uAspect * .8, 1.)));
        col *= mix(1., vig, .55 - uLight * .4);
        col = mix(col, vec3(6.), uFlash);
        gl_FragColor = vec4(col * uVis, 1.);
      }`,
  });
  composer.addPass(fx);
  composer.addPass(new OutputPass());

  // ---------- palette ----------
  function applyTheme() {
    const th = T();
    skyMat.uniforms.uTop.value.set(th.skyTop); skyMat.uniforms.uMid.value.set(th.skyMid); skyMat.uniforms.uLow.value.set(th.skyLow);
    skyMat.uniforms.uGlow.value.set(th.skyGlow); skyMat.uniforms.uNebA.value.set(th.nebulaA); skyMat.uniforms.uNebB.value.set(th.nebulaB);
    skyMat.uniforms.uStars.value = th.stars;
    skyMat.uniforms.uGlowMix.value = S.theme === "light" ? 0.75 : 0;
    if (S.theme === "light") { skyMat.uniforms.uNebA.value.multiplyScalar(0.25); skyMat.uniforms.uNebB.value.multiplyScalar(0.3); }
    hemi.color.set(th.hemiSky); hemi.groundColor.set(th.hemiGround);
    topMat.color.set(th.top); rockMat.color.set(th.rock);
    veinUniforms.uVeinCol.value.set(th.vein).multiplyScalar(S.theme === "light" ? 1.2 : 1.5);
    rimMat.color.set(th.rim).multiplyScalar(S.theme === "light" ? 1.5 : 1.9);
    rim2Mat.color.set(th.rim).multiplyScalar(1.6);
    plateMat.color.set(th.panel); frameMat.color.set(th.frame); poleMat.color.set(th.pole);
    panelU.uCell.value.set(th.cell).multiplyScalar(S.theme === "light" ? 1.3 : 1.5);
    towerMat.color.set(th.tower); finMat.color.set(th.pole);
    sunMat.uniforms.uCore.value.set(th.sunCore); sunMat.uniforms.uMid.value.set(th.sunMid); sunMat.uniforms.uEdge.value.set(th.sunEdge);
    coronaMat.uniforms.uCol.value.set(th.corona).multiplyScalar(S.theme === "light" ? 1.1 : 1.5);
    moonMat.uniforms.uCol.value.set(th.moon); moonMat.uniforms.uRim.value.set(th.moonRim);
    cloudMat.uniforms.uCol.value.set(th.cloud);
    dustMat.uniforms.uCol.value.set(th.dust).multiplyScalar(S.theme === "light" ? 1.1 : 2.2);
    ribbonMat.uniforms.uCol.value.set(th.vein).multiplyScalar(S.theme === "light" ? 2.2 : 3);
    sunLight.color.set(th.sunMid).lerp(new Color("#ffffff"), 0.45);
    towerLight.color.set(th.vein);
    fillLight.color.set(S.theme === "light" ? "#f2a9c4" : "#8a6cff"); fillLight.intensity = S.theme === "light" ? 0.9 : 1.4;
    bloom.strength = th.bloom[0]; bloom.radius = th.bloom[1]; bloom.threshold = th.bloom[2];
    fx.uniforms.uLight.value = S.theme === "light" ? 1 : 0;
    plateMat.envMapIntensity = S.theme === "light" ? 0.55 : 1.25; frameMat.envMapIntensity = S.theme === "light" ? 0.6 : 0.9;
    buildEnv();
  }

  // ---------- camera framing: put the island where the layout wants it ----------
  const ELEV = lite ? 0.48 : 0.42; // camera elevation (rad)
  const look = new Vector3(0, 0.2, 0);
  let camDist = 20;
  const sunPlane = new Plane();
  const ray = new Raycaster();
  function frameCamera() {
    camera.aspect = S.w / S.h;
    camera.fov = 30;
    camera.updateProjectionMatrix();
    const spot = opts.getIslandSpot ? opts.getIslandSpot() : null;
    if (spot) S.spot = { x: spot.x / S.w, y: spot.y / S.h, size: spot.size };
    // island diameter (2R + bevel) should span spot.size pixels
    const D = 2 * (ISLAND_R + 0.3);
    const fpx = S.h / (2 * Math.tan(MathUtils.degToRad(camera.fov / 2)));
    camDist = (D * fpx) / Math.max(120, S.spot.size);
    camera.position.set(0, Math.sin(ELEV) * camDist + look.y, Math.cos(ELEV) * camDist);
    camera.lookAt(look);
    camera.updateMatrixWorld();
    const sx = S.spot.x * 2 - 1, sy = 1 - S.spot.y * 2;
    camera.projectionMatrix.elements[8] = -sx;
    camera.projectionMatrix.elements[9] = -sy;
    camera.projectionMatrixInverse.copy(camera.projectionMatrix).invert();
    // the sun lives on a plane facing the camera, a little behind the island
    const n = new Vector3().subVectors(camera.position, look).normalize();
    sunPlane.setFromNormalAndCoplanarPoint(n, new Vector3(0, 0, SUN_Z));
    updateRibbon();
  }

  function screenToSun(px, py, out) {
    const ndc = new Vector2((px / S.w) * 2 - 1, 1 - (py / S.h) * 2);
    ray.setFromCamera(ndc, camera);
    if (!ray.ray.intersectPlane(sunPlane, out)) return false;
    out.y = Math.max(out.y, 2.3);
    const lim = ISLAND_R * 2.6;
    out.x = clamp(out.x, -lim, lim);
    out.y = Math.min(out.y, ISLAND_R * 2.2);
    return true;
  }
  function defaultSun(out, t) {
    // idle: a slow arc over the island
    // computed in screen space around the island so it always stays on stage
    const a = Math.PI * 0.5 + Math.sin(t * 0.21) * 0.85;
    // wide layout: swing between the island and the card (never behind the headline)
    const z = S.spot.size, x0 = S.spot.x * S.w, wide = S.spot.x < 0.45;
    const lo = wide ? x0 - z * 0.05 : x0 - z * 0.6, hi = wide ? x0 + z * 0.68 : x0 + z * 0.6;
    const sx = (lo + hi) / 2 + Math.cos(a) * (hi - lo) / 2 / Math.sin(0.85 + 0.0001) * 0.75;
    const sy = Math.max(SUN_R * 40 + 12, S.spot.y * S.h - z * (0.42 + 0.3 * Math.sin(a)));
    if (!screenToSun(sx, sy, out)) out.set(0, 4, SUN_Z);
    return out;
  }

  function anchorWorld() {
    const a = opts.getAnchor ? opts.getAnchor() : null;
    if (!a) return null;
    const ndc = new Vector2((a.x / S.w) * 2 - 1, 1 - (a.y / S.h) * 2);
    ray.setFromCamera(ndc, camera);
    const p = new Vector3();
    const pl = new Plane().setFromNormalAndCoplanarPoint(new Vector3().subVectors(camera.position, look).normalize(), new Vector3(0, 0, 0));
    return ray.ray.intersectPlane(pl, p) ? p : null;
  }
  function updateRibbon() {
    const A = anchorWorld();
    if (!A) { ribbon.visible = ribbonGlow.visible = false; return; }
    const P0 = TOWER_TOP.clone();
    const up = Math.max(P0.y + 1.2, A.y + 0.8);
    const curve = new CatmullRomCurve3([
      P0, new Vector3(P0.x + (A.x - P0.x) * 0.12, up + 0.3, P0.z + (A.z - P0.z) * 0.1),
      new Vector3(P0.x + (A.x - P0.x) * 0.55, up + 0.5, P0.z + (A.z - P0.z) * 0.55), new Vector3(A.x - 0.3 * Math.sign(A.x - P0.x || 1), A.y + 0.1, A.z), A,
    ], false, "centripetal");
    const g1 = new TubeGeometry(curve, 90, 0.045, 6, false);
    const g2 = new TubeGeometry(curve, 90, 0.2, 8, false);
    ribbon.geometry.dispose(); ribbonGlow.geometry.dispose();
    ribbon.geometry = g1; ribbonGlow.geometry = g2;
    ribbonGeo = g1; ribbonGlowGeo = g2;
    ribbon.visible = ribbonGlow.visible = true;
  }

  function resize() {
    const r = host.getBoundingClientRect();
    S.w = Math.max(1, r.width); S.h = Math.max(1, r.height);
    renderer.setSize(S.w, S.h, false);
    composer.setPixelRatio(dpr);
    composer.setSize(S.w, S.h);
    fx.uniforms.uAspect.value = S.w / S.h;
    skyMat.uniforms.uAspect.value = S.w / S.h;
    frameCamera();
    if (still) render(0);
  }

  // ---------- panel targets ----------
  const tmpV = new Vector3(), tmpN = new Vector3(), camLocal = new Vector3(), sunLocal = new Vector3();
  function panelTargets(p, target, mode) {
    // returns [roll, pitch] so the panel normal points at `target` (island-local), within tracker limits
    tmpV.set(target.x - p.x, target.y - PIVOT_Y, target.z - p.z).normalize();
    let roll = Math.atan2(-tmpV.x, Math.max(0.05, tmpV.y));
    let pitch = Math.atan2(tmpV.z, Math.max(0.05, Math.hypot(tmpV.x, tmpV.y)));
    if (mode === "droop") { roll = -roll * 0.7 + (p.x > 0 ? 0.9 : -0.9); pitch = -0.55; }
    return [clamp(roll, -1.12, 1.12), clamp(pitch, -0.6, 0.85)];
  }

  function spawnPhoton(ph, now) {
    const idx = (Math.random() * N) | 0;
    const p = panels[idx];
    ph.idx = idx;
    ph.t0 = now;
    ph.dur = 0.55 + Math.random() * 0.45;
    ph.from.copy(S.sun).add(tmpV.set((Math.random() - 0.5) * 0.6, (Math.random() - 0.5) * 0.6, 0));
    ph.to.set(p.x, PIVOT_Y + 0.08, p.z).applyMatrix4(islandTilt.matrixWorld);
  }
  photons.forEach((ph, i) => { ph.t0 = -1 - i * 0.12; ph.dur = 1; ph.idx = i % N; });

  function packet(i, value) {
    const v = veinUniforms.uPk.value[i >> 2];
    const k = i & 3;
    if (k === 0) v.x = value; else if (k === 1) v.y = value; else if (k === 2) v.z = value; else v.w = value;
  }
  const packets = new Float32Array(N).fill(-1);

  function launchRibbonPulse(speed) {
    if (S.ribbonPulses.length < 8) S.ribbonPulses.push({ u: 0, v: speed || 0.9 + Math.random() * 0.3 });
  }

  // ---------- simulation ----------
  const camDir = new Vector3();
  function step(dt) {
    S.t += dt;
    if (!still) S.intro += dt;
    const th = T();
    const I = S.intro;
    const succ = S.success >= 0 ? S.t - S.success : -1;

    // sun target: pointer, else the idle arc
    // mouse: the sun stays with the cursor; touch: it resumes its own arc 4 s after the finger lifts
    const idle = !S.pointer || (S.pointer.touch && S.t - S.pointerT > 4);
    if (!idle && S.pointer && !still) screenToSun(S.pointer.x, S.pointer.y, S.sunTarget);
    else if (!still) defaultSun(S.sunTarget, S.t);
    if (still) { defaultSun(S.sunTarget, 0.9); S.sun.copy(S.sunTarget); }
    else {
      // critically-damped-ish spring → smooth inertia with a hint of overshoot
      const k = idle ? 10 : 34, c = idle ? 6.5 : 9.5;
      S.sunVel.addScaledVector(tmpV.subVectors(S.sunTarget, S.sun), k * dt).multiplyScalar(Math.exp(-c * dt));
      S.sun.addScaledVector(S.sunVel, dt);
    }

    // intro timings
    const spark = still ? 1 : smooth((I - 0.08) / 0.18);
    const grow = still ? 1 : easeBack((I - 0.16) / 0.62);
    const rise = still ? 1 : easeOut((I - 0.32) / 0.85);
    const vis = still ? 1 : smooth((I - 0.05) / 0.9);

    // island bob + rise
    const bob = still ? 0 : Math.sin(S.t * 0.9) * 0.12;
    island.position.y = -6 * (1 - rise) + bob;
    islandTilt.rotation.z = still ? 0 : Math.sin(S.t * 0.53) * 0.012;
    islandTilt.rotation.x = still ? 0 : Math.cos(S.t * 0.41) * 0.01;
    island.updateMatrixWorld(true);
    pebbles.forEach((m) => {
      const u = m.userData;
      m.position.set(Math.cos(u.a + S.t * 0.05) * u.r, u.y + Math.sin(S.t * 0.8 + u.ph) * 0.15, Math.sin(u.a + S.t * 0.05) * u.r);
      m.rotation.set(S.t * 0.2 + u.ph, S.t * 0.13, 0);
    });

    // moods
    // a storm (error) pushes the eclipse aside
    const eTarget = S.stormHold > 0 ? 0 : S.eclipseTarget;
    S.eclipse = still ? eTarget : damp(S.eclipse, eTarget, eTarget > S.eclipse ? 3.2 : 5, dt);
    if (S.stormHold > 0) S.stormHold -= dt;
    const stormOn = S.stormHold > 0 ? 1 : 0;
    S.storm = still ? stormOn : damp(S.storm, stormOn, stormOn ? 9 : 2.6, dt);
    S.grey = still ? stormOn : damp(S.grey, stormOn, stormOn ? 9 : 2.2, dt);
    S.flare = succ >= 0 ? (still ? 0.55 : smooth(succ / 0.4)) : 0;

    // sun placement / look
    sunGroup.position.copy(S.sun);
    sunGroup.quaternion.copy(camera.quaternion);
    const sunScale = Math.max(0.0001, (0.05 + 0.95 * grow) * (1 + S.flare * 2.6));
    sunOrb.scale.setScalar(sunScale);
    corona.scale.setScalar(SUN_R * 9.5 * Math.max(0.0001, 0.25 + 0.75 * grow) * (1 + S.flare * 1.4));
    sunMat.uniforms.uBright.value = th.sunBright * (spark * (still ? 1 : 1 + (1 - grow) * 3)) * (1 - S.storm * 0.5);
    sunMat.uniforms.uFlare.value = S.flare;
    coronaMat.uniforms.uBright.value = spark * (1 - S.storm * 0.75) * (1 + S.submitting * 0.25 * Math.sin(S.t * 10));
    coronaMat.uniforms.uEclipse.value = S.eclipse;
    coronaMat.uniforms.uFlare.value = S.flare;
    // eclipse moon slides in from the right
    moon.visible = S.eclipse > 0.01;
    moon.position.set((1 - S.eclipse) * SUN_R * 2.6, (1 - S.eclipse) * SUN_R * 0.4, SUN_R * 1.15);
    moon.scale.setScalar(sunScale);
    // storm cloud covers the sun from the left
    cloud.visible = S.storm > 0.01;
    cloud.position.copy(S.sun).add(tmpV.set(-(1 - S.storm) * 2.6, 0.15, 0).applyQuaternion(camera.quaternion)).addScaledVector(camDir.subVectors(camera.position, S.sun).normalize(), 1.4);
    cloud.quaternion.copy(camera.quaternion);
    cloudMat.uniforms.uA.value = clamp01(S.storm * 1.3) * 0.96;
    if (!still && S.storm > 0.6 && S.t > S.nextBolt) { S.bolt = 1; S.nextBolt = S.t + 0.22 + Math.random() * 0.25; makeBolt(); }
    S.bolt = Math.max(0, S.bolt - dt * 7);
    cloudMat.uniforms.uBolt.value = S.bolt * (S.storm > 0.3 ? 1 : 0);
    boltMat.opacity = S.bolt > 0.35 && S.storm > 0.5 ? 1 : 0;
    if (still && S.storm > 0.5) { cloudMat.uniforms.uBolt.value = 0.7; boltMat.opacity = 1; if (!boltPos[3]) makeBolt(); }

    const sunVis = spark * (1 - S.eclipse * 0.85) * (1 - S.storm * 0.8);
    // light
    sunLocal.copy(S.sun);
    islandTilt.worldToLocal(sunLocal);
    sunLight.position.copy(S.sun).sub(island.position).normalize().multiplyScalar(18).add(island.position);
    sunLight.target.position.copy(island.position);
    sunLight.target.updateMatrixWorld();
    sunLight.intensity = th.sunI * sunVis * (1 + S.flare * 1.5);
    hemi.intensity = th.hemiI * (0.35 + 0.65 * vis) * (1 - S.eclipse * 0.45);
    towerLight.intensity = (3 + S.towerPulse * 10 + (S.submitting ? 4 + 3 * Math.sin(S.t * 14) : 0)) * vis * (1 - S.grey * 0.7);

    // panels
    camLocal.copy(camera.position);
    islandTilt.worldToLocal(camLocal);
    let totalGlow = 0;
    const mode = S.storm > 0.4 ? "droop" : "track";
    for (const p of panels) {
      // unfold during the intro, centre-out
      const u0 = 0.72 + p.order * (0.55 / N);
      p.unfold = still ? 1 : easeBack((I - u0) / 0.38);
      const tgt = succ >= 0 ? camLocal : sunLocal;
      // a lagged view of the sun → nearest panels respond first (staggered wave)
      const d = Math.hypot(p.x - sunLocal.x * 0.35, p.z - sunLocal.z * 0.35);
      if (still) p.seen.copy(tgt);
      else {
        if (!p.seenInit) { p.seen.copy(tgt); p.seenInit = true; }
        const rate = succ >= 0 ? 30 : 18 / (1 + 1.1 * d);
        p.seen.x = damp(p.seen.x, tgt.x, rate, dt); p.seen.y = damp(p.seen.y, tgt.y, rate, dt); p.seen.z = damp(p.seen.z, tgt.z, rate, dt);
      }
      const [tr, tp] = I < u0 ? [(p.i % 2 ? 1 : -1) * 1.1, -0.6] : panelTargets(p, p.seen, mode);
      if (still) { p.roll = tr; p.pitch = tp; }
      else {
        const k = succ >= 0 ? 260 : mode === "droop" ? 70 : 46, c = succ >= 0 ? 22 : 6.2;
        p.rollV += (tr - p.roll) * k * dt; p.rollV *= Math.exp(-c * dt); p.roll += p.rollV * dt;
        p.pitchV += (tp - p.pitch) * k * dt; p.pitchV *= Math.exp(-c * dt); p.pitch += p.pitchV * dt;
      }
      e4.set(p.pitch, 0, p.roll, "ZXY");
      q4.setFromEuler(e4);
      const sc = Math.max(0.0001, p.unfold);
      m4.compose(v4.set(p.x, PIVOT_Y, p.z), q4, s4.set(sc, Math.max(0.0001, 0.3 + 0.7 * sc), sc));
      plates.setMatrixAt(p.i, m4); frames.setMatrixAt(p.i, m4);
      // facing factor → glow
      tmpN.set(0, 1, 0).applyQuaternion(q4);
      tmpV.set(sunLocal.x - p.x, sunLocal.y - PIVOT_Y, sunLocal.z - p.z).normalize();
      const facing = tmpN.dot(tmpV);
      const g = smooth((facing - 0.55) / 0.43) * sunVis * clamp01(p.unfold) * (1 - S.grey);
      p.glow = still ? g : damp(p.glow, Math.max(g, S.flare), 8, dt);
      p.hit = Math.max(0, p.hit - dt * 2.2);
      aGlow[p.i] = p.glow * (0.75 + 0.25 * Math.sin(S.t * 3 + p.phase * 6)) + S.flare * 1.5;
      aHit[p.i] = p.hit;
      totalGlow += p.glow;
      // veins: continuous flow speed ∝ glow, packets travel to the tower
      p.phase += dt * (0.25 + p.glow * (S.submitting ? 2.4 : 1.1));
      const vv = veinUniforms.uVein.value[p.i];
      vv.z = p.glow * (1 - S.eclipse * 0.6); vv.w = p.phase;
      if (packets[p.i] >= 0) {
        packets[p.i] += dt * (0.9 + p.glow * 1.1) * (S.submitting ? 1.8 : 1);
        if (packets[p.i] >= 1) {
          packets[p.i] = -1;
          S.towerPulse = 1;
          if (S.arriveCooldown <= 0) { launchRibbonPulse(); S.arriveCooldown = S.submitting ? 0.12 : 0.45; }
        }
      }
      packet(p.i, packets[p.i]);
    }
    S.arriveCooldown -= dt;
    plates.instanceMatrix.needsUpdate = true; frames.instanceMatrix.needsUpdate = true;
    glowAttr.needsUpdate = true; hitAttr.needsUpdate = true;
    S.avgGlow = totalGlow / N;
    panelU.uGrey.value = S.grey;
    veinUniforms.uVeinOn.value = vis * (0.55 + 0.45 * S.avgGlow) * (1 - S.grey * 0.85) * (1 - S.eclipse * 0.35) + S.flare;
    veinUniforms.uTime.value = S.t;

    // tower
    S.towerPulse = Math.max(0, S.towerPulse - dt * 2.6);
    const tp = S.towerPulse + (S.submitting ? 0.6 + 0.4 * Math.sin(S.t * 16) : 0) + S.flare * 2;
    towerGlowMat.color.set(th.vein).multiplyScalar((1.6 + tp * 3) * (0.3 + 0.7 * vis) * (1 - S.grey * 0.7));
    orbMat.color.set(th.sunCore).multiplyScalar((1.4 + tp * 2.2 + S.avgGlow * 0.6) * vis * (1 - S.grey * 0.6));
    towerOrb.scale.setScalar(1 + tp * 0.35);
    towerRings.forEach((r, k) => { r.position.y = 0.7 + k * 0.65 + Math.sin(S.t * 2 + k) * 0.04; r.rotation.z = S.t * (0.6 + k * 0.3); });

    // photons
    const active = !still && I > 1.3 && succ < 0 && S.storm < 0.3;
    for (let i = 0; i < PHOTONS; i++) {
      const ph = photons[i];
      let t = (S.t - ph.t0) / ph.dur;
      if (t >= 1) {
        if (t < 3 && active && S.eclipse < 0.5) {
          const p = panels[ph.idx];
          p.hit = 1;
          if (packets[ph.idx] < 0) packets[ph.idx] = 0;
        }
        spawnPhoton(ph, S.t + Math.random() * (S.submitting ? 0.1 : 0.6) / Math.max(0.25, S.avgGlow + 0.2));
        t = (S.t - ph.t0) / ph.dur;
      }
      for (let k = 0; k < TRAIL; k++) {
        const tk = clamp01(t - k * 0.035);
        const u = tk * tk * (3 - 2 * tk);
        const j = (i * TRAIL + k) * 3;
        photonPos[j] = MathUtils.lerp(ph.from.x, ph.to.x, u);
        photonPos[j + 1] = MathUtils.lerp(ph.from.y, ph.to.y, u);
        photonPos[j + 2] = MathUtils.lerp(ph.from.z, ph.to.z, u);
        photonA[i * TRAIL + k] = t > 0 && t < 1 && active ? Math.min(1, t * 4) * (1 - k / TRAIL) * (1 - S.eclipse * 0.9) : 0;
      }
    }
    if (PHOTONS) { photonGeo.attributes.position.needsUpdate = true; photonGeo.attributes.aA.needsUpdate = true; }
    photonMat.uniforms.uScale.value = dustMat.uniforms.uScale.value = renderer.getPixelRatio() * (S.h / 900) * (22 / camDist) * 1.6;

    // dust drifting in the light
    for (let i = 0; i < DUST; i++) {
      const j = i * 3, ph = dustA[i];
      dustPos[j] = dustSeed[j] + Math.sin(S.t * 0.15 + ph * 20) * 0.6;
      dustPos[j + 1] = ((dustSeed[j + 1] + 3 + S.t * (0.08 + ph * 0.12)) % 9) - 3 + island.position.y * 0.3;
      dustPos[j + 2] = dustSeed[j + 2] + Math.cos(S.t * 0.12 + ph * 13) * 0.6;
    }
    dustGeo.attributes.position.needsUpdate = true;
    dustMat.uniforms.uSize.value = 3.2 * (0.6 + 0.6 * vis) * (1 - S.eclipse * 0.5);

    // ribbon to the card
    S.ribbonPulses.forEach((p) => { p.u += dt * p.v * (S.submitting ? 1.7 : 1); });
    for (let i = S.ribbonPulses.length - 1; i >= 0; i--) {
      if (S.ribbonPulses[i].u > 1.02) { S.ribbonPulses.splice(i, 1); opts.onArrive && opts.onArrive(); }
    }
    const pu = ribbonMat.uniforms.uPulses.value;
    for (let i = 0; i < 8; i++) pu[i] = S.ribbonPulses[i] ? S.ribbonPulses[i].u : -9;
    ribbonMat.uniforms.uOn.value = (still ? 1 : smooth((I - 1.3) / 0.5)) * (0.45 + 0.55 * S.avgGlow) * (1 - S.storm * 0.7) + S.flare * 2;
    ribbonMat.uniforms.uFlow.value = S.submitting ? 3 : 0.6 + S.avgGlow;
    ribbonMat.uniforms.uGrey.value = S.grey;
    ribbonMat.uniforms.uTime.value = S.t;

    // shockwave
    shock.visible = succ >= 0.15;
    if (shock.visible) {
      const k = clamp01((succ - 0.15) / 0.75);
      shock.scale.setScalar(0.5 + easeOut(k) * ISLAND_R * 5);
      shockMat.uniforms.uA.value = (1 - k) * 1.6;
    }

    // sky + screen space
    const sp = S.sun.clone().project(camera);
    const sunUv = new Vector2((sp.x + 1) / 2, (sp.y + 1) / 2);
    skyMat.uniforms.uSun.value.copy(sunUv);
    skyMat.uniforms.uTime.value = S.t;
    skyMat.uniforms.uVis.value = 0.08 + 0.92 * vis;
    skyMat.uniforms.uEclipse.value = S.eclipse;
    skyMat.uniforms.uStorm.value = S.storm;
    skyMat.uniforms.uFlare.value = S.flare;
    skyMat.uniforms.uSunVis.value = spark;
    sunMat.uniforms.uTime.value = S.t;
    coronaMat.uniforms.uTime.value = S.t;
    cloudMat.uniforms.uTime.value = S.t;
    fx.uniforms.uSun.value.copy(sunUv);
    fx.uniforms.uRays.value = th.rays * spark * (1 - S.storm * 0.8) * (1 + S.eclipse * 0.6) + S.flare * 0.8;
    fx.uniforms.uEclipse.value = S.eclipse;
    fx.uniforms.uGrey.value = S.grey * 0.75;
    fx.uniforms.uFlash.value = succ >= 0 ? (still ? 0.25 : smooth((succ - 0.3) / 0.6) * 0.85) : 0;
    fx.uniforms.uShockR.value = succ >= 0 ? easeOut(clamp01((succ - 0.1) / 0.8)) * 1.6 : -1;
    fx.uniforms.uShockA.value = succ >= 0.1 ? 1 - clamp01((succ - 0.1) / 0.8) : 0;
    fx.uniforms.uVis.value = 1;

    // lens-flare ghosts along sun → centre line
    const ghostA = spark * (1 - S.eclipse) * (1 - S.storm) * (S.theme === "light" ? 0.25 : 0.5) * clamp01(1.3 - Math.hypot(sp.x, sp.y) * 0.4);
    for (const g of GHOSTS) {
      const gx = sp.x * g.k, gy = sp.y * g.k;
      const wp = new Vector3(gx, gy, 0.2).unproject(camera);
      const dir = wp.sub(camera.position).normalize();
      g.m.position.copy(camera.position).addScaledVector(dir, 6);
      g.m.quaternion.copy(camera.quaternion);
      g.m.scale.setScalar(g.s * 1.6);
      g.m.material.uniforms.uA.value = ghostA;
    }

    // exposure: intro from darkness, flare at success
    renderer.toneMappingExposure = th.exposure * (0.12 + 0.88 * vis) * (1 - S.eclipse * 0.25);

    // tell the page where the sun is (card highlight / tilt / charge)
    const sx = sunUv.x * S.w, sy = (1 - sunUv.y) * S.h;
    const edge = S.sun.clone().add(tmpV.set(SUN_R * sunScale, 0, 0).applyQuaternion(camera.quaternion)).project(camera);
    S.sunScreen = { x: sx, y: sy, r: Math.abs((edge.x - sp.x) / 2 * S.w) };
    opts.onSun && opts.onSun(sx, sy, S.sunScreen.r, sunVis);
  }

  function makeBolt() {
    const start = cloud.position.clone().add(tmpV.set((Math.random() - 0.5) * 0.8, -0.6, 0).applyQuaternion(camera.quaternion));
    let p = start.clone();
    for (let i = 0; i < 12; i++) {
      boltPos[i * 3] = p.x; boltPos[i * 3 + 1] = p.y; boltPos[i * 3 + 2] = p.z;
      p = p.clone().add(tmpV.set((Math.random() - 0.5) * 0.35, -0.16 - Math.random() * 0.12, 0).applyQuaternion(camera.quaternion));
    }
    boltGeo.attributes.position.needsUpdate = true;
  }

  function render(dt) {
    step(dt);
    composer.render(dt);
  }

  function frame(now) {
    if (!S.running) return;
    S.raf = requestAnimationFrame(frame);
    const dt = Math.min(0.05, (now - (S.last || now)) / 1000);
    S.last = now;
    render(dt);
    // low-FPS watchdog: after the intro, measure ~2.5 s; first drop DPR, then give up
    const L = S.lowFps;
    if (!L.done && S.intro > 2) {
      if (!L.start) { L.start = now; L.frames = 0; }
      L.frames++;
      const el = now - L.start;
      if (el > 2500) {
        const fps = (L.frames * 1000) / el;
        S.fps = fps;
        if (fps < 26) {
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
  const setPointerPx = (x, y, touch) => { S.pointer = { x, y, touch: !!touch }; S.pointerT = S.t; };
  const onPointer = (ev) => {
    if (ev.pointerType === "touch") return; // touch is routed by the page (drag on the scene area only)
    const r = host.getBoundingClientRect();
    setPointerPx(ev.clientX - r.left, ev.clientY - r.top);
  };
  const ro = new ResizeObserver(() => resize());
  ro.observe(host);
  document.addEventListener("visibilitychange", onVis);
  if (!still) window.addEventListener("pointermove", onPointer, { passive: true });

  applyTheme();
  resize();
  if (still) render(0); else if (!document.hidden) start();

  const rerenderStill = () => { if (still && !S.disposed) render(0); };

  return {
    canvas,
    setTheme(theme) { S.theme = theme === "light" ? "light" : "dark"; applyTheme(); rerenderStill(); },
    setMood({ eclipse = 0 } = {}) { S.eclipseTarget = eclipse; rerenderStill(); },
    setSubmitting(v) { S.submitting = !!v; if (v) { S.towerPulse = 1; launchRibbonPulse(1.6); } },
    setPointer(clientX, clientY, touch) {
      const r = host.getBoundingClientRect();
      setPointerPx(clientX - r.left, clientY - r.top, touch);
    },
    pulse() {
      if (still) return;
      launchRibbonPulse(1.5);
      S.towerPulse = Math.min(1, S.towerPulse + 0.6);
      for (let i = 0; i < 3; i++) { const p = panels[(Math.random() * N) | 0]; p.hit = 1; if (packets[p.i] < 0) packets[p.i] = 0.3; }
    },
    skipIntro() { if (!still && S.intro < 2.0) S.intro = 2.0; },
    error() { S.stormHold = 0.95; S.nextBolt = S.t + 0.08; rerenderStill(); },
    success() { S.success = S.t; S.eclipseTarget = 0; S.eclipse = 0; S.stormHold = 0; if (still) render(0); },
    refreshAnchor() { frameCamera(); rerenderStill(); },
    // move the canvas to a new host (the success overlay outlives the login component)
    adopt(newHost) {
      if (!newHost || S.disposed) return;
      ro.disconnect();
      host = newHost;
      if (canvas.parentNode !== host) host.appendChild(canvas);
      ro.observe(host);
      resize();
    },
    getState() {
      return {
        intro: S.intro, running: S.running, still, lite, eclipse: S.eclipse, storm: S.storm, grey: S.grey, flare: S.flare, fps: S.fps || null,
        sun: { x: S.sunScreen.x, y: S.sunScreen.y, r: S.sunScreen.r }, avgGlow: S.avgGlow || 0,
        rolls: panels.map((p) => +p.roll.toFixed(4)), pitches: panels.map((p) => +p.pitch.toFixed(4)), panels: N, dpr,
      };
    },
    dispose() {
      if (S.disposed) return;
      S.disposed = true;
      stop();
      ro.disconnect();
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("pointermove", onPointer);
      if (ribbonGeo) ribbonGeo.dispose();
      if (ribbonGlowGeo) ribbonGlowGeo.dispose();
      ribbon.geometry.dispose(); ribbonGlow.geometry.dispose();
      plates.dispose(); frames.dispose(); poles.dispose();
      for (const d of disposables) d.dispose && d.dispose();
      for (const g of GHOSTS) g.m.material.dispose();
      composer.passes.forEach((p) => p.dispose && p.dispose());
      composer.dispose();
      rt.dispose();
      if (envRT) envRT.dispose();
      pmrem.dispose();
      renderer.dispose();
      renderer.forceContextLoss();
      canvas.remove();
    },
  };
}

