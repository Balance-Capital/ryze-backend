import * as dotenv from 'dotenv';

import { DataProvider, MarketSymbol, Network } from '../enums/base.enum';
import {
  loadEnvVariable,
  loadMarketsFromEnv,
  parseArrayFromEnv,
} from '../utils/base.util';
import { IS_MAINNET, SUPPORTED_NETWORKS } from './base.constant';

dotenv.config();

export const DOC_USER_NAME = loadEnvVariable('DOC_USER_NAME');
export const DOC_USER_PASSWORD = loadEnvVariable('DOC_USER_PASSWORD');
export const SECOND_SIGN_PASSWORD = 'DU<9f;fPT(}Y#Q*RZ65x';
export const ETH_MAINNET_RPC_URLS = loadEnvVariable('ETH_MAINNET_RPC_URLS');
export const ARBITRUM_MAINNET_RPC_URLS = loadEnvVariable(
  'ARBITRUM_MAINNET_RPC_URLS',
);
export const ARBITRUM_GOERLI_RPC_URLS = SUPPORTED_NETWORKS.includes(
  Network.ArbitrumGoerli,
)
  ? loadEnvVariable('ARBITRUM_GOERLI_RPC_URLS')
  : '';
export const ARBITRUM_SEPOLIA_RPC_URLS = SUPPORTED_NETWORKS.includes(
  Network.ArbitrumSepolia,
)
  ? loadEnvVariable('ARBITRUM_SEPOLIA_RPC_URLS')
  : '';
export const BERACHAIN_TEESTNET_RPC_URLS = SUPPORTED_NETWORKS.includes(
  Network.BerachainTestnet,
)
  ? loadEnvVariable('BERACHAIN_TEESTNET_RPC_URLS')
  : '';
export const BLAST_TEESTNET_RPC_URLS = SUPPORTED_NETWORKS.includes(
  Network.BlastTestnet,
)
  ? loadEnvVariable('BLAST_TEESTNET_RPC_URLS')
  : '';
export const BLAST_MAINNET_RPC_URLS = SUPPORTED_NETWORKS.includes(
  Network.BlastMainnet,
)
  ? loadEnvVariable('BLAST_MAINNET_RPC_URLS')
  : '';
export const INEVM_TEESTNET_RPC_URLS = SUPPORTED_NETWORKS.includes(
  Network.InEVMTestnet,
)
  ? loadEnvVariable('INEVM_TEESTNET_RPC_URLS')
  : '';
export const INEVM_MAINNET_RPC_URLS = SUPPORTED_NETWORKS.includes(
  Network.InEVMMainnet,
)
  ? loadEnvVariable('INEVM_MAINNET_RPC_URLS')
  : '';
export const NEW_RELIC_APP_NAME = loadEnvVariable('NEW_RELIC_APP_NAME');
export const NEW_RELIC_LICENSE_KEY = loadEnvVariable('NEW_RELIC_LICENSE_KEY');
export const SOCKET_PUSH_INTERVAL_MS = 500;
export const DEFAULT_RPS = 5;
// max difference between open and close price in same candle, or difference between on chain and cex price should not be higher then 3%
export const MAX_PRICE_DIFFERENCE_RATE = 3;
export const WHITE_LIST_DOMAIN = [
  'http://localhost:3000',
  'http://localhost:4200',
  'https://app.ryze.fi',
  'https://test.ryze.fi',
  'https://test-strat.ryze.fi',
  'https://test-ub.ryze.fi',
  'https://test-prod.ryze.fi',
  'https://test-okx.ryze.fi',
  // *.vercel.app needs to be handled separately for
  // 1st expressjs/nestjs rest api cors - https://github.com/expressjs/cors#configuration-options
  // 2nd websocket cors impl
  /\.vercel\.app$/,
];

export const USE_TUSD = loadEnvVariable('USE_TUSD', true, 'true') === 'true';

export const NETWORKS = {
  [Network.EthereumMainnet]: {
    name: 'Ethereum Mainnet',
    chainId: 1,
    rpcList: parseArrayFromEnv(ETH_MAINNET_RPC_URLS),
    markets: [],
  },
  [Network.ArbitrumMainnet]: {
    name: 'Arbitrum Mainnet',
    chainId: 42161,
    rpcList: parseArrayFromEnv(ARBITRUM_MAINNET_RPC_URLS),
    markets: [MarketSymbol.BTCUSD, MarketSymbol.ETHUSD, MarketSymbol.SOLUSD],
  },
  [Network.ArbitrumGoerli]: {
    name: 'Arbitrum Goerli',
    chainId: 421613,
    rpcList: parseArrayFromEnv(ARBITRUM_GOERLI_RPC_URLS),
    markets: [
      MarketSymbol.BTCUSD,
      MarketSymbol.ETHUSD,
      MarketSymbol.BNBUSD,
      MarketSymbol.XRPUSD,
      MarketSymbol.MATICUSD,
      MarketSymbol.DOGEUSD,
      MarketSymbol.SOLUSD,
      MarketSymbol.LINKUSD,
    ],
  },
  [Network.ArbitrumSepolia]: {
    name: 'Arbitrum Sepolia',
    chainId: 421614,
    rpcList: parseArrayFromEnv(ARBITRUM_SEPOLIA_RPC_URLS),
    markets: [MarketSymbol.BTCUSD, MarketSymbol.ETHUSD],
  },
  [Network.BerachainTestnet]: {
    name: 'Berachain testnet',
    chainId: 80085,
    rpcList: parseArrayFromEnv(BERACHAIN_TEESTNET_RPC_URLS),
    markets: [MarketSymbol.BTCUSD, MarketSymbol.ETHUSD, MarketSymbol.SOLUSD],
  },
  [Network.BlastTestnet]: {
    name: 'Blast testnet',
    chainId: 168587773,
    rpcList: parseArrayFromEnv(BLAST_TEESTNET_RPC_URLS),
    markets: [MarketSymbol.BTCUSD, MarketSymbol.ETHUSD, MarketSymbol.SOLUSD],
  },
  [Network.BlastMainnet]: {
    name: 'Blast mainnet',
    chainId: 81457,
    rpcList: parseArrayFromEnv(BLAST_MAINNET_RPC_URLS),
    markets: [MarketSymbol.BTCUSD, MarketSymbol.ETHUSD, MarketSymbol.SOLUSD],
  },
  [Network.InEVMTestnet]: {
    name: 'InEVM testnet',
    chainId: 2424,
    rpcList: parseArrayFromEnv(INEVM_TEESTNET_RPC_URLS),
    markets: [MarketSymbol.BTCUSD, MarketSymbol.ETHUSD, MarketSymbol.SOLUSD],
  },
  [Network.InEVMMainnet]: {
    name: 'InEVM mainnet',
    chainId: 2525,
    rpcList: parseArrayFromEnv(INEVM_MAINNET_RPC_URLS),
    markets: [MarketSymbol.BTCUSD, MarketSymbol.ETHUSD, MarketSymbol.SOLUSD],
  },
};

export const MAIN_NETWORK = IS_MAINNET
  ? Network.ArbitrumMainnet
  : Network.ArbitrumGoerli;

export const DATA_PROVIDERS = {
  [DataProvider.Binance]: {
    ws: 'wss://stream.binance.com:443',
    api: 'https://api.binance.com/api/v3',
    markets: [
      {
        symbol: MarketSymbol.BTCUSD,
        tick: USE_TUSD ? 'BTCTUSD' : 'BTCUSDT',
      },
      {
        symbol: MarketSymbol.ETHUSD,
        tick: 'ETHUSDT',
      },
      {
        symbol: MarketSymbol.BNBUSD,
        tick: 'BNBUSDT',
      },
      {
        symbol: MarketSymbol.XRPUSD,
        tick: 'XRPUSDT',
      },
      {
        symbol: MarketSymbol.MATICUSD,
        tick: 'MATICUSDT',
      },
      {
        symbol: MarketSymbol.DOGEUSD,
        tick: 'DOGEUSDT',
      },
      {
        symbol: MarketSymbol.SOLUSD, // 363,024,112
        tick: 'SOLUSDT',
      },
      {
        symbol: MarketSymbol.LINKUSD, // 216,907,593
        tick: 'LINKUSDT',
      },
    ],
  },
  [DataProvider.Kraken]: {
    ws: 'wss://ws.kraken.com',
    api: 'https://api.kraken.com/0/public',
    markets: [
      {
        symbol: MarketSymbol.BTCUSD,
        tick: 'BTC/USD',
      },
      {
        symbol: MarketSymbol.ETHUSD,
        tick: 'ETH/USD',
      },
      {
        symbol: MarketSymbol.XRPUSD,
        tick: 'XRP/USD',
      },
      {
        symbol: MarketSymbol.MATICUSD,
        tick: 'MATIC/USD',
      },
      {
        symbol: MarketSymbol.DOGEUSD,
        tick: 'DOGE/USD',
      },
      {
        symbol: MarketSymbol.SOLUSD, // 66,384,804
        tick: 'SOL/USD',
      },
      // {
      //   symbol: MarketSymbol.LINKUSD, // 20,196,985
      //   tick: 'LINK/USD',
      // },
    ],
  },
  [DataProvider.ByBit]: {
    ws: 'wss://stream.bybit.com/v5/public/spot',
    api: 'https://api.bybit.com/',
    markets: [
      {
        symbol: MarketSymbol.BNBUSD,
        tick: 'BNBUSDT',
      },
      // {
      //   symbol: MarketSymbol.SOLUSD, // 54,132,607
      //   tick: 'SOLUSDT',
      // },
      {
        symbol: MarketSymbol.LINKUSD, // 26,283,563
        tick: 'LINKUSDT',
      },
    ],
  },
  [DataProvider.OKX]: {
    ws: 'wss://ws.okx.com:8443/ws/v5/public',
    api: 'https://www.okx.com/api/v5',
    markets: [
      {
        symbol: MarketSymbol.BTCUSD,
        tick: 'BTC-USDT',
      },
      {
        symbol: MarketSymbol.ETHUSD,
        tick: 'ETH-USDT',
      },
      {
        symbol: MarketSymbol.BNBUSD,
        tick: 'BNB-USDT',
      },
      {
        symbol: MarketSymbol.XRPUSD,
        tick: 'XRP-USDT',
      },
      {
        symbol: MarketSymbol.MATICUSD,
        tick: 'MATIC-USDT',
      },
      {
        symbol: MarketSymbol.DOGEUSD,
        tick: 'DOGE-USDT',
      },
      {
        symbol: MarketSymbol.SOLUSD, // 78,283,489
        tick: 'SOL-USDT',
      },
      {
        symbol: MarketSymbol.LINKUSD, // 50,064,244
        tick: 'LINK-USDT',
      },
    ],
  },
};

export const CHAINLINK_PROVIDER = [
  {
    id: 'USDTUSD',
    address: '0x3E7d1eAB13ad0104d2750B8863b489D65364e32D',
  },
  {
    id: 'BTCUSD',
    address: '0xF4030086522a5bEEa4988F8cA5B36dbC97BeE88c',
  },
  {
    id: 'ETHUSD',
    address: '0x5f4eC3Df9cbd43714FE2740f5E3616155c5b8419',
  },
  {
    id: 'TUSDUSD',
    address: '0xec746eCF986E2927Abd291a2A1716c940100f8Ba',
  },
  {
    id: 'BNBUSD',
    address: '0x14e613AC84a31f709eadbdF89C6CC390fDc9540A',
  },
  {
    id: 'MATICUSD',
    address: '0x7bAC85A8a13A4BcD8abb3eB7d6b4d632c5a57676',
  },
  {
    id: 'XRPUSD',
    chain: Network.ArbitrumMainnet,
    address: '0xB4AD57B52aB9141de9926a3e0C8dc6264c2ef205',
  },
  {
    id: 'SOLUSD',
    address: '0x4ffC43a60e009B551865A93d232E33Fce9f01507',
  },
];

export const COIN_IDS = [
  'bitcoin',
  'ethereum',
  'binancecoin',
  'ripple',
  'matic-network',
  'dogecoin',
  'solana',
];

export const MARKET_CONFIGURATION = {
  [MarketSymbol.BTCUSD]: {
    decimals: 2,
    binaryMarketContracts: {
      [Network.ArbitrumMainnet]: loadMarketsFromEnv(
        Network.ArbitrumMainnet,
        MarketSymbol.BTCUSD,
      ),
      [Network.ArbitrumGoerli]: loadMarketsFromEnv(
        Network.ArbitrumGoerli,
        MarketSymbol.BTCUSD,
      ),
      [Network.ArbitrumSepolia]: loadMarketsFromEnv(
        Network.ArbitrumSepolia,
        MarketSymbol.BTCUSD,
      ),
      [Network.BerachainTestnet]: loadMarketsFromEnv(
        Network.BerachainTestnet,
        MarketSymbol.BTCUSD,
      ),
      [Network.BlastTestnet]: loadMarketsFromEnv(
        Network.BlastTestnet,
        MarketSymbol.BTCUSD,
      ),
      [Network.BlastMainnet]: loadMarketsFromEnv(
        Network.BlastMainnet,
        MarketSymbol.BTCUSD,
      ),
      [Network.InEVMTestnet]: loadMarketsFromEnv(
        Network.InEVMTestnet,
        MarketSymbol.BTCUSD,
      ),
      [Network.InEVMMainnet]: loadMarketsFromEnv(
        Network.InEVMMainnet,
        MarketSymbol.BTCUSD,
      ),
    },
  },
  [MarketSymbol.ETHUSD]: {
    decimals: 2,
    binaryMarketContracts: {
      [Network.ArbitrumMainnet]: loadMarketsFromEnv(
        Network.ArbitrumMainnet,
        MarketSymbol.ETHUSD,
      ),
      [Network.ArbitrumGoerli]: loadMarketsFromEnv(
        Network.ArbitrumGoerli,
        MarketSymbol.ETHUSD,
      ),
      [Network.ArbitrumSepolia]: loadMarketsFromEnv(
        Network.ArbitrumSepolia,
        MarketSymbol.ETHUSD,
      ),
      [Network.BerachainTestnet]: loadMarketsFromEnv(
        Network.BerachainTestnet,
        MarketSymbol.ETHUSD,
      ),
      [Network.BlastTestnet]: loadMarketsFromEnv(
        Network.BlastTestnet,
        MarketSymbol.ETHUSD,
      ),
      [Network.BlastMainnet]: loadMarketsFromEnv(
        Network.BlastMainnet,
        MarketSymbol.ETHUSD,
      ),
      [Network.InEVMTestnet]: loadMarketsFromEnv(
        Network.InEVMTestnet,
        MarketSymbol.ETHUSD,
      ),
      [Network.InEVMMainnet]: loadMarketsFromEnv(
        Network.InEVMMainnet,
        MarketSymbol.ETHUSD,
      ),
    },
  },
  [MarketSymbol.BNBUSD]: {
    decimals: 2,
    binaryMarketContracts: {
      [Network.ArbitrumGoerli]: loadMarketsFromEnv(
        Network.ArbitrumGoerli,
        MarketSymbol.BNBUSD,
      ),
    },
  },
  [MarketSymbol.XRPUSD]: {
    decimals: 5,
    binaryMarketContracts: {
      [Network.ArbitrumGoerli]: loadMarketsFromEnv(
        Network.ArbitrumGoerli,
        MarketSymbol.XRPUSD,
      ),
    },
  },
  [MarketSymbol.MATICUSD]: {
    decimals: 5,
    binaryMarketContracts: {
      [Network.ArbitrumGoerli]: loadMarketsFromEnv(
        Network.ArbitrumGoerli,
        MarketSymbol.MATICUSD,
      ),
    },
  },
  [MarketSymbol.DOGEUSD]: {
    decimals: 6,
    binaryMarketContracts: {
      [Network.ArbitrumGoerli]: loadMarketsFromEnv(
        Network.ArbitrumGoerli,
        MarketSymbol.DOGEUSD,
      ),
    },
  },
  [MarketSymbol.SOLUSD]: {
    decimals: 2,
    binaryMarketContracts: {
      [Network.ArbitrumMainnet]: loadMarketsFromEnv(
        Network.ArbitrumMainnet,
        MarketSymbol.SOLUSD,
      ),
      [Network.ArbitrumGoerli]: loadMarketsFromEnv(
        Network.ArbitrumGoerli,
        MarketSymbol.SOLUSD,
      ),
      [Network.BerachainTestnet]: loadMarketsFromEnv(
        Network.BerachainTestnet,
        MarketSymbol.SOLUSD,
      ),
      [Network.BlastTestnet]: loadMarketsFromEnv(
        Network.BlastTestnet,
        MarketSymbol.SOLUSD,
      ),
      [Network.BlastMainnet]: loadMarketsFromEnv(
        Network.BlastMainnet,
        MarketSymbol.SOLUSD,
      ),
      [Network.InEVMTestnet]: loadMarketsFromEnv(
        Network.InEVMTestnet,
        MarketSymbol.SOLUSD,
      ),
      [Network.InEVMMainnet]: loadMarketsFromEnv(
        Network.InEVMMainnet,
        MarketSymbol.SOLUSD,
      ),
    },
  },
  [MarketSymbol.LINKUSD]: {
    decimals: 3,
    binaryMarketContracts: {
      [Network.ArbitrumGoerli]: loadMarketsFromEnv(
        Network.ArbitrumGoerli,
        MarketSymbol.LINKUSD,
      ),
    },
  },
};

export const RECORD_COUNT_FOR_AGGREGATE = 60;
export const INTERVAL_ONCHAIN_PRICES = 10 * 1000; // 10s
export const ENABLE_WHITELIST =
  loadEnvVariable('ENABLE_WHITELIST', true, 'true') === 'true';

export const SUBGRAPH_URL = loadEnvVariable('SUBGRAPH_URL');
export const CONFIG_ADDRESS = loadEnvVariable('CONFIG_ADDRESS');

export const PK_REFERRAL = loadEnvVariable('PK_REFERRAL');
export const PK_CREDITS_SIGNER = loadEnvVariable('PK_CREDITS_SIGNER');
export const CREDIT_MINTER_ADDRESS = loadEnvVariable('CREDIT_MINTER_ADDRESS');

export const QUALIFIED_REFEREE_AMOUNT_WEEK = 100;
export const QUALIFIED_REFEREE_AMOUNT_MONTH = 500;
export const DECIMALS = 6;

export const FREE_CREDITS_SUPPORTED_TIMEFRAMES = [
  0, // 1m
  3, // 3m
];

export const OAT_CONTRACT_ADDRESS =
  '0x5D666F215a85B87Cb042D59662A7ecd2C8Cc44e6';
export const BALANCEPASS_CONTRACT_ADDRESS =
  '0x3707CFddaE348F05bAEFD42406ffBa4B74Ec8D91';
export const OAT_TRAIT = [
  {
    trait_type: 'Rank',
    trait_value: 'Ryzen',
  },
  {
    trait_type: 'Category',
    trait_value: 'Ryze',
  },
  {
    trait_type: 'Og',
    trait_value: 'Og',
  },
];
export const OAT_CID = [
  112569, // OG: OG
  136726, // Category: Ryze
  149423, // Rank: Ryzen
];

export const POINT_PASSWORD_KEY = loadEnvVariable('POINT_PASSWORD_KEY');
