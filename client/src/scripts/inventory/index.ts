import $ from "jquery";
import { formatEther } from "ethers";
import { PaymentTokens, SaleItems, SurvivAssets } from "../account";
import type { Game } from "../game";

export async function loadInventory(game: Game) {
    // Buy Keys
    {
        const tabButton = document.querySelectorAll<HTMLButtonElement>(".crates-tab-child");
        const tabCrates = document.querySelectorAll<HTMLElement>(".crates-customize-child");

        const userKeyBalances = await game.account.getBalances(SurvivAssets.SurvivKeys).catch(err => {
            console.log(`Failed to read keys balances: ${err}`);
        });

        let keyPrice = 0;
        {
            const price = await game.account.queryPrice(SaleItems.Keys, PaymentTokens.NativeToken).catch(err => {
                console.log(`Failed to query key price: ${err}`);
            });
            if (price) keyPrice = price;
        }

        let keyBalances = 0;
        if (userKeyBalances && userKeyBalances.keys) {
            keyBalances = userKeyBalances.keys;
        }

        const crateLists = [
            {
                balance: keyBalances,
                name: "Surviv Keys",
                image: `public/img/misc/Keys.png`,
                price: `${formatEther(keyPrice)} STT`
            }
        ];

        // Clear existing content to prevent duplicates
        $("#buy-customize-items").empty();

        crateLists.forEach((key) => {
            $("#buy-customize-items").append(`
                <div class="crates-card">
                    <p>You have ${key.balance} keys</p>
                    <img src="${key.image}" class="crates-image"></img>
                    <div class="crates-information">
                        <p>${key.name}</p>
                        <h3>${key.price}</h3>
                    </div>
                    <div class="crates-supply">
                        <button class="crates-remove" disabled>-</button>
                        <p class="crates-input">0</p>
                        <button class="crates-add">+</button>
                    </div>
                    <button class="btn btn-alert btn-darken buy-now-btn">
                        Buy now
                    </button>
                </div>
            `);
        });

        // Remove existing event listeners to prevent duplicates
        $(document).off("click", ".crates-tab-child");
        tabButton.forEach((button) => {
            button.addEventListener("click", () => {
                const tabButtonId = button.getAttribute("data-tab");
                if (!tabButtonId) return;

                tabButton.forEach((btn) => btn.classList.remove("active"));
                tabCrates.forEach((content) => content.style.display = "none");

                const targetTab = document.getElementById(tabButtonId);
                if (targetTab) {
                    targetTab.style.display = "flex";
                    button.classList.add("active");
                }
            });
        });

        // Add supply
        const mySupply = document.querySelectorAll(".crates-input");
        const addBtn = document.querySelectorAll(".crates-add");
        const removeBtn = document.querySelectorAll(".crates-remove");
        const buyNow = document.querySelectorAll(".buy-now-btn");

        // Remove existing event listeners for add/remove/buy buttons
        $(document).off("click", ".crates-add").off("click", ".crates-remove").off("click", ".buy-now-btn");

        for (let i = 0; i < mySupply.length; i++) {
            let buyAmount = 0;
            if (mySupply[i].textContent == "0") {
                buyNow[i].disabled = true;
            }

            addBtn[i].addEventListener("click", () => {
                buyAmount++;
                console.log(buyAmount);
                mySupply[i].textContent = buyAmount.toString();
                removeBtn[i].disabled = false;
                removeBtn[i].classList.add("active");
                buyNow[i].disabled = false;
                buyNow[i].classList.add("active");
            });

            removeBtn[i].addEventListener("click", () => {
                if (buyAmount > 0) {
                    buyAmount--;
                    console.log(buyAmount);
                    mySupply[i].textContent = buyAmount.toString();
                    if (buyAmount === 0) {
                        removeBtn[i].disabled = true;
                        removeBtn[i].classList.remove("active");
                        buyNow[i].disabled = true;
                        buyNow[i].classList.remove("active");
                    }
                }
            });

            $(buyNow[i]).on("click", async () => {
                await game.account.buyItems(SaleItems.Keys, buyAmount, PaymentTokens.NativeToken);
                buyAmount = 0;
                mySupply[i].textContent = 0;
                buyNow[i].disabled = true;
                buyNow[i].classList.remove("active");
                alert("Successfully Purchase")
            });
        }

        // My Crates

        let userCrates = await game.account.getBalances(SurvivAssets.SurvivCrates).catch(err => {
            console.log(`Failed to get user crate balance: ${err}`);
        });
        let crateImages = [];
        if (userCrates && userCrates.crates) {
            const crateImage = { image: `public/img/misc/crate.png` };
            crateImages = new Array(Number(userCrates.crates)).fill(crateImage);
            $("#total-crates").text(`You have: ${userCrates.crates} crates - ${keyBalances} keys`);
        }

        // Check disbled

        // Clear existing content to prevent duplicates
        $(".my-crates-customize").empty();

        crateImages.forEach((key) => {
            $(".my-crates-customize").append(`
                <div class="my-crates-child">
                    <img src="${key.image}" alt="">
                </div>
            `);
        });

        // Select crates to open
        const crateOpen = document.querySelectorAll(".my-crates-child");
        const totalSelected = document.querySelector(".total-selected");
        const openNow = document.querySelector(".open-now");
        const claimItem = document.querySelector(".claim-items");

        let count = 0;
        for (const crate of crateOpen) {
            // if (count >= keyBalances) {
            //     crate.classList.add("inactive");
            // }

            crate.addEventListener("click", () => {
                // crate.classList.toggle("active");
                const isActive = crate.classList.contains("active");

                if (isActive) {
                    crate.classList.remove("active");
                    count--;
                } else {
                    if (count < keyBalances) {
                        crate.classList.add("active");
                        count++;
                    } else {
                        alert("Insunfficient Key or Crate")
                    }
                }
                if (totalSelected) {
                    totalSelected.textContent = `${count} selected`;
                }

                if (count > 0) {
                    openNow.classList.add("active");
                    openNow.disabled = false;
                } else {
                    openNow.classList.remove("active");
                    openNow.disabled = true;
                }
            });
            // Remove existing event listeners
            $(".open-now").off("click");
            $(".claim-items").off("click");

            // const amount = 1;
            $(".open-now").on("click", async () => {
                await game.account.requestOpenCrates(count);
                // claimItem.classList.add("active");
                // crate.classList.remove("active");
                // openNow.classList.remove("active");
                // openNow.disabled = true;
            });

            $(".claim-items").on("click", async () => {
                await game.account.claimItems();
            });
        }
    }

    // Claim Rewards
    {
        let userRewards = await game.account.getValidRewards().catch(err => {
            console.log(`Failed to get valid rewards: ${err}`);
        });

        const now = Math.floor(Date.now() / 1000);
        let rewardLists = [];

        if (userRewards && userRewards.validCrates) {
            rewardLists = userRewards.validCrates.map(item => {
                const secondsLeft = item.expiry - now;
                const daysLeft = Math.max(Math.floor(secondsLeft / (60 * 60 * 24)), 0);

                return {
                    image: "public/img/misc/crate.png",
                    time: `Expired in ${daysLeft} day${daysLeft !== 1 ? 's' : ''}`
                };
            });
        }

        $("#total-reward").text(`You have ${rewardLists.length} crates to claim`);

        // Clear existing content to prevent duplicates
        $(".rewards-grid-group").empty();

        rewardLists.forEach((key) => {
            $(".rewards-grid-group").append(`
                <div class="reward-child">
                    <img src="${key.image}" alt="Crates">
                    <h3>${key.time}</h3>
                </div>
            `);
        });

        if (rewardLists.length === 0) {
            $("#claim-btn")
                .attr("disabled", "true")
                .css("opacity", "0.35");
        }

        // Remove existing event listener
        $(".claim-all-btn").off("click");

        $(".claim-all-btn").on("click", async () => {
            await game.account.claimRewards().catch(err => {
                console.log(`Failed claim rewards: ${err}`);
            });
        });
    }
}