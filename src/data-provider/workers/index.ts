import { NestFactory } from '@nestjs/core';
import { parentPort } from 'worker_threads';

import { exit } from 'process';

import { DataProviderModule } from '../data-provider.module';
import { BinanceService } from '../binance/binance.service';
import { KrakenService } from '../kraken/kraken.service';
import { OhlcService } from '../../ohlc/ohlc.service';
import { OhlcWorkerService } from './ohlc-worker.service';
import { OKXService } from '../okx/okx.service';
import { ByBitService } from '../bybit/bybit.service';

async function run() {
  const app = await NestFactory.createApplicationContext(DataProviderModule);
  const binanceService = app.get(BinanceService);
  const krakenService = app.get(KrakenService);
  const ohlcService = app.get(OhlcService);
  const okxService = app.get(OKXService);
  const bybitService = app.get(ByBitService);
  const ohlcWorkerService = new OhlcWorkerService(
    binanceService,
    krakenService,
    okxService,
    bybitService,
    ohlcService,
  );

  async function runDataProvider(): Promise<void> {
    await ohlcWorkerService.runDataProvider();
  }

  parentPort.postMessage(await runDataProvider());
  exit();
}

run().then();
