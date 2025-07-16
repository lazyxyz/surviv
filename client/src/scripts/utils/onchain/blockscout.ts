
interface MintResult {
  address: string;
  values: [number, number][];
}

async function getErc1155Mints(
  transactionHash: string,
  baseUrl: string = 'https://somnia.w3us.site/api/v2'
): Promise<MintResult[]> {
  try {
    const url = `${baseUrl}/transactions/${transactionHash}/token-transfers?type=ERC-1155`;
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'accept': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`API request failed: ${response.status} ${response.statusText}`);
    }

    const data: any = await response.json();

    if (!data.items) {
      throw new Error('No token transfers found in response');
    }

    // Group transfers by contract address and collection name
    const mintsByCollection: { [key: string]: MintResult } = {};

    for (const transfer of data.items) {
      // Ensure it's a minting event (from zero address and type ERC-1155)
      if (
        transfer.from.hash === '0x0000000000000000000000000000000000000000' &&
        transfer.token.type === 'ERC-1155' &&
        transfer.type === 'token_minting'
      ) {
        const key = transfer.token.address;
        if (!mintsByCollection[key]) {
          mintsByCollection[key] = {
            address: transfer.token.address,
            values: [],
          };
        }

        const tokenId = parseInt(transfer.total.token_id, 10);
        const value = parseInt(transfer.total.value, 10);
        const existingEntry = mintsByCollection[key].values.find(([id]) => id === tokenId);

        if (existingEntry) {
          // Update the value if token_id already exists
          existingEntry[1] += value;
        } else {
          // Add new entry if token_id is unique
          mintsByCollection[key].values.push([tokenId, value]);
        }
      }
    }

    // Convert grouped object to array
    const result = Object.values(mintsByCollection);

    // Sort values by token_id for consistency
    result.forEach((mint) => {
      mint.values.sort((a, b) => a[0] - b[0]);
    });

    return result;
  } catch (error) {
    throw new Error(`Error fetching ERC-1155 mints: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}
