import { resolve } from 'path';
import { workerData } from 'worker_threads';

require('ts-node').register();
require(resolve(__dirname, workerData));
