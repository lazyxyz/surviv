// inventory/vehicles.ts
import $ from "jquery";
import { Account } from "../account";
import { GAME_CONSOLE } from "../..";
import { AssetTier, SurvivAssets } from "@common/blockchain";
import { ZIndexes } from "@common/constants";
import { SurvivAssetBalances } from ".";
import { DEFAULT_VEHICLES, Vehicles, type VehicleDefinition } from "@common/definitions/vehicles";

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
  scale?: number;
}

const selectVehiclePreset = (value: string) => {
  GAME_CONSOLE.setBuiltInCVar("dv_vehicle_preset", value);
};

const appendPreview = (images: Array<{
  zIndex: number
  rotate?: number
  url: string
  class: string
  x: number
  y: number
  scale?: number
}>, asideElement: JQuery<Partial<HTMLElement>>): JQuery<Partial<HTMLElement>> => {
  // clear previous
  asideElement.empty();

  // append new
  images.sort((a, b) => a.zIndex - b.zIndex).map(argument => {
    const gVector = document.createElementNS("http://www.w3.org/2000/svg", "g");
    const iVector = document.createElementNS("http://www.w3.org/2000/svg", "image");

    const cssStyles: any = {
      transformBox: "fill-box",
      translate: `calc(${argument.x}px - 50%) calc(${argument.y}px - 50%)`,
      transformOrigin: "center",
      rotate: `${argument.rotate}deg`,
      scale: `${argument.scale ?? 1}`
    };

    $(gVector).css(cssStyles);

    $(iVector).attr({
      class: argument.class,
      href: argument.url
    });

    gVector.append(iVector);

    asideElement.append(gVector);
  });

  return asideElement;
};

const showViewBox = (vehicleId: string, isOwned: boolean) => {
  const currentSkin = GAME_CONSOLE.getBuiltInCVar("cv_loadout_skin");
  const vehicle = Vehicles.definitions.find((w) => w.idString === vehicleId);
  if (!vehicle) {
    console.warn(`Vehicle not found: ${vehicleId}`);
    return;
  }

  const scaleFactor = 10; // Adjust this scale factor as needed to match the SVG coordinates
  const seatOffsetX = (vehicle.seats[0]?.offset?.x ?? 0) * scaleFactor;
  const seatOffsetY = (vehicle.seats[0]?.offset?.y ?? 0) * scaleFactor;

  const centerX = 50;
  const centerY = 30;

  const baseX = centerX + seatOffsetX;
  const baseY = centerY + seatOffsetY;

  const fistXOffset = 30; // Relative offset for fists
  const fistYOffset = 25; // Relative offset for fists

  const vehicleScale = 0.5;
  const wheelScale = 1.1 * vehicleScale;

  // Generate asset configuration
  let assets: AssetConfig[] = [
    {
      class: "assets-base",
      url: `${ASSET_PATH}/skins/${currentSkin}_base.svg`,
      x: baseX,
      y: baseY,
      zIndex: ZIndexes.Players,
      rotate: 0,
      scale: 0.7,
    },
    {
      class: "assets-fist",
      url: `${ASSET_PATH}/skins/${currentSkin}_fist.svg`,
      x: baseX + fistXOffset,
      y: baseY + fistYOffset,
      zIndex: ZIndexes.Players,
      rotate: 0,
      scale: 0.7,
    },
    {
      class: "assets-fist",
      url: `${ASSET_PATH}/skins/${currentSkin}_fist.svg`,
      x: baseX + fistXOffset,
      y: baseY - fistYOffset,
      zIndex: ZIndexes.Players,
      rotate: 0,
      scale: 0.7,
    },
    {
      class: "assets-world",
      url: `${ASSET_PATH}/vehicles/${vehicle.idString}.svg`,
      x: centerX,
      y: centerY,
      rotate: 0,
      zIndex: vehicle.zIndex ?? 1,
      scale: vehicleScale,
    }
  ];

  // Add wheels
  vehicle.wheels.forEach(wheel => {
    const wheelX = centerX + wheel.offset.x * vehicleScale; // Adjust scaleFactor for wheels if needed
    const wheelY = centerY + wheel.offset.y * vehicleScale;
    assets.push({
      class: "assets-wheel",
      url: `${ASSET_PATH}/vehicles/basic_wheel.svg`,
      x: wheelX,
      y: wheelY,
      zIndex: wheel.zIndex ?? vehicle.zIndex,
      rotate: 0,
      scale: wheelScale,
    });
  });

  // Append assets and set viewBox
  appendPreview(assets, $(".vehicles-container-aside-preview")).attr("viewBox", VIEWBOX);

  // Update vehicle info panel
  $("#vehicle-info").html(`
    <div class="vehicle-title">${vehicle.name}${isOwned? ' <span class="weapon-title-state">(Locked)</span>' : ''}</div>
    <div class="row-stats">
      <div class="row-section">
        <p class="stat-type">Health:</p>
        <span class="stat-value">${vehicle.health ?? "N/A"}</span>
      </div>
      <div class="row-section">
        <p class="stat-type">Max Speed:</p>
        <span class="stat-value">${vehicle.maxSpeed ?? "N/A"}</span>
      </div>
    </div>
  `);
};

// Function to select a vehicle (only for owned)
const selectVehicle = (vehicleId: string) => {
  // Store the selected vehicle
  selectVehiclePreset(vehicleId);

  // Save to localStorage
  localStorage.setItem("selectedVehicle", vehicleId);

  // Add "selected" class to the vehicle element
  $(".vehicles-container-card").removeClass("selected");
  $(`#vehicles-list-${vehicleId}`).addClass("selected");
};

// Utility to check if a vehicle is owned
function isOwned(id: string, ownedIds: string[]) {
  return ownedIds.includes(id);
}

// Function to render mini preview for list cards
const renderMiniPreview = (vehicle: VehicleDefinition, container: JQuery<Partial<HTMLElement>>) => {
  const vehicleScale = 0.5;
  const wheelScale = 1.1 * vehicleScale;

  const centerX = 50;
  const centerY = 30;

  let assets: AssetConfig[] = [
    {
      class: "assets-world",
      url: `${ASSET_PATH}/vehicles/${vehicle.idString}.svg`,
      x: centerX,
      y: centerY,
      rotate: 0,
      zIndex: vehicle.zIndex ?? 1,
      scale: vehicleScale,
    }
  ];

  // Add wheels
  vehicle.wheels.forEach((wheel: { offset: { x: number; y: number; }; zIndex: any; }) => {
    const wheelX = centerX + wheel.offset.x * vehicleScale;
    const wheelY = centerY + wheel.offset.y * vehicleScale;
    assets.push({
      class: "assets-wheel",
      url: `${ASSET_PATH}/vehicles/basic_wheel.svg`,
      x: wheelX,
      y: wheelY,
      zIndex: wheel.zIndex ?? vehicle.zIndex,
      rotate: 0,
      scale: wheelScale,
    });
  });

  appendPreview(assets, container).attr("viewBox", VIEWBOX);
};

// Function to display vehicles list
async function showVehiclesList(account: Account, selectedVehicleId?: string) {
  if (!account.address) {
    return;
  }

  try {
    let userVehicleBalance: [string, number][] = DEFAULT_VEHICLES.map(
      (vehicle) => [vehicle, 1] as [string, number]
    );

    for (const tier of Object.values(AssetTier).filter(val => typeof val === 'number') as AssetTier[]) {
      const vehiclesInTier = Object.entries(SurvivAssetBalances[SurvivAssets.Vehicles][tier] || {});
      userVehicleBalance.push(...vehiclesInTier);
    }
    const userVehicles = userVehicleBalance
      .filter(([_, balance]) => balance > 0)
      .map(([id]) => id);

    // All vehicles
    const allVehicles = Vehicles.definitions;

    // Inactive vehicles (not owned by the user)
    const inactiveVehicles = allVehicles
      .filter(vehicle => !userVehicles.includes(vehicle.idString));

    // Sort vehicles: owned first, then inactive
    const sortedVehicles = [
      ...allVehicles.filter(vehicle => userVehicles.includes(vehicle.idString)),
      ...inactiveVehicles
    ];

    // Map tiers to background images
    const tierBackgrounds: Record<AssetTier, string> = {
      [AssetTier.Silver]: `${ASSET_PATH}/patterns/silver.svg`,
      [AssetTier.Gold]: `${ASSET_PATH}/patterns/gold.svg`,
      [AssetTier.Divine]: `${ASSET_PATH}/patterns/divine.svg`
    };

    // Render vehicle items
    const $vehicleList = $("#list-vehicle").empty();

    for (const vehicle of sortedVehicles) {
      const { idString, name } = vehicle;
      const owned = isOwned(idString, userVehicles);

      // Determine the tier of the vehicle
      let tier: AssetTier | undefined;
      for (const t of Object.values(AssetTier).filter(val => typeof val === 'number') as AssetTier[]) {
        if (Object.keys(SurvivAssetBalances[SurvivAssets.Vehicles][t] || {}).includes(idString)) {
          tier = t;
          break;
        }
      }

      // Default to Silver if tier not found (e.g., for inactive vehicles)
      const backgroundImage = tier !== undefined ? tierBackgrounds[tier] : tierBackgrounds[AssetTier.Silver];

      const cardHtml = `
        <div class="vehicles-container-card${owned ? "" : " inactive"}"
             id="vehicles-list-${idString}" data-id="${idString}">
          <div class="vehicles-tier-background" style="background-image: url('${backgroundImage}')">
            <svg class="vehicles-mini-preview" width="98px" height="56px"></svg>
          </div>
          <p class="vehicles-container-paragraph">${name}</p>
        </div>
      `;

      $vehicleList.append(cardHtml);

      // Render mini preview inside the SVG
      const $miniPreview = $(`#vehicles-list-${idString} .vehicles-mini-preview`);
      renderMiniPreview(vehicle, $miniPreview);
    }

    // Reapply selected class if provided
    if (selectedVehicleId && $(`#vehicles-list-${selectedVehicleId}`).length) {
      $(`#vehicles-list-${selectedVehicleId}`).addClass("selected");
    }

    // Show vehicle list
    $("#list-vehicle").show();
  } catch (err) {
    console.error(`Error displaying vehicles: ${err}`);
  }
}

// Main function to display vehicles
export async function showVehicles(account: Account, highlightId?: string): Promise<void> {
  // Build UI (no tabs, only one list)
  const $container = $<HTMLDivElement>(".vehicles-container-list").empty();
  $container.append(`
    <div class="vehicle-list" id="list-vehicle"></div>
  `);

  // Append vehicle info panel to .vehicles-container-aside, below .vehicles-container-aside-preview
  const $aside = $(".vehicles-container-aside");
  if ($("#vehicle-info").length === 0) {
    $aside.append(`<div id="vehicle-info"></div>`);
  }

  // Get vehicle preset
  let vehiclePreset: string = "";
  try {
    const presetString = GAME_CONSOLE.getBuiltInCVar("dv_vehicle_preset");
    if (presetString) {
      vehiclePreset = presetString;
    }
  } catch (err) {
    console.error(`Error parsing dv_vehicle_preset: ${err}`);
  }

  // Load vehicle list
  await showVehiclesList(account, vehiclePreset);

  let userVehicleBalance: [string, number][] = DEFAULT_VEHICLES.map(
    (vehicle) => [vehicle, 1] as [string, number]
  );

  for (const tier of Object.values(AssetTier).filter(val => typeof val === 'number') as AssetTier[]) {
    const vehiclesInTier = Object.entries(SurvivAssetBalances[SurvivAssets.Vehicles][tier] || {});
    userVehicleBalance.push(...vehiclesInTier);
  }
  const userVehicles = userVehicleBalance
    .filter(([_, balance]) => balance > 0)
    .map(([id]) => id);

  $container.off("click", ".vehicles-container-card").on("click", ".vehicles-container-card", function () {
    const id = $(this).data("id");
    const owned = isOwned(id, userVehicles);

    if (owned) {
      selectVehicle(id);
    }
    // Always show preview, even if not owned
    showViewBox(id, owned);
  });

  // Load selected vehicle from dv_vehicle_preset
  if (!highlightId) {
    if (vehiclePreset && $(`#vehicles-list-${vehiclePreset}`).length) {
      $(`#vehicles-list-${vehiclePreset}`).addClass("selected");
      showViewBox(vehiclePreset, true); // Assuming preset is owned
    }
  }

  // Highlight item if provided (e.g., from rewards)
  if (highlightId) {
    const $item = $(`#vehicles-list-${highlightId}`);
    if ($item.length) {
      const owned = isOwned(highlightId, userVehicles);
      if (owned) {
        $item.addClass("selected");
        selectVehiclePreset(highlightId);
        selectVehicle(highlightId);
      }
      showViewBox(highlightId, owned);
    }
  }
}