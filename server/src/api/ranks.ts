import * as fs from 'fs';
import * as https from 'https';
import { Config } from '../config';
import { getERC721Balance } from "@api/erc721";

export async function saveRanks(address: string, rank: number, teamMode: boolean, gameId: number) {
    if (!address || (!teamMode && rank > 5) || (teamMode && rank > 3)) {
        console.log('Invalid parameters or rank not eligible.');
        return;
    }

    try {

        // Perform the whitelist check
        if (Config.blockchainConfig?.card) {
            const cardBalance = await getERC721Balance(Config.blockchainConfig?.rpc, Config.blockchainConfig.card, address);
            if (BigInt(cardBalance.balance) == 0n) {
                console.log('Whitelist check failed. Address does not meet the criteria.');
                return;
            }
        }

        // Define the data to save
        const record = {
            time: new Date().toISOString(),
            gameId: gameId,
            address: address,
            rank,
        };

        // Convert the record to CSV format
        const csvRow = `${record.time},${record.gameId},${record.address},${record.rank}\n`;

        // Append to the 'ranks' file
        fs.appendFile('ranks', csvRow, (err) => {
            if (err) {
                console.error('Error writing to file:', err);
            } else {
                console.log('Record saved:', csvRow.trim());
            }
        });
    } catch (error) {
        console.error('Error during whitelist check');
    }
}
