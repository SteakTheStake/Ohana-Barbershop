(function () {
  'use strict';

  // --- Dynamic Greeting ---
  var greetings = {
    morning: { hi: "Aloha kakahiaka", en: "Good morning", say: "ah-LOH-hah kah-kah-hee-AH-kah" },
    afternoon: { hi: "Aloha ʻauinalā", en: "Good afternoon", say: "ah-LOH-hah ah-wee-nah-LAH" },
    evening: { hi: "Aloha ahiahi", en: "Good evening", say: "ah-LOH-hah ah-hee-AH-hee" }
  };

  function getGreetingKey(h) {
    if (h >= 4 && h < 11) return 'morning';
    if (h >= 11 && h < 17) return 'afternoon';
    return 'evening';
  }

  var greetingEl = document.getElementById('hero-greeting');
  if (greetingEl) {
    var nowHour = new Date().getHours();
    var g = greetings[getGreetingKey(nowHour)];
    greetingEl.title = g.say;
    greetingEl.innerHTML = g.hi + ' <span style="color: rgba(201, 180, 143, 0.6); text-transform: none; letter-spacing: normal; font-style: italic;">· ' + g.en + '</span>';
  }

  // --- Current Year in Footer ---
  var yearEl = document.getElementById('copyright-year');
  if (yearEl) {
    yearEl.textContent = new Date().getFullYear();
  }

  // --- Ocean Wave WebGL Text Effect ---
  var VERT = 'attribute vec2 p;varying vec2 uv;void main(){uv=p*.5+.5;uv.y=1.-uv.y;gl_Position=vec4(p,0.,1.);}';
  var FRAG = 'precision mediump float;' +
    'varying vec2 uv;' +
    'uniform sampler2D mask;' +
    'uniform float t;' +
    'uniform vec2 res;' +
    'void main(){' +
    '  float a = texture2D(mask, uv).a;' +
    '  if (a < .01) discard;' +
    '  vec2 q = uv * vec2(res.x / res.y, 1.);' +
    '  float w = sin(q.x * 6. + t * 1.6) * .05 + sin(q.x * 13. - t * 2.3) * .025;' +
    '  float h = q.y + w;' +
    '  float bands = sin(h * 18. - t * 1.2) * .5 + .5;' +
    '  float foam = smoothstep(.85, 1., sin((q.x + q.y * .6) * 22. + sin(q.y * 9. + t) * 2. - t * 2.5));' +
    '  vec3 deep = vec3(.03, .33, .40);' +
    '  vec3 reef = vec3(.18, .65, .60);' +
    '  vec3 col = mix(reef, deep, smoothstep(.2, 1., uv.y + w));' +
    '  col = mix(col, vec3(.55, .9, .85), bands * .25);' +
    '  col += foam * .35;' +
    '  gl_FragColor = vec4(col * a, a);' +
    '}';

  function initOceanText() {
    var el = document.querySelector('.ocean-text');
    if (!el) return;

    var canvas = el.querySelector('canvas');
    if (!canvas) {
      canvas = document.createElement('canvas');
      canvas.setAttribute('aria-hidden', 'true');
      canvas.className = 'pointer-events-none absolute';
      el.appendChild(canvas);
    }

    var gl = canvas.getContext('webgl', { premultipliedAlpha: true, alpha: true });
    if (!gl) return;
    el.setAttribute('data-gl', '1');

    function createShader(type, src) {
      var s = gl.createShader(type);
      gl.shaderSource(s, src);
      gl.compileShader(s);
      return s;
    }

    var prog = gl.createProgram();
    gl.attachShader(prog, createShader(gl.VERTEX_SHADER, VERT));
    gl.attachShader(prog, createShader(gl.FRAGMENT_SHADER, FRAG));
    gl.linkProgram(prog);
    gl.useProgram(prog);

    var buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);

    var loc = gl.getAttribLocation(prog, 'p');
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);

    var tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

    var uT = gl.getUniformLocation(prog, 't');
    var uRes = gl.getUniformLocation(prog, 'res');
    var mask = document.createElement('canvas');
    var rawText = el.getAttribute('data-text') || el.childNodes[0].textContent.trim();

    function layout() {
      var dpr = Math.min(window.devicePixelRatio || 1, 2);
      var r = el.getBoundingClientRect();
      var cs = window.getComputedStyle(el);
      var pad = parseFloat(cs.fontSize) * 0.25;
      var w = Math.ceil((r.width + pad * 2) * dpr);
      var h = Math.ceil((r.height + pad * 2) * dpr);

      canvas.style.left = '-' + pad + 'px';
      canvas.style.top = '-' + pad + 'px';
      canvas.style.width = (r.width + pad * 2) + 'px';
      canvas.style.height = (r.height + pad * 2) + 'px';

      canvas.width = mask.width = w;
      canvas.height = mask.height = h;

      var ctx = mask.getContext('2d');
      ctx.clearRect(0, 0, w, h);
      ctx.scale(dpr, dpr);
      ctx.font = cs.fontWeight + ' ' + cs.fontSize + ' ' + cs.fontFamily;
      ctx.letterSpacing = cs.letterSpacing === 'normal' ? '0px' : cs.letterSpacing;
      ctx.textBaseline = 'middle';
      ctx.fillText(rawText, pad, pad + r.height / 2);

      gl.viewport(0, 0, w, h);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, mask);
      gl.uniform2f(uRes, w, h);
    }

    var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    var raf = 0;
    var visible = true;

    function draw(ms) {
      gl.uniform1f(uT, ms / 1000);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      if (!reduceMotion && visible) {
        raf = requestAnimationFrame(draw);
      }
    }

    if (window.IntersectionObserver) {
      var io = new IntersectionObserver(function (entries) {
        visible = entries[0].isIntersecting;
        cancelAnimationFrame(raf);
        if (visible) raf = requestAnimationFrame(draw);
      });
      io.observe(el);
    }

    if (window.ResizeObserver) {
      var ro = new ResizeObserver(function () {
        layout();
        draw(performance.now());
      });
      if (document.fonts && document.fonts.ready) {
        document.fonts.ready.then(function () {
          ro.observe(el);
        });
      } else {
        ro.observe(el);
      }
    } else {
      window.addEventListener('resize', layout);
      layout();
      draw(performance.now());
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initOceanText);
  } else {
    initOceanText();
  }
})();
