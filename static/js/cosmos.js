class Star {
    constructor(canvas, x, y) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.x = x || Math.random() * canvas.width;
        this.y = y || Math.random() * canvas.height;
        this.size = Math.random() * 2 + 0.5; // .5 to 2.5
        this.baseX = this.x;
        this.baseY = this.y;
        this.density = (Math.random() * 30) + 1;

        // Velocity for natural drift
        this.vx = (Math.random() - 0.5) * 0.2;
        this.vy = (Math.random() - 0.5) * 0.2;
    }

    draw() {
        this.ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
        this.ctx.beginPath();
        this.ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        this.ctx.closePath();
        this.ctx.fill();
    }

    update(mouse) {
        // Natural movement
        this.x += this.vx;
        this.y += this.vy;

        // Wrap around screen
        if (this.x < 0) this.x = this.canvas.width;
        if (this.x > this.canvas.width) this.x = 0;
        if (this.y < 0) this.y = this.canvas.height;
        if (this.y > this.canvas.height) this.y = 0;

        // Mouse interaction
        let dx = mouse.x - this.x;
        let dy = mouse.y - this.y;
        let distance = Math.sqrt(dx * dx + dy * dy);
        let forceDirectionX = dx / distance;
        let forceDirectionY = dy / distance;
        let maxDistance = 150;
        let force = (maxDistance - distance) / maxDistance;
        let directionX = forceDirectionX * force * this.density;
        let directionY = forceDirectionY * force * this.density;

        if (distance < maxDistance) {
            // Move away from mouse slightly giving a "parting" effect or towards?
            // Let's do "connect" instead of move for now, or subtle move
            // this.x -= directionX;
            // this.y -= directionY;
        } else {
            // Return to base? No, they drift.
        }
    }
}

class CosmosEffect {
    constructor() {
        this.canvas = document.getElementById('cosmosCanvas');
        this.ctx = this.canvas.getContext('2d');
        this.stars = [];
        this.numberOfStars = 150;
        this.mouse = { x: null, y: null };

        this.init();
        this.animate();

        window.addEventListener('resize', () => {
            this.resize();
            this.init();
        });

        window.addEventListener('mousemove', (e) => {
            this.mouse.x = e.x;
            this.mouse.y = e.y;
        });

        window.addEventListener('touchmove', (e) => {
            const touch = e.touches[0];
            this.mouse.x = touch.clientX;
            this.mouse.y = touch.clientY;
        }, { passive: true });
    }

    init() {
        this.resize();
        this.stars = [];
        for (let i = 0; i < this.numberOfStars; i++) {
            this.stars.push(new Star(this.canvas));
        }
    }

    resize() {
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;
    }

    animate() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        // Draw and update stars
        this.stars.forEach(star => {
            star.draw();
            star.update(this.mouse);
        });

        // Draw connections
        this.connect();

        requestAnimationFrame(() => this.animate());
    }

    connect() {
        let opacityValue = 1;
        for (let a = 0; a < this.stars.length; a++) {
            for (let b = a; b < this.stars.length; b++) {
                let dx = this.stars[a].x - this.stars[b].x;
                let dy = this.stars[a].y - this.stars[b].y;
                let distance = dx * dx + dy * dy;

                if (distance < (this.canvas.width / 7) * (this.canvas.height / 7) * 0.005) { // Connection distance
                    opacityValue = 1 - (distance / 20000);
                    this.ctx.strokeStyle = 'rgba(120, 150, 255,' + opacityValue * 0.2 + ')'; // Blue-ish faint lines
                    this.ctx.lineWidth = 1;
                    this.ctx.beginPath();
                    this.ctx.moveTo(this.stars[a].x, this.stars[a].y);
                    this.ctx.lineTo(this.stars[b].x, this.stars[b].y);
                    this.ctx.stroke();
                }
            }

            // Connect to mouse
            let dx = this.stars[a].x - this.mouse.x;
            let dy = this.stars[a].y - this.mouse.y;
            let distance = dx * dx + dy * dy;
            if (distance < 25000) { // Mouse connection
                this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
                this.ctx.lineWidth = 1;
                this.ctx.beginPath();
                this.ctx.moveTo(this.stars[a].x, this.stars[a].y);
                this.ctx.lineTo(this.mouse.x, this.mouse.y);
                this.ctx.stroke();
            }
        }
    }
}

new CosmosEffect();
