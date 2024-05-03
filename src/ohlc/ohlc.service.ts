import {
  BadRequestException,
  Injectable,
  Logger,
  OnModuleInit,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, Repository } from 'typeorm';
import { Contract, ethers } from 'ethers';
import * as sparkline from 'node-sparkline';
import * as CryptoJS from 'crypto-js';

import { Ohlc } from './entities/ohlc.entity';
import { OhlcDto, OhlcParams, OhlcResponse } from './dto/ohlc.dto';
import { PriceParams } from './dto/price.dto';
import { MarketStatusResponse } from './dto/market-status.dto';
import { replaceAll } from '../core/utils/string.util';
import {
  getCurrentMinute,
  getMinuteFromTime,
  loadEnvVariable,
} from '../core/utils/base.util';
import { makeOhlcSignatureMessage } from '../core/utils/ohlc.util';
import { ChainLinkPriceFeedAggregatorABI } from '../core/abi';
import {
  DataProvider,
  MarketSymbol,
  Network,
  ResolutionType,
} from '../core/enums/base.enum';
import { DataProviderLatestPrice } from '../core/types/price.type';
import { PaginatorDto } from '../core/dto/paginator.dto';
import { SingleMarketInfo } from '../core/types/market.type';
import {
  COIN_IDS,
  INTERVAL_ONCHAIN_PRICES,
  SECOND_SIGN_PASSWORD,
  CHAINLINK_PROVIDER,
  DATA_PROVIDERS,
  MARKET_CONFIGURATION,
  NETWORKS,
} from '../core/constants/config.constant';
import { MINUTE } from '../core/constants/base.constant';
import { FindManyOptions } from 'typeorm/find-options/FindManyOptions';
import { HttpService } from '@nestjs/axios';
import axios from 'axios';
import { Cron, CronExpression } from '@nestjs/schedule';

@Injectable()
export class OhlcService implements OnModuleInit {
  latestPriceRecord: DataProviderLatestPrice = {};
  syncedTime = new Date().getTime();
  onChainPrice = {};
  priceFeedRetryCounts = {};
  private ethMainnetProviders: ethers.providers.JsonRpcProvider[] = [];
  private arbMainnetProviders: ethers.providers.JsonRpcProvider[] = [];
  private readonly logger = new Logger(OhlcService.name);
  private marketData: MarketStatusResponse[] = [];

  constructor(
    @InjectRepository(Ohlc)
    private ohlcRepository: Repository<Ohlc>,
    private readonly httpService: HttpService,
  ) {
    this.fetchMarketDataFromCoingecko();
  }

  async find(options?: FindManyOptions<Ohlc>): Promise<Ohlc[]> {
    return await this.ohlcRepository.find(options);
  }

  async findAll(
    skip: number,
    take: number,
    symbol: string,
    from: number,
    to: number,
  ): Promise<PaginatorDto<Ohlc>> {
    try {
      const [data, count] = await this.ohlcRepository.findAndCount({
        order: { time: 'ASC' },
        skip,
        take,
        where: {
          symbol: symbol,
          source: DataProvider.Default,
          time: Between(from, to),
        },
      });
      return {
        data,
        count,
      };
    } catch (e) {
      throw new BadRequestException(
        `Fetch default ohlc record failed, ${e.stack}`,
      );
    }
  }

  onModuleInit() {
    this.initializeLatestPriceRecord();
    this.initializeWeb3();

    this.getOnChainPrices().then();
    setInterval(async () => {
      await this.getOnChainPrices();
    }, INTERVAL_ONCHAIN_PRICES);
  }

  async save(ohlc: OhlcDto): Promise<Ohlc> {
    const found = await this.ohlcRepository.findOne({
      where: {
        symbol: ohlc.symbol,
        source: ohlc.source,
        time: ohlc.time,
      },
    });
    if (found) {
      ohlc['id'] = found.id;
    }
    if (!this.isOhlcValid(ohlc)) {
      throw Error(
        `Hacking attempt! Found ohlc record without signature, skipping it. Ohlc`,
      );
    }
    return await this.ohlcRepository.save(ohlc);
  }

  async addMissingOhlcData(
    symbol: string,
    from: number,
    to: number,
  ): Promise<Ohlc[]> {
    let data = await this.ohlcRepository.find({
      order: { time: 'ASC' },
      where: {
        symbol: symbol,
        source: DataProvider.Default,
        time: Between(from, to - 1),
      },
    });
    while (true) {
      let missingRecordFound = false;
      for await (const item of data) {
        const index = data.indexOf(item);
        const currentTime = Number(item.time);
        let nextTime = 0;
        if (index < data.length - 1) {
          nextTime = Number(data[index + 1].time);
        }
        if (nextTime !== 0 && nextTime - currentTime > MINUTE) {
          try {
            const ohlc = {
              symbol: item.symbol,
              time: currentTime + MINUTE,
              source: DataProvider.Default,
              open: item.close,
              high: item.high,
              low: item.low,
              close: data[index + 1].open,
              volume: item.volume,
              dataProviderStatuses: item.dataProviderStatuses,
              signature: null,
              isCloned: true,
            };
            ohlc['signature'] = CryptoJS.AES.encrypt(
              makeOhlcSignatureMessage(ohlc),
              `${loadEnvVariable(
                'FIRST_SIGN_PASSWORD',
              )}_${SECOND_SIGN_PASSWORD}`,
            ).toString();
            const result = await this.save(ohlc);
            data.push(result);
            data = data.sort((a, b) => a.time - b.time);
            this.logger.log(
              `Cloned ${result.symbol} ${
                result.time
              } DEFAULT ohlc data because of missing, ${JSON.stringify(
                result,
              )}`,
            );
            missingRecordFound = true;
          } catch (e) {
            this.logger.warn(
              `Failed to add missing default record, ${e.stack}`,
            );
          } finally {
            break;
          }
        }
      }
      if (!missingRecordFound) {
        break;
      }
    }
    return data;
  }

  async getOhlcData(query: OhlcParams): Promise<OhlcResponse> {
    let data = await this.addMissingOhlcData(
      query.symbol,
      query.from,
      query.to,
    );
    data = data.filter((record) => this.isOhlcValid(record));
    return await this.makeOhlcResponse(data, query.resolution, query.symbol);
  }

  async getDefaultOhlc(symbol: string, time: number): Promise<Ohlc> {
    const ohlcRecord = await this.ohlcRepository.findOne({
      order: { time: 'ASC' },
      where: {
        symbol,
        time,
        source: DataProvider.Default,
      },
    });
    return this.isOhlcValid(ohlcRecord) ? ohlcRecord : null;
  }

  async getMarketInfo(
    from: number,
    to: number,
  ): Promise<MarketStatusResponse[]> {
    // const result = [];
    // await Promise.all(
    //   SYMBOLS[DataProvider.Default].map(async (symbol) => {
    //     const marketInfo = await this.generateSingleMarketInfo(
    //       symbol,
    //       from,
    //       to,
    //     );
    //     if (marketInfo) {
    //       result.push(marketInfo);
    //     }
    //   }),
    // );

    // return result;
    return this.marketData;
  }

  @Cron(CronExpression.EVERY_5_MINUTES)
  private async fetchMarketDataFromCoingecko() {
    try {
      const { data } = await axios.get(
        `https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&ids=${COIN_IDS.join(
          ',',
        )}&order=market_cap_desc&per_page=100&page=1&sparkline=true&price_change_percentage=24h&locale=en&precision=8`,
      );
      this.marketData = data.map((item) => {
        return {
          symbol: `${item.symbol.toUpperCase()}USD`,
          price: item.current_price,
          oneDayChangeRate: item.price_change_percentage_24h_in_currency,
          oneDayVolume: item.total_volume,
          trendLineSvg: this.makeSparkLine(item.sparkline_in_7d.price),
        };
      });
    } catch (err) {
      this.logger.error(`Fetch coingecko data - ${JSON.stringify(err)}`);
    }
  }

  async getPrice(payload: PriceParams): Promise<number> {
    const time = getMinuteFromTime(payload.time);
    const data = await this.getDefaultOhlc(payload.symbol, time);
    const decimals = MARKET_CONFIGURATION[payload.symbol]?.decimals ?? 2;
    if (!data || !this.isOhlcValid(data)) {
      const past = await this.getDefaultOhlc(payload.symbol, time - MINUTE);
      if (!past || !this.isOhlcValid(past)) {
        throw new BadRequestException(`There is no prev candle yet.`);
      }
      return Number(past.close.toFixed(decimals));
    }
    return Number(data.open.toFixed(decimals));
  }

  isOhlcValid(ohlc: Ohlc | OhlcDto): boolean {
    if (!ohlc) {
      return false;
    }

    if (!ohlc.signature) {
      this.logger.error(
        `Hacking attempt! Found ohlc record without signature, skipping it. Ohlc: ${JSON.stringify(
          ohlc,
        )}`,
      );
      return false;
    }

    const decrypted = CryptoJS.AES.decrypt(
      ohlc.signature,
      `${loadEnvVariable('FIRST_SIGN_PASSWORD')}_${SECOND_SIGN_PASSWORD}`,
    ).toString(CryptoJS.enc.Utf8);

    if (decrypted !== makeOhlcSignatureMessage(ohlc)) {
      this.logger.error(
        `Hacking attempt! Found ohlc record with different signature message, skipping it. Ohlc: ${JSON.stringify(
          ohlc,
        )}, found signature: [${
          ohlc.signature
        }], which should be: ${decrypted}, but it's ${makeOhlcSignatureMessage(
          ohlc,
        )}`,
      );
      return false;
    }

    return true;
  }

  async getOnChainPrices(): Promise<boolean> {
    CHAINLINK_PROVIDER.forEach((item) => {
      this.priceFeedRetryCounts[item.id] = 0;
      this.getOnChainSymbolPrice(item).then();
    });
    return true;
  }

  async getOnChainSymbolPrice(item: {
    id: string;
    address: string;
    chain?: Network;
  }): Promise<boolean> {
    const { id: symbol, address, chain } = item;
    const chainProviders =
      chain == Network.ArbitrumMainnet
        ? this.arbMainnetProviders
        : this.ethMainnetProviders;

    const count = 0;
    while (count < chainProviders.length) {
      const provider = chainProviders[count];
      const contract = new Contract(
        address,
        ChainLinkPriceFeedAggregatorABI,
        provider,
      );

      try {
        const priceData = await contract.latestRoundData();
        if (priceData?.answer) {
          const stringValue = ethers.utils.formatUnits(priceData.answer, 8);
          this.onChainPrice[symbol] = Number(stringValue);
          this.logger.log(
            `${symbol} onChain price: ${this.onChainPrice[symbol]}`,
          );
          this.priceFeedRetryCounts[symbol] = 0;
          return true;
        } else {
          this.priceFeedRetryCounts[symbol]++;
        }
      } catch (e) {
        this.priceFeedRetryCounts[symbol]++;
      }
    }

    if (count == chainProviders.length) {
      this.logger.warn(`Get ${symbol} onchain price failed`);
    }

    return false;
  }

  private makeSparkLine(item: number[]): string {
    let trendLineSvg = sparkline({
      values: item,
      strokeWidth: 2,
      stroke: '#12b3a8',
      width: 114,
      height: 20,
    });
    trendLineSvg = replaceAll(trendLineSvg, 'NaN', 19);
    trendLineSvg = trendLineSvg.replace(/\.\d+/g, '');
    trendLineSvg = trendLineSvg.replace(/,\s(0)\s/g, ', 1 ');
    trendLineSvg = trendLineSvg.replace(/,\s20/g, ', 19');

    const points = trendLineSvg.match(/points="([\d ,]*)"/)[1];
    const pairs = points.match(/(\d+, \d+)/g);
    const lastYPoint = pairs[pairs.length - 1].split(' ')[1];
    trendLineSvg = trendLineSvg.replace(points, `${points}, ${lastYPoint}`);

    return trendLineSvg;
  }

  private async makeOhlcResponse(
    data: Array<Ohlc>,
    resolution: string,
    symbol: string,
  ): Promise<OhlcResponse> {
    let intervalPeriod = 1;
    switch (resolution) {
      case ResolutionType.Minute_1:
        intervalPeriod = 1;
        break;
      case ResolutionType.Minute_3:
        intervalPeriod = 3;
        break;
      case ResolutionType.Minute_5:
        intervalPeriod = 5;
        break;
      case ResolutionType.Minute_15:
        intervalPeriod = 15;
        break;
      case ResolutionType.Minute_30:
        intervalPeriod = 30;
        break;
      case ResolutionType.Hour_1:
        intervalPeriod = 60;
        break;
    }
    const openPriceArray = [],
      closePriceArray = [],
      highPriceArray = [],
      lowPriceArray = [],
      timeArray = [],
      volumeArray = [];

    const decimals = MARKET_CONFIGURATION[symbol]?.decimals ?? 2;
    if (data && data.length > 0) {
      const firstIndex = data.findIndex(
        (item) => Number(item.time) % (intervalPeriod * MINUTE) === 0,
      );
      let lastIndex = data.length - 1;
      while (1) {
        if (
          lastIndex === 0 ||
          Number(data[lastIndex].time) % (intervalPeriod * MINUTE) === 0
        ) {
          break;
        }
        lastIndex--;
      }
      if (firstIndex < 0) {
        for (let i = 0; i < data.length; i += intervalPeriod) {
          const open = Number(data[i].open);
          const high = Number(
            data
              .slice(i, Math.min(i + intervalPeriod, data.length))
              .sort((a, b) => b.high - a.high)[0].high,
          );
          const low = Number(
            data
              .slice(i, Math.min(i + intervalPeriod, data.length))
              .sort((a, b) => a.low - b.low)[0].low,
          );
          const close = Number(data[data.length - 1].close);
          let time = Number(data[i].time);
          time = time - (time % (intervalPeriod * MINUTE));
          const volume = data
            .slice(i, i + intervalPeriod)
            .reduce((acc, curr) => acc + curr.volume, 0);
          openPriceArray.push(Number(open.toFixed(decimals)));
          highPriceArray.push(Number(high.toFixed(decimals)));
          lowPriceArray.push(Number(low.toFixed(decimals)));
          closePriceArray.push(Number(close.toFixed(decimals)));
          volumeArray.push(volume);
          timeArray.push(time);
        }
      } else {
        for (let i = 0; i < firstIndex; i += intervalPeriod) {
          const open = Number(data[i].open);
          const high = Number(
            data.slice(i, firstIndex).sort((a, b) => b.high - a.high)[0].high,
          );
          const low = Number(
            data.slice(i, firstIndex).sort((a, b) => a.low - b.low)[0].low,
          );
          const close = Number(data[firstIndex - 1].close);
          const time = Number(data[firstIndex].time) - intervalPeriod * MINUTE;
          const volume = data
            .slice(i, i + intervalPeriod)
            .reduce((acc, curr) => acc + curr.volume, 0);
          openPriceArray.push(Number(open.toFixed(decimals)));
          highPriceArray.push(Number(high.toFixed(decimals)));
          lowPriceArray.push(Number(low.toFixed(decimals)));
          closePriceArray.push(Number(close.toFixed(decimals)));
          volumeArray.push(volume);
          timeArray.push(time);
        }
        for (let i = firstIndex; i < lastIndex; i += intervalPeriod) {
          const open = Number(data[i].open);
          const sliceData = data.slice(
            i,
            Math.min(i + intervalPeriod, lastIndex),
          );
          const high = Number(
            sliceData.sort((a, b) => b.high - a.high)[0].high,
          );
          const low = Number(sliceData.sort((a, b) => a.low - b.low)[0].low);
          const endIndex = Math.min(i + intervalPeriod - 1, lastIndex - 1);
          const close = Number(data[endIndex].close);
          const time = Number(data[i].time);
          const volume = data
            .slice(i, i + intervalPeriod)
            .reduce((acc, curr) => acc + curr.volume, 0);
          openPriceArray.push(Number(open.toFixed(decimals)));
          highPriceArray.push(Number(high.toFixed(decimals)));
          lowPriceArray.push(Number(low.toFixed(decimals)));
          closePriceArray.push(Number(close.toFixed(decimals)));
          volumeArray.push(volume);
          timeArray.push(time);
        }
        for (let i = lastIndex; i < data.length; i += intervalPeriod) {
          const open = Number(data[i].open);
          const high = Number(
            data.slice(i, i + intervalPeriod).sort((a, b) => b.high - a.high)[0]
              .high,
          );
          const low = Number(
            data.slice(i, i + intervalPeriod).sort((a, b) => a.low - b.low)[0]
              .low,
          );
          const close = Number(data[data.length - 1].close);
          const time = Number(data[i].time);
          const volume = data
            .slice(i, i + intervalPeriod)
            .reduce((acc, curr) => acc + curr.volume, 0);
          openPriceArray.push(Number(open.toFixed(decimals)));
          highPriceArray.push(Number(high.toFixed(decimals)));
          lowPriceArray.push(Number(low.toFixed(decimals)));
          closePriceArray.push(Number(close.toFixed(decimals)));
          volumeArray.push(volume);
          timeArray.push(time);
        }
      }
    }

    try {
      const currentMinuteTimestamp = getCurrentMinute();
      const lastTimestamp =
        currentMinuteTimestamp -
        (currentMinuteTimestamp % (intervalPeriod * MINUTE));

      if (
        timeArray.length === 0 ||
        timeArray[timeArray.length - 1] !== lastTimestamp
      ) {
        if (closePriceArray.length > 0) {
          const openPrice = closePriceArray[closePriceArray.length - 1];

          openPriceArray.push(openPrice);
          highPriceArray.push(openPrice);
          lowPriceArray.push(openPrice);
          closePriceArray.push(openPrice);
          // We need to set volume as 0, because this candle is not completed yet. (Frontend requirement for calculating volume exactly)
          volumeArray.push(0);
          timeArray.push(lastTimestamp);
        }
      }
    } catch (err) {
      this.logger.error(`Error occured while fetching latest candle`, err);
    }

    return {
      o: openPriceArray,
      h: highPriceArray,
      l: lowPriceArray,
      c: closePriceArray,
      t: timeArray,
      v: volumeArray,
    };
  }

  private initializeLatestPriceRecord(): void {
    Object.keys(DATA_PROVIDERS).forEach((provider: string) => {
      this.latestPriceRecord[provider] = {};
      Object.values(MarketSymbol).forEach((symbol: string) => {
        this.latestPriceRecord[provider][symbol] = {
          volume: 0,
          tradeCountPerMinute: 0,
          syncTrade: null,
          lastTrade: null,
          hasBinanceError: false,
        };
      });
    });
  }

  private initializeWeb3(): void {
    for (let i = 0; i < NETWORKS[Network.EthereumMainnet].rpcList.length; i++) {
      const provider = new ethers.providers.JsonRpcProvider(
        NETWORKS[Network.EthereumMainnet].rpcList[i],
      );
      this.ethMainnetProviders.push(provider);
    }

    for (let i = 0; i < NETWORKS[Network.ArbitrumMainnet].rpcList.length; i++) {
      const provider = new ethers.providers.JsonRpcProvider(
        NETWORKS[Network.ArbitrumMainnet].rpcList[i],
      );
      this.arbMainnetProviders.push(provider);
    }

    CHAINLINK_PROVIDER.map(async (item) => {
      this.priceFeedRetryCounts[item.id] = 0;
    });
  }

  private async generateSingleMarketInfo(
    symbol: string,
    from: number,
    to: number,
  ): Promise<SingleMarketInfo> {
    try {
      const decimals = MARKET_CONFIGURATION[symbol]?.decimals ?? 2;
      let records = await this.ohlcRepository.find({
        order: { time: 'ASC' },
        where: {
          symbol: symbol,
          source: DataProvider.Default,
          time: Between(from, to),
        },
      });
      records = records.filter((record) => this.isOhlcValid(record));
      if (records.length > 0) {
        const firstValue = records[0];
        const lastValue = records[records.length - 1];
        const oneDayChangeRate =
          ((lastValue.close - firstValue.close) / firstValue.close) * 100;
        let oneDayVolume = records.reduce(
          (prev, curr) => prev + Number(curr.volume),
          0,
        );
        const trendLineSvg = this.makeSparkLine(
          records.map((item) => Number(item.close.toFixed(decimals))),
        );
        oneDayVolume = oneDayVolume * Number(lastValue.close);
        return {
          symbol,
          price: lastValue.close,
          oneDayChangeRate: Number(oneDayChangeRate.toFixed(decimals)),
          oneDayVolume,
          trendLineSvg,
        };
      }
      return null;
    } catch (e) {
      this.logger.warn(
        `${symbol} - generate market info for 1 day failed, ${e.stack}`,
      );
      return null;
    }
  }
}
