import * as fs from 'fs';
import * as https from 'https';
import { Config } from '../config';

export async function saveRanks(address: string, rank: number, teamMode: boolean, gameId: number) {
    if (!address || (!teamMode && rank > 5) || (teamMode && rank > 3)) {
        console.log('Invalid parameters or rank not eligible.');
        return;
    }

    try {
        // Function to make the whitelist API request
        const checkWhitelist = (whitelist: string): Promise<number> => {
            const apiUrl = `https://test-api.openmark.io/market/api/nft/nft-count/amount?owner=${address}&collections=${whitelist}`;

            return new Promise((resolve, reject) => {
                https.get(apiUrl, { headers: { accept: 'application/json' } }, (res) => {
                    let data = '';
                    res.on('data', (chunk) => {
                        data += chunk;
                    });

                    res.on('end', () => {
                        try {
                            const jsonResponse = JSON.parse(data);
                            if (jsonResponse.success && typeof jsonResponse.data === 'number') {
                                resolve(jsonResponse.data); // Extract `data` field
                            } else {
                                reject(new Error('Invalid API response structure'));
                            }
                        } catch (err) {
                            reject(new Error('Failed to parse JSON response'));
                        }
                    });
                }).on('error', (err) => {
                    reject(err);
                });
            });

        };

        // Perform the whitelist check
        if (Config.whitelist) {
            const whitelistCount = await checkWhitelist(Config.whitelist);
            if (whitelistCount < 1) {
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
