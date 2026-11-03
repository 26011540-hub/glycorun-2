import * as THREE from "three";

/**
 * Sintomas na visão (como no original): hipoglicemia = visão sem cor; hiperglicemia = visão embaçada e amarelada.
 * Só é usado quando há sintoma: no resto do tempo a cena vai direto para a tela (mais leve).
 */

const VERT = `varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`;
const FRAG = `
uniform sampler2D tex; uniform vec2 px; uniform float gray; uniform float blur; uniform float warm;
varying vec2 vUv;
void main(){
  vec3 c = texture2D(tex, vUv).rgb;
  if (blur > 0.0) {
    vec2 r = px * blur;
    vec3 s = c * 0.2;
    s += texture2D(tex, vUv + vec2( r.x, 0.0)).rgb * 0.1;
    s += texture2D(tex, vUv + vec2(-r.x, 0.0)).rgb * 0.1;
    s += texture2D(tex, vUv + vec2(0.0,  r.y)).rgb * 0.1;
    s += texture2D(tex, vUv + vec2(0.0, -r.y)).rgb * 0.1;
    s += texture2D(tex, vUv + r * 0.7).rgb * 0.1;
    s += texture2D(tex, vUv - r * 0.7).rgb * 0.1;
    s += texture2D(tex, vUv + vec2(r.x, -r.y) * 0.7).rgb * 0.1;
    s += texture2D(tex, vUv + vec2(-r.x, r.y) * 0.7).rgb * 0.1;
    c = s;
  }
  float l = dot(c, vec3(0.299, 0.587, 0.114));
  c = mix(c, vec3(l), gray);
  float v = smoothstep(0.3, 0.8, length(vUv - 0.5));
  c = mix(c, c * vec3(1.05, 0.96, 0.72) + vec3(0.05, 0.04, 0.0), warm * 0.6);
  c = mix(c, vec3(0.85, 0.66, 0.18), warm * v * 0.5);
  gl_FragColor = vec4(c, 1.0);
  #include <colorspace_fragment>
}`;

export class Symptoms {
  private target: THREE.WebGLRenderTarget;
  private scene = new THREE.Scene();
  private cam = new THREE.Camera();
  private mat: THREE.ShaderMaterial;
  gray = 0;
  blur = 0;
  warm = 0;

  constructor() {
    this.target = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: 4 });
    this.mat = new THREE.ShaderMaterial({
      uniforms: { tex: { value: this.target.texture }, px: { value: new THREE.Vector2() }, gray: { value: 0 }, blur: { value: 0 }, warm: { value: 0 } },
      vertexShader: VERT,
      fragmentShader: FRAG,
      depthTest: false,
      depthWrite: false,
    });
    const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.mat);
    quad.frustumCulled = false;
    this.scene.add(quad);
  }

  get active(): boolean { return this.gray > 0.01 || this.blur > 0.05 || this.warm > 0.01; }

  setSize(w: number, h: number, msaa: number): void {
    this.target.setSize(w, h);
    this.target.samples = msaa;
    (this.mat.uniforms.px.value as THREE.Vector2).set(1 / w, 1 / h);
  }

  render(renderer: THREE.WebGLRenderer, scene: THREE.Scene, camera: THREE.Camera): void {
    const u = this.mat.uniforms;
    u.gray.value = this.gray;
    u.blur.value = this.blur * (renderer.getPixelRatio() * 2.2);
    u.warm.value = this.warm;
    renderer.setRenderTarget(this.target);
    renderer.render(scene, camera);
    renderer.setRenderTarget(null);
    renderer.render(this.scene, this.cam);
  }
}
