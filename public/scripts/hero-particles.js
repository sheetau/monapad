(() => {
  const HERO_PARTICLES_ENABLED = false;

  function initHeroParticles() {
    const canvas = document.querySelector(".hero-particles");
    const hero = document.querySelector(".hero");
    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const isCoarsePointer = window.matchMedia("(hover: none), (pointer: coarse)").matches;

    if (!canvas || !hero || prefersReducedMotion.matches) return;

    const ctx = canvas.getContext("2d", { alpha: true });
    const particles = [];
    let width = 0;
    let height = 0;
    let animationFrameId = 0;
    let lastFrameAt = performance.now();
    const pointer = {
      x: window.innerWidth * 0.5,
      y: window.innerHeight * 0.75,
      targetX: window.innerWidth * 0.5,
      targetY: window.innerHeight * 0.75,
    };
    const particleCount = isCoarsePointer ? 28 : 42;

    const setSize = () => {
      const rect = hero.getBoundingClientRect();
      const scale = Math.min(window.devicePixelRatio || 1, 2);
      width = Math.max(1, Math.round(rect.width));
      height = Math.max(1, Math.round(rect.height));
      canvas.width = Math.round(width * scale);
      canvas.height = Math.round(height * scale);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      ctx.setTransform(scale, 0, 0, scale, 0, 0);
    };
    const resetParticle = (particle, randomizeY = true) => {
      particle.x = Math.random() * width;
      particle.y = randomizeY ? Math.random() * height : height + Math.random() * 60;
      particle.radius = 1 + Math.random() * 2.6;
      particle.speed = 8 + Math.random() * 18;
      particle.drift = (Math.random() - 0.5) * 10;
      particle.alpha = 0.12 + Math.random() * 0.24;
    };
    const seedParticles = () => {
      particles.length = 0;
      for (let i = 0; i < particleCount; i += 1) {
        const particle = {};
        resetParticle(particle);
        particles.push(particle);
      }
    };
    const draw = (now) => {
      const delta = Math.min((now - lastFrameAt) / 1000, 0.04);
      lastFrameAt = now;
      pointer.x += (pointer.targetX - pointer.x) * 0.08;
      pointer.y += (pointer.targetY - pointer.y) * 0.08;

      ctx.clearRect(0, 0, width, height);
      particles.forEach((particle) => {
        const dx = particle.x - pointer.x;
        const dy = particle.y - pointer.y;
        const distance = Math.max(Math.hypot(dx, dy), 1);
        const influence = Math.max(0, 1 - distance / 180);

        particle.x += (particle.drift + (dx / distance) * influence * 32) * delta;
        particle.y -= (particle.speed + influence * 38) * delta;
        if (particle.y < -12 || particle.x < -24 || particle.x > width + 24) resetParticle(particle, false);

        ctx.beginPath();
        ctx.fillStyle = `rgba(86, 156, 214, ${particle.alpha + influence * 0.24})`;
        ctx.arc(particle.x, particle.y, particle.radius + influence * 1.6, 0, Math.PI * 2);
        ctx.fill();
      });
      animationFrameId = window.requestAnimationFrame(draw);
    };
    const syncPointer = (event) => {
      const rect = hero.getBoundingClientRect();
      pointer.targetX = event.clientX - rect.left;
      pointer.targetY = event.clientY - rect.top;
    };

    setSize();
    seedParticles();
    hero.addEventListener("pointermove", syncPointer, { passive: true });
    window.addEventListener(
      "resize",
      () => {
        setSize();
        seedParticles();
      },
      { passive: true },
    );
    prefersReducedMotion.addEventListener?.("change", () => {
      if (prefersReducedMotion.matches) window.cancelAnimationFrame(animationFrameId);
    });
    animationFrameId = window.requestAnimationFrame(draw);
  }

  window.addEventListener("load", () => {
    if (HERO_PARTICLES_ENABLED) initHeroParticles();
  });
})();
