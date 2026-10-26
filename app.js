/* ==========================================================================
   SEÑOR CHRIS · Comida estilo Guerrero
   app.js (JavaScript sin framework)

   Dependencias opcionales (CDN): GSAP + ScrollTrigger y Lenis.
   Si alguna no carga, el sitio sigue funcionando sin esa capa de animación.
   ========================================================================== */
(() => {
    'use strict';

    /* ───────────────────────────────────────────────────────────────────────
       CONFIGURACIÓN DEL NEGOCIO  ·  edita solo este bloque
       Todo lo que quede vacío ("") se oculta o usa un texto alterno.
       ─────────────────────────────────────────────────────────────────────── */
    const CONFIG = {
        whatsapp: '520000000000',      // TODO: número con lada de país, sin "+" ni espacios (ej. 5217771234567)
        whatsappDisplay: '',           // Cómo se muestra en pantalla (ej. '+52 777 123 4567')
        address: '',                   // Dirección completa del local
        hours: '',                     // Ej. 'Lunes a domingo, 8:00 am a 5:00 pm'
        mapsUrl: '',                   // Enlace de Google Maps para el botón "Ver en el mapa"
        mapsEmbed: '',                 // URL "src" del iframe de Google Maps (Compartir > Incorporar un mapa)
        instagram: '',                 // URL completa del perfil
        facebook: '',
        tiktok: '',
        greeting: 'Hola Señor Chris'
    };

    /* ───────────────────────────────────────────────────────────────────────
       Utilidades
       ─────────────────────────────────────────────────────────────────────── */
    const $ = (s, c = document) => c.querySelector(s);
    const $$ = (s, c = document) => Array.from(c.querySelectorAll(s));
    const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
    const lerp = (a, b, t) => a + (b - a) * t;
    const root = document.documentElement;

    const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const finePointer = matchMedia('(hover: hover) and (pointer: fine)').matches;
    const hasGSAP = () => !!(window.gsap && window.ScrollTrigger);
    const canScrub = () => hasGSAP() && !reduceMotion;

    let lenis = null;
    let lockCount = 0;

    const waURL = msg => `https://wa.me/${CONFIG.whatsapp}?text=${encodeURIComponent(msg)}`;

    function lockScroll() {
        if (lockCount++ > 0) return;
        if (lenis) lenis.stop(); else root.style.overflow = 'hidden';
    }
    function unlockScroll() {
        if (--lockCount > 0) return;
        lockCount = 0;
        if (lenis) lenis.start(); else root.style.overflow = '';
    }

    /* ───────────────────────────────────────────────────────────────────────
       Estado del pedido ("mi antojo")
       ─────────────────────────────────────────────────────────────────────── */
    const Order = {
        items: new Map(),
        listeners: [],
        has(name) { return this.items.has(name); },
        list() { return Array.from(this.items.keys()); },
        toggle(name) { this.has(name) ? this.items.delete(name) : this.items.set(name, true); this.emit(); },
        remove(name) { this.items.delete(name); this.emit(); },
        clear() { this.items.clear(); this.emit(); },
        on(fn) { this.listeners.push(fn); },
        emit() { this.listeners.forEach(fn => fn(this.list())); },
        message(extra = {}) {
            const list = this.list();
            const lines = [`${CONFIG.greeting}, quiero hacer un pedido.`];
            if (extra.name) lines.push(`Mi nombre: ${extra.name}`);
            if (extra.type) lines.push(`Busco: ${extra.type}`);
            if (list.length) { lines.push('', 'Mi antojo:'); list.forEach(n => lines.push(`• ${n}`)); }
            if (extra.note) lines.push('', `Comentarios: ${extra.note}`);
            return lines.join('\n');
        }
    };

    /* ───────────────────────────────────────────────────────────────────────
       WhatsApp, datos de contacto y redes
       ─────────────────────────────────────────────────────────────────────── */
    function initWhatsApp() {
        $$('[data-wa]').forEach(a => {
            a.href = waURL(a.dataset.msg || `${CONFIG.greeting}, quiero hacer un pedido.`);
            a.target = '_blank';
            a.rel = 'noopener';
        });
        if (CONFIG.whatsapp === '520000000000') {
            console.warn('[Señor Chris] Falta configurar el número de WhatsApp en app.js (CONFIG.whatsapp).');
        }
    }

    function applyConfig() {
        const phone = $('#infoPhone');
        if (phone && CONFIG.whatsappDisplay) phone.textContent = CONFIG.whatsappDisplay;

        const addr = $('#infoAddress');
        if (addr && CONFIG.address) {
            addr.textContent = CONFIG.address;
            if (CONFIG.mapsUrl) {
                const a = document.createElement('a');
                a.href = CONFIG.mapsUrl; a.target = '_blank'; a.rel = 'noopener';
                a.textContent = 'Ver en el mapa';
                addr.append(document.createElement('br'), a);
            }
        }
        const hours = $('#infoHours');
        if (hours && CONFIG.hours) hours.textContent = CONFIG.hours;

        if (CONFIG.mapsEmbed) {
            const box = $('#mapBox');
            const f = document.createElement('iframe');
            f.src = CONFIG.mapsEmbed; f.loading = 'lazy'; f.title = 'Mapa de ubicación de Señor Chris';
            f.referrerPolicy = 'no-referrer-when-downgrade'; f.allowFullscreen = true;
            box.appendChild(f); box.hidden = false;
        }

        let anySocial = false;
        $$('[data-social]').forEach(a => {
            const url = CONFIG[a.dataset.social];
            if (url) { a.href = url; a.hidden = false; anySocial = true; }
        });
        if (anySocial) $('#social').hidden = false;

        const year = $('#year');
        if (year) year.textContent = new Date().getFullYear();
    }

    /* ───────────────────────────────────────────────────────────────────────
       Texto dividido en palabras (para revelados con máscara)
       ─────────────────────────────────────────────────────────────────────── */
    function splitWords(el) {
        let idx = 0;
        const walk = (node, cls) => {
            const frag = document.createDocumentFragment();
            node.childNodes.forEach(ch => {
                if (ch.nodeType === 3) {
                    ch.textContent.split(/(\s+)/).forEach(part => {
                        if (!part) return;
                        if (/^\s+$/.test(part)) { frag.appendChild(document.createTextNode(' ')); return; }
                        const w = document.createElement('span');
                        w.className = 'w';
                        const wi = document.createElement('span');
                        wi.className = ('wi ' + (cls || '')).trim();
                        wi.style.setProperty('--i', idx++);
                        wi.textContent = part;
                        w.appendChild(wi);
                        frag.appendChild(w);
                    });
                } else if (ch.nodeType === 1) {
                    if (ch.tagName === 'BR') frag.appendChild(ch.cloneNode());
                    else if (ch.className) frag.appendChild(walk(ch, ((cls || '') + ' ' + ch.className).trim()));
                    else { const c = ch.cloneNode(false); c.appendChild(walk(ch, cls)); frag.appendChild(c); }
                }
            });
            return frag;
        };
        const out = walk(el, '');
        el.textContent = '';
        el.appendChild(out);
        el.dataset.words = idx;
    }

    /* ───────────────────────────────────────────────────────────────────────
       Scroll suave (Lenis) integrado con GSAP
       ─────────────────────────────────────────────────────────────────────── */
    function initScroll() {
        if (hasGSAP()) {
            gsap.registerPlugin(ScrollTrigger);
            root.classList.add('has-gsap');
        }
        if (reduceMotion || typeof Lenis === 'undefined') return;

        lenis = new Lenis({
            duration: 1.3,
            easing: t => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
            smoothWheel: true,
            wheelMultiplier: .92
        });
        if (hasGSAP()) {
            lenis.on('scroll', ScrollTrigger.update);
            gsap.ticker.add(t => lenis.raf(t * 1000));
            gsap.ticker.lagSmoothing(0);
        } else {
            const raf = t => { lenis.raf(t); requestAnimationFrame(raf); };
            requestAnimationFrame(raf);
        }
        lenis.stop(); // detenido mientras corre el preloader
    }

    function scrollToTarget(target, instant = false) {
        const pinned = target.classList.contains('is-pan') || target.classList.contains('is-scrub') || target.id === 'inicio';
        const offset = pinned ? 0 : -72;
        if (lenis) lenis.scrollTo(target, { offset, immediate: instant, duration: 1.7 });
        else {
            const y = target.getBoundingClientRect().top + window.scrollY + offset;
            window.scrollTo({ top: y, behavior: instant || reduceMotion ? 'auto' : 'smooth' });
        }
    }

    function initAnchors() {
        document.addEventListener('click', e => {
            const a = e.target.closest('a[href^="#"]');
            if (!a || a.hasAttribute('data-wa')) return;
            const hash = a.getAttribute('href');
            if (hash.length < 2) return;
            const target = $(hash);
            if (!target) return;
            e.preventDefault();
            closeMobileMenu();
            scrollToTarget(target);
            history.pushState(null, '', hash);
        });
    }

    /* ───────────────────────────────────────────────────────────────────────
       Preloader
       ─────────────────────────────────────────────────────────────────────── */
    function runLoader() {
        return new Promise(resolve => {
            const el = $('#loader');
            if (!el) { resolve(); return; }
            const pctEl = $('#loaderPct');
            const msgEl = $('#loaderMsg');
            const msgs = [[0, 'Encendiendo el comal'], [28, 'Amasando las tortillas'], [58, 'Calentando la salsa'], [86, 'Poniendo la mesa']];
            const MIN = reduceMotion ? 450 : 2400;
            const start = performance.now();
            let pct = 0, ready = false, lastMsg = -1, finished = false;

            const heroImg = $('.slide.is-active img');
            const imgReady = heroImg && !heroImg.complete
                ? new Promise(r => { heroImg.addEventListener('load', r, { once: true }); heroImg.addEventListener('error', r, { once: true }); })
                : Promise.resolve();
            const fontsReady = document.fonts ? document.fonts.ready : Promise.resolve();
            const pageReady = document.readyState === 'complete' ? Promise.resolve() : new Promise(r => window.addEventListener('load', r, { once: true }));
            Promise.all([fontsReady, imgReady, pageReady]).then(() => { ready = true; });
            setTimeout(() => { ready = true; }, 6500);

            const finish = () => {
                finished = true;
                el.classList.add('is-done');
                setTimeout(() => el.classList.add('is-open'), reduceMotion ? 0 : 420);
                setTimeout(() => { el.classList.add('is-gone'); resolve(); }, reduceMotion ? 120 : 1550);
            };

            const tick = now => {
                const t = now - start;
                const sim = 88 * (1 - Math.exp(-t / 950));
                const target = ready ? Math.min(100, Math.max(sim, (t / MIN) * 100)) : Math.min(sim, 88);
                pct += (target - pct) * .14;
                if (target >= 100 && pct > 99.2) pct = 100;
                pctEl.textContent = Math.round(pct);

                let m = 0;
                msgs.forEach((x, i) => { if (pct >= x[0]) m = i; });
                if (m !== lastMsg) { lastMsg = m; msgEl.textContent = msgs[m][1]; }

                if (pct >= 100 && !finished) { finish(); return; }
                requestAnimationFrame(tick);
            };
            requestAnimationFrame(tick);
        });
    }

    /* ───────────────────────────────────────────────────────────────────────
       Navegación
       ─────────────────────────────────────────────────────────────────────── */
    let menuOpen = false;
    const menuInertTargets = () => $$('main, footer, .wa, .tray');

    function openMobileMenu() {
        const burger = $('#burger'), menu = $('#menuMobile'), nav = $('#nav');
        if (menuOpen) return;
        menuOpen = true;
        menu.hidden = false;
        menu.offsetWidth; // fuerza el reflow para animar
        menu.classList.add('is-open');
        nav.classList.add('is-menu');
        nav.classList.remove('is-hidden');
        burger.setAttribute('aria-expanded', 'true');
        burger.setAttribute('aria-label', 'Cerrar menú');
        menuInertTargets().forEach(n => { n.inert = true; });
        lockScroll();
    }
    function closeMobileMenu() {
        if (!menuOpen) return;
        const burger = $('#burger'), menu = $('#menuMobile'), nav = $('#nav');
        menuOpen = false;
        menu.classList.remove('is-open');
        burger.setAttribute('aria-expanded', 'false');
        burger.setAttribute('aria-label', 'Abrir menú');
        menuInertTargets().forEach(n => { n.inert = false; });
        unlockScroll();
        setTimeout(() => { if (!menuOpen) { menu.hidden = true; nav.classList.remove('is-menu'); } }, reduceMotion ? 0 : 900);
    }

    function initNav() {
        const nav = $('#nav');
        const burger = $('#burger');

        // Estado "scrolled" con un centinela (sin escuchar scroll)
        const sentinel = document.createElement('div');
        sentinel.setAttribute('aria-hidden', 'true');
        sentinel.style.cssText = 'position:absolute;top:0;left:0;width:1px;height:80px;pointer-events:none;';
        document.body.prepend(sentinel);
        new IntersectionObserver(([e]) => nav.classList.toggle('is-scrolled', !e.isIntersecting)).observe(sentinel);

        // Ocultar al bajar, mostrar al subir
        if (hasGSAP()) {
            let hidden = false;
            ScrollTrigger.create({
                start: 0, end: 'max',
                onUpdate: self => {
                    if (menuOpen) return;
                    const shouldHide = self.scroll() > 420 && self.direction === 1;
                    const shouldShow = self.direction === -1 || self.scroll() <= 420;
                    if (shouldHide && !hidden) { hidden = true; nav.classList.add('is-hidden'); }
                    else if (shouldShow && hidden) { hidden = false; nav.classList.remove('is-hidden'); }
                }
            });
        }

        // Enlace activo según la sección visible
        const map = new Map($$('.nav__links a').map(a => [a.getAttribute('href').slice(1), a]));
        const io = new IntersectionObserver(entries => {
            entries.forEach(e => {
                if (!e.isIntersecting) return;
                map.forEach(a => a.classList.remove('is-current'));
                const a = map.get(e.target.id);
                if (a) a.classList.add('is-current');
            });
        }, { rootMargin: '-40% 0px -55% 0px' });
        map.forEach((_, id) => { const s = document.getElementById(id); if (s) io.observe(s); });

        burger.addEventListener('click', () => (menuOpen ? closeMobileMenu() : openMobileMenu()));
        document.addEventListener('keydown', e => { if (e.key === 'Escape') closeMobileMenu(); });
        matchMedia('(min-width: 1024px)').addEventListener('change', e => { if (e.matches) closeMobileMenu(); });
    }

    /* ───────────────────────────────────────────────────────────────────────
       Brasas (canvas): partículas que suben como chispas del comal
       ─────────────────────────────────────────────────────────────────────── */
    class Embers {
        constructor(canvas, opts = {}) {
            this.canvas = canvas;
            this.ctx = canvas.getContext('2d');
            this.opts = Object.assign({ density: 0.00007, min: 26, max: 120, interactive: false, speed: 1 }, opts);
            this.parts = [];
            this.visible = false;
            this.raf = 0;
            this.last = 0;
            this.mouse = { x: -9999, y: -9999 };
            this.sprites = [[255, 205, 100], [255, 142, 52], [238, 78, 40]].map(c => this.sprite(c));
            this.resize();
            new ResizeObserver(() => this.resize()).observe(canvas);
            new IntersectionObserver(([e]) => { this.visible = e.isIntersecting; this.toggle(); }).observe(canvas);
            document.addEventListener('visibilitychange', () => this.toggle());
            if (this.opts.interactive && finePointer) {
                const host = canvas.parentElement.closest('section') || canvas.parentElement;
                host.addEventListener('pointermove', e => {
                    const r = canvas.getBoundingClientRect();
                    this.mouse.x = e.clientX - r.left; this.mouse.y = e.clientY - r.top;
                });
                host.addEventListener('pointerleave', () => { this.mouse.x = this.mouse.y = -9999; });
            }
        }
        sprite([r, g, b]) {
            const s = 64, c = document.createElement('canvas');
            c.width = c.height = s;
            const x = c.getContext('2d');
            const g2 = x.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
            g2.addColorStop(0, 'rgba(255,250,235,1)');
            g2.addColorStop(.16, `rgba(${r},${g},${b},.95)`);
            g2.addColorStop(.5, `rgba(${r},${g},${b},.22)`);
            g2.addColorStop(1, `rgba(${r},${g},${b},0)`);
            x.fillStyle = g2; x.fillRect(0, 0, s, s);
            return c;
        }
        resize() {
            const dpr = Math.min(window.devicePixelRatio || 1, matchMedia('(max-width: 767px)').matches ? 1.5 : 2);
            const w = this.canvas.clientWidth, h = this.canvas.clientHeight;
            if (!w || !h) return;
            this.canvas.width = Math.round(w * dpr); this.canvas.height = Math.round(h * dpr);
            this.w = w; this.h = h; this.dpr = dpr;
            const n = clamp(Math.round(w * h * this.opts.density), this.opts.min, this.opts.max);
            while (this.parts.length < n) this.parts.push(this.spawn({}, true));
            this.parts.length = n;
        }
        spawn(p, initial) {
            const h = this.h || 800, w = this.w || 800;
            p.x = Math.random() * w;
            p.y = initial ? Math.random() * h : h + 10 + Math.random() * 40;
            p.vy = -(16 + Math.random() * 54) * this.opts.speed * (h / 800 + .4);
            p.size = .22 + Math.pow(Math.random(), 2.2) * .95;
            p.amp = 8 + Math.random() * 26;
            p.freq = .5 + Math.random() * 1.4;
            p.phase = Math.random() * 6.28;
            p.flick = 4 + Math.random() * 9;
            p.age = initial ? Math.random() * 6 : 0;
            p.life = (h + 60) / Math.abs(p.vy) * (.55 + Math.random() * .4);
            p.sprite = this.sprites[Math.random() < .5 ? 0 : (Math.random() < .6 ? 1 : 2)];
            return p;
        }
        toggle() {
            const run = this.visible && !document.hidden && !reduceMotion;
            if (run && !this.raf) { this.last = performance.now(); this.raf = requestAnimationFrame(t => this.frame(t)); }
            if (!run && this.raf) { cancelAnimationFrame(this.raf); this.raf = 0; }
        }
        frame(now) {
            const dt = Math.min(.05, (now - this.last) / 1000);
            this.last = now;
            const { ctx, dpr, w, h } = this;
            ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
            ctx.clearRect(0, 0, w, h);
            ctx.globalCompositeOperation = 'lighter';
            const R = 150, mx = this.mouse.x, my = this.mouse.y;
            for (const p of this.parts) {
                p.age += dt;
                p.y += p.vy * dt;
                p.x += Math.sin(p.age * p.freq + p.phase) * p.amp * dt;
                const dx = p.x - mx, dy = p.y - my, d2 = dx * dx + dy * dy;
                if (d2 < R * R && d2 > 1) {
                    const d = Math.sqrt(d2), f = (1 - d / R) * 320 * dt;
                    p.x += dx / d * f; p.y += dy / d * f;
                }
                if (p.y < -20 || p.age > p.life) { this.spawn(p, false); continue; }
                const t = p.age / p.life;
                const alpha = Math.min(1, p.age / .7) * (1 - t * t) * (.7 + .3 * Math.sin(p.age * p.flick + p.phase));
                if (alpha <= .02) continue;
                const s = p.size * 20;
                ctx.globalAlpha = alpha;
                ctx.drawImage(p.sprite, p.x - s / 2, p.y - s / 2, s, s);
            }
            ctx.globalAlpha = 1;
            this.raf = requestAnimationFrame(t => this.frame(t));
        }
    }

    function initEmbers() {
        if (reduceMotion) return;
        const small = matchMedia('(max-width: 767px)').matches;
        const hero = $('#embersHero');
        const fin = $('#embersFinale');
        if (hero) new Embers(hero, { density: small ? .00005 : .00008, max: small ? 44 : 130, interactive: true });
        if (fin) new Embers(fin, { density: .00007, max: small ? 40 : 100, speed: 1.2 });
    }

    /* ───────────────────────────────────────────────────────────────────────
       Hero: plato giratorio
       ─────────────────────────────────────────────────────────────────────── */
    function initPlate() {
        const slides = $$('#plateDisc .slide');
        const bars = $$('#plateBars i');
        const nameEl = $('#plateName');
        const plate = $('#plate');
        const hero = $('#inicio');
        if (!slides.length) return;
        const INTERVAL = 4800;
        plate.style.setProperty('--dur', INTERVAL + 'ms');
        let i = 0, timer = 0, cleanup = 0, visible = true, started = false;

        const paintBars = () => {
            bars.forEach((b, n) => {
                b.classList.toggle('is-done', n < i);
                b.classList.remove('is-live');
            });
            bars[i].offsetWidth;
            bars[i].classList.add('is-live');
        };
        const schedule = () => {
            clearTimeout(timer);
            if (reduceMotion || !visible || document.hidden) return;
            timer = setTimeout(() => show(i + 1), INTERVAL);
        };
        const show = n => {
            const prev = slides[i];
            i = (n + slides.length) % slides.length;
            const next = slides[i];
            if (prev === next) return;
            slides.forEach(s => s.classList.remove('is-prev'));
            prev.classList.remove('is-active');
            prev.classList.add('is-prev');
            next.classList.add('is-active');
            nameEl.textContent = next.dataset.name;
            paintBars();
            clearTimeout(cleanup);
            cleanup = setTimeout(() => prev.classList.remove('is-prev'), 1500);
            schedule();
        };

        // arranca cuando termina el preloader
        const start = () => { if (started) return; started = true; nameEl.textContent = slides[0].dataset.name; paintBars(); schedule(); };
        document.addEventListener('site:ready', start, { once: true });

        new IntersectionObserver(([e]) => { visible = e.isIntersecting; if (started) { visible ? (paintBars(), schedule()) : clearTimeout(timer); } }).observe(hero);
        document.addEventListener('visibilitychange', () => { if (started) document.hidden ? clearTimeout(timer) : schedule(); });

        // Inclinación 3D suave con el puntero
        if (finePointer && !reduceMotion) {
            let tx = 0, ty = 0, cx = 0, cy = 0, raf = 0;
            const loop = () => {
                cx = lerp(cx, tx, .08); cy = lerp(cy, ty, .08);
                plate.style.transform = `rotateX(${(-cy).toFixed(2)}deg) rotateY(${cx.toFixed(2)}deg)`;
                raf = (Math.abs(cx - tx) > .01 || Math.abs(cy - ty) > .01) ? requestAnimationFrame(loop) : 0;
            };
            hero.addEventListener('pointermove', e => {
                const r = hero.getBoundingClientRect();
                tx = ((e.clientX - r.left) / r.width - .5) * 14;
                ty = ((e.clientY - r.top) / r.height - .5) * 10;
                if (!raf) raf = requestAnimationFrame(loop);
            });
            hero.addEventListener('pointerleave', () => { tx = ty = 0; if (!raf) raf = requestAnimationFrame(loop); });
        }
    }

    /* ───────────────────────────────────────────────────────────────────────
       Revelados al entrar en pantalla y contadores
       ─────────────────────────────────────────────────────────────────────── */
    function initReveal() {
        const groups = new Map();
        $$('[data-reveal]').forEach(el => {
            const n = groups.get(el.parentElement) || 0;
            groups.set(el.parentElement, n + 1);
            el.style.setProperty('--d', Math.min(n * .08, .48) + 's');
        });
        const targets = $$('[data-reveal], [data-split]:not([data-hero])');
        if (!('IntersectionObserver' in window)) { targets.forEach(t => t.classList.add('is-in')); return; }
        const io = new IntersectionObserver(entries => {
            entries.forEach(e => {
                if (!e.isIntersecting) return;
                e.target.classList.add('is-in');
                io.unobserve(e.target);
            });
        }, { threshold: .14, rootMargin: '0px 0px -6% 0px' });
        targets.forEach(t => io.observe(t));
    }

    function initCounters() {
        const els = $$('[data-count]');
        if (!els.length) return;
        const run = el => {
            const end = +el.dataset.count;
            if (reduceMotion) { el.textContent = end; return; }
            const t0 = performance.now(), dur = 1800;
            const step = now => {
                const p = clamp((now - t0) / dur, 0, 1);
                el.textContent = Math.round(end * (p === 1 ? 1 : 1 - Math.pow(2, -10 * p)));
                if (p < 1) requestAnimationFrame(step);
            };
            requestAnimationFrame(step);
        };
        els.forEach(el => { el.textContent = '0'; });
        const io = new IntersectionObserver(entries => {
            entries.forEach(e => { if (e.isIntersecting) { run(e.target); io.unobserve(e.target); } });
        }, { threshold: .6 });
        els.forEach(el => io.observe(el));
    }

    /* ───────────────────────────────────────────────────────────────────────
       Banda: marquee que reacciona a la velocidad del scroll
       ─────────────────────────────────────────────────────────────────────── */
    function initBand() {
        const track = $('#bandTrack');
        if (!track || reduceMotion) return;
        const group = track.firstElementChild;
        let w = 0, x = 0, dir = -1, boost = 0, visible = false, last = 0, raf = 0;

        const build = () => {
            while (track.children.length > 1) track.lastElementChild.remove();
            w = group.offsetWidth;
            if (!w) return;
            const copies = Math.ceil((window.innerWidth * 2) / w) + 1;
            for (let n = 0; n < copies; n++) track.appendChild(group.cloneNode(true));
        };
        const frame = now => {
            const dt = Math.min(.05, (now - last) / 1000);
            last = now;
            const v = lenis ? lenis.velocity : 0;
            if (Math.abs(v) > .4) dir = v > 0 ? -1 : 1;
            boost = lerp(boost, Math.min(Math.abs(v), 60), .08);
            x += dir * (60 + boost * 22) * dt;
            if (x <= -w) x += w;
            if (x > 0) x -= w;
            track.style.transform = `translate3d(${x.toFixed(2)}px,0,0)`;
            raf = visible ? requestAnimationFrame(frame) : 0;
        };
        new IntersectionObserver(([e]) => {
            visible = e.isIntersecting;
            if (visible && !raf) { last = performance.now(); raf = requestAnimationFrame(frame); }
        }).observe(track.parentElement);

        (document.fonts ? document.fonts.ready : Promise.resolve()).then(build);
        let rt;
        window.addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(build, 200); });
    }

    /* ───────────────────────────────────────────────────────────────────────
       Manifiesto: el texto se enciende palabra por palabra con el scroll
       ─────────────────────────────────────────────────────────────────────── */
    function initManifesto() {
        const sec = $('#sazon'), text = $('#manifestoText');
        if (!sec || !text) return;
        splitWords(text);
        if (!canScrub()) return;
        sec.classList.add('is-scrub');
        const words = $$('.wi', text);
        gsap.to(words, {
            opacity: 1, ease: 'none', stagger: .12,
            scrollTrigger: { trigger: sec, start: 'top top', end: 'bottom bottom-=22%', scrub: .6 }
        });
        // Fotos flotantes con paralaje
        $$('.manifesto__float', sec).forEach(el => {
            const s = parseFloat(el.dataset.speed || 60) * 2;
            gsap.fromTo(el, { y: s }, {
                y: -s, ease: 'none',
                scrollTrigger: { trigger: sec, start: 'top bottom', end: 'bottom top', scrub: true }
            });
        });
    }

    /* ───────────────────────────────────────────────────────────────────────
       Imagen que se abre a pantalla completa con el scroll
       ─────────────────────────────────────────────────────────────────────── */
    function initExpand() {
        const sec = $('#expand');
        if (!sec || !canScrub()) return;
        sec.classList.add('is-scrub');
        const media = $('#expandMedia'), img = $('img', media), shade = $('.expand__shade', media);
        const content = $('#expandContent'), intro = $('#expandIntro span');
        const build = (from, startScale) => {
            const tl = gsap.timeline({
                defaults: { ease: 'none' },
                scrollTrigger: { trigger: sec, start: 'top top', end: 'bottom bottom', scrub: .7 }
            });
            tl.fromTo(media, { clipPath: from }, { clipPath: 'inset(0% 0% 0% 0% round 0px)', duration: 1 }, 0)
              .fromTo(img, { scale: startScale }, { scale: 1, duration: 1.1 }, 0)
              .fromTo(intro, { scale: 1, opacity: 1 }, { scale: 1.3, opacity: 0, duration: .8 }, 0)
              .fromTo(shade, { opacity: 0 }, { opacity: 1, duration: .5 }, .55)
              .fromTo(content, { opacity: 0, y: 30 }, { opacity: 1, y: 0, duration: .45 }, .72);
        };
        const mm = gsap.matchMedia();
        mm.add('(min-width: 900px)', () => build('inset(22% 31% 22% 31% round 28px)', .82));
        mm.add('(max-width: 899px)', () => build('inset(24% 12% 24% 12% round 22px)', .9));
    }

    /* ───────────────────────────────────────────────────────────────────────
       Menú: pestañas, vista previa y selección de platillos
       ─────────────────────────────────────────────────────────────────────── */
    function initMenu() {
        const tabs = $$('.tab');
        const panels = $$('.dishes');
        const ink = $('.tabs__ink');
        const stack = $('#previewStack');
        const capEl = $('#previewCap');
        if (!tabs.length) return;

        // Vista previa con capas de imagen
        const cache = new Map();
        const first = $('img', stack);
        cache.set(first.getAttribute('src'), first);
        let currentSrc = first.getAttribute('src'), currentCap = capEl.textContent, prevTimer = 0;

        const showPhoto = (src, label, alt) => {
            const changedPhoto = src !== currentSrc;
            if (!changedPhoto && label === currentCap) return;
            if (changedPhoto) {
                let img = cache.get(src);
                if (!img) {
                    img = document.createElement('img');
                    img.src = src; img.alt = alt || label; img.decoding = 'async';
                    cache.set(src, img); stack.appendChild(img);
                }
                const old = cache.get(currentSrc);
                $$('img', stack).forEach(n => n.classList.remove('is-prev'));
                if (old) { old.classList.remove('is-active'); old.classList.add('is-prev'); }
                void img.offsetWidth;
                img.classList.add('is-active');
                currentSrc = src;
                clearTimeout(prevTimer);
                prevTimer = setTimeout(() => $$('img.is-prev', stack).forEach(n => n.classList.remove('is-prev')), 1100);
            }
            if (label !== currentCap) {
                currentCap = label;
                capEl.classList.add('is-swap');
                setTimeout(() => { capEl.textContent = label; capEl.classList.remove('is-swap'); }, 180);
            }
        };
        const preload = panel => $$('[data-photo]', panel).forEach(li => { const im = new Image(); im.src = li.dataset.photo; });

        const moveInk = btn => {
            ink.style.width = btn.offsetWidth + 'px';
            ink.style.transform = `translateX(${btn.offsetLeft}px)`;
        };
        const activate = (btn, focus) => {
            tabs.forEach(t => {
                const on = t === btn;
                t.classList.toggle('is-active', on);
                t.setAttribute('aria-selected', on);
                t.tabIndex = on ? 0 : -1;
            });
            moveInk(btn);
            panels.forEach(p => {
                const on = p.dataset.cat === btn.dataset.cat;
                p.hidden = !on;
                p.classList.toggle('is-active', on);
                if (on) {
                    $$('.dish', p).forEach((d, n) => d.style.setProperty('--n', n));
                    showPhoto(p.dataset.defaultPhoto, p.dataset.defaultCap);
                    preload(p);
                }
            });
            if (focus) btn.focus();
            btn.scrollIntoView({ block: 'nearest', inline: 'nearest' });
        };
        tabs.forEach((t, n) => {
            t.addEventListener('click', () => activate(t));
            t.addEventListener('keydown', e => {
                const k = e.key;
                if (!['ArrowRight', 'ArrowLeft', 'Home', 'End'].includes(k)) return;
                e.preventDefault();
                const target = k === 'Home' ? 0 : k === 'End' ? tabs.length - 1 : (n + (k === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length;
                activate(tabs[target], true);
            });
        });
        const place = () => moveInk($('.tab.is-active'));
        place();
        (document.fonts ? document.fonts.ready : Promise.resolve()).then(place);
        window.addEventListener('resize', place);
        $$('.dishes.is-active .dish').forEach((d, n) => d.style.setProperty('--n', n));
        preload($('.dishes.is-active'));

        // Hover o foco en un platillo cambia la vista previa
        $$('.dish').forEach(li => {
            const panel = li.closest('.dishes');
            const go = () => {
                if (li.dataset.photo) showPhoto(li.dataset.photo, li.dataset.name, li.dataset.name);
                else showPhoto(panel.dataset.defaultPhoto, panel.dataset.defaultCap);
            };
            li.addEventListener('pointerenter', go);
            li.addEventListener('focusin', go);
        });

        // Agregar / quitar platillos
        document.addEventListener('click', e => {
            const btn = e.target.closest('.dish__add');
            if (!btn) return;
            const li = btn.closest('.dish');
            Order.toggle(li.dataset.name);
            btn.classList.remove('is-pop'); void btn.offsetWidth; btn.classList.add('is-pop');
        });
    }

    /* ───────────────────────────────────────────────────────────────────────
       "Mi antojo": bandeja, botón del menú y chips del formulario
       ─────────────────────────────────────────────────────────────────────── */
    function initOrderUI() {
        const tray = $('#tray'), count = $('#trayCount'), title = $('#trayTitle'), names = $('#trayNames');
        const send = $('#traySend'), clear = $('#trayClear');
        const menuSend = $('#menuSend'), menuLabel = $('#menuSendLabel'), hint = $('#menuHint');
        const chips = $('#formDishes'), chipsWrap = $('#formDishesWrap');
        let prevCount = 0;

        Order.on(list => {
            const n = list.length;

            $$('.dish').forEach(li => {
                const on = list.includes(li.dataset.name);
                li.classList.toggle('is-added', on);
                const b = $('.dish__add', li);
                b.setAttribute('aria-pressed', on);
                b.setAttribute('aria-label', `${on ? 'Quitar' : 'Agregar'} ${li.dataset.name} ${on ? 'de' : 'a'} mi antojo`);
            });

            tray.classList.toggle('is-on', n > 0);
            count.textContent = n;
            if (n !== prevCount && n > 0) { count.classList.remove('is-bump'); void count.offsetWidth; count.classList.add('is-bump'); }
            prevCount = n;
            title.textContent = n === 1 ? 'antojo en tu lista' : 'antojos en tu lista';
            names.textContent = list.join(', ');
            send.href = waURL(Order.message());

            if (n) {
                menuLabel.textContent = n === 1 ? 'Enviar mi antojo' : `Enviar mis ${n} antojos`;
                menuSend.href = waURL(Order.message());
                hint.textContent = 'Tu lista está lista. Solo falta mandarla por WhatsApp.';
            } else {
                menuLabel.textContent = 'Dime qué hay hoy';
                menuSend.href = waURL(`${CONFIG.greeting}, ¿qué tienen hoy en el menú?`);
                hint.textContent = '¿No te decides? Pregúntanos qué hay hoy.';
            }

            chips.textContent = '';
            list.forEach(name => {
                const li = document.createElement('li');
                li.append(name);
                const b = document.createElement('button');
                b.type = 'button'; b.setAttribute('aria-label', `Quitar ${name}`);
                b.innerHTML = '<i class="ph ph-x" aria-hidden="true"></i>';
                b.addEventListener('click', () => Order.remove(name));
                li.appendChild(b);
                chips.appendChild(li);
            });
            chipsWrap.hidden = n === 0;
        });
        clear.addEventListener('click', () => Order.clear());
        Order.emit();
    }

    /* ───────────────────────────────────────────────────────────────────────
       Comparador salsa verde / salsa roja
       ─────────────────────────────────────────────────────────────────────── */
    function initCompare() {
        const box = $('#compare');
        if (!box) return;
        const range = $('.compare__range', box);
        let auto = !reduceMotion, visible = false, raf = 0, t0 = 0;
        const set = v => box.style.setProperty('--pos', v + '%');
        const stop = () => { auto = false; };
        ['pointerdown', 'keydown', 'touchstart'].forEach(ev => range.addEventListener(ev, stop, { passive: true }));
        range.addEventListener('input', () => { stop(); set(range.value); });
        const frame = now => {
            if (!auto || !visible) { raf = 0; return; }
            const v = 50 + Math.sin((now - t0) / 1100) * 32;
            range.value = v; set(v);
            raf = requestAnimationFrame(frame);
        };
        new IntersectionObserver(([e]) => {
            visible = e.isIntersecting;
            if (visible && auto && !raf) { t0 = performance.now(); raf = requestAnimationFrame(frame); }
        }, { threshold: .3 }).observe(box);
    }

    /* ───────────────────────────────────────────────────────────────────────
       Visor de fotos con animación FLIP
       ─────────────────────────────────────────────────────────────────────── */
    const Lightbox = {
        el: null, img: null, cap: null, cta: null, list: [], idx: 0, origin: null, busy: false, lastFocus: null,
        init() {
            this.el = $('#lightbox'); this.img = $('#lbImg'); this.cap = $('#lbCap'); this.cta = $('#lbCta');
            if (!this.el) return;
            this.el.addEventListener('click', e => { if (e.target.closest('[data-close]')) this.close(); });
            $('#lbPrev').addEventListener('click', () => this.step(-1));
            $('#lbNext').addEventListener('click', () => this.step(1));
            document.addEventListener('keydown', e => {
                if (this.el.hidden) return;
                if (e.key === 'Escape') this.close();
                else if (e.key === 'ArrowLeft') this.step(-1);
                else if (e.key === 'ArrowRight') this.step(1);
                else if (e.key === 'Tab') this.trap(e);
            });
            // Botones sueltos (carta original)
            $$('[data-lightbox-src]').forEach(b => b.addEventListener('click', () => {
                this.open([{ src: b.dataset.lightboxSrc, caption: b.dataset.lightboxCaption || '', alt: b.dataset.lightboxCaption || '', cta: false }], 0, b);
            }));
        },
        fill(item) {
            this.img.src = item.src;
            this.img.alt = item.alt || item.caption;
            this.cap.textContent = item.caption;
            this.cta.hidden = item.cta === false;
            if (!this.cta.hidden) this.cta.href = waURL(`${CONFIG.greeting}, me gustaría pedir: ${item.caption}.`);
        },
        async open(list, idx, origin) {
            if (this.busy) return;
            this.busy = true;
            this.list = list; this.idx = idx; this.origin = origin;
            this.lastFocus = document.activeElement;
            this.fill(list[idx]);
            this.el.classList.toggle('is-single', list.length < 2);
            this.el.hidden = false;
            lockScroll();
            try { await this.img.decode(); } catch (e) { /* imagen en caché o error: continuamos */ }
            this.el.offsetWidth;
            this.el.classList.add('is-open');
            const first = origin && origin.getBoundingClientRect();
            if (first && first.width && !reduceMotion) await this.flip(first, true);
            this.busy = false;
            $('.lightbox__close', this.el).focus({ preventScroll: true });
        },
        flip(first, opening) {
            const last = this.img.getBoundingClientRect();
            if (!last.width) return Promise.resolve();
            const s = Math.max(first.width / last.width, first.height / last.height);
            const dx = (first.left + first.width / 2) - (last.left + last.width / 2);
            const dy = (first.top + first.height / 2) - (last.top + last.height / 2);
            const hx = Math.max(0, (last.width - first.width / s) / 2);
            const hy = Math.max(0, (last.height - first.height / s) / 2);
            const from = { transform: `translate(${dx}px, ${dy}px) scale(${s})`, clipPath: `inset(${hy}px ${hx}px round ${28 / s}px)` };
            const to = { transform: 'translate(0, 0) scale(1)', clipPath: 'inset(0px 0px round 20px)' };
            const anim = this.img.animate(opening ? [from, to] : [to, from], {
                duration: opening ? 760 : 520, easing: opening ? 'cubic-bezier(.23,1,.32,1)' : 'cubic-bezier(.77,0,.175,1)', fill: 'both'
            });
            return anim.finished.then(() => { if (opening) anim.cancel(); }).catch(() => {});
        },
        async close() {
            if (this.busy || this.el.hidden) return;
            this.busy = true;
            this.el.classList.remove('is-open');
            const o = this.origin && this.origin.isConnected ? this.origin.getBoundingClientRect() : null;
            const visible = o && o.width && o.bottom > 0 && o.top < innerHeight && o.right > 0 && o.left < innerWidth;
            if (visible && !reduceMotion && this.list.length) {
                // si se navegó a otra foto, volvemos con un fundido en lugar de FLIP
                if (this.list[this.idx].src === (this.origin.querySelector('img') || {}).src || this.list.length === 1) await this.flip(o, false);
                else await this.fade(false);
            } else if (!reduceMotion) await this.fade(false);
            this.el.hidden = true;
            this.img.getAnimations().forEach(a => a.cancel());
            unlockScroll();
            if (this.lastFocus && this.lastFocus.focus) this.lastFocus.focus({ preventScroll: true });
            this.busy = false;
        },
        fade(inn) {
            return this.img.animate([{ opacity: inn ? 0 : 1, transform: inn ? 'scale(.97)' : 'none' }, { opacity: inn ? 1 : 0, transform: inn ? 'none' : 'scale(.97)' }], { duration: 320, easing: 'ease-out', fill: 'both' }).finished.catch(() => {});
        },
        async step(dir) {
            if (this.busy || this.list.length < 2) return;
            this.busy = true;
            await this.fade(false);
            this.idx = (this.idx + dir + this.list.length) % this.list.length;
            this.fill(this.list[this.idx]);
            try { await this.img.decode(); } catch (e) { /* noop */ }
            await this.fade(true);
            this.img.getAnimations().forEach(a => a.cancel());
            this.busy = false;
        },
        trap(e) {
            const f = $$('button, a[href]', this.el).filter(n => !n.hidden && n.offsetParent !== null);
            if (!f.length) return;
            const a = f[0], z = f[f.length - 1];
            if (e.shiftKey && document.activeElement === a) { e.preventDefault(); z.focus(); }
            else if (!e.shiftKey && document.activeElement === z) { e.preventDefault(); a.focus(); }
        }
    };

    /* ───────────────────────────────────────────────────────────────────────
       Galería: el scroll vertical desplaza la pista en horizontal
       ─────────────────────────────────────────────────────────────────────── */
    function initGallery() {
        const sec = $('#galeria'), track = $('#galTrack');
        if (!sec || !track) return;
        const cards = $$('.gcard[data-gal]', track);

        // Abrir en el visor
        const items = cards.map(c => {
            const im = $('img', c);
            return { src: im.currentSrc || im.src, caption: c.dataset.caption, alt: im.alt, node: $('.gcard__img', c) };
        });
        cards.forEach((c, n) => $('.gcard__btn', c).addEventListener('click', () => {
            const list = cards.map(card => { const im = $('img', card); return { src: im.getAttribute('src'), caption: card.dataset.caption, alt: im.alt }; });
            Lightbox.open(list, n, items[n].node);
        }));

        if (!canScrub()) return;
        const mm = gsap.matchMedia();
        mm.add('(min-width: 1024px) and (hover: hover)', () => {
            sec.classList.add('is-pan');
            const imgs = cards.map(c => $('img', c));
            let offsets = [];
            const distance = () => Math.max(0, track.scrollWidth - window.innerWidth);
            const setHeight = () => { sec.style.height = (distance() + window.innerHeight) + 'px'; };
            const measure = () => { offsets = cards.map(c => c.offsetLeft + c.offsetWidth / 2); };
            setHeight(); measure();
            ScrollTrigger.addEventListener('refreshInit', setHeight);
            ScrollTrigger.addEventListener('refresh', measure);

            const tween = gsap.to(track, {
                x: () => -distance(), ease: 'none',
                scrollTrigger: { trigger: sec, start: 'top top', end: 'bottom bottom', scrub: .8, invalidateOnRefresh: true }
            });
            tween.eventCallback('onUpdate', () => {
                const x = gsap.getProperty(track, 'x');
                const vw = window.innerWidth;
                for (let n = 0; n < imgs.length; n++) {
                    const d = (offsets[n] + x - vw / 2) / vw;
                    imgs[n].style.transform = `translate3d(${(-d * 70).toFixed(1)}px,0,0) scale(1.16)`;
                }
            });
            return () => {
                sec.classList.remove('is-pan');
                sec.style.height = '';
                imgs.forEach(im => { im.style.transform = ''; });
                ScrollTrigger.removeEventListener('refreshInit', setHeight);
                ScrollTrigger.removeEventListener('refresh', measure);
            };
        });
    }

    /* ───────────────────────────────────────────────────────────────────────
       Cómo pedir: línea que se dibuja con el scroll
       ─────────────────────────────────────────────────────────────────────── */
    function initSteps() {
        const list = $('#stepsList');
        if (!list) return;
        const steps = $$('.step', list);
        if (!canScrub()) {
            list.style.setProperty('--fill', 1);
            steps.forEach(s => s.classList.add('is-on'));
            return;
        }
        let tops = [];
        const measure = () => { tops = steps.map(s => s.offsetTop + 18); };
        measure();
        ScrollTrigger.create({
            trigger: list, start: 'top 72%', end: 'bottom 62%',
            onRefresh: measure,
            onUpdate: self => {
                list.style.setProperty('--fill', self.progress.toFixed(4));
                const h = list.offsetHeight * self.progress;
                steps.forEach((s, n) => s.classList.toggle('is-on', tops[n] <= h));
            }
        });
    }

    /* ───────────────────────────────────────────────────────────────────────
       Barra de progreso de lectura
       ─────────────────────────────────────────────────────────────────────── */
    function initProgress() {
        const bar = $('#progress');
        if (!bar || !hasGSAP()) return;
        ScrollTrigger.create({
            start: 0, end: 'max',
            onUpdate: self => { bar.style.transform = `scaleX(${self.progress.toFixed(4)})`; }
        });
    }

    /* ───────────────────────────────────────────────────────────────────────
       Formulario → WhatsApp
       ─────────────────────────────────────────────────────────────────────── */
    function initForm() {
        const form = $('#orderForm');
        if (!form) return;
        const name = $('#f-name'), type = $('#f-type'), note = $('#f-msg');
        const submit = $('#formSubmit'), ok = $('#formOk'), okLink = $('#formOkLink');

        const setErr = (input, msg) => {
            const wrap = input.closest('.field');
            wrap.classList.toggle('has-error', !!msg);
            $('.field__err', wrap).textContent = msg || '';
            input.setAttribute('aria-invalid', !!msg);
        };
        [name, type].forEach(inp => inp.addEventListener('input', () => setErr(inp, '')));
        type.addEventListener('change', () => setErr(type, ''));

        form.addEventListener('submit', e => {
            e.preventDefault();
            let valid = true;
            if (name.value.trim().length < 2) { setErr(name, 'Escribe tu nombre para saber a quién responderle.'); valid = false; }
            if (!type.value) { setErr(type, 'Elige qué estás buscando.'); valid = false; }
            if (!valid) { (name.value.trim().length < 2 ? name : type).focus(); return; }

            const url = waURL(Order.message({ name: name.value.trim(), type: type.value, note: note.value.trim() }));
            okLink.href = url;
            submit.classList.add('is-sending');
            const w = window.open(url, '_blank');
            if (w) w.opener = null;
            setTimeout(() => {
                submit.classList.remove('is-sending');
                ok.hidden = false;
                form.reset();
            }, 700);
        });
    }

    /* ───────────────────────────────────────────────────────────────────────
       Detalles de interacción: botones magnéticos, brillo en tarjetas, tip de WhatsApp
       ─────────────────────────────────────────────────────────────────────── */
    function initMagnetic() {
        if (!finePointer || reduceMotion) return;
        $$('.btn--lg.btn--primary, .btn--xl, .wa__btn').forEach(el => {
            el.style.transition = (el.style.transition ? el.style.transition + ',' : '') + 'translate .5s cubic-bezier(.23,1,.32,1)';
            el.addEventListener('pointermove', e => {
                const r = el.getBoundingClientRect();
                const dx = (e.clientX - (r.left + r.width / 2)) / r.width;
                const dy = (e.clientY - (r.top + r.height / 2)) / r.height;
                el.style.translate = `${(dx * 12).toFixed(1)}px ${(dy * 10).toFixed(1)}px`;
            });
            el.addEventListener('pointerleave', () => { el.style.translate = ''; });
        });
    }
    function initSpotlight() {
        if (!finePointer) return;
        $$('.cell').forEach(c => c.addEventListener('pointermove', e => {
            const r = c.getBoundingClientRect();
            c.style.setProperty('--mx', (e.clientX - r.left) + 'px');
            c.style.setProperty('--my', (e.clientY - r.top) + 'px');
        }));
    }
    function initWaTip() {
        const wa = $('#waFloat');
        if (!wa || reduceMotion) return;
        setTimeout(() => {
            wa.classList.add('is-tip');
            setTimeout(() => wa.classList.remove('is-tip'), 5200);
        }, 7000);
    }

    /* ───────────────────────────────────────────────────────────────────────
       Arranque
       ─────────────────────────────────────────────────────────────────────── */
    function init() {
        if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
        window.scrollTo(0, 0);

        initWhatsApp();
        applyConfig();
        $$('[data-split]').forEach(splitWords);

        initScroll();
        initNav();
        initAnchors();
        initPlate();
        initEmbers();
        initBand();
        initReveal();
        initCounters();
        initMenu();
        initOrderUI();
        initCompare();
        Lightbox.init();
        initGallery();
        initManifesto();
        initExpand();
        initSteps();
        initProgress();
        initForm();
        initMagnetic();
        initSpotlight();
        initWaTip();

        if (hasGSAP()) {
            const refresh = () => ScrollTrigger.refresh();
            window.addEventListener('load', refresh, { once: true });
            if (document.fonts) document.fonts.ready.then(refresh);
        }

        runLoader().then(() => {
            root.classList.remove('is-loading');
            root.classList.add('is-ready');
            if (lenis) lenis.start();
            if (hasGSAP()) ScrollTrigger.refresh();
            document.dispatchEvent(new Event('site:ready'));
            if (location.hash && $(location.hash)) {
                const t = $(location.hash);
                setTimeout(() => scrollToTarget(t, true), 60);
            }
        });
    }

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
    else init();
})();
