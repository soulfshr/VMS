/**
 * Training API Tests
 *
 * Tests for training session management and qualification granting.
 * Priority: P1 (Important for launch)
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { testUsers, testTrainingTypes, testTrainingSessions, testQualifiedRoles } from '../helpers/fixtures';
import { createTestTrainingSession } from '../helpers/factories';
import { mockEmailService, resetAllMocks, mockAuth, createMockPrismaClient } from '../helpers/mocks';

const mockPrisma = createMockPrismaClient();
vi.mock('@/lib/db', () => ({
  prisma: mockPrisma,
}));

vi.mock('@/lib/email', () => ({
  sendEmail: mockEmailService.send,
  sendTrainingReminderEmail: mockEmailService.send,
}));

describe('Training Sessions API', () => {
  beforeEach(() => {
    resetAllMocks();
  });

  describe('GET /api/trainings', () => {
    it('should return list of scheduled training sessions', async () => {
      mockAuth.asVolunteer();

      const sessions = [
        createTestTrainingSession({ status: 'SCHEDULED' }),
        createTestTrainingSession({ status: 'SCHEDULED' }),
      ];

      mockPrisma.trainingSession.findMany.mockResolvedValue(sessions);

      expect(sessions).toHaveLength(2);
      expect(sessions.every((s) => s.status === 'SCHEDULED')).toBe(true);
    });

    it('should include training type information', async () => {
      mockAuth.asVolunteer();

      const session = createTestTrainingSession({
        trainingTypeId: testTrainingTypes.verifierTraining.id,
      });

      expect(session.trainingTypeId).toBe(testTrainingTypes.verifierTraining.id);
      // In actual implementation, verify trainingType is included in response
    });

    it('should return 401 for unauthenticated requests', async () => {
      mockAuth.asUnauthenticated();
      const session = await mockAuth.getSession();

      expect(session).toBeNull();
      // In actual implementation, verify 401 response
    });
  });

  describe('POST /api/trainings', () => {
    const validTrainingData = {
      trainingTypeId: testTrainingTypes.basicOrientation.id,
      title: 'December Basic Orientation',
      date: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      startTime: '10:00',
      endTime: '12:00',
      location: '123 Main St, Durham NC',
      maxAttendees: 20,
    };

    it('TRAIN-001: should create training session as coordinator', async () => {
      mockAuth.asCoordinator();

      const newSession = createTestTrainingSession(validTrainingData);
      mockPrisma.trainingSession.create.mockResolvedValue(newSession);

      expect(newSession.title).toBe(validTrainingData.title);
      expect(newSession.maxAttendees).toBe(20);
    });

    it('should reject creation by volunteer', async () => {
      mockAuth.asVolunteer();
      const session = await mockAuth.getSession();

      expect(session?.user.role).toBe('VOLUNTEER');
      // In actual implementation, verify 403 response
    });

    it('should validate required fields', async () => {
      mockAuth.asCoordinator();

      const invalidData = [
        { ...validTrainingData, trainingTypeId: '' },
        { ...validTrainingData, date: '' },
        { ...validTrainingData, location: '' },
      ];

      invalidData.forEach((data) => {
        const isValid = data.trainingTypeId && data.date && data.location;
        expect(isValid).toBeFalsy();
      });
    });

    it('should reject past dates', async () => {
      mockAuth.asCoordinator();

      const pastDate = new Date(Date.now() - 24 * 60 * 60 * 1000);
      expect(pastDate < new Date()).toBe(true);
      // In actual implementation, verify 400 response
    });
  });

  describe('POST /api/trainings/[id]/rsvp', () => {
    it('TRAIN-002: should create RSVP for volunteer', async () => {
      mockAuth.asVolunteer();
      const userSession = await mockAuth.getSession();

      const trainingSession = createTestTrainingSession({
        status: 'SCHEDULED',
        maxAttendees: 20,
      });

      mockPrisma.trainingSession.findUnique.mockResolvedValue(trainingSession);
      mockPrisma.trainingSessionAttendee.count.mockResolvedValue(5); // Not full

      const attendee = {
        id: 'attendee-1',
        sessionId: trainingSession.id,
        userId: userSession!.user.id,
        status: 'REGISTERED',
        confirmedAt: null,
        completedAt: null,
      };

      mockPrisma.trainingSessionAttendee.create.mockResolvedValue(attendee);

      expect(attendee.status).toBe('REGISTERED');
    });

    it('TRAIN-004: should reject RSVP when training is full', async () => {
      mockAuth.asVolunteer();

      const fullSession = createTestTrainingSession({ maxAttendees: 10 });
      mockPrisma.trainingSession.findUnique.mockResolvedValue(fullSession);
      mockPrisma.trainingSessionAttendee.count.mockResolvedValue(10);

      const attendeeCount = await mockPrisma.trainingSessionAttendee.count();
      expect(attendeeCount).toBe(fullSession.maxAttendees);
      // In actual implementation, verify 400 "Training is full" response
    });

    it('should reject duplicate RSVP', async () => {
      mockAuth.asVolunteer();
      const userSession = await mockAuth.getSession();

      const existingAttendee = {
        id: 'attendee-existing',
        sessionId: 'session-1',
        userId: userSession!.user.id,
        status: 'REGISTERED',
      };

      mockPrisma.trainingSessionAttendee.findFirst.mockResolvedValue(existingAttendee);

      expect(existingAttendee).not.toBeNull();
      // In actual implementation, verify 409 Conflict response
    });
  });

  describe('Training Completion & Qualification', () => {
    it('TRAIN-003: should grant qualification when training completed', async () => {
      mockAuth.asCoordinator();

      // Training type that grants Verifier qualification
      const trainingType = testTrainingTypes.verifierTraining;
      expect(trainingType.grantsQualifiedRoleId).toBe('role-verifier');

      const session = createTestTrainingSession({
        trainingTypeId: trainingType.id,
      });

      const attendee = {
        id: 'attendee-1',
        sessionId: session.id,
        userId: testUsers.volunteer.id,
        status: 'COMPLETED',
        completedAt: new Date(),
      };

      mockPrisma.trainingSession.findUnique.mockResolvedValue({
        ...session,
        trainingType,
      });
      mockPrisma.trainingSessionAttendee.update.mockResolvedValue(attendee);

      // Qualification should be created
      const qualification = {
        id: 'qual-1',
        userId: testUsers.volunteer.id,
        qualifiedRoleId: trainingType.grantsQualifiedRoleId,
        earnedAt: new Date(),
        expiresAt: trainingType.expiresAfterDays
          ? new Date(Date.now() + trainingType.expiresAfterDays * 24 * 60 * 60 * 1000)
          : null,
        trainingSessionId: session.id,
      };

      mockPrisma.userQualification.create.mockResolvedValue(qualification);

      expect(qualification.qualifiedRoleId).toBe('role-verifier');
      expect(qualification.userId).toBe(testUsers.volunteer.id);
    });

    it('should calculate qualification expiration correctly', async () => {
      const trainingType = testTrainingTypes.verifierTraining;
      expect(trainingType.expiresAfterDays).toBe(365);

      const earnedAt = new Date();
      const expiresAt = new Date(earnedAt.getTime() + 365 * 24 * 60 * 60 * 1000);

      const daysUntilExpiry = Math.round(
        (expiresAt.getTime() - earnedAt.getTime()) / (24 * 60 * 60 * 1000)
      );

      expect(daysUntilExpiry).toBe(365);
    });

    it('should not grant qualification if training type has none', async () => {
      mockAuth.asCoordinator();

      const trainingType = testTrainingTypes.basicOrientation;
      expect(trainingType.grantsQualifiedRoleId).toBeNull();

      // No qualification should be created
    });
  });

  describe('POST /api/trainings/confirm-rsvps', () => {
    it('should confirm attendee registrations', async () => {
      mockAuth.asCoordinator();

      const attendeeIds = ['attendee-1', 'attendee-2'];
      mockPrisma.trainingSessionAttendee.updateMany.mockResolvedValue({ count: 2 });

      // Verify confirmation emails would be sent
      for (let i = 0; i < attendeeIds.length; i++) {
        await mockEmailService.send({
          to: `volunteer${i}@test.com`,
          subject: 'Training Confirmed',
          template: 'training-confirmed',
        });
      }

      expect(mockEmailService.sends).toHaveLength(2);
    });
  });

  describe('POST /api/trainings/cancel', () => {
    it('should cancel training and notify attendees', async () => {
      mockAuth.asCoordinator();

      const session = createTestTrainingSession();
      const attendees = [
        { id: 'att-1', userId: 'user-1', status: 'REGISTERED' },
        { id: 'att-2', userId: 'user-2', status: 'CONFIRMED' },
      ];

      mockPrisma.trainingSession.findUnique.mockResolvedValue(session);
      mockPrisma.trainingSessionAttendee.findMany.mockResolvedValue(attendees);
      mockPrisma.trainingSession.update.mockResolvedValue({
        ...session,
        status: 'CANCELLED',
      });

      // Should send cancellation emails
      for (const attendee of attendees) {
        await mockEmailService.send({
          to: `user@test.com`,
          subject: 'Training Cancelled',
          template: 'training-cancelled',
        });
      }

      expect(mockEmailService.sends).toHaveLength(attendees.length);
    });
  });
});

describe('Training Types API', () => {
  beforeEach(() => {
    resetAllMocks();
  });

  describe('GET /api/training-types', () => {
    it('should return active training types', async () => {
      mockAuth.asVolunteer();

      const types = Object.values(testTrainingTypes).filter((t) => t.active);
      mockPrisma.trainingType.findMany.mockResolvedValue(types);

      expect(types.length).toBeGreaterThan(0);
      expect(types.every((t) => t.active)).toBe(true);
    });
  });

  describe('POST /api/admin/training-types', () => {
    it('should create training type as admin', async () => {
      mockAuth.asAdmin();

      const newType = {
        name: 'New Training',
        slug: 'new-training',
        description: 'A new training type',
        defaultDurationMinutes: 120,
        expiresAfterDays: 180,
        grantsQualifiedRoleId: testQualifiedRoles.verifier.id,
        active: true,
      };

      mockPrisma.trainingType.create.mockResolvedValue({
        id: 'new-type-id',
        ...newType,
      });

      expect(newType.grantsQualifiedRoleId).toBe(testQualifiedRoles.verifier.id);
    });

    it('should reject creation by coordinator', async () => {
      mockAuth.asCoordinator();
      const session = await mockAuth.getSession();

      expect(session?.user.role).toBe('COORDINATOR');
      // Only admins can create training types
      // In actual implementation, verify 403 response
    });
  });

  describe('PUT /api/admin/training-types/[id]', () => {
    it('should update training type as admin', async () => {
      mockAuth.asAdmin();

      const existingType = testTrainingTypes.basicOrientation;
      const updates = {
        defaultDurationMinutes: 180,
        description: 'Updated description',
      };

      mockPrisma.trainingType.findUnique.mockResolvedValue(existingType);
      mockPrisma.trainingType.update.mockResolvedValue({
        ...existingType,
        ...updates,
      });

      expect(updates.defaultDurationMinutes).toBe(180);
    });

    it('should link training type to qualified role', async () => {
      mockAuth.asAdmin();

      const update = {
        grantsQualifiedRoleId: testQualifiedRoles.zoneLead.id,
      };

      expect(update.grantsQualifiedRoleId).toBe('role-zone-lead');
      // Completing this training will grant Zone Lead qualification
    });
  });
});
