import { Layer, ObjectCategory, PlayerActions } from "@common/constants";
import { CircleHitbox, Hitbox, RectangleHitbox } from "@common/utils/hitbox";
import { BaseGameObject, DamageParams } from "./gameObject";
import { SDeepMutable } from "@common/utils/misc";
import { FullData } from "@common/utils/objectsSerializations";
import { HealingAction } from "../inventory/action";
import { ThrowableDefinition } from "@common/definitions/throwables";
import { ObjectDefinition } from "@common/utils/objectDefinitions";
import { Vec, Vector } from "@common/utils/vector";
import { Game } from "../game";
import { ThrowableItem } from "../inventory/throwableItem";
import { VehicleDefinition } from "@common/definitions/vehicle";
import { RotationMode } from "@common/definitions/obstacles";
import { Orientation } from "@common/typings";
import { InventoryItem } from "../inventory/inventoryItem";
import { Player } from "./player";
import { Geometry, Numeric } from "@common/utils/math";

const STEERING_SCALE = 100; // Arbitrary scale for quantization: e.g., 0.01 rad precision fits well in int8 (-128 to 127 covers ~±1.28 rad, more than enough for ±0.26 rad)

export class Vehicle extends BaseGameObject.derive(ObjectCategory.Vehicle) {
    private static readonly baseHitbox = RectangleHitbox.fromRect(9.2, 9.2);

    override readonly fullAllocBytes = 8;
    override readonly partialAllocBytes = 14;
    declare hitbox: Hitbox;
    declare bulletHitbox: Hitbox;
    collidable: boolean = true;
    damageable: boolean = true;

    private _height = 1;
    health: number;
    driver?: Player;

    // Vehicle physics state
    private currentSpeed: number = 0;
    private steeringAngle: number = 0;
    private wheelbase: number;
    private readonly driverOffset: Vector = Vec.create(0, -2); // Relative offset for driver position (forward in cab)

    get height(): number { return this._height; }

    constructor(
        game: Game,
        position: Vector,
        layer: Layer,
        readonly definition: VehicleDefinition,
    ) {
        super(game, position);
        this.layer = layer;

        // Compute wheelbase from wheels offsets (adjusted scale factor for realistic turning radius)
        if (this.definition.wheels && this.definition.wheels.length >= 2) {
            let minY = Infinity, maxY = -Infinity;
            for (const w of this.definition.wheels) {
                minY = Math.min(minY, w.offset.y);
                maxY = Math.max(maxY, w.offset.y);
            }
            this.wheelbase = ((maxY - minY) / 20) * this.definition.scale; // Adjusted divisor for larger wheelbase (~20 units)
        } else {
            this.wheelbase = this.definition.hitbox.toRectangle().height * 0.8; // ~80% of vehicle length
        }

        const hitboxRotation = this.definition.rotationMode === RotationMode.Limited ? this.rotation as Orientation : 0;
        this.hitbox = this.definition.hitbox.transform(this.position, this.definition.scale, hitboxRotation);
        this.bulletHitbox = this.definition.bulletHitbox.transform(this.position, this.definition.scale, hitboxRotation);
        this.health = this.definition.health;
    }

    canInteract(player: any): boolean {  // 'any' for Player type—fix import if needed
        return true;  // Interact if not destroyed
    }

    interact(player: Player): void {
        // player.enterVehicle(this);
        if (player.inVehicle) {
            player.exitVehicle();  // Toggle: Exit if already in
        } else {
            player.enterVehicle(this);
            this.driver = player;
        }
    }

    // private resolveCollisions(): void {
    //     const nearObjects = this.game.grid.intersectsHitbox(this.hitbox, this.layer);

    //     for (let step = 0; step < 10; step++) {
    //         let collided = false;

    //         for (const potential of nearObjects) {
    //             if (potential === this || (potential.isPlayer && potential === this.driver)) continue;

    //             const { isObstacle, isBuilding, isVehicle } = potential;

    //             if (
    //                 (isObstacle || isBuilding || isVehicle)
    //                 && potential.collidable
    //                 && potential.hitbox?.collidesWith(this.hitbox)
    //             ) {
    //                 // Skip stair handling for vehicles
    //                 collided = true;
    //                 this.hitbox.resolveCollision(potential.hitbox);
    //                 // After resolution, sync position back (assuming resolve mutates hitbox.position)
    //                 this.position = this.hitbox.position;
    //             }
    //         }

    //         if (!collided) break;
    //     }

    //     // Re-transform hitboxes after collision resolution
    //     const hitboxRotation = this.definition.rotationMode === RotationMode.Limited ? this.rotation as Orientation : 0;
    //     this.hitbox = this.definition.hitbox.transform(this.position, this.definition.scale, hitboxRotation);
    //     this.bulletHitbox = this.definition.bulletHitbox.transform(this.position, this.definition.scale, hitboxRotation);
    // }

    private enforceWorldBoundaries(): void {
        // Approximate clamp using unrotated half dimensions (ignores rotation for simplicity)
        const rect = this.definition.hitbox.toRectangle();
        const halfWidth = (rect.width / 2) * this.definition.scale;
        const halfHeight = (rect.height / 2) * this.definition.scale;

        this.position.x = Numeric.clamp(
            this.position.x,
            halfWidth,
            this.game.map.width - halfWidth
        );
        this.position.y = Numeric.clamp(
            this.position.y,
            halfHeight,
            this.game.map.height - halfHeight
        );
    }

    update(): void {
        const dt = this.game.dt;

        if (!this.driver || this.dead) {
            if (this.driver) {
                this.driver.isMoving = false;
            }
            return;
        }

        const oldPosition = Vec.clone(this.position);

        // Compute input forward and steer (handles both mobile and keys)
        let inputForward = 0;
        let inputSteer = 0;
        const pm = this.driver.movement;

        if (this.driver.isMobile && pm.moving) {
            // Mobile: Map joystick angle to relative forward/steer
            let angleDiff = pm.angle - this.rotation + Math.PI / 2;
            angleDiff = ((angleDiff + Math.PI) % (2 * Math.PI)) - Math.PI; // Signed diff in [-pi, pi]
            inputForward = Math.cos(angleDiff);
            inputSteer = Math.sin(angleDiff);
        } else {
            // Keys: Direct mapping (diagonals allow accel + turn)
            inputForward = +pm.up - +pm.down;
            inputSteer = +pm.right - +pm.left;
        }

        // Physics update (units: speed in pixels/ms, accel/turn/drag in per-ms units, dt in ms)
        const accel = this.definition.acceleration;
        const turnSpeed = this.definition.turnSpeed; // Not used in new model
        const drag = this.definition.drag;
        const maxSpeed = this.definition.maxSpeed;
        const maxReverseSpeed = maxSpeed * 0.5;

        // Always apply drag
        this.currentSpeed *= Math.exp(-drag * dt);

        // Then accelerate/decelerate based on input
        this.currentSpeed += inputForward * accel * dt;
        this.currentSpeed = Numeric.clamp(this.currentSpeed, -maxReverseSpeed, maxSpeed);

        // Steering and turning (simple car model: turn rate = speed * tan(steer) / wheelbase)
        const maxSteerRad = Math.PI / 12; // Reduced to ~15 degrees for slower turning
        this.steeringAngle = inputSteer * maxSteerRad;
        const steerAngle = this.steeringAngle;
        let turnRate = (this.currentSpeed * Math.tan(steerAngle)) / this.wheelbase;
        // Removed inversion to fix opposite turning direction
        this.rotation += turnRate * dt;

        // Compute velocity along body direction and update position
        const forwardDir = Vec.fromPolar(this.rotation - Math.PI / 2);
        const velocity = Vec.scale(forwardDir, this.currentSpeed * dt);
        this.position = Vec.add(this.position, velocity);

        // Update hitboxes
        const hitboxRotation = this.definition.rotationMode === RotationMode.Limited ? this.rotation as Orientation : 0;
        this.hitbox = this.definition.hitbox.transform(this.position, this.definition.scale, hitboxRotation);
        this.bulletHitbox = this.definition.bulletHitbox.transform(this.position, this.definition.scale, hitboxRotation);

        // Resolve collisions
        // this.resolveCollisions();

        // Enforce boundaries
        this.enforceWorldBoundaries();

        // Update driver position (rotated offset)
        const rotatedOffset = Vec.rotate(this.driverOffset, this.rotation);
        this.driver.position = Vec.add(this.position, rotatedOffset);
        this.driver.layer = this.layer;

        // Update movement state
        const isMoving = !Vec.equals(oldPosition, this.position) || Math.abs(this.currentSpeed) > 0.01;
        if (isMoving) {
            this.game.grid.updateObject(this);
        }
        this.driver.isMoving = isMoving;
        this.game.grid.updateObject(this.driver);

        this.setPartialDirty();
    }

    damage(params: DamageParams & { position?: Vector }): void {
        const definition = this.definition;

        const { amount, source, weaponUsed, position } = params;
        if (this.health === 0) return;

        this.health -= amount;
        this.setPartialDirty();

        // this.game.pluginManager.emit("obstacle_did_damage", {
        //     obstacle: this,
        //     ...params
        // });

        const notDead = this.health > 0 && !this.dead;
        if (!notDead) {
            this.health = 0;
            this.dead = true;
            this.collidable = false;
            // if (
            //     this.game.pluginManager.emit("obstacle_will_destroy", {
            //         obstacle: this,
            //         source,
            //         weaponUsed,
            //         amount
            //     })
            // ) return;

            const weaponIsItem = weaponUsed instanceof InventoryItem;
            if (definition.explosion !== undefined && source instanceof BaseGameObject) {
                //                                    ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
                // FIXME This is implying that obstacles won't explode if destroyed by non–game objects
                this.game.addExplosion(definition.explosion, this.position, source, source.layer, weaponIsItem ? weaponUsed : weaponUsed?.weapon);
            }

            // Eject driver on destruction
            if (this.driver) {
                this.driver.exitVehicle();
            }
        }
    }


    override get data(): FullData<ObjectCategory.Vehicle> {
        const data: SDeepMutable<FullData<ObjectCategory.Vehicle>> = {
            position: this.position,
            rotation: this.rotation,
            layer: this.layer,
            dead: this.dead,
            steeringAngle: Math.round(this.steeringAngle * STEERING_SCALE), // Quantized to int (fits in int8)
            full: {
                definition: this.definition,
            }
        };

        return data;
    }

}