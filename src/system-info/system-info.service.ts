import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { SystemInfo } from './entities/system-info.entity';

@Injectable()
export class SystemInfoService {
  constructor(
    @InjectRepository(SystemInfo)
    private readonly systemInfoRepository: Repository<SystemInfo>,
  ) {}

  async get(): Promise<any> {
    const found = await this.findFirst();
    if (!found) {
      return null;
    }
    return JSON.parse(found.setting);
  }

  async findFirst(): Promise<SystemInfo> {
    const settings = await this.systemInfoRepository.find({
      order: {
        id: 'DESC',
      },
      take: 1,
    });
    if (!settings) {
      return null;
    }
    return settings[0];
  }

  async update(setting: any): Promise<SystemInfo> {
    let found = await this.findFirst();
    if (found) {
      found.setting = JSON.stringify(setting);
    } else {
      found = new SystemInfo();
      found.setting = JSON.stringify(setting);
    }
    return await this.systemInfoRepository.save(found);
  }
}
