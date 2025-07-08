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

  // Add "selected" class to the weapon element
  $(`#weapons-assets-${weaponId}`).addClass("selected");

  // Find the gun definition
  const gun = Guns.definitions.find((w) => w.idString === weaponId);
  if (!gun) {
    console.warn(`Gun not found: ${weaponId}`);
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
      url: `${ASSET_PATH}/weapons/${gun.idString}_world.svg`,
      x: gun.fists.left.x,
      y: 0,
      rotate: gun.image?.angle ?? 0,
      zIndex: 1,
    },
    {
      class: "assets-fist",
      url: `${ASSET_PATH}/skins/${currentSkin}_fist.svg`,
      x: gun.fists.right.x,
      y: gun.fists.right.y,
      zIndex: 4,
      rotate: 0,
    },
    {
      class: "assets-fist",
      url: `${ASSET_PATH}/skins/${currentSkin}_fist.svg`,
      x: gun.fists.left.x,
      y: gun.fists.left.y,
      zIndex: 3,
      rotate: 0,
    },
  ];

  // Append assets and set viewBox
  weapons.appendPreview(assets).attr("viewBox", VIEWBOX);
};

// Display weapons in a given category
async function displayWeapons(game: Game, category: string, type: WeaponType, items: any) {
  const $itemsList = $<HTMLDivElement>(".weapons-container-list");

  // Append category header
  $itemsList.append(`<h2 class='weapons-container-card-${type}'>${category}</h2>`);

  // Create and append weapon items
  for (const { idString, name } of items) {
    const $item = $<HTMLDivElement>(`
      <div class="weapons-container-card weapons-container-card-${type}" id="weapons-list-${idString}">
        <img src="${ASSET_PATH}/weapons/${idString}.svg" alt="${name}" width="72px" height="72px" />
        <p class="weapons-container-paragraph">${name}</p>
      </div>
    `);

    $item.on("click", async () => {
      // Remove "selected" class from all items in the category
      $(`.weapons-container-card-${type}`).removeClass("selected");
      $item.addClass("selected");

      // Check if a preset weapon exists
      const weaponPreset = game.console.getBuiltInCVar("dv_weapon_preset").startsWith("{")
        ? JSON.parse(game.console.getBuiltInCVar("dv_weapon_preset"))
        : undefined;

      const availableWeapons = await weapons.appendAsset(idString, items);
      const presetWeapon = availableWeapons?.find((meta) => meta.idString === weaponPreset?.[type]);

      // Select the appropriate weapon
      if (type === "melee") {
        selectMelee(game, presetWeapon?.idString ?? idString);
      } else {
        selectGun(game, presetWeapon?.idString ?? idString);
      }
    });

    $itemsList.append($item);
  }

  // Event delegation for asset clicks
  $itemsList.off("click", ".weapons-container-card-assets").on("click", ".weapons-container-card-assets", ({ currentTarget }) => {
    const weaponId = currentTarget.id.replace("weapons-assets-", "");
    if (type === "melee") {
      selectMelee(game, weaponId);
    } else {
      selectGun(game, weaponId);
    }
  });
}

// Main function to display melees and guns
export async function showMelees(game: Game): Promise<void> {
  if (!game?.account?.address) {
    console.warn("No account address provided");
    return;
  }

  // Reset items before rendering
  weapons.resetAll();

  // Fetch balances concurrently
  const [silverArms, goldArms, divineArms, divineGuns] = await Promise.all([
    game.account.getBalances(SurvivAssets.SilverArms).catch((err) => {
      console.error(`Get SilverArms error: ${err}`);
      return {};
    }),
    game.account.getBalances(SurvivAssets.GoldArms).catch((err) => {
      console.error(`Get GoldArms error: ${err}`);
      return {};
    }),
    game.account.getBalances(SurvivAssets.DivineArms).catch((err) => {
      console.error(`Get DivineArms error: ${err}`);
      return {};
    }),
    game.account.getBalances(SurvivAssets.DivineGuns).catch((err) => {
      console.error(`Get DivineGuns error: ${err}`);
      return {};
    }),
  ]);

  // Combine balances and extract weapon IDs
  const userArmsBalance = { ...silverArms, ...goldArms, ...divineArms };
  const userGunsBalance = { ...divineGuns };

  const userArmKeys = Object.keys(userArmsBalance);
  const userGunKeys = Object.keys(userGunsBalance);

  // Filter available melees and guns
  const userMelees = Melees.definitions.filter((weapon) =>
    [...freeMelees, ...userArmKeys].includes(weapon.idString)
  );
  const userGuns = Guns.definitions.filter((weapon) =>
    userGunKeys.includes(weapon.idString)
  );

  // Display melees and guns
  await Promise.all([
    displayWeapons(game, "Melees", "melee", userMelees),
    displayWeapons(game, "Guns", "gun", userGuns),
  ]);
}