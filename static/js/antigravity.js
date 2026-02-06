// Physics Configuration
const isMobile = window.innerWidth < 768;

const PHYSICS = {
    friction: isMobile ? 0.92 : 0.96,
    ambientFriction: isMobile ? 0.98 : 0.995,
    restitution: 0.7,
    floatForce: isMobile ? 0.04 : 0.08,
    maxSpeed: isMobile ? 3 : 6,                // Slightly lower max speed for stability
    minSpeed: 0.4,
    throwMultiplier: isMobile ? 1.0 : 1.5,
    dampening: 0.95,
    repulsionForce: 1.2                        // NEW: Global repulsion multiplier
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
        this.initShakeDetection();
        this.animate();
    }

    initShakeDetection() {
        if (!isMobile || !window.DeviceMotionEvent) return;

        this.lastShakeTime = 0;
        this.lastX = null;
        this.lastY = null;
        this.lastZ = null;

        // Passive listener for performance
        window.addEventListener('devicemotion', (e) => this.handleShake(e), { passive: true });

        this.showDiscoveryHint();
    }

    showDiscoveryHint() {
        if (localStorage.getItem('shakeHintShown')) return;

        setTimeout(() => {
            const hint = document.createElement('div');
            hint.innerText = "💡 Bro, shake your phone to move the clouds!";
            Object.assign(hint.style, {
                position: 'fixed',
                bottom: '80px',
                left: '50%',
                transform: 'translateX(-50%)',
                background: 'rgba(56, 189, 248, 0.9)',
                color: '#000',
                padding: '10px 20px',
                borderRadius: '20px',
                fontWeight: 'bold',
                zIndex: '10000',
                boxShadow: '0 0 15px rgba(56, 189, 248, 0.4)',
                pointerEvents: 'none',
                opacity: '0',
                transition: 'opacity 0.5s',
                width: 'max-content',
                maxWidth: '90%',
                textAlign: 'center'
            });
            document.body.appendChild(hint);

            // Fade in
            requestAnimationFrame(() => hint.style.opacity = '1');

            // Remove after 4s
            setTimeout(() => {
                hint.style.opacity = '0';
                setTimeout(() => hint.remove(), 500);
                localStorage.setItem('shakeHintShown', 'true');
            }, 4000);
        }, 1500); // Wait 1.5s after load
    }

    handleShake(e) {
        const now = Date.now();
        // Rate limit to prevent chaos (200ms cooldown for more responsiveness)
        if (now - this.lastShakeTime < 200) return;

        const acc = e.accelerationIncludingGravity;
        if (!acc) return;

        const currentX = acc.x;
        const currentY = acc.y;
        const currentZ = acc.z;

        if (this.lastX === null) {
            this.lastX = currentX;
            this.lastY = currentY;
            this.lastZ = currentZ;
            return;
        }

        const deltaX = Math.abs(this.lastX - currentX);
        const deltaY = Math.abs(this.lastY - currentY);
        const deltaZ = Math.abs(this.lastZ - currentZ);

        // Threshold for "Shake" (sensitivity)
        if ((deltaX + deltaY + deltaZ) > 5) { // Ultra sensitive
            this.lastShakeTime = now;
            this.applyShakeForce();
        }

        this.lastX = currentX;
        this.lastY = currentY;
        this.lastZ = currentZ;
    }

    applyShakeForce() {
        this.bubbles.forEach(b => {
            // Stronger random impulse for fun scatter
            const force = 80; // Insane force
            b.vx += (Math.random() - 0.5) * force;
            b.vy += (Math.random() - 0.5) * force;
        });
    }

    initInteraction() {
        // Mouse Events
        document.addEventListener('mousemove', (e) => this.handleMove(e.clientX, e.clientY));

        document.addEventListener('mouseup', () => this.handleEnd());

        // Touch Events
        document.addEventListener('touchmove', (e) => {
            if (this.isDragging) e.preventDefault(); // Stop scroll when dragging
            const touch = e.touches[0];
            this.handleMove(touch.clientX, touch.clientY);
        }, { passive: false });

        document.addEventListener('touchend', () => this.handleEnd());
    }

    handleMove(x, y) {
        this.prevMouseX = this.mouseX;
        this.prevMouseY = this.mouseY;
        this.mouseX = x;
        this.mouseY = y;

        if (this.isDragging && this.draggedBubble) {
            this.draggedBubble.x = this.mouseX + this.dragOffsetX;
            this.draggedBubble.y = this.mouseY + this.dragOffsetY;
            this.draggedBubble.vx = 0;
            this.draggedBubble.vy = 0;
        }
    }

    handleEnd() {
        if (this.isDragging && this.draggedBubble) {
            const dx = this.mouseX - this.prevMouseX;
            const dy = this.mouseY - this.prevMouseY;

            this.draggedBubble.vx = dx * PHYSICS.throwMultiplier;
            this.draggedBubble.vy = dy * PHYSICS.throwMultiplier;

            this.draggedBubble.element.classList.remove('touch-active'); // Remove glow
            this.draggedBubble.isDragging = false;
            this.draggedBubble = null;
            this.isDragging = false;
        }
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
        const startDrag = (e, clientX, clientY) => {
            // Prevent text selection
            if (e.type === 'mousedown') e.preventDefault();
            // For touch, we might want to allow default if we're not sure, 
            // but for a game-like element, preventing default is usually safer to avoid ghost clicks/scroll.

            this.isDragging = true;
            this.draggedBubble = bubble;
            bubble.isDragging = true;

            // Immediate visual feedback
            element.classList.add('touch-active');

            // Update mouse pos immediately to avoid jump
            this.mouseX = clientX;
            this.mouseY = clientY;
            this.prevMouseX = clientX;
            this.prevMouseY = clientY;

            this.dragOffsetX = bubble.x - clientX;
            this.dragOffsetY = bubble.y - clientY;
        };

        element.addEventListener('mousedown', (e) => startDrag(e, e.clientX, e.clientY));

        element.addEventListener('touchstart', (e) => {
            const touch = e.touches[0];
            startDrag(e, touch.clientX, touch.clientY);
        }, { passive: false });

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
                        const pushForce = PHYSICS.repulsionForce;
                        b1.x -= moveX * pushForce;
                        b1.y -= moveY * pushForce;
                        b2.x += moveX * pushForce;
                        b2.y += moveY * pushForce;
                    } else if (b1.isDragging) {
                        b2.x += moveX * 2.5; // b2 moves away even faster when dragged
                        b2.y += moveY * 2.5;
                    } else if (b2.isDragging) {
                        b1.x -= moveX * 2.5;
                        b1.y -= moveY * 2.5;
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
