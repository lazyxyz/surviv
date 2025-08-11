import { DeepPartial } from "../utils/misc";
import {
    ItemType,
    ObjectDefinitions,
    type ItemDefinition
} from "../utils/objectDefinitions";

/*
    `@stylistic/no-multi-spaces`: Disabled to allow nicer alignment
*/

export interface SkinDefinition extends ItemDefinition {
    readonly itemType: ItemType.Skin
    readonly hideFromLoadout: boolean
    readonly grassTint: boolean
    readonly backpackTint?: number
    readonly hideEquipment: boolean
    readonly rolesRequired?: string[]
    readonly hideBlood: boolean
    readonly noSwap?: boolean
}

export const DEFAULT_SKIN: string = "unknown";

const defaultSkin = {
    itemType: ItemType.Skin,
    noDrop: false,
    hideFromLoadout: false,
    grassTint: false,
    hideEquipment: false,
    hideBlood: false
} satisfies DeepPartial<SkinDefinition> as DeepPartial<SkinDefinition>;

export const Skins = ObjectDefinitions.withDefault<SkinDefinition>()(
    "Skins",
    defaultSkin,
    ([derive, , createTemplate]) => {
        const skin = derive((name: string, backpackTint?: number) => ({
            idString: name.toLowerCase().replace(/'/g, "").replace(/ /g, "_"),
            backpackTint,
            name
        }));

        return [
            ...(
                [
                    ["Bitcoin", 0xf7931a],
                    ["Ethereum", 0x8198ee],
                    ["Shiba", 0xf00500],
                    ["Chill guy", 0x4b4b4b],
                    ["Doge", 0xa67a2e],

                    ["Troll", 0xffffff],
                    ["Giggle", 0xfede58],
                    ["Nerdy", 0xfede58],
                    ["Silly", 0xffffff],
                    ["Red hat", 0xed2224],
                    ["Smudge", 0xff64ab],
                    ["Fine", 0xfca603],
                    ["Santa", 0xb31f25],
                    ["Autobot", 0x0052b4],
                    ["Roll safe", 0xffffff],
                    ["Derpina", 0xac9393],
                    ["Puppet", 0xffffff],
                    ["Derp", 0xc4ffc3],
                    ["Yuno", 0xf5e600],
                    ["Stonks", 0xce947b],
                    ["Wojax", 0xffffff],
                    ["Smug", 0xf5e600],
                    ["Squidward", 0xb1d5c4],
                    ["Ugandan", 0xbc2634],
                    ["Shishi", 0xde1313],
                    ["Globe", 0x926dfe],
                    ["Moai", 0x585858],
                    ["Ahegao", 0xf4a5aa],
                    ["Melonpan", 0xf8e7b9],

                    ["Elon", 0xcfb66c],
                    ["Vitalik", 0x708ff2],
                    ["Satoshi", 0x4f8205],
                    ["Sakura", 0xfee8ce],
                    ["Azumi", 0xf9cfae],
                    ["Astro", 0x3e3e3e],
                    ["Lumi", 0xfee1c7],
                    ["Sasukute", 0xc69c6d],

                    ["CBD", 0xb8e024],
                    ["Pine", 0xbd732a],
                    ["Woody", 0x824c20],
                    ["Pizza", 0xfed29a],
                    ["Brush", 0x784421],
                    ["Cash", 0x71c837],
                    ["Radar", 0x000000],
                    ["Pigeon", 0x0000ff],
                    ["Mortal", 0xff3d00],
                    ["Unknown", 0xd7e3f4],
                    ["Spaceship", 0xff88cc],
                    ["Martyrs", 0x718954],
                    ["Lemon", 0xf4fadb],
                    ["Root", 0x95d786],
                    ["Cookie", 0xd69241],
                    ["Warrior", 0xf4f3f3],
                    ["Catton", 0xd38d5f],
                    ["Sphere", 0x1d667f],
                    ["Ghost", 0x000000],

                    ["Ninja", 0x191919],
                    ["Solider", 0x7b8c42],
                    ["Kid", 0xbf5f00],
                    ["Wolverine", 0x474747],
                    ["No face", 0xe8dec0],
                    ["Peace", 0x000000],
                    ["Captain", 0xffffff],
                    ["Saita", 0xe3cba1],
                    ["Baller", 0xffffff],
                    ["Hulk", 0x2f7b18],
                    ["Jack", 0xff8838],
                    ["Solar", 0xe0a242],
                    ["Bibi", 0xff59a1],
                    ["Skeleton", 0xffffff],
                    ["Slime", 0xa7bf65],
                    ["Turle", 0x36b37e],
                    ["Zombie", 0xabc837],
                    ["Cosmo", 0xffffff],
                    ["Zone", 0xf9ce27],
                    ["Meow", 0x606060],
                    ["Devil", 0xee3224],

                    ["Bear", 0x803300],
                    ["Peppa", 0xb76b37],
                    ["Draco", 0x3f7f00],
                    ["Dumbo", 0x939dac],
                    ["Fettgans", 0xffb928],
                    ["Tiger", 0x997300],
                    ["Teddy", 0x29abe2],
                    ["Zebra", 0xfad5e5],
                    ["Bull", 0x784421],
                    ["Dino", 0xb69837],
                    ["Sheep", 0xffffff],
                    ["Wolf", 0x917c6f],
                    ["Hippo", 0x963bb6],
                    ["Rhino", 0x74849d],
                    ["Bee", 0xffcd01],
                    ["Monky", 0x794522],
                    ["Android", 0xa4a4a4],
                    ["Cow", 0x4d4d4d],
                    ["Lion", 0xdca986],
                    ["Snake", 0xeae233],
                    ["Crow", 0x251b23],

                    // country
                    ["America", 0x0052B4],
                    ["England", 0xFFFFFF],
                    ["Germany", 0xFFDA44],
                    ["Canada", 0xD80027],
                    ["France", 0xFFFFFF],
                    ["China", 0xD80027],
                    ["Thailand", 0xFFFFFF],
                    ["Japan", 0xD80027],
                    ["Malaysia", 0x0052B4],
                    ["Brazil", 0x253370],
                    ["Switzerland", 0xD80027],
                    ["South Korea", 0x0052B4],
                    ["Vietnam", 0xFFDA44],
                    ["Norway", 0xD80027],
                    ["Denmark", 0xD80027],
                    ["Israel", 0x0052B4],
                    ["Italy", 0x009245],
                    ["Argentina", 0x75ACDD],
                    ["Portugal", 0x076629],
                    ["India", 0xF89939],
                    ["Spain", 0xC60B1E],
                    ["Croatia", 0xED2224],
                    ["Saudi Arabia", 0x3D9635],
                    ["Algeria", 0xDF2428],
                    ["Ukraine", 0x0066CC],
                    ["Vanuatu", 0xF9DB47],
                    ["Sudan", 0x009245],
                    ["Congo", 0xED1C24],
                    ["Romania", 0xFCD116],
                    ["South Africa", 0xC88A00],
                    ["Finland", 0x003473],
                    ["Slovakia", 0x0052B4],
                    ["North Korea", 0xED1C27],
                    ["Turkey", 0xE30A17],
                    ["Australia", 0xC8102E],
                    ["Taiwan", 0x0052B4],
                    ["Senegal", 0xFDEF42],
                    ["Cambodia", 0x253D95],
                    ["Philippines", 0xE31B23],
                    ["Iran", 0x269F49],
                    ["Syria", 0xD80027],
                    ["World", 0xD80027],

                    // partner
                    ["Somdudu", 0xD80027],
                    ["Somini", 0xD80027],
                    ["Somnia", 0xD80027],
                ] satisfies ReadonlyArray<readonly [string, number]>
            ).map(([name, tint]) => skin([name, tint]))
        ];
    }
);
