import { Test, TestingModule } from '@nestjs/testing';
import { HttpService } from '@nestjs/axios';
import { of, throwError } from 'rxjs';
import * as nock from 'nock';

import { KrakenOhlcService } from './kraken.ohlc.service';
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
import { MINUTE, SECOND } from '../../core/constants/base.constant';

describe('Test Kraken Ohlc Service', () => {
  let service: KrakenOhlcService;
  const httpService = {
    get: jest.fn(),
    post: jest.fn().mockImplementation(() => of({ data: {} })),
  };

  const currentMinute = getCurrentMinute();
  const btcSymbol = SYMBOLS[DataProvider.Kraken][0];
  const ethSymbol = SYMBOLS[DataProvider.Kraken][1];

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        { provide: HttpService, useValue: httpService },
        KrakenOhlcService,
      ],
    }).compile();

    service = module.get<KrakenOhlcService>(KrakenOhlcService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should do return error when the btc response is empty', async () => {
    jest.spyOn(httpService, 'get').mockReturnValue(
      of({
        data: OHLC_REST_API_MOCK_DATA[SYMBOLS[DataProvider.Default][0]][
          DataProvider.Kraken
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
        expectedErrorMessage(DataProvider.Kraken, currentMinute, btcSymbol),
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
                DataProvider.Kraken
              ][RestApiOhlcResponseType.RequestFailed],
            ),
        ),
      );
    try {
      await service.getOhlcPrice(currentMinute, ethSymbol);
    } catch (e) {
      expect(e.message).toEqual(
        expectedErrorMessage(DataProvider.Kraken, currentMinute, ethSymbol),
      );
    }
  });

  it('should return error if the btc request is rate limited', async () => {
    const mockUrl = `/0/public/OHLC?interval=1&pair=${btcSymbol}&since=${
      (currentMinute - MINUTE) / SECOND
    }`;
    nock('https://api.kraken.com')
      .get(mockUrl)
      .reply(
        OHLC_REST_API_MOCK_DATA[SYMBOLS[DataProvider.Default][0]][
          DataProvider.Kraken
        ][RestApiOhlcResponseType.RateLimited],
      );
    try {
      await service.getOhlcPrice(currentMinute, btcSymbol);
    } catch (e) {
      expect(e.message).toEqual(
        expectedErrorMessage(
          DataProvider.Kraken,
          currentMinute,
          btcSymbol.replace('XBT', 'BTC'),
        ),
      );
    }
  });

  it('should return response of btc if the request is succeed', async () => {
    jest.spyOn(httpService, 'get').mockReturnValue(
      of({
        data: OHLC_REST_API_MOCK_DATA[SYMBOLS[DataProvider.Default][0]][
          DataProvider.Kraken
        ][RestApiOhlcResponseType.Success],
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {},
      }),
    );
    const expectedResult = {
      time:
        Number(
          OHLC_REST_API_MOCK_DATA[SYMBOLS[DataProvider.Default][0]][
            DataProvider.Kraken
          ][RestApiOhlcResponseType.Success].result[
            btcSymbol.replace('XBT', 'BTC')
          ][0][0],
        ) *
          SECOND -
        MINUTE,
      open: Number(
        OHLC_REST_API_MOCK_DATA[SYMBOLS[DataProvider.Default][0]][
          DataProvider.Kraken
        ][RestApiOhlcResponseType.Success].result[
          btcSymbol.replace('XBT', 'BTC')
        ][0][1],
      ),
      high: Number(
        OHLC_REST_API_MOCK_DATA[SYMBOLS[DataProvider.Default][0]][
          DataProvider.Kraken
        ][RestApiOhlcResponseType.Success].result[
          btcSymbol.replace('XBT', 'BTC')
        ][0][2],
      ),
      low: Number(
        OHLC_REST_API_MOCK_DATA[SYMBOLS[DataProvider.Default][0]][
          DataProvider.Kraken
        ][RestApiOhlcResponseType.Success].result[
          btcSymbol.replace('XBT', 'BTC')
        ][0][3],
      ),
      close: Number(
        OHLC_REST_API_MOCK_DATA[SYMBOLS[DataProvider.Default][0]][
          DataProvider.Kraken
        ][RestApiOhlcResponseType.Success].result[
          btcSymbol.replace('XBT', 'BTC')
        ][0][4],
      ),
      volume: Number(
        OHLC_REST_API_MOCK_DATA[SYMBOLS[DataProvider.Default][0]][
          DataProvider.Kraken
        ][RestApiOhlcResponseType.Success].result[
          btcSymbol.replace('XBT', 'BTC')
        ][0][6],
      ),
    };
    const result = await service.getOhlcPrice(getCurrentMinute(), btcSymbol);
    expect(result).toEqual(expectedResult);
  });

  it('should return error if the eth request is invalid', async () => {
    jest.spyOn(httpService, 'get').mockReturnValue(
      of({
        data: OHLC_REST_API_MOCK_DATA[SYMBOLS[DataProvider.Default][1]][
          DataProvider.Kraken
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
        expectedErrorMessage(DataProvider.Kraken, currentMinute, ethSymbol),
      );
    }
  });
});
