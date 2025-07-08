import dotenv from 'dotenv';
import path from 'path';
import { Config } from '../config';
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

export async function validateJWT(token: string): Promise<{ walletAddress: string }> {
    const url = `${Config.assetsConfig?.api}/api/getJWTSigner`;

    const res = await fetch(url, {
        method: "GET",
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
        },
    });
    if (res.status !== 200) return { walletAddress: "" };
    const data = await res.json();
    return {
        walletAddress: data.walletAddress.toLowerCase(),
    };
}


export async function claimRewards(player: string, rank: number, kills: number, teamMode: boolean, gameId: string): Promise<any> {
    const url = `${Config.assetsConfig?.api}/api/saveRewards`;
    try {
        const res = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': process.env.X_API_KEY || '',
            },
            body: JSON.stringify({ player, rank, kills, teamMode, gameId }),
        });

        const data = await res.json();

        return data;
    } catch (error: any) {
        throw new Error(error);
    }
}
