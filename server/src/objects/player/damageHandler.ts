import { GameObject, type DamageParams } from "../gameObject";
import { KillfeedEventType, KillfeedMessageType, KillfeedEventSeverity, AnimationType, ObjectCategory } from "@common/constants";
import { createKillfeedMessage, type ForEventType } from "@common/packets/killFeedPacket";
import { KillFeedPacket } from "@common/packets/killFeedPacket";
import { Numeric } from "@common/utils/math";
import { GameConstants } from "@common/constants";
import { Loots } from "@common/definitions/loots";
import { Armors } from "@common/definitions/armors";
import { InventoryItem } from "../../inventory/inventoryItem";
import { GunItem } from "../../inventory/gunItem";
import { MeleeItem } from "../../inventory/meleeItem";
import { Explosion } from "../explosion";
import { DeathMarker } from "../deathMarker";
import { Action, ReviveAction } from "../../inventory/action";
import { BaseGameObject } from "../gameObject";
import { Player } from "../player";  // Adjust import
import { Vec } from "@common/utils/vector";
import { ExtendedWearerAttributes, ItemType } from "@common/utils/objectDefinitions";
import { Obstacles } from "@common/definitions/obstacles";
import { ThrowableItem } from "../../inventory/throwableItem";
import { Team } from "../../team";
import { removeFrom } from "../../utils/misc";

export class DamageHandler {
    constructor(private player: Player) {}

    private _clampDamageAmount(amount: number): number {
        if (this.player.health - amount > this.player.maxHealth) {
            amount = -(this.player.maxHealth - this.player.health);
        }

        if (this.player.health - amount <= 0) {
            amount = this.player.health;
        }

        if (amount < 0 || this.player.dead) amount = 0;

        return amount;
    }

    damage(params: DamageParams): void {
        if (this.player.invulnerable) return;

        const { source, weaponUsed } = params;
        let { amount } = params;

        this.player.game.pluginManager.emit("player_damage", {
            amount,
            player: this.player,
            source,
            weaponUsed
        });

        amount *= 1 - (
            (this.player.inventory.helmet?.damageReduction ?? 0) + (this.player.inventory.vest?.damageReduction ?? 0)
        );

        amount = this._clampDamageAmount(amount);

        this.piercingDamage({
            amount,
            source,
            weaponUsed
        });
    }

    piercingDamage(params: DamageParams): void {
        const { source, weaponUsed } = params;
        let { amount } = params;

        if (this.player.invulnerable) return;

        if (this.player.game.teamMode
            && source instanceof Player
            && source.teamID === this.player.teamID
            && source.id !== this.player.id
            && !this.player.disconnected) {
            if (params.weaponUsed instanceof GunItem || params.weaponUsed instanceof MeleeItem) {
                return;
            }
        }

        amount = this._clampDamageAmount(amount);

        if (
            this.player.game.pluginManager.emit("player_will_piercing_damaged", {
                player: this.player,
                amount,
                source,
                weaponUsed
            })
        ) return;

        const canTrackStats = weaponUsed instanceof InventoryItem;
        const attributes = canTrackStats ? weaponUsed.definition.wearerAttributes?.on : undefined;
        const sourceIsPlayer = source instanceof Player;
        const applyPlayerFX = sourceIsPlayer
            ? (modifiers: ExtendedWearerAttributes): void => {
                source.health += modifiers.healthRestored ?? 0;
                source.adrenaline += modifiers.adrenalineRestored ?? 0;
            }
            : () => { /* nothing to apply */ };

        let statsChanged = false;
        const oldStats = canTrackStats ? { ...weaponUsed.stats } : undefined;

        this.player.health -= amount;
        if (amount > 0) {
            this.player.damageTaken += amount;
            this.player.damageDone += amount;
            this.player.dirty.modifiers = true;

            if (canTrackStats && !this.player.dead) {
                const damageDealt = weaponUsed.stats.damage += amount;
                statsChanged = true;

                if (sourceIsPlayer) {
                    for (const entry of attributes?.damageDealt ?? []) {
                        if (damageDealt >= (entry.limit ?? Infinity)) continue;

                        applyPlayerFX(entry);
                    }
                }
            }

            if (sourceIsPlayer) {
                if (source !== this.player) {
                    source.damageDone += amount;
                    source.dirty.modifiers = true;
                }
            }
        }

        this.player.game.pluginManager.emit("player_did_piercing_damaged", {
            player: this.player,
            amount,
            source,
            weaponUsed
        });
        if (this.player.health <= 0 && !this.player.dead) {
            if (
                this.player.game.teamMode
                && this.player._team?.players.some(p => !p.dead && !p.downed && !p.disconnected && p !== this.player)
                && !this.player.downed
            ) {
                this.down(source, weaponUsed);
            } else {
                if (canTrackStats) {
                    const kills = ++weaponUsed.stats.kills;
                    statsChanged = true;

                    if (sourceIsPlayer) {
                        for (const entry of attributes?.kill ?? []) {
                            if (kills >= (entry.limit ?? Infinity)) continue;

                            applyPlayerFX(entry);
                        }
                    }
                }

                this.player.die(params);
            }
        }

        if (statsChanged && canTrackStats) {
            this.player.game.pluginManager.emit(
                "inv_item_stats_changed",
                {
                    item: weaponUsed,

                    oldStats: oldStats!,
                    newStats: { ...weaponUsed.stats },
                    diff: {
                        kills: oldStats?.kills !== weaponUsed.stats.kills,
                        damage: oldStats?.damage !== weaponUsed.stats.damage
                    }
                }
            );
        }
    }

    die(params: Omit<DamageParams, "amount">): void {
        if (this.player.health > 0 || this.player.dead) return;

        this.player.game.pluginManager.emit("player_will_die", {
            player: this.player,
            ...params
        });

        const { source, weaponUsed } = params;

        this.player.health = 0;
        this.player.dead = true;
        const wasDowned = this.player.downed;
        this.player.downed = false;
        this.player.canDespawn = false;
        this.player._team?.setDirty();

        let action: Action | undefined;
        if ((action = this.player.beingRevivedBy?.action) instanceof ReviveAction) {
            action.cancel();
        }

        const sourceIsPlayer = source instanceof Player;

        if (sourceIsPlayer) {
            this.player.killedBy = source;
            if (source !== this.player && (!this.player.game.teamMode || source.teamID !== this.player.teamID)) source.kills++;
        }

            if (
            sourceIsPlayer
            // firstly, 'GameObject in KillfeedEventType' returns false;
            // secondly, so does 'undefined in KillfeedEventType';
            // thirdly, enum double-indexing means that 'KillfeedEventType.<whatever> in KillfeedEventType' returns true
            // @ts-expect-error see above
            || source in KillfeedEventType
        ) {
            const message = createKillfeedMessage(KillfeedMessageType.DeathOrDown)
                .victimId(this.player.id);

            const attributeToPlayer = (player: Player, item: InventoryItem | null = player.activeItem): void => {
                (
                    message as ForEventType<
                        | KillfeedEventType.NormalTwoParty
                        | KillfeedEventType.FinishedOff
                        | KillfeedEventType.FinallyKilled
                        | KillfeedEventType.Gas
                        | KillfeedEventType.BleedOut
                        | KillfeedEventType.Airdrop
                    >
                ).attackerId(player.id)
                    .attackerKills(player.kills);

                if (item !== null) {
                    if (
                        [
                            KillfeedEventType.Suicide,
                            KillfeedEventType.NormalTwoParty,
                            KillfeedEventType.FinishedOff
                        ].includes(message.eventType() as DamageParams["source"] & KillfeedEventType)
                    ) {
                        const msg = (message as ForEventType<
                            KillfeedEventType.Suicide |
                            KillfeedEventType.NormalTwoParty |
                            KillfeedEventType.FinishedOff
                        >).weaponUsed(item.definition);

                        if (item.definition.killstreak) {
                            msg.killstreak(item.stats.kills);
                        }
                    }
                }
            };

            const attributeToDowner = (withWeapon = false): boolean => {
                const downer = this.player.downedBy;
                if (!downer) return false;

                const { player, item } = downer;

                ++player.kills;
                if (
                    (item instanceof GunItem || item instanceof MeleeItem)
                    && player.inventory.weapons.includes(item)
                ) {
                    const kills = ++item.stats.kills;

                    for (const entry of item.definition.wearerAttributes?.on?.kill ?? []) {
                        if (kills >= (entry.limit ?? Infinity)) continue;

                        player.health += entry.healthRestored ?? 0;
                        player.adrenaline += entry.adrenalineRestored ?? 0;
                    }
                }

                if (withWeapon) {
                    (
                        message as ForEventType<
                            | KillfeedEventType.NormalTwoParty
                            | KillfeedEventType.FinishedOff
                        >
                    ).weaponUsed(item?.definition);
                }

                attributeToPlayer(player, item);

                return true;
            };

            if (
                (
                    [
                        KillfeedEventType.FinallyKilled,
                        KillfeedEventType.Gas,
                        KillfeedEventType.BleedOut
                    ].includes as (arg: DamageParams["source"]) => arg is DamageParams["source"] & KillfeedEventType
                )(source)
            ) {
                message.eventType(source);

                attributeToDowner();
            } else if (sourceIsPlayer) {
                if (source === this.player) {
                    message.eventType(KillfeedEventType.Suicide)
                        .weaponUsed(weaponUsed?.definition);
                } else {
                    message.eventType(
                        wasDowned
                            ? KillfeedEventType.FinishedOff
                            : KillfeedEventType.NormalTwoParty
                    ).weaponUsed(weaponUsed?.definition);

                    if (
                        this.player.teamID === undefined
                        || source.teamID !== this.player.teamID
                        || !attributeToDowner(true)
                    ) {
                        attributeToPlayer(source, weaponUsed instanceof Explosion ? null : weaponUsed);
                    }
                }
            } else if (source instanceof BaseGameObject) {
                console.warn(`Unexpected source of death for player '${this.player.name}' (id: ${this.player.id}); source is of category ${ObjectCategory[source.type]}`);
            }

            this.player.game.packets.push(
                KillFeedPacket.create(message.build())
            );
        }

        this.player.movement.up = this.player.movement.down = this.player.movement.left = this.player.movement.right = false;
        this.player.startedAttacking = false;
        this.player.attacking = false;
        this.player.stoppedAttacking = false;
        this.player.game.aliveCountDirty = true;
        this.player.adrenaline = 0;
        this.player.dirty.items = true;
        this.player.action?.cancel();
        this.player.communicationHandler.sendEmote(this.player.loadout.emotes[5]);

        this.player.game.livingPlayers.delete(this.player);
        this.player.game.updateGameData({ aliveCount: this.player.game.aliveCount });
        this.player.game.fullDirtyObjects.add(this.player);
        removeFrom(this.player.game.spectatablePlayers, this.player);

        if (this.player.activeItem instanceof ThrowableItem) {
            this.player.activeItem.stopUse();
        }

        this.teamWipe();

        const { position, layer } = this.player;

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
            const disguiseObstacle = this.player.game.map.generateObstacle(this.player.activeDisguise?.idString, this.player.position, { layer: this.player.layer });
            const disguiseDef = Obstacles.reify(this.player.activeDisguise);

            if (disguiseObstacle !== undefined) {
                this.player.game.addTimeout(() => {
                    disguiseObstacle.damage({
                        amount: disguiseObstacle.health
                    });
                }, 10);
            }

            if (disguiseDef.explosion) {
                this.player.game.addExplosion(disguiseDef.explosion, this.player.position, this.player, this.player.layer);
            }
        }

        this.player.game.grid.addObject(new DeathMarker(this.player, layer));

        if (this.player === this.player.game.killLeader) {
            this.player.game.killLeaderDead(sourceIsPlayer ? source : undefined);
        }

        this.player.game.pluginManager.emit("player_did_die", {
            player: this.player,
            ...params
        });
    }

    teamWipe(): void {
        let team: Team | undefined;
        let players: readonly Player[] | undefined;
        if ((players = (team = this.player._team)?.players)?.every(p => p.dead || p.disconnected || p.downed)) {
            for (const player of players) {
                if (player === this.player) continue;

                player.health = 0;
                player.damageHandler.die({
                    source: KillfeedEventType.FinallyKilled
                });
            }

            this.player.game.teams.delete(team!);
        }
    }

    down(
        source?: GameObject | (typeof KillfeedEventType)["Gas" | "Airdrop" | "BleedOut" | "FinallyKilled"],
        weaponUsed?: GunItem | MeleeItem | ThrowableItem | Explosion
    ): void {
        const sourceIsPlayer = source instanceof Player;

        if (sourceIsPlayer || source === KillfeedEventType.Gas || source === KillfeedEventType.Airdrop) {
            const message = createKillfeedMessage(KillfeedMessageType.DeathOrDown)
                .severity(KillfeedEventSeverity.Down)
                .victimId(this.player.id);

            if (sourceIsPlayer) {
                this.player.downedBy = {
                    player: source,
                    item: weaponUsed instanceof InventoryItem ? weaponUsed : undefined
                };

                if (source !== this.player) {
                    message.eventType(KillfeedEventType.NormalTwoParty)
                        .attackerId(source.id)
                        .weaponUsed(weaponUsed?.definition);
                }
            } else {
                message.eventType(source);
            }

            this.player.game.packets.push(
                KillFeedPacket.create(message.build())
            );
        }

        this.player.canDespawn = false;
        this.player.downed = true;
        this.player.action?.cancel();
        this.player.activeItem.stopUse();
        this.player.health = 100;
        this.player.adrenaline = this.player.minAdrenaline;
        this.player.setDirty();
        this.player._team?.setDirty();
    }

    revive(): void {
        this.player.downed = false;
        this.player.beingRevivedBy = undefined;
        this.player.downedBy = undefined;
        this.player.health = 30;
        this.player.setDirty();
        this.player._team?.setDirty();
    }

    canInteract(player: Player): boolean {
        return !player.downed
            && this.player.downed
            && !this.player.beingRevivedBy
            && this.player !== player
            && this.player.teamID === player.teamID;
    }

    interact(reviver: Player): void {
        this.player.beingRevivedBy = reviver;
        this.player.setDirty();
        reviver.animation = AnimationType.Revive;
        reviver.executeAction(new ReviveAction(reviver, this.player));
    }
}