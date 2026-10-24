import{C as e,S as t,_ as n,c as r,d as i,f as a,g as o,h as s,l as c,n as l,p as u,s as ee,t as d,w as f,x as p}from"./three.module-CnXJGYfT.js";var m=30,h=new t(1.6,1),g=.3,_=.028,v=(t,n=new e)=>n.set(t*2.7,Math.sin(t*1.7)*.2,-t*3.6),y=t=>{let n=String(t).match(/\d+(\.\d+)?/g)?.map(Number)??[15,27,45];return new e(n[0]/255,n[1]/255,n[2]/255)},te=`
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`,ne=`
  uniform sampler2D uMap;
  uniform float uHasMap;
  uniform vec2 uSize;
  uniform float uPad;
  uniform float uRadius;
  uniform float uAlpha;
  uniform float uDim;
  uniform float uRim;
  uniform vec3 uBase;
  uniform vec3 uShade;
  varying vec2 vUv;
  float box(vec2 p, vec2 b, float r) {
    vec2 q = abs(p) - b + r;
    return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r;
  }
  void main() {
    vec2 full = uSize + 2.0 * uPad;
    vec2 p = (vUv - 0.5) * full;
    float d = box(p, uSize * 0.5, uRadius);
    float aa = max(fwidth(d), 1e-5);
    float inside = 1.0 - smoothstep(-aa, aa, d);
    float ds = box(p + vec2(0.0, uPad * 0.32), uSize * 0.5, uRadius);
    float shadow = (1.0 - smoothstep(-uPad * 0.25, uPad * 0.9, ds)) * 0.55 * (1.0 - uDim);
    vec2 uv = clamp(p / uSize + 0.5, 0.0, 1.0);
    vec3 col = mix(uBase, texture2D(uMap, uv).rgb, uHasMap);
    float edge = 1.0 - smoothstep(0.0, aa * 2.5, abs(d + aa * 1.5));
    col = mix(col, vec3(1.0), edge * (0.12 + 0.3 * uRim));
    col = mix(col, uShade, uDim);
    float a = inside + shadow * (1.0 - inside);
    gl_FragColor = vec4(col * inside * uAlpha, a * uAlpha);
  }
`,re=`
  uniform float uSize;
  varying float vFade;
  void main() {
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mv;
    float dist = -mv.z;
    gl_PointSize = uSize * clamp(4.0 / dist, 0.5, 1.8);
    vFade = (1.0 - smoothstep(4.0, 15.0, dist)) * smoothstep(0.4, 1.6, dist);
  }
`,ie=`
  uniform vec3 uColor;
  uniform float uAlpha;
  varying float vFade;
  void main() {
    float r = length(gl_PointCoord - 0.5);
    float a = (1.0 - smoothstep(0.25, 0.5, r)) * vFade * uAlpha;
    if (a < 0.004) discard;
    gl_FragColor = vec4(uColor * a, a);
  }
`,ae=e=>new Promise((t,n)=>{let r=new Image;try{new URL(e,location.href).origin!==location.origin&&(r.crossOrigin=`anonymous`)}catch{}r.decoding=`async`,r.onload=()=>t(r),r.onerror=n,r.src=e}),oe=(e,t,n)=>{let r=Math.min(1,Math.max(0,(n-e)/(t-e)));return r*r*(3-2*r)},b=(e,t,n,r=.001)=>{let i=e+(t-e)*n;return Math.abs(t-i)<r?t:i};function x({host:x,covers:S,shade:C,wake:se,onLost:w}){let T=!1,E=new f({antialias:!0,alpha:!0,powerPreference:`high-performance`});E.setPixelRatio(Math.min(window.devicePixelRatio||1,1.5)),E.setClearColor(0,0);let D=E.domElement;D.setAttribute(`aria-hidden`,`true`),x.appendChild(D);let O=e=>{e.preventDefault(),w?.()};D.addEventListener(`webglcontextlost`,O);let k=new o,A=new i(m,1,.1,60),j=S.length,M=y(C),ce=Math.min(8,E.capabilities.getMaxAnisotropy()),N=new p,P=new a(1,1),F=S.map((i,a)=>{let o=new t(h.x,h.x/(16/9)),s={uMap:{value:N},uHasMap:{value:0},uSize:{value:o},uPad:{value:g},uRadius:{value:_},uAlpha:{value:1},uDim:{value:0},uRim:{value:0},uBase:{value:new e(.09,.15,.23)},uShade:{value:M}},l=new n({uniforms:s,vertexShader:te,fragmentShader:ne,transparent:!0,depthWrite:!1,premultipliedAlpha:!0}),u=new c(P,l),d=v(a);u.position.copy(d),u.scale.set(o.x+2*g,o.y+2*g,1),k.add(u);let f={mesh:u,uniforms:s,size:o,home:d,texture:null,hasMap:0,ready:!1,hover:0};return i&&ae(i).then(e=>{if(T)return;let t=e.naturalWidth/e.naturalHeight||16/9;t>=h.x/h.y?o.set(h.x,h.x/t):o.set(h.y*t,h.y),u.scale.set(o.x+2*g,o.y+2*g,1);let n=new p(e);n.generateMipmaps=!0,n.minFilter=r,n.magFilter=ee,n.anisotropy=ce,n.needsUpdate=!0,f.texture=n,s.uMap.value=n,f.ready=!0,se?.()}).catch(()=>{}),f}),I=F.map(e=>e.mesh),L=new l;{let e=.42,t=v(Math.max(0,j-1)),n=[];for(let r=-7;r<=t.x+9;r+=e)n.push(r);let r=[];for(let n=6;n>=t.z-16;n-=e)r.push(n);let i=new Float32Array(n.length*r.length*3),a=0;for(let e of r)for(let t of n)i[a++]=t,i[a++]=-.95,i[a++]=e;L.setAttribute(`position`,new d(i,3))}let R=new n({uniforms:{uSize:{value:2.4*E.getPixelRatio()},uColor:{value:y(`rgb(142, 193, 238)`)},uAlpha:{value:.5}},vertexShader:re,fragmentShader:ie,transparent:!0,depthWrite:!1,premultipliedAlpha:!0}),z=new u(L,R);z.frustumCulled=!1,z.renderOrder=-1,k.add(z);let B=-1,V=0,H=0,U=1,W=1,G=4,K=0,q=0,le=({width:e,height:t,frame:n})=>{if(!e||!t)return;U=e,W=t,E.setSize(e,t,!1),A.aspect=e/t,A.updateProjectionMatrix();let r=Math.min(n.w/h.x,n.h/h.y)*.92;G=t/(2*Math.tan(m*Math.PI/360)*r),K=(n.x+n.w/2-e/2)/r,q=(n.y+n.h/2-t/2)/r,B=-1},J=new e,Y=new e,X=new e,Z=new e,ue=(e,t,n=1/60)=>{let r=1-Math.exp(-n*10),i=j>1?Math.min(j-2,Math.floor(e)):0,a=j>1?e-i:0;v(i,J),v(Math.min(j-1,i+1),Y),X.lerpVectors(J,Y,a);let o=Math.sin(Math.PI*a);Z.set(X.x-K,X.y+q,X.z),A.position.set(Z.x+t.x*.16,Z.y+o*.22-t.y*.08,Z.z+G+o*.9),A.lookAt(Z),A.rotateY(-.13*o);let s=!1;return F.forEach((t,n)=>{let i=e-n,a=Math.min(1,Math.abs(i));t.mesh.rotation.y=.42*a*Math.sign(i),t.hover=b(t.hover,t.target??0,r),t.hasMap=t.ready?b(t.hasMap,1,r*.8):0,(t.ready&&t.hasMap<1||t.hover!==(t.target??0))&&(s=!0),t.mesh.position.set(t.home.x,t.home.y,t.home.z+t.hover*.07);let o=t.uniforms;o.uHasMap.value=t.hasMap,o.uRim.value=t.hover,o.uDim.value=Math.min(.72,Math.abs(i)*.5)*(1-t.hover*.5);let c=i>0?1-oe(.15,.7,i):1;o.uAlpha.value=c*(1-Math.min(1,Math.max(0,Math.abs(i)-2.6))),t.mesh.visible=o.uAlpha.value>.001}),(s||e!==B||t.x!==V||t.y!==H)&&(E.render(k,A),B=e,V=t.x,H=t.y),s},Q=new s,$=new t;return{resize:le,render:ue,hit:(e,t)=>{$.set(e/U*2-1,1-t/W*2),Q.setFromCamera($,A);for(let e of Q.intersectObjects(I,!1)){let t=F[I.indexOf(e.object)];if(!t||t.uniforms.uAlpha.value<.5||!e.uv)continue;let n=(e.uv.x-.5)*(t.size.x+2*g),r=(e.uv.y-.5)*(t.size.y+2*g);if(Math.abs(n)<=t.size.x/2&&Math.abs(r)<=t.size.y/2)return F.indexOf(t)}return-1},setHover:e=>F.forEach((t,n)=>t.target=+(n===e)),setShade:e=>{M.copy(y(e)),B=-1},dispose:()=>{T=!0,D.removeEventListener(`webglcontextlost`,O);for(let e of F)e.mesh.material.dispose(),e.texture?.dispose();N.dispose(),P.dispose(),L.dispose(),R.dispose(),E.dispose(),E.forceContextLoss?.(),D.remove()}}}export{x as createGalleryScene};