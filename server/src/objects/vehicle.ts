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

    private resolveCollisions(): void {
        const nearObjects = this.game.grid.intersectsHitbox(this.hitbox, this.layer);

        for (let step = 0; step < 10; step++) {
            let collided = false;

            for (const potential of nearObjects) {
                if (potential === this || (potential.isPlayer && potential === this.driver)) continue;

                const { isObstacle, isBuilding, isVehicle } = potential;

                if (
                    (isObstacle || isBuilding || isVehicle)
                    && potential.collidable
                    && potential.hitbox?.collidesWith(this.hitbox)
                ) {
                    // Skip stair handling for vehicles
                    collided = true;
                    this.hitbox.resolveCollision(potential.hitbox);
                }
            }

            if (!collided) break;
        }
    }

    // private enforceWorldBoundaries(): void {
    //     // Approximate clamp using unrotated half dimensions (ignores rotation for simplicity)
    //     const halfWidth = (this.definition.hitbox.toRectangle(). / 2) * this.definition.scale;
    //     const halfHeight = (this.definition.hitbox.height / 2) * this.definition.scale;

    //     this.position.x = Numeric.clamp(
    //         this.position.x,
    //         halfWidth,
    //         this.game.map.width - halfWidth
    //     );
    //     this.position.y = Numeric.clamp(
    //         this.position.y,
    //         halfHeight,
    //         this.game.map.height - halfHeight
    //     );
    // }

    update(): void {
        const dt = this.game.dt;

        if (!this.driver || this.dead) {
            if (this.driver) {
                this.driver.isMoving = false;
            }
            return;
        }

        const oldPosition = Vec.clone(this.position);
        const oldDriverPosition = Vec.clone(this.driver.position);

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
        const turnSpeed = this.definition.turnSpeed;
        const drag = this.definition.drag;
        const maxSpeed = this.definition.maxSpeed;
        const maxReverseSpeed = maxSpeed * 0.5;

        // Accelerate/decelerate
        this.currentSpeed += inputForward * accel * dt;
        if (inputForward === 0) {
            // Drag when no input
            this.currentSpeed *= Math.exp(-drag * dt);
        }
        this.currentSpeed = Numeric.clamp(this.currentSpeed, -maxReverseSpeed, maxSpeed);

        // Turn (scale by speed factor for more responsive low-speed turning)
        const speedFactor = Math.min(Math.abs(this.currentSpeed) / maxSpeed + 0.3, 1); // Min 0.3 at standstill
        const turnRate = turnSpeed * inputSteer * dt * speedFactor;
        this.rotation += turnRate;

        // Compute velocity and update position
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
        // this.enforceWorldBoundaries();

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
            full: {
                definition: this.definition,
            }
        };

        return data;
    }

}