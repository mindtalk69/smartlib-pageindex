// constellation.js - Connecting dots animation

class ConstellationSystem {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.points = [];
        this.numPoints = 80;
        this.maxDistance = 100; // Max distance to draw a line between points
        this.animationFrameId = null;
        this.resizeObserver = null;
        this.mouse = { x: null, y: null, maxDistance: 150 }; // Mouse interaction
        console.log("ConstellationSystem instantiated");
    }

    resizeCanvas() {
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;
        console.log(`ConstellationSystem canvas resized to ${this.canvas.width}x${this.canvas.height}`);
        // Reinitialize points on resize
        this.createPoints();
    }

    createPoints() {
        this.points = []; // Clear existing points
        for (let i = 0; i < this.numPoints; i++) {
            this.points.push({
                x: Math.random() * this.canvas.width,
                y: Math.random() * this.canvas.height,
                vx: (Math.random() - 0.5) * 0.3, // Slow random movement
                vy: (Math.random() - 0.5) * 0.3,
                radius: Math.random() * 1.5 + 1, // Slightly larger points
                color: `rgba(220, 220, 255, 0.8)` // Light color
            });
        }
        console.log(`ConstellationSystem created ${this.points.length} points`);
    }

    handleMouseMove(event) {
        this.mouse.x = event.clientX;
        this.mouse.y = event.clientY;
    }

    handleMouseOut() {
        this.mouse.x = null;
        this.mouse.y = null;
    }

    animate() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        this.points.forEach(p => {
            // Update position
            p.x += p.vx;
            p.y += p.vy;

            // Boundary check (bounce off edges)
            if (p.x < p.radius || p.x > this.canvas.width - p.radius) p.vx *= -1;
            if (p.y < p.radius || p.y > this.canvas.height - p.radius) p.vy *= -1;

            // Draw point
            this.ctx.beginPath();
            this.ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
            this.ctx.fillStyle = p.color;
            this.ctx.fill();

            // Draw lines to nearby points
            this.points.forEach(otherP => {
                if (p === otherP) return; // Don't connect to self
                const dx = p.x - otherP.x;
                const dy = p.y - otherP.y;
                const distance = Math.sqrt(dx * dx + dy * dy);

                if (distance < this.maxDistance) {
                    this.ctx.beginPath();
                    this.ctx.moveTo(p.x, p.y);
                    this.ctx.lineTo(otherP.x, otherP.y);
                    // Make line opacity dependent on distance
                    this.ctx.strokeStyle = `rgba(220, 220, 255, ${1 - distance / this.maxDistance})`;
                    this.ctx.lineWidth = 0.5;
                    this.ctx.stroke();
                }
            });

            // Draw lines to mouse if close enough
            if (this.mouse.x !== null && this.mouse.y !== null) {
                const dxMouse = p.x - this.mouse.x;
                const dyMouse = p.y - this.mouse.y;
                const distanceMouse = Math.sqrt(dxMouse * dxMouse + dyMouse * dyMouse);

                if (distanceMouse < this.mouse.maxDistance) {
                    this.ctx.beginPath();
                    this.ctx.moveTo(p.x, p.y);
                    this.ctx.lineTo(this.mouse.x, this.mouse.y);
                    this.ctx.strokeStyle = `rgba(220, 220, 255, ${1 - distanceMouse / this.mouse.maxDistance})`;
                    this.ctx.lineWidth = 0.3;
                    this.ctx.stroke();
                }
            }
        });

        this.animationFrameId = requestAnimationFrame(this.animate.bind(this));
    }

    init() {
        console.log("ConstellationSystem init called");
        this.resizeCanvas(); // Initial size setup

        // Add mouse listeners
        this.boundMouseMove = this.handleMouseMove.bind(this);
        this.boundMouseOut = this.handleMouseOut.bind(this);
        window.addEventListener('mousemove', this.boundMouseMove);
        window.addEventListener('mouseout', this.boundMouseOut); // Or use mouseleave on canvas parent

        // Use ResizeObserver
        this.resizeObserver = new ResizeObserver(entries => {
            this.resizeCanvas();
        });
        this.resizeObserver.observe(document.body);

        // Initial point creation is done in resizeCanvas
        this.animate(); // Start the animation loop
        console.log("ConstellationSystem animation started");
    }

    stop() {
        console.log("ConstellationSystem stop called");
        if (this.animationFrameId) {
            cancelAnimationFrame(this.animationFrameId);
            this.animationFrameId = null;
            console.log("ConstellationSystem animation frame cancelled");
        }
        if (this.resizeObserver) {
            this.resizeObserver.disconnect();
            this.resizeObserver = null;
            console.log("ConstellationSystem resize observer disconnected");
        }
        // Remove mouse listeners
        window.removeEventListener('mousemove', this.boundMouseMove);
        window.removeEventListener('mouseout', this.boundMouseOut);
        console.log("ConstellationSystem mouse listeners removed");

        // Clear the canvas
        if (this.ctx) {
            this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
            console.log("ConstellationSystem canvas cleared");
        }
        this.points = []; // Clear points array
    }
}

// Make it available globally
window.ConstellationSystem = ConstellationSystem;
