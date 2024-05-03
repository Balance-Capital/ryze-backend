import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { HttpService } from '@nestjs/axios';
import { Contract } from '@ethersproject/contracts';
import { ethers } from 'ethers';
import { Repository } from 'typeorm';
import { of } from 'rxjs';

import { Ohlc } from '../../ohlc/entities/ohlc.entity';
import { OhlcService } from '../../ohlc/ohlc.service';
import { BinanceService } from '../binance/binance.service';
import { CoinbaseService } from '../coinbase/coinbase.service';
import { KrakenService } from '../kraken/kraken.service';
import { BinanceOhlcService } from '../binance/binance.ohlc.service';
import { CoinbaseOhlcService } from '../coinbase/coinbase.ohlc.service';
import { KrakenOhlcService } from '../kraken/kraken.ohlc.service';
import { OhlcWorkerService } from './ohlc-worker.service';
import { MockType } from '../../core/types/mock.type';
import {
  CONTRACT_BINARY_MARKETS,
  ETH_RPC_URL,
  SYMBOLS,
} from '../../core/constants/config.constant';
import { DataProvider } from '../../core/enums/base.enum';
import {
  BN_ETH_PRICE_MOCK_DATA,
  BN_ETH_ZERO_PRICE_MOCK_DATA,
  CLONED_OHLC_RECORD_VALID_PREV_MOCK_DATA,
  CONTRACT_ROUND_MOCK_DATA,
  DEFAULT_OHLC_RECORD_VALID_PREV_MOCK_DATA,
  FIND_MISSING_OHLC_OUTPUT_MOCK_DATA,
  NON_OHLC_RESULT_MOCK_DATA,
  OHLC_HISTORY_MOCK_DATA,
  OHLC_PRICE_MOCK_DATA,
  REST_API_OHLC_MOCK_DATA,
  TOTAL_OHLC_MOCK_DATA,
  VALID_OHLC_RESULT_MOCK_DATA,
} from '../../core/constants/mock-data.constant';
import { BinaryMarketABI } from '../../core/abi';
import { getCurrentMinute, sleep } from '../../core/utils/base.util';
import { MINUTE, SECOND } from '../../core/constants/base.constant';

jest.mock('@ethersproject/contracts');
jest.setTimeout(3 * MINUTE * SECOND);

describe('Test Ohlc Worker Thread', () => {
  let ohlcService: OhlcService;
  let binanceService: BinanceService;
  let coinbaseService: CoinbaseService;
  let krakenService: KrakenService;
  let ohlcWorkerService: OhlcWorkerService;
  let repositoryMock: MockType<Repository<Ohlc>>;

  const httpService = {
    get: jest.fn(),
    post: jest.fn().mockImplementation(() => of({ data: {} })),
  };

  const repositoryMockFactory: () => MockType<Repository<any>> = jest.fn(
    () => ({
      findOne: jest.fn(),
      find: jest.fn(),
      findAndCount: jest.fn(),
      save: jest.fn((ohlc) => ohlc),
    }),
  );

  const ethSymbol = SYMBOLS[DataProvider.Default][1];
  const provider = new ethers.providers.JsonRpcProvider(ETH_RPC_URL);

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OhlcService,
        BinanceService,
        CoinbaseService,
        KrakenService,
        BinanceOhlcService,
        CoinbaseOhlcService,
        KrakenOhlcService,
        { provide: HttpService, useValue: httpService },
        {
          provide: getRepositoryToken(Ohlc),
          useFactory: repositoryMockFactory,
        },
      ],
    }).compile();
    repositoryMock = module.get(getRepositoryToken(Ohlc));
    ohlcService = module.get<OhlcService>(OhlcService);
    binanceService = module.get<BinanceService>(BinanceService);
    coinbaseService = module.get<CoinbaseService>(CoinbaseService);
    krakenService = module.get<KrakenService>(KrakenService);
    ohlcWorkerService = new OhlcWorkerService(
      binanceService,
      coinbaseService,
      krakenService,
      ohlcService,
    );
  });

  it('should be defined', () => {
    expect(ohlcWorkerService).toBeDefined();
  });

  it('should return ohlc data when trigger fetchOhlcDataFromExchange function with binance provider', async () => {
    jest
      .spyOn(binanceService, 'getOhlcData')
      .mockImplementation(async (time, symbol) => {
        return REST_API_OHLC_MOCK_DATA;
      });
    const result = await ohlcWorkerService.fetchOhlcDataFromExchange(
      DataProvider.Binance,
      Date.now(),
      ethSymbol,
    );
    expect(result).toEqual(REST_API_OHLC_MOCK_DATA);
  });

  it('should return ohlc data when trigger fetchOhlcDataFromExchange function with kraken provider', async () => {
    jest
      .spyOn(krakenService, 'getOhlcData')
      .mockImplementation(async (time, symbol) => {
        return REST_API_OHLC_MOCK_DATA;
      });
    const result = await ohlcWorkerService.fetchOhlcDataFromExchange(
      DataProvider.Kraken,
      Date.now(),
      ethSymbol,
    );
    expect(result).toEqual(REST_API_OHLC_MOCK_DATA);
  });

  it('should return ohlc data when trigger fetchOhlcDataFromExchange function with coinbase provider', async () => {
    jest
      .spyOn(coinbaseService, 'getOhlcData')
      .mockImplementation(async (time, symbol) => {
        return REST_API_OHLC_MOCK_DATA;
      });
    const result = await ohlcWorkerService.fetchOhlcDataFromExchange(
      DataProvider.Coinbase,
      Date.now(),
      ethSymbol,
    );
    expect(result).toEqual(REST_API_OHLC_MOCK_DATA);
  });

  it('should return false when trigger checkPriceIsValid function with invalid price', async () => {
    ohlcService.onChainPrice[ethSymbol] = 0;
    const result = await ohlcWorkerService.checkPriceIsValid(
      ethSymbol,
      REST_API_OHLC_MOCK_DATA.close,
    );
    expect(result).toEqual(false);
  });

  it('should return true when trigger checkPriceIsValid function with valid price', async () => {
    ohlcService.onChainPrice[ethSymbol] = REST_API_OHLC_MOCK_DATA.close;
    const result = await ohlcWorkerService.checkPriceIsValid(
      ethSymbol,
      REST_API_OHLC_MOCK_DATA.close,
    );
    expect(result).toEqual(true);
  });

  it('should return true when trigger checkValidOhlcResult function with 3 providers ohlc values', async () => {
    ohlcWorkerService.ohlcResult = VALID_OHLC_RESULT_MOCK_DATA;
    const result = ohlcWorkerService.checkValidOhlcResult();
    expect(result).toEqual(true);
  });

  it('should return false when trigger checkValidOhlcResult function with non ohlc values', async () => {
    ohlcWorkerService.ohlcResult = NON_OHLC_RESULT_MOCK_DATA;
    const result = ohlcWorkerService.checkValidOhlcResult();
    expect(result).toEqual(false);
  });

  it('should return profitable amount when trigger calculateProfitableAmount function with 0 as timeframeId', async () => {
    const signer = new ethers.Wallet(process.env[`PK_${ethSymbol}`], provider);
    const contract = new ethers.Contract(
      CONTRACT_BINARY_MARKETS[ethSymbol],
      BinaryMarketABI,
      signer,
    );
    (Contract.prototype as any).getCurrentRoundId = async (timeframeId) => {
      return 10;
    };
    (Contract.prototype as any).rounds = async (timeframeId, roundId) => {
      return CONTRACT_ROUND_MOCK_DATA;
    };
    const result = await ohlcWorkerService.calculateProfitableAmount(
      contract,
      ethSymbol,
      [0],
      BN_ETH_PRICE_MOCK_DATA,
    );
    expect(result).toEqual(0);
  });

  it('should return profitable amount when trigger calculateProfitableAmount function with 1 as timeframeId', async () => {
    const signer = new ethers.Wallet(process.env[`PK_${ethSymbol}`], provider);
    const contract = new ethers.Contract(
      CONTRACT_BINARY_MARKETS[ethSymbol],
      BinaryMarketABI,
      signer,
    );
    (Contract.prototype as any).getCurrentRoundId = async (timeframeId) => {
      return 10;
    };
    (Contract.prototype as any).rounds = async (timeframeId, roundId) => {
      return CONTRACT_ROUND_MOCK_DATA;
    };
    const result = await ohlcWorkerService.calculateProfitableAmount(
      contract,
      ethSymbol,
      [1],
      BN_ETH_PRICE_MOCK_DATA,
    );
    expect(result).toEqual(0);
  });

  it('should return profitable amount when trigger calculateProfitableAmount function with 2 as timeframeId', async () => {
    const signer = new ethers.Wallet(process.env[`PK_${ethSymbol}`], provider);
    const contract = new ethers.Contract(
      CONTRACT_BINARY_MARKETS[ethSymbol],
      BinaryMarketABI,
      signer,
    );
    (Contract.prototype as any).getCurrentRoundId = async (timeframeId) => {
      return 10;
    };
    (Contract.prototype as any).rounds = async (timeframeId, roundId) => {
      return CONTRACT_ROUND_MOCK_DATA;
    };
    const result = await ohlcWorkerService.calculateProfitableAmount(
      contract,
      ethSymbol,
      [2],
      BN_ETH_PRICE_MOCK_DATA,
    );
    expect(result).toEqual(0);
  });

  it('should return profitable amount when trigger calculateProfitableAmount function with zero price', async () => {
    const signer = new ethers.Wallet(process.env[`PK_${ethSymbol}`], provider);
    const contract = new ethers.Contract(
      CONTRACT_BINARY_MARKETS[ethSymbol],
      BinaryMarketABI,
      signer,
    );
    (Contract.prototype as any).getCurrentRoundId = async (timeframeId) => {
      return 10;
    };
    (Contract.prototype as any).rounds = async (timeframeId, roundId) => {
      return CONTRACT_ROUND_MOCK_DATA;
    };
    const result = await ohlcWorkerService.calculateProfitableAmount(
      contract,
      ethSymbol,
      [2],
      BN_ETH_ZERO_PRICE_MOCK_DATA,
    );
    expect(result).toEqual(0);
  });

  it('should return profitable amount when trigger calculateProfitableAmount function with fail transaction', async () => {
    const signer = new ethers.Wallet(process.env[`PK_${ethSymbol}`], provider);
    const contract = new ethers.Contract(
      CONTRACT_BINARY_MARKETS[ethSymbol],
      BinaryMarketABI,
      signer,
    );
    (Contract.prototype as any).getCurrentRoundId = async (timeframeId) => {
      throw new Error();
    };
    (Contract.prototype as any).rounds = async (timeframeId, roundId) => {
      return CONTRACT_ROUND_MOCK_DATA;
    };
    const result = await ohlcWorkerService.calculateProfitableAmount(
      contract,
      ethSymbol,
      [2],
      BN_ETH_ZERO_PRICE_MOCK_DATA,
    );
    expect(result).toEqual(0);
  });

  it('should return true amount when trigger executeRound function with success transaction', async () => {
    const signer = new ethers.Wallet(process.env[`PK_${ethSymbol}`], provider);
    const contract = new ethers.Contract(
      CONTRACT_BINARY_MARKETS[ethSymbol],
      BinaryMarketABI,
      signer,
    );
    (Contract.prototype as any).executeCurrentRound = () =>
      new Promise((resolve) =>
        resolve({
          wait: () => {
            return new Promise((resolve) => resolve(''));
          },
        }),
      );
    const result = await ohlcWorkerService.executeRound(
      contract,
      ethSymbol,
      [0],
      BN_ETH_PRICE_MOCK_DATA,
    );
    expect(result).toEqual(true);
  });

  it('should return error amount when trigger executeRound function with fail transaction', async () => {
    const signer = new ethers.Wallet(process.env[`PK_${ethSymbol}`], provider);
    const contract = new ethers.Contract(
      CONTRACT_BINARY_MARKETS[ethSymbol],
      BinaryMarketABI,
      signer,
    );
    (Contract.prototype as any).executeCurrentRound = () =>
      new Promise((reject) =>
        reject({
          wait: () => {
            throw new Error(
              `${ethSymbol} executeRound failed in executeRound function`,
            );
          },
        }),
      );
    try {
      await ohlcWorkerService.executeRound(
        contract,
        ethSymbol,
        [0],
        BN_ETH_PRICE_MOCK_DATA,
      );
    } catch (e) {
      expect(e.message).toEqual(
        `${ethSymbol} executeRound failed in executeRound function`,
      );
    }
  });

  it('should return ohlcData when trigger fetchOhlcDataFromExchange with binance provider', async () => {
    jest
      .spyOn(binanceService, 'getOhlcData')
      .mockImplementation(async (time, symbol) => {
        return OHLC_PRICE_MOCK_DATA[DataProvider.Binance][symbol];
      });
    const result = await ohlcWorkerService.fetchOhlcDataFromExchange(
      DataProvider.Binance,
      Date.now(),
      ethSymbol,
    );
    expect(result).toEqual(
      OHLC_PRICE_MOCK_DATA[DataProvider.Binance][ethSymbol],
    );
  });

  it('should return ohlcData when trigger fetchOhlcDataFromExchange with coinbase provider', async () => {
    jest
      .spyOn(coinbaseService, 'getOhlcData')
      .mockImplementation(async (time, symbol) => {
        return OHLC_PRICE_MOCK_DATA[DataProvider.Coinbase][symbol];
      });
    const result = await ohlcWorkerService.fetchOhlcDataFromExchange(
      DataProvider.Coinbase,
      Date.now(),
      ethSymbol,
    );
    expect(result).toEqual(
      OHLC_PRICE_MOCK_DATA[DataProvider.Coinbase][ethSymbol],
    );
  });

  it('should return ohlcData when trigger fetchOhlcDataFromExchange with kraken provider', async () => {
    jest
      .spyOn(krakenService, 'getOhlcData')
      .mockImplementation(async (time, symbol) => {
        return OHLC_PRICE_MOCK_DATA[DataProvider.Kraken][symbol];
      });
    const result = await ohlcWorkerService.fetchOhlcDataFromExchange(
      DataProvider.Kraken,
      Date.now(),
      ethSymbol,
    );
    expect(result).toEqual(
      OHLC_PRICE_MOCK_DATA[DataProvider.Kraken][ethSymbol],
    );
  });

  it('should save ohlc data bindOhlcDataFromExchange function with false as isForMissing', async () => {
    ohlcWorkerService.ohlcResult = OHLC_PRICE_MOCK_DATA;
    jest
      .spyOn(ohlcWorkerService, 'fetchOhlcDataFromExchange')
      .mockImplementation(async (provider, time, symbol) => {
        const defaultSymbol =
          SYMBOLS[DataProvider.Default][SYMBOLS[provider].indexOf(symbol)];
        return OHLC_PRICE_MOCK_DATA[provider][defaultSymbol];
      });
    expect(
      await ohlcWorkerService.bindOhlcDataFromExchange(Date.now(), false),
    ).toEqual(true);
  });

  it('should save ohlc data bindOhlcDataFromExchange function with false as isForMissing and error provider value(wrong timestamp)', async () => {
    ohlcWorkerService.ohlcResult = OHLC_PRICE_MOCK_DATA;
    ohlcWorkerService.dataProviderStatuses = [];
    jest
      .spyOn(ohlcWorkerService, 'fetchOhlcDataFromExchange')
      .mockImplementation(async (provider, time, symbol) => {
        const defaultSymbol =
          SYMBOLS[DataProvider.Default][SYMBOLS[provider].indexOf(symbol)];
        const prevMinute =
          OHLC_PRICE_MOCK_DATA[provider][defaultSymbol].time - MINUTE;
        return {
          ...OHLC_PRICE_MOCK_DATA[provider][defaultSymbol],
          time: prevMinute,
        };
      });
    expect(
      await ohlcWorkerService.bindOhlcDataFromExchange(Date.now(), false),
    ).toEqual(true);
  });

  it('should save ohlc data when trigger bindOhlcDataFromExchange function with true as isForMissing', async () => {
    jest
      .spyOn(ohlcWorkerService, 'fetchOhlcDataFromExchange')
      .mockImplementation(async (provider, time, symbol) => {
        const defaultSymbol =
          SYMBOLS[DataProvider.Default][SYMBOLS[provider].indexOf(symbol)];
        return OHLC_PRICE_MOCK_DATA[provider][defaultSymbol];
      });
    expect(
      await ohlcWorkerService.bindOhlcDataFromExchange(Date.now(), true),
    ).toEqual(true);
  });

  it('should set data provider status when trigger bindOhlcDataFromExchange function with false as isForMissing', async () => {
    jest
      .spyOn(ohlcWorkerService, 'fetchOhlcDataFromExchange')
      .mockImplementation(async (provider, time, symbol) => {
        throw new Error();
      });
    expect(
      await ohlcWorkerService.bindOhlcDataFromExchange(Date.now(), false),
    ).toEqual(true);
  });

  it('should set data provider status when trigger bindOhlcDataFromExchange function with true as isForMissing', async () => {
    jest
      .spyOn(ohlcWorkerService, 'fetchOhlcDataFromExchange')
      .mockImplementation(async (provider, time, symbol) => {
        throw new Error();
      });
    expect(
      await ohlcWorkerService.bindOhlcDataFromExchange(Date.now(), true),
    ).toEqual(true);
  });

  it('should return default ohlc data when trigger saveDefaultOhlcRecord function with valid prev Ohlc', async () => {
    const currentMinute = getCurrentMinute();
    jest
      .spyOn(ohlcService, 'getDefaultOhlc')
      .mockImplementation(async (symbol, time) => {
        if (time === currentMinute - MINUTE) {
          return OHLC_HISTORY_MOCK_DATA.data[0];
        } else {
          return null;
        }
      });
    jest.spyOn(ohlcService, 'save').mockImplementation(async (ohlc: Ohlc) => {
      return ohlc;
    });
    const result = await ohlcWorkerService.saveDefaultOhlcRecord(
      ethSymbol,
      currentMinute,
      TOTAL_OHLC_MOCK_DATA.open,
      TOTAL_OHLC_MOCK_DATA.high,
      TOTAL_OHLC_MOCK_DATA.low,
      TOTAL_OHLC_MOCK_DATA.close,
      TOTAL_OHLC_MOCK_DATA.volume,
      true,
    );
    expect(result.volume).toEqual(
      DEFAULT_OHLC_RECORD_VALID_PREV_MOCK_DATA.volume,
    );
  });

  it('should return default ohlc data when trigger saveDefaultOhlcRecord function with valid next Ohlc', async () => {
    const currentMinute = getCurrentMinute();
    jest
      .spyOn(ohlcService, 'getDefaultOhlc')
      .mockImplementation(async (symbol, time) => {
        if (time === currentMinute + MINUTE) {
          return OHLC_HISTORY_MOCK_DATA.data[0];
        } else {
          return null;
        }
      });
    jest.spyOn(ohlcService, 'save').mockImplementation(async (ohlc: Ohlc) => {
      return ohlc;
    });
    ohlcWorkerService.ohlcResult = OHLC_PRICE_MOCK_DATA;
    const result = await ohlcWorkerService.saveDefaultOhlcRecord(
      ethSymbol,
      currentMinute,
      TOTAL_OHLC_MOCK_DATA.open,
      TOTAL_OHLC_MOCK_DATA.high,
      TOTAL_OHLC_MOCK_DATA.low,
      TOTAL_OHLC_MOCK_DATA.close,
      TOTAL_OHLC_MOCK_DATA.volume,
      true,
      true,
    );
    expect(result.volume).toEqual(
      DEFAULT_OHLC_RECORD_VALID_PREV_MOCK_DATA.volume,
    );
  });

  it('should return null when trigger saveDefaultOhlcRecord function due to parentPort', async () => {
    const currentMinute = getCurrentMinute();
    jest
      .spyOn(ohlcService, 'getDefaultOhlc')
      .mockImplementation(async (symbol, time) => {
        if (time === currentMinute + MINUTE) {
          return OHLC_HISTORY_MOCK_DATA.data[0];
        } else {
          return null;
        }
      });
    jest.spyOn(ohlcService, 'save').mockImplementation(async (ohlc: Ohlc) => {
      return ohlc;
    });
    const result = await ohlcWorkerService.saveDefaultOhlcRecord(
      ethSymbol,
      currentMinute,
      TOTAL_OHLC_MOCK_DATA.open,
      TOTAL_OHLC_MOCK_DATA.high,
      TOTAL_OHLC_MOCK_DATA.low,
      TOTAL_OHLC_MOCK_DATA.close,
      TOTAL_OHLC_MOCK_DATA.volume,
    );
    expect(result).toEqual(null);
  });

  it('should return cloned default ohlc data when trigger clonePrevDefaultOhlcRecord function', async () => {
    const currentMinute = getCurrentMinute();
    jest
      .spyOn(ohlcService, 'getDefaultOhlc')
      .mockImplementation(async (symbol, time) => {
        return OHLC_HISTORY_MOCK_DATA.data[0];
      });
    jest.spyOn(ohlcService, 'save').mockImplementation(async (ohlc: Ohlc) => {
      return ohlc;
    });
    const result = await ohlcWorkerService.clonePrevDefaultOhlcRecord(
      ethSymbol,
      currentMinute,
      true,
    );
    expect(result.volume).toEqual(
      CLONED_OHLC_RECORD_VALID_PREV_MOCK_DATA.volume,
    );
  });

  it('should return cloned default ohlc data when trigger clonePrevDefaultOhlcRecord function with second prev ohlc data', async () => {
    const currentMinute = getCurrentMinute();
    jest
      .spyOn(ohlcService, 'getDefaultOhlc')
      .mockImplementation(async (symbol, time) => {
        if (time === currentMinute - 2 * MINUTE) {
          return OHLC_HISTORY_MOCK_DATA.data[0];
        } else {
          throw Error();
        }
      });
    jest.spyOn(ohlcService, 'save').mockImplementation(async (ohlc: Ohlc) => {
      return ohlc;
    });
    const result = await ohlcWorkerService.clonePrevDefaultOhlcRecord(
      ethSymbol,
      currentMinute,
      true,
    );
    expect(result.volume).toEqual(
      CLONED_OHLC_RECORD_VALID_PREV_MOCK_DATA.volume,
    );
  });

  it('should return null when trigger clonePrevDefaultOhlcRecord function', async () => {
    const currentMinute = getCurrentMinute();
    jest
      .spyOn(ohlcService, 'getDefaultOhlc')
      .mockImplementation(async (symbol, time) => {
        return OHLC_HISTORY_MOCK_DATA.data[0];
      });
    jest.spyOn(ohlcService, 'save').mockImplementation(async (ohlc: Ohlc) => {
      return ohlc;
    });
    const result = await ohlcWorkerService.clonePrevDefaultOhlcRecord(
      ethSymbol,
      currentMinute,
      false,
    );
    expect(result).toEqual(null);
  });

  it('should check addMissingOhlc function', async () => {
    repositoryMock.find.mockReturnValue(FIND_MISSING_OHLC_OUTPUT_MOCK_DATA);
    jest
      .spyOn(ohlcWorkerService, 'bindOhlcDataFromExchange')
      .mockImplementation(async (time, isForMissing) => {
        if (isForMissing) {
          ohlcWorkerService.missingOhlcResult = VALID_OHLC_RESULT_MOCK_DATA;
        } else {
          ohlcWorkerService.ohlcResult = VALID_OHLC_RESULT_MOCK_DATA;
        }
        return true;
      });

    jest
      .spyOn(ohlcWorkerService, 'saveExchangeOhlcRecord')
      .mockImplementation(async (symbol, isForMissing) => {
        return TOTAL_OHLC_MOCK_DATA;
      });

    jest
      .spyOn(ohlcWorkerService, 'saveDefaultOhlcRecord')
      .mockImplementation(
        async (
          symbol,
          time,
          open,
          high,
          low,
          close,
          volume,
          isMissingOhlc,
          lastIndex,
        ) => {
          return OHLC_HISTORY_MOCK_DATA.data[0];
        },
      );
    const result = await ohlcWorkerService.addMissingOhlc();
    expect(result).toEqual(true);
  });

  it('should check addMissingOhlc function with zero as total volume', async () => {
    repositoryMock.find.mockReturnValue(FIND_MISSING_OHLC_OUTPUT_MOCK_DATA);
    jest
      .spyOn(ohlcWorkerService, 'bindOhlcDataFromExchange')
      .mockImplementation(async (time, isForMissing) => {
        if (isForMissing) {
          ohlcWorkerService.missingOhlcResult = VALID_OHLC_RESULT_MOCK_DATA;
        } else {
          ohlcWorkerService.ohlcResult = VALID_OHLC_RESULT_MOCK_DATA;
        }
        return true;
      });

    jest
      .spyOn(ohlcWorkerService, 'saveExchangeOhlcRecord')
      .mockImplementation(async (symbol, isForMissing) => {
        return { ...TOTAL_OHLC_MOCK_DATA, volume: 0 };
      });

    ohlcWorkerService.missingOhlcResult = VALID_OHLC_RESULT_MOCK_DATA;
    jest
      .spyOn(ohlcWorkerService, 'saveDefaultOhlcRecord')
      .mockImplementation(
        async (
          symbol,
          time,
          open,
          high,
          low,
          close,
          volume,
          isMissingOhlc,
          lastIndex,
        ) => {
          return OHLC_HISTORY_MOCK_DATA.data[0];
        },
      );
    const result = await ohlcWorkerService.addMissingOhlc();
    expect(result).toEqual(true);
  });

  it('should check addMissingOhlc function with all data providers error', async () => {
    repositoryMock.find.mockReturnValue(FIND_MISSING_OHLC_OUTPUT_MOCK_DATA);
    jest
      .spyOn(ohlcWorkerService, 'bindOhlcDataFromExchange')
      .mockImplementation(async (time, isForMissing) => {
        if (isForMissing) {
          ohlcWorkerService.missingOhlcResult = VALID_OHLC_RESULT_MOCK_DATA;
        } else {
          ohlcWorkerService.ohlcResult = VALID_OHLC_RESULT_MOCK_DATA;
        }
        return true;
      });

    jest
      .spyOn(ohlcWorkerService, 'saveExchangeOhlcRecord')
      .mockImplementation(async (symbol, isForMissing) => {
        return { ...TOTAL_OHLC_MOCK_DATA, volume: 0 };
      });

    ohlcWorkerService.dataProviderStatuses = [
      DataProvider.Binance,
      DataProvider.Coinbase,
      DataProvider.Kraken,
    ];
    jest
      .spyOn(ohlcWorkerService, 'clonePrevDefaultOhlcRecord')
      .mockImplementation(async (symbol, time, isMissingOhlc) => {
        return OHLC_HISTORY_MOCK_DATA.data[0];
      });
    const result = await ohlcWorkerService.addMissingOhlc();
    expect(result).toEqual(true);
  });

  it('should check addMissingOhlc function with clonePrevDefaultOhlcRecord error', async () => {
    repositoryMock.find.mockReturnValue(FIND_MISSING_OHLC_OUTPUT_MOCK_DATA);
    jest
      .spyOn(ohlcWorkerService, 'bindOhlcDataFromExchange')
      .mockImplementation(async (time, isForMissing) => {
        if (isForMissing) {
          ohlcWorkerService.missingOhlcResult = VALID_OHLC_RESULT_MOCK_DATA;
        } else {
          ohlcWorkerService.ohlcResult = VALID_OHLC_RESULT_MOCK_DATA;
        }
        return true;
      });

    jest
      .spyOn(ohlcWorkerService, 'saveExchangeOhlcRecord')
      .mockImplementation(async (symbol, isForMissing) => {
        return { ...TOTAL_OHLC_MOCK_DATA, volume: 0 };
      });

    ohlcWorkerService.dataProviderStatuses = [
      DataProvider.Binance,
      DataProvider.Coinbase,
      DataProvider.Kraken,
    ];
    jest
      .spyOn(ohlcWorkerService, 'clonePrevDefaultOhlcRecord')
      .mockImplementation(async (symbol, time, isMissingOhlc) => {
        throw Error();
      });
    const result = await ohlcWorkerService.addMissingOhlc();
    expect(result).toEqual(true);
  });

  it('should check runDataProvider function', async () => {
    repositoryMock.find.mockReturnValue(FIND_MISSING_OHLC_OUTPUT_MOCK_DATA);
    jest
      .spyOn(ohlcWorkerService, 'addMissingOhlc')
      .mockImplementation(async () => {
        return true;
      });
    jest
      .spyOn(ohlcWorkerService, 'bindOhlcDataFromExchange')
      .mockImplementation(async () => {
        ohlcWorkerService.ohlcResult = VALID_OHLC_RESULT_MOCK_DATA;
        ohlcWorkerService.missingOhlcResult = VALID_OHLC_RESULT_MOCK_DATA;
        return true;
      });
    jest
      .spyOn(ohlcWorkerService, 'saveExchangeOhlcRecord')
      .mockImplementation(async (symbol, isForMissing) => {
        return { ...TOTAL_OHLC_MOCK_DATA };
      });

    jest
      .spyOn(ohlcWorkerService, 'saveDefaultOhlcRecord')
      .mockImplementation(
        async (
          symbol,
          time,
          open,
          high,
          low,
          close,
          volume,
          isMissingOhlc,
          lastIndex,
        ) => {
          return OHLC_HISTORY_MOCK_DATA.data[0];
        },
      );

    jest
      .spyOn(ohlcService, 'getPrice')
      .mockImplementation(async ({ symbol, time }) => {
        if (symbol === ethSymbol) {
          return VALID_OHLC_RESULT_MOCK_DATA[DataProvider.Binance][
            SYMBOLS[DataProvider.Default][1]
          ].close;
        } else {
          return VALID_OHLC_RESULT_MOCK_DATA[DataProvider.Binance][
            SYMBOLS[DataProvider.Default][0]
          ].close;
        }
      });
    jest
      .spyOn(ohlcWorkerService, 'checkPriceIsValid')
      .mockImplementation(async (symbol, price) => {
        return true;
      });
    const result = await ohlcWorkerService.runDataProvider(true);
    expect(result).toEqual(true);
  });

  it('should check runDataProvider function with zero value as total volume', async () => {
    repositoryMock.find.mockReturnValue(FIND_MISSING_OHLC_OUTPUT_MOCK_DATA);
    jest
      .spyOn(ohlcWorkerService, 'addMissingOhlc')
      .mockImplementation(async () => {
        return true;
      });
    jest
      .spyOn(ohlcWorkerService, 'bindOhlcDataFromExchange')
      .mockImplementation(async () => {
        ohlcWorkerService.ohlcResult = VALID_OHLC_RESULT_MOCK_DATA;
        ohlcWorkerService.missingOhlcResult = VALID_OHLC_RESULT_MOCK_DATA;
        return true;
      });
    jest
      .spyOn(ohlcWorkerService, 'saveExchangeOhlcRecord')
      .mockImplementation(async (symbol, isForMissing) => {
        return { ...TOTAL_OHLC_MOCK_DATA, volume: 0 };
      });

    jest
      .spyOn(ohlcWorkerService, 'saveDefaultOhlcRecord')
      .mockImplementation(
        async (
          symbol,
          time,
          open,
          high,
          low,
          close,
          volume,
          isMissingOhlc,
          lastIndex,
        ) => {
          return OHLC_HISTORY_MOCK_DATA.data[0];
        },
      );

    jest
      .spyOn(ohlcService, 'getPrice')
      .mockImplementation(async ({ symbol, time }) => {
        if (symbol === ethSymbol) {
          return VALID_OHLC_RESULT_MOCK_DATA[DataProvider.Binance][
            SYMBOLS[DataProvider.Default][1]
          ].close;
        } else {
          return VALID_OHLC_RESULT_MOCK_DATA[DataProvider.Binance][
            SYMBOLS[DataProvider.Default][0]
          ].close;
        }
      });
    jest
      .spyOn(ohlcWorkerService, 'checkPriceIsValid')
      .mockImplementation(async (symbol, price) => {
        return true;
      });
    const result = await ohlcWorkerService.runDataProvider(true);
    expect(result).toEqual(true);
  });

  it('should check runDataProvider function with all data providers error', async () => {
    repositoryMock.find.mockReturnValue(FIND_MISSING_OHLC_OUTPUT_MOCK_DATA);
    jest
      .spyOn(ohlcWorkerService, 'addMissingOhlc')
      .mockImplementation(async () => {
        return true;
      });
    jest
      .spyOn(ohlcWorkerService, 'bindOhlcDataFromExchange')
      .mockImplementation(async () => {
        ohlcWorkerService.ohlcResult = VALID_OHLC_RESULT_MOCK_DATA;
        ohlcWorkerService.missingOhlcResult = VALID_OHLC_RESULT_MOCK_DATA;
        return true;
      });
    ohlcWorkerService.dataProviderStatuses = [
      DataProvider.Binance,
      DataProvider.Coinbase,
      DataProvider.Kraken,
    ];
    jest
      .spyOn(ohlcWorkerService, 'saveExchangeOhlcRecord')
      .mockImplementation(async (symbol, isForMissing) => {
        return { ...TOTAL_OHLC_MOCK_DATA, volume: 0 };
      });

    jest
      .spyOn(ohlcWorkerService, 'clonePrevDefaultOhlcRecord')
      .mockImplementation(async (symbol, time, isMissingOhlc) => {
        return OHLC_HISTORY_MOCK_DATA.data[0];
      });
    const result = await ohlcWorkerService.runDataProvider(true);
    expect(result).toEqual(true);
  });

  it('should check runDataProvider function with clonePrevDefaultOhlcRecord error', async () => {
    repositoryMock.find.mockReturnValue(FIND_MISSING_OHLC_OUTPUT_MOCK_DATA);
    jest
      .spyOn(ohlcWorkerService, 'addMissingOhlc')
      .mockImplementation(async () => {
        return true;
      });
    jest
      .spyOn(ohlcWorkerService, 'bindOhlcDataFromExchange')
      .mockImplementation(async () => {
        const currentSecond = new Date().getSeconds();
        if (currentSecond > 15 && currentSecond < 30)
          ohlcWorkerService.ohlcResult = VALID_OHLC_RESULT_MOCK_DATA;
        ohlcWorkerService.missingOhlcResult = VALID_OHLC_RESULT_MOCK_DATA;
        return true;
      });
    ohlcWorkerService.dataProviderStatuses = [
      DataProvider.Binance,
      DataProvider.Coinbase,
      DataProvider.Kraken,
    ];
    jest
      .spyOn(ohlcWorkerService, 'saveExchangeOhlcRecord')
      .mockImplementation(async (symbol, isForMissing) => {
        return { ...TOTAL_OHLC_MOCK_DATA, volume: 0 };
      });

    jest
      .spyOn(ohlcWorkerService, 'clonePrevDefaultOhlcRecord')
      .mockImplementation(async (symbol, time, isMissingOhlc) => {
        throw Error();
      });
    const result = await ohlcWorkerService.runDataProvider(true);
    expect(result).toEqual(true);
  });

  it('should check runDataProvider function with bindOhlcDataFromExchange error', async () => {
    repositoryMock.find.mockReturnValue(FIND_MISSING_OHLC_OUTPUT_MOCK_DATA);
    jest
      .spyOn(ohlcWorkerService, 'addMissingOhlc')
      .mockImplementation(async () => {
        return true;
      });
    jest
      .spyOn(ohlcWorkerService, 'bindOhlcDataFromExchange')
      .mockImplementation(async () => {
        throw Error();
      });
    const result = await ohlcWorkerService.runDataProvider(true);
    expect(result).toEqual(true);
  });

  it('should check writePriceToContract function with in 10 seconds', async () => {
    (Contract.prototype as any).getExecutableTimeframes = () => {
      return [0];
    };
    await sleep((60 - new Date().getSeconds()) * SECOND);
    await ohlcWorkerService.writePriceToContract(
      ethSymbol,
      OHLC_PRICE_MOCK_DATA[DataProvider.Binance][ethSymbol].close,
    );
  });

  it('should check writePriceToContract function with binance provider error', async () => {
    (Contract.prototype as any).getExecutableTimeframes = () => {
      return [0];
    };
    ohlcWorkerService.dataProviderStatuses = [DataProvider.Binance];
    jest
      .spyOn(ohlcWorkerService, 'calculateProfitableAmount')
      .mockImplementation(async (contract, symbol, timeframes, bnPrice) => {
        return 0;
      });
    await ohlcWorkerService.writePriceToContract(
      ethSymbol,
      OHLC_PRICE_MOCK_DATA[DataProvider.Binance][ethSymbol].close,
    );
  });

  it('should check writePriceToContract function with binance provider error and calculateProfitableAmount below 0', async () => {
    (Contract.prototype as any).getExecutableTimeframes = () => {
      return [0];
    };
    ohlcWorkerService.dataProviderStatuses = [DataProvider.Binance];
    jest
      .spyOn(ohlcWorkerService, 'calculateProfitableAmount')
      .mockImplementation(async (contract, symbol, timeframes, bnPrice) => {
        return -1;
      });
    await ohlcWorkerService.writePriceToContract(
      ethSymbol,
      OHLC_PRICE_MOCK_DATA[DataProvider.Binance][ethSymbol].close,
    );
  });

  it('should check writePriceToContract function with binance provider error and calculateProfitableAmount below 0', async () => {
    await sleep(10 * SECOND);
    (Contract.prototype as any).getExecutableTimeframes = () => {
      return [0];
    };
    ohlcWorkerService.dataProviderStatuses = [DataProvider.Binance];
    jest
      .spyOn(ohlcWorkerService, 'calculateProfitableAmount')
      .mockImplementation(async (contract, symbol, timeframes, bnPrice) => {
        return -1;
      });
    await ohlcWorkerService.writePriceToContract(
      ethSymbol,
      OHLC_PRICE_MOCK_DATA[DataProvider.Binance][ethSymbol].close,
    );
  });

  it('should check writePriceToContract function with all providers error', async () => {
    (Contract.prototype as any).getExecutableTimeframes = () => {
      return [0];
    };
    ohlcWorkerService.dataProviderStatuses = [
      DataProvider.Binance,
      DataProvider.Kraken,
      DataProvider.Coinbase,
    ];
    await ohlcWorkerService.writePriceToContract(
      ethSymbol,
      OHLC_PRICE_MOCK_DATA[DataProvider.Binance][ethSymbol].close,
    );
  });

  it('should check writePriceToContract function with timeframes error', async () => {
    (Contract.prototype as any).getExecutableTimeframes = () => {
      throw Error();
    };
    await ohlcWorkerService.writePriceToContract(
      ethSymbol,
      OHLC_PRICE_MOCK_DATA[DataProvider.Binance][ethSymbol].close,
    );
  });

  it('should return total ohlc data when trigger saveExchangeOhlcRecord function', async () => {
    jest.spyOn(ohlcService, 'save').mockImplementation(async (ohlc: Ohlc) => {
      return ohlc;
    });
    ohlcWorkerService.ohlcResult = OHLC_PRICE_MOCK_DATA;
    const result = await ohlcWorkerService.saveExchangeOhlcRecord(ethSymbol);
    expect(result).toEqual(TOTAL_OHLC_MOCK_DATA);
  });

  it('should return total ohlc data when trigger saveExchangeOhlcRecord function with exception', async () => {
    jest.spyOn(ohlcService, 'save').mockImplementation(async (ohlc: Ohlc) => {
      throw Error();
    });
    ohlcWorkerService.ohlcResult = OHLC_PRICE_MOCK_DATA;
    const result = await ohlcWorkerService.saveExchangeOhlcRecord(ethSymbol);
    expect(result).toEqual(TOTAL_OHLC_MOCK_DATA);
  });
});
