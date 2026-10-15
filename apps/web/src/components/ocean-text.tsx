"use client";

import { useEffect, useRef } from "react";

const VERT = `attribute vec2 p;varying vec2 uv;void main(){uv=p*.5+.5;uv.y=1.-uv.y;gl_Position=vec4(p,0.,1.);}`;

const FRAG = `precision mediump float;
varying vec2 uv;
uniform sampler2D mask;
uniform float t;
uniform vec2 res;
void main(){
  float a = texture2D(mask, uv).a;
  if (a < .01) discard;
  vec2 q = uv * vec2(res.x / res.y, 1.);
  float w = sin(q.x * 6. + t * 1.6) * .05 + sin(q.x * 13. - t * 2.3) * .025;
  float h = q.y + w;
  float bands = sin(h * 18. - t * 1.2) * .5 + .5;
  float foam = smoothstep(.85, 1., sin((q.x + q.y * .6) * 22. + sin(q.y * 9. + t) * 2. - t * 2.5));
  vec3 deep = vec3(.03, .33, .40);
  vec3 reef = vec3(.18, .65, .60);
  vec3 col = mix(reef, deep, smoothstep(.2, 1., uv.y + w));
  col = mix(col, vec3(.55, .9, .85), bands * .25);
  col += foam * .35;
  gl_FragColor = vec4(col * a, a);
}`;

export function OceanText({ children }: { children: string }) {
  const wrap = useRef<HTMLSpanElement>(null);
  const cvs = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const el = wrap.current!;
    const canvas = cvs.current!;
    const gl = canvas.getContext("webgl", { premultipliedAlpha: true, alpha: true });
    if (!gl) return;
    el.dataset.gl = "1";

    const sh = (type: number, src: string) => {
      const s = gl.createShader(type)!;
      gl.shaderSource(s, src);
      gl.compileShader(s);
      return s;
    };
    const prog = gl.createProgram()!;
    gl.attachShader(prog, sh(gl.VERTEX_SHADER, VERT));
    gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, FRAG));
    gl.linkProgram(prog);
    gl.useProgram(prog);

    gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(prog, "p");
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);

    const tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    const uT = gl.getUniformLocation(prog, "t");
    const uRes = gl.getUniformLocation(prog, "res");
    const mask = document.createElement("canvas");

    const layout = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const r = el.getBoundingClientRect();
      const cs = getComputedStyle(el);
      const pad = parseFloat(cs.fontSize) * 0.25;
      const w = Math.ceil((r.width + pad * 2) * dpr);
      const h = Math.ceil((r.height + pad * 2) * dpr);
      Object.assign(canvas.style, {
        left: `-${pad}px`,
        top: `-${pad}px`,
        width: `${r.width + pad * 2}px`,
        height: `${r.height + pad * 2}px`,
      });
      canvas.width = mask.width = w;
      canvas.height = mask.height = h;
      const ctx = mask.getContext("2d")!;
      ctx.clearRect(0, 0, w, h);
      ctx.scale(dpr, dpr);
      ctx.font = `${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
      ctx.letterSpacing = cs.letterSpacing === "normal" ? "0px" : cs.letterSpacing;
      ctx.textBaseline = "middle";
      ctx.fillText(children, pad, pad + r.height / 2);
      gl.viewport(0, 0, w, h);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, mask);
      gl.uniform2f(uRes, w, h);
    };

    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let raf = 0;
    let visible = true;
    let disposed = false;
    const draw = (ms: number) => {
      raf = 0;
      if (disposed) return;
      gl.uniform1f(uT, ms / 1000);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      if (!reduce && visible) raf = requestAnimationFrame(draw);
    };

    const io = new IntersectionObserver(([e]) => {
      if (disposed) return;
      visible = e.isIntersecting;
      cancelAnimationFrame(raf);
      raf = visible ? requestAnimationFrame(draw) : 0;
    });
    const ro = new ResizeObserver(() => {
      if (disposed) return;
      cancelAnimationFrame(raf);
      layout();
      draw(performance.now());
    });
    document.fonts.ready.then(() => {
      if (disposed) return;
      ro.observe(el);
      io.observe(el);
    });

    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
      ro.disconnect();
      io.disconnect();
      gl.getExtension("WEBGL_lose_context")?.loseContext();
    };
  }, [children]);

  return (
    <span ref={wrap} className="ocean-text relative inline-block">
      {children}
      <canvas ref={cvs} aria-hidden className="pointer-events-none absolute" />
    </span>
  );
}
