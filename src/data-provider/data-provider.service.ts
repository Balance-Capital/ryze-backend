import { Logger } from '@nestjs/common';
import { Worker } from 'worker_threads';

import { SocketGateway } from '../socket/socket.gateway';

export class DataProviderService {
  private readonly logger = new Logger(DataProviderService.name);
  private worker: Worker;
  constructor(private socketGateway: SocketGateway) {}

  startWorkerThread() {
    this.runWorker();
  }

  runWorker() {
    this.worker = new Worker(`${__dirname}/workers/index.js`, {
      workerData: {},
    });
    this.worker.on('message', async (result) => {
      this.socketGateway.sendDefaultOpenPrice(result);
    });
    this.worker.on('exit', (code) => {
      if (code !== 0) {
        this.logger.warn(`Ohlc worker thread: terminated with code, ${code}`);
      }
    });
    this.worker.on('error', (e) => {
      this.logger.warn(`Ohlc worker thread error, ${e.stack}`);
    });
  }
}
