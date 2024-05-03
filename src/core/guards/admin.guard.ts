import {
  CanActivate,
  ExecutionContext,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { checkAdminPassword } from '../utils/admin.util';

@Injectable()
export class AdminGuard implements CanActivate {
  private readonly logger = new Logger(AdminGuard.name);

  async canActivate(context: ExecutionContext): Promise<boolean> {
    try {
      const request = context.switchToHttp().getRequest();
      const body = request.body;
      const password_hash = body.password_encrypted;
      if (!password_hash) {
        throw new UnauthorizedException();
      }
      return await checkAdminPassword(password_hash);
    } catch (e) {
      return false;
    }
  }
}
