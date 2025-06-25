import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

export async function validateJWT(token: string): Promise<{ walletAddress: string }> {
    const url = `${process.env.API_URL}/api/getJWTSigner`;

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
        walletAddress: data.walletAddress,
    };
}


export async function saveRewards(user: string, rank: number, teamMode: boolean, gameId: number): Promise<void> {
    const url = `${process.env.API_URL}/api/saveRewards`;
    try {
        const res = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': process.env.X_API_KEY || '',
            },
            body: JSON.stringify({ user, rank, teamMode, gameId }),
        });

        const data = await res.json();

        if (!res.ok || !data.success) {
            throw new Error(data.error || 'Failed to save rewards');
        }

        return data;
    } catch (error: any) {
        console.log("error: ", error);
        throw new Error(error);
    }
}
