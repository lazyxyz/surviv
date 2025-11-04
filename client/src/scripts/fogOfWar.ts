import { Application, BlurFilter, Graphics, Rectangle, SCALE_MODES, Sprite } from 'pixi.js';
import type { Camera } from './rendering/camera';

export class FogOfWar {
    private readonly pixi: Application;
    private readonly camera: Camera;
    private maskSprite?: Sprite;

    constructor(pixi: Application, camera: Camera) {
        this.pixi = pixi;
        this.camera = camera;
    }

    init(): void {
        const radius = 300;
        const blurSize = 50;

        const circle = new Graphics()
            .circle(radius + blurSize, radius + blurSize, radius)
            .fill({ color: 0xff0000, alpha: 0.95 });

        circle.filters = [new BlurFilter(blurSize)];

        const bounds = new Rectangle(
            0,
            0,
            (radius + blurSize) * 2,
            (radius + blurSize) * 2
        );
        const texture = this.pixi.renderer.generateTexture({
            target: circle,
            style: { scaleMode: SCALE_MODES.NEAREST },
            resolution: 1,
            frame: bounds
        });
        this.maskSprite = new Sprite(texture);
        this.maskSprite.anchor.set(0.5);

        this.pixi.stage.addChild(this.maskSprite);
        this.camera.container.mask = this.maskSprite;
    }

    resize(): void {
        if (this.maskSprite) {
            this.maskSprite.x = this.pixi.screen.width / 2;
            this.maskSprite.y = this.pixi.screen.height / 2;
        }
    }
    destroy(): void {
        if (this.maskSprite) {
            this.pixi.stage.removeChild(this.maskSprite);
            this.maskSprite.destroy();
            this.maskSprite = undefined;
            this.camera.container.mask = null;
        }
    }
}
