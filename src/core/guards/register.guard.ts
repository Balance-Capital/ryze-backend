import {
  CanActivate,
  ExecutionContext,
  Injectable,
  Logger,
} from '@nestjs/common';

import { WEB3_SIGN_MESSAGE } from '../constants/base.constant';
import { ethers } from 'ethers';

@Injectable()
export class RegisterGuard implements CanActivate {
  private readonly logger = new Logger(RegisterGuard.name);

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    if (!request.headers['authorization']) {
      return false;
    }
    const signature = request.headers['authorization'].replace('Bearer ', '');
    if (!signature) {
      return false;
    }

    try {
      const msgHash = ethers.utils.hashMessage(WEB3_SIGN_MESSAGE);
      const address = ethers.utils.recoverAddress(msgHash, signature);
      this.logger.log(`address: ${address}`);
      if (!address) {
        return false;
      }

      request['user'] = address;
      return true;
    } catch (e) {
      this.logger.error(`Register Failed - ${e}`);
      return false;
    }
  }
}
