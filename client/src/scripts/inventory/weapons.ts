import $ from "jquery";
import { Melees } from "@common/definitions/melees";
import { Guns } from "@common/definitions/guns";
import { Account } from "../account";
import { GAME_CONSOLE } from "../..";
import { SurvivAssets } from "@common/mappings";
import { SurvivAssetBalances } from ".";

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


const selectWeapon = (value: object) => {
  const weaponPreset = GAME_CONSOLE.getBuiltInCVar("dv_weapon_preset");

  GAME_CONSOLE.setBuiltInCVar("dv_weapon_preset", JSON.stringify({
    ...(weaponPreset?.startsWith("{") ? JSON.parse(weaponPreset) : undefined),
    ...value
  }));
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

const showViewBox = () => {
  const meleeId = localStorage.getItem("selectedMelee");
  const gunId = localStorage.getItem("selectedGun");

  const currentSkin = GAME_CONSOLE.getBuiltInCVar("cv_loadout_skin");
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
const selectMelee = (weaponId: string) => {
  // Store the selected weapon
  selectWeapon({ melee: weaponId });

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

  // Check if owned
  const isUnowned = $(`#weapons-list-${weaponId}`).hasClass("inactive");

  // Update weapon info panel
  const dps = melee.damage && melee.cooldown ? (melee.damage / (melee.cooldown / 1000)).toFixed(2) : "N/A";
  $("#weapon-info").html(`
     <div class="weapon-title">${melee.name}${isUnowned ? ' <span style="color: #ffc107;font-size: 14px;">(Locked)</span>' : ''}</div>
    <div class="row-stats">
      <div class="row-section">
              <p class="stat-type">DPS:</p>
              <span class="stat-value">${dps}</span>
      </div>
      <div class="row-section">
              <p class="stat-type">Damage:</p>
              <span class="stat-value">${melee.damage ?? "N/A"}</span>
      </div>
      </div>
      <div class="child-section">
              <p class="stat-type">Cooldown:</p>
              <span class="stat-value">${melee.cooldown ? (melee.cooldown / 1000) + "s" : "N/A"}</span>
      </div>
  `);

  showViewBox();
};

/*
======================================================
======================================================
*/

// ammo mapping
const AMMO_TYPE_IMAGES: Record<string, string> = {
  "762mm": `${ASSET_PATH}/loot/762mm.svg`,
  "556mm": `${ASSET_PATH}/loot/556mm.svg`,
  "9mm": `${ASSET_PATH}/loot/9mm.svg`,
  "12g": `${ASSET_PATH}/loot/12g.svg`,
  "50cal": `${ASSET_PATH}/loot/50cal.svg`,
  "338lap": `${ASSET_PATH}/loot/338lap.svg`,
  "power_cell": `${ASSET_PATH}/loot/power_cell.svg`,
  "firework_rocket": `${ASSET_PATH}/loot/firework_rocket.svg`,
  "bb": `${ASSET_PATH}/loot/bb.svg`,
  "curadell": `${ASSET_PATH}/loot/curadell.svg`,
};


// Function to select a gun
const selectGun = (weaponId: string) => {
  // Store the selected weapon
  selectWeapon({ gun: weaponId });

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

  // Check if owned
  const isUnowned = $(`#weapons-list-${weaponId}`).hasClass("inactive");

  // Get ammo image or fallback to text
  let ammoTypeHtml = "N/A";
  if (gun.ammoType && AMMO_TYPE_IMAGES[gun.ammoType]) {
    ammoTypeHtml = `<img src="${AMMO_TYPE_IMAGES[gun.ammoType]}" alt="${gun.ammoType}" style="height:20px;vertical-align:middle;" />`;
  } else if (gun.ammoType) {
    ammoTypeHtml = gun.ammoType;
  }
  // // Capacity of gun
  let capacityAmout = "N/A";
  if (typeof gun.capacity === "number" || typeof gun.extendedCapacity === "number") {
    const base = gun.capacity ?? gun.extendedCapacity;
    capacityAmout = String(base);
    // Show extended capacity if available
    if (typeof gun.extendedCapacity === "number" && gun.extendedCapacity !== base) {
      capacityAmout += ` -> ${gun.extendedCapacity}`;
    }
  }

  // Update weapon info panel
  const dps = gun.ballistics.damage && gun.fireDelay ? (gun.ballistics.damage / (gun.fireDelay / 1000)).toFixed(2) : "N/A";
  $("#weapon-info").html(`
    <div class="weapon-title">${gun.name}${isUnowned ? ' <span style="color: #ffc107;font-size: 14px;">(Locked)</span>' : ''}</div>
    <div class="row-stats">
      <div class="row-section">
              <p class="stat-type">DPS:</p>
              <span class="stat-value">${dps}</span>
      </div>
      <div class="row-section">
              <p class="stat-type">Damage:</p>
              <span class="stat-value">${gun.ballistics.damage ?? "N/A"}</span>
      </div>
      <div class="row-section">
              <p class="stat-type">Speed:</p>
              <span class="stat-value">${gun.ballistics.speed ?? "N/A"}</span>
      </div>
      <div class="row-section">
              <p class="stat-type">Range:</p>
              <span class="stat-value">${gun.ballistics.range ?? "N/A"}</span>
      </div>
      <div class="row-section">
              <p class="stat-type">Ammo:</p>
              <span class="stat-value">${ammoTypeHtml}</span>
      </div>
      <div class="row-section">
              <p class="stat-type">Capacity:</p>
              <span class="stat-value" id="capacity-text">${capacityAmout}</span>
      </div>
  `);

  showViewBox();
};

// Utility to check if a weapon is owned
function isOwned(id: string, ownedIds: string[]) {
  return ownedIds.includes(id);
}

// Function to display guns
async function showGuns(account: Account, selectedGunId?: string) {
  if (!account.address) {
    return;
  }

  try {

    let gunBalances = Object.entries(SurvivAssetBalances[SurvivAssets.Guns]);
    const userGuns = gunBalances.map(g => g[0]);

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
async function showMelees(account: Account, selectedMeleeId?: string) {
  if (!account.address) {
    return;
  }

  try {
    const userArmsBalance = [
      ...Object.entries(SurvivAssetBalances[SurvivAssets.Arms]),
    ];
    const userArms = userArmsBalance.map(s => s[0]);
    userArms.push("fists"); // Add default

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
export async function showWeapons(account: Account, highlightId?: string): Promise<void> {
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
    const presetString = GAME_CONSOLE.getBuiltInCVar("dv_weapon_preset");
    if (presetString) {
      weaponPreset = JSON.parse(presetString);
    }
  } catch (err) {
    console.error(`Error parsing dv_weapon_preset: ${err}`);
  }

  // Load melee list by default
  await showMelees(account, weaponPreset.melee);

  showViewBox();

  // Tab switching logic
  $(".weapon-tab-child").off("click").on("click", async function () {
    $(".weapon-tab-child").removeClass("active");
    $(this).addClass("active");

    if (this.id === "tab-melee") {
      await showMelees(account, weaponPreset.melee);
    } else {
      await showGuns(account, weaponPreset.gun);
    }
  });

  $container.off("click", ".weapons-container-card").on("click", ".weapons-container-card", function () {
    const id = $(this).data("id");
    const type = $(this).hasClass("weapons-container-card-melee") ? "melee" : "gun";
    const isInactive = $(this).hasClass("inactive");

    // Remove all selected classes first
    $(".weapons-container-card").removeClass("selected");

    if (type === "melee") {
      if (!isInactive) {
        $(this).addClass("selected");
        weaponPreset.melee = id;
        selectMelee(id);
      } else {
        // Show info for unowned melee, but do not select or update preset
        selectMelee(id);
      }
    } else {
      if (id === "no-gun") {
        $(this).addClass("selected");
        weaponPreset.gun = undefined;
        localStorage.removeItem("selectedGun");
        selectWeapon({ gun: undefined });
        $("#weapon-info").empty();
        showViewBox();
      } else {
        if (!isInactive) {
          $(this).addClass("selected");
          weaponPreset.gun = id;
          selectGun(id);
        } else {
          // Show info for unowned gun, but do not select or update preset
          selectGun(id);
        }
      }
    }
  });

  // Load selected weapons from dv_weapon_preset
  if (!highlightId) {
    if (weaponPreset.melee && $(`#weapons-list-${weaponPreset.melee}`).length && !$(`#weapons-list-${weaponPreset.melee}`).hasClass("inactive")) {
      $(`#weapons-list-${weaponPreset.melee}`).addClass("selected");
      $("#tab-melee").addClass("active");
      $("#tab-gun").removeClass("active");
      await showMelees(account, weaponPreset.melee);
      selectMelee(weaponPreset.melee);
    } else if (weaponPreset.gun && $(`#weapons-list-${weaponPreset.gun}`).length && !$(`#weapons-list-${weaponPreset.gun}`).hasClass("inactive")) {
      $(`#weapons-list-${weaponPreset.gun}`).addClass("selected");
      $("#tab-gun").addClass("active");
      $("#tab-melee").removeClass("active");
      await showGuns(account, weaponPreset.gun);
      selectGun(weaponPreset.gun);
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
        await showMelees(account, highlightId);
        selectMelee(highlightId);
      } else {
        weaponPreset.gun = highlightId;
        $("#tab-gun").addClass("active");
        $("#tab-melee").removeClass("active");
        await showGuns(account, highlightId);
        selectGun(highlightId);
      }
    }
  }
}
