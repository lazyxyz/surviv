import { type Vector } from "@common/utils/vector";
import { Vec } from "@common/utils/vector";
import { Numeric } from "@common/utils/math";
import { Geometry } from "@common/utils/math";
import { Collision } from "@common/utils/math";
import { GameConstants, KillfeedMessageType, ObjectCategory } from "@common/constants";
import { FloorTypes } from "@common/utils/terrain";
import { type SyncedParticle } from "../syncedParticle";
import { PerkIds } from "@common/definitions/perks";
import { type UpdatePacketDataIn, type PlayerData, type UpdatePacketDataCommon, UpdatePacket } from "@common/packets/updatePacket";
import { Hitbox, RectangleHitbox } from "@common/utils/hitbox";
import { CircleHitbox } from "@common/utils/hitbox";
import { adjacentOrEqualLayer, isVisibleFromLayer } from "@common/utils/layer";
import { type Player } from "../player";  // Adjust import
import { type GameObject } from "../gameObject";
import { type Obstacle } from "../obstacle";
import { KillfeedEventType } from "@common/constants";
import { Config } from "../../config";
import { DEFAULT_SCOPE, ScopeDefinition } from "@common/definitions/scopes";
import { type BaseGameObject } from "../gameObject";
import { ExtendedMap } from "@common/utils/misc";
import { SMutable } from "@common/utils/misc";
import { KillFeedPacket } from "@common/packets/killFeedPacket";
import { ReviveAction } from "../../inventory/action";
import { ReferenceTo } from "@common/utils/objectDefinitions";
import { SyncedParticleDefinition } from "@common/definitions/syncedParticles";
import { GunItem } from "../../inventory/gunItem";
import { CountableInventoryItem } from "../../inventory/inventoryItem";

export class UpdateManager {
    constructor(private player: Player) { }

    private calculateMovement(): Vector {
        let movement: Vector;

        const playerMovement = this.player.movement;
        if (this.player.isMobile && playerMovement.moving) {
            movement = Vec.fromPolar(playerMovement.angle);
        } else {
            let x = +playerMovement.right - +playerMovement.left;
            let y = +playerMovement.down - +playerMovement.up;

            if (x * y !== 0) {
                // If the product is non-zero, then both of the components must be non-zero
                x *= Math.SQRT1_2;
                y *= Math.SQRT1_2;
            }

            movement = Vec.create(x, y);
        }
        return movement;
    }

    private handleRateLimiting(): void {
        if (this.player.emoteCount > 0 && !this.player.blockEmoting && (this.player.game.now - this.player.lastRateLimitUpdate > GameConstants.player.rateLimitInterval)) {
            this.player.emoteCount--;
            this.player.lastRateLimitUpdate = this.player.game.now;
        }
    }

    private updatePerks(): void {
        if (this.player.perkUpdateMap !== undefined) {
            for (const [perk, lastUpdated] of this.player.perkUpdateMap.entries()) {
                if (this.player.game.now - lastUpdated <= perk.updateInterval) continue;

                this.player.perkUpdateMap.set(perk, this.player.game.now);
            }
        }
    }

    private handleRecoil(): number {
        return this.player.recoil.active && (this.player.recoil.active = (this.player.recoil.time >= this.player.game.now))
            ? this.player.recoil.multiplier
            : 1;
    }

    private checkBuildingsAndSmoke(): { isInsideBuilding: boolean; depleters: Set<SyncedParticle> } {
        let isInsideBuilding = false;
        const depleters = new Set<SyncedParticle>();

        for (const object of this.player.nearObjects) {
            if (
                !isInsideBuilding
                && object?.isBuilding
                && !object.dead
                && object.scopeHitbox?.collidesWith(this.player._hitbox)
                && !Config.disableBuildingCheck
            ) {
                isInsideBuilding = true;
            } else if (
                object.isSyncedParticle
                && object.hitbox?.collidesWith(this.player._hitbox)
                && adjacentOrEqualLayer(object.layer, this.player.layer)
            ) {
                depleters.add(object);
            }
        }
        return { isInsideBuilding, depleters }
    }

    private calculateSpeed(recoilMultiplier: number): number {
        return this.player.baseSpeed                                          // Base speed
            * (FloorTypes[this.player.floor].speedMultiplier ?? 1)                   // Speed multiplier from floor player is standing in
            * recoilMultiplier                                                // Recoil from items
            * (this.player.action?.speedMultiplier ?? 1)                             // Speed modifier from performing actions
            * (1 + (this.player.adrenaline / 1000))                                  // Linear speed boost from adrenaline
            * (this.player.downed ? 0.5 : this.player.activeItemDefinition.speedMultiplier) // Active item/knocked out speed modifier
            * (this.player.beingRevivedBy ? 0.5 : 1)                                 // Being revived speed multiplier
            * this.player._modifiers.baseSpeed;                                      // Current on-wearer modifier                              // Current on-wearer modifier
    }

    private updatePosition(position: Vector, movement: Vector, speed: number, dt: number): void {
        const movementVector = Vec.scale(movement, speed);
        this.player._movementVector = movementVector;

        this.player.position = Vec.add(
            position,
            Vec.scale(this.player.movementVector, dt)
        );
    }

    private handleReviving(): void {
        if (this.player.action instanceof ReviveAction) {
            if (
                Vec.squaredLength(
                    Vec.sub(
                        this.player.position,
                        this.player.action.target.position
                    )
                ) >= 7 ** 2
            ) {
                this.player.action.cancel();
            }
        }
    }

    private resolveCollisions(): void {
        this.player.nearObjects = this.player.game.grid.intersectsHitbox(this.player._hitbox, this.player.layer);

        for (let step = 0; step < 10; step++) {
            let collided = false;

            for (const potential of this.player.nearObjects) {
                if (potential.isVehicle && potential === this.player.inVehicle) continue;

                const { isObstacle, isBuilding, isVehicle } = potential;

                if (
                    (isObstacle || isBuilding || isVehicle)
                    && this.player.hitbox.radius > 0
                    && this.player.mapPerkOrDefault(
                        PerkIds.AdvancedAthletics,
                        () => {
                            return potential.definition.material !== "tree"
                                && (
                                    !isObstacle
                                    || !potential.definition.isWindow
                                    || !potential.dead
                                );
                        },
                        true
                    )
                    && potential.collidable
                    && potential.hitbox?.collidesWith(this.player._hitbox)
                ) {
                    if (isObstacle && potential.definition.isStair) {
                        const oldLayer = this.player.layer;
                        potential.handleStairInteraction(this.player);
                        if (this.player.layer !== oldLayer) this.player.setDirty();
                        this.player.activeStair = potential;
                    } else {
                        collided = true;
                        this.player._hitbox.resolveCollision(potential.hitbox);
                    }
                }
            }

            if (!collided) break;
        }
    }

    private enforceWorldBoundaries(): void {
        this.player.position.x = Numeric.clamp(this.player.position.x, this.player._hitbox.radius, this.player.game.map.width - this.player._hitbox.radius);
        this.player.position.y = Numeric.clamp(this.player.position.y, this.player._hitbox.radius, this.player.game.map.height - this.player._hitbox.radius);

    }

    private updateMovementState(oldPosition: Vector): void {
        this.player.isMoving = !Vec.equals(oldPosition, this.player.position);
        if (this.player.isMoving) {
            this.player.game.grid.updateObject(this.player);
        }
    }

    private handleInvulnerabilityAndFloor(): void {
        if (this.player.isMoving || this.player.turning) {
            this.player.disableInvulnerability();
            this.player.setPartialDirty();

            if (this.player.isMoving) {
                this.player.floor = this.player.game.map.terrain.getFloor(this.player.position, this.player.layer, this.player.game.gameMap);
            }
        }
    }


    private handleHealthRegeneration(dt: number): void {
        let toRegen = this.player._modifiers.hpRegen;
        if (this.player._adrenaline > 0) {
            // Drain adrenaline
            this.player.adrenaline -= 0.00045 * this.player._modifiers.adrenDrain * dt;

            // Regenerate health
            toRegen += (this.player.adrenaline / 70);
        }

        this.player.health += dt / 900 * toRegen;
    }

    private handleAttackingActions(): void {
        if (this.player.startedAttacking) {
            if (this.player.game.pluginManager.emit("player_start_attacking", this.player) === undefined) {
                this.player.startedAttacking = false;
                this.player.disableInvulnerability();
                this.player.activeItem.useItem();
            }
        }

        if (this.player.stoppedAttacking) {
            if (this.player.game.pluginManager.emit("player_stop_attacking", this.player) === undefined) {
                this.player.stoppedAttacking = false;
                this.player.activeItem.stopUse();
            }
        }
    }

    private applyDamages(dt: number): void {
        const gas = this.player.game.gas;
        if (gas.doDamage && gas.isInGas(this.player.position)) {
            this.player.damageHandler.piercingDamage({
                amount: gas.scaledDamage(this.player.position),
                source: KillfeedEventType.Gas
            });
        }

        if (this.player.downed && !this.player.beingRevivedBy) {
            this.player.damageHandler.piercingDamage({
                amount: GameConstants.player.bleedOutDPMs * dt,
                source: KillfeedEventType.BleedOut
            });
        }
    }

    private updateScopeAndBuildingStatus(isInsideBuilding: boolean, depleters: Set<SyncedParticle>, dt: number): void {
        // Determine if player is inside building + reduce scope in buildings
        if (!this.player.isInsideBuilding) {
            this.player.effectiveScope = isInsideBuilding
                ? DEFAULT_SCOPE
                : this.player.inventory.scope;
        }
        this.player.isInsideBuilding = isInsideBuilding;

        if (this.player.downed) {
            this.player.effectiveScope = DEFAULT_SCOPE;
        }

        let scopeTarget: ReferenceTo<ScopeDefinition> | undefined;
        depleters.forEach(depleter => {
            const def = depleter.definition;
            const depletion = def.depletePerMs;

            // For convenience and readability
            type ScopeBlockingParticle = SyncedParticleDefinition & { readonly hitbox: Hitbox };
            // If lifetime - age > scope out time, we have the potential to zoom in the scope
            if (depleter._lifetime - (this.player.game.now - depleter._creationDate)
                >= ((def as ScopeBlockingParticle).scopeOutPreMs ?? 0)) {
                scopeTarget ??= (def as ScopeBlockingParticle).snapScopeTo;
            }

            if (depletion.health) {
                this.player.damageHandler.piercingDamage({
                    amount: depletion.health * dt,
                    source: KillfeedEventType.Gas
                    //          ^^^^^^^^^^^^^^^^^^^^^ dubious
                });
            }

            if (depletion.adrenaline) {
                this.player.adrenaline -= depletion.adrenaline * dt;
            }
        });

        if (scopeTarget !== undefined || this.player.isInsideBuilding || this.player.downed) {
            this.player.effectiveScope = scopeTarget ?? DEFAULT_SCOPE;
        }
    }

    private handleAutomaticDoors(isInsideBuilding: boolean): void {
        const openedDoors: Obstacle[] = [];
        const unopenedDoors: Obstacle[] = [];

        for (const door of this.player.game.grid.intersectsHitbox(new CircleHitbox(10, this.player.position), this.player.layer)) {
            if (
                door.dead
                || !door?.isObstacle
                || !door.definition.isDoor
                || !door.definition.automatic
                || door.door?.isOpen
                || !isInsideBuilding // womp womp
            ) continue;

            if (Geometry.distanceSquared(door.position, this.player.position) > 100) {
                unopenedDoors.push(door);
                continue;
            }

            door.interact();
            openedDoors.push(door);
        }

        for (const door of unopenedDoors) {
            if (openedDoors.every(d => Geometry.distanceSquared(door.position, d.position) > 300)) continue; // Don't open the door if there are no other open doors in range

            door.interact();
            openedDoors.push(door);
        }

        const closeDoors = (): void => {
            if (openedDoors.every(obj => Geometry.distanceSquared(obj.position, this.player.position) >= 100)) {
                for (const door of openedDoors) {
                    if (!door.dead) door.interact();
                }
            } else {
                this.player.game.addTimeout(closeDoors, 1000);
            }
        };
        this.player.game.addTimeout(closeDoors, 1000);
    }

    update(): void {
        const dt = this.player.game.dt;

        // Improvement: Only update modifiers if dirty
        if (this.player.dirty.modifiers) {
            this.player.updateAndApplyModifiers();
            this.player.dirty.modifiers = false;
        }

        this.handleRateLimiting();
        this.updatePerks();

        const recoilMultiplier = this.handleRecoil();
        const speed = this.calculateSpeed(recoilMultiplier);

        const { isInsideBuilding, depleters } = this.checkBuildingsAndSmoke();

        const oldPosition = Vec.clone(this.player.position);

        const movement = this.calculateMovement();
        if (!this.player.inVehicle) {
            this.updatePosition(this.player.position, movement, speed, dt);
            this.handleReviving();
            this.resolveCollisions();
            this.enforceWorldBoundaries();
            this.handleAttackingActions();
            this.handleAutomaticDoors(isInsideBuilding);
        } 

        this.updateMovementState(oldPosition);

        this.handleInvulnerabilityAndFloor();

        this.handleHealthRegeneration(dt);

        this.applyDamages(dt);

        this.updateScopeAndBuildingStatus(isInsideBuilding, depleters, dt);

        this.player.turning = false;
        this.player.game.pluginManager.emit("player_update", this.player);
    }

    private _firstPacket = true;

    // private readonly _packetStream = new PacketStream(new SuroiByteStream(new ArrayBuffer(1 << 16)));

    /**
     * Calculate visible objects, check team, and send packets
     */
    secondUpdate(): void {
        const packet: SMutable<Partial<UpdatePacketDataIn>> = {};

        const player = this.player.spectating ?? this.player;
        if (this.player.spectating) {
            this.player.layer = this.player.spectating.layer;
        }
        const game = this.player.game;

        const fullObjects = new Set<BaseGameObject>();

        // Calculate visible objects
        this.player.ticksSinceLastUpdate++;
        if (this.player.ticksSinceLastUpdate > 8 || game.updateObjects || this.player.updateObjects) {
            this.player.ticksSinceLastUpdate = 0;
            this.player.updateObjects = false;

            const dim = player.zoom * 2 + 8;
            this.player.screenHitbox = RectangleHitbox.fromRect(dim, dim, player.position);

            const visCache = new ExtendedMap<GameObject, boolean>();
            const newVisibleObjects = game.grid.intersectsHitbox(this.player.screenHitbox);

            packet.deletedObjects = [...this.player.visibleObjects]
                .filter(
                    object => {
                        if (object.isVehicle) {
                            return false;
                        }

                        return (
                            (
                                !newVisibleObjects.has(object)
                                || !isVisibleFromLayer(this.player.layer, object, object?.hitbox && [...game.grid.intersectsHitbox(object.hitbox)])
                            )
                            && (this.player.visibleObjects.delete(object), true)
                            && (!object.isObstacle || !object.definition.isStair)  // Existing stair skip
                        );
                    }
                )
                .map(({ id }) => id);

            newVisibleObjects
                .forEach(
                    object => {
                        if (
                            (
                                this.player.visibleObjects.has(object)
                                || !(
                                    visCache.getAndGetDefaultIfAbsent(
                                        object,
                                        () => isVisibleFromLayer(this.player.layer, object, object?.hitbox && [...game.grid.intersectsHitbox(object.hitbox)])
                                    )
                                )
                            )
                            && (!object.isObstacle || !object.definition.isStair)
                        ) return;

                        this.player.visibleObjects.add(object);
                        fullObjects.add(object);
                    }
                );
        }

        for (const object of game.fullDirtyObjects) {
            if (!this.player.visibleObjects.has(object as GameObject)) continue;
            fullObjects.add(object);
        }

        packet.partialObjectsCache = [...game.partialDirtyObjects].filter(
            object => this.player.visibleObjects.has(object as GameObject) && !fullObjects.has(object)
        );

        const inventory = player.inventory;
        let forceInclude = false;

        if (this.player.startedSpectating && this.player.spectating) {
            forceInclude = true;

            // this line probably doesn't do anything
            // packet.fullObjectsCache.push(this.player.spectating);
            this.player.startedSpectating = false;
        } else if (this.player.resurrected) {
            forceInclude = true;
            this.player.resurrected = false;
        }

        packet.playerData = {
            ...(
                player.dirty.maxMinStats || forceInclude
                    ? {
                        minMax: {
                            maxHealth: player.maxHealth,
                            minAdrenaline: player.minAdrenaline,
                            maxAdrenaline: player.maxAdrenaline
                        }
                    }
                    : {}
            ),
            ...(
                player.dirty.health || forceInclude
                    ? { health: player._normalizedHealth }
                    : {}
            ),
            ...(
                player.dirty.adrenaline || forceInclude
                    ? { adrenaline: player._normalizedAdrenaline }
                    : {}
            ),
            ...(
                player.dirty.zoom || forceInclude
                    ? { zoom: player._scope.zoomLevel }
                    : {}
            ),
            ...(
                player.dirty.id || forceInclude
                    ? {
                        id: {
                            id: player.id,
                            spectating: this.player.spectating !== undefined
                        }
                    }
                    : {}
            ),
            ...(
                player.dirty.teammates || forceInclude
                    ? { teammates: player._team?.players ?? [] }
                    : {}
            ),
            ...(
                player.dirty.weapons || forceInclude
                    ? {
                        inventory: {
                            activeWeaponIndex: inventory.activeWeaponIndex,
                            weapons: inventory.weapons.map(slot => {
                                const item = slot;

                                return (item && {
                                    definition: item.definition,
                                    count: item instanceof GunItem
                                        ? item.ammo
                                        : item instanceof CountableInventoryItem
                                            ? item.count
                                            : undefined,
                                    stats: item.stats
                                }) satisfies ((PlayerData["inventory"] & object)["weapons"] & object)[number];
                            })
                        }
                    }
                    : {}
            ),
            ...(
                player.dirty.slotLocks || forceInclude
                    ? { lockedSlots: player.inventory.lockedSlots }
                    : {}
            ),
            ...(
                player.dirty.items || forceInclude
                    ? {
                        items: {
                            items: inventory.items.asRecord(),
                            scope: inventory.scope
                        }
                    }
                    : {}
            ),
            ...(
                player.dirty.layer || forceInclude
                    ? { layer: player.layer }
                    : {}
            ),
            ...(
                player.dirty.perks || forceInclude
                    ? { perks: this.player.perks }
                    : {}
            ),
            ...(
                player.dirty.teamID || forceInclude
                    ? { teamID: player.teamID }
                    : {}
            )
        };

        // Cull bullets
        /*
            oversight: this works by checking if the bullet's trajectory overlaps the player's
                       viewing port; if it does, the player will eventually see the bullet,
                       and we should thus send it. however, it overlooks the fact that the
                       viewing port can move as the bullet travels. this causes a potential
                       for ghost bullets, but since most projectiles travel their range within
                       well under a second (usually between 0.3–0.8 seconds), the chance of this
                       happening is quite low (except with slow-projectile weapons like the radio
                       and firework launcher).
 
                       fixing this is therefore not worth the performance penalty
        */
        packet.bullets = game.newBullets.filter(
            ({ initialPosition, finalPosition }) => Collision.lineIntersectsRectTest(
                initialPosition,
                finalPosition,
                this.player.screenHitbox.min,
                this.player.screenHitbox.max
            )
        );

        /**
         * It's in times like these where `inline constexpr`
         * would be very cool.
         */
        const maxDistSquared = 128 ** 2;

        // Cull explosions
        packet.explosions = game.explosions.filter(
            ({ position }) => this.player.screenHitbox.isPointInside(position)
                || Geometry.distanceSquared(position, this.player.position) < maxDistSquared
        );

        // Emotes
        packet.emotes = game.emotes.filter(({ player }) => this.player.visibleObjects.has(player));

        const gas = game.gas;

        packet.gas = gas.dirty || this._firstPacket ? { ...gas } : undefined;
        packet.gasProgress = gas.completionRatioDirty || this._firstPacket ? gas.completionRatio : undefined;

        const newPlayers = this._firstPacket
            ? [...game.grid.pool.getCategory(ObjectCategory.Player)]
            : game.newPlayers;

        // new and deleted players
        packet.newPlayers = newPlayers.map(({ id, name, hasColor, nameColor, loadout: { badge } }) => ({
            id,
            name,
            hasColor,
            nameColor: hasColor ? nameColor : undefined,
            badge
        } as (UpdatePacketDataCommon["newPlayers"] & object)[number]));

        if (this.player.game.teamMode) {
            for (const teammate of newPlayers.filter(({ teamID }) => teamID === player.teamID)) {
                fullObjects.add(teammate);
            }
        }

        packet.fullObjectsCache = [...fullObjects];

        packet.deletedPlayers = game.deletedPlayers;

        // alive count
        packet.aliveCount = game.aliveCountDirty || this._firstPacket ? game.aliveCount : undefined;

        // killfeed messages
        const killLeader = game.killLeader;

        packet.planes = game.planes;
        packet.mapPings = [...game.mapPings, ...this.player._mapPings];
        this.player._mapPings.length = 0;

        // serialize and send update packet
        this.player.sendPacket(UpdatePacket.create(packet as UpdatePacketDataIn));

        if (this._firstPacket && killLeader) {
            this.player.sendPacket(KillFeedPacket.create({
                messageType: KillfeedMessageType.KillLeaderAssigned,
                victimId: killLeader.id,
                attackerKills: killLeader.kills,
                hideFromKillfeed: true
            }));
        }

        this._firstPacket = false;
    }
}