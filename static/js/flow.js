// flow.js - Simple flowing particles animation

class FlowSystem {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.particles = [];
        this.numParticles = 100;
        this.animationFrameId = null;
        this.resizeObserver = null;
        console.log("FlowSystem instantiated");
    }

    resizeCanvas() {
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;
        console.log(`FlowSystem canvas resized to ${this.canvas.width}x${this.canvas.height}`);
        // Reinitialize particles on resize if needed, or adjust existing ones
        // For simplicity, we'll just clear and recreate
        this.particles = [];
        this.createParticles();
    }

    createParticles() {
        this.particles = []; // Clear existing particles
        for (let i = 0; i < this.numParticles; i++) {
            this.particles.push({
                x: Math.random() * this.canvas.width,
                y: Math.random() * this.canvas.height,
                vx: (Math.random() - 0.5) * 0.5, // Slow horizontal movement
                vy: Math.random() * 1 + 0.5,     // Downward movement
                radius: Math.random() * 1.5 + 0.5, // Small radius
                color: `rgba(200, 200, 255, ${Math.random() * 0.5 + 0.3})` // Light blueish with varying opacity
            });
        }
        console.log(`FlowSystem created ${this.particles.length} particles`);
    }

    animate() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        this.particles.forEach(p => {
            // Update position
            p.x += p.vx;
            p.y += p.vy;

            // Boundary check (wrap around vertically, reset horizontally)
            if (p.y > this.canvas.height + p.radius) {
                p.y = -p.radius;
                p.x = Math.random() * this.canvas.width; // Re-randomize x on wrap
            }
            if (p.x < -p.radius) p.x = this.canvas.width + p.radius;
            if (p.x > this.canvas.width + p.radius) p.x = -p.radius;


            // Draw particle
            this.ctx.beginPath();
            this.ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
            this.ctx.fillStyle = p.color;
            this.ctx.fill();
        });

        this.animationFrameId = requestAnimationFrame(this.animate.bind(this));
    }

    init() {
        console.log("FlowSystem init called");
        this.resizeCanvas(); // Initial size setup
        // Use ResizeObserver for better resize handling
        this.resizeObserver = new ResizeObserver(entries => {
            // We only observe one element, so entries[0] is fine
            this.resizeCanvas();
        });
        this.resizeObserver.observe(document.body); // Observe body size changes

        // Initial particle creation is done in resizeCanvas
        this.animate(); // Start the animation loop
        console.log("FlowSystem animation started");
    }

    stop() {
        console.log("FlowSystem stop called");
        if (this.animationFrameId) {
            cancelAnimationFrame(this.animationFrameId);
            this.animationFrameId = null;
            console.log("FlowSystem animation frame cancelled");
        }
        if (this.resizeObserver) {
            this.resizeObserver.disconnect();
            this.resizeObserver = null;
            console.log("FlowSystem resize observer disconnected");
        }
        // Clear the canvas
        if (this.ctx) {
            this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
            console.log("FlowSystem canvas cleared");
        }
        this.particles = []; // Clear particles array
    }
}

// Make it available globally if animation-manager expects it
window.FlowSystem = FlowSystem;
