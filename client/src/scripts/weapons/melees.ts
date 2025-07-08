import $ from "jquery";
import { freeMelees, Melees } from "@common/definitions/melees";
import type { Game } from "../game";
import type { weaponPresentType } from "@common/typings";
import weapons from ".";
import { SurvivAssets } from "../account";

const selectMelees = (game: Game, weapon: string) => {
    // store weapon
    weapons.selectWeapon(game, {
        melee: weapon
    });

    // active element
    setTimeout(() => {
        $(`#weapons-assets-${weapon}`).addClass("selected");
    }, 0);

    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const getMelees = Melees.definitions.find(g => g.idString === weapon)!;
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
            url: `./img/game/shared/weapons/${getMelees.idString}.svg`,
            x: getMelees.image?.position.x ?? 0,
            y: getMelees.image?.position.y ?? 0,
            rotate: getMelees.image?.angle ?? 0,
            zIndex: 1
        },
        {
            class: "assets-fist",
            url: `./img/game/shared/skins/${currentSkin}_fist.svg`,
            x: getMelees.fists.right.x,
            y: getMelees.fists.right.y,
            zIndex: 4,
            rotate: 0
        },
        {
            class: "assets-fist",
            url: `./img/game/shared/skins/${currentSkin}_fist.svg`,
            x: getMelees.fists.left.x,
            y: getMelees.fists.left.y,
            zIndex: 3,
            rotate: 0
        }
    ]).attr("viewBox", "-100 -120 300 300");
};

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export async function showMelees(game: Game) {
    if (!game?.account?.address) return;

    const meleesList = $<HTMLDivElement>(".weapons-container-list");

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
            [...freeMelees, ...(userArms || [])].some(
                argument_child => argument_child === argument.idString
            )
        );

    const MeleesIntance = Melees.definitions.filter(argument =>
        [
            ...freeMelees,
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
        meleesList.append("<h2 class='weapons-container-card-melee'>Melees</h2>");

        for (const { idString, name } of MeleesIntance) {
            const meleesItem = $<HTMLDivElement>(`
                <div class="weapons-container-card weapons-container-card-melee" id="weapons-list-${idString}">
                    <img src="./img/game/shared/weapons/${idString}.svg" alt=${name} width="72px" height="72px" />
    
                    <p class="weapons-container-paragraph">${name}</p>
                </div>
            `);

            // eslint-disable-next-line @typescript-eslint/no-misused-promises
            meleesItem.on("click", async () => {
                // handler active messItem
                {
                    $(".weapons-container-card-melee").removeClass("selected");

                    meleesItem.toggleClass("selected");
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

                    const avaliableMelees = getAssets?.find(meta => meta.idString === weaponPresent?.melee);

                    if (avaliableMelees) {
                        selectMelees(game, avaliableMelees.idString);
                    }

                    if (!avaliableMelees) {
                        selectMelees(game, idString);
                    }
                }

                // handler preview and click assets
                $(".weapons-container-card-assets").on("click", ({ currentTarget }) => {
                    const meleesSelect = currentTarget.id.replace("weapons-assets-", "");

                    selectMelees(game, meleesSelect);
                });
            });

            meleesList.append(meleesItem);
        }
    }
}
