import type { Game } from "../game";
import { getTranslatedString } from "../../translations";
import $ from "jquery";
import { html } from "../utils/misc";
import { type ObjectDefinition } from "@common/utils/objectDefinitions";
import { IPFS_GATEWAY_URL } from "@common/constants";

// handler select and save badge
function selectBadge(idString: string, game: Game): void {
    // remove previous selected
    $(".badges-list-item-container").removeClass("selected");

    // wait for dom
    setTimeout(() => $(`#badge-${idString}`).addClass("selected"), 0);

    game.console.setBuiltInCVar("cv_loadout_badge", idString);
}

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export function getBadgeImage(badge: string) {
    const IPFS_BADGE = "QmZqvReUVzFBbrvBotdZrkvCzYGYPUuZkand14YGr6DwK9/";

    return badge.includes("bdg_khan’s_american_steed")
        ? `${IPFS_GATEWAY_URL}${IPFS_BADGE}${badge[badge.length - 1]}`
        : `./img/game/shared/badges/${badge}.svg`;
}

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export async function showBadges(game: Game) {
    if (!game?.account?.address) return;

    const badgeList = $<HTMLDivElement>("#badges-list");

    // clear list
    badgeList.empty();

    // eslint-disable-next-line @typescript-eslint/no-misused-promises, no-async-promise-executor
    const myBadges = await new Promise<ObjectDefinition[]>(async(resolve, reject) => {
        try {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
            const request: {
                data: { items: Array<{ name: string, image: string }> }
            } = await $.ajax({
                url: "https://test-api.openmark.io/market/api/nft",
                type: "POST",
                data: {
                    nftContract: "0xf6cF3D41d16F31A2F6b641Fd0C4Ce47132eB0ed7",
                    owner: game.account.address,
                    size: 100
                }
            });

            return resolve(request.data.items.map(meta => {
                return {
                    idString: `bdg_${meta.name.replace(/ /g, "_").replace("#", "")}`.toLowerCase(),
                    name: meta.name
                };
            }));
        } catch (error) {
            // eslint-disable-next-line @typescript-eslint/prefer-promise-reject-errors
            reject(error);
        }
    });

    // should be set or reset skin
    {
        const avaliableBadge = myBadges.find(meta => meta.idString === game.console.getBuiltInCVar("cv_loadout_badge"));

        if (avaliableBadge) {
            selectBadge(avaliableBadge.idString, game);
        }

        if (!avaliableBadge) {
            game.console.setBuiltInCVar("cv_loadout_badge", "");
        }
    }

    // custom no item (meaning click to reset badge)
    {
        const noBadgeItem = $<HTMLDivElement>(
            html`<div id="badge-" class="badges-list-item-container">\
              <div class="badges-list-item"> </div>\
              <span class="badge-name">${getTranslatedString("none")}</span>\
          </div>`
        );

        noBadgeItem.on("click", () => selectBadge("", game));

        badgeList.append(noBadgeItem);
    }

    for (const { idString, name } of myBadges) {
        const badgeItem = $<HTMLDivElement>(
            `<div id="badge-${idString}" class="badges-list-item-container">
                <img src="${getBadgeImage(idString)}" width='102px' height='102px' />
                
                <span class="badge-name">${name}</span>
            </div>`
        );

        badgeItem.on("click", () => selectBadge(idString, game));

        badgeList.append(badgeItem);
    }
}
