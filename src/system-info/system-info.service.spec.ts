import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { SystemInfoService } from './system-info.service';
import { SystemInfo } from './entities/system-info.entity';
import { MockType } from '../core/types/mock.type';

describe('Test SystemInfo Service', () => {
  let service: SystemInfoService;
  let repositoryMock: MockType<Repository<SystemInfo>>;

  const repositoryMockFactory: () => MockType<Repository<any>> = jest.fn(
    () => ({
      find: jest.fn(),
      save: jest.fn(),
    }),
  );

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SystemInfoService,
        {
          provide: getRepositoryToken(SystemInfo),
          useFactory: repositoryMockFactory,
        },
      ],
    }).compile();
    service = module.get<SystemInfoService>(SystemInfoService);
    repositoryMock = module.get(getRepositoryToken(SystemInfo));
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should return null when trigger findFirst function', async () => {
    repositoryMock.find.mockReturnValue(null);
    const result = await service.findFirst();
    expect(result).toEqual(null);
  });

  it('should return first record when trigger findFirst function', async () => {
    repositoryMock.find.mockReturnValue([
      { id: 1, setting: `{"checkedTimestamp":"0"}` },
    ]);
    const result = await service.findFirst();
    expect(result).toEqual({
      id: 1,
      setting: `{"checkedTimestamp":"0"}`,
    });
  });

  it('should return null when trigger get function', async () => {
    repositoryMock.find.mockReturnValue(null);
    const result = await service.get();
    expect(result).toEqual(null);
  });

  it('should return setting value when get function', async () => {
    repositoryMock.find.mockReturnValue([
      { id: 1, setting: `{"checkedTimestamp":"0"}` },
    ]);
    const result = await service.get();
    expect(result).toEqual({ checkedTimestamp: '0' });
  });

  it('should return new record when trigger update function', async () => {
    repositoryMock.find.mockReturnValue(null);
    repositoryMock.save.mockReturnValue({
      id: 1,
      setting: `{"checkedTimestamp":"1677594000000"}`,
    });
    const result = await service.update({ checkedTimestamp: 1677594000000 });
    expect(result).toEqual({
      id: 1,
      setting: '{"checkedTimestamp":"1677594000000"}',
    });
  });

  it('should return updated record when trigger update function', async () => {
    repositoryMock.find.mockReturnValue([
      { id: 1, setting: `{"checkedTimestamp":"0"}` },
    ]);
    repositoryMock.save.mockReturnValue({
      id: 1,
      setting: `{"checkedTimestamp":"1677594000000"}`,
    });
    const result = await service.update({ checkedTimestamp: 1677594000000 });
    expect(result).toEqual({
      id: 1,
      setting: '{"checkedTimestamp":"1677594000000"}',
    });
  });
});
