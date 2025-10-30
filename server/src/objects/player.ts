import { AnimationType, GameConstants, Layer, ObjectCategory, PlayerActions } from "@common/constants";
import { Ammos } from "@common/definitions/ammos";
import { type BadgeDefinition } from "@common/definitions/badges";
import { Emotes, type EmoteDefinition } from "@common/definitions/emotes";
import { type GunDefinition } from "@common/definitions/guns";
import { Loots, type WeaponDefinition } from "@common/definitions/loots";
import { type MeleeDefinition } from "@common/definitions/melees";
import { type ObstacleDefinition } from "@common/definitions/obstacles";
import { Perks, type PerkDefinition, type PerkNames } from "@common/definitions/perks";
import { DEFAULT_SCOPE, Scopes, type ScopeDefinition } from "@common/definitions/scopes";
import { type SkinDefinition } from "@common/definitions/skins";
import { type PlayerInputData } from "@common/packets/inputPacket";
import { type InputPacket } from "@common/packets/packet";
import { CircleHitbox, RectangleHitbox } from "@common/utils/hitbox";
import { Numeric } from "@common/utils/math";
import { type SDeepMutable, type Timeout } from "@common/utils/misc";
import { defaultModifiers, ItemType, type ReferenceTo, type ReifiableDef } from "@common/utils/objectDefinitions";
import { type FullData } from "@common/utils/objectsSerializations";
import { FloorNames } from "@common/utils/terrain";
import { Vec, type Vector } from "@common/utils/vector";
import { type Game } from "../game";
import { HealingAction, ReloadAction, type Action } from "../inventory/action";
import { GunItem } from "../inventory/gunItem";
import { Inventory } from "../inventory/inventory";
import { InventoryItem } from "../inventory/inventoryItem";
import { MeleeItem } from "../inventory/meleeItem";
import { ServerPerkManager, UpdatablePerkDefinition } from "../inventory/perkManager";
import { type Team } from "../team";
import { BaseGameObject, type DamageParams, type GameObject } from "./gameObject";
import { type Obstacle } from "./obstacle";
import { weaponPresentType } from "@common/typings";
import { Maps } from "@common/definitions/modes";

import { InputHandler } from "./player/inputHandler";
import { ModifierCalculator } from "./player/modifierCalculator";
import { InventoryHelper } from "./player/inventoryHelper";
import { CommunicationHandler } from "./player/communicationHandler";
import { DamageHandler } from "./player/damageHandler";
import { UpdateManager } from "./player/updateManager";


export interface ActorContainer {
    readonly teamID?: string
    readonly autoFill: boolean
    readonly ip: string | undefined
    readonly nameColor?: number
    readonly lobbyClearing: boolean
    readonly weaponPreset: string
}

export class Player extends BaseGameObject.derive(ObjectCategory.Player) {
    private static readonly baseHitbox = new CircleHitbox(GameConstants.player.radius);

    override readonly fullAllocBytes = 16;
    override readonly partialAllocBytes = 14;
    override readonly damageable = true;

    // Delegated modules
    private readonly inputHandler: InputHandler;
    modifierCalculator: ModifierCalculator;
    inventoryHelper: InventoryHelper;
    communicationHandler: CommunicationHandler;
    damageHandler: DamageHandler;
    updateManager: UpdateManager;

    _hitbox: CircleHitbox;
    override get hitbox(): CircleHitbox { return this._hitbox; }

    name: string;
    address: string = "";
    readonly ip?: string;

    activeBloodthirstEffect = false;
    activeDisguise?: ObstacleDefinition;

    teamID?: number;
    colorIndex = 0; // Assigned in the team.ts file.

    // Rate Limiting: Team Pings & Emotes.
    emoteCount = 0;
    lastRateLimitUpdate = 0;
    blockEmoting = false;

    readonly loadout: {
        badge?: BadgeDefinition
        skin: SkinDefinition
        emotes: ReadonlyArray<EmoteDefinition | undefined>
    };

    joined = false;
    disconnected = false;
    resurrected = false;

    _team?: Team;
    get team(): Team | undefined { return this._team; }

    set team(value: Team) {
        if (!this.game.teamMode) {
            console.warn("Trying to set a player's team while the game isn't in team mode");
            return;
        }

        this.dirty.teammates = true;
        this._team = value;
    }

    _kills = 0;
    get kills(): number { return this._kills; }
    set kills(kills: number) {
        this._kills = kills;
        this.dirty.modifiers = true; // Added: Mark modifiers dirty on kills change
        this.game.updateKillLeader(this);
    }

    private _maxHealth = GameConstants.player.defaultHealth;
    get maxHealth(): number { return this._maxHealth; }
    set maxHealth(maxHealth: number) {
        this._maxHealth = maxHealth;
        this.dirty.maxMinStats = true;
        this._team?.setDirty();
        this.health = this._health;
    }

    private _health = this._maxHealth;

    _normalizedHealth = 0;
    get normalizedHealth(): number { return this._normalizedHealth; }

    get health(): number { return this._health; }
    set health(health: number) {
        this._health = Numeric.min(health, this._maxHealth);
        this._team?.setDirty();
        this.dirty.health = true;
        this._normalizedHealth = Numeric.remap(this.health, 0, this.maxHealth, 0, 1);
    }

    private _maxAdrenaline = GameConstants.player.maxAdrenaline;

    _normalizedAdrenaline = 0;
    get normalizedAdrenaline(): number { return this._normalizedAdrenaline; }

    get maxAdrenaline(): number { return this._maxAdrenaline; }
    set maxAdrenaline(maxAdrenaline: number) {
        this._maxAdrenaline = maxAdrenaline;
        this.dirty.maxMinStats = true;
        this.adrenaline = this._adrenaline;
    }

    private _minAdrenaline = 0;
    get minAdrenaline(): number { return this._minAdrenaline; }
    set minAdrenaline(minAdrenaline: number) {
        this._minAdrenaline = Numeric.min(minAdrenaline, this._maxAdrenaline);
        this.dirty.maxMinStats = true;
        this.adrenaline = this._adrenaline;
    }

    _adrenaline = this._minAdrenaline;
    get adrenaline(): number { return this._adrenaline; }
    set adrenaline(adrenaline: number) {
        this._adrenaline = Numeric.clamp(adrenaline, this._minAdrenaline, this._maxAdrenaline);
        this.dirty.adrenaline = true;
        this._normalizedAdrenaline = Numeric.remap(this.adrenaline, this.minAdrenaline, this.maxAdrenaline, 0, 1);
    }

    _sizeMod = 1;
    get sizeMod(): number { return this._sizeMod; }
    set sizeMod(size: number) {
        if (this._sizeMod === size) return;
        this._sizeMod = size;
        this._hitbox = Player.baseHitbox.transform(this._hitbox.position, size);
        this.dirty.size = true;
        this.setDirty();
    }

    _modifiers = defaultModifiers();

    killedBy?: Player;
    downedBy?: {
        readonly player: Player
        readonly item?: InventoryItem
    };

    damageDone = 0;
    damageTaken = 0;
    readonly joinTime: number;

    readonly recoil = {
        active: false,
        time: 0,
        multiplier: 1
    };

    isMoving = false;

    movement = {
        up: false,
        down: false,
        left: false,
        right: false,
        // mobile
        moving: false,
        angle: 0
    };

    isMobile!: boolean;

    /**
     * Whether the player is attacking as of last update
     */
    attacking = false;

    /**
     * Whether the player started attacking last update
     */
    startedAttacking = false;

    /**
     * Whether the player stopped attacking last update
     */
    stoppedAttacking = false;

    /**
     * Whether the player is turning as of last update
     */
    turning = false;

    /**
     * The distance from the player position to the player mouse in game units
     */
    distanceToMouse = GameConstants.player.maxMouseDist;

    /**
     * Keeps track of various fields which are "dirty"
     * and therefore need to be sent to the client for
     * updating
     */
    readonly dirty = {
        id: true,
        teammates: true,
        health: true,
        maxMinStats: true,
        adrenaline: true,
        size: true,
        weapons: true,
        slotLocks: true,
        items: true,
        zoom: true,
        layer: true,
        activeC4s: true,
        perks: true,
        teamID: true,
        modifiers: false // Added: Dirty flag for modifiers
    };

    readonly inventory = new Inventory(this);

    get activeItemIndex(): number {
        return this.inventory.activeWeaponIndex;
    }

    get activeItem(): InventoryItem {
        return this.inventory.activeWeapon;
    }

    get activeItemDefinition(): WeaponDefinition {
        return this.activeItem.definition;
    }

    bufferedAttack?: Timeout;

    private readonly _animation = {
        type: AnimationType.None,
        dirty: true
    };

    get animation(): AnimationType { return this._animation.type; }
    set animation(animType: AnimationType) {
        const animation = this._animation;
        animation.type = animType;
        animation.dirty = true;
    }

    /**
     * Objects the player can see
     */
    readonly visibleObjects = new Set<GameObject>();

    updateObjects = true;

    /**
     * Objects near the player hitbox
     */
    nearObjects = new Set<GameObject>();

    /**
     * Ticks since last visible objects update
     */
    ticksSinceLastUpdate = 0;

    _scope!: ScopeDefinition;
    get effectiveScope(): ScopeDefinition { return this._scope; }
    set effectiveScope(target: ReifiableDef<ScopeDefinition>) {
        const scope = Scopes.reify(target);
        if (this._scope === scope) return;

        this._scope = scope;
        this.dirty.zoom = true;
        this.updateObjects = true;
    }

    get zoom(): number { return this._scope.zoomLevel; }

    private readonly _action: { type?: Action, dirty: boolean } = {
        type: undefined,
        dirty: true
    };

    get action(): Action | undefined { return this._action.type; }
    set action(value: Action | undefined) {
        const action = this._action;
        const wasReload = action.type?.type === PlayerActions.Reload;

        action.type = value;
        action.dirty = true;

        if (
            !wasReload
            && value === undefined
            && this.activeItem instanceof GunItem
            && this.activeItem.ammo <= 0
            && this.inventory.items.hasItem((this.activeItemDefinition as GunDefinition).ammoType)
        ) {
            // The action slot is now free, meaning our player isn't doing anything
            // Let's try reloading our empty gun then, unless we just cancelled a reload
            action.type = new ReloadAction(this, this.activeItem);
            action.dirty = true;
        }
    }

    spectating?: Player;
    startedSpectating = false;
    spectators = new Set<Player>();
    lastSpectateActionTime = 0;
    lastPingTime = 0;

    readonly hasColor: boolean;
    readonly nameColor: number;

    /**
     * Used to make players invulnerable for 5 seconds after spawning or until they move
     */
    invulnerable = true;

    /**
     * Determines if the player can despawn
     * Set to false once the player picks up loot
     */
    canDespawn = true;

    lastFreeSwitch = 0;
    effectiveSwitchDelay = 0;

    isInsideBuilding = false;

    floor = FloorNames.Water;

    screenHitbox = RectangleHitbox.fromRect(1, 1);

    downed = false;
    beingRevivedBy?: Player;

    activeStair?: Obstacle;

    get position(): Vector {
        return this._hitbox.position;
    }

    set position(position: Vector) {
        if (Vec.equals(position, this.position)) return;

        this._hitbox.position = position;
        this._team?.setDirty();
    }

    baseSpeed = GameConstants.player.baseSpeed;

    _movementVector = Vec.create(0, 0);
    get movementVector(): Vector { return Vec.clone(this._movementVector); }

    spawnPosition: Vector = Vec.create(this.game.map.width / 2, this.game.map.height / 2);

    _mapPings: Game["mapPings"] = [];

    readonly perks = new ServerPerkManager(this, Perks.defaults);
    perkUpdateMap?: Map<UpdatablePerkDefinition, number>; // key = perk, value = last updated

    constructor(game: Game, userData: ActorContainer, position: Vector, layer?: Layer, team?: Team) {
        super(game, position);

        if (layer !== undefined) {
            this.layer = layer;
        }

        if (team) {
            this._team = team;
            this.teamID = team.id;

            team.addPlayer(this);
            team.setDirty();
        }

        this.inputHandler = new InputHandler(this);
        this.modifierCalculator = new ModifierCalculator(this);
        this.inventoryHelper = new InventoryHelper(this);
        this.communicationHandler = new CommunicationHandler(this);
        this.damageHandler = new DamageHandler(this);
        this.updateManager = new UpdateManager(this);

        this.name = GameConstants.player.defaultName;
        this.ip = userData.ip;
        this.nameColor = userData.nameColor ?? 0;
        this.hasColor = userData.nameColor !== undefined;

        this.loadout = {
            skin: Loots.fromString("unknown"),
            emotes: [
                Emotes.fromStringSafe("happy_face"),
                Emotes.fromStringSafe("thumbs_up"),
                undefined,
                undefined,
                undefined,
                undefined
            ]
        };

        this.rotation = 0;
        this.joinTime = game.now;
        this._hitbox = Player.baseHitbox.transform(position);

        this.inventory.addOrReplaceWeapon(2, "fists");

        const defaultScope = Maps[this.game.gameMap].defaultScope;
        if (defaultScope) {
            this.inventory.scope = defaultScope;
            this.inventory.items.setItem(defaultScope, 1);
        } else {
            this.inventory.scope = DEFAULT_SCOPE.idString;
        }
        this.effectiveScope = DEFAULT_SCOPE;

        // Inventory preset
        {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
            const getWeapon: weaponPresentType = userData?.weaponPreset.startsWith("{")
                ? JSON.parse(userData.weaponPreset)
                : undefined;

            const backpack = this.inventory.backpack;
            const determinePreset = (
                slot: 0 | 1 | 2,
                weaponName: ReferenceTo<GunDefinition | MeleeDefinition>
            ): void => {
                const weaponDef = Loots.fromStringSafe<GunDefinition | MeleeDefinition>(weaponName);
                let itemType: ItemType;

                if (
                    weaponDef === undefined // no such item
                    || ![ItemType.Gun, ItemType.Melee].includes(itemType = weaponDef.itemType) // neither gun nor melee
                    || GameConstants.player.inventorySlotTypings[slot] !== itemType // invalid type
                ) return;

                this.inventory.addOrReplaceWeapon(slot, weaponDef);
                const weapon = this.inventory.getWeapon(slot) as GunItem | MeleeItem;

                if (!(weapon instanceof GunItem)) return;
                weapon.ammo = (weaponDef as GunDefinition).capacity;
                const ammoPtr = (weaponDef as GunDefinition).ammoType;
                const ammoType = Ammos.fromString(ammoPtr);

                if (ammoType.ephemeral) return;
                this.inventory.items.setItem(ammoPtr, backpack.maxCapacity[ammoPtr]);
            };

            if (getWeapon?.gun) determinePreset(0, getWeapon.gun);
            if (getWeapon?.throwable) determinePreset(1, getWeapon.throwable);
            if (getWeapon?.melee) determinePreset(2, getWeapon.melee);

            if (this.maxAdrenaline !== GameConstants.player.maxAdrenaline) {
                this.adrenaline = this.maxAdrenaline;
            }

            this.dirty.weapons = true;
            this.dirty.modifiers = true; // Added: Mark modifiers dirty after inventory changes
            this.modifierCalculator.updateAndApplyModifiers();
        }
    }

    spawnPos(position: Vector): void {
        this.spawnPosition = position;
    }


    update(): void {
        this.updateManager.update();
    }

    secondUpdate(): void {
        this.updateManager.secondUpdate();
    }

    die(params: Omit<DamageParams, "amount">) {
        this.damageHandler.die(params);
    }

    updateAndApplyModifiers(): void {
        this.modifierCalculator.updateAndApplyModifiers();
    }

    /**
     * Clean up internal state after all packets have been sent
     * to all recipients. The only code that should be present here
     * is clean up code that cannot be in `secondUpdate` because packets
     * depend on it
     */
    postPacket(): void {
        for (const key in this.dirty) {
            this.dirty[key as keyof Player["dirty"]] = false;
        }
        this._animation.dirty = false;
        this._action.dirty = false;
    }

    hasPerk(perk: PerkNames | PerkDefinition): boolean {
        return this.perks.hasItem(perk);
    }

    ifPerkPresent<Name extends PerkNames>(
        perk: Name | PerkDefinition & { readonly idString: Name },
        cb: (data: PerkDefinition & { readonly idString: Name }) => void
    ): void {
        return this.perks.ifPresent<Name>(perk, cb);
    }

    mapPerk<Name extends PerkNames, U>(
        perk: Name | PerkDefinition & { readonly idString: Name },
        mapper: (data: PerkDefinition & { readonly idString: Name }) => U
    ): U | undefined {
        return this.perks.map<Name, U>(perk, mapper);
    }

    mapPerkOrDefault<Name extends PerkNames, U>(
        perk: Name | PerkDefinition & { readonly idString: Name },
        mapper: (data: PerkDefinition & { readonly idString: Name }) => U,
        defaultValue: U
    ): U {
        return this.perks.mapOrDefault<Name, U>(perk, mapper, defaultValue);
    }

    disableInvulnerability(): void {
        if (this.invulnerable) {
            this.invulnerable = false;
            this.setDirty();
        }
    }

    protected readonly _packets: InputPacket[] = [];

    sendPacket(packet: InputPacket): void {
        this._packets.push(packet);
    }

    disconnect(reason?: string): void {
        // timeout to make sure disconnect packet is sent
        setTimeout(() => {
            this.game.removePlayer(this);
        }, 10);
    }

    override damage(params: DamageParams): void {
        this.damageHandler.damage(params);
    }

    canInteract(player: Player): boolean {
        return this.damageHandler.canInteract(player);
    }

    interact(reviver: Player): void {
        this.damageHandler.interact(reviver);
    }

    processInputs(packet: PlayerInputData): void {
        this.inputHandler.processInputs(packet);
    }

    executeAction(action: Action): void {
        if (this.downed) return;
        this.action?.cancel();
        this.action = action;
    }

    /**
     * Destroys the player instance and cleans up resources to prevent memory leaks.
     * This should be called when removing bots or disconnected players.
     * Assumes the player has already been removed from game collections (e.g., via game.removePlayer).
     */
    destroy(): void {
        // Clear collections and sets
        this.visibleObjects.clear();
        this.nearObjects.clear();
        this.spectators.clear();
        this._mapPings = [];

        this.bufferedAttack = undefined;
        this.action?.cancel();

        // Clear packets buffer
        this._packets.length = 0;

        // Null out references
        this.spectating = undefined;
        this.killedBy = undefined;
        this.downedBy = undefined;
        this.beingRevivedBy = undefined;
        this.activeStair = undefined;
        this._team = undefined;

        // Mark as destroyed to prevent further updates
        this.dead = true;
        this.disconnected = true;
    }

    override get data(): FullData<ObjectCategory.Player> {
        const data: SDeepMutable<FullData<ObjectCategory.Player>> = {
            position: this.position,
            rotation: this.rotation,
            full: {
                layer: this.layer,
                dead: this.dead,
                downed: this.downed,
                beingRevived: !!this.beingRevivedBy,
                teamID: this.teamID ?? 0,
                invulnerable: this.invulnerable,
                activeItem: this.activeItem.definition,
                skin: this.loadout.skin,
                helmet: this.inventory.helmet,
                vest: this.inventory.vest,
                backpack: this.inventory.backpack,
                halloweenThrowableSkin: false,
                activeDisguise: this.activeDisguise,
                blockEmoting: this.blockEmoting
            }
        };

        if (this.dirty.size) {
            data.full.sizeMod = this._sizeMod;
        }

        if (this._animation.dirty) {
            data.animation = this.animation;
        }

        if (this._action.dirty) {
            data.action = this.action instanceof HealingAction
                ? { type: PlayerActions.UseItem, item: this.action.item }
                : { type: (this.action?.type ?? PlayerActions.None) as Exclude<PlayerActions, PlayerActions.UseItem> };
        }

        if(this.hitbox.radius === 0) {
            data.noSize = true;
        }
        return data;
    }

    isBot(): boolean {
        return false;
    }
}