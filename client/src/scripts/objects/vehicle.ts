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
import { random, randomBoolean, randomFloat } from "@common/utils/random";
import { Geometry } from "@common/utils/math";
import type { GameSound } from "../managers/soundManager";
import { MaterialSounds } from "@common/definitions/obstacles";

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

    private health: number = 0;
    private speed: number = 0;
    private throttle: number = 0;
    private slip: number = 0;

    private distSinceLastFootstep = 0;
    private distTraveled = 0;

    private wheelstepSound?: GameSound;
    private engineSound?: GameSound;
    private skidSound?: GameSound;
    private brakeSound?: GameSound;
    private shiftSound?: GameSound;

    private hitSound?: GameSound;

    private hasDriver: boolean = false;

    // For gear shift detection
    private lastCheckTime: number = Date.now();
    private lastSpeed: number = 0;

    private wheelFrame: boolean = false;
    private distSinceLastWheelAnim: number = 0;
    private wheelAnimDistanceThreshold: number = 1;

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
            const wheel = new SuroiSprite("basic_wheel");
            this.wheels.push(wheel);
            this.container.addChild(wheel);
        }
    }

    override updateFromData(data: ObjectsNetData[ObjectCategory.Vehicle], isNew = false): void {
        const oldPosition = Vec.clone(this.position);
        this.updateFloorType();
        this.updatePartial(data, isNew);
        this.updateDefinitionAndState(data);
        this.updateHitboxes();
        this.updateWheelRotations(data);
        if (!isNew) {
            this.handleMovementEffects(oldPosition);
            this.updateSounds();
        }
        this.updateZIndex();
        this.updateDebugGraphics();

        const inVehicle = this.game.activePlayer?.inVehicle ?? false;
        this.game.uiManager.updateVehicleUI({
            inVehicle,
            health: this.health,
            maxHealth: this.definition.health,
            speed: this.speed,
            maxSpeed: this.definition.maxSpeed
        });
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
        this.health = data.health * VEHICLE_NETDATA.HEALTH_SCALE;

        const noMovementSmoothing = !GAME_CONSOLE.getBuiltInCVar("cv_movement_smoothing");
        if (noMovementSmoothing || isNew) {
            this.container.position.copyFrom(toPixiCoords(this.position));
            this.container.rotation = this.rotation;
        }

    }

    private updateSounds(): void {
        if (this.dead || !this.hasDriver) {
            this.stopAllVehicleSounds();
            return;
        }

        const maxSpeed = this.definition.maxSpeed;
        const speedNorm = Math.min(this.speed / maxSpeed, 1);  // 0-1 normalized
        const absThrottle = Math.abs(this.throttle);

        if (!this.engineSound || this.engineSound.ended) {
            this.engineSound = this.playSound(`${this.definition.base}_engine_loop`, {
                falloff: 0.5,
                maxRange: 200,
                layer: this.layer,
                loop: true,
                dynamic: true,
                ambient: false,
                onEnd: () => { this.engineSound = undefined; }
            });
        }
        if (this.engineSound?.instance) {
            // Pitch: low-speed = throttle-driven (revving), high-speed = speed-driven (cruising)
            const enginePitch = 0.6 + (absThrottle * 0.5) + (speedNorm * 1.2);
            this.engineSound.instance.speed = Math.max(0.4, Math.min(2.5, enginePitch));
        }

        // SKID/DRIFT LOOP (trigger on slip)
        if (this.slip > 0.04 && this.speed > 0.05) {
            if (!this.skidSound || this.skidSound.ended) {
                this.skidSound = this.playSound(`${this.definition.base}_skid_loop`, {
                    // position: this.position,
                    falloff: 0.8,
                    maxRange: 100,
                    layer: this.layer,
                    loop: true,
                    dynamic: true,
                    ambient: false,
                    onEnd: () => { this.skidSound = undefined; }
                });
            }
            if (this.skidSound?.instance) {
                const skidPitch = 0.7 + this.slip * 0.6;
                this.skidSound.instance.speed = Math.min(1.5, skidPitch);
                // Volume handled in dynamic update; optionally scale base volume here
            }
        } else if (this.skidSound) {
            this.skidSound.stop();
            this.skidSound = undefined;
        }

        // BRAKE SQUEAL (optional: hard brake only, blends with skid)
        if (this.throttle < -0.2 && this.speed > 0.04) {
            if (!this.brakeSound || this.brakeSound.ended) {
                this.brakeSound = this.playSound(`${this.definition.base}_brake_loop`, {
                    falloff: 0.7,
                    maxRange: 80,
                    layer: this.layer,
                    loop: true,
                    dynamic: true,
                    ambient: false,
                    onEnd: () => { this.brakeSound = undefined; }
                });
            }
            if (this.brakeSound?.instance) {
                const brakePitch = 1.0 + (this.speed / 10) * 0.5;
                this.brakeSound.instance.speed = Math.min(1.8, brakePitch);
            }
        } else if (this.brakeSound) {
            this.brakeSound.stop();
            this.brakeSound = undefined;
        }

        // Gear shift "pump" sound based on speed increase over time
        const now = Date.now();
        if (now - this.lastCheckTime >= 3000) { // Check every 3 seconds
            if (this.lastSpeed > 0) { // Avoid divide by zero
                const percentIncrease = ((this.speed - this.lastSpeed) / this.lastSpeed) * 100;
                if (percentIncrease > 20 && this.throttle > 0) { // e.g., >20% increase and accelerating
                    this.playShiftSound();
                }
            }
            this.lastSpeed = this.speed;
            this.lastCheckTime = now;
        }

        // Additional: Idle hum when stopped but throttle >0 (revving)
        if (this.speed < 0.2 && absThrottle > 0.1 && this.engineSound?.instance) {
            this.engineSound.instance.speed = 0.8 + absThrottle * 0.6;  // Rev pitch
        }

        // Ensure positions are updated for dynamic sounds
        if (this.engineSound) this.engineSound.position = this.position;
        if (this.skidSound) this.skidSound.position = this.position;
        if (this.brakeSound) this.brakeSound.position = this.position;
        if (this.shiftSound) this.shiftSound.position = this.position;
    }

    private playShiftSound(): void {
        if (!this.shiftSound || this.shiftSound.ended) {
            this.shiftSound = this.playSound(`${this.definition.base}_gear_shift`, {
                falloff: 0.6,
                maxRange: 150,
                layer: this.layer,
                loop: false,
                dynamic: true,
                ambient: false,
                onEnd: () => { this.shiftSound = undefined; }
            });
        }
    }

    private stopAllVehicleSounds(): void {
        [this.engineSound, this.skidSound, this.brakeSound, this.shiftSound, this.hitSound].forEach(sound => {
            sound?.stop();
        });
        this.engineSound = this.skidSound = this.brakeSound = this.shiftSound = this.hitSound = undefined;
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
            this.hasDriver = data.full.hasDriver ?? false;

            this.dead = data.full.dead ?? false;
            if (this.dead) {
                this.hideAllWheels();
            }

            this.updateTexture();
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
            ? `${this.definition.base}_residue`
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

    private updateWheelFrames(): void {
        for (let i = 0; i < this.wheels.length; i++) {
            this.wheels[i].setFrame(this.wheelFrame ? "basic_wheel_use" : "basic_wheel");
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
        this.distSinceLastWheelAnim += distanceMoved;

        if (this.distSinceLastFootstep > 10) {
            this.playWheelStepSound();
            this.distSinceLastFootstep = 0;
            this.spawnWheelParticles();
        }

        // Wheel animation: Toggle frame every X units traveled (only if moving and has driver)
        if (this.hasDriver && this.speed > 0 && this.distSinceLastWheelAnim > this.wheelAnimDistanceThreshold) {
            this.wheelFrame = !this.wheelFrame;
            this.updateWheelFrames();
            this.distSinceLastWheelAnim = 0;
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
        this.stopAllVehicleSounds();
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

    canInteract(player: any): boolean {
        return !this.dead;
    }

    hitEffect(position: Vector, angle: number): void {
        if (!this.definition.hitSoundVariations) this.hitSound?.stop();

        const { material } = this.definition;
        if (material)
            this.hitSound = this.game.soundManager.play(
                `${MaterialSounds[material]?.hit ?? material}_hit_${this.definition.hitSoundVariations ? random(1, this.definition.hitSoundVariations) : randomBoolean() ? "1" : "2"}`,
                {
                    position,
                    falloff: 0.2,
                    maxRange: 96,
                    layer: this.layer
                }
            );

        // this.game.particleManager.spawnParticle({
        //     frames: this.particleFrames,
        //     position,
        //     zIndex: Numeric.max((this.definition.zIndex ?? ZIndexes.Players) + 1, 4),
        //     lifetime: 600,
        //     layer: this.layer,
        //     scale: { start: 0.9, end: 0.2 },
        //     alpha: { start: 1, end: 0.65 },
        //     speed: Vec.fromPolar((angle + randomFloat(-0.3, 0.3)), randomFloat(2.5, 4.5))
        // });
    }
}