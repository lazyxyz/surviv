import { ChainConfig } from '../../config';
import EthereumProvider, {type EthereumProviderOptions} from "@walletconnect/ethereum-provider";
import type { Provider6963Props } from '../eip6963';
import {SESSION_WALLETCONNECT, WalletType} from '../utils/constants';

export const getWalletConnectInfo = {
  uuid: WalletType.WalletConnect,
  name: WalletType.WalletConnect,
  icon: "https://avatars.githubusercontent.com/u/37784886?s=200&v=4",
};

export async function getWalletConnectInit(options?: Partial<EthereumProviderOptions>) {
    const init = await EthereumProvider.init({
        projectId: "790fa151a94cc5d3dfc5d87be9c3df2c", // from cloud.walletconnect.com
        chains: [parseInt(ChainConfig.chainId, 16)], // must be a number
        showQrModal: true,
        ...(options as any),
    });

    return init;
}

export async function getWalletConnectProvider(): Promise<Provider6963Props> {
    const wcProvider = await getWalletConnectInit();

    await wcProvider.connect();

    localStorage.setItem(SESSION_WALLETCONNECT, JSON.stringify(wcProvider.session))

    return {
        accounts: [],
        info: getWalletConnectInfo,
        provider: wcProvider as unknown as Provider6963Props['provider'] // keep raw EIP-1193 provider here
    };
}
