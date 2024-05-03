// @formatter:off
import { Logger } from '@nestjs/common';
import { BigNumber, ethers } from 'ethers';
import * as CryptoJS from 'crypto-js';
import { retryAsync } from 'ts-retry';
import { parentPort } from 'worker_threads';

import { Ohlc } from '../../ohlc/entities/ohlc.entity';
import { BinanceService } from '../binance/binance.service';
import { KrakenService } from '../kraken/kraken.service';
import { ByBitService } from '../bybit/bybit.service';
import { OhlcService } from '../../ohlc/ohlc.service';
import { OhlcDto } from '../../ohlc/dto/ohlc.dto';
import {
  DataProvider,
  MarketSymbol,
  Network,
} from '../../core/enums/base.enum';
import {
  makeOhlcSignatureMessage,
  makeProviderSymbolArray,
} from '../../core/utils/ohlc.util';
import {
  MARKET_CONFIGURATION,
  MAX_PRICE_DIFFERENCE_RATE,
  RECORD_COUNT_FOR_AGGREGATE,
  SECOND_SIGN_PASSWORD,
  DATA_PROVIDERS,
  NETWORKS,
} from '../../core/constants/config.constant';
import {
  MINUTE,
  RETRY_COUNT,
  SECOND,
  SUPPORTED_NETWORKS,
  TIMEFRAME_TIMEOUT_PERIOD,
  TIMEOUT_PERIOD,
} from '../../core/constants/base.constant';
import {
  generateRetryRandomPeriod,
  getCurrentMinute,
  getMinuteFromTime,
  loadEnvVariable,
  parseArrayFromEnv,
  sleep,
  sleepUntilNextMinute,
  wrapPromise,
} from '../../core/utils/base.util';
import { BinaryMarketABI } from '../../core/abi';
import { Multicall } from 'ethereum-multicall';
import { OKXService } from '../okx/okx.service';

export class OhlcWorkerService {
  providers: {
    [network: number]: ethers.providers.JsonRpcProvider[];
  } = {};
  multicallProvider: {
    [network: number]: Multicall;
  } = {};
  dataProviderStatuses = [];
  missingDataProviderStatuses = [];
  defaultOpenPrices = {};
  ohlcResult = {
    [DataProvider.Binance]: {},
    [DataProvider.Kraken]: {},
    [DataProvider.OKX]: {},
    [DataProvider.ByBit]: {},
  };
  missingOhlcResult = {
    [DataProvider.Binance]: {},
    [DataProvider.Kraken]: {},
    [DataProvider.OKX]: {},
    [DataProvider.ByBit]: {},
  };
  private readonly logger = new Logger(OhlcWorkerService.name);

  constructor(
    private readonly binanceService: BinanceService,
    private readonly krakenService: KrakenService,
    private readonly okxService: OKXService,
    private readonly bybitService: ByBitService,
    private readonly ohlcService: OhlcService,
  ) {
    this.getMulticallProvider();
    this.getRPCProviders();
  }

  private getMulticallProvider = () => {
    for (let i = 0; i < SUPPORTED_NETWORKS.length; i++) {
      const network = NETWORKS[SUPPORTED_NETWORKS[i]];
      this.multicallProvider[SUPPORTED_NETWORKS[i]] = new Multicall({
        ethersProvider: ethers.getDefaultProvider(network.rpcList[0]),
        tryAggregate: true,
      });
    }
  };

  private getRPCProviders() {
    for (let i = 0; i < SUPPORTED_NETWORKS.length; i++) {
      const network = NETWORKS[SUPPORTED_NETWORKS[i]];
      this.providers[SUPPORTED_NETWORKS[i]] = [];

      for (let j = 0; j < network.rpcList.length; j++) {
        const provider = new ethers.providers.JsonRpcProvider(
          network.rpcList[j],
        );
        this.providers[SUPPORTED_NETWORKS[i]].push(provider);
      }
    }
  }

  async saveExchangeOhlcRecord(
    symbol: string,
    isForMissing = false,
  ): Promise<OhlcDto & { totalVolumeInCandle: number }> {
    let open = 0;
    let high = 0;
    let low = 0;
    let close = 0;
    let last60TotalVolume = 0;
    let totalVolumeInCandle = 0;

    await Promise.all(
      Object.values(
        isForMissing ? this.missingOhlcResult : this.ohlcResult,
      ).map(async (value) => {
        if (Object.keys(value).length > 0 && value[symbol]) {
          try {
            // We get volume of last 60mins of candles.
            const provider = value[symbol].source.toUpperCase();

            const latestRecords = await this.ohlcService.find({
              order: { time: 'DESC' },
              skip: 1,
              take: RECORD_COUNT_FOR_AGGREGATE,
              where: {
                symbol: symbol,
                source: provider,
              },
            });

            const last60volume = latestRecords.reduce(
              (accr, cur) => accr + cur.volume,
              0,
            );

            open += last60volume * value[symbol].open;
            high += last60volume * value[symbol].high;
            low += last60volume * value[symbol].low;
            close += last60volume * value[symbol].close;
            totalVolumeInCandle += value[symbol].volume;
            last60TotalVolume += last60volume;

            value[symbol].signature = CryptoJS.AES.encrypt(
              makeOhlcSignatureMessage(value[symbol]),
              `${loadEnvVariable(
                'FIRST_SIGN_PASSWORD',
              )}_${SECOND_SIGN_PASSWORD}`,
            ).toString();
            const result = await this.ohlcService.save(value[symbol]);
            this.logger.log(
              `Saved ${symbol} ${result.time} ${result.source
              } OHLC record, ${JSON.stringify(result)}`,
            );
          } catch (e) {
            this.logger.warn(
              `Save ${symbol} ${value[symbol]?.time} ${value[symbol]?.source} OHLC record failed, ${e.stack}`,
            );
          }
        }
      }),
    );
    return {
      open,
      high,
      low,
      close,
      volume: last60TotalVolume,
      totalVolumeInCandle,
    };
  }

  async saveDefaultOhlcRecord(
    symbol: string,
    time: number,
    open: number,
    high: number,
    low: number,
    close: number,
    totalVolumeIn60Candles: number,
    totalVolumeInCandle: number,
    isMissingOhlc = false,
    lastIndex = false,
  ): Promise<Ohlc> {
    try {
      this.logger.debug(
        `Data from caller - ${symbol}, ${time} - ${open}, ${high}, ${low}, ${close}, ${totalVolumeIn60Candles}, ${totalVolumeInCandle}, ${isMissingOhlc}, ${lastIndex}`,
      );
      const prevOhlc = await this.ohlcService.getDefaultOhlc(
        symbol,
        Number(time) - MINUTE,
      );
      const nextOhlc = await this.ohlcService.getDefaultOhlc(
        symbol,
        Number(time) + MINUTE,
      );
      let ohlc;
      if (prevOhlc) {
        ohlc = {
          symbol,
          time,
          source: DataProvider.Default,
          open: prevOhlc?.close,
          high:
            totalVolumeIn60Candles !== 0
              ? Number(high / totalVolumeIn60Candles)
              : prevOhlc?.high,
          low:
            totalVolumeIn60Candles !== 0
              ? Number(low / totalVolumeIn60Candles)
              : prevOhlc?.low,
          close:
            totalVolumeIn60Candles !== 0
              ? Number(close / totalVolumeIn60Candles)
              : prevOhlc?.close,
          volume:
            totalVolumeInCandle !== 0 ? totalVolumeInCandle : prevOhlc?.volume,
          dataProviderStatuses:
            totalVolumeInCandle !== 0
              ? isMissingOhlc
                ? this.missingDataProviderStatuses
                : this.dataProviderStatuses
              : prevOhlc?.dataProviderStatuses,
          signature: null,
          isCloned: false,
        };
        ohlc.high = Math.max(ohlc.high, prevOhlc?.close);
        ohlc.low = Math.min(ohlc.low, prevOhlc?.close);
        this.logger.warn(`Prev ohlc exists - ${time}`);
      } else {
        const divideByVolume =
          totalVolumeIn60Candles === 0
            ? Object.values(this.ohlcResult).filter(
              (value) => Object.keys(value).length > 0 && value[symbol],
            ).length
            : totalVolumeIn60Candles;
        ohlc = {
          symbol,
          time,
          source: DataProvider.Default,
          open: Number(open / divideByVolume),
          high: Number(high / divideByVolume),
          low: Number(low / divideByVolume),
          close: Number(close / divideByVolume),
          volume:
            totalVolumeInCandle !== 0 ? totalVolumeInCandle : prevOhlc?.volume,
          dataProviderStatuses:
            totalVolumeInCandle !== 0
              ? isMissingOhlc
                ? this.missingDataProviderStatuses
                : this.dataProviderStatuses
              : prevOhlc?.dataProviderStatuses,
          signature: null,
          isCloned: false,
        };
        this.logger.warn(`Prev ohlc does not exist - ${time}`);
      }
      if ((isMissingOhlc && lastIndex) || !isMissingOhlc) {
        if (nextOhlc) {
          ohlc.close = nextOhlc.open;
          this.logger.warn(`Next ohlc exists. ${time}`);
        }
        this.logger.warn(`isMissingOHLC: ${isMissingOhlc}, ${lastIndex}`);
      }
      if (!ohlc['dataProviderStatuses']) {
        ohlc['dataProviderStatuses'] = isMissingOhlc
          ? this.missingDataProviderStatuses.join(',')
          : this.dataProviderStatuses.join(',');
      }
      ohlc['signature'] = CryptoJS.AES.encrypt(
        makeOhlcSignatureMessage(ohlc),
        `${loadEnvVariable('FIRST_SIGN_PASSWORD')}_${SECOND_SIGN_PASSWORD}`,
      ).toString();
      const result = await this.ohlcService.save(ohlc);
      this.logger.log(
        `${isMissingOhlc ? 'Updated' : 'Saved'} ${symbol} ${result.time
        } DEFAULT ohlc data, ${JSON.stringify(result)}`,
      );
      if (!isMissingOhlc) {
        this.defaultOpenPrices[symbol] = result;
        parentPort.postMessage({
          ...result,
          totalVolumeIn60Candles,
        });
      }
      return result;
    } catch (e) {
      this.logger.warn(
        `${isMissingOhlc ? 'Update' : 'Save'
        } default OHLC data of ${symbol}-${time} failed, ${e.stack}`,
      );
      return null;
    }
  }

  async addMissingOhlc(minuteForEndTime) {
    try {
      this.logger.log(`Adding missing ohlc data start`);

      Object.keys(this.missingOhlcResult).forEach((provider: string) => {
        this.missingOhlcResult[provider] = {};
      });

      this.missingDataProviderStatuses = [];
      let timestamps = [];
      for await (const symbol of Object.values(MarketSymbol)) {
        const data = await this.ohlcService.find({
          order: { time: 'ASC' },
          where: {
            symbol,
            source: DataProvider.Default,
            isCloned: true,
          },
        });
        const dataTimestamps = data.map((item) => item.time);
        timestamps = [...timestamps, ...dataTimestamps];
      }
      timestamps = [...new Set(timestamps)];
      timestamps = timestamps.sort((a, b) => a - b);

      for (let i = 0; i < timestamps.length; i++) {
        const time = timestamps[i];
        if (getCurrentMinute() != minuteForEndTime) {
          break;
        }

        const index = timestamps.indexOf(time);
        await this.bindOhlcDataFromExchange(Number(time) + MINUTE, true);
        for await (const symbol of Object.values(MarketSymbol)) {
          try {
            if (this.missingDataProviderStatuses.length < 3) {
              let { open, high, low, close, volume, totalVolumeInCandle } =
                await this.saveExchangeOhlcRecord(symbol, true);
              if (volume === 0) {
                Object.values(this.missingOhlcResult).forEach((value) => {
                  if (Object.keys(value).length > 0 && value[symbol]) {
                    open += value[symbol].open;
                    high += value[symbol].high;
                    low += value[symbol].low;
                    close += value[symbol].close;
                  }
                });
              }
              await this.saveDefaultOhlcRecord(
                symbol,
                time,
                open,
                high,
                low,
                close,
                volume,
                totalVolumeInCandle,
                true,
                index === timestamps.length - 1,
              );
            } else {
              await this.clonePrevDefaultOhlcRecord(symbol, time, true);
            }
          } catch (e) {
            this.logger.warn(
              `Store ${symbol} ${time - MINUTE} missing ohlc data failed, ${e.stack
              }`,
            );
          }
        }
        await sleep(generateRetryRandomPeriod(true));
      }
    } catch (e) {
      this.logger.warn(`Run addMissingOhlc failed, ${e.stack}`);
    } finally {
      this.logger.log(`Adding missing ohlc data end`);
    }
  }

  async clonePrevDefaultOhlcRecord(
    symbol: string,
    time: number,
    isMissingOhlc = false,
  ): Promise<Ohlc> {
    try {
      let prevOhlc = null;
      let targetTime = time;
      let retryCount = 0;
      const ohlc = {
        symbol,
        time,
        source: DataProvider.Default,
        open: prevOhlc?.open,
        high: prevOhlc?.high,
        low: prevOhlc?.low,
        close: prevOhlc?.close,
        volume: prevOhlc?.volume,
        dataProviderStatuses: prevOhlc?.dataProviderStatuses,
        signature: null,
        isCloned: true,
      };
      ohlc['signature'] = CryptoJS.AES.encrypt(
        makeOhlcSignatureMessage(ohlc),
        `${loadEnvVariable('FIRST_SIGN_PASSWORD')}_${SECOND_SIGN_PASSWORD}`,
      ).toString();
      const result = await this.ohlcService.save(ohlc);
      if (!isMissingOhlc) {
        this.defaultOpenPrices[symbol] = result;
        parentPort.postMessage(result);
      }
      this.logger.log(
        `Cloned ${result.symbol} ${result.time
        } DEFAULT ohlc data because of data provider error, ${JSON.stringify(
          result,
        )}`,
      );
      return result;
    } catch (e) {
      this.logger.warn(
        `Clone Prev DEFAULT OHLC data of ${symbol}-${time} failed, ${e.stack}`,
      );
      return null;
    }
  }

  async fetchOhlcDataFromExchange(
    provider: string,
    time: number,
    symbol: string,
  ): Promise<OhlcDto> {
    switch (provider) {
      case DataProvider.Binance:
        return await this.binanceService.getOhlcData(time, symbol);
      case DataProvider.Kraken:
        return await this.krakenService.getOhlcData(time, symbol);
      case DataProvider.OKX:
        return await this.okxService.getOhlcData(time, symbol);
      case DataProvider.ByBit:
        return await this.bybitService.getOhlcData(time, symbol);
    }
  }

  async calculateProfitableAmount(
    network: Network,
    symbol: string,
    index: number,
    timeframes: number[],
    bnPrice: BigNumber,
  ): Promise<number> {
    if (!MARKET_CONFIGURATION[symbol].binaryMarketContracts[network][index]) {
      return 0;
    }

    let callData = [];
    const context = {
      reference: 'BinaryMarket',
      contractAddress:
        MARKET_CONFIGURATION[symbol].binaryMarketContracts[network][index],
      abi: BinaryMarketABI,
      calls: [],
    };

    callData = timeframes.map((item) => ({
      reference: `currentEpoch-${item}`,
      methodName: 'getCurrentRoundId',
      methodParameters: [item],
    }));

    context.calls = callData;

    let res = await this.multicallProvider[network].call(context);
    const currentEpochesData = res.results['BinaryMarket'].callsReturnContext;
    const currentEpoches = currentEpochesData.map((item) =>
      BigNumber.from(item.returnValues[0]),
    );

    callData = timeframes.map((item, index) => ({
      reference: `round-${item}`,
      methodName: 'rounds',
      methodParameters: [item, currentEpoches[index].toNumber() - 1],
    }));

    context.calls = callData;

    res = await this.multicallProvider[network].call(context);
    const roundData = res.results['BinaryMarket'].callsReturnContext;
    const rounds = roundData.map((item) => item.returnValues);

    let profitableAmount = 0;
    // TODO We are using index number to get field values. This should be updated if we update contract data structure.
    rounds.map((round) => {
      const lockPrice = BigNumber.from(round[4]).toNumber();
      const bullAmount = BigNumber.from(round[9]).toNumber();
      const bearAmount = BigNumber.from(round[10]).toNumber();

      if (Number(bnPrice.toString()) > lockPrice) {
        profitableAmount += bearAmount - bullAmount;
      } else {
        profitableAmount += bullAmount - bearAmount;
      }
    });

    return profitableAmount;
  }

  getPK(network: Network, symbol: string, index: number): string {
    const pks = parseArrayFromEnv(loadEnvVariable(`PK_${symbol}_${network}`));
    if (index < pks.length) {
      return pks[index];
    }
    return pks[0];
  }

  async executeRound(
    network: Network,
    symbol: string,
    index: number,
    timeframes: number[],
    bnPrice: BigNumber,
    minuteForStartTime: number,
  ): Promise<boolean> {
    this.logger.log(`${symbol} executeRound price: ${bnPrice.toString()}`);
    let count = 0;

    while (count < this.providers[network].length) {
      if (
        new Date().getSeconds() > 40 ||
        minuteForStartTime != getCurrentMinute()
      ) {
        count == this.providers[network].length;
        break;
      }
      try {
        const signer = new ethers.Wallet(
          this.getPK(network, symbol, index),
          this.providers[network][count],
        );
        const contract = new ethers.Contract(
          MARKET_CONFIGURATION[symbol].binaryMarketContracts[network][index],
          BinaryMarketABI,
          signer,
        );

        const receipt = await wrapPromise(
          retryAsync(
            async () => {
              const gasLimit = await contract.estimateGas.executeCurrentRound(
                timeframes,
                bnPrice,
              );
              this.logger.log(
                `${symbol} executeRound gasLimit: ${gasLimit
                  .mul(4)
                  .toString()}`,
              );

              const tx = await contract.executeCurrentRound(
                timeframes,
                bnPrice,
                {
                  gasLimit: gasLimit.mul(4),
                },
              );
              return await tx.wait();
            },
            {
              delay: generateRetryRandomPeriod(false),
              maxTry: 1,
              until: (lastResult) => lastResult.confirmations > 0,
              onMaxRetryFunc(err) {
                count++;
              },
            },
          ),
          TIMEOUT_PERIOD,
          { confirmations: 0 },
          `${network} ${symbol} executeCurrentRound timeout`,
        );

        if (receipt.confirmations > 0) {
          this.logger.log(`${network} ${symbol} executeRound success`);
          break;
        }
      } catch (e) {
        this.logger.warn(
          `${network} ${symbol} executeRound failed, ${e.stack}, count: ${count}`,
        );
        count++;
      }
    }

    this.dataProviderStatuses = [];

    if (count == this.providers[network].length) {
      this.logger.warn(`${symbol} executeRound finally failed`);
      throw new Error(`${symbol} executeRound finally failed`);
    }

    return true;
  }

  private async getLatestBlock(network: Network) {
    for (let i = 0; i < this.providers[network].length; i++) {
      try {
        const latestBlock = await this.providers[network][i].getBlock("latest");
        return latestBlock;
      } catch (err) {
        this.logger.warn(`${network} failed to get latest block - ${JSON.stringify(err)}`);
      }
    }

    return undefined;
  }

  private async getExecutableTimeframes(
    network: Network,
    symbol: string,
    index: number,
    minuteForStartTime: number,
  ) {

    // This deadline is max delay when current block time is behind of real time. So this is the worst case.
    // In most of cases, system will not be delayed too much.
    const deadline = (network == Network.InEVMTestnet || network == Network.InEVMMainnet)
      ? 20 : 15;


    while (1) {
      const currentSecond = new Date().getSeconds();
      const latestBlock = await this.getLatestBlock(network);
      this.logger.debug(`${network} Latest Block Time: ${latestBlock?.timestamp}`);

      if (latestBlock) {
        const minuteFromLatestBlock = getMinuteFromTime(latestBlock.timestamp * SECOND);
        this.logger.debug(`${network} latest block minute: ${minuteFromLatestBlock}, current minute: ${minuteForStartTime}`);

        if (minuteForStartTime == minuteFromLatestBlock) {
          break;
        }
      }
      
      if (currentSecond > deadline) {
        break;
      }
      // sleep 1s
      await sleep(1000);
    }

    const currentSecond = new Date().getSeconds();

    if (currentSecond < 10) {
      this.logger.log(
        `Query executable timeframes ${network} for ${symbol} from market contract.`,
      );

      for (let i = 0; i < this.providers[network].length; i++) {
        if (
          new Date().getSeconds() > 40 ||
          minuteForStartTime != getCurrentMinute()
        ) {
          return [];
        }
        try {
          const contract = new ethers.Contract(
            MARKET_CONFIGURATION[symbol].binaryMarketContracts[network][
            index
            ],
            BinaryMarketABI,
            this.providers[network][i],
          );

          this.logger.log(
            `Use RPC: ${NETWORKS[network].rpcList[i]} for ${symbol}`,
          );
          const timeframes = await wrapPromise(
            contract.getExecutableTimeframes(),
            TIMEFRAME_TIMEOUT_PERIOD,
            undefined,
            `${network} ${symbol} getExecutableTimeframes timeout`,
          );
          if (timeframes) {
            return timeframes
          }
        } catch (err) {
          this.logger.warn(
            `This rpc endpoint is invalid at the moment - ${NETWORKS[network].rpcList[i]} - ${err?.stack}`,
          );
        }
      }

      return [];
    } else {
      this.logger.log(
        `Query executable timeframes for ${symbol} from market contract. (late query)`,
      );
      for (let i = 0; i < this.providers[network].length; i++) {
        if (
          new Date().getSeconds() > 40 ||
          minuteForStartTime != getCurrentMinute()
        ) {
          return [];
        }
        try {
          const contract = new ethers.Contract(
            MARKET_CONFIGURATION[symbol].binaryMarketContracts[network][index],
            BinaryMarketABI,
            this.providers[network][i],
          );
          this.logger.log(
            `Use RPC: ${NETWORKS[network].rpcList[i]} for ${symbol}`,
          );

          const timeframes = await wrapPromise(
            contract.getExecutableTimeframes(),
            TIMEFRAME_TIMEOUT_PERIOD,
            undefined,
            `${network} ${symbol} getExecutableTimeframes timeout`,
          );
          if (timeframes) {
            return timeframes;
          }
        } catch (err) {
          this.logger.warn(
            `This rpc endpoint is invalid at the moment - ${NETWORKS[network].rpcList[i]} - ${err?.stack}`,
          );
        }
      }

      return [];
    }
  }

  async makeActivity(network: Network, symbol: string): Promise<void> {
    const signer = new ethers.Wallet(
      this.getPK(network, symbol, 0),
      this.providers[network][0],
    );

    const tx = {
      to: signer.address,
      value: ethers.utils.parseEther("0.001")
    };
    const transaction = await signer.sendTransaction(tx);
  }

  async writePriceToContract(
    network: Network,
    symbol: string,
    index: number,
    price: number,
    minuteForStartTime: number,
  ): Promise<void> {
    console.log('writePriceToContract', network, symbol, price);
    try {
      if (!MARKET_CONFIGURATION[symbol].binaryMarketContracts[network][index]) {
        return;
      }

      this.logger.log(
        `We are ready to write ${network} ${symbol} ${price} to market contract. ${new Date().toISOString()}`,
      );

      let timeframes = await this.getExecutableTimeframes(
        network,
        symbol,
        index,
        minuteForStartTime,
      );

      this.logger.log(
        `${network} ${symbol} timeframes: ${JSON.stringify(timeframes)}`,
      );

      try {
        if (!timeframes || timeframes?.length == 0) {
          if (network === Network.InEVMTestnet || network === Network.InEVMMainnet) {
            await this.makeActivity(network, symbol);
            await sleep(3000);

            timeframes = await this.getExecutableTimeframes(
              network,
              symbol,
              index,
              minuteForStartTime,
            );
          }
        }
      } catch (err) {
        this.logger.log(
          `${network} ${symbol} - Failed to executable timeframes`
        );
      }

      if (timeframes?.length > 0) {
        const bnPrice = ethers.utils.parseUnits(Number(price).toFixed(8), 8);
        this.logger.log(
          `${network} ${symbol} Current price: ${Number(bnPrice.toString())}`,
        );
        if (this.dataProviderStatuses.length < 2) {
          if (this.dataProviderStatuses.includes(DataProvider.Binance)) {
            let profitableAmount = -1;
            try {
              profitableAmount = await wrapPromise(
                this.calculateProfitableAmount(
                  network,
                  symbol,
                  index,
                  timeframes,
                  bnPrice,
                ),
                TIMEOUT_PERIOD,
                -1,
                `${network} ${symbol} calculateProfitableAmount timeout`,
              );
            } catch (err) {
              this.logger.error(
                `Error occured while getting profitable amount - ${JSON.stringify(
                  err,
                )}`,
              );
            }
            this.logger.log(
              `${network} ${symbol} Profitable amount: ${profitableAmount}`,
            );
            if (profitableAmount >= 0) {
              await this.executeRound(
                network,
                symbol,
                index,
                timeframes,
                bnPrice,
                minuteForStartTime,
              );
            } else {
              this.logger.log(
                `We cannot believe ${symbol} price: ${price} because we are missing data from binance exchange with biggest volume, to mitigate any risk to the vault, we need to abort bet.`,
              );
            }
          } else {
            await this.executeRound(
              network,
              symbol,
              index,
              timeframes,
              bnPrice,
              minuteForStartTime,
            );
          }
        } else {
          this.logger.warn(
            `We cannot believe ${symbol} price: ${price} because we are missing data from: ${this.dataProviderStatuses.join(
              ',',
            )}`,
          );
        }
      }
    } catch (e) {
      this.logger.warn(
        `${symbol} executeRound failed in writePriceToContract function, ${e.stack}`,
      );
      // if (new Date().getSeconds() <= 45) {
      //   setTimeout(async () => {
      //     await this.writePriceToContract(network, symbol, index, price);
      //   }, generateRetryRandomPeriod(true));
      // }
    }
  }

  async writePriceToContractToAllMarkets(
    network: Network,
    symbol: string,
    price: number,
    minuteForStartTime: number,
  ): Promise<void> {
    try {
      await Promise.all(
        MARKET_CONFIGURATION[symbol].binaryMarketContracts[network].map(
          (_, index) =>
            this.writePriceToContract(
              network,
              symbol,
              index,
              price,
              minuteForStartTime,
            ),
        ),
      );
    } catch (e) {
      this.logger.warn(
        `${symbol} executeRound failed in writePriceToContractToAllMarkets function, ${e.stack}`,
      );
    }
  }

  async writePriceToContractToAllChains(
    symbol: string,
    price: number,
    minuteForStartTime: number,
  ): Promise<void> {
    try {
      await Promise.all(
        SUPPORTED_NETWORKS.filter((network) => {
          return NETWORKS[network].markets.includes(symbol as MarketSymbol);
        }).map((item) =>
          this.writePriceToContractToAllMarkets(
            item,
            symbol,
            price,
            minuteForStartTime,
          ),
        ),
      );
    } catch (e) {
      this.logger.warn(
        `${symbol} executeRound failed in writePriceToContractToAllChains function, ${e.stack}`,
      );
    }
  }

  async checkPriceIsValid(
    symbol: string,
    price: number,
    minuteForStartTime: number,
  ): Promise<boolean> {
    if (
      symbol !== MarketSymbol.BTCUSD &&
      symbol !== MarketSymbol.ETHUSD &&
      symbol !== MarketSymbol.BNBUSD &&
      symbol !== MarketSymbol.XRPUSD &&
      symbol !== MarketSymbol.MATICUSD &&
      symbol !== MarketSymbol.SOLUSD
    ) {
      return true;
    }
    const priceDifferenceRate =
      Math.abs(
        (price - this.ohlcService.onChainPrice[symbol]) /
        this.ohlcService.onChainPrice[symbol],
      ) * 100;
    if (priceDifferenceRate <= MAX_PRICE_DIFFERENCE_RATE) {
      await this.writePriceToContractToAllChains(
        symbol,
        price,
        minuteForStartTime,
      );
      return true;
    } else {
      this.logger.warn(
        `We can't believe the ${symbol} aggregated price because this values is so much different`,
      );
      return false;
    }
  }

  async bindOhlcDataFromExchange(
    time: number,
    isForMissing = false,
  ): Promise<boolean> {
    const providerSymbolArray = makeProviderSymbolArray();
    await Promise.all(
      providerSymbolArray.map(async (item) => {
        const provider = item.split('_')[0];
        const symbol = item.split('_')[1];
        const defaultSymbol = DATA_PROVIDERS[provider].markets.find(
          (item) => item.tick === symbol,
        ).symbol;
        try {
          const result = await retryAsync(
            async () => {
              return await this.fetchOhlcDataFromExchange(
                provider,
                time,
                symbol,
              );
            },
            {
              delay: generateRetryRandomPeriod(true),
              maxTry: RETRY_COUNT,
              until: (lastResult) => lastResult !== null,
            },
          );
          if (result) {
            if (isForMissing) {
              this.logger.debug(
                `Fetched OHLC from ${provider} - ${defaultSymbol} - for missing`,
              );
              this.missingOhlcResult[provider][defaultSymbol] = {
                symbol: defaultSymbol,
                source: provider,
                ...result,
              };
            } else {
              if (
                this.ohlcResult[provider][defaultSymbol] &&
                this.ohlcResult[provider][defaultSymbol].time <= result.time
              ) {
                this.dataProviderStatuses = [
                  ...this.dataProviderStatuses.filter(
                    (item) => item !== provider,
                  ),
                ];
              }

              this.logger.debug(
                `Fetched OHLC from ${provider} - ${defaultSymbol} - for not missing`,
              );
              this.ohlcResult[provider][defaultSymbol] = {
                symbol: defaultSymbol,
                source: provider,
                ...result,
              };
            }
          }
          this.logger.debug(
            `Fetched OHLC from ${provider} - ${defaultSymbol} - ${JSON.stringify(
              result,
            )}`,
          );
        } catch (e) {
          this.logger.warn(`Get ${symbol} ${provider} OHLC failed, ${e.stack}`);
          if (isForMissing) {
            if (!this.missingDataProviderStatuses.includes(provider)) {
              this.missingDataProviderStatuses.push(provider);
            }
          } else {
            if (!this.dataProviderStatuses.includes(provider)) {
              this.dataProviderStatuses.push(provider);
            }
          }
        }
      }),
    );
    return true;
  }

  checkValidOhlcResult(isForMissing = false): boolean {
    let hasAllResponse = true;
    const result = isForMissing ? this.missingOhlcResult : this.ohlcResult;
    Object.keys(result).forEach((provider: string) => {
      if (Object.keys(result[provider]).length === 0) {
        hasAllResponse = false;
      }
    });
    return hasAllResponse;
  }

  async runDataProvider(isTest = false): Promise<boolean> {
    while (true) {
      try {
        const minuteForStartTime = getCurrentMinute();
        this.dataProviderStatuses = [];

        this.logger.log(`Fetch OHLC start: `, Date.now());
        Object.keys(this.ohlcResult).forEach((provider: string) => {
          this.ohlcResult[provider] = {};
        });

        while (true) {
          await this.bindOhlcDataFromExchange(minuteForStartTime);
          if (
            this.checkValidOhlcResult() ||
            getCurrentMinute() != minuteForStartTime ||
            new Date().getSeconds() > 30
          ) {
            break;
          }
          await sleep(generateRetryRandomPeriod(true));
        }
        this.logger.log(`Fetch OHLC end: `, Date.now());

        await Promise.all(
          Object.values(MarketSymbol).map(async (symbol) => {
            try {
              if (this.dataProviderStatuses.length < 3) {
                let { open, high, low, close, volume, totalVolumeInCandle } =
                  await this.saveExchangeOhlcRecord(symbol);

                this.logger.log(
                  `Total Volumes In 60 Candles - ${symbol} - ${minuteForStartTime}: ${volume}`,
                );
                if (volume === 0) {
                  Object.values(this.ohlcResult).forEach((value) => {
                    if (Object.keys(value).length > 0 && value[symbol]) {
                      open += value[symbol].open;
                      high += value[symbol].high;
                      low += value[symbol].low;
                      close += value[symbol].close;
                    }
                  });
                }
                const defaultOhlc = await this.saveDefaultOhlcRecord(
                  symbol,
                  minuteForStartTime - MINUTE,
                  open,
                  high,
                  low,
                  close,
                  volume,
                  totalVolumeInCandle,
                );
                if (defaultOhlc) {
                  const pricePrams = {
                    symbol,
                    time: minuteForStartTime,
                  };
                  await sleep(SECOND);
                  const price = await this.ohlcService.getPrice(pricePrams);
                  await this.checkPriceIsValid(
                    symbol,
                    price,
                    minuteForStartTime,
                  );
                }
              } else {
                await this.clonePrevDefaultOhlcRecord(
                  symbol,
                  minuteForStartTime - MINUTE,
                );
              }
            } catch (e) {
              this.logger.warn(`Store ${symbol} ohlc data failed, ${e.stack}`);
            }
          }),
        );

        const minuteForEndTime = getCurrentMinute();

        if (!isTest && minuteForStartTime == minuteForEndTime) {
          // run missing ohlc service
          this.addMissingOhlc(minuteForEndTime).then();
          await sleepUntilNextMinute();
        }
      } catch (e) {
        this.logger.warn(`Run fetchAndSaveOhlcData failed, ${e.stack}`);
      } finally {
        if (isTest) {
          break;
        }
      }
    }
    return true;
  }
}
