import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { Role } from '../common/types/domain';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { NotesService } from './notes.service';
import { CreateNoteDto } from './dto/create-note.dto';

@ApiTags('notes')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.PHYSICIAN)
@Controller('notes')
export class NotesController {
  constructor(private notesService: NotesService) {}

  @Post()
  create(@Body() dto: CreateNoteDto, @CurrentUser() user: any) {
    return this.notesService.create(dto, user.id);
  }

  @Get('patient/:patientId')
  findForPatient(@Param('patientId') patientId: string) {
    return this.notesService.findForPatient(patientId);
  }

  @Get('reminders/me')
  myReminders(@CurrentUser() user: any) {
    return this.notesService.findUpcomingReminders(user.id);
  }
}
