import { Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MulterModule } from '@nestjs/platform-express';

import { User } from './entities/user.entity';
import { UserController } from './user.controller';
import { UserService } from './user.service';
import { AffiliateModule } from '../affiliate/affiliate.module';

@Global()
@Module({
  imports: [
    MulterModule.register({ dest: './files' }),
    TypeOrmModule.forFeature([User]),
    AffiliateModule,
  ],
  exports: [UserService],
  controllers: [UserController],
  providers: [UserService],
})
export class UserModule {}
