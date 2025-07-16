import $ from "jquery";
import { Melees } from "@common/definitions/melees";
import { Guns } from "@common/definitions/guns";
// import weapons from ".";
import { SurvivAssets } from "../account";
import type { ObjectDefinition } from "@common/utils/objectDefinitions";
import type { Game } from "../game";
import { DivineArmsMapping, DivineGunsMapping, GoldArmsMapping, SilverArmsMapping } from "@common/mappings";
import { getTokenBalances } from "../utils/onchain";


// Constants for repeated strings
const ASSET_PATH = "./img/game/shared";
const VIEWBOX = "-100 -120 300 300";

interface AssetConfig {
  class: string;
  url: string;
  x: number;
  y: number;
  zIndex: number;
  rotate: number;
}


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
  $(".weapons-container-card-melee").empty();
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

const appendAsset = async (
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

const showViewBox = (game: Game) => {
  const meleeId = localStorage.getItem("selectedMelee");
  const gunId = localStorage.getItem("selectedGun");

  const currentSkin = game.console.getBuiltInCVar("cv_loadout_skin");
  const melee = Melees.definitions.find((w) => w.idString === meleeId);
  if (!melee) {
    console.warn(`Melee not found: ${meleeId}`);
    return;
  }

  // Generate asset configuration
  let assets: AssetConfig[] = [
    {
      class: "assets-base",
      url: `${ASSET_PATH}/skins/${currentSkin}_base.svg`,
      x: 0,
      y: 0,
      zIndex: 2,
      rotate: 0,
    },

    {
      class: "assets-fist",
      url: `${ASSET_PATH}/skins/${currentSkin}_fist.svg`,
      x: melee.fists.right.x,
      y: melee.fists.right.y,
      zIndex: 3,
      rotate: 0,
    },
    {
      class: "assets-fist",
      url: `${ASSET_PATH}/skins/${currentSkin}_fist.svg`,
      x: melee.fists.left.x,
      y: melee.fists.left.y,
      zIndex: 4,
      rotate: 0,
    },
    {
      class: "assets-world",
      url: `${ASSET_PATH}/weapons/${melee.idString}.svg`,
      x: melee.image?.position.x ?? 0,
      y: melee.fists.right.x,
      rotate: melee.image?.angle ?? 0,
      zIndex: 1,
    }
  ];

  const gun = Guns.definitions.find((w) => w.idString === gunId);
  if (gun) {
    assets.push({
      class: "assets-world",
      url: `${ASSET_PATH}/weapons/${gun.idString}_world.svg`,
      x: - gun.fists.right.x,
      y: 0,
      rotate: 90,
      zIndex: 1,
    });
  }

  // Append assets and set viewBox
  appendPreview(assets).attr("viewBox", VIEWBOX);
}

// Function to select a melee weapon
const selectMelee = (game: Game, weaponId: string) => {
  // Store the selected weapon
  selectWeapon(game, { melee: weaponId });

  // Save to localStorage
  localStorage.setItem("selectedMelee", weaponId);

  // Add "selected" class to the weapon element
  $(`.weapons-container-card`).removeClass("selected");
  $(`#weapons-list-${weaponId}`).addClass("selected");

  // Find the melee definition
  const melee = Melees.definitions.find((w) => w.idString === weaponId);
  if (!melee) {
    console.warn(`Melee not found: ${weaponId}`);
    return;
  }

  // Update weapon info panel
  const dps = melee.damage && melee.cooldown ? (melee.damage / (melee.cooldown / 1000)).toFixed(2) : "N/A";
  $("#weapon-info").html(`
    <p>${melee.name}</p>
    <p>DPS: ${dps}</p>
    <p>Damage: ${melee.damage ?? "N/A"}</p>
    <p>Cooldown: ${melee.cooldown ? (melee.cooldown / 1000) + "s" : "N/A"}</p>
  `);

  showViewBox(game);
};

// Function to select a gun
const selectGun = (game: Game, weaponId: string) => {
  // Store the selected weapon
  selectWeapon(game, { gun: weaponId });

  // Save to localStorage
  localStorage.setItem("selectedGun", weaponId);

  // Add "selected" class to the weapon element
  $(`.weapons-container-card`).removeClass("selected");
  $(`#weapons-list-${weaponId}`).addClass("selected");

  // Find the gun definition
  const gun = Guns.definitions.find((w) => w.idString === weaponId);
  if (!gun) {
    console.warn(`Gun not found: ${weaponId}`);
    return;
  }

  // Update weapon info panel
  const dps = gun.ballistics.damage && gun.fireDelay ? (gun.ballistics.damage / (gun.fireDelay / 1000)).toFixed(2) : "N/A";
  $("#weapon-info").html(`
    <p>${gun.name}</p>
    <p>DPS: ${dps}</p>
    <p>Damage: ${gun.ballistics.damage ?? "N/A"}</p>
    <p>Speed: ${gun.ballistics.speed ?? "N/A"}</p>
    <p>Range: ${gun.ballistics.range ?? "N/A"}</p>
    <p>Ammo Type: ${gun.ammoType ?? "N/A"}</p>
  `);

  showViewBox(game);
};

// Utility to check if a weapon is owned
function isOwned(id: string, ownedIds: string[]) {
  return ownedIds.includes(id);
}

// Function to display guns
async function showGuns(game: Game, selectedGunId?: string) {
  if (!game.account.address) {
    return;
  }

  try {

    let gunBalances = await getTokenBalances([game.account.address], [DivineGunsMapping.address]);
    const userGuns: string[] = gunBalances.balances.flatMap(balance => {
      if (balance.balance > 0) {
        const itemId = DivineGunsMapping.assets[balance.tokenID];
        return itemId ? [itemId] : [];
      }
      return [];
    });

    const allGuns = Guns.definitions; // Show all guns, not just owned ones

    // Split guns into owned and unowned
    const ownedGuns = allGuns.filter((gun) => isOwned(gun.idString, userGuns));
    const unownedGuns = allGuns.filter((gun) => !isOwned(gun.idString, userGuns));

    // Render gun items (owned first, then unowned)
    const $gunList = $("#list-gun").empty();
    $gunList.append(`
    <div class="weapons-container-card weapons-container-card-gun" 
        id="weapons-list-no-gun" data-id="no-gun">
      <img src="${ASSET_PATH}/weapons/empty_slot.svg" alt="No Gun" width="72px" height="72px" />
      <p class="weapons-container-paragraph">No Gun</p>
    </div>
  `);

    for (const { idString, name } of ownedGuns) {
      $gunList.append(`
        <div class="weapons-container-card weapons-container-card-gun" 
             id="weapons-list-${idString}" data-id="${idString}">
          <img src="${ASSET_PATH}/weapons/${idString}.svg" alt="${name}" width="72px" height="72px" />
          <p class="weapons-container-paragraph">${name}</p>
        </div>
      `);
    }
    for (const { idString, name } of unownedGuns) {
      $gunList.append(`
        <div class="weapons-container-card weapons-container-card-gun inactive" 
             id="weapons-list-${idString}" data-id="${idString}">
          <img src="${ASSET_PATH}/weapons/${idString}.svg" alt="${name}" width="72px" height="72px" />
          <p class="weapons-container-paragraph">${name}</p>
        </div>
      `);
    }

    if (!selectedGunId) {
      $("#weapons-list-no-gun").addClass("selected");
    } else if ($(`#weapons-list-${selectedGunId}`).length && !$(`#weapons-list-${selectedGunId}`).hasClass("inactive")) {
      $(`#weapons-list-${selectedGunId}`).addClass("selected");
    }

    // Show gun list and hide melee list
    $("#list-gun").show();
    $("#list-melee").hide();
  } catch (err) {
    console.error(`Error displaying guns: ${err}`);
  }
}

// Function to display melees
async function showMelees(game: Game, selectedMeleeId?: string) {
  if (!game.account.address) {
    return;
  }

  try {
    const armMappingList = [SilverArmsMapping, GoldArmsMapping, DivineArmsMapping];
    const armAddresses = armMappingList.map(arm => arm.address);
    let armBalances = await getTokenBalances([game.account.address], armAddresses);

     const userArms = armBalances.balances
        .map(balance => {
            let itemId = "";
            armMappingList.forEach(mapping => {
                if (mapping.address === balance.contractAddress) {
                    itemId = mapping.assets[balance.tokenID];
                }
            });
            return itemId; // Return itemId regardless
        })
        .filter(itemId => !!itemId);


    const allMelees = Melees.definitions;
    // Split melees into owned and unowned
    const ownedMelees = allMelees.filter((melee) => isOwned(melee.idString, userArms));
    const unownedMelees = allMelees.filter((melee) => !isOwned(melee.idString, userArms));

    // Render melee items (owned first, then unowned)
    const $meleeList = $("#list-melee").empty();
    for (const { idString, name } of ownedMelees) {
      $meleeList.append(`
        <div class="weapons-container-card weapons-container-card-melee" 
             id="weapons-list-${idString}" data-id="${idString}">
          <img src="${ASSET_PATH}/weapons/${idString}.svg" alt="${name}" width="72px" height="72px" />
          <p class="weapons-container-paragraph">${name}</p>
        </div>
      `);
    }
    for (const { idString, name } of unownedMelees) {
      $meleeList.append(`
        <div class="weapons-container-card weapons-container-card-melee inactive" 
             id="weapons-list-${idString}" data-id="${idString}">
          <img src="${ASSET_PATH}/weapons/${idString}.svg" alt="${name}" width="72px" height="72px" />
          <p class="weapons-container-paragraph">${name}</p>
        </div>
      `);
    }

    // Reapply selected class if provided
    if (selectedMeleeId && $(`#weapons-list-${selectedMeleeId}`).length && !$(`#weapons-list-${selectedMeleeId}`).hasClass("inactive")) {
      $(`#weapons-list-${selectedMeleeId}`).addClass("selected");
    }

    // Show melee list and hide gun list
    $("#list-melee").show();
    $("#list-gun").hide();
  } catch (err) {
    console.error(`Error displaying melees: ${err}`);
  }
}

// Main function to display weapons (melees and guns)
export async function showWeapons(game: Game, highlightId?: string): Promise<void> {
  if (!game?.account?.address) {
    console.warn("No account address provided");
    return;
  }

  resetAll();

  // Build tab UI
  const $container = $<HTMLDivElement>(".weapons-container-list").empty();
  $container.append(`
    <div class="weapon-tab">
      <button class="weapon-tab-child active" id="tab-melee">Melees</button>
      <button class="weapon-tab-child" id="tab-gun">Guns</button>
    </div>
    <div class="weapon-list" id="list-melee"></div>
    <div class="weapon-list" id="list-gun" style="display: none;"></div>
  `);

  // Append weapon info panel to .weapons-container-aside, below .weapons-container-aside-preview
  const $aside = $(".weapons-container-aside");
  if ($("#weapon-info").length === 0) {
    $aside.append(`<div id="weapon-info"></div>`);
  }

  // Get weapon preset
  let weaponPreset: { melee?: string; gun?: string } = {};
  try {
    const presetString = game.console.getBuiltInCVar("dv_weapon_preset");
    if (presetString) {
      weaponPreset = JSON.parse(presetString);
    }
  } catch (err) {
    console.error(`Error parsing dv_weapon_preset: ${err}`);
  }

  // Load melee list by default
  await showMelees(game, weaponPreset.melee);

  showViewBox(game);

  // Tab switching logic
  $(".weapon-tab-child").off("click").on("click", async function () {
    $(".weapon-tab-child").removeClass("active");
    $(this).addClass("active");

    if (this.id === "tab-melee") {
      await showMelees(game, weaponPreset.melee);
    } else {
      await showGuns(game, weaponPreset.gun);
    }
  });

  $container.off("click", ".weapons-container-card").on("click", ".weapons-container-card", function () {
    if ($(this).hasClass("inactive")) return;

    const id = $(this).data("id");
    const type = $(this).hasClass("weapons-container-card-melee") ? "melee" : "gun";

    // Remove all selected classes first
    $(".weapons-container-card").removeClass("selected");
    $(this).addClass("selected");

    if (type === "melee") {
      weaponPreset.melee = id;
      selectMelee(game, id);
    } else {
      if (id === "no-gun") {
        weaponPreset.gun = undefined;
        localStorage.removeItem("selectedGun");
        selectWeapon(game, { gun: undefined });
        $("#weapon-info").empty();
        showViewBox(game);
      } else {
        weaponPreset.gun = id;
        selectGun(game, id);
      }
    }
  });

  // Load selected weapons from dv_weapon_preset
  if (!highlightId) {
    if (weaponPreset.melee && $(`#weapons-list-${weaponPreset.melee}`).length && !$(`#weapons-list-${weaponPreset.melee}`).hasClass("inactive")) {
      $(`#weapons-list-${weaponPreset.melee}`).addClass("selected");
      $("#tab-melee").addClass("active");
      $("#tab-gun").removeClass("active");
      await showMelees(game, weaponPreset.melee);
      selectMelee(game, weaponPreset.melee);
    } else if (weaponPreset.gun && $(`#weapons-list-${weaponPreset.gun}`).length && !$(`#weapons-list-${weaponPreset.gun}`).hasClass("inactive")) {
      $(`#weapons-list-${weaponPreset.gun}`).addClass("selected");
      $("#tab-gun").addClass("active");
      $("#tab-melee").removeClass("active");
      await showGuns(game, weaponPreset.gun);
      selectGun(game, weaponPreset.gun);
    }
  }

  // Highlight item if provided (e.g., from rewards)
  if (highlightId) {
    const $item = $(`#weapons-list-${highlightId}`);
    if ($item.length && !$item.hasClass("inactive")) {
      $item.addClass("selected");
      if ($item.hasClass("weapons-container-card-melee")) {
        weaponPreset.melee = highlightId;
        $("#tab-melee").addClass("active");
        $("#tab-gun").removeClass("active");
        await showMelees(game, highlightId);
        selectMelee(game, highlightId);
      } else {
        weaponPreset.gun = highlightId;
        $("#tab-gun").addClass("active");
        $("#tab-melee").removeClass("active");
        await showGuns(game, highlightId);
        selectGun(game, highlightId);
      }
    }
  }
}
