const { buildIdeas } = require('../src/marketingIdeas');
const now = new Date('2026-11-10T06:00:00Z'), d = (n) => new Date(now.getTime() - n * 864e5);
describe('hire marketing ideas', () => {
  test('nothing to suggest with no data', () => { expect(buildIdeas(null, now)).toEqual([]); expect(buildIdeas({}, now)).toEqual([]); });
  test('thin open job gets a post draft; new job (under 2 days) does not', () => {
    const a = buildIdeas({ jobs: [{ id: 'j1', title: 'Accountant', location: 'Chennai', status: 'open', createdAt: d(5), clientId: 'c1' }], entries: [], clients: [] }, now);
    expect(a[0].kind).toBe('post_job'); expect(a[0].draft).toMatch(/Accountant in Chennai/); expect(a[0].level).toBe('suggest');
    expect(buildIdeas({ jobs: [{ id: 'j1', title: 'X', status: 'open', createdAt: d(1) }], entries: [] }, now)).toEqual([]);
  });
  test('stale submissions and idle clients; at most 3', () => {
    const a = buildIdeas({ jobs: [{ id: 'j1', title: 'A', status: 'open', createdAt: d(9), lastSubmissionAt: d(8), clientId: 'c1' }], entries: [{ jobId: 'j1' }, { jobId: 'j1' }, { jobId: 'j1' }], clients: [{ id: 'c1', name: 'One' }, { id: 'c2', name: 'Two' }] }, now);
    expect(a.map((x) => x.kind)).toEqual(['client_update', 'client_checkin']); expect(a[1].title).toMatch(/Two/);
  });
});
