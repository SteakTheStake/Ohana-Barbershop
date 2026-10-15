import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import test from "node:test";
import { runInNewContext } from "node:vm";

const require = createRequire(import.meta.url);
const ts = require("typescript");
const source = readFileSync(new URL("./ocean-text.tsx", import.meta.url), "utf8");
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2020 },
}).outputText;

function mount({ reduced = false, webgl = true } = {}) {
  const frames = new Map();
  let nextFrame = 0;
  let draws = 0;
  let effect;
  let ro;
  let io;
  let refIndex = 0;
  const fonts = Promise.withResolvers();
  const canvas2d = { clearRect() {}, scale() {}, fillText() {} };
  const gl = new Proxy({}, {
    get: (_target, key) => key === "drawArrays" ? () => draws++ : key === "getExtension" ? () => ({ loseContext() {} }) : () => ({}),
  });
  const el = { dataset: {}, getBoundingClientRect: () => ({ width: 330, height: 65 }) };
  const canvas = { style: {}, getContext: () => webgl ? gl : null };
  const mod = { exports: {} };
  const context = {
    module: mod,
    exports: mod.exports,
    require(name) {
      if (name === "react") return { useEffect: cb => effect = cb, useRef: () => ({ current: refIndex++ === 0 ? el : canvas }) };
      if (name === "react/jsx-runtime") return { jsx: (_tag, props) => props, jsxs: (_tag, props) => props };
      throw new Error(name);
    },
    document: { createElement: () => ({ getContext: () => canvas2d }), fonts: { ready: fonts.promise } },
    window: { devicePixelRatio: 1, matchMedia: () => ({ matches: reduced }) },
    getComputedStyle: () => ({ fontSize: "72px", fontWeight: "400", fontFamily: "Bebas Neue", letterSpacing: "1px" }),
    performance: { now: () => 0 },
    requestAnimationFrame(cb) {
      const id = ++nextFrame;
      frames.set(id, cb);
      return id;
    },
    cancelAnimationFrame(id) { frames.delete(id); },
    ResizeObserver: function (cb) {
      ro = { cb, observes: 0, observe() { this.observes++; }, disconnect() {} };
      return ro;
    },
    IntersectionObserver: function (cb) {
      io = { cb, observes: 0, observe() { this.observes++; }, disconnect() {} };
      return io;
    },
  };
  runInNewContext(compiled, context);
  mod.exports.OceanText({ children: "Island Vibez." });
  const cleanup = effect() || (() => {});
  return {
    frames, el, cleanup,
    get draws() { return draws; },
    get observers() { return [ro, io]; },
    async ready() { fonts.resolve(); await fonts.promise; await Promise.resolve(); },
    resize() { ro.cb(); },
    visibility(visible) { io.cb([{ isIntersecting: visible }]); },
    tick() {
      const pending = [...frames.values()];
      frames.clear();
      pending.forEach(cb => cb(16));
    },
  };
}

test("resize events never accumulate animation loops", async () => {
  const app = mount();
  await app.ready();
  app.resize();
  app.visibility(true);
  app.resize();
  app.resize();
  app.resize();
  assert.equal(app.frames.size, 1);
  const before = app.draws;
  app.tick();
  assert.equal(app.draws - before, 1);
  app.cleanup();
  assert.equal(app.frames.size, 0);
});

test("offscreen animation cancels every pending frame", async () => {
  const app = mount();
  await app.ready();
  app.resize();
  app.visibility(true);
  app.resize();
  app.visibility(false);
  assert.equal(app.frames.size, 0);
  const before = app.draws;
  app.tick();
  assert.equal(app.draws, before);
  app.cleanup();
});

test("font readiness cannot revive observers after unmount", async () => {
  const app = mount();
  app.cleanup();
  await app.ready();
  assert.deepEqual(app.observers.map(observer => observer.observes), [0, 0]);
  assert.equal(app.frames.size, 0);
});

test("reduced motion leaves no continuing RAF loop", async () => {
  const app = mount({ reduced: true });
  await app.ready();
  app.resize();
  app.visibility(true);
  app.tick();
  assert.equal(app.frames.size, 0);
  app.cleanup();
});

test("unavailable WebGL preserves visible DOM fallback", async () => {
  const app = mount({ webgl: false });
  await app.ready();
  assert.equal(app.el.dataset.gl, undefined);
  assert.equal(app.frames.size, 0);
  app.cleanup();
});
