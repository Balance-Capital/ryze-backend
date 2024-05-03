import { Logger } from '@nestjs/common';
import {
  DAY,
  HOUR,
  MAX_RANDOM_PERIOD,
  MIN_RANDOM_PERIOD,
  MINUTE,
  SECOND,
  SUPPORTED_NETWORKS,
} from '../constants/base.constant';
import { MarketSymbol, Network } from '../enums/base.enum';

export const getCurrentMinute = (): number => {
  return getMinuteFromTime(Date.now());
};

export const getMinuteFromTime = (time: number): number => {
  return time % MINUTE !== 0 ? time - (time % MINUTE) : time;
};

export const generateRetryRandomPeriod = (isAfterOneSecond = false): number => {
  return (
    Math.floor(Math.random() * (MAX_RANDOM_PERIOD - MIN_RANDOM_PERIOD + 1)) +
    MIN_RANDOM_PERIOD +
    (isAfterOneSecond ? SECOND : 0)
  );
};

export const isUndefinedValue = (value: any): boolean => {
  return (
    value === undefined ||
    isNaN(value) ||
    value === null ||
    value === '' ||
    value === 'null'
  );
};

export const sleepUntilNextMinute = async () => {
  await sleep(
    getCurrentMinute() + MINUTE - Date.now() + generateRetryRandomPeriod(),
  );
};

export const awaitTimeout = (delay: number, defaultRes: any, reason = '') =>
  new Promise((resolve, reject) =>
    setTimeout(
      () => (reason === undefined ? resolve(defaultRes) : reject(reason)),
      delay,
    ),
  );

export const wrapPromise = (
  promise: any,
  delay: number,
  defaultRes: any,
  reason = '',
) => Promise.race([promise, awaitTimeout(delay, defaultRes, reason)]);

export const sleep = (ms: number): Promise<void> => {
  if (ms < 0) return;
  return new Promise((resolve) => setTimeout(resolve, ms));
};

export const expectedErrorMessage = (
  provider: string,
  currentMinute: number,
  symbol: string,
): string => {
  return `${provider} Api failed to get ohlc data. time = ${currentMinute} symbol = ${symbol}`;
};

export const formatDateForDB = (currentDate: Date) => {
  if (!currentDate) currentDate = new Date();
  // Extract date components
  const year = currentDate.getFullYear();
  const month = String(currentDate.getMonth() + 1).padStart(2, '0'); // Months are 0-based, so add 1
  const day = String(currentDate.getDate()).padStart(2, '0');

  // Extract time components
  const hours = String(currentDate.getHours()).padStart(2, '0');
  const minutes = String(currentDate.getMinutes()).padStart(2, '0');
  const seconds = String(currentDate.getSeconds()).padStart(2, '0');
  const milliseconds = String(currentDate.getMilliseconds()).padStart(6, '0');

  // Create the formatted string
  const formattedDate = `${year}-${month}-${day} ${hours}:${minutes}:${seconds}.${milliseconds}`;
  return formattedDate;
};

export const getContinuousDateSubarrays = (timestamps: string[]) => {
  const DAY = 5 * MINUTE; // TODO this should be removed on prod. this is just testing purpose.

  if (!timestamps) timestamps = [];
  // Initialize an array to store subarrays of continuous dates
  const continuousDateSubarrays = [];

  // Iterate through the timestamps and group them
  let currentSubarray = [timestamps[0]];
  for (let i = 1; i < timestamps.length; i++) {
    const currentTimestamp = new Date(timestamps[i]).getTime();
    const previousTimestamp = new Date(timestamps[i - 1]).getTime();

    // Check if the current timestamp is continuous with the previous one
    const timeDifference = currentTimestamp - previousTimestamp;
    if (timeDifference <= DAY) {
      // Assuming a 24-hour threshold for continuity
      currentSubarray.push(timestamps[i]);
    } else {
      continuousDateSubarrays.push(currentSubarray);
      currentSubarray = [timestamps[i]];
    }
  }

  // Push the last subarray
  continuousDateSubarrays.push(currentSubarray);

  return continuousDateSubarrays;
};

export const getContinuousBitsSubarray = (binaryBitsArray: number[]) => {
  // Initialize an array to store subarrays of continuous sequences
  const continuousSequences = [];

  let currentSequence = [binaryBitsArray[0]];

  // Iterate through the binary bits array
  for (let i = 1; i < binaryBitsArray.length; i++) {
    // Check if the current bit is the same as the previous one
    if (binaryBitsArray[i] === binaryBitsArray[i - 1]) {
      currentSequence.push(binaryBitsArray[i]);
    } else {
      continuousSequences.push(currentSequence);
      currentSequence = [binaryBitsArray[i]];
    }
  }

  // Push the last subarray
  continuousSequences.push(currentSequence);

  return continuousSequences;
};

const logger = new Logger('config');
export const loadEnvVariable = (
  name: string,
  useDefaultValue = false,
  defaultValue = '',
) => {
  if (!process.env[name] && !useDefaultValue) {
    logger.error(`Environment variable for ${name} is not set!`);
    process.exit();
  }
  return process.env[name] || defaultValue;
};

export const parseArrayFromEnv = (value: string) => {
  return value
    .split(',')
    .map((item) => item.replace(/ /g, ''))
    .filter((item) => item);
};

export const loadMarketsFromEnv = (network: Network, symbol: MarketSymbol) => {
  if (SUPPORTED_NETWORKS.includes(network)) {
    return parseArrayFromEnv(loadEnvVariable(`MARKET_${symbol}_${network}`));
  } else {
    return [];
  }
};
