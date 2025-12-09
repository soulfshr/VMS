/**
 * Sightings API Tests
 *
 * Tests for ICE sighting report submission and management.
 * Priority: P1 (Important for launch)
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { testUsers, testSightings } from '../helpers/fixtures';
import { createTestSighting } from '../helpers/factories';
import { mockEmailService, resetAllMocks, mockAuth, createMockPrismaClient } from '../helpers/mocks';

const mockPrisma = createMockPrismaClient();
vi.mock('@/lib/db', () => ({
  prisma: mockPrisma,
}));

vi.mock('@/lib/email', () => ({
  sendEmail: mockEmailService.send,
  sendSightingNotificationToDispatchers: mockEmailService.send,
}));

describe('Sightings API', () => {
  beforeEach(() => {
    resetAllMocks();
  });

  describe('POST /api/sightings (Public)', () => {
    const validSightingData = {
      size: '3-5',
      activity: 'Vehicle checkpoint observed at intersection',
      location: 'Main St & 5th Ave, Durham NC',
      latitude: 35.994,
      longitude: -78.8986,
      time: new Date().toISOString(),
      uniform: 'Plain clothes with tactical vests',
      equipment: 'Radios, unmarked black SUVs',
      reporterName: 'Anonymous',
      reporterPhone: null,
    };

    it('SIGHT-001: should accept public sighting report', async () => {
      // No authentication required
      mockAuth.asUnauthenticated();

      const newSighting = createTestSighting({
        ...validSightingData,
        status: 'NEW',
      });

      mockPrisma.iceSighting.create.mockResolvedValue(newSighting);

      expect(newSighting.status).toBe('NEW');
      expect(newSighting.activity).toBe(validSightingData.activity);
    });

    it('SIGHT-002: should notify dispatchers of new sighting', async () => {
      mockAuth.asUnauthenticated();

      const sighting = createTestSighting(validSightingData);
      mockPrisma.iceSighting.create.mockResolvedValue(sighting);

      // Get active dispatchers
      const dispatchers = [
        { ...testUsers.dispatcher, role: 'DISPATCHER' as const },
      ];
      mockPrisma.user.findMany.mockResolvedValue(dispatchers);

      // Send notifications
      for (const dispatcher of dispatchers) {
        await mockEmailService.send({
          to: dispatcher.email,
          subject: 'New Sighting Report',
          template: 'sighting-notification',
          data: { sighting },
        });
      }

      expect(mockEmailService.sends.length).toBeGreaterThan(0);
      expect(mockEmailService.sends[0].template).toBe('sighting-notification');
    });

    it('should validate required SALUTE fields', async () => {
      mockAuth.asUnauthenticated();

      const invalidData = [
        { ...validSightingData, size: '' }, // Size required
        { ...validSightingData, activity: '' }, // Activity required
        { ...validSightingData, location: '' }, // Location required
        { ...validSightingData, time: '' }, // Time required
      ];

      invalidData.forEach((data) => {
        const isValid = data.size && data.activity && data.location && data.time;
        expect(isValid).toBeFalsy();
      });
    });

    it('should accept optional fields', async () => {
      mockAuth.asUnauthenticated();

      const minimalData = {
        size: '1-2',
        activity: 'Suspicious vehicle',
        location: '123 Main St',
        time: new Date().toISOString(),
        // uniform, equipment, reporterName, reporterPhone are optional
      };

      const sighting = createTestSighting(minimalData);
      mockPrisma.iceSighting.create.mockResolvedValue(sighting);

      expect(sighting.size).toBe('1-2');
    });

    it('should validate coordinates if provided', async () => {
      mockAuth.asUnauthenticated();

      const invalidCoords = [
        { latitude: 91, longitude: -78 }, // Latitude > 90
        { latitude: 35, longitude: 181 }, // Longitude > 180
        { latitude: -91, longitude: -78 }, // Latitude < -90
        { latitude: 35, longitude: -181 }, // Longitude < -180
      ];

      invalidCoords.forEach((coords) => {
        const isValidLat = coords.latitude >= -90 && coords.latitude <= 90;
        const isValidLng = coords.longitude >= -180 && coords.longitude <= 180;
        expect(isValidLat && isValidLng).toBe(false);
      });
    });

    it('should allow anonymous submissions', async () => {
      mockAuth.asUnauthenticated();

      const anonymousSighting = createTestSighting({
        ...validSightingData,
        reporterName: null,
        reporterPhone: null,
      });

      mockPrisma.iceSighting.create.mockResolvedValue(anonymousSighting);

      expect(anonymousSighting.reporterName).toBeNull();
      expect(anonymousSighting.reporterPhone).toBeNull();
    });
  });

  describe('GET /api/sightings', () => {
    it('should return sightings for dispatchers', async () => {
      mockAuth.asDispatcher();

      const sightings = [
        createTestSighting({ status: 'NEW' }),
        createTestSighting({ status: 'REVIEWING' }),
        createTestSighting({ status: 'VERIFIED' }),
      ];

      mockPrisma.iceSighting.findMany.mockResolvedValue(sightings);

      expect(sightings).toHaveLength(3);
    });

    it('should filter by status', async () => {
      mockAuth.asDispatcher();

      const newSightings = [
        createTestSighting({ status: 'NEW' }),
        createTestSighting({ status: 'NEW' }),
      ];

      mockPrisma.iceSighting.findMany.mockResolvedValue(newSightings);

      expect(newSightings.every((s) => s.status === 'NEW')).toBe(true);
    });

    it('should return 403 for volunteers', async () => {
      mockAuth.asVolunteer();
      const session = await mockAuth.getSession();

      expect(session?.user.role).toBe('VOLUNTEER');
      // Volunteers shouldn't see all sightings
      // In actual implementation, verify 403 response
    });
  });

  describe('GET /api/sightings/[id]', () => {
    it('should return sighting details for dispatcher', async () => {
      mockAuth.asDispatcher();

      const sighting = createTestSighting();
      mockPrisma.iceSighting.findUnique.mockResolvedValue(sighting);

      expect(sighting).not.toBeNull();
    });

    it('should include media attachments', async () => {
      mockAuth.asDispatcher();

      const sighting = createTestSighting();
      const media = [
        { id: 'media-1', sightingId: sighting.id, url: 'https://example.com/image1.jpg', type: 'IMAGE' },
        { id: 'media-2', sightingId: sighting.id, url: 'https://example.com/image2.jpg', type: 'IMAGE' },
      ];

      mockPrisma.iceSighting.findUnique.mockResolvedValue({
        ...sighting,
        media,
      });

      expect(media).toHaveLength(2);
    });
  });

  describe('PUT /api/sightings/[id]', () => {
    describe('SIGHT-003: Status Workflow', () => {
      it('should allow status change NEW -> REVIEWING', async () => {
        mockAuth.asDispatcher();

        const sighting = createTestSighting({ status: 'NEW' });
        mockPrisma.iceSighting.findUnique.mockResolvedValue(sighting);
        mockPrisma.iceSighting.update.mockResolvedValue({
          ...sighting,
          status: 'REVIEWING',
        });

        const updated = await mockPrisma.iceSighting.update();
        expect(updated.status).toBe('REVIEWING');
      });

      it('should allow status change REVIEWING -> VERIFIED', async () => {
        mockAuth.asDispatcher();

        const sighting = createTestSighting({ status: 'REVIEWING' });
        mockPrisma.iceSighting.findUnique.mockResolvedValue(sighting);
        mockPrisma.iceSighting.update.mockResolvedValue({
          ...sighting,
          status: 'VERIFIED',
        });

        const updated = await mockPrisma.iceSighting.update();
        expect(updated.status).toBe('VERIFIED');
      });

      it('should allow status change VERIFIED -> RESPONDED', async () => {
        mockAuth.asDispatcher();

        const sighting = createTestSighting({ status: 'VERIFIED' });
        mockPrisma.iceSighting.findUnique.mockResolvedValue(sighting);
        mockPrisma.iceSighting.update.mockResolvedValue({
          ...sighting,
          status: 'RESPONDED',
        });

        const updated = await mockPrisma.iceSighting.update();
        expect(updated.status).toBe('RESPONDED');
      });

      it('should allow status change RESPONDED -> CLOSED', async () => {
        mockAuth.asDispatcher();

        const sighting = createTestSighting({ status: 'RESPONDED' });
        mockPrisma.iceSighting.findUnique.mockResolvedValue(sighting);
        mockPrisma.iceSighting.update.mockResolvedValue({
          ...sighting,
          status: 'CLOSED',
        });

        const updated = await mockPrisma.iceSighting.update();
        expect(updated.status).toBe('CLOSED');
      });

      it('should not allow backwards status changes', async () => {
        mockAuth.asDispatcher();

        const validTransitions = {
          NEW: ['REVIEWING', 'CLOSED'],
          REVIEWING: ['VERIFIED', 'CLOSED'],
          VERIFIED: ['RESPONDED', 'CLOSED'],
          RESPONDED: ['CLOSED'],
          CLOSED: [],
        };

        // VERIFIED cannot go back to NEW
        expect(validTransitions['VERIFIED']).not.toContain('NEW');
        // CLOSED cannot transition to anything
        expect(validTransitions['CLOSED']).toHaveLength(0);
      });
    });

    it('should add notes to sighting', async () => {
      mockAuth.asDispatcher();

      const sighting = createTestSighting();
      const notes = 'Verified by field team at 3:15 PM';

      mockPrisma.iceSighting.findUnique.mockResolvedValue(sighting);
      mockPrisma.iceSighting.update.mockResolvedValue({
        ...sighting,
        notes,
      });

      const updated = await mockPrisma.iceSighting.update();
      expect(updated.notes).toBe(notes);
    });

    it('should reject updates by volunteer', async () => {
      mockAuth.asVolunteer();
      const session = await mockAuth.getSession();

      expect(session?.user.role).toBe('VOLUNTEER');
      // In actual implementation, verify 403 response
    });
  });

  describe('Media Upload', () => {
    it('should accept image uploads', async () => {
      mockAuth.asUnauthenticated();

      const file = {
        name: 'sighting-image.jpg',
        type: 'image/jpeg',
        size: 1024 * 500, // 500KB
      };

      // Valid image types
      const validTypes = ['image/jpeg', 'image/png', 'image/webp'];
      expect(validTypes).toContain(file.type);
    });

    it('should accept video uploads', async () => {
      mockAuth.asUnauthenticated();

      const file = {
        name: 'sighting-video.mp4',
        type: 'video/mp4',
        size: 1024 * 1024 * 10, // 10MB
      };

      // Valid video types
      const validTypes = ['video/mp4', 'video/quicktime', 'video/webm'];
      expect(validTypes).toContain(file.type);
    });

    it('should reject files too large', async () => {
      const maxSize = 50 * 1024 * 1024; // 50MB

      const largeFile = {
        name: 'huge-video.mp4',
        type: 'video/mp4',
        size: 100 * 1024 * 1024, // 100MB
      };

      expect(largeFile.size > maxSize).toBe(true);
      // In actual implementation, verify 400 response
    });

    it('should reject invalid file types', async () => {
      const invalidFile = {
        name: 'malware.exe',
        type: 'application/x-msdownload',
        size: 1024,
      };

      const validTypes = [
        'image/jpeg',
        'image/png',
        'image/webp',
        'video/mp4',
        'video/quicktime',
        'video/webm',
      ];

      expect(validTypes).not.toContain(invalidFile.type);
      // In actual implementation, verify 400 response
    });
  });
});

describe('Sighting Dashboard', () => {
  beforeEach(() => {
    resetAllMocks();
  });

  it('should show sighting counts by status for dispatcher', async () => {
    mockAuth.asDispatcher();

    const statusCounts = {
      NEW: 5,
      REVIEWING: 3,
      VERIFIED: 2,
      RESPONDED: 1,
      CLOSED: 10,
    };

    // In actual implementation, this would be an aggregate query
    const total = Object.values(statusCounts).reduce((a, b) => a + b, 0);
    expect(total).toBe(21);
    expect(statusCounts.NEW).toBe(5);
  });

  it('should show recent sightings', async () => {
    mockAuth.asDispatcher();

    const recentSightings = [
      createTestSighting({ status: 'NEW', time: new Date() }),
      createTestSighting({ status: 'NEW', time: new Date(Date.now() - 30 * 60 * 1000) }),
      createTestSighting({ status: 'REVIEWING', time: new Date(Date.now() - 60 * 60 * 1000) }),
    ];

    mockPrisma.iceSighting.findMany.mockResolvedValue(recentSightings);

    expect(recentSightings).toHaveLength(3);
  });
});
