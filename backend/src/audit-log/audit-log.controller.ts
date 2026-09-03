import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { AuditLogService } from './audit-log.service';

@ApiTags('audit-log')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
@Controller('admin/audit-logs')
export class AuditLogController {
  constructor(private auditLogService: AuditLogService) {}

  @Get()
  findAll(
    @Query('skip') skip?: string,
    @Query('take') take?: string,
  ) {
    return this.auditLogService.findAll({
      skip: skip ? Number(skip) : undefined,
      take: take ? Number(take) : undefined,
    });
  }

  @Get('analytics/orders')
  ordersOverTime(@Query('bucket') bucket: 'day' | 'week' | 'month' | 'year' = 'day') {
    return this.auditLogService.ordersOverTime(bucket);
  }
}
