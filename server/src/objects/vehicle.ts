import { Layer, ObjectCategory, STEERING_SCALE } from "@common/constants";
import { Hitbox } from "@common/utils/hitbox";
import { BaseGameObject, DamageParams, GameObject } from "./gameObject";
import { SDeepMutable } from "@common/utils/misc";
import { FullData } from "@common/utils/objectsSerializations";
import { Vec, Vector } from "@common/utils/vector";
import { Game } from "../game";
import { SeatType, VehicleDefinition } from "@common/definitions/vehicle";
import { InventoryItem } from "../inventory/inventoryItem";
import { Player } from "./player";
import { Numeric } from "@common/utils/math";
import { materialMultipliers } from "../constants";

export class Vehicle extends BaseGameObject.derive(ObjectCategory.Vehicle) {
    override readonly fullAllocBytes = 20;
    override readonly partialAllocBytes = 10;

    declare hitbox: Hitbox;
    declare bulletHitbox: Hitbox;

    collidable: boolean = true;
    damageable: boolean = true;

    private _height = 1;
    health: number;

    // Vehicle physics state
    private velocity: Vector = Vec.create(0, 0); // Vector velocity for realistic direction/momentum
    private steeringAngle: number = 0;
    private wheelbase: number = 4;
    private occupants: (Player | undefined)[] = [];
    private frictionFactor; // Tune 0-1; higher=more slide reduction (real tire grip)
    private velocityThreshold = 0.0001; // Squared speed threshold for "moving" (fine-grained stop detection)
    private maxBounceDist = 0.5; // Max depenetration distance per step (prevents unrealistic far jumps)
    private baseDamage; // Base factor for collision damage calculation
    private deadImpact = 0.3; // When obstacle dies, reduce bounce/speed loss by 70% (plow through debris with less resistance)

    get height(): number { return this._height; }

    constructor(
        game: Game,
        readonly definition: VehicleDefinition,
        position: Vector,
        layer?: Layer,
        rotation?: number,
    ) {
        super(game, position);
        this.layer = layer ?? Layer.Ground;
        this.rotation = rotation ?? 0;

        // Initialize wheelbase based on wheel positions
        if (this.definition.wheels && this.definition.wheels.length >= 2) {
            let minY = Infinity, maxY = -Infinity;
            for (const w of this.definition.wheels) {
                minY = Math.min(minY, w.offset.y);
                maxY = Math.max(maxY, w.offset.y);
            }
            this.wheelbase = ((maxY - minY) / 20) * this.definition.scale;
        }

        // Initialize hitboxes
        this.updateHitboxes();

        // Initialize occupants array
        this.occupants = new Array(this.definition.seats.length).fill(undefined);

        this.health = this.definition.health;
        this.baseDamage = this.definition.baseDamage;
        this.frictionFactor = this.definition.frictionFactor;
    }

    canInteract(player: Player): boolean {
        return !this.dead;
    }

    interact(player: Player): void {
        const seatIndex = this.occupants.indexOf(player);
        if (seatIndex !== -1) {
            // Exit seat
            const seatOffset = this.definition.seats[seatIndex].offset;
            const rotatedSeatOffset = Vec.rotate(seatOffset, this.rotation);
            const exitOffset = Vec.rotate(this.definition.exitOffset, this.rotation); // Use definition's exitOffset (rotated)
            player.position = Vec.add(this.position, Vec.add(rotatedSeatOffset, exitOffset));
            player.inVehicle = undefined;
            player.seatIndex = undefined;
            this.occupants[seatIndex] = undefined;
            player.inventory.unlockAllSlots();
        } else {
            // Enter available seat (prefer driver if empty, else first available)
            let availableSeat = 0; // Driver by default
            player.inventory.lockAllSlots();
            if (this.occupants[0]) {
                availableSeat = this.occupants.findIndex(p => !p);
            }
            if (availableSeat !== -1 && availableSeat < this.occupants.length) {
                this.occupants[availableSeat] = player;
                player.inVehicle = this;
                player.seatIndex = availableSeat;
                this.updateOccupantPosition(player, availableSeat);
            }
        }
        this.setDirty();
        player.setDirty();
    }

    switchToNextEmptySeat(player: Player): void {
        const currentIndex = this.occupants.indexOf(player);
        let nextIndex = -1;

        // Search from currentIndex + 1 to the end
        for (let i = currentIndex + 1; i < this.occupants.length; i++) {
            if (!this.occupants[i]) {
                nextIndex = i;
                break;
            }
        }

        // If not found, search from 0 to currentIndex - 1
        if (nextIndex === -1) {
            for (let i = 0; i < currentIndex; i++) {
                if (!this.occupants[i]) {
                    nextIndex = i;
                    break;
                }
            }
        }

        // If an empty seat is found, switch to it
        if (nextIndex !== -1) {
            this.occupants[currentIndex] = undefined;
            this.occupants[nextIndex] = player;
            player.seatIndex = nextIndex;
            this.updateOccupantPosition(player, nextIndex);
            this.setDirty();
            player.setDirty();
        }
        // If no empty seat found, do nothing (stay in current seat)
    }

    private updateOccupantPosition(player: Player, seatIndex: number): void {
        const seatOffset = this.definition.seats[seatIndex].offset;
        const rotatedOffset = Vec.rotate(seatOffset, this.rotation);
        player.position = Vec.add(this.position, rotatedOffset);
        if (seatIndex == SeatType.Driver) player.rotation = this.rotation;
        player.layer = this.layer;
    }

    private enforceWorldBoundaries(): void {
        // Clamp position to map boundaries using approximate vehicle dimensions
        const rect = this.definition.hitbox.toRectangle();
        const halfWidth = (rect.width / 2) * this.definition.scale;
        const halfHeight = (rect.height / 2) * this.definition.scale;
        this.position.x = Numeric.clamp(this.position.x, halfWidth, this.game.map.width - halfWidth);
        this.position.y = Numeric.clamp(this.position.y, halfHeight, this.game.map.height - halfHeight);
    }

    private handleCollision(potential: GameObject): boolean {
        // Check if the potential object is collidable and intersects
        if (
            !(potential.isObstacle || potential.isBuilding || potential.isPlayer) ||
            (!potential.isPlayer && !potential.collidable) ||
            potential.dead ||
            !potential.hitbox
        ) {
            return false;
        }

        // Skip collision with own passengers
        if (potential.isPlayer && this.occupants.includes(potential as Player)) {
            return false;
        }

        if (this.hitbox.collidesWith(potential.hitbox)) {
            // Calculate adjustment to resolve penetration
            const adjust = this.hitbox.getAdjustment(potential.hitbox, 0.3); // Tune factor (0.5=half push, reduce if too far)
            // Clamp adjustment magnitude to prevent far jumps
            const adjustLen = Vec.length(adjust);
            if (adjustLen > this.maxBounceDist) {
                const clampedAdjust = Vec.scale(adjust, this.maxBounceDist / adjustLen);
                this.position = Vec.sub(this.position, clampedAdjust);
            } else {
                this.position = Vec.sub(this.position, adjust);
            }

            const speed = Vec.squaredLength(this.velocity);
            if (speed > 0.003) { // Threshold: only apply effects if fast enough
                const normal = Vec.normalizeSafe(adjust); // Direction of push (from obstacle to vehicle)
                const impactVel = Vec.dotProduct(this.velocity, normal); // Component along normal (negative if approaching)
                if (impactVel > 0.005) { // Approaching (threshold; note sign convention assuming dir points out)
                    let materialFactor = 1.0;
                    let inverseMaterialFactor = 1.0; // For obstacle damage (soft = high damage to obstacle)
                    if (potential.isPlayer) {
                        const damageToPlayer = ((Math.abs(impactVel) * 100) * this.baseDamage * inverseMaterialFactor) * 0.1;
                        potential.damage({
                            amount: damageToPlayer,
                            source: this,
                            weaponUsed: undefined,
                        });
                        potential._hitbox.resolveCollision(potential.hitbox);
                        return false;
                    } else if (potential.definition.material) {
                        const material = potential.definition.material;
                        materialFactor = materialMultipliers[material] ?? 1.0;
                        inverseMaterialFactor = 1 / materialFactor; // Higher for soft
                    }

                    const damageToVehicle = (Math.abs(impactVel) * 100) * this.baseDamage * materialFactor; // Align with speed^2
                    this.damage({
                        amount: Math.min(damageToVehicle, this.health * 0.1),
                        source: potential,
                        weaponUsed: undefined,
                    });

                    // Apply 5% of damageToVehicle to all occupants
                    const playerDamage = 0.05 * damageToVehicle;
                    for (const occupant of this.occupants) {
                        if (occupant) {
                            occupant.damage({
                                amount: playerDamage,
                                source: potential,
                                weaponUsed: undefined,
                            });
                        }
                    }

                    const damageToObstacle = (Math.abs(impactVel) * 100) * this.baseDamage * inverseMaterialFactor; // Higher for soft
                    potential.damage({
                        amount: damageToObstacle,
                        source: this,
                        weaponUsed: undefined,
                    });

                    // NEW: Check if obstacle died
                    let restitution = 0.1 * Math.min(1, Math.abs(impactVel) / 0.05); // Scale: full at high, zero at low
                    let speedLossFactor = 0.1 + (0.3 * materialFactor); // 0.6-0.9
                    if (potential.dead) { // If died from impact, reduce effects by 70% (less bounce, less speed loss = more penetration/continue)
                        restitution *= this.deadImpact;
                        speedLossFactor = 1 - (1 - speedLossFactor) * this.deadImpact;
                    }

                    // Bounce: reflect normal component with restitution
                    const bounceImpulse = -impactVel * (1 + restitution); // Positive to add back
                    this.velocity = Vec.add(this.velocity, Vec.scale(normal, bounceImpulse));

                    // Friction on tangent (for slicing/glancing)
                    const tangent = Vec.perpendicular(normal);
                    const tangentVel = Vec.dotProduct(this.velocity, tangent);
                    this.velocity = Vec.sub(this.velocity, Vec.scale(tangent, tangentVel * this.frictionFactor));

                    // Overall speed loss
                    this.velocity = Vec.scale(this.velocity, speedLossFactor);
                }
            } else {
                // Low speed: just stop completely
                this.velocity = Vec.create(0, 0);
            }

            return true;
        }
        return false;
    }

    private resolveCollisions(): void {
        const nearObjects = this.game.grid.intersectsHitbox(this.hitbox, this.layer);
        for (let step = 0; step < 10; step++) {
            let collided = false;
            for (const potential of nearObjects) {
                if (this.handleCollision(potential)) {
                    collided = true;
                }
            }
            if (!collided) break;
        }
        this.enforceWorldBoundaries();
    }

    private getInputs(): { inputForward: number; inputSteer: number } {
        // Compute inputs from driver (0 if no driver)
        const driver = this.occupants[0]; // Driver is always seat 0
        let inputForward = 0;
        let inputSteer = 0;
        if (driver && !this.dead) {
            const pm = driver.movement;
            if (driver.isMobile && pm.moving) {
                // Fixed: Remove +π/2 offset, compute pure relative angle to vehicle rotation (now facing right at 0°)
                let angleDiff = pm.angle - this.rotation;
                angleDiff = ((angleDiff + Math.PI) % (2 * Math.PI)) - Math.PI;
                inputForward = Math.cos(angleDiff);
                inputSteer = Math.sin(angleDiff);
            } else {
                // Keyboard: Assume relative (up=forward, left=steer left). No change needed here.
                inputForward = +pm.up - +pm.down;
                inputSteer = +pm.right - +pm.left; // right=+1 (will be negated below for correct turn)
            }
        }
        return { inputForward, inputSteer };
    }

    private applyAcceleration(dt: number, inputForward: number): void {
        // Accelerate along forward (or reverse)
        const forwardDir = Vec.fromPolar(this.rotation);
        const accel = this.definition.acceleration;
        const accelVec = Vec.scale(forwardDir, inputForward * accel * dt);
        this.velocity = Vec.add(this.velocity, accelVec);
    }

    private applyDrag(dt: number): void {
        // Drag (proportional to velocity)
        const drag = this.definition.drag;
        const dragFactor = Math.exp(-drag * dt);
        this.velocity = Vec.scale(this.velocity, dragFactor);
    }

    private applyLateralFriction(dt: number): void {
        // Lateral friction (reduce drift: stronger at low speeds)
        const lateralDrag = 1.5; // Tune: higher = less drift (real tire grip)
        const forwardDir = Vec.fromPolar(this.rotation);
        const sideDir = Vec.perpendicular(forwardDir);
        const sideVel = Vec.dotProduct(this.velocity, sideDir);
        this.velocity = Vec.sub(this.velocity, Vec.scale(sideDir, sideVel * Math.min(1, lateralDrag * dt)));
    }

    private clampSpeed(): void {
        // Clamp speed (along forward; allow lateral for drifts)
        const forwardDir = Vec.fromPolar(this.rotation);
        const maxSpeed = this.definition.maxSpeed;
        const maxReverseSpeed = maxSpeed * 0.5;
        const forwardSpeed = Vec.dotProduct(this.velocity, forwardDir);
        const clampedForward = Numeric.clamp(forwardSpeed, -maxReverseSpeed, maxSpeed);
        const forwardDiff = clampedForward - forwardSpeed;
        this.velocity = Vec.add(this.velocity, Vec.scale(forwardDir, forwardDiff));
    }

    private applySteering(dt: number, inputSteer: number): void {
        // Steering: Use forward component as 'speed' for turn rate
        const forwardDir = Vec.fromPolar(this.rotation);
        const forwardSpeed = Vec.dotProduct(this.velocity, forwardDir);
        const speedForTurn = forwardSpeed; // Positive for forward turn, negative for reverse (flips turn dir)
        const targetSteer = inputSteer * this.definition.maxSteerAngle;
        const maxSteerDelta = this.definition.steerRate * dt / 1000;
        this.steeringAngle += Numeric.clamp(targetSteer - this.steeringAngle, -maxSteerDelta, maxSteerDelta);
        const steerAngle = this.steeringAngle;
        let turnRate = (speedForTurn * Math.tan(steerAngle)) / this.wheelbase;
        this.rotation += turnRate * dt;
    }

    private updatePosition(dt: number): void {
        // Update position if velocity is above threshold
        if (Vec.squaredLength(this.velocity) > this.velocityThreshold) {
            this.position = Vec.add(this.position, Vec.scale(this.velocity, dt));
        }
    }

    private updateOccupants(isMoving: boolean): void {
        // Update all occupants' positions and states
        for (let i = 0; i < this.occupants.length; i++) {
            const player = this.occupants[i];
            if (player) {
                this.updateOccupantPosition(player, i);
                player.isMoving = isMoving;
                player.setPartialDirty();
                this.game.grid.updateObject(player);
            }
        }
    }

    update(): void {
        const dt = this.game.dt;
        const oldPosition = Vec.clone(this.position);

        const { inputForward, inputSteer } = this.getInputs();

        // Physics update (always, with 0 input if no driver)
        this.applyAcceleration(dt, inputForward);
        this.applyDrag(dt);
        this.applyLateralFriction(dt);
        this.clampSpeed();
        this.applySteering(dt, inputSteer);
        this.updatePosition(dt);

        this.resolveCollisions();

        // Update hitboxes
        this.updateHitboxes();

        // Determine if moving
        const isMoving = !Vec.equals(oldPosition, this.position) || Vec.squaredLength(this.velocity) > this.velocityThreshold;

        // Update all occupants (if any)
        this.updateOccupants(isMoving);

        // Update grid for vehicle if moving
        if (isMoving) {
            this.game.grid.updateObject(this);
        }

        this.setPartialDirty();

        // Early dead stop (optional: strong drag instead of hard stop)
        if (this.dead) {
            this.velocity = Vec.create(0, 0);
            this.steeringAngle = 0;
        }

        // Uncomment if you want boundary clamping (prevents going off-map)
        this.enforceWorldBoundaries();
    }

    private updateHitboxes(): void {
        this.hitbox = this.definition.hitbox.transformRotate(this.position, this.definition.scale, this.rotation);
        this.bulletHitbox = this.definition.bulletHitbox.transformRotate(this.position, this.definition.scale, this.rotation);
    }

    damage(params: DamageParams & { position?: Vector }): void {
        const definition = this.definition;
        const { amount, source, weaponUsed, position } = params;
        if (this.health <= 0) return;

        this.health -= amount;
        this.setPartialDirty();

        const notDead = this.health > 0 && !this.dead;
        if (!notDead) {
            this.health = 0;
            this.dead = true;
            this.collidable = false;
            const weaponIsItem = weaponUsed instanceof InventoryItem;
            if (definition.explosion !== undefined && source instanceof BaseGameObject) {
                this.game.addExplosion(definition.explosion, this.position, source, source.layer, weaponIsItem ? weaponUsed : weaponUsed?.weapon);
            }

            // Eject all occupants
            for (let i = 0; i < this.occupants.length; i++) {
                const occupant = this.occupants?.[i];
                if (occupant) {
                    occupant.exitVehicle();
                }
            }

            this.setDirty();
        }
    }

    override get data(): FullData<ObjectCategory.Vehicle> {
        const data: SDeepMutable<FullData<ObjectCategory.Vehicle>> = {
            position: this.position,
            rotation: this.rotation,
            steeringAngle: Math.round(this.steeringAngle * STEERING_SCALE), // Quantized to int (fits in int8)
            full: {
                definition: this.definition,
                layer: this.layer,
                dead: this.dead,
            }
        };
        return data;
    }
}