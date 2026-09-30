import { Module } from '@nestjs/common';
import { ReportsController } from './reports.controller';
import { ReportsService } from './reports.service';

/**
 * Read-only admin analytics. Lives beside AuditLogModule (which owns the
 * activity log itself) because the reporting section aggregates the audit log
 * together with the clinical tables. `PrismaModule` is global, so it is not
 * imported here.
 */
@Module({
  controllers: [ReportsController],
  providers: [ReportsService],
  exports: [ReportsService],
})
export class ReportsModule {}
