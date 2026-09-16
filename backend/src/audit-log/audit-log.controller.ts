import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { AuditLogService } from './audit-log.service';
import {
  AuditLogAggregateQueryDto,
  AuditLogQueryDto,
  OrdersOverTimeQueryDto,
} from './dto/audit-log-query.dto';

@ApiTags('audit-log')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
@Controller('admin/audit-logs')
export class AuditLogController {
  constructor(private auditLogService: AuditLogService) {}

  /**
   * One page of activity logs — filterable by action, actor role, actor login
   * id, date range and free text (actor name/id or action name).
   */
  @Get()
  findAll(@Query() query: AuditLogQueryDto) {
    return this.auditLogService.findAll({
      skip: query.skip,
      take: query.take,
      action: query.action,
      role: query.role,
      userId: query.userId,
      from: query.from ? new Date(query.from) : undefined,
      to: query.to ? new Date(query.to) : undefined,
      search: query.search,
    });
  }

  /**
   * The same logs in graph form: activity per day, per action, or per actor.
   * Accepts every filter the table does, so switching views cannot change what
   * is being counted.
   */
  @Get('aggregate')
  aggregate(@Query() query: AuditLogAggregateQueryDto) {
    return this.auditLogService.aggregate(
      {
        action: query.action,
        role: query.role,
        userId: query.userId,
        from: query.from ? new Date(query.from) : undefined,
        to: query.to ? new Date(query.to) : undefined,
        search: query.search,
      },
      query.by,
    );
  }

  @Get('analytics/orders')
  ordersOverTime(@Query() query: OrdersOverTimeQueryDto) {
    return this.auditLogService.ordersOverTime(query.bucket);
  }

  @Get('analytics/summary')
  summary() {
    return this.auditLogService.summary();
  }
}
