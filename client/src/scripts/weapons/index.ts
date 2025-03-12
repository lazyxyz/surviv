import type { ObjectDefinition } from "@common/utils/objectDefinitions";
import $ from "jquery";
import type { Game } from "../game";

const selectWeapon = (game: Game, value: object) => {
    const weaponPreset = game.console.getBuiltInCVar("dv_weapon_preset");

    game.console.setBuiltInCVar("dv_weapon_preset", JSON.stringify({
        ...(weaponPreset?.startsWith("{") ? JSON.parse(weaponPreset) : undefined),
        ...value
    }));
};

const resetAll = () => {
    $(".weapons-container-list").empty();
    $(".weapons-container-aside-assets").empty();
    $(".weapons-container-card-meless").empty();
    $(".weapons-container-aside-preview").empty();
};

const appendPreview = (images: Array<{
    zIndex: number
    rotate?: number
    url: string
    class: string
    x: number
    y: number
}>): JQuery<Partial<HTMLElement>> => {
    const asideElement = $(".weapons-container-aside-preview");

    // clear previous
    asideElement.empty();

    // append new
    images.sort((a, b) => a.zIndex - b.zIndex).map(argument => {
        const gVector = document.createElementNS("http://www.w3.org/2000/svg", "g");
        const iVector = document.createElementNS("http://www.w3.org/2000/svg", "image");

        $(gVector).css({
            transformBox: "fill-box",
            translate: `calc(${argument.x}px - 50%) calc(${argument.y}px - 50%)`,
            transformOrigin: "center",
            rotate: `${argument.rotate}deg`
        });

        $(iVector).attr({
            class: argument.class,
            href: argument.url
        });

        gVector.append(iVector);

        asideElement.append(gVector);
    });

    return asideElement;
};

const appendAsset = async(
    idString: string,
    definition: ObjectDefinition[]
): Promise<ObjectDefinition[] | undefined> => {
    const rootAssetsElement = $(".weapons-container-aside-assets");
    const rootListElement = $(".weapons-container-list");
    const loadingElement = document.createElement("div");

    // if existed you need empty (remove all nodes) and append new
    rootAssetsElement.empty();

    // prevent spamming call API
    rootListElement.css("pointer-events", "none");

    // append loading ICON
    {
        loadingElement.className = "loading-icon";
        loadingElement.style.gridColumn = "span 3";
        loadingElement.style.display = "flex";
        loadingElement.style.alignItems = "center";
        loadingElement.style.justifyContent = "center";
        loadingElement.innerHTML = "<i class=\"fa-duotone fa-solid fa-spinner fa-spin-pulse fa-xl\"></i>";

        rootAssetsElement.prepend(loadingElement);
    }

    const weaponsInstance = [
        {
            idString,
            name: "Default"
        },
        ...(definition
            // should be get related item
            ?.filter(meta => meta?.idString?.startsWith(idString))
            // change from orignal to 'Default' at weaponsInstance[0].name
            ?.filter(meta => meta?.idString !== idString)
            || [])
    ];

    for (const { idString, name } of weaponsInstance) {
        const weaponItem = $<HTMLDivElement>(`
            <div class="weapons-container-card weapons-container-card-assets" id="weapons-assets-${idString}">
                <img src="./img/game/shared/weapons/${idString}.svg" alt=${name} width="72px" height="72px" />

                <p class="weapons-container-paragraph">${name}</p>
          </div>
        `);

        weaponItem.on("click", () => {
            $(".weapons-container-card-assets").removeClass("selected");

            weaponItem.toggleClass("selected");
        });

        rootAssetsElement.append(weaponItem);
    }

    // reset states
    {
        loadingElement.remove();
        rootListElement.css("pointer-events", "unset");
    }

    return weaponsInstance;
};

export default {
    selectWeapon,
    appendPreview,
    appendAsset,
    resetAll
};
