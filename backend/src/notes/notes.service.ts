import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { CreateNoteDto } from './dto/create-note.dto';

@Injectable()
export class NotesService {
  constructor(private database: DatabaseService) {}

  create(dto: CreateNoteDto, physicianId: string) {
    return this.database.physicianNote.create({
      data: {
        patientId: dto.patientId,
        physicianId,
        content: dto.content,
        reminderAt: dto.reminderAt ? new Date(dto.reminderAt) : undefined,
      },
    });
  }

  findForPatient(patientId: string) {
    return this.database.physicianNote.findMany({
      where: { patientId },
      orderBy: { createdAt: 'desc' },
    });
  }

  // For a physician's personal reminder feed across all their patients
  findUpcomingReminders(physicianId: string) {
    return this.database.physicianNote.findMany({
      where: { physicianId, reminderAt: { gte: new Date() } },
      orderBy: { reminderAt: 'asc' },
      include: { patient: { select: { firstName: true, lastName: true } } },
    });
  }
}
