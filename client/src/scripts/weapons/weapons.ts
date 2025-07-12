import $ from "jquery";
import { freeMelees, Melees } from "@common/definitions/melees";
import { Guns } from "@common/definitions/guns";
import type { Game } from "../game";
import type { weaponPresentType } from "@common/typings";
import weapons from ".";
import { SurvivAssets } from "../account";

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

type WeaponType = "melee" | "gun";

// Function to select a melee weapon
const selectMelee = (game: Game, weaponId: string) => {
  // Store the selected weapon
  weapons.selectWeapon(game, { melee: weaponId });

    // Save to localStorage
  localStorage.setItem("selectedMelee", weaponId);

  // Add "selected" class to the weapon element
  $(`#weapons-assets-${weaponId}`).addClass("selected");

  // Find the melee definition
  const melee = Melees.definitions.find((w) => w.idString === weaponId);
  if (!melee) {
    console.warn(`Melee not found: ${weaponId}`);
    return;
  }

  const currentSkin = game.console.getBuiltInCVar("cv_loadout_skin");

  // Generate asset configuration
  const assets: AssetConfig[] = [
    {
      class: "assets-base",
      url: `${ASSET_PATH}/skins/${currentSkin}_base.svg`,
      x: 0,
      y: 0,
      zIndex: 2,
      rotate: 0,
    },
    {
      class: "assets-world",
      url: `${ASSET_PATH}/weapons/${melee.idString}.svg`,
      x: melee.image?.position.x ?? 0,
      y: melee.image?.position.y ?? 0,
      rotate: melee.image?.angle ?? 0,
      zIndex: 1,
    },
    {
      class: "assets-fist",
      url: `${ASSET_PATH}/skins/${currentSkin}_fist.svg`,
      x: melee.fists.right.x,
      y: melee.fists.right.y,
      zIndex: 4,
      rotate: 0,
    },
    {
      class: "assets-fist",
      url: `${ASSET_PATH}/skins/${currentSkin}_fist.svg`,
      x: melee.fists.left.x,
      y: melee.fists.left.y,
      zIndex: 3,
      rotate: 0,
    },
  ];

  // Append assets and set viewBox
  weapons.appendPreview(assets).attr("viewBox", VIEWBOX);
};

// Function to select a gun
const selectGun = (game: Game, weaponId: string) => {
  // Store the selected weapon
  weapons.selectWeapon(game, { gun: weaponId });

    // Save to localStorage
  localStorage.setItem("selectedGun", weaponId);

  // Add "selected" class to the weapon element
  $(`#weapons-assets-${weaponId}`).addClass("selected");

  // Find the gun definition
  const gun = Guns.definitions.find((w) => w.idString === weaponId);
  if (!gun) {
    console.warn(`Gun not found: ${weaponId}`);
    return;
  }
};

// Display weapons in a given category
// async function displayWeapons(game: Game, category: string, type: WeaponType, items: any) {
//   const $itemsList = $<HTMLDivElement>(".weapons-container-list");

//   // Append category header
//   $itemsList.append(`<h2 class='weapons-container-card-${type}'>${category}</h2>`);

//   // Create and append weapon items
//   for (const { idString, name } of items) {
//     const $item = $<HTMLDivElement>(`
//       <div class="weapons-container-card weapons-container-card-${type}" id="weapons-list-${idString}">
//         <img src="${ASSET_PATH}/weapons/${idString}.svg" alt="${name}" width="72px" height="72px" />
//         <p class="weapons-container-paragraph">${name}</p>
//       </div>
//     `);

//     $item.on("click", async () => {
//       // Remove "selected" class from all items in the category
//       $(`.weapons-container-card-${type}`).removeClass("selected");
//       $item.addClass("selected");

//       // Check if a preset weapon exists
//       const weaponPreset = game.console.getBuiltInCVar("dv_weapon_preset").startsWith("{")
//         ? JSON.parse(game.console.getBuiltInCVar("dv_weapon_preset"))
//         : undefined;

//       const availableWeapons = await weapons.appendAsset(idString, items);
//       const presetWeapon = availableWeapons?.find((meta) => meta.idString === weaponPreset?.[type]);

//       // Select the appropriate weapon
//       if (type === "melee") {
//         selectMelee(game, presetWeapon?.idString ?? idString);
//       } else {
//         selectGun(game, presetWeapon?.idString ?? idString);
//       }
//     });

//     $itemsList.append($item);
//   }

//   // Event delegation for asset clicks
//   $itemsList.off("click", ".weapons-container-card-assets").on("click", ".weapons-container-card-assets", ({ currentTarget }) => {
//     const weaponId = currentTarget.id.replace("weapons-assets-", "");
//     if (type === "melee") {
//       selectMelee(game, weaponId);
//     } else {
//       selectGun(game, weaponId);
//     }
//   });
// }

// Main function to display melees and guns
// export async function showMelees(game: Game): Promise<void> {
//   if (!game?.account?.address) {
//     console.warn("No account address provided");
//     return;
//   }

//   // Reset items before rendering
//   weapons.resetAll();

//   // Fetch balances concurrently
//   const [silverArms, goldArms, divineArms, divineGuns] = await Promise.all([
//     game.account.getBalances(SurvivAssets.SilverArms).catch((err) => {
//       console.error(`Get SilverArms error: ${err}`);
//       return {};
//     }),
//     game.account.getBalances(SurvivAssets.GoldArms).catch((err) => {
//       console.error(`Get GoldArms error: ${err}`);
//       return {};
//     }),
//     game.account.getBalances(SurvivAssets.DivineArms).catch((err) => {
//       console.error(`Get DivineArms error: ${err}`);
//       return {};
//     }),
//     game.account.getBalances(SurvivAssets.DivineGuns).catch((err) => {
//       console.error(`Get DivineGuns error: ${err}`);
//       return {};
//     }),
//   ]);

//   // Combine balances and extract weapon IDs
//   const userArmsBalance = { ...silverArms, ...goldArms, ...divineArms };
//   const userGunsBalance = { ...divineGuns };

//   const userArmKeys = Object.keys(userArmsBalance);
//   const userGunKeys = Object.keys(userGunsBalance);

//   // Filter available melees and guns
//   const userMelees = Melees.definitions.filter((weapon) =>
//     [...freeMelees, ...userArmKeys].includes(weapon.idString)
//   );
//   const userGuns = Guns.definitions.filter((weapon) =>
//     userGunKeys.includes(weapon.idString)
//   );

//   // Display melees and guns
//   await Promise.all([
//     displayWeapons(game, "Melees", "melee", userMelees),
//     displayWeapons(game, "Guns", "gun", userGuns),
//   ]);
// }

// Utility to check if a weapon is owned
function isOwned(id: string, ownedIds: string[]) {
  return ownedIds.includes(id);
}

// Main function to display tabs and lists
export async function showMelees(game: Game, highlightId?: string): Promise<void> {
  if (!game?.account?.address) {
    console.warn("No account address provided");
    return;
  }

  weapons.resetAll();

  // Fetch balances
  const [silverArms, goldArms, divineArms, divineGuns] = await Promise.all([
    game.account.getBalances(SurvivAssets.SilverArms).catch(() => ({})),
    game.account.getBalances(SurvivAssets.GoldArms).catch(() => ({})),
    game.account.getBalances(SurvivAssets.DivineArms).catch(() => ({})),
    game.account.getBalances(SurvivAssets.DivineGuns).catch((err) => {
      console.error(`Get DivineGuns error: ${err}`);
      return {};
    }),
  ]);

  const userArmsBalance = { ...silverArms, ...goldArms, ...divineArms };
  const userGunsBalance = { ...divineGuns };

  const ownedMeleeIds = [...freeMelees, ...Object.keys(userArmsBalance)];
  const ownedGunIds = Object.keys(userGunsBalance);

  // Prepare lists
  const allMelees = Melees.definitions;
  const divineGunIds = Object.keys(divineGuns);
  const allGuns = Guns.definitions.filter(gun => divineGunIds.includes(gun.idString));
  // const allGuns = Guns.definitions;

  // Build tab UI
  const $container = $<HTMLDivElement>(".weapons-container-list");
  $container.empty();
  $container.append(`
    <div class="weapon-tab">
      <button class="weapon-tab-child active" id="tab-melee">Melees</button>
      <button class="weapon-tab-child" id="tab-gun">Guns</button>
    </div>
    <div class="weapon-list" id="list-melee"></div>
    <div class="weapon-list" id="list-gun"></div>
  `);

  // Render melee items
  const $meleeList = $("#list-melee").empty();
  for (const { idString, name } of allMelees) {
    const owned = isOwned(idString, ownedMeleeIds);
    $meleeList.append(`
      <div class="weapons-container-card weapons-container-card-melee${owned ? "" : " inactive"}" 
           id="weapons-list-${idString}" data-id="${idString}">
        <img src="${ASSET_PATH}/weapons/${idString}.svg" alt="${name}" width="72px" height="72px" />
        <p class="weapons-container-paragraph">${name}</p>
      </div>
    `);
  }

  // Render gun items
  const $gunList = $("#list-gun").empty();
  for (const { idString, name } of allGuns) {
    const owned = isOwned(idString, ownedGunIds);
    $gunList.append(`
      <div class="weapons-container-card weapons-container-card-gun${owned ? "" : " inactive"}" 
           id="weapons-list-${idString}" data-id="${idString}">
        <img src="${ASSET_PATH}/weapons/${idString}.svg" alt="${name}" width="72px" height="72px" />
        <p class="weapons-container-paragraph">${name}</p>
      </div>
    `);
  }

  // Tab switching logic
  $(".weapon-tab-child").off("click").on("click", function () {
    $(".weapon-tab-child").removeClass("active");
    $(this).addClass("active");
    if (this.id === "tab-melee") {
      $("#list-melee").show();
      $("#list-gun").hide();
    } else {
      $("#list-melee").hide();
      $("#list-gun").show();
    }
  });

  // Item click logic (only for owned)
  $container.off("click", ".weapons-container-card").on("click", ".weapons-container-card", async function () {
    if ($(this).hasClass("inactive")) return;
    const id = $(this).data("id");
    const type = $(this).hasClass("weapons-container-card-melee") ? "melee" : "gun";
    $(".weapons-container-card").removeClass("selected");
    $(this).addClass("selected");
    if (type === "melee") selectMelee(game, id);
    else selectGun(game, id);
  });

  // Read from localStorage if no highlightId provided
  if (!highlightId) {
    const savedMelee = localStorage.getItem("selectedMelee");
    const savedGun = localStorage.getItem("selectedGun");

    if (savedMelee && $(`#weapons-list-${savedMelee}`).length && !$(`#weapons-list-${savedMelee}`).hasClass("inactive")) {
      const $item = $(`#weapons-list-${savedMelee}`);
      $item.addClass("selected");
      $("#tab-melee").click();
      selectMelee(game, savedMelee);
    } else if (savedGun && $(`#weapons-list-${savedGun}`).length && !$(`#weapons-list-${savedGun}`).hasClass("inactive")) {
      const $item = $(`#weapons-list-${savedGun}`);
      $item.addClass("selected");
      $("#tab-gun").click();
      selectGun(game, savedGun);
    }
  }

  // Highlight item if needed (e.g., from rewards)
  if (highlightId) {
    const $item = $(`#weapons-list-${highlightId}`);
    if ($item.length && !$item.hasClass("inactive")) {
      $item.addClass("selected");
      if ($item.hasClass("weapons-container-card-melee")) {
        $("#tab-melee").click();
        selectMelee(game, highlightId);
      } else {
        $("#tab-gun").click();
        selectGun(game, highlightId);
      }
    }
  }
}