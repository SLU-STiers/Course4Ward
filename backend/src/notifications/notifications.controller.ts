import { Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { NotificationsService } from './notifications.service';

/**
 * Every authenticated role reads its own notifications — the bell in the
 * shared header renders for physicians, nurses, claims processors and admins
 * alike, so there are no @Roles() restrictions here.
 */
@ApiTags('notifications')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('notifications')
export class NotificationsController {
  constructor(private notificationsService: NotificationsService) {}

  /** `?scope=history` returns the full log; the default is the inbox. */
  @Get()
  findMine(
    @CurrentUser() user: any,
    @Query('scope') scope?: string,
    @Query('take') take?: string,
  ) {
    const parsed = Number(take);
    return this.notificationsService.listForUser(user.id, {
      scope: scope === 'history' ? 'history' : 'inbox',
      take: Number.isFinite(parsed) ? parsed : undefined,
    });
  }

  @Get('unread-count')
  unreadCount(@CurrentUser() user: any) {
    return this.notificationsService.unreadCount(user.id);
  }

  @Patch(':id/read')
  markRead(@Param('id') id: string, @CurrentUser() user: any) {
    return this.notificationsService.markRead(id, user.id);
  }

  @Post('read-all')
  markAllRead(@CurrentUser() user: any) {
    return this.notificationsService.markAllRead(user.id);
  }

  /** Clears the inbox into the history. */
  @Post('clear')
  clear(@CurrentUser() user: any) {
    return this.notificationsService.clear(user.id);
  }
}
