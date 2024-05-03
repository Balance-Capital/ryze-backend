import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken, TypeOrmModule } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { SystemInfoModule } from './system-info.module';
import { SystemInfoService } from './system-info.service';
import { SystemInfo } from './entities/system-info.entity';
import { connectionSource } from '../orm.config';
import { MockType } from '../core/types/mock.type';

describe('Test SystemInfo Module', () => {
  let module: TestingModule;

  const repositoryMockFactory: () => MockType<Repository<any>> = jest.fn(
    () => ({
      find: jest.fn(),
      save: jest.fn(),
    }),
  );

  beforeEach(async () => {
    module = await Test.createTestingModule({
      imports: [
        SystemInfoModule,
        TypeOrmModule.forRoot(connectionSource.options),
      ],
      providers: [
        SystemInfoService,
        {
          provide: getRepositoryToken(SystemInfo),
          useFactory: repositoryMockFactory,
        },
      ],
    }).compile();
  });

  it('should be defined', () => {
    expect(module).toBeDefined();
  });

  afterEach(async () => {
    await module.close();
  });
});
