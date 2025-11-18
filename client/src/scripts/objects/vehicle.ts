import { Layer, ObjectCategory, STEERING_SCALE, ZIndexes } from "@common/constants";
import { type VehicleDefinition } from "@common/definitions/vehicle";
import { getEffectiveZIndex } from "@common/utils/layer";
import { FloorNames, FloorTypes } from "@common/utils/terrain"; // Import for floorType
import { type ObjectsNetData } from "@common/utils/objectsSerializations";
import { type Game } from "../game";
import { drawHitbox, SuroiSprite, toPixiCoords } from "../utils/pixi";
import { GameObject } from "./gameObject";
import type { Hitbox } from "@common/utils/hitbox";
import type { Orientation } from "@common/typings";
import { DIFF_LAYER_HITBOX_OPACITY, HITBOX_COLORS, HITBOX_DEBUG_MODE } from "../utils/constants";
import { Vec, type Vector } from "@common/utils/vector";
import { GAME_CONSOLE } from "../..";
import { random, randomFloat } from "@common/utils/random";
import { Geometry } from "@common/utils/math";
import type { GameSound } from "../managers/soundManager";


export class Vehicle extends GameObject.derive(ObjectCategory.Vehicle) {
    definition!: VehicleDefinition;
    readonly image: SuroiSprite;
    readonly wheels: SuroiSprite[] = [];
    floorType: FloorNames = FloorNames.Grass;
    hitbox!: Hitbox;
    bulletHitbox!: Hitbox;
    orientation: Orientation = 0;
    dead = false;
    damageable = true;

    distSinceLastFootstep = 0;
    distTraveled = 0;
    wheelstepSound?: GameSound;

    constructor(game: Game, id: number, data: ObjectsNetData[ObjectCategory.Vehicle]) {
        super(game, id);
        this.image = new SuroiSprite();
        this.container.addChild(this.image);
        for (let i = 0; i < 4; i++) {
            const wheel = new SuroiSprite("basic_wheel")
                .setScale(0.8) // Adjust size (e.g., 0.8 for smaller wheels)
            // .setZIndex(-1); // Behind main body
            this.wheels.push(wheel);
            this.container.addChild(wheel); // Add to container (rotates/scales with vehicle)
        }
        this.updateFromData(data, true);
    }

    override updateFromData(data: ObjectsNetData[ObjectCategory.Vehicle], isNew = false): void {
        // Compute floorType like Player/Obstacle (fixes doOverlay)
        const floorType = this.game.map.terrain.getFloor(this.position, this.layer, this.game.gameMap);
        this.floorType = floorType; // Cache for doOverlay/zIndex
        const oldPosition = Vec.clone(this.position);
        this.position = data.position;
        this.rotation = data.rotation;
        const game = this.game;

        // console.log("Vehicle rotation: ", data.rotation);
        // Handle definition (from full on spawn/update)
        if (data.full?.definition) {
            this.layer = data.full.layer;
            this.definition = data.full.definition;
            if (this.definition && this.definition.wheels) {
                const wheelConfig = this.definition.wheels;
                // Create missing wheels (one-time or on change)
                while (this.wheels.length < wheelConfig.length) {
                    const wheel = new SuroiSprite("basic_wheel")
                        .setZIndex(ZIndexes.Ground); // Default; overridden below
                    this.container.addChild(wheel);
                    this.wheels.push(wheel);
                }
                // Position/scale/zIndex each
                wheelConfig.forEach((config, i) => {
                    if (i < this.wheels.length) {
                        const wheel = this.wheels[i];
                        // Offset scaled by vehicle scale
                        wheel.position.copyFrom(Vec.scale(config.offset, this.definition.scale));
                        // Per-wheel scale
                        wheel.scale.set(config.scale);
                        // Per-wheel zIndex
                        wheel.zIndex = getEffectiveZIndex(config.zIndex, this.layer, this.game.layer);
                        // Visible unless dead
                        wheel.visible = !this.dead;
                    }
                });

            } else {
                // No config: Hide all
                this.wheels.forEach(wheel => wheel.visible = false);
            }
            this.dead = data.full.dead ?? false; // From partial
            if (this.dead) this.wheels.forEach(wheel => wheel.visible = false);
        }

        let texture: string | undefined;
        texture = !this.dead
            ? this.definition.idString // Normal: "vehicles/buggy"
            : `${this.definition.idString}_residue`; // Destroyed: "vehicles/buggy_residue"
        if (texture) {
            this.image.setFrame(texture);
        }

        this.hitbox = this.definition.hitbox.transformRotate(this.position, this.definition.scale, this.rotation);
        this.bulletHitbox = this.definition.bulletHitbox.transformRotate(this.position, this.definition.scale, this.rotation);

        // Position/rotate
        const noMovementSmoothing = !GAME_CONSOLE.getBuiltInCVar("cv_movement_smoothing");
        if (noMovementSmoothing || isNew) {
            this.container.position.copyFrom(toPixiCoords(this.position));
            this.container.rotation = this.rotation;
        }

        // Visibility: Like Obstacle—hide only on layer mismatch (prevents close-range overwrite)

        // Update front wheels steering angle (relative to vehicle body)
        // Back wheels remain aligned with vehicle body (rotation = 0 relative)
        const quantizedAngle = data.steeringAngle;
        const steeringAngle = quantizedAngle / STEERING_SCALE; // Dequantize to radians
        // Front wheels: steer relative to body
        this.wheels[0].rotation = steeringAngle; // Front-left
        this.wheels[1].rotation = steeringAngle; // Front-right
        if (this.wheels.length > 2) {
            this.wheels[2].rotation = 0; // Rear-left aligned
            this.wheels[3].rotation = 0; // Rear-right aligned
        }

        if (oldPosition !== undefined) {
            this.distSinceLastFootstep += Geometry.distance(oldPosition, this.position);
            this.distTraveled += Geometry.distance(oldPosition, this.position);

            if (this.distSinceLastFootstep > 10) {
                this.wheelstepSound = this.playSound(
                    `${this.floorType}_step_${random(1, 2)}`,
                    {
                        falloff: 0.6,
                        maxRange: 48
                    }
                );

                this.distSinceLastFootstep = 0;

                if (FloorTypes[floorType].particles && this.layer >= Layer.Ground) {
                    const scaleFactor = 20;
                    for (let i = 0; i < this.wheels.length && i < 4; i++) {
                        const wheelLocalPos = this.wheels[i].position;
                        const offsetGame = Vec.scale(Vec.create(wheelLocalPos.x, wheelLocalPos.y), 1 / scaleFactor);
                        const wheelWorldPos = Vec.add(this.position, Vec.rotate(offsetGame, this.rotation));

                        const options = {
                            frames: "ripple_particle",
                            zIndex: ZIndexes.Ground,
                            position: wheelWorldPos,
                            lifetime: 1000,
                            layer: this.layer,
                            speed: Vec.create(0, 0)
                        };

                        // outer
                        game.particleManager.spawnParticle({
                            ...options,
                            scale: {
                                start: randomFloat(0.45, 0.55),
                                end: randomFloat(2.95, 3.05)
                            },
                            alpha: {
                                start: randomFloat(0.55, 0.65),
                                end: 0
                            }
                        });

                        // inner
                        game.particleManager.spawnParticle({
                            ...options,
                            scale: {
                                start: randomFloat(0.15, 0.35),
                                end: randomFloat(1.45, 1.55)
                            },
                            alpha: {
                                start: randomFloat(0.25, 0.35),
                                end: 0
                            }
                        });
                    }
                }
            }
        }


        this.updateZIndex();
        this.updateDebugGraphics();
    }

    override updateZIndex(): void {
        const baseZIndex = this.definition?.zIndex ?? ZIndexes.Vehicles ?? ZIndexes.ObstaclesLayer1;
        const zIndex = FloorTypes[this.floorType].overlay
            ? this.dead
                ? ZIndexes.UnderWaterDeadObstacles
                : ZIndexes.UnderWaterObstacles // Assuming ZIndexes has UnderWaterObstacles; if not, use ZIndexes.UnderwaterPlayers - 1 or adjust accordingly
            : this.dead
                ? ZIndexes.DeadObstacles
                : baseZIndex;
        this.container.zIndex = getEffectiveZIndex(zIndex, this.layer, this.game.layer);
    }

    override destroy(): void {
        this.image.destroy();
        this.wheels.forEach(wheel => wheel.destroy());
        super.destroy();
    }
    override updateDebugGraphics(): void {
        if (!HITBOX_DEBUG_MODE) return;
        const ctx = this.debugGraphics;
        ctx.clear();
        const alpha = this.game.activePlayer !== undefined && this.layer === this.game.activePlayer.layer
            ? 1
            : DIFF_LAYER_HITBOX_OPACITY;
        drawHitbox(
            this.hitbox,
            this.dead ? HITBOX_COLORS.obstacleNoCollision : HITBOX_COLORS.obstacle, // Vehicle color
            this.debugGraphics,
            alpha
        );
        drawHitbox(
            this.bulletHitbox,
            this.dead ? HITBOX_COLORS.obstacleNoCollision : HITBOX_COLORS.obstacleNoCollision, // Vehicle color
            this.debugGraphics,
            alpha
        );
    }
    interact(): void {
        console.log(`Interacted with vehicle: ${this.definition.idString}`); // Expand: e.g., enter vehicle logic
    }
    canInteract(player: any): boolean { // 'any' for Player type—fix import if needed
        return !this.dead;
    }
    hitEffect(position: Vector, angle: number): void {
        // if (this.definition.noHitEffect) return;
        // if (!this.definition.hitSoundVariations) this.hitSound?.stop();
        // const { material } = this.definition;
        // this.hitSound = this.game.soundManager.play(
        // `${MaterialSounds[material]?.hit ?? material}_hit_${this.definition.hitSoundVariations ? random(1, this.definition.hitSoundVariations) : randomBoolean() ? "1" : "2"}`,
        // {
        // position,
        // falloff: 0.2,
        // maxRange: 96,
        // layer: this.layer
        // }
        // );
        // this.game.particleManager.spawnParticle({
        // frames: this.particleFrames,
        // position,
        // zIndex: Numeric.max((this.definition.zIndex ?? ZIndexes.Players) + 1, 4),
        // lifetime: 600,
        // layer: this.layer,
        // scale: { start: 0.9, end: 0.2 },
        // alpha: { start: 1, end: 0.65 },
        // speed: Vec.fromPolar((angle + randomFloat(-0.3, 0.3)), randomFloat(2.5, 4.5))
        // });
    }
}