import { ChainConfig } from '../../config';
import EthereumProvider from "@walletconnect/ethereum-provider";
import type { Provider6963Props } from '../eip6963';

export async function getWalletConnectProvider(): Promise<Provider6963Props> {
    const wcProvider = await EthereumProvider.init({
        projectId: "790fa151a94cc5d3dfc5d87be9c3df2c", // from cloud.walletconnect.com
        chains: [parseInt(ChainConfig.chainId, 16)], // must be a number
        showQrModal: true
    });

    await wcProvider.connect();

    const accounts = await wcProvider.request({
        method: "eth_requestAccounts"
    }) as string[];

    return {
        accounts,
        info: {
            uuid: "walletconnect",
            name: "WalletConnect",
            icon: "https://avatars.githubusercontent.com/u/37784886?s=200&v=4"
        },
        provider: wcProvider as any // keep raw EIP-1193 provider here
    };
}
