import $ from "jquery";
import { Account } from "../account";
import { GAME_CONSOLE } from "../..";
import { SurvivAssets, AssetTier } from "@common/blockchain";
import { SurvivAssetBalances } from ".";
import { Vehicles } from "@common/definitions/vehicle";

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
}>): JQuery<Partial<HTMLElement>> => {
  const asideElement = $(".vehicles-container-aside-preview");

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
  const vehicleId = localStorage.getItem("selectedVehicle");

  const currentSkin = GAME_CONSOLE.getBuiltInCVar("cv_loadout_skin");
  const vehicle = Vehicles.definitions.find((w) => w.idString === vehicleId);
  if (!vehicle) {
    console.warn(`Vehicle not found: ${vehicleId}`);
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
  ];

  // Append assets and set viewBox
  appendPreview(assets).attr("viewBox", VIEWBOX);
}

// Function to select a vehicle
const selectVehicle = (vehicleId: string) => {
  // Store the selected vehicle
  selectVehiclePreset(vehicleId);

  // Save to localStorage
  localStorage.setItem("selectedVehicle", vehicleId);

  // Add "selected" class to the vehicle element
  $(`.vehicles-container-card`).removeClass("selected");
  $(`#vehicles-list-${vehicleId}`).addClass("selected");

  // Find the vehicle definition
  const vehicle = Vehicles.definitions.find((w) => w.idString === vehicleId);
  if (!vehicle) {
    console.warn(`Vehicle not found: ${vehicleId}`);
    return;
  }

  // Update vehicle info panel
  $("#vehicle-info").html(`
     <div class="vehicle-title">${vehicle.name}</div>
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

  showViewBox();
};

// Utility to check if a vehicle is owned
function isOwned(id: string, ownedIds: string[]) {
  return ownedIds.includes(id);
}

// Function to display vehicles
async function showVehiclesList(account: Account, selectedVehicleId?: string) {
  if (!account.address) {
    return;
  }

  try {
    const allVehicles = Vehicles.definitions;
    // Hardcode show all as owned for testing
    const userVehicles = allVehicles.map((vehicle) => vehicle.idString);
    const ownedVehicles = allVehicles;
    const unownedVehicles = [];

    // Map tiers to background images
    const tierBackgrounds: Record<AssetTier, string> = {
      [AssetTier.Silver]: `${ASSET_PATH}/patterns/silver.svg`,
      [AssetTier.Gold]: `${ASSET_PATH}/patterns/gold.svg`,
      [AssetTier.Divine]: `${ASSET_PATH}/patterns/divine.svg`
    };

    // Render vehicle items (all as owned, default to Silver tier)
    const $vehicleList = $("#list-vehicle").empty();

    for (const { idString, name } of ownedVehicles) {
      // Hardcode tier to Silver for testing
      const tier = AssetTier.Silver;
      const backgroundImage = tierBackgrounds[tier];

      $vehicleList.append(`
        <div class="vehicles-container-card"
             id="vehicles-list-${idString}" data-id="${idString}">
             <div class="vehicles-tier-background" style="background-image: url('${backgroundImage}')">
          <img src="${ASSET_PATH}/vehicles/${idString}.svg" alt="${name}" width="72px" height="72px" />
          </div>
          <p class="vehicles-container-paragraph">${name}</p>
        </div>
      `);
    }

    // No unowned for testing

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

  showViewBox();

  $container.off("click", ".vehicles-container-card").on("click", ".vehicles-container-card", function () {
    const id = $(this).data("id");

    // Remove all selected classes first
    $(".vehicles-container-card").removeClass("selected");

    $(this).addClass("selected");
    selectVehiclePreset(id);
    selectVehicle(id);
  });

  // Load selected vehicle from dv_vehicle_preset
  if (!highlightId) {
    if (vehiclePreset && $(`#vehicles-list-${vehiclePreset}`).length) {
      $(`#vehicles-list-${vehiclePreset}`).addClass("selected");
      selectVehicle(vehiclePreset);
    }
  }

  // Highlight item if provided (e.g., from rewards)
  if (highlightId) {
    const $item = $(`#vehicles-list-${highlightId}`);
    if ($item.length) {
      $item.addClass("selected");
      selectVehiclePreset(highlightId);
      selectVehicle(highlightId);
    }
  }
}