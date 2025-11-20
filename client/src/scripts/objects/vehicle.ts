// server/src/scripts/objects/vehicle.ts
import { Layer, ObjectCategory, VEHICLE_NETDATA, ZIndexes } from "@common/constants";
import { type VehicleDefinition } from "@common/definitions/vehicle";
import { getEffectiveZIndex } from "@common/utils/layer";
import { FloorNames, FloorTypes } from "@common/utils/terrain";
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

/**
 * Represents a vehicle game object in the frontend, handling rendering, updates, and effects.
 */
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

    private speed: number = 0;
    private throttle: number = 0;
    private slip: number = 0;

    private distSinceLastFootstep = 0;
    private distTraveled = 0;

    private wheelstepSound?: GameSound;
    private engineSound?: GameSound;
    private skidSound?: GameSound;
    private brakeSound?: GameSound;

    constructor(game: Game, id: number, data: ObjectsNetData[ObjectCategory.Vehicle]) {
        super(game, id);
        this.container.sortableChildren = true;
        this.image = new SuroiSprite();
        this.container.addChild(this.image);
        this.initializeWheels(4); // Initialize with 4 wheels by default
        this.updateFromData(data, true);
    }

    /**
     * Initializes the specified number of wheel sprites.
     * @param count Number of wheels to create.
     */
    private initializeWheels(count: number): void {
        for (let i = 0; i < count; i++) {
            const wheel = new SuroiSprite("basic_wheel").setScale(0.8);
            this.wheels.push(wheel);
            this.container.addChild(wheel);
        }
    }

    override updateFromData(data: ObjectsNetData[ObjectCategory.Vehicle], isNew = false): void {
        const oldPosition = Vec.clone(this.position);
        this.updateFloorType();
        this.updatePartial(data, isNew);
        this.updateDefinitionAndState(data);
        this.updateTexture();
        this.updateHitboxes();
        this.updateWheelRotations(data);
        if (!isNew) {
            this.handleMovementEffects(oldPosition);
        }
        this.updateZIndex();
        this.updateDebugGraphics();
    }

    /**
     * Updates the floor type based on current position and layer.
     */
    private updateFloorType(): void {
        this.floorType = this.game.map.terrain.getFloor(this.position, this.layer, this.game.gameMap);
    }

    /**
     * Updates the vehicle's position and rotation, applying smoothing if enabled.
     * @param data The network data.
     * @param isNew Whether this is a new object (no smoothing).
     */
    private updatePartial(data: ObjectsNetData[ObjectCategory.Vehicle], isNew: boolean): void {
        this.position = data.position;
        this.rotation = data.rotation;


        this.speed = data.speed / VEHICLE_NETDATA.SPEED_SCALE;
        this.slip = data.slip / VEHICLE_NETDATA.SLIP_SCALE;
        this.throttle = data.throttle / VEHICLE_NETDATA.THROTTLE_SCALE;

        const noMovementSmoothing = !GAME_CONSOLE.getBuiltInCVar("cv_movement_smoothing");
        if (noMovementSmoothing || isNew) {
            this.container.position.copyFrom(toPixiCoords(this.position));
            this.container.rotation = this.rotation;
        }
    }

    private updateSounds(): void {
        if (this.dead) {
            this.stopAllVehicleSounds();
            return;
        }

        const maxSpeed = this.definition.maxSpeed;
        const speedNorm = Math.min(this.speed / maxSpeed, 1);  // 0-1 normalized
        const absThrottle = Math.abs(this.throttle);

        // ENGINE LOOP (always attempt; vol=0 when idle)
        if (!this.engineSound) {
            this.engineSound = this.playSound("vehicle_engine_loop", {
                loop: true,
                falloff: 1.0,
                maxRange: 120,  // Tune based on map
            });
        }
        // Pitch: low-speed = throttle-driven (revving), high-speed = speed-driven (cruising)
        const enginePitch = 0.6 + (absThrottle * 0.5) + (speedNorm * 1.2);
        this.engineSound.pitch = Math.max(0.4, Math.min(2.5, enginePitch));
        // Volume: ramp with speed/throttle
        const engineVol = speedNorm * 0.7 + (absThrottle * 0.3 * (1 - speedNorm));
        this.engineSound.volume = Math.max(0, Math.min(1, engineVol));

        // SKID/DRIFT LOOP (trigger on slip)
        const skidThreshold = 0.15;  // Tune: ~8° slip angle
        if (this.slip > skidThreshold && this.speed > 0.5) {
            if (!this.skidSound) {
                this.skidSound = this.playSound("tire_skid_loop", {
                    loop: true,
                    falloff: 0.8,
                    maxRange: 80,
                    volume: 0
                });
            }
            const skidVol = ((this.slip - skidThreshold) / (1 - skidThreshold)) * (this.speed / 8) * 0.6;
            this.skidSound.volume = Math.min(1, skidVol);
            this.skidSound.pitch = 0.7 + this.slip * 0.6;
        } else if (this.skidSound) {
            this.skidSound.stop();
            this.skidSound = undefined;
        }

        // BRAKE SQUEAL (optional: hard brake only, blends with skid)
        if (this.throttle < -0.2 && this.speed > 1.5) {
            if (!this.brakeSound) {
                this.brakeSound = this.playSound("brake_squeal_loop", {
                    loop: true,
                    falloff: 0.7,
                    maxRange: 60,
                    volume: 0
                });
            }
            const brakeVol = (-this.throttle * 0.5) * (this.speed / 10);
            this.brakeSound.volume = Math.min(0.8, brakeVol);
            this.brakeSound.pitch = 1.0 + (this.speed / 10) * 0.5;
        } else if (this.brakeSound) {
            this.brakeSound.stop();
            this.brakeSound = undefined;
        }
    }

    private stopAllVehicleSounds(): void {
        [this.engineSound, this.skidSound, this.brakeSound].forEach(sound => {
            sound?.stop();
        });
        this.engineSound = this.skidSound = this.brakeSound = undefined;
    }

    /**
     * Updates the vehicle definition, layer, dead state, and configures wheels if provided.
     * @param data The network data.
     */
    private updateDefinitionAndState(data: ObjectsNetData[ObjectCategory.Vehicle]): void {
        if (data.full?.definition) {
            this.layer = data.full.layer;
            this.definition = data.full.definition;
            const wheelConfig = this.definition.wheels;
            if (wheelConfig) {
                this.configureWheels(wheelConfig);
            } else {
                this.hideAllWheels();
            }
            this.dead = data.full.dead ?? false;
            if (this.dead) {
                this.hideAllWheels();
            }
        }
    }

    /**
     * Configures wheels based on the definition, creating additional wheels if needed.
     * @param wheelConfig Array of wheel configurations.
     */
    private configureWheels(wheelConfig: VehicleDefinition["wheels"]): void {
        while (this.wheels.length < wheelConfig.length) {
            const wheel = new SuroiSprite("basic_wheel").setZIndex(ZIndexes.Ground);
            this.container.addChild(wheel);
            this.wheels.push(wheel);
        }
        wheelConfig.forEach((config, i) => {
            if (i < this.wheels.length) {
                const wheel = this.wheels[i];
                wheel.position.copyFrom(Vec.scale(config.offset, this.definition.scale));
                wheel.scale.set(config.scale);
                wheel.visible = !this.dead;
            }
        });
    }

    /**
     * Hides all wheel sprites.
     */
    private hideAllWheels(): void {
        this.wheels.forEach(wheel => (wheel.visible = false));
    }

    /**
     * Updates the vehicle's texture based on dead state.
     */
    private updateTexture(): void {
        const texture = this.dead
            ? `${this.definition.idString}_residue`
            : this.definition.idString;
        this.image.setFrame(texture);
    }

    /**
     * Updates the hitboxes based on current position, scale, and rotation.
     */
    private updateHitboxes(): void {
        this.hitbox = this.definition.hitbox.transformRotate(this.position, this.definition.scale, this.rotation);
        this.bulletHitbox = this.definition.bulletHitbox.transformRotate(this.position, this.definition.scale, this.rotation);
    }

    /**
     * Updates wheel rotations based on steering angle.
     * Assumes wheels[0/1] are front, wheels[2/3] are rear.
     * @param data The network data.
     */
    private updateWheelRotations(data: ObjectsNetData[ObjectCategory.Vehicle]): void {
        const quantizedAngle = data.steeringAngle;
        const steeringAngle = quantizedAngle / VEHICLE_NETDATA.STEERING_SCALE;
        this.wheels[0].rotation = steeringAngle; // Front-left
        this.wheels[1].rotation = steeringAngle; // Front-right
        if (this.wheels.length > 2) {
            this.wheels[2].rotation = 0; // Rear-left
            this.wheels[3].rotation = 0; // Rear-right
        }
    }

    /**
     * Handles movement-related effects like sounds and particles.
     * @param oldPosition The previous position.
     */
    private handleMovementEffects(oldPosition: Vector): void {
        const distanceMoved = Geometry.distance(oldPosition, this.position);
        this.distSinceLastFootstep += distanceMoved;
        this.distTraveled += distanceMoved;

        if (this.distSinceLastFootstep > 10) {
            this.playWheelStepSound();
            this.distSinceLastFootstep = 0;
            this.spawnWheelParticles();
        }
    }

    /**
     * Plays the wheel step sound based on floor type.
     */
    private playWheelStepSound(): void {
        this.wheelstepSound = this.playSound(
            `${this.floorType}_step_${random(1, 2)}`,
            {
                falloff: 0.6,
                maxRange: 48
            }
        );
    }

    /**
     * Spawns ripple particles at each wheel position if conditions are met.
     */
    private spawnWheelParticles(): void {
        if (FloorTypes[this.floorType].particles && this.layer >= Layer.Ground) {
            const scaleFactor = 20; // Adjust based on game unit to pixel ratio
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

                // Outer particle
                this.game.particleManager.spawnParticle({
                    ...options,
                    scale: { start: randomFloat(0.45, 0.55), end: randomFloat(2.95, 3.05) },
                    alpha: { start: randomFloat(0.55, 0.65), end: 0 }
                });

                // Inner particle
                this.game.particleManager.spawnParticle({
                    ...options,
                    scale: { start: randomFloat(0.15, 0.35), end: randomFloat(1.45, 1.55) },
                    alpha: { start: randomFloat(0.25, 0.35), end: 0 }
                });
            }
        }
    }

    private updateWheelZIndexes(): void {
        if (!this.definition?.wheels) return;
        this.definition.wheels.forEach((config, i) => {
            if (i < this.wheels.length) {
                this.wheels[i].zIndex = getEffectiveZIndex(config.zIndex, this.layer, this.game.layer);
            }
        });
    }

    override updateZIndex(): void {
        const baseZIndex = this.definition?.zIndex ?? ZIndexes.Vehicles ?? ZIndexes.ObstaclesLayer1;
        const zIndex = FloorTypes[this.floorType].overlay
            ? this.dead
                ? ZIndexes.UnderWaterDeadObstacles
                : ZIndexes.UnderWaterObstacles
            : this.dead
                ? ZIndexes.DeadObstacles
                : baseZIndex;
        const effectiveZIndex = getEffectiveZIndex(zIndex, this.layer, this.game.layer);
        this.container.zIndex = effectiveZIndex;
        this.image.zIndex = getEffectiveZIndex(baseZIndex, this.layer, this.game.layer);
        this.updateWheelZIndexes();
    }

    override destroy(): void {
        this.image.destroy();
        this.wheels.forEach(wheel => wheel.destroy());
        super.destroy();
    }

    override updateDebugGraphics(): void {
        if (!HITBOX_DEBUG_MODE) return;
        this.debugGraphics.clear();
        const alpha = this.game.activePlayer !== undefined && this.layer === this.game.activePlayer.layer
            ? 1
            : DIFF_LAYER_HITBOX_OPACITY;
        drawHitbox(
            this.hitbox,
            this.dead ? HITBOX_COLORS.obstacleNoCollision : HITBOX_COLORS.obstacle,
            this.debugGraphics,
            alpha
        );
        drawHitbox(
            this.bulletHitbox,
            this.dead ? HITBOX_COLORS.obstacleNoCollision : HITBOX_COLORS.player,
            this.debugGraphics,
            alpha
        );
        if (this.definition.spawnHitbox) {
            drawHitbox(
                this.definition.spawnHitbox.transform(this.position, 1, this.orientation),
                HITBOX_COLORS.spawnHitbox,
                this.debugGraphics,
                alpha
            );
        }
    }

    interact(): void {
        console.log(`Interacted with vehicle: ${this.definition.idString}`);
    }

    canInteract(player: any): boolean {
        return !this.dead;
    }

    hitEffect(position: Vector, angle: number): void {
        // TODO: Implement hit effects (sounds, particles) if needed
        // Currently commented out in original code
    }
}