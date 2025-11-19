import dotenv from 'dotenv';
import path from 'path';
import { Config } from '../config';
import { Blockchain, getSurvivAddress } from '@common/blockchain/contracts';
import { chainToConfig } from '@common/blockchain/config';
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

export async function validateJWT(token: string, timeout: number = 5000): Promise<{ walletAddress: string }> {
    const url = `${Config.earnConfig?.api}/api/getJWTSigner`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
        const res = await fetch(url, {
            method: "GET",
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`,
            },
            signal: controller.signal,
        });
        clearTimeout(timeoutId);

        if (res.status !== 200) return { walletAddress: "" };
        const data = await res.json();
        return {
            walletAddress: data.walletAddress.toLowerCase(),
        };
    } catch (error: any) {
        clearTimeout(timeoutId);
        if (error.name === 'AbortError') {
            throw new Error('Request timed out');
        }
        throw error;
    }
}

export async function savePlayerRank(chain: Blockchain, player: string, rank: number,
    teamMode: boolean, gameId: string, boost: number = 0, timeout: number = 10000): Promise<any> {
    const url = `${Config.earnConfig?.api}/admin/savePlayerRank`;

    const chainId = chainToConfig[chain].chainId;
    const survivRewards = getSurvivAddress(chain, "SurvivRewards");

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);
    try {
        const res = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': process.env.X_API_KEY || '',
            },
            body: JSON.stringify({ chainId, survivRewards, player, rank, teamMode, gameId, boost }),
            signal: controller.signal,
        });

        clearTimeout(timeoutId);

        const data = await res.json();
        return data;
    } catch (error: any) {
        clearTimeout(timeoutId);
        if (error.name === 'AbortError') {
            throw new Error('Request timed out');
        }
        throw new Error(error);
    }
}

export async function savePlayerGame(chain: Blockchain, player: string, rank: number, teamMode: boolean,
    gameId: string, kills: number, timeAlive: number, damageDone: number,
    damageTaken: number, timeout: number = 10000): Promise<any> {
    const url = `${Config.earnConfig?.api}/admin/savePlayerGame`;

    const chainId = chainToConfig[chain].chainId;
    const survivRewards = getSurvivAddress(chain, "SurvivRewards");
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);
    try {
        const res = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': process.env.X_API_KEY || '',
            },
            body: JSON.stringify({ chainId, player, rank, teamMode, gameId, kills, timeAlive, damageDone, damageTaken, survivRewards }),
            signal: controller.signal,
        });

        clearTimeout(timeoutId);

        const data = await res.json();
        return data;
    } catch (error: any) {
        clearTimeout(timeoutId);
        if (error.name === 'AbortError') {
            throw new Error('Request timed out');
        }
        throw new Error(error);
    }
}