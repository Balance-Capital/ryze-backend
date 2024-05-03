import { Test, TestingModule } from '@nestjs/testing';
import { HttpService } from '@nestjs/axios';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { of, throwError } from 'rxjs';
import * as nock from 'nock';

import { OhlcService } from '../../ohlc/ohlc.service';
import { BinanceOhlcService } from './binance.ohlc.service';
import {
  expectedErrorMessage,
  getCurrentMinute,
} from '../../core/utils/base.util';
import {
  DataProvider,
  RestApiOhlcResponseType,
} from '../../core/enums/base.enum';
import { SYMBOLS } from '../../core/constants/config.constant';
import { OHLC_REST_API_MOCK_DATA } from '../../core/constants/mock-data.constant';
import { MockType } from '../../core/types/mock.type';
import { Ohlc } from '../../ohlc/entities/ohlc.entity';

describe('Test Binance Ohlc Service', () => {
  let service: BinanceOhlcService;
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

  const currentMinute = getCurrentMinute();
  const btcSymbol = SYMBOLS[DataProvider.Binance][0];
  const ethSymbol = SYMBOLS[DataProvider.Binance][1];

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        {
          provide: getRepositoryToken(Ohlc),
          useFactory: repositoryMockFactory,
        },
        { provide: HttpService, useValue: httpService },
        OhlcService,
        BinanceOhlcService,
      ],
    }).compile();

    service = module.get<BinanceOhlcService>(BinanceOhlcService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should do return error when the btc response is empty', async () => {
    jest.spyOn(httpService, 'get').mockReturnValue(
      of({
        data: OHLC_REST_API_MOCK_DATA[SYMBOLS[DataProvider.Default][0]][
          DataProvider.Binance
        ][RestApiOhlcResponseType.EmptyResponse],
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {},
      }),
    );
    try {
      await service.getOhlcPrice(currentMinute, btcSymbol);
    } catch (e) {
      expect(e.message).toEqual(
        expectedErrorMessage(DataProvider.Binance, currentMinute, btcSymbol),
      );
    }
  });

  it('should return error if the eth request failed', async () => {
    jest
      .spyOn(httpService, 'get')
      .mockReturnValue(
        throwError(
          () =>
            new Error(
              OHLC_REST_API_MOCK_DATA[SYMBOLS[DataProvider.Default][1]][
                DataProvider.Binance
              ][RestApiOhlcResponseType.RequestFailed],
            ),
        ),
      );
    try {
      await service.getOhlcPrice(currentMinute, ethSymbol);
    } catch (e) {
      expect(e.message).toEqual(
        expectedErrorMessage(DataProvider.Binance, currentMinute, ethSymbol),
      );
    }
  });

  it('should return error if the btc request is rate limited', async () => {
    const mockUrl = `/api/v3/klines?interval=1m&limit=1&symbol=${btcSymbol}&endTime=${
      currentMinute - 1
    }`;
    nock('https://api.binance.com')
      .get(mockUrl)
      .reply(
        OHLC_REST_API_MOCK_DATA[SYMBOLS[DataProvider.Default][0]][
          DataProvider.Binance
        ][RestApiOhlcResponseType.RateLimited],
      );
    try {
      await service.getOhlcPrice(currentMinute, btcSymbol);
    } catch (e) {
      expect(e.message).toEqual(
        expectedErrorMessage(DataProvider.Binance, currentMinute, btcSymbol),
      );
    }
  });

  it('should return response of btc if the request is succeed', async () => {
    jest.spyOn(httpService, 'get').mockReturnValue(
      of({
        data: OHLC_REST_API_MOCK_DATA[SYMBOLS[DataProvider.Default][0]][
          DataProvider.Binance
        ][RestApiOhlcResponseType.Success],
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {},
      }),
    );
    const expectedResult = {
      time: Number(
        OHLC_REST_API_MOCK_DATA[SYMBOLS[DataProvider.Default][0]][
          DataProvider.Binance
        ][RestApiOhlcResponseType.Success][0][0],
      ),
      open: Number(
        OHLC_REST_API_MOCK_DATA[SYMBOLS[DataProvider.Default][0]][
          DataProvider.Binance
        ][RestApiOhlcResponseType.Success][0][1],
      ),
      high: Number(
        OHLC_REST_API_MOCK_DATA[SYMBOLS[DataProvider.Default][0]][
          DataProvider.Binance
        ][RestApiOhlcResponseType.Success][0][2],
      ),
      low: Number(
        OHLC_REST_API_MOCK_DATA[SYMBOLS[DataProvider.Default][0]][
          DataProvider.Binance
        ][RestApiOhlcResponseType.Success][0][3],
      ),
      close: Number(
        OHLC_REST_API_MOCK_DATA[SYMBOLS[DataProvider.Default][0]][
          DataProvider.Binance
        ][RestApiOhlcResponseType.Success][0][4],
      ),
      volume: Number(
        OHLC_REST_API_MOCK_DATA[SYMBOLS[DataProvider.Default][0]][
          DataProvider.Binance
        ][RestApiOhlcResponseType.Success][0][5],
      ),
    };
    const result = await service.getOhlcPrice(getCurrentMinute(), btcSymbol);
    expect(result).toEqual(expectedResult);
  });

  it('should return error if the eth request is invalid', async () => {
    jest.spyOn(httpService, 'get').mockReturnValue(
      of({
        data: OHLC_REST_API_MOCK_DATA[SYMBOLS[DataProvider.Default][1]][
          DataProvider.Binance
        ][RestApiOhlcResponseType.InvalidResponse],
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {},
      }),
    );
    try {
      await service.getOhlcPrice(currentMinute, ethSymbol);
    } catch (e) {
      expect(e.message).toEqual(
        expectedErrorMessage(DataProvider.Binance, currentMinute, ethSymbol),
      );
    }
  });
});
