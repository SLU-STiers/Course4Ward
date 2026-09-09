// unit-tests/notes.test.ts
import { Test, TestingModule } from '@nestjs/testing';
import { NotesService } from '../notes/notes.service';
import { PrismaService } from '../prisma/prisma.service';
import { CreateNoteDto } from '../notes/dto/create-note.dto';

// Mock the PrismaService
const mockPrismaService = {
  physicianNote: {
    create: jest.fn(),
    findMany: jest.fn(),
  },
};

describe('NotesService', () => {
  let service: NotesService;
  let prismaService: PrismaService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotesService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    service = module.get<NotesService>(NotesService);
    prismaService = module.get<PrismaService>(PrismaService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('create', () => {
    const mockPhysicianId = 'physician-123';
    const mockPatientId = 'patient-456';

    const mockCreateNoteDto: CreateNoteDto = {
      patientId: mockPatientId,
      content: 'This is a note entry', // This is a string, not an array
      reminderAt: '2026-12-25T10:00:00Z',
    };

    const mockCreatedNote = {
      id: 'note-789',
      patientId: mockPatientId,
      physicianId: mockPhysicianId,
      notesArray: mockCreateNoteDto.content, // Should be a string, not an array
      reminderAt: new Date(mockCreateNoteDto.reminderAt!),
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    it('should create a note with reminder date', async () => {
      // Arrange
      mockPrismaService.physicianNote.create.mockResolvedValue(mockCreatedNote);

      // Act
      const result = await service.create(mockCreateNoteDto, mockPhysicianId);

      // Assert
      expect(mockPrismaService.physicianNote.create).toHaveBeenCalledTimes(1);
      expect(mockPrismaService.physicianNote.create).toHaveBeenCalledWith({
        data: {
          patientId: mockPatientId,
          physicianId: mockPhysicianId,
          notesArray: mockCreateNoteDto.content, // String, not array
          reminderAt: new Date(mockCreateNoteDto.reminderAt!),
        },
      });
      expect(result).toEqual(mockCreatedNote);
    });

    it('should create a note without reminder date', async () => {
      // Arrange
      const dtoWithoutReminder: CreateNoteDto = {
        patientId: mockPatientId,
        content: 'Test note',
      };
      const mockNoteWithoutReminder = {
        id: 'note-789',
        patientId: mockPatientId,
        physicianId: mockPhysicianId,
        notesArray: dtoWithoutReminder.content, // String, not array
        reminderAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockPrismaService.physicianNote.create.mockResolvedValue(mockNoteWithoutReminder);

      // Act
      const result = await service.create(dtoWithoutReminder, mockPhysicianId);

      // Assert
      expect(mockPrismaService.physicianNote.create).toHaveBeenCalledWith({
        data: {
          patientId: mockPatientId,
          physicianId: mockPhysicianId,
          notesArray: dtoWithoutReminder.content, // String, not array
          reminderAt: undefined,
        },
      });
      expect(result).toEqual(mockNoteWithoutReminder);
    });

    it('should handle undefined reminderAt gracefully', async () => {
      // Arrange
      const dtoWithUndefinedReminder: CreateNoteDto = {
        patientId: mockPatientId,
        content: 'Test note',
        reminderAt: undefined,
      };
      
      // Act
      await service.create(dtoWithUndefinedReminder, mockPhysicianId);

      // Assert - The service should handle undefined by passing undefined to Prisma
      expect(mockPrismaService.physicianNote.create).toHaveBeenCalledWith({
        data: {
          patientId: mockPatientId,
          physicianId: mockPhysicianId,
          notesArray: dtoWithUndefinedReminder.content, // String, not array
          reminderAt: undefined,
        },
      });
    });

    it('should handle errors from Prisma', async () => {
      // Arrange
      const error = new Error('Database error');
      mockPrismaService.physicianNote.create.mockRejectedValue(error);

      // Act & Assert
      await expect(service.create(mockCreateNoteDto, mockPhysicianId)).rejects.toThrow(
        'Database error',
      );
      expect(mockPrismaService.physicianNote.create).toHaveBeenCalledTimes(1);
    });
  });

  describe('findForPatient', () => {
    const mockPatientId = 'patient-456';

    const mockNotes = [
      {
        id: 'note-1',
        patientId: mockPatientId,
        physicianId: 'physician-1',
        notesArray: 'Note 1', // String, not array
        reminderAt: new Date('2026-12-20T10:00:00Z'),
        createdAt: new Date('2026-12-20T10:00:00Z'),
        updatedAt: new Date('2026-12-20T10:00:00Z'),
      },
      {
        id: 'note-2',
        patientId: mockPatientId,
        physicianId: 'physician-2',
        notesArray: 'Note 2 Additional content', // String, not array
        reminderAt: null,
        createdAt: new Date('2026-12-19T10:00:00Z'),
        updatedAt: new Date('2026-12-19T10:00:00Z'),
      },
    ];

    it('should return all notes for a patient sorted by creation date descending', async () => {
      // Arrange
      mockPrismaService.physicianNote.findMany.mockResolvedValue(mockNotes);

      // Act
      const result = await service.findForPatient(mockPatientId);

      // Assert
      expect(mockPrismaService.physicianNote.findMany).toHaveBeenCalledTimes(1);
      expect(mockPrismaService.physicianNote.findMany).toHaveBeenCalledWith({
        where: { patientId: mockPatientId },
        orderBy: { createdAt: 'desc' },
      });
      expect(result).toEqual(mockNotes);
      expect(result.length).toBe(2);
    });

    it('should return empty array when patient has no notes', async () => {
      // Arrange
      mockPrismaService.physicianNote.findMany.mockResolvedValue([]);

      // Act
      const result = await service.findForPatient(mockPatientId);

      // Assert
      expect(result).toEqual([]);
      expect(mockPrismaService.physicianNote.findMany).toHaveBeenCalledWith({
        where: { patientId: mockPatientId },
        orderBy: { createdAt: 'desc' },
      });
    });

    it('should handle errors from Prisma', async () => {
      // Arrange
      const error = new Error('Database connection failed');
      mockPrismaService.physicianNote.findMany.mockRejectedValue(error);

      // Act & Assert
      await expect(service.findForPatient(mockPatientId)).rejects.toThrow(
        'Database connection failed',
      );
      expect(mockPrismaService.physicianNote.findMany).toHaveBeenCalledTimes(1);
    });
  });

  describe('findUpcomingReminders', () => {
    const mockPhysicianId = 'physician-123';
    const currentDate = new Date();

    const mockReminders = [
      {
        id: 'note-1',
        patientId: 'patient-1',
        physicianId: mockPhysicianId,
        notesArray: 'Reminder 1', // String, not array
        reminderAt: new Date(currentDate.getTime() + 3600000),
        createdAt: new Date(),
        updatedAt: new Date(),
        patient: {
          firstName: 'John',
          lastName: 'Doe',
        },
      },
      {
        id: 'note-2',
        patientId: 'patient-2',
        physicianId: mockPhysicianId,
        notesArray: 'Reminder 2', // String, not array
        reminderAt: new Date(currentDate.getTime() + 7200000),
        createdAt: new Date(),
        updatedAt: new Date(),
        patient: {
          firstName: 'Jane',
          lastName: 'Smith',
        },
      },
    ];

    it('should return upcoming reminders for a physician sorted by reminder date ascending', async () => {
      // Arrange
      mockPrismaService.physicianNote.findMany.mockResolvedValue(mockReminders);

      // Act
      const result = await service.findUpcomingReminders(mockPhysicianId);

      // Assert
      expect(mockPrismaService.physicianNote.findMany).toHaveBeenCalledTimes(1);
      expect(mockPrismaService.physicianNote.findMany).toHaveBeenCalledWith({
        where: {
          physicianId: mockPhysicianId,
          reminderAt: { gte: expect.any(Date) },
        },
        orderBy: { reminderAt: 'asc' },
        include: { patient: { select: { firstName: true, lastName: true } } },
      });
      expect(result).toEqual(mockReminders);
      expect(result[0].patient.firstName).toBe('John');
      expect(result[1].patient.lastName).toBe('Smith');
    });

    it('should include patient information in the response', async () => {
      // Arrange
      mockPrismaService.physicianNote.findMany.mockResolvedValue(mockReminders);

      // Act
      const result = await service.findUpcomingReminders(mockPhysicianId);

      // Assert
      expect(result[0]).toHaveProperty('patient');
      expect(result[0].patient).toHaveProperty('firstName');
      expect(result[0].patient).toHaveProperty('lastName');
    });

    it('should return empty array when no upcoming reminders exist', async () => {
      // Arrange
      mockPrismaService.physicianNote.findMany.mockResolvedValue([]);

      // Act
      const result = await service.findUpcomingReminders(mockPhysicianId);

      // Assert
      expect(result).toEqual([]);
      expect(mockPrismaService.physicianNote.findMany).toHaveBeenCalledWith({
        where: {
          physicianId: mockPhysicianId,
          reminderAt: { gte: expect.any(Date) },
        },
        orderBy: { reminderAt: 'asc' },
        include: { patient: { select: { firstName: true, lastName: true } } },
      });
    });

    it('should handle errors from Prisma', async () => {
      // Arrange
      const error = new Error('Prisma query failed');
      mockPrismaService.physicianNote.findMany.mockRejectedValue(error);

      // Act & Assert
      await expect(service.findUpcomingReminders(mockPhysicianId)).rejects.toThrow(
        'Prisma query failed',
      );
      expect(mockPrismaService.physicianNote.findMany).toHaveBeenCalledTimes(1);
    });
  });
});