import { badge, Badges, freeBadges, type BadgeDefinition } from "@common/definitions/badges";
import type { Game } from "../game";
import { getTranslatedString } from "../../translations";
import $ from "jquery";
import { html } from "../utils/misc";
import type { ObjectDefinition, ReferenceTo } from "@common/utils/objectDefinitions";
import type { TranslationKeys } from "../../typings/translations";
import { IPFS_GATEWAY, IPFS_PREFIX } from "@common/constants";

// handler select and save badge
function selectBadge(idString: string, id: string, game: Game): void {
    // remove previous selected
    $(".badges-list-item-container").removeClass("selected");

    // wait for dom
    setTimeout(() => $(`#badge-${id}`).addClass("selected"), 0);

    game.console.setBuiltInCVar("cv_loadout_badge", idString);
}

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export async function visibleBadges(game: Game) {
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
                    nftContract: "0xeac55b267ba3c2dd8d0292fd8144f97d10d1579b",
                    owner: game.account.address,
                    size: 100
                }
            });

            return resolve(request.data.items.map(meta => ({
                idString: meta.image.replace("ipfs://", "https://ipfs-gw.openmark.io/ipfs/"),
                name: meta.name
            })));
        } catch (error) {
            // eslint-disable-next-line @typescript-eslint/prefer-promise-reject-errors
            reject(error);
        }
    });

    // should be set or reset skin
    {
        const avaliableBadge = myBadges.find(meta => meta.idString === game.console.getBuiltInCVar("cv_loadout_badge"));

        if (avaliableBadge) {
            const getID = avaliableBadge.name.replace("#", "").replace(" ", "-");

            // wait for dom
            setTimeout(() => $(`#badge-${getID}`).addClass("selected"), 0);
        }

        if (!avaliableBadge) {
            selectBadge("", "", game);
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

        noBadgeItem.on("click", () => selectBadge("", "", game));

        badgeList.append(noBadgeItem);
    }

    for (const { idString, name } of myBadges) {
        const getID = name.replace("#", "").replace(" ", "-");

        const badgeItem = $<HTMLDivElement>(
            `<div id="badge-${getID}" class="badges-list-item-container">
                <img src="${idString}" width='102px' height='102px' />
                
                <span class="badge-name">${name}</span>
            </div>`
        );

        badgeItem.on("click", () => {
            selectBadge(
                idString,
                getID,
                game
            );
        });

        badgeList.append(badgeItem);
    }
}
