import { Test, TestingModule } from '@nestjs/testing';
import { Worker } from 'worker_threads';

import { DataProviderService } from './data-provider.service';
import { SocketGateway } from '../socket/socket.gateway';

describe('Test Data Provider Service', () => {
  let service: DataProviderService;

  beforeEach(async () => {
    const dataProviderModule: TestingModule = await Test.createTestingModule({
      providers: [
        {
          provide: SocketGateway,
          useValue: {
            sendDefaultOpenPrice: jest.fn(),
          },
        },
        DataProviderService,
      ],
    }).compile();

    service = dataProviderModule.get<DataProviderService>(DataProviderService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should call startWorkerThread', () => {
    jest.spyOn(service, 'runWorker').mockImplementation(() => {
      return;
    });
    service.startWorkerThread();
  });

  it('should call runWorker', async () => {
    jest.spyOn(service, 'runWorker').mockImplementation(() => {
      return;
    });
    const worker = new Worker(`${__dirname}/workers/index.js`, {
      workerData: {},
    });
    worker.on('message', (result) => {
      service['socketGateway'].sendDefaultOpenPrice(result);
    });
    worker.on('exit', (code) => {
      if (code !== 0) {
        service['logger'].warn(
          `Ohlc worker thread: terminated with code, ${code}`,
        );
      }
    });
    worker.on('error', (e) => {
      service['logger'].warn(`Ohlc worker thread error, ${e.stack}`);
    });
  });
});
