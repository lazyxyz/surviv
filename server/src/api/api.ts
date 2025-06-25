import dotenv from 'dotenv';
dotenv.config();

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

