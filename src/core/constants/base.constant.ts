import * as dotenv from 'dotenv';
import { Network } from '../enums/base.enum';

dotenv.config();

export const SECOND = 1000;
export const MINUTE = 60 * SECOND;
export const HOUR = 60 * MINUTE;
export const DAY = 24 * HOUR;
export const WEEK = 7 * DAY;
export const MONTH = 30 * DAY;
export const MIN_RANDOM_PERIOD = 150;
export const MAX_RANDOM_PERIOD = 300;
export const TIMEOUT_PERIOD = 20 * SECOND;
export const DEFAULT_TAKE_COUNT = 5;
export const RETRY_COUNT = 3;
export const RETRY_SECOND = 30;
export const SLEEP_TIME_FOR_FETCHING_EXCHANGES = 500;
export const IS_DEV = process.env.NODE_ENV !== 'production';
export const COINBASE_MULTIPLIER = 100;
export const TIMEFRAME_TIMEOUT_PERIOD = 5 * SECOND;

export const WEB3_SIGN_MESSAGE = 'Welcome to Ryze!';
export const IS_MAINNET = process.env.IS_MAINNET === 'true';

export const SUPPORTED_NETWORKS = IS_MAINNET
  ? [
      Network.ArbitrumMainnet,
      // Network.BlastTestnet,
      Network.BlastMainnet,
      // Network.InEVMTestnet,
      Network.InEVMMainnet,
    ]
  : [
      Network.ArbitrumGoerli,
      Network.ArbitrumSepolia,
      Network.BerachainTestnet,
      Network.BlastTestnet,
      Network.InEVMTestnet,
      Network.InEVMMainnet,
    ];
