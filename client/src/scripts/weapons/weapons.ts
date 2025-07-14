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
  $(`.weapons-container-card`).removeClass("selected");
  $(`#weapons-list-${weaponId}`).addClass("selected");

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

  // Update weapon info panel
  const dps = melee.damage && melee.cooldown ? (melee.damage / (melee.cooldown / 1000)).toFixed(2) : "N/A";
  $("#weapon-info").html(`
    <p>${melee.name}</p>
    <p>DPS: ${dps}</p>
    <p>Damage: ${melee.damage ?? "N/A"}</p>
    <p>Cooldown: ${melee.cooldown ? (melee.cooldown / 1000) + "s" : "N/A"}</p>
  `);
};

// Function to select a gun
const selectGun = (game: Game, weaponId: string) => {
  // Store the selected weapon
  weapons.selectWeapon(game, { gun: weaponId });

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
};

// Utility to check if a weapon is owned
function isOwned(id: string, ownedIds: string[]) {
  return ownedIds.includes(id);
}

// Function to display guns
async function showGuns(game: Game, selectedGunId?: string) {
  try {
    const divineGuns = await game.account.getBalances(SurvivAssets.DivineGuns).catch((err) => {
      console.error(`Get DivineGuns error: ${err}`);
      return {};
    });

    const divineGunIds = Object.keys(divineGuns);
    const userGunsBalance = { ...divineGuns };
    const ownedGunIds = Object.keys(userGunsBalance);
    const allGuns = Guns.definitions; // Show all guns, not just owned ones

    // Split guns into owned and unowned
    const ownedGuns = allGuns.filter((gun) => isOwned(gun.idString, ownedGunIds));
    const unownedGuns = allGuns.filter((gun) => !isOwned(gun.idString, ownedGunIds));

    // Render gun items (owned first, then unowned)
    const $gunList = $("#list-gun").empty();
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

    // Reapply selected class if provided
    if (selectedGunId && $(`#weapons-list-${selectedGunId}`).length && !$(`#weapons-list-${selectedGunId}`).hasClass("inactive")) {
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
  try {
    const [silverArms, goldArms, divineArms] = await Promise.all([
      game.account.getBalances(SurvivAssets.SilverArms).catch(() => ({})),
      game.account.getBalances(SurvivAssets.GoldArms).catch(() => ({})),
      game.account.getBalances(SurvivAssets.DivineArms).catch(() => ({})),
    ]);

    const userArmsBalance = { ...silverArms, ...goldArms, ...divineArms };
    const ownedMeleeIds = [...freeMelees, ...Object.keys(userArmsBalance)];
    const allMelees = Melees.definitions;

    // Split melees into owned and unowned
    const ownedMelees = allMelees.filter((melee) => isOwned(melee.idString, ownedMeleeIds));
    const unownedMelees = allMelees.filter((melee) => !isOwned(melee.idString, ownedMeleeIds));

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

  weapons.resetAll();

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
    $aside.append(`
      <div id="weapon-info" style="margin-top: 5px; padding: 5px; background: rgba(0, 0, 0, 0.1); border-radius: 4px; font-size: 0.5em; max-height: 100px; overflow-y: auto;"></div>
    `);
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

  // Item click logic (only for owned items)
  $container.off("click", ".weapons-container-card").on("click", ".weapons-container-card", function () {
    if ($(this).hasClass("inactive")) return;
    const id = $(this).data("id");
    const type = $(this).hasClass("weapons-container-card-melee") ? "melee" : "gun";
    if (type === "melee") {
      weaponPreset.melee = id;
      selectMelee(game, id);
    } else {
      weaponPreset.gun = id;
      selectGun(game, id);
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