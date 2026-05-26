import '@testing-library/jest-dom/vitest';

// Glide Data Grid renders to <canvas> and observes size. jsdom implements
// neither, so provide minimal shims. The offscreen mirror table (not the
// canvas) is what we assert against, so a no-op 2D context is sufficient.
if (typeof globalThis.ResizeObserver === 'undefined') {
    globalThis.ResizeObserver = class {
        observe() {}
        unobserve() {}
        disconnect() {}
    } as unknown as typeof ResizeObserver;
}

if (typeof HTMLCanvasElement !== 'undefined') {
    const stub2d = () =>
        new Proxy(
            {
                measureText: () => ({ width: 0 }),
                save() {},
                restore() {},
                beginPath() {},
                closePath() {},
                fillRect() {},
                fillText() {},
                arc() {},
                arcTo() {},
                moveTo() {},
                lineTo() {},
                fill() {},
                stroke() {},
                scale() {},
                translate() {},
                setTransform() {},
                clearRect() {},
                rect() {},
                clip() {},
                createLinearGradient: () => ({ addColorStop() {} }),
            },
            {
                get(target, prop) {
                    return prop in target
                        ? (target as Record<string | symbol, unknown>)[prop]
                        : () => undefined;
                },
                set() {
                    return true;
                },
            },
        );
    HTMLCanvasElement.prototype.getContext = (() => stub2d()) as unknown as HTMLCanvasElement['getContext'];
}
