import { type ReferenceTo } from "@common/utils/objectDefinitions";
import { type GunDefinition } from "@common/definitions/guns";
import { type ThrowableDefinition } from "@common/definitions/throwables";
import { Loots, WeaponDefinition } from "@common/definitions/loots";
import { Guns } from "@common/definitions/guns";
import { Melees } from "@common/definitions/melees";
import { Throwables } from "@common/definitions/throwables";
import { Armors, ArmorType } from "@common/definitions/armors";
import { Backpacks } from "@common/definitions/backpacks";
import { Ammos } from "@common/definitions/ammos";
import { pickRandomInArray } from "@common/utils/random";
import { Numeric } from "@common/utils/math";
import { type InventoryItem } from "../../inventory/inventoryItem";
import { GunItem } from "../../inventory/gunItem";
import { SpawnableLoots } from "../../data/lootTables";
import { type Player } from "../player";  // Adjust import
import { ItemType } from "@common/utils/objectDefinitions";
import { Emotes } from "@common/definitions/emotes";
import { GameConstants } from "@common/constants";
import { ThrowableItem } from "../../inventory/throwableItem";
import { Obstacles } from "@common/definitions/obstacles";
import { Vector } from "@common/utils/vector";

export class InventoryHelper {
    constructor(private player: Player) { }

    giveGun(idString: ReferenceTo<GunDefinition>): void {
        const primaryItem = this.player.inventory.getWeapon(this.player.inventory.appendWeapon(idString)) as GunItem;
        const primaryDefinition = primaryItem.definition;

        primaryItem.ammo = primaryDefinition.capacity;

        if (!Ammos.fromString(primaryDefinition.ammoType).ephemeral) {
            this.player.inventory.items.setItem(
                primaryDefinition.ammoType,
                this.player.inventory.backpack.maxCapacity[primaryDefinition.ammoType]
            );
        }
        this.player.dirty.modifiers = true;
    }

    giveThrowable(idString: ReferenceTo<ThrowableDefinition>, count?: number): void {
        const { inventory } = this.player;

        inventory.items.incrementItem(idString, count ?? inventory.backpack.maxCapacity[idString]);
        inventory.useItem(idString);

        inventory.throwableItemMap.get(idString)!.count = inventory.items.getItem(idString);
        this.player.dirty.modifiers = true;
    }

    swapWeaponRandomly(itemOrSlot: InventoryItem | number = this.player.activeItem, force = false): void {
        let slot = itemOrSlot === this.player.activeItem
            ? this.player.activeItemIndex
            : typeof itemOrSlot === "number"
                ? itemOrSlot
                : this.player.inventory.weapons.findIndex(i => i === itemOrSlot);

        if (slot === -1) {
            slot = GameConstants.player.inventorySlotTypings.filter(slot => slot === (itemOrSlot as InventoryItem).definition.itemType)?.[0] ?? 0;
        }

        const spawnable = SpawnableLoots(this.player.game.gameMap);

        const { inventory } = this.player;
        const { items, backpack: { maxCapacity }, throwableItemMap } = inventory;
        const type = GameConstants.player.inventorySlotTypings[slot];

        const chosenItem = pickRandomInArray<WeaponDefinition>(
            type === ItemType.Throwable
                ? spawnable.forType(ItemType.Throwable).filter(
                    ({ idString: thr }) => (items.hasItem(thr) ? items.getItem(thr) : 0) < maxCapacity[thr]
                )
                : spawnable.forType(type)
        );
        if (chosenItem === undefined) return;

        switch (chosenItem.itemType) {
            case ItemType.Gun: {
                this.player.action?.cancel();

                const { capacity, ammoType, ammoSpawnAmount, summonAirdrop } = chosenItem;

                if (!items.hasItem(ammoType) && !summonAirdrop) {
                    items.setItem(ammoType, ammoSpawnAmount);
                    this.player.dirty.items = true;
                }

                inventory.replaceWeapon(slot, chosenItem, force);
                (this.player.activeItem as GunItem).ammo = capacity;
                this.player.communicationHandler.sendEmote(Guns.fromString(chosenItem.idString));
                break;
            }

            case ItemType.Melee: {
                inventory.replaceWeapon(slot, chosenItem, force);
                this.player.communicationHandler.sendEmote(Melees.fromString(chosenItem.idString));
                break;
            }

            case ItemType.Throwable: {
                const { idString } = chosenItem;

                const count = items.hasItem(idString) ? items.getItem(idString) : 0;
                const max = maxCapacity[idString];

                const toAdd = Numeric.min(max - count, 3);

                const newCount = Numeric.clamp(
                    count + toAdd,
                    0, max
                );

                items.setItem(
                    idString,
                    newCount
                );

                const item = throwableItemMap.getAndGetDefaultIfAbsent(
                    idString,
                    () => new ThrowableItem(chosenItem, this.player, undefined, newCount)
                );

                item.count = newCount;

                const slot = inventory.slotsByItemType[ItemType.Throwable]?.[0];

                if (slot !== undefined && !inventory.hasWeapon(slot)) {
                    inventory.replaceWeapon(slot, item, force);
                }

                this.player.dirty.weapons = true;
                this.player.dirty.items = true;
                this.player.communicationHandler.sendEmote(Throwables.fromString(chosenItem.idString));
                break;
            }
        }

        this.player.communicationHandler.sendEmote(Emotes.fromStringSafe(chosenItem.idString));
        this.player.dirty.modifiers = true;
    }

    fillInventory(max = false): void {
        const { inventory } = this.player;

        inventory.scope = "4x_scope";
        inventory.backpack = max
            ? [...Backpacks.definitions].sort(({ level: lvlA }, { level: lvlB }) => lvlB - lvlA)[0]
            : pickRandomInArray(Backpacks.definitions);

        this.player.inventory.vest = max
            ? [...Armors.definitions.filter(({ armorType }) => armorType === ArmorType.Vest)].sort(({ level: lvlA }, { level: lvlB }) => lvlB - lvlA)[0]
            : Math.random() > 0.9
                ? undefined
                : pickRandomInArray(Armors.definitions.filter(({ armorType }) => armorType === ArmorType.Vest));

        this.player.inventory.helmet = max
            ? [...Armors.definitions.filter(({ armorType }) => armorType === ArmorType.Helmet)].sort(({ level: lvlA }, { level: lvlB }) => lvlB - lvlA)[0]
            : Math.random() > 0.9
                ? undefined
                : pickRandomInArray(Armors.definitions.filter(({ armorType }) => armorType === ArmorType.Helmet));

        const { items } = inventory;

        items.setItem("2x_scope", 1);
        items.setItem("4x_scope", 1);
        items.setItem("8x_scope", 1);
        items.setItem("15x_scope", 1);

        Throwables.definitions.forEach(({ idString }) => this.giveThrowable(idString));

        for (const [item, maxCapacity] of Object.entries(inventory.backpack.maxCapacity)) {
            items.setItem(item, maxCapacity);

            if (inventory.throwableItemMap.has(item)) {
                inventory.throwableItemMap.get(item)!.count = maxCapacity;
            }
        }

        this.giveGun(pickRandomInArray(Guns.definitions).idString);
        this.giveGun(pickRandomInArray(Guns.definitions).idString);
        this.player.inventory.addOrReplaceWeapon(2, pickRandomInArray(Melees.definitions));
        this.player.dirty.modifiers = true;
    }

    handleDeathDrops(position: Vector, layer: number): void {
            this.player.inventory.unlockAllSlots();
            this.player.inventory.dropWeapons();
    
            for (const item in this.player.inventory.items.asRecord()) {
                const count = this.player.inventory.items.getItem(item);
                const def = Loots.fromString(item);
    
                if (count > 0) {
                    if (
                        def.noDrop
                        || ("ephemeral" in def && def.ephemeral)
                    ) continue;
    
                    if (def.itemType === ItemType.Ammo && count !== Infinity) {
                        let left = count;
                        let subtractAmount = 0;
    
                        do {
                            left -= subtractAmount = Numeric.min(left, def.maxStackSize);
                            this.player.game.addLoot(item, position, layer, { count: subtractAmount });
                        } while (left > 0);
    
                        continue;
                    }
    
                    this.player.game.addLoot(item, position, layer, { count });
                    this.player.inventory.items.setItem(item, 0);
                }
            }
    
            for (const itemType of ["helmet", "vest", "backpack"] as const) {
                const item = this.player.inventory[itemType];
                if (item?.noDrop === false) {
                    this.player.game.addLoot(item, position, layer);
                }
            }
    
            this.player.inventory.helmet = this.player.inventory.vest = undefined;
    
            const { skin } = this.player.loadout;
            if (skin.hideFromLoadout && !skin.noDrop) {
                this.player.game.addLoot(skin, position, layer);
            }
    
            for (const perk of this.player.perks) {
                if (!perk.noDrop) {
                    this.player.game.addLoot(perk, position, layer);
                }
            }
    
            if (this.player.activeDisguise !== undefined) {
                const disguiseObstacle = this.player.game.map.generateObstacle(this.player.activeDisguise?.idString, position, { layer });
                const disguiseDef = Obstacles.reify(this.player.activeDisguise);
    
                if (disguiseObstacle !== undefined) {
                    this.player.game.addTimeout(() => {
                        disguiseObstacle.damage({
                            amount: disguiseObstacle.health
                        });
                    }, 10);
                }
    
                if (disguiseDef.explosion) {
                    this.player.game.addExplosion(disguiseDef.explosion, position, this.player, layer);
                }
            }
    
        }
}