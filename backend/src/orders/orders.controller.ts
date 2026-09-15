import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { OrdersService } from './orders.service';
import { CreateOrderDto, UpdateOrderDto } from './dto/create-order.dto';

@ApiTags('orders')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('orders')
export class OrdersController {
  constructor(private ordersService: OrdersService) {}

  @Post()
  @Roles(Role.PHYSICIAN, Role.NURSE) // nurse may enter on physician's behalf
  create(@Body() dto: CreateOrderDto, @CurrentUser() user: any) {
    return this.ordersService.create(dto, user.id, user.role);
  }

  @Patch(':id')
  @Roles(Role.PHYSICIAN)
  update(@Param('id') id: string, @Body() dto: UpdateOrderDto, @CurrentUser() user: any) {
    return this.ordersService.update(id, dto.orderContent, user.id);
  }

  @Delete(':id')
  @Roles(Role.PHYSICIAN)
  remove(@Param('id') id: string, @CurrentUser() user: any) {
    return this.ordersService.remove(id, user.id);
  }

  @Get('patient/:patientId')
  @Roles(Role.PHYSICIAN, Role.NURSE, Role.CLAIMS_PROCESSOR)
  findForPatient(@Param('patientId') patientId: string) {
    return this.ordersService.findForPatient(patientId);
  }
}
