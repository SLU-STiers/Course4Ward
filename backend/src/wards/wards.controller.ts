import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { PrismaService } from '../prisma/prisma.service';

@ApiTags('wards')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
@Controller('admin/wards')
export class WardsController {
  constructor(private prisma: PrismaService) {}

  /** Wards to pick from when assigning a nurse. */
  @Get()
  findAll() {
    return this.prisma.ward.findMany({
      orderBy: [{ holdsUnroomed: 'desc' }, { name: 'asc' }],
      select: { id: true, name: true, holdsUnroomed: true },
    });
  }
}
