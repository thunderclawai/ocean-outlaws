import * as THREE from "three";

var vertexShader = /* glsl */ `
  uniform float uTime;
  varying float vHeight;
  varying vec2 vUv;

  void main() {
    vUv = uv;
    vec3 pos = position;

    // layer 1 — broad swells
    pos.z += sin(pos.x * 0.3 + uTime * 0.8) * 1.2;
    pos.z += sin(pos.y * 0.2 + uTime * 0.6) * 1.0;

    // layer 2 — medium chop
    pos.z += sin(pos.x * 0.8 + pos.y * 0.6 + uTime * 1.4) * 0.5;

    // layer 3 — small ripples
    pos.z += sin(pos.x * 2.0 + uTime * 2.0) * 0.15;
    pos.z += sin(pos.y * 2.5 + uTime * 1.8) * 0.12;

    vHeight = pos.z;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
  }
`;

var fragmentShader = /* glsl */ `
  uniform float uTime;
  varying float vHeight;
  varying vec2 vUv;

  void main() {
    // dark atmospheric base
    vec3 deep    = vec3(0.02, 0.04, 0.10);
    vec3 mid     = vec3(0.04, 0.08, 0.18);
    vec3 crest   = vec3(0.08, 0.14, 0.26);
    vec3 foam    = vec3(0.15, 0.22, 0.35);

    // map height to colour
    float t = smoothstep(-2.0, 2.5, vHeight);
    vec3 col = mix(deep, mid, smoothstep(0.0, 0.35, t));
    col = mix(col, crest, smoothstep(0.35, 0.7, t));
    col = mix(col, foam, smoothstep(0.8, 1.0, t));

    // subtle shimmer
    float shimmer = sin(vUv.x * 60.0 + uTime * 1.5) * sin(vUv.y * 60.0 + uTime * 1.2);
    col += vec3(0.01) * smoothstep(0.6, 1.0, shimmer) * t;

    gl_FragColor = vec4(col, 1.0);
  }
`;

export function createOcean() {
  var geometry = new THREE.PlaneGeometry(400, 400, 128, 128);

  var uniforms = {
    uTime: { value: 0 }
  };

  var material = new THREE.ShaderMaterial({
    vertexShader: vertexShader,
    fragmentShader: fragmentShader,
    uniforms: uniforms,
    side: THREE.DoubleSide
  });

  var mesh = new THREE.Mesh(geometry, material);
  mesh.rotation.x = -Math.PI / 2; // lay flat

  return { mesh: mesh, uniforms: uniforms };
}

export function updateOcean(uniforms, elapsed) {
  uniforms.uTime.value = elapsed;
}
