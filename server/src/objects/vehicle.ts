import { Layer, ObjectCategory, PlayerActions } from "@common/constants";
import { CircleHitbox, Hitbox, RectangleHitbox } from "@common/utils/hitbox";
import { BaseGameObject, DamageParams } from "./gameObject";
import { SDeepMutable } from "@common/utils/misc";
import { FullData } from "@common/utils/objectsSerializations";
import { HealingAction } from "../inventory/action";
import { ThrowableDefinition } from "@common/definitions/throwables";
import { ObjectDefinition } from "@common/utils/objectDefinitions";
import { Vector } from "@common/utils/vector";
import { Game } from "../game";
import { ThrowableItem } from "../inventory/throwableItem";
import { VehicleDefinition } from "@common/definitions/vehicle";
import { RotationMode } from "@common/definitions/obstacles";
import { Orientation } from "@common/typings";
import { InventoryItem } from "../inventory/inventoryItem";
import { Player } from "./player";

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
        }
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