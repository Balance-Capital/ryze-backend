import { Logger } from '@nestjs/common';
import * as WebSocket from 'ws';

import { generateRetryRandomPeriod } from '../../core/utils/base.util';

export class BinanceWebsocketClient {
  private baseUrl = '';
  private path = '';
  private method = '';
  private ws = null;
  private handlers = null;
  private readonly logger = new Logger(BinanceWebsocketClient.name);

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
      this.ws = new WebSocket(`${this.baseUrl}/${this.path}`, {
        handshakeTimeout: 10000,
      });
      if (!this.ws) {
        throw new Error(`Failed to create Binance ${this.method} ws client`);
      }

      this.ws.onopen = () => {
        this.logger.log(`Binance ws connected`);
      };

      this.ws.onclose = async () => {
        this.logger.warn(`Binance ${this.method} ws closed`);
        this.handlers.get('disconnected').forEach((callback) => {
          try {
            callback();
          } catch (e) {
            this.logger.warn(
              `Binance disconnected callback message parse failed ${e.stack}`,
            );
          }
        });
        setTimeout(() => {
          this.createSocket();
        }, generateRetryRandomPeriod(true));
      };

      this.ws.onerror = (e) => {
        this.ws.close();
        this.logger.warn(`Binance ws error, ${e.message}`);
      };

      this.ws.onmessage = (msg) => {
        try {
          const message = JSON.parse(msg.data);
          if (this.isMultiStream(message)) {
            this.handlers.get(message.stream).forEach((callback) => {
              try {
                callback(message);
              } catch (e) {
                this.logger.warn(
                  `Binance ${this.method} multi stream message parse failed ${e.stack}`,
                );
              }
            });
          } else if (message.e && this.handlers.has(message.e)) {
            this.handlers.get(message.e).forEach((callback) => {
              try {
                callback(message);
              } catch (e) {
                this.logger.warn(
                  `Binance ${this.method} message parse failed ${e.stack}`,
                );
              }
            });
          } else {
            this.logger.warn(
              `Binance ${this.method} Unknown method ${JSON.stringify(
                message,
              )}`,
            );
          }
        } catch (e) {
          this.logger.warn(
            `Binance ${this.method} Parse message failed, ${e.stack}`,
          );
        }
      };
    } catch (e) {
      this.logger.warn(
        `Binance ${this.method} create socket function failed, ${e.stack}`,
      );
      setTimeout(() => {
        this.createSocket();
      }, generateRetryRandomPeriod(true));
    }
  }

  setHandler(method, callback) {
    if (!this.handlers.has(method)) {
      this.handlers.set(method, []);
    }
    this.handlers.get(method).push(callback);
  }

  private isMultiStream(message) {
    return message.stream && this.handlers.has(message.stream);
  }
}
