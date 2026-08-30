import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { IsUUID } from 'class-validator';
import { Role } from '@prisma/client';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { ClaimsService } from './claims.service';

class CreateClaimDto {
  @IsUUID()
  courseInWardId: string;
}

@ApiTags('claims')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.CLAIMS_PROCESSOR)
@Controller('claims')
export class ClaimsController {
  constructor(private claimsService: ClaimsService) {}

  @Post()
  create(@Body() dto: CreateClaimDto, @CurrentUser() user: any) {
    return this.claimsService.createFromSummary(dto.courseInWardId, user.id);
  }

  @Get()
  findAll() {
    return this.claimsService.findAll();
  }

  @Post(':id/notify-physician')
  notifyPhysician(@Param('id') id: string, @CurrentUser() user: any) {
    return this.claimsService.notifyPhysician(id, user.id);
  }

  @Post(':id/generate-cf4')
  generateCf4(@Param('id') id: string, @CurrentUser() user: any) {
    return this.claimsService.generateCf4(id, user.id);
  }
}
