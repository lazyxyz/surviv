import dotenv from 'dotenv';
import path from 'path';
import { Config } from '../config';
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

export async function validateJWT(token: string, timeout: number = 5000): Promise<{ walletAddress: string }> {
    const url = `${Config.assetsConfig?.api}/api/getJWTSigner`;
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

export async function saveGameResult(player: string, rank: number, kills: number, teamMode: boolean, gameId: string, timeout: number = 10000): Promise<any> {
    const url = `${Config.assetsConfig?.api}/admin/saveGameResult`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
        const res = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': process.env.X_API_KEY || '',
            },
            body: JSON.stringify({ player, rank, kills, teamMode, gameId }),
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