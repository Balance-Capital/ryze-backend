import { Injectable, ExecutionContext } from '@nestjs/common';
import { ThrottlerException, ThrottlerGuard } from '@nestjs/throttler';

@Injectable()
export class WsThrottlerGuard extends ThrottlerGuard {
  async handleRequest(
    context: ExecutionContext,
    limit: number,
    ttl: number,
  ): Promise<boolean> {
    const client = context.switchToWs().getClient();
    // this is a generic method to switch between `ws` and `socket.io`. You can choose what is appropriate for you
    const ip = ['conn', '_socket']
      .map((key) => client[key])
      .filter((obj) => obj)
      .shift().remoteAddress;
    const key = this.generateKey(context, ip);

    const { totalHits } = await this.storageService.increment(key, ttl);
    console.error(`Web Socket Throttle Guard: `, totalHits, limit);

    if (totalHits > limit) {
      throw new ThrottlerException();
    }

    return true;
  }
}
