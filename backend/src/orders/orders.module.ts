import { Module } from '@nestjs/common';
import { OrdersService } from './orders.service';
import { OrdersController } from './orders.controller';
import { AuditLogModule } from '../audit-log/audit-log.module';
import { WardsModule } from '../wards/wards.module';

@Module({
  imports: [AuditLogModule, WardsModule],
  controllers: [OrdersController],
  providers: [OrdersService],
  exports: [OrdersService],
})
export class OrdersModule {}
