// Physics Configuration
const PHYSICS = {
    friction: 0.96,          // High friction for throwing control
    ambientFriction: 0.995,  // Low friction for perpetual floating
    restitution: 0.7,
    floatForce: 0.08,
    maxSpeed: 8,
    minSpeed: 0.5,
    throwMultiplier: 1.5,
    dampening: 0.95
};

class BubbleSystem {
    constructor() {
        this.bubbles = [];
        this.mouseX = 0;
        this.mouseY = 0;
        this.prevMouseX = 0;
        this.prevMouseY = 0;

        this.isDragging = false;
        this.draggedBubble = null;
        this.dragOffsetX = 0;
        this.dragOffsetY = 0;

        this.initInteraction();
        this.animate();
    }

    initInteraction() {
        document.addEventListener('mousemove', (e) => {
            this.prevMouseX = this.mouseX;
            this.prevMouseY = this.mouseY;
            this.mouseX = e.clientX;
            this.mouseY = e.clientY;

            if (this.isDragging && this.draggedBubble) {
                // Directly move the bubble
                this.draggedBubble.x = this.mouseX + this.dragOffsetX;
                this.draggedBubble.y = this.mouseY + this.dragOffsetY;

                // Reset velocity while dragging to 0 (or calculated from delta for "throwing" feel during drag? 
                // Better to calculate on release, but strictly 0 here prevents drift)
                this.draggedBubble.vx = 0;
                this.draggedBubble.vy = 0;
            }
        });

        document.addEventListener('mouseup', () => {
            if (this.isDragging && this.draggedBubble) {
                // Throw physics
                const dx = this.mouseX - this.prevMouseX;
                const dy = this.mouseY - this.prevMouseY;

                this.draggedBubble.vx = dx * PHYSICS.throwMultiplier;
                this.draggedBubble.vy = dy * PHYSICS.throwMultiplier;

                // Mark dragging as false
                this.draggedBubble.isDragging = false;
                this.draggedBubble = null;
                this.isDragging = false;
            }
        });
    }

    clear() {
        this.bubbles = [];
    }

    add(element) {
        // Parse size from inline style set by main.js
        const sizeStr = element.style.width;
        const diameter = parseInt(sizeStr) || 120;
        const radius = diameter / 2;
        const padding = 20;

        // Safer spawn area
        const safeWidth = window.innerWidth - diameter - padding * 2;
        const safeHeight = window.innerHeight - diameter - padding * 2;

        const bubble = {
            id: Math.random().toString(36).substr(2, 9),
            element: element,
            x: padding + Math.random() * safeWidth,
            y: padding + Math.random() * safeHeight,
            vx: (Math.random() - 0.5) * 1.5,
            vy: (Math.random() - 0.5) * 1.5,
            radius: radius,
            mass: radius, // simplistic mass
            isHovered: false,
            isDragging: false,
            phase: Math.random() * Math.PI * 2
        };

        // Attach Event Listeners to Element
        element.addEventListener('mousedown', (e) => {
            // Prevent text selection
            e.preventDefault();

            this.isDragging = true;
            this.draggedBubble = bubble;
            bubble.isDragging = true;

            // Offset to keep relative position
            this.dragOffsetX = bubble.x - e.clientX;
            this.dragOffsetY = bubble.y - e.clientY;
        });

        element.addEventListener('mouseenter', () => bubble.isHovered = true);
        element.addEventListener('mouseleave', () => bubble.isHovered = false);

        // Prevent click trigger if dragged (optional, might conflict with click to open, check main.js logic)
        // main.js has logic to open comments. We should ensure a drag doesn't count as a click if moved significantly.
        // For now, let's keep it simple.

        this.bubbles.push(bubble);
    }

    animate() {
        this.update();
        requestAnimationFrame(() => this.animate());
    }

    update() {
        // 1. Update positions & Apply Forces
        this.bubbles.forEach(b => {
            if (b.isDragging) return; // Skip physics for dragged bubble

            // Stop on Hover (Glow effect is CSS)
            if (b.isHovered) {
                b.vx *= 0.8; // Quick stop
                b.vy *= 0.8;
                if (Math.abs(b.vx) < 0.01) b.vx = 0;
                if (Math.abs(b.vy) < 0.01) b.vy = 0;

                // No random movement
            } else {
                // Natural Floating (Random Walk)
                b.vx += (Math.random() - 0.5) * PHYSICS.floatForce;
                b.vy += (Math.random() - 0.5) * PHYSICS.floatForce;

                // Smart Friction:
                // If moving fast (thrown), apply strong friction.
                // If moving slow (floating), apply weak friction to maintain drift.
                const currentSpeed = Math.sqrt(b.vx * b.vx + b.vy * b.vy);

                if (currentSpeed > 2) {
                    b.vx *= PHYSICS.friction;
                    b.vy *= PHYSICS.friction;
                } else {
                    b.vx *= PHYSICS.ambientFriction;
                    b.vy *= PHYSICS.ambientFriction;

                    // Boost if too slow to ensure perpetual motion
                    if (currentSpeed < PHYSICS.minSpeed) {
                        const angle = Math.random() * Math.PI * 2;
                        b.vx += Math.cos(angle) * 0.02;
                        b.vy += Math.sin(angle) * 0.02;
                    }
                }

                // Speed Limit
                const speed = Math.sqrt(b.vx * b.vx + b.vy * b.vy);
                if (speed > PHYSICS.maxSpeed) {
                    b.vx = (b.vx / speed) * PHYSICS.maxSpeed;
                    b.vy = (b.vy / speed) * PHYSICS.maxSpeed;
                }
            }

            b.x += b.vx;
            b.y += b.vy;

            // Wall Collisions
            this.handleWalls(b);
        });

        // 2. Resolve Collisions
        this.handleCollisions();

        // 3. Render
        this.bubbles.forEach(b => {
            // Breathing effect (scale)
            b.phase += 0.03;

            // Keep expanded if hovered OR dragged
            const isActive = b.isHovered || b.isDragging;
            const breathing = isActive ? 1.1 : 1 + Math.sin(b.phase) * 0.02;

            // Use transform
            b.element.style.transform = `translate(${b.x}px, ${b.y}px) scale(${breathing})`;

            // Manage Z-Index dynamically
            b.element.style.zIndex = isActive ? 1000 : 1;
        });
    }

    handleWalls(b) {
        let didBounce = false;
        const width = window.innerWidth;
        const height = window.innerHeight;
        const r = b.radius;

        if (b.x < 0) {
            b.x = 0;
            b.vx = Math.abs(b.vx) * PHYSICS.restitution;
            didBounce = true;
        } else if (b.x > width - r * 2) {
            b.x = width - r * 2;
            b.vx = -Math.abs(b.vx) * PHYSICS.restitution;
            didBounce = true;
        }

        if (b.y < 0) {
            b.y = 0;
            b.vy = Math.abs(b.vy) * PHYSICS.restitution;
            didBounce = true;
        } else if (b.y > height - r * 2) { // Allow some scroll overlap? No, screen bounds.
            b.y = height - r * 2;
            b.vy = -Math.abs(b.vy) * PHYSICS.restitution;
            didBounce = true;
        }
    }

    handleCollisions() {
        for (let i = 0; i < this.bubbles.length; i++) {
            for (let j = i + 1; j < this.bubbles.length; j++) {
                const b1 = this.bubbles[i];
                const b2 = this.bubbles[j];

                // Simple Circle Collision
                // Note: Position is top-left, center is +radius
                const c1x = b1.x + b1.radius;
                const c1y = b1.y + b1.radius;
                const c2x = b2.x + b2.radius;
                const c2y = b2.y + b2.radius;

                const dx = c2x - c1x;
                const dy = c2y - c1y;
                const dist = Math.sqrt(dx * dx + dy * dy);
                const minDist = b1.radius + b2.radius;

                if (dist < minDist) {
                    // Collision detected!

                    // 1. Resolve Overlap (push apart)
                    const angle = Math.atan2(dy, dx);
                    const overlap = minDist - dist;
                    const moveX = Math.cos(angle) * overlap * 0.5;
                    const moveY = Math.sin(angle) * overlap * 0.5;

                    if (!b1.isDragging && !b2.isDragging) {
                        b1.x -= moveX;
                        b1.y -= moveY;
                        b2.x += moveX;
                        b2.y += moveY;
                    } else if (b1.isDragging) {
                        b2.x += moveX * 2; // b2 moves away
                        b2.y += moveY * 2;
                    } else if (b2.isDragging) {
                        b1.x -= moveX * 2;
                        b1.y -= moveY * 2;
                    }

                    // 2. Exchange Velocity (Elastic)
                    // Normal vector
                    const nx = dx / dist;
                    const ny = dy / dist;

                    // Relative velocity
                    const dvx = b1.vx - b2.vx;
                    const dvy = b1.vy - b2.vy;

                    // Velocity along normal
                    const velAlongNormal = dvx * nx + dvy * ny;

                    // Do not resolve if velocities are separating
                    if (velAlongNormal > 0) continue;

                    // Impulse scalar
                    // j = -(1 + e) * v_rel . n / (1/m1 + 1/m2)
                    // Assuming equal mass density, mass proportional to radius (or area, let's use radius for stability)
                    const m1 = b1.mass;
                    const m2 = b2.mass;

                    // prevent division by zero or weirdness

                    let j = -(1 + PHYSICS.restitution) * velAlongNormal;
                    j /= (1 / m1 + 1 / m2);

                    // Apply impulse
                    const impulseX = j * nx;
                    const impulseY = j * ny;

                    if (!b1.isDragging) {
                        b1.vx -= impulseX / m1;
                        b1.vy -= impulseY / m1;
                    }
                    if (!b2.isDragging) {
                        b2.vx += impulseX / m2;
                        b2.vy += impulseY / m2;
                    }
                }
            }
        }
    }
}

// Global instance
window.bubbleSystem = new BubbleSystem();
