import * as PIXI from "pixi.js";

class RainDrop {
    graphics: PIXI.Graphics;
    length = 0;
    speed = 0;
    // opacity = 0;

    private readonly screenWidth: number;
    private readonly screenHeight: number;

    constructor(screenWidth: number, screenHeight: number) {
        this.graphics = new PIXI.Graphics();
        this.screenWidth = screenWidth;
        this.screenHeight = screenHeight;
        this.reset();
    }

    draw(): void {
        this.graphics.clear();
        this.graphics
            .moveTo(0, 0)
            .lineTo(0, this.length)
            .stroke({ width: 1, color: 0xffffff, alpha: 0.2 });
    }

    reset(): void {
        this.graphics.x = Math.random() * this.screenWidth - this.screenWidth / 2;
        this.graphics.y = Math.random() * -this.screenHeight - this.screenHeight / 2;
        this.length = Math.random() * 15 + 10;
        this.speed = Math.random() * 3 + 5;
        // this.opacity = Math.random() * 0.3 + 0.3;

        this.draw();
    }

    update(): void {
        this.graphics.y += this.speed;

        if (this.graphics.y > this.screenHeight / 2) {
            this.graphics.y = -this.length - this.screenHeight / 2 - (Math.random() * this.screenHeight / 2);
            this.graphics.x = Math.random() * this.screenWidth - this.screenWidth / 2;
        }
    }

    resize(screenWidth: number, screenHeight: number): void {
        // Update screen dimensions but keep current drop position valid
        this.screenWidth = screenWidth;
        this.screenHeight = screenHeight;
    }
}

export class RainEffect {
    private readonly rainDrops: RainDrop[] = [];
    readonly container: PIXI.Container;
    private screenWidth: number;
    private screenHeight: number;

    constructor(stage: PIXI.Container, screenWidth: number, screenHeight: number, numDrops = 300) {
        this.screenWidth = screenWidth;
        this.screenHeight = screenHeight;

        // Create a container for rain that can be easily shown/hidden
        this.container = new PIXI.Container();
        this.container.zIndex = Number.MAX_SAFE_INTEGER; // Render on top
        this.container.sortableChildren = true;
        stage.addChild(this.container);

        for (let i = 0; i < numDrops; i++) {
            const drop = new RainDrop(screenWidth, screenHeight);
            this.rainDrops.push(drop);
            this.container.addChild(drop.graphics);
        }
    }

    update(): void {
        for (const drop of this.rainDrops) {
            drop.update();
        }
    }

    updatePosition(cameraX: number, cameraY: number): void {
        // Position rain relative to camera
        this.container.x = cameraX;
        this.container.y = cameraY;
    }

    resize(screenWidth: number, screenHeight: number): void {
        this.screenWidth = screenWidth;
        this.screenHeight = screenHeight;

        for (const drop of this.rainDrops) {
            drop.resize(screenWidth, screenHeight);
        }
    }

    setVisible(visible: boolean): void {
        this.container.visible = visible;
    }

    destroy(): void {
        for (const drop of this.rainDrops) {
            drop.graphics.destroy();
        }
        this.rainDrops.length = 0;
        this.container.destroy();
    }
}