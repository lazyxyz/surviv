import { type PlayerInputData } from "@common/packets/inputPacket";
import { InputActions, PlayerActions } from "@common/constants";
import { Numeric } from "@common/utils/math";
import { CircleHitbox } from "@common/utils/hitbox";
import { Geometry } from "@common/utils/math";
import { adjacentOrEqualLayer } from "@common/utils/layer";
import { type Loot } from "../loot";
import { type Obstacle } from "../obstacle";
import { type Player } from "../player";  // Adjust import
import { ItemType } from "@common/utils/objectDefinitions";
import { GunItem } from "../../inventory/gunItem";

export class InputHandler {
    constructor(private player: Player) { }

    processInputs(packet: PlayerInputData): void {
        this.player.movement = {
            ...packet.movement,
            ...(packet.isMobile ? packet.mobile : { moving: false, angle: 0 })
        };

        const wasAttacking = this.player.attacking;
        const isAttacking = packet.attacking;

        this.player.attacking = isAttacking;
        this.player.startedAttacking ||= !wasAttacking && isAttacking;
        this.player.stoppedAttacking ||= wasAttacking && !isAttacking;

        if (this.player.turning = packet.turning) {
            this.player.rotation = packet.rotation;
            this.player.distanceToMouse = (packet as typeof packet).distanceToMouse ?? 0;
            /*
                we put ?? cause even though the packet's isMobile should match the server's, it might
                be possible—whether accidentally or maliciously—that it doesn't; however, the server is
                not to honor any change to isMobile. however, the packet will still be announcing itself
                as a mobile packet, and will thus lack the distanceToMouse field
            */
        }

        const inventory = this.player.inventory;
        for (const action of packet.actions) {
            const type = action.type;

            switch (type) {
                case InputActions.UseItem: {
                    inventory.useItem(action.item);
                    break;
                }
                case InputActions.EquipLastItem:
                case InputActions.EquipItem: {
                    const target = type === InputActions.EquipItem
                        ? action.slot
                        : inventory.lastWeaponIndex;

                    // If a user is reloading the gun in slot 2, then we don't cancel the reload if they "switch" to slot 2
                    if (this.player.action?.type !== PlayerActions.Reload || (target !== this.player.activeItemIndex && inventory.hasWeapon(target))) {
                        this.player.action?.cancel();
                    }

                    inventory.setActiveWeaponIndex(target);
                    this.player.dirty.modifiers = true; // Added: Potential modifier change on equip
                    break;
                }
                case InputActions.DropWeapon: {
                    this.player.action?.cancel();
                    inventory.dropWeapon(action.slot)?.destroy();
                    this.player.dirty.modifiers = true; // Added: Modifiers dirty on drop
                    break;
                }
                case InputActions.DropItem: {
                    if (!this.player.game.teamMode && action.item.itemType !== ItemType.Perk) break;
                    this.player.action?.cancel();
                    inventory.dropItem(action.item);
                    this.player.dirty.modifiers = true; // Added: Modifiers dirty on drop
                    break;
                }
                case InputActions.SwapGunSlots: {
                    inventory.swapGunSlots();
                    break;
                }
                case InputActions.LockSlot: {
                    inventory.lock(action.slot);
                    break;
                }
                case InputActions.UnlockSlot: {
                    inventory.unlock(action.slot);
                    break;
                }
                case InputActions.ToggleSlotLock: {
                    const slot = action.slot;

                    // eslint-disable-next-line @typescript-eslint/no-unused-expressions
                    inventory.isLocked(slot) ? inventory.unlock(slot) : inventory.lock(slot);
                    break;
                }
                case InputActions.Loot:
                case InputActions.Interact: {
                    interface CloseObject {
                        object: Obstacle | Player | Loot | undefined
                        dist: number
                    }

                    const interactable: CloseObject = {
                        object: undefined,
                        dist: Number.MAX_VALUE
                    };
                    const uninteractable: CloseObject = {
                        object: undefined,
                        dist: Number.MAX_VALUE
                    };
                    const detectionHitbox = new CircleHitbox(3 * this.player._sizeMod, this.player.position);
                    const nearObjects = this.player.game.grid.intersectsHitbox(detectionHitbox);

                    for (const object of nearObjects) {
                        const { isLoot, isObstacle, isPlayer } = object;
                        const isInteractable = (isLoot || isObstacle || isPlayer) && object.canInteract(this.player) === true;

                        if (
                            (isLoot || (type === InputActions.Interact && isInteractable))
                            && object.hitbox?.collidesWith(detectionHitbox)
                            && adjacentOrEqualLayer(this.player.layer, object.layer)
                        ) {
                            const dist = Geometry.distanceSquared(object.position, this.player.position);
                            if (isInteractable) {
                                if (dist < interactable.dist) {
                                    interactable.dist = dist;
                                    interactable.object = object as CloseObject["object"];
                                }
                            } else if (isLoot && dist < uninteractable.dist) {
                                uninteractable.dist = dist;
                                uninteractable.object = object;
                            }
                        }
                    }

                    if (interactable.object) {
                        interactable.object.interact(this.player);

                        if (interactable.object.isObstacle && interactable.object.isDoor) {
                            // If the closest object is a door, interact with other doors within range
                            for (const object of nearObjects) {
                                if (
                                    object.isObstacle
                                    && object.isDoor
                                    && !object.door?.locked
                                    && object !== interactable.object
                                    && object.hitbox.collidesWith(detectionHitbox)
                                    && adjacentOrEqualLayer(this.player.layer, object.layer)
                                ) {
                                    object.interact(this.player);
                                }
                            }
                        }
                    } else {
                        uninteractable.object?.interact(this.player, uninteractable.object.canInteract(this.player));
                    }

                    this.player.canDespawn = false;
                    this.player.disableInvulnerability();
                    this.player.dirty.modifiers = true; // Added: Potential modifier change on loot/interact
                    break;
                }
                case InputActions.Reload:
                    if (this.player.activeItem instanceof GunItem) {
                        this.player.activeItem.reload();
                    }
                    break;
                case InputActions.Cancel:
                    this.player.action?.cancel();
                    break;
                case InputActions.Emote:
                    this.player.communicationHandler.sendEmote(action.emote);
                    break;
                case InputActions.MapPing:
                    this.player.communicationHandler.sendMapPing(action.ping, action.position);
                    break;
            }
        }

        this.player.game.pluginManager.emit("player_input", {
            player: this.player,
            packet
        });
    }
}