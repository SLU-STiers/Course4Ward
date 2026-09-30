import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { OrdersService } from './orders.service';
import { CreateOrderDto, UpdateOrderStatusDto } from './dto/create-order.dto';

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

  // Orders are an immutable clinical record: there is deliberately no endpoint
  // to edit or delete one. A mistaken order is corrected by writing a new one.

  // Nurse marks an order as being carried out / done, with an optional note.
  @Patch(':id/status')
  @Roles(Role.NURSE)
  updateStatus(@Param('id') id: string, @Body() dto: UpdateOrderStatusDto, @CurrentUser() user: any) {
    return this.ordersService.updateStatus(id, dto, user.id);
  }

  @Get('patient/:patientId')
  @Roles(Role.PHYSICIAN, Role.NURSE, Role.CLAIMS_PROCESSOR)
  findForPatient(@Param('patientId') patientId: string) {
    return this.ordersService.findForPatient(patientId);
  }
}
