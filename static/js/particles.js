class ParticleSystem {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.particles = [];
        this.wind = { x: 0, y: 0 };
        this.lastTime = 0;
        this.isRunning = false;
        this.animationFrameId = null; // To store the requestAnimationFrame ID
        this.windIntervalId = null; // To store the setInterval ID

        // Configuration
        this.particleCount = Math.min(window.innerWidth * 0.15, 150); // More particles
        this.particleSize = { min: 1, max: 2.5 }; // Even smaller particles for subtlety
        this.baseSpeed = 0.6; // Even slower for gentler movement
        this.windChangeInterval = 5000; // Longer interval for smoother transitions
        this.windForce = { min: -0.6, max: 0.6 }; // Gentler wind effect
        
        // Colors for particles
        const isDark = document.documentElement.classList.contains('dark-mode');
        this.colors = isDark ? [
            'rgba(255, 255, 255, 0.6)',
            'rgba(200, 230, 255, 0.5)',
            'rgba(180, 220, 255, 0.45)'
        ] : [
            'rgba(255, 255, 255, 0.7)',
            'rgba(245, 250, 255, 0.6)',
            'rgba(235, 245, 255, 0.5)'
        ];

        // Bind methods
        this.animate = this.animate.bind(this);
        this.updateWind = this.updateWind.bind(this);
        this.handleResize = this.handleResize.bind(this);

        // Event listeners
        window.addEventListener('resize', this.handleResize);
        document.getElementById('theme-toggle')?.addEventListener('click', () => {
            setTimeout(() => {
                const isDark = document.documentElement.classList.contains('dark-mode');
                this.colors = isDark ? [
                    'rgba(255, 255, 255, 0.6)',
                    'rgba(200, 230, 255, 0.5)',
                    'rgba(180, 220, 255, 0.45)'
                ] : [
                    'rgba(255, 255, 255, 0.7)',
                    'rgba(245, 250, 255, 0.6)',
                    'rgba(235, 245, 255, 0.5)'
                ];
                this.createParticles(); // Recreate particles with new colors
            }, 100);
        });
    }

    init() {
        this.handleResize(); // Set initial canvas size
        this.createParticles();
        this.isRunning = true;
        this.lastTime = performance.now();
        // Store the frame ID
        this.animationFrameId = requestAnimationFrame(this.animate); 
        // Store the interval ID
        this.windIntervalId = setInterval(this.updateWind, this.windChangeInterval); 
    }

    createParticles() {
        this.particles = [];
        for (let i = 0; i < this.particleCount; i++) {
            this.particles.push({
                x: Math.random() * this.canvas.width,
                y: Math.random() * this.canvas.height,
                size: Math.random() * (this.particleSize.max - this.particleSize.min) + this.particleSize.min,
                speedX: (Math.random() - 0.5) * this.baseSpeed,
                speedY: (Math.random() - 0.5) * this.baseSpeed,
                color: this.colors[Math.floor(Math.random() * this.colors.length)],
                opacity: Math.random() * 0.5 + 0.3
            });
        }
    }

    updateWind() {
        // Generate smooth wind changes
        const currentX = this.wind.x;
        const currentY = this.wind.y;
        const targetX = Math.random() * (this.windForce.max - this.windForce.min) + this.windForce.min;
        const targetY = Math.random() * (this.windForce.max - this.windForce.min) + this.windForce.min;

        // Create intermediate points for smoother transition
        const points = [
            { x: currentX, y: currentY },
            { x: (currentX + targetX) * 0.3, y: (currentY + targetY) * 0.7 },
            { x: (currentX + targetX) * 0.7, y: (currentY + targetY) * 0.3 },
            { x: targetX, y: targetY }
        ];

        anime({
            targets: this.wind,
            x: points.map(p => p.x),
            y: points.map(p => p.y),
            duration: this.windChangeInterval * 0.8,
            easing: 'cubicBezier(0.4, 0.0, 0.2, 1)',
            complete: () => {
                // Ensure final values are set
                this.wind.x = targetX;
                this.wind.y = targetY;
            }
        });
    }

    handleResize() {
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;
        if (this.particles.length > 0) {
            this.createParticles(); // Recreate particles for new dimensions
        }
    }

    updateParticle(particle, deltaTime) {
        // Calculate wind influence based on particle size
        const windInfluence = (this.particleSize.max - particle.size) / (this.particleSize.max - this.particleSize.min);
        
        // Apply wind force with smooth acceleration
        const targetSpeedX = particle.speedX + (this.wind.x * windInfluence);
        const targetSpeedY = particle.speedY + (this.wind.y * windInfluence);
        
        // Smooth acceleration
        particle.speedX += (targetSpeedX - particle.speedX) * 0.1;
        particle.speedY += (targetSpeedY - particle.speedY) * 0.1;
        
        // Update position with delta time
        particle.x += particle.speedX * deltaTime * 0.05;
        particle.y += particle.speedY * deltaTime * 0.05;

        // Wrap around screen edges with smooth transition
        if (particle.x < -particle.size) particle.x = this.canvas.width + particle.size;
        if (particle.x > this.canvas.width + particle.size) particle.x = -particle.size;
        if (particle.y < -particle.size) particle.y = this.canvas.height + particle.size;
        if (particle.y > this.canvas.height + particle.size) particle.y = -particle.size;

        // Enhanced twinkling effect with position-based variation
        const time = performance.now() * 0.001;
        const positionFactor = (Math.sin(particle.x * 0.01) + Math.cos(particle.y * 0.01)) * 0.5;
        particle.opacity = 0.3 + Math.sin(time + positionFactor) * 0.2;
    }

    animate(currentTime) {
        if (!this.isRunning) return;

        const deltaTime = currentTime - this.lastTime;
        this.lastTime = currentTime;

        // Clear canvas
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        // Update and draw particles
        this.particles.forEach(particle => {
            this.updateParticle(particle, deltaTime);

            // Draw particle with glow effect
            this.ctx.save();
            this.ctx.beginPath();
            this.ctx.fillStyle = particle.color.replace(')', `, ${particle.opacity})`);
            this.ctx.shadowBlur = particle.size * 3;
            this.ctx.shadowColor = particle.color;
            this.ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
            this.ctx.fill();
            this.ctx.restore();
        });

        // Store the frame ID for the next frame
        this.animationFrameId = requestAnimationFrame(this.animate);
    }

    stop() {
        console.log("ParticleSystem stop called");
        this.isRunning = false;
        
        // Cancel the animation frame loop
        if (this.animationFrameId) {
            cancelAnimationFrame(this.animationFrameId);
            this.animationFrameId = null;
            console.log("ParticleSystem animation frame cancelled");
        }

        // Clear the wind update interval
        if (this.windIntervalId) {
            clearInterval(this.windIntervalId);
            this.windIntervalId = null;
            console.log("ParticleSystem wind interval cleared");
        }

        // Remove event listeners
        window.removeEventListener('resize', this.handleResize);
        console.log("ParticleSystem resize listener removed");
        
        // Optional: Clear the canvas immediately
        // if (this.ctx) {
        //     this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        //     console.log("ParticleSystem canvas cleared immediately on stop");
        // }
    }
}

// Make the class available globally for the animation manager
window.ParticleSystem = ParticleSystem;

// REMOVED: Independent initialization logic. 
// The animation-manager.js is now responsible for creating instances.
