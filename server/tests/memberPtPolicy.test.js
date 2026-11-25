// RM-10 business rule (Kamarudeen, 25 Nov): a member may cancel or move a PT session any time until it starts.
const request = require('supertest');
const app = require('../app');
const db = require('./helpers/db');
const { createTenant, createSubAdmin, createMember } = require('./helpers/factories');
const PTSession = require('../models/PTSession');

const MIN = 60000;
const bearer = (token) => ({ Authorization: `Bearer ${token}` });

describe('member PT cancel and reschedule (RM-10)', () => {
  beforeAll(async () => { await db.connect(); });
  afterAll(async () => { await db.clearDatabase(); await db.closeDatabase(); });

  const setup = async (startsInMin) => {
    const t = await createTenant();
    const { subAdmin } = await createSubAdmin(t.subscriber, {});
    const { member, token } = await createMember(t.subscriber, { assignedSubAdminId: subAdmin._id });
    const session = await PTSession.create({ subscriberId: t.subscriber._id, memberId: member._id, subAdminId: subAdmin._id, scheduledAt: new Date(Date.now() + startsInMin * MIN) });
    return { token, session };
  };

  test('cancel 30 minutes before the start is allowed (the old 2-hour rule is gone)', async () => {
    const { token, session } = await setup(30);
    const r = await request(app).patch(`/api/member/pt-sessions/${session._id}/cancel`).set(bearer(token));
    expect(r.status).toBe(200);
    expect((await PTSession.findById(session._id)).status).toBe('cancelled');
  });

  test('move 30 minutes before the start to later the same day is allowed', async () => {
    const { token, session } = await setup(30);
    const later = new Date(Date.now() + 180 * MIN).toISOString();
    const r = await request(app).put(`/api/member/pt-sessions/${session._id}/reschedule`).set(bearer(token)).send({ scheduledAt: later });
    expect(r.status).toBe(200);
    expect((await PTSession.findById(session._id)).scheduledAt.toISOString()).toBe(later);
  });

  test('a session that has already started cannot be cancelled or moved', async () => {
    const { token, session } = await setup(-5);
    expect((await request(app).patch(`/api/member/pt-sessions/${session._id}/cancel`).set(bearer(token))).status).toBe(400);
    expect((await request(app).put(`/api/member/pt-sessions/${session._id}/reschedule`).set(bearer(token)).send({ scheduledAt: new Date(Date.now() + 60 * MIN).toISOString() })).status).toBe(400);
    expect((await PTSession.findById(session._id)).status).toBe('scheduled');
  });

  test('moving to a time that has passed, or to a non-date, is refused', async () => {
    const { token, session } = await setup(120);
    for (const scheduledAt of [new Date(Date.now() - 60 * MIN).toISOString(), 'not-a-date']) {
      expect((await request(app).put(`/api/member/pt-sessions/${session._id}/reschedule`).set(bearer(token)).send({ scheduledAt })).status).toBe(400);
    }
  });
});
