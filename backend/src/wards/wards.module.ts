import { Module } from '@nestjs/common';
import { WardAccessService } from './ward-access.service';

@Module({
  providers: [WardAccessService],
  exports: [WardAccessService],
})
export class WardsModule {}
