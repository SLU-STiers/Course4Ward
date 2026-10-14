import { Module } from '@nestjs/common';
import { WardAccessService } from './ward-access.service';
import { WardsController } from './wards.controller';

@Module({
  controllers: [WardsController],
  providers: [WardAccessService],
  exports: [WardAccessService],
})
export class WardsModule {}
