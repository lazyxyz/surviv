import $ from "jquery";
import { freeMeless, Melees } from "@common/definitions/melees";
import type { Game } from "../game";
import type { weaponPresentType } from "@common/typings";
import weapons from ".";
import { ObjectDefinitions, type ObjectDefinition } from "@common/utils/objectDefinitions";
import { SurvivAssets } from "../account";

const selectMeless = (game: Game, weapon: string) => {
    // store weapon
    weapons.selectWeapon(game, {
        meless: weapon
    });

    // active element
    setTimeout(() => {
        $(`#weapons-assets-${weapon}`).addClass("selected");
    }, 0);

    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const getMeless = Melees.definitions.find(g => g.idString === weapon)!;
    const currentSkin = game.console.getBuiltInCVar("cv_loadout_skin");

    weapons.appendPreview([
        {
            class: "assets-base",
            url: `./img/game/shared/skins/${currentSkin}_base.svg`,
            x: 0,
            y: 0,
            zIndex: 2,
            rotate: 0
        },
        {
            class: "assets-world",
            url: `./img/game/shared/weapons/${getMeless.idString}.svg`,
            x: getMeless.image?.position.x ?? 0,
            y: getMeless.image?.position.y ?? 0,
            rotate: getMeless.image?.angle ?? 0,
            zIndex: 1
        },
        {
            class: "assets-fist",
            url: `./img/game/shared/skins/${currentSkin}_fist.svg`,
            x: getMeless.fists.right.x,
            y: getMeless.fists.right.y,
            zIndex: 4,
            rotate: 0
        },
        {
            class: "assets-fist",
            url: `./img/game/shared/skins/${currentSkin}_fist.svg`,
            x: getMeless.fists.left.x,
            y: getMeless.fists.left.y,
            zIndex: 3,
            rotate: 0
        }
    ]).attr("viewBox", "-100 -120 300 300");
};

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export async function visibleMeless(game: Game) {
    if (!game?.account?.address) return;

    const melessList = $<HTMLDivElement>(".weapons-container-list");

    // reset items before render new
    weapons.resetAll();

    // eslint-disable-next-line @typescript-eslint/no-misused-promises, no-async-promise-executor
    let SilverArms = await game.account.getBalances(SurvivAssets.SilverArms).catch(err => {
        console.log(`Get SilverArms error: ${err}`);
    });
    let GoldArms = await game.account.getBalances(SurvivAssets.GoldArms).catch(err => {
        console.log(`Get GoldArms error: ${err}`);
    });
    let DivineArms = await game.account.getBalances(SurvivAssets.DivineArms).catch(err => {
        console.log(`Get DivineArms error: ${err}`);
    });
    const userArmsBalance = { ...SilverArms, ...GoldArms, ...DivineArms };

    const userArms = Object.entries(userArmsBalance).map(([key, _]) => key);

    const userMelees=  Melees.definitions.filter(argument =>
            [...freeMeless, ...(userArms || [])].some(
                argument_child => argument_child === argument.idString
            )
        );

    const MelessIntance = Melees.definitions.filter(argument =>
        [
            ...freeMeless,
            /*
                in here don't allow show skins just default
                you wanna select skin attention to assets preview !
            */
            ...(userMelees
                ?.filter(meta => meta?.idString === argument.idString && argument?.default)
                ?.map(meta => meta?.idString) || [])
        ].some(
            argument_child => argument_child === argument.idString
        )
    );

    // display to preview and select
    {
        melessList.append("<h2 class='weapons-container-card-meless'>Meless</h2>");

        for (const { idString, name } of MelessIntance) {
            const melessItem = $<HTMLDivElement>(`
                <div class="weapons-container-card weapons-container-card-meless" id="weapons-list-${idString}">
                    <img src="./img/game/shared/weapons/${idString}.svg" alt=${name} width="72px" height="72px" />
    
                    <p class="weapons-container-paragraph">${name}</p>
                </div>
            `);

            // eslint-disable-next-line @typescript-eslint/no-misused-promises
            melessItem.on("click", async () => {
                // handler active messItem
                {
                    $(".weapons-container-card-meless").removeClass("selected");

                    melessItem.toggleClass("selected");
                }

                const getAssets = await weapons.appendAsset(
                    idString,
                    userMelees
                );

                // should be set or reset weapon
                {
                    const weaponPresent = ((game.console.getBuiltInCVar("dv_weapon_preset").startsWith("{")
                        ? JSON.parse(game.console.getBuiltInCVar("dv_weapon_preset"))
                        : undefined)) as weaponPresentType | undefined;

                    const avaliableMeless = getAssets?.find(meta => meta.idString === weaponPresent?.meless);

                    if (avaliableMeless) {
                        selectMeless(game, avaliableMeless.idString);
                    }

                    if (!avaliableMeless) {
                        selectMeless(game, idString);
                    }
                }

                // handler preview and click assets
                $(".weapons-container-card-assets").on("click", ({ currentTarget }) => {
                    const melessSelect = currentTarget.id.replace("weapons-assets-", "");

                    selectMeless(game, melessSelect);
                });
            });

            melessList.append(melessItem);
        }
    }
}
