import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { CourseInWardService } from './course-in-ward.service';
import { GenerateSummaryDto, EditSummaryDto } from './dto/course-in-ward.dto';

@ApiTags('course-in-ward')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('course-in-ward')
export class CourseInWardController {
  constructor(private courseInWardService: CourseInWardService) {}

  @Post('generate')
  @Roles(Role.PHYSICIAN)
  generate(@Body() dto: GenerateSummaryDto, @CurrentUser() user: any) {
    return this.courseInWardService.generateSummary(dto.patientId, user.id);
  }

  @Patch(':id/edit')
  @Roles(Role.PHYSICIAN)
  edit(@Param('id') id: string, @Body() dto: EditSummaryDto, @CurrentUser() user: any) {
    return this.courseInWardService.editSummary(id, dto.editedText, user.id);
  }

  @Post(':id/regenerate')
  @Roles(Role.PHYSICIAN)
  regenerate(@Param('id') id: string, @CurrentUser() user: any) {
    return this.courseInWardService.regenerateSummary(id, user.id);
  }

  @Patch(':id/approve')
  @Roles(Role.PHYSICIAN)
  approve(@Param('id') id: string, @CurrentUser() user: any) {
    return this.courseInWardService.approve(id, user.id);
  }

  @Get('patient/:patientId')
  @Roles(Role.PHYSICIAN, Role.NURSE, Role.CLAIMS_PROCESSOR)
  findForPatient(@Param('patientId') patientId: string) {
    return this.courseInWardService.findForPatient(patientId);
  }
}
