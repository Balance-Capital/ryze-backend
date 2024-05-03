import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Contract } from '@ethersproject/contracts';
import { Repository } from 'typeorm';
import { BigNumber, ethers } from 'ethers';

import { Ohlc } from './entities/ohlc.entity';
import { OhlcService } from './ohlc.service';
import { ChainLinkPriceFeedAggregatorABI } from '../core/abi';
import {
  DataProvider,
  OhlcResponseCase,
  ResolutionType,
} from '../core/enums/base.enum';
import { MockType } from '../core/types/mock.type';
import {
  ADD_MISSING_OHLC_OUTPUT_MOCK_DATA,
  ETH_PRICE_ARRAY_MOCK_DATA,
  GENERATE_SINGLE_MARKET_INFO_OUTPUT_MOCK_DATA,
  MARKET_INFO_MOCK_DATA,
  MISSING_OHLC_MOCK_DATA,
  NULL_SIGNATURE_OHLC_MOCK_DATA,
  OHLC_HISTORY_MOCK_DATA,
  OHLC_RESPONSE_INPUT_MOCK_DATA,
  OHLC_RESPONSE_MOCK_DATA,
  OHLC_RESPONSE_OUTPUT_MOCK_DATA,
  WRONG_SIGNATURE_OHLC_MOCK_DATA,
} from '../core/constants/mock-data.constant';
import { getCurrentMinute, getMinuteFromTime } from '../core/utils/base.util';
import {
  ETH_MAINNET_RPC_URL,
  ETH_RPC_URL,
  SYMBOL_AGGREGATOR_ADDRESSES,
  SYMBOLS,
} from '../core/constants/config.constant';
import { MINUTE, SECOND } from '../core/constants/base.constant';

jest.mock('@ethersproject/contracts');
jest.setTimeout(MINUTE);

describe('Test Ohlc Service', () => {
  let module: TestingModule;
  let service: OhlcService;
  let repositoryMock: MockType<Repository<Ohlc>>;

  const repositoryMockFactory: () => MockType<Repository<any>> = jest.fn(
    () => ({
      findOne: jest.fn(),
      find: jest.fn(),
      findAndCount: jest.fn(),
      save: jest.fn((ohlc) => ohlc),
    }),
  );

  const priceFeedContracts = {};

  const emptyResponse = {
    o: [],
    h: [],
    l: [],
    c: [],
    t: [],
    v: [],
  };

  const currentMinute = getCurrentMinute();
  const ethSymbol = SYMBOLS[DataProvider.Default][1];
  const provider = new ethers.providers.JsonRpcProvider(ETH_RPC_URL);

  beforeEach(async () => {
    module = await Test.createTestingModule({
      providers: [
        OhlcService,
        {
          provide: getRepositoryToken(Ohlc),
          useFactory: repositoryMockFactory,
        },
      ],
    }).compile();
    service = module.get<OhlcService>(OhlcService);
    repositoryMock = module.get(getRepositoryToken(Ohlc));
    await module.init();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should return the history of ohlc record when trigger findAll function', async () => {
    repositoryMock.findAndCount.mockReturnValue([
      OHLC_HISTORY_MOCK_DATA.data,
      OHLC_HISTORY_MOCK_DATA.count,
    ]);
    const result = await service.findAll(
      0,
      5,
      ethSymbol,
      currentMinute - MINUTE * 100,
      currentMinute,
    );
    expect(result).toEqual(OHLC_HISTORY_MOCK_DATA);
  });

  it('should return saved ohlc record when trigger save function', async () => {
    repositoryMock.findOne.mockReturnValue(OHLC_HISTORY_MOCK_DATA.data[0]);
    const result = await service.save(OHLC_HISTORY_MOCK_DATA.data[0]);
    expect(result).toEqual(OHLC_HISTORY_MOCK_DATA.data[0]);
  });

  it('should return error when trigger save function with null signature record', async () => {
    repositoryMock.findOne.mockReturnValue(NULL_SIGNATURE_OHLC_MOCK_DATA);
    try {
      await service.save(NULL_SIGNATURE_OHLC_MOCK_DATA);
    } catch (e) {
      expect(e.message).toMatch(
        `Hacking attempt! Found ohlc record without signature, skipping it. Ohlc`,
      );
    }
  });

  it('should return ohlc records when trigger find function', async () => {
    repositoryMock.find.mockReturnValue(OHLC_HISTORY_MOCK_DATA.data);
    try {
      const result = await service.find();
      expect(result).toEqual(OHLC_HISTORY_MOCK_DATA.data);
    } catch (e) {
      expect(e.message).toMatch('Fetch default ohlc record failed,');
    }
  });

  it('should return ohlc pagination data when trigger findAll function', async () => {
    repositoryMock.findAndCount.mockReturnValue(OHLC_HISTORY_MOCK_DATA);
    try {
      const result = await service.findAll(
        0,
        5,
        ethSymbol,
        currentMinute - MINUTE * 100,
        currentMinute,
      );
      expect(result).toEqual(OHLC_HISTORY_MOCK_DATA);
    } catch (e) {
      expect(e.message).toMatch('Fetch default ohlc record failed,');
    }
  });

  it('should return default ohlc record when trigger getDefaultOhlc function', async () => {
    repositoryMock.findOne.mockReturnValue(OHLC_HISTORY_MOCK_DATA.data[0]);
    jest.spyOn(service, 'isOhlcValid').mockImplementation((ohlc) => {
      return true;
    });
    const result = await service.getDefaultOhlc(ethSymbol, currentMinute);
    expect(result).toEqual(OHLC_HISTORY_MOCK_DATA.data[0]);
  });

  it('should return default ohlc record when trigger getDefaultOhlc function', async () => {
    repositoryMock.findOne.mockReturnValue(OHLC_HISTORY_MOCK_DATA.data[0]);
    jest.spyOn(service, 'isOhlcValid').mockImplementation((ohlc) => {
      return true;
    });
    const result = await service.getDefaultOhlc(ethSymbol, currentMinute);
    expect(result).toEqual(OHLC_HISTORY_MOCK_DATA.data[0]);
  });

  it('should return null when trigger getDefaultOhlc function', async () => {
    repositoryMock.findOne.mockReturnValue(OHLC_HISTORY_MOCK_DATA.data[0]);
    jest.spyOn(service, 'isOhlcValid').mockImplementation((ohlc) => {
      return false;
    });
    const result = await service.getDefaultOhlc(ethSymbol, currentMinute);
    expect(result).toEqual(null);
  });

  it('should return sparkline svg string when trigger makeSparkLine function', async () => {
    const result = service['makeSparkLine'](ETH_PRICE_ARRAY_MOCK_DATA.data);
    expect(result).toEqual(ETH_PRICE_ARRAY_MOCK_DATA.sparkline);
  });

  it('should return false when trigger isOhlcValid function with null value', async () => {
    const result = service.isOhlcValid(null);
    expect(result).toEqual(false);
  });

  it('should return false when trigger isOhlcValid function with null value as ohlc signature', async () => {
    const result = service.isOhlcValid(NULL_SIGNATURE_OHLC_MOCK_DATA);
    expect(result).toEqual(false);
  });

  it('should return false when trigger isOhlcValid function with decrypted message is not equal to ohlc signature', async () => {
    const result = service.isOhlcValid(WRONG_SIGNATURE_OHLC_MOCK_DATA);
    expect(result).toEqual(false);
  });

  it('should return true when trigger isOhlcValid function', async () => {
    const result = service.isOhlcValid(OHLC_HISTORY_MOCK_DATA.data[0]);
    expect(result).toEqual(true);
  });

  it('should return null when trigger generateSingleMarketInfo function with no records', async () => {
    repositoryMock.find.mockReturnValue([]);
    const result = await service['generateSingleMarketInfo'](
      ethSymbol,
      1677750660000,
      1677750900000,
    );
    expect(result).toEqual(null);
  });

  it('should check error log when trigger generateSingleMarketInfo function with no records', async () => {
    repositoryMock.find.mockImplementation(() => {
      throw Error();
    });
    const result = await service['generateSingleMarketInfo'](
      ethSymbol,
      1677750660000,
      1677750900000,
    );
    expect(result).toEqual(null);
  });

  it('should return single market info when trigger generateSingleMarketInfo function', async () => {
    repositoryMock.find.mockReturnValue(OHLC_HISTORY_MOCK_DATA.data);
    const result = await service['generateSingleMarketInfo'](
      ethSymbol,
      1677750660000,
      1677750900000,
    );
    expect(result).toEqual(GENERATE_SINGLE_MARKET_INFO_OUTPUT_MOCK_DATA);
  });

  it('should return market info when trigger getMarketInfo function', async () => {
    const to = Date.now();
    const from = to - 86400 * SECOND;
    repositoryMock.find.mockReturnValue(OHLC_HISTORY_MOCK_DATA.data);
    const result = await service.getMarketInfo(from, to);
    expect(result).toEqual(MARKET_INFO_MOCK_DATA);
  });

  it('should return error when trigger getPrice function', async () => {
    jest.spyOn(service, 'getDefaultOhlc').mockReturnValue(null);
    const time = Date.now();
    try {
      await service.getPrice({ symbol: ethSymbol, time });
    } catch (e) {
      expect(e.message).toEqual(`There is no prev candle yet.`);
    }
  });

  it('should return current ohlc price when trigger getPrice function', async () => {
    jest
      .spyOn(service, 'getDefaultOhlc')
      .mockImplementation(async (symbol, time) => {
        return OHLC_HISTORY_MOCK_DATA.data[0];
      });
    const time = Date.now();
    const result = await service.getPrice({ symbol: ethSymbol, time });
    expect(result).toEqual(
      Number(OHLC_HISTORY_MOCK_DATA.data[0].open.toFixed(2)),
    );
  });

  it('should return prev ohlc price when trigger getPrice function', async () => {
    const currentTime = Date.now();
    const currentCandleTime = getMinuteFromTime(currentTime);
    const prevCandleTime = currentCandleTime - MINUTE;
    jest
      .spyOn(service, 'getDefaultOhlc')
      .mockImplementation(async (symbol, time) => {
        if (time === currentCandleTime) {
          return null;
        } else if (time === prevCandleTime) {
          return OHLC_HISTORY_MOCK_DATA.data[0];
        }
      });
    const time = Date.now();
    const result = await service.getPrice({ symbol: ethSymbol, time });
    expect(result).toEqual(
      Number(OHLC_HISTORY_MOCK_DATA.data[0].close.toFixed(2)),
    );
  });

  it('should return ohlc trading view response when trigger getOhlcData function', async () => {
    jest
      .spyOn(service, 'addMissingOhlcData')
      .mockImplementation(async (symbol, from, to) => {
        return OHLC_HISTORY_MOCK_DATA.data;
      });
    const result = await service.getOhlcData({
      symbol: ethSymbol,
      from: OHLC_HISTORY_MOCK_DATA.data[0].time,
      to: OHLC_HISTORY_MOCK_DATA.data[4].time,
      resolution: ResolutionType.Minute_1,
    });
    expect(result).toEqual(OHLC_RESPONSE_MOCK_DATA);
  });

  it('should check error log save ohlc data when trigger addMissingOhlcData function', async () => {
    repositoryMock.find.mockReturnValue(MISSING_OHLC_MOCK_DATA);
    jest.spyOn(service, 'save').mockImplementation(async (ohlc: any) => {
      throw Error();
    });
    const result = await service.addMissingOhlcData(
      ethSymbol,
      1677750660000,
      1677750900000,
    );
    expect(result).toEqual(MISSING_OHLC_MOCK_DATA);
  });

  it('should return ohlc data has no missing timestamp when trigger addMissingOhlcData function', async () => {
    repositoryMock.find.mockReturnValue(MISSING_OHLC_MOCK_DATA);
    jest.spyOn(service, 'save').mockImplementation(async (ohlc: any) => {
      return ohlc;
    });
    const result = await service.addMissingOhlcData(
      ethSymbol,
      1677750660000,
      1677750900000,
    );
    const exceptIdResult = result.map((item) => {
      return {
        symbol: item.symbol,
        time: item.time,
        source: item.source,
        open: item.open,
        high: item.high,
        low: item.low,
        close: item.close,
        volume: item.volume,
        dataProviderStatuses: item.dataProviderStatuses,
        signature: null,
        isCloned: item.isCloned,
      };
    });
    expect(exceptIdResult).toEqual(
      ADD_MISSING_OHLC_OUTPUT_MOCK_DATA.map((item) => {
        return {
          ...item,
          signature: null,
        };
      }),
    );
  });

  it('should return empty response when trigger makeOhlcResponse method with 1 min resolution', async () => {
    const ohlcResponse = service['makeOhlcResponse'](
      [],
      ResolutionType.Minute_1,
      'BTCUSD',
    );
    expect(ohlcResponse).toEqual(emptyResponse);
  });

  it('should return empty response when trigger makeOhlcResponse method with 5 min resolution', async () => {
    const ohlcResponse = service['makeOhlcResponse'](
      [],
      ResolutionType.Minute_5,
      'BTCUSD',
    );
    expect(ohlcResponse).toEqual(emptyResponse);
  });

  it('should return empty response when trigger makeOhlcResponse method with 15 min resolution', async () => {
    const ohlcResponse = service['makeOhlcResponse'](
      [],
      ResolutionType.Minute_15,
      'BTCUSD',
    );
    expect(ohlcResponse).toEqual(emptyResponse);
  });

  it('should return empty response when trigger makeOhlcResponse method with 30 min resolution', async () => {
    const ohlcResponse = service['makeOhlcResponse'](
      [],
      ResolutionType.Minute_30,
      'BTCUSD',
    );
    expect(ohlcResponse).toEqual(emptyResponse);
  });

  it('should return empty response when trigger makeOhlcResponse method with 1 hour resolution', async () => {
    const ohlcResponse = service['makeOhlcResponse'](
      [],
      ResolutionType.Hour_1,
      'BTCUSD',
    );
    expect(ohlcResponse).toEqual(emptyResponse);
  });

  it('should return ohlc trading view response when trigger makeOhlcResponse method with hasNotFirstIndex case', async () => {
    const ohlcResponse = service['makeOhlcResponse'](
      OHLC_RESPONSE_INPUT_MOCK_DATA[OhlcResponseCase.HasNoFirstIndex],
      ResolutionType.Minute_5,
      'BTCUSD',
    );
    expect(ohlcResponse).toEqual(
      OHLC_RESPONSE_OUTPUT_MOCK_DATA[OhlcResponseCase.HasNoFirstIndex],
    );
  });

  it('should return ohlc trading view response when trigger makeOhlcResponse method with full case', async () => {
    const ohlcResponse = service['makeOhlcResponse'](
      OHLC_RESPONSE_INPUT_MOCK_DATA[OhlcResponseCase.FullCase],
      ResolutionType.Minute_5,
      'BTCUSD',
    );
    expect(ohlcResponse).toEqual(
      OHLC_RESPONSE_OUTPUT_MOCK_DATA[OhlcResponseCase.FullCase],
    );
  });

  it('should check initializeWeb3', async () => {
    const provider = new ethers.providers.JsonRpcProvider(ETH_MAINNET_RPC_URL);
    Object.keys(SYMBOL_AGGREGATOR_ADDRESSES).map(async (symbol) => {
      priceFeedContracts[symbol] = new ethers.Contract(
        SYMBOL_AGGREGATOR_ADDRESSES[symbol],
        ChainLinkPriceFeedAggregatorABI,
        provider,
      );
    });
    await service['initializeWeb3']();
    expect(service['provider']).toEqual(provider);
  });

  it('should check getOnChainSymbolPrice with null value as usdt symbol price', async () => {
    const contract = new ethers.Contract(
      SYMBOL_AGGREGATOR_ADDRESSES[SYMBOLS[DataProvider.Chainlink][0]],
      ChainLinkPriceFeedAggregatorABI,
      provider,
    );
    (Contract.prototype as any).latestRoundData = async () => {
      return null;
    };
    service.onChainPrice[SYMBOLS[DataProvider.Chainlink][0]] = null;
    const result = await service.getOnChainSymbolPrice(
      contract,
      SYMBOLS[DataProvider.Chainlink][0],
    );
    // onChainPrice should be never changed if the latestRoundData is null
    expect(service.onChainPrice[SYMBOLS[DataProvider.Chainlink][0]]).toEqual(
      null,
    );
    expect(result).toEqual(true);
  });

  it('should check getOnChainSymbolPrice with error as usdt symbol price', async () => {
    const contract = new ethers.Contract(
      SYMBOL_AGGREGATOR_ADDRESSES[SYMBOLS[DataProvider.Chainlink][0]],
      ChainLinkPriceFeedAggregatorABI,
      provider,
    );
    (Contract.prototype as any).latestRoundData = async () => {
      throw Error();
    };
    const result = await service.getOnChainSymbolPrice(
      contract,
      SYMBOLS[DataProvider.Chainlink][0],
    );
    // onChainPrice should be never initialized if we got the error when getting latestRoundData
    expect(service.onChainPrice[SYMBOLS[DataProvider.Chainlink][0]]).toEqual(
      undefined,
    );
    expect(result).toEqual(true);
  });

  it('should check getOnChainSymbolPrice with valid value as usdt symbol price', async () => {
    const contract = new ethers.Contract(
      SYMBOL_AGGREGATOR_ADDRESSES[SYMBOLS[DataProvider.Chainlink][0]],
      ChainLinkPriceFeedAggregatorABI,
      provider,
    );
    (Contract.prototype as any).latestRoundData = async () => {
      return {
        answer: BigNumber.from(1),
      };
    };
    const result = await service.getOnChainSymbolPrice(
      contract,
      SYMBOLS[DataProvider.Chainlink][0],
    );
    expect(service.onChainPrice[SYMBOLS[DataProvider.Chainlink][0]]).toEqual(
      Number(ethers.utils.formatUnits(BigNumber.from(1), 8)),
    );
    expect(result).toEqual(true);
  });

  it('should check getOnChainPrices', async () => {
    const result = await service.getOnChainPrices();
    expect(result).toEqual(true);
  });

  afterEach(async () => await module.close());
});
