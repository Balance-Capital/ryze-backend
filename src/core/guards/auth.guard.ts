import {
  CanActivate,
  ExecutionContext,
  Injectable,
  Logger,
} from '@nestjs/common';

import { WEB3_SIGN_MESSAGE } from '../constants/base.constant';
import { ethers } from 'ethers';
import { UserService } from 'src/user/user.service';

@Injectable()
export class AuthGuard implements CanActivate {
  private readonly logger = new Logger(AuthGuard.name);

  constructor(private readonly userService: UserService) {}

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
      this.logger.log('Auth Guard', request);
      this.logger.log(`sign: ${signature}`);
      const msgHash = ethers.utils.hashMessage(WEB3_SIGN_MESSAGE);

      const address = ethers.utils.recoverAddress(msgHash, signature);
      this.logger.log(`address: ${address}`);
      if (!address) {
        return false;
      }

      const user = await this.userService.findByAddress(address.toLowerCase());
      this.logger.log(`user: ${user}`);
      if (!!user) {
        request['user'] = user;
      }
      return !!user;
    } catch (e) {
      this.logger.error(`AuthGuard Failed - ${e}`);
      return false;
    }
  }
}
