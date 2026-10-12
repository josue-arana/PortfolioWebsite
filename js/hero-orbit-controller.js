(function () {
    'use strict';

    var hero = document.getElementById('intro-section');
    if (!hero) {
        return;
    }

    var stage = hero.querySelector('.hero-ribbons-artwork');
    var image = stage && stage.querySelector('img');
    var canvas = stage && stage.querySelector('.hero-ribbon-canvas');
    var overlay = stage && stage.querySelector('.hero-orbit-overlay');
    var toggle = hero.querySelector('[data-hero-motion-toggle]');
    var animations = overlay && Array.prototype.slice.call(overlay.querySelectorAll('[data-orbit-animation]'));
    if (!stage || !image || !canvas || !overlay || !toggle || !animations.length ||
            typeof overlay.pauseAnimations !== 'function' ||
            typeof overlay.unpauseAnimations !== 'function' ||
            animations.some(function (animation) { return typeof animation.beginElement !== 'function'; })) {
        return;
    }

    var motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    var heroVisible = false;
    var userPaused = false;
    var started = false;
    var dots = Array.prototype.slice.call(overlay.querySelectorAll('.hero-orbit-dot'));
    var gl = null;
    var ready = false;
    var unavailable = false;
    var lost = false;
    var loadingImage = false;
    var frame = null;
    var lastTick = null;
    var nextPaint = null;
    var elapsed = 0;
    var phaseOneLocation;
    var phaseTwoLocation;
    var strengthLocation;

    function smooth(a, b, x) {
        var t = Math.max(0, Math.min(1, (x - a) / (b - a)));
        return t * t * (3 - 2 * t);
    }

    // Same image-space displacement as the shader. The orbit circles track it.
    // Increasing progress runs from lower-left to upper-right; subtracting each
    // wave's initial profile makes the first canvas frame match the static PNG.
    function offset(x, y, phaseOne, phaseTwo, strength) {
        var center = 0.89 - 0.67 * x + 0.06 * Math.sin(Math.PI * x);
        var mask = (1 - smooth(0.09, 0.24, Math.abs(y - center))) *
            smooth(0.10, 0.26, x) * (1 - smooth(0.88, 0.98, x)) *
            smooth(0.04, 0.19, y) * (1 - smooth(0.86, 0.97, y));
        var progress = (x + 1 - y) * 0.5;
        var first = 9.42478 * progress;
        var second = 17.27876 * progress;
        var bend = strength * mask * (3.8 * (Math.sin(first - phaseOne) - Math.sin(first)) +
            1.4 * (Math.sin(second - phaseTwo) - Math.sin(second)));
        return [0.353 * bend, 0.936 * bend];
    }

    function resetDots() {
        dots.forEach(function (dot) {
            dot.removeAttribute('cx');
            dot.removeAttribute('cy');
        });
    }

    function alignDots(phaseOne, phaseTwo, strength) {
        if (!ready || !started) return;
        var root = overlay.getCTM();
        if (!root) return;
        var inverse = root.inverse();
        dots.forEach(function (dot) {
            var matrix = dot.getCTM();
            if (!matrix) return;
            var position = inverse.multiply(matrix);
            var move = offset(position.e / 1672, position.f / 941, phaseOne, phaseTwo, strength);
            dot.setAttribute('cx', move[0].toFixed(3));
            dot.setAttribute('cy', move[1].toFixed(3));
        });
    }

    function resizeCanvas() {
        var rect = stage.getBoundingClientRect();
        if (!rect.width || !rect.height) return;
        var mobile = window.innerWidth < 992;
        var scale = Math.min(window.devicePixelRatio || 1, mobile ? 1.25 : 1.5,
            (mobile ? 1024 : 1600) / rect.width, (mobile ? 576 : 900) / rect.height);
        var width = Math.max(1, Math.round(rect.width * scale));
        var height = Math.max(1, Math.round(rect.height * scale));
        if (canvas.width !== width || canvas.height !== height) {
            canvas.width = width;
            canvas.height = height;
        }
        gl.viewport(0, 0, width, height);
    }

    function draw() {
        if (!ready || !gl || gl.isContextLost()) return false;
        resizeCanvas();
        var phaseOne = 2 * Math.PI * (elapsed % 22000) / 22000;
        var phaseTwo = 2 * Math.PI * (elapsed % 15000) / 15000;
        var strength = window.innerWidth < 992 ? 0.75 : 1;
        gl.uniform1f(phaseOneLocation, phaseOne);
        gl.uniform1f(phaseTwoLocation, phaseTwo);
        gl.uniform1f(strengthLocation, strength);
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
        if (gl.getError() !== gl.NO_ERROR) return false;
        alignDots(phaseOne, phaseTwo, strength);
        return true;
    }

    function showStatic() {
        canvas.classList.remove('is-ribbon-ready');
        resetDots();
    }

    function stopLoop() {
        if (frame !== null) window.cancelAnimationFrame(frame);
        frame = null;
        lastTick = null;
        nextPaint = null;
    }

    function paint(now) {
        frame = null;
        if (!ready || motionQuery.matches || !heroVisible || document.hidden || userPaused) return;
        var interval = window.innerWidth < 992 ? 1000 / 24 : 1000 / 60;
        if (lastTick === null) {
            lastTick = now;
            nextPaint = now;
        } else {
            elapsed += Math.min(now - lastTick, 100);
            lastTick = now;
        }
        // Advance the schedule by fixed slots so a 24 fps cap can alternate
        // browser refreshes without slowing the wave's elapsed time.
        if (now + 1 >= nextPaint) {
            nextPaint += (Math.floor(Math.max(0, now - nextPaint) / interval) + 1) * interval;
            if (!draw()) {
                ready = false;
                unavailable = true;
                showStatic();
                return;
            }
        }
        frame = window.requestAnimationFrame(paint);
    }

    function startLoop() {
        if (ready && frame === null) frame = window.requestAnimationFrame(paint);
    }

    function shader(type, source) {
        var result = gl.createShader(type);
        gl.shaderSource(result, source);
        gl.compileShader(result);
        if (!gl.getShaderParameter(result, gl.COMPILE_STATUS)) throw new Error('Ribbon shader failed');
        return result;
    }

    function initializeRenderer() {
        if (ready || unavailable || lost || motionQuery.matches) return;
        if (!image.complete) {
            if (!loadingImage) {
                loadingImage = true;
                image.addEventListener('load', function () {
                    loadingImage = false;
                    updatePlayback();
                }, { once: true });
            }
            return;
        }
        if (!image.naturalWidth) {
            unavailable = true;
            return;
        }
        try {
            gl = canvas.getContext('webgl', {
                alpha: false, antialias: false, depth: false, stencil: false,
                preserveDrawingBuffer: false, powerPreference: 'low-power'
            });
            if (!gl) throw new Error('WebGL unavailable');
            var vertex = shader(gl.VERTEX_SHADER,
                'attribute vec2 a;varying vec2 uv;void main(){uv=(a+1.0)*0.5;gl_Position=vec4(a,0.0,1.0);}');
            var fragment = shader(gl.FRAGMENT_SHADER,
                'precision highp float;varying vec2 uv;uniform sampler2D image;\n' +
                'uniform float phaseOne;uniform float phaseTwo;uniform float strength;\n' +
                'void main(){vec2 p=vec2(uv.x,1.0-uv.y);\n' +
                'float center=0.89-0.67*p.x+0.06*sin(3.14159265*p.x);\n' +
                'float mask=(1.0-smoothstep(0.09,0.24,abs(p.y-center)))*smoothstep(0.10,0.26,p.x)*' +
                '(1.0-smoothstep(0.88,0.98,p.x))*smoothstep(0.04,0.19,p.y)*' +
                '(1.0-smoothstep(0.86,0.97,p.y));\n' +
                'float progress=(p.x+1.0-p.y)*0.5;\n' +
                'float first=9.42478*progress;float second=17.27876*progress;\n' +
                'float bend=strength*mask*(3.8*(sin(first-phaseOne)-sin(first))+' +
                '1.4*(sin(second-phaseTwo)-sin(second)));\n' +
                'float dx=0.353*bend;float dy=0.936*bend;\n' +
                'gl_FragColor=texture2D(image,clamp(vec2(uv.x-dx/1672.0,uv.y+dy/941.0),0.0,1.0));}');
            var program = gl.createProgram();
            gl.attachShader(program, vertex);
            gl.attachShader(program, fragment);
            gl.linkProgram(program);
            gl.deleteShader(vertex);
            gl.deleteShader(fragment);
            if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error('Ribbon program failed');
            gl.useProgram(program);
            phaseOneLocation = gl.getUniformLocation(program, 'phaseOne');
            phaseTwoLocation = gl.getUniformLocation(program, 'phaseTwo');
            strengthLocation = gl.getUniformLocation(program, 'strength');
            var buffer = gl.createBuffer();
            gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
            gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
            var position = gl.getAttribLocation(program, 'a');
            gl.enableVertexAttribArray(position);
            gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);
            var texture = gl.createTexture();
            gl.activeTexture(gl.TEXTURE0);
            gl.bindTexture(gl.TEXTURE_2D, texture);
            gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
            gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
            gl.uniform1i(gl.getUniformLocation(program, 'image'), 0);
            if (gl.getError() !== gl.NO_ERROR) throw new Error('Ribbon texture failed');
            ready = true;
            if (!draw()) throw new Error('Ribbon first frame failed');
            canvas.classList.add('is-ribbon-ready');
        } catch (error) {
            ready = false;
            unavailable = true;
            showStatic();
        }
    }

    function updatePlayback() {
        if (motionQuery.matches) {
            stopLoop();
            showStatic();
            overlay.pauseAnimations();
            overlay.classList.remove('is-motion-ready');
            toggle.hidden = true;
            return;
        }

        toggle.setAttribute('aria-pressed', userPaused ? 'true' : 'false');
        toggle.setAttribute('aria-label', userPaused ? 'Play background animation' : 'Pause background animation');

        if (heroVisible && !document.hidden && !userPaused) {
            if (!started) {
                animations.forEach(function (animation) { animation.beginElement(); });
                started = true;
            }
            overlay.classList.add('is-motion-ready');
            overlay.unpauseAnimations();
            initializeRenderer();
            if (ready && !canvas.classList.contains('is-ribbon-ready')) {
                if (draw()) canvas.classList.add('is-ribbon-ready');
                else {
                    ready = false;
                    unavailable = true;
                    showStatic();
                }
            }
            startLoop();
        } else {
            overlay.pauseAnimations();
            stopLoop();
        }

        toggle.hidden = !started;
    }

    canvas.addEventListener('webglcontextlost', function (event) {
        event.preventDefault();
        stopLoop();
        lost = true;
        ready = false;
        gl = null;
        showStatic();
    });
    canvas.addEventListener('webglcontextrestored', function () {
        lost = false;
        unavailable = false;
        updatePlayback();
    });

    if ('ResizeObserver' in window) {
        new ResizeObserver(function () {
            if (ready && !motionQuery.matches && !draw()) {
                ready = false;
                unavailable = true;
                stopLoop();
                showStatic();
            }
        }).observe(stage);
    } else {
        window.addEventListener('resize', function () {
            if (ready && !motionQuery.matches) draw();
        });
    }

    toggle.addEventListener('click', function () {
        userPaused = !userPaused;
        updatePlayback();
    });

    document.addEventListener('visibilitychange', updatePlayback);
    if (motionQuery.addEventListener) {
        motionQuery.addEventListener('change', updatePlayback);
    } else {
        motionQuery.addListener(updatePlayback);
    }

    overlay.pauseAnimations();
    updatePlayback();

    if ('IntersectionObserver' in window) {
        var observer = new IntersectionObserver(function (entries) {
            heroVisible = entries[0].isIntersecting;
            updatePlayback();
        }, { threshold: 0 });
        observer.observe(hero);
    } else {
        var checkVisibility = function () {
            var bounds = hero.getBoundingClientRect();
            heroVisible = bounds.bottom > 0 && bounds.top < window.innerHeight;
            updatePlayback();
        };
        window.addEventListener('scroll', checkVisibility, { passive: true });
        window.addEventListener('resize', checkVisibility);
        checkVisibility();
    }
}());
