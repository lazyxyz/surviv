import { Layer, ObjectCategory, STEERING_SCALE } from "@common/constants";
import { Hitbox } from "@common/utils/hitbox";
import { BaseGameObject, DamageParams } from "./gameObject";
import { SDeepMutable } from "@common/utils/misc";
import { FullData } from "@common/utils/objectsSerializations";
import { Vec, Vector } from "@common/utils/vector";
import { Game } from "../game";
import { SeatType, VehicleDefinition } from "@common/definitions/vehicle";
import { InventoryItem } from "../inventory/inventoryItem";
import { Player } from "./player";
import { Numeric } from "@common/utils/math";
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
    private currentSpeed: number = 0;
    private steeringAngle: number = 0;
    private wheelbase: number;
    private occupants: (Player | undefined)[] = [];
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
        
        // Initialize wheelbase
        if (this.definition.wheels && this.definition.wheels.length >= 2) {
            let minY = Infinity, maxY = -Infinity;
            for (const w of this.definition.wheels) {
                minY = Math.min(minY, w.offset.y);
                maxY = Math.max(maxY, w.offset.y);
            }
            this.wheelbase = ((maxY - minY) / 20) * this.definition.scale;
        } else {
            this.wheelbase = this.definition.hitbox.toRectangle().height * 0.8;
        }
        // Initialize hitboxes
        this.updateHitboxes();
        // Initialize occupants array
        this.occupants = new Array(this.definition.seats.length).fill(undefined);
        this.health = this.definition.health;
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

    private updateOccupantPosition(player: Player, seatIndex: number): void {
        const seatOffset = this.definition.seats[seatIndex].offset;
        const rotatedOffset = Vec.rotate(seatOffset, this.rotation);
        player.position = Vec.add(this.position, rotatedOffset);
        if (seatIndex == SeatType.Driver) player.rotation = this.rotation;
        player.layer = this.layer;
    }

    private enforceWorldBoundaries(): void {
        const rect = this.definition.hitbox.toRectangle();
        const halfWidth = (rect.width / 2) * this.definition.scale;
        const halfHeight = (rect.height / 2) * this.definition.scale;
        this.position.x = Numeric.clamp(this.position.x, halfWidth, this.game.map.width - halfWidth);
        this.position.y = Numeric.clamp(this.position.y, halfHeight, this.game.map.height - halfHeight);
    }

    update(): void {
        const dt = this.game.dt;
        const driver = this.occupants[0]; // Driver is always seat 0

        // Compute inputs (0 if no driver)
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
                inputSteer = +pm.right - +pm.left;  // right=+1 (will be negated below for correct turn)
            }
        }

        const oldPosition = Vec.clone(this.position);

        // Physics update (always, with 0 input if no driver)
        const accel = this.definition.acceleration;
        const drag = this.definition.drag;
        const maxSpeed = this.definition.maxSpeed;
        const maxReverseSpeed = maxSpeed * 0.5;
        this.currentSpeed *= Math.exp(-drag * dt);
        this.currentSpeed += inputForward * accel * dt;
        this.currentSpeed = Numeric.clamp(this.currentSpeed, -maxReverseSpeed, maxSpeed);

        // Steering: FIXED - Negate to invert (right input → CW turn → right turn when facing right)
        const maxSteerRad = this.definition.turnSpeed;
        this.steeringAngle = inputSteer * maxSteerRad;  // Snaps/decays to 0 naturally with 0 input
        const steerAngle = this.steeringAngle;
        let turnRate = (this.currentSpeed * Math.tan(steerAngle)) / this.wheelbase;
        this.rotation += turnRate * dt;

        // Update position: FIXED - Remove -π/2 so rotation 0 faces right
        const forwardDir = Vec.fromPolar(this.rotation);  // Now 0° = right
        const velocity = Vec.scale(forwardDir, this.currentSpeed * dt);
        this.position = Vec.add(this.position, velocity);

        // Update hitboxes
        this.updateHitboxes();

        // Determine if moving
        const isMoving = !Vec.equals(oldPosition, this.position) || Math.abs(this.currentSpeed) > 0.01;

        // Update all occupants (if any)
        for (let i = 0; i < this.occupants.length; i++) {
            const player = this.occupants[i];
            if (player) {
                this.updateOccupantPosition(player, i);
                player.isMoving = isMoving;
                player.setPartialDirty();
                this.game.grid.updateObject(player);
            }
        }

        // Update grid for vehicle if moving
        if (isMoving) {
            this.game.grid.updateObject(this);
        }

        this.setPartialDirty();

        // Early dead stop (optional: strong drag instead of hard stop)
        if (this.dead) {
            this.currentSpeed = 0;
            this.steeringAngle = 0;
        }

        // Uncomment if you want boundary clamping (prevents going off-map)
        // this.enforceWorldBoundaries();
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
            // for (let i = 0; i < this.occupants.length; i++) {
            // if (this.occupants[i]) {
            // this.interact(this.occupants[i]); // Reuse interact to exit
            // }
            // }
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