import { Logger } from '@nestjs/common';
import { isArray } from 'util';
import * as WebSocket from 'ws';

import { generateRetryRandomPeriod } from '../../core/utils/base.util';

export class KrakenWebsocketClient {
  private baseUrl = '';
  private path = '';
  private method = '';
  private ws = null;
  private handlers = null;
  private readonly logger = new Logger(KrakenWebsocketClient.name);

  constructor(baseUrl: string, path: string, method: string) {
    this.baseUrl = baseUrl;
    this.path = path;
    this.method = method;
    this.handlers = new Map();
    this.createSocket();
  }

  createSocket() {
    try {
      if (this.ws) {
        this.ws.close();
        this.ws = null;
      }
      this.ws = new WebSocket(`${this.baseUrl}`, {
        handshakeTimeout: 10000,
      });
      if (!this.ws) {
        throw new Error(`Failed to create Kraken ws client`);
      }

      this.ws.onopen = () => {
        this.ws.send(this.path);
        this.logger.log(`Kraken ws connected`);
      };

      this.ws.onclose = async () => {
        this.logger.warn(`Kraken ws closed`);
        this.handlers.get('disconnected').forEach((callback) => {
          try {
            callback();
          } catch (e) {
            this.logger.warn(
              `Kraken disconnected callback message parse failed, ${e.stack}`,
            );
          }
        });
        setTimeout(() => {
          this.createSocket();
        }, generateRetryRandomPeriod(true));
      };

      this.ws.onerror = (e) => {
        this.ws.close();
        this.logger.warn(`Kraken ws error, ${e.message}`);
      };

      this.ws.onmessage = (msg) => {
        try {
          const message = JSON.parse(msg.data);
          if (isArray(message)) {
            // this means trade data
            this.handlers.get(this.method).forEach((callback) => {
              try {
                callback(message);
              } catch (e) {
                this.logger.warn(`Kraken message parse failed, ${e.stack}`);
              }
            });
          }
        } catch (e) {
          this.logger.warn(`Kraken Parse message failed, ${e.stack}`);
        }
      };
    } catch (e) {
      this.logger.warn(`Kraken create socket function failed, ${e.stack}`);
      setTimeout(() => {
        this.createSocket();
      }, generateRetryRandomPeriod(true));
    }
  }

  setHandler(method: string, callback) {
    if (!this.handlers.has(method)) {
      this.handlers.set(method, []);
    }
    this.handlers.get(method).push(callback);
  }
}
