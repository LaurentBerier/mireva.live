jest.mock('../../libraries/nestjs-libraries/src/database/prisma/agency/workspace.service', () => ({ WorkspaceService: class {} }));
import { ReviewService } from '../../libraries/nestjs-libraries/src/database/prisma/agency/review.service';

const service = new ReviewService(null as any, null as any);
test.each([
  ['2026-03-07T14:00:00.000Z', '2026-03-08T13:00:00.000Z'],
  ['2026-10-31T13:00:00.000Z', '2026-11-01T14:00:00.000Z'],
  ['2026-03-08T13:00:00.000Z', '2026-03-09T13:00:00.000Z'],
])('daily recurrence preserves 09:00 Toronto across DST from %s', (anchor, expected) => {
  expect(service.nextOccurrence(anchor, 1, 'America/Toronto')).toBe(expected);
});
test('a nonexistent spring-forward wall time advances through the gap', () => {
  expect(service.nextOccurrence('2026-03-07T07:30:00.000Z', 1, 'America/Toronto')).toBe('2026-03-08T07:30:00.000Z');
});
test('the next day restores the reviewed wall time after the spring-forward gap', () => {
  const anchor = '2026-03-07T07:30:00.000Z';
  const gap = service.nextOccurrence(anchor, 1, 'America/Toronto', anchor);
  expect(service.nextOccurrence(gap, 1, 'America/Toronto', anchor)).toBe('2026-03-09T06:30:00.000Z');
});
test('missed recurring dates advance to the next future wall time after worker downtime', () => {
  expect(service.availableOccurrence('2026-03-07T14:00:00.000Z', 1, 'America/Toronto', +new Date('2026-03-12T16:00:00Z'))).toBe('2026-03-13T13:00:00.000Z');
});
test('a recently missed occurrence can catch up once inside the two-hour grace window', () => {
  expect(service.availableOccurrence('2026-03-12T13:00:00.000Z', 1, 'America/Toronto', +new Date('2026-03-12T14:00:00Z'))).toBe('2026-03-12T13:00:00.000Z');
});
