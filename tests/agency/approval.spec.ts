import { randomUUID } from 'crypto';
import { PrismaService } from '../../libraries/nestjs-libraries/src/database/prisma/prisma.service';
import { ReviewRepository } from '../../libraries/nestjs-libraries/src/database/prisma/agency/review.repository';
import { AgencyDeliveryRepository } from '../../libraries/nestjs-libraries/src/database/prisma/agency/delivery.repository';
import { WorkspaceRepository } from '../../libraries/nestjs-libraries/src/database/prisma/agency/workspace.repository';
import { PostsRepository } from '../../libraries/nestjs-libraries/src/database/prisma/posts/posts.repository';
import { OAuthRepository } from '../../libraries/nestjs-libraries/src/database/prisma/oauth/oauth.repository';

const prisma = new PrismaService();
const reviews = new ReviewRepository(prisma);
const deliveries = new AgencyDeliveryRepository(prisma, reviews);
const workspace = new WorkspaceRepository(prisma, reviews);
const imports = new (require('../../libraries/nestjs-libraries/src/database/prisma/agency/import.repository').AgencyImportRepository)(prisma);
let orgId: string, otherOrgId: string, integrationId: string, userId: string;
const userIds: string[] = [];
afterEach(async () => {
  if (!orgId) return;
  await prisma.brandDeliveryAttempt.updateMany({ where: { organizationId: orgId, state: { in: ['RUNNING', 'UNCERTAIN', 'ACCEPTED_PENDING'] } }, data: { state: 'REJECTED' } });
  await prisma.brandDeliveryLease.updateMany({ where: { organizationId: orgId }, data: { state: 'RELEASED' } });
});

beforeAll(async () => {
  orgId = (
    await prisma.organization.create({
      data: { name: `Test ${randomUUID()}`, approvalRequired: true },
    })
  ).id;
  otherOrgId = (
    await prisma.organization.create({
      data: { name: `Other ${randomUUID()}`, approvalRequired: true },
    })
  ).id;
  const user = await prisma.user.create({
    data: {
      email: `${randomUUID()}@test.invalid`,
      providerName: 'GENERIC',
      timezone: 0,
      supabaseId: randomUUID(),
    },
  });
  userId = user.id;
  userIds.push(userId);
  integrationId = (
    await prisma.integration.create({
      data: {
        organizationId: orgId,
        internalId: randomUUID(),
        name: 'Test channel',
        providerIdentifier: 'bluesky',
        type: 'social',
        token: 'test-not-live',
      },
    })
  ).id;
  await prisma.userOrganization.create({
    data: { userId, organizationId: orgId, role: 'SUPERADMIN' },
  });
});
afterAll(async () => {
  const where = { organizationId: { in: [orgId, otherOrgId] } };
  await prisma.brandDeliveryAttempt.deleteMany({ where });
  await prisma.brandDeliveryLease.deleteMany({ where });
  await prisma.brandReview.deleteMany({ where });
  await prisma.brandImport.deleteMany({ where });
  await prisma.oAuthAuthorization.deleteMany({ where });
  await prisma.oAuthApp.deleteMany({ where });
  await prisma.post.deleteMany({ where });
  await prisma.media.deleteMany({ where });
  await prisma.integration.deleteMany({ where });
  await prisma.userOrganization.deleteMany({ where });
  await prisma.organization.deleteMany({
    where: { id: { in: [orgId, otherOrgId] } },
  });
  await prisma.user.deleteMany({ where: { id: { in: userIds } } });
  await prisma.$disconnect();
});
async function draft(image = '[]') {
  return prisma.post.create({
    data: {
      organizationId: orgId,
      integrationId,
      group: randomUUID(),
      content: 'Reviewed copy',
      image,
      publishDate: new Date(Date.now() + 86400000),
      state: 'DRAFT',
    },
  });
}
async function approve(post: Awaited<ReturnType<typeof draft>>) {
  const review = await reviews.request(orgId, post.group, userId);
  await reviews.decide(orgId, review.id, userId, 'APPROVED');
  await prisma.post.update({
    where: { id: post.id },
    data: { state: 'QUEUE' },
  });
  return review;
}
test('approval binds content, destination, schedule, and ready normalized media', async () => {
  const media = await prisma.media.create({
    data: {
      organizationId: orgId,
      name: 'photo.png',
      path: 'https://example.test/original.png',
      status: 'processing',
    },
  });
  const post = await draft(
    JSON.stringify([{ id: media.id, path: media.path }])
  );
  await expect(reviews.request(orgId, post.group, userId)).rejects.toThrow(
    'finish processing'
  );
  await prisma.media.update({
    where: { id: media.id },
    data: { status: 'ready' },
  });
  await approve(post);
  expect(await reviews.approvalForPost(orgId, post.id, 1)).toBe(true);
  expect(await reviews.approvalForPost(otherOrgId, post.id)).toBe(false);
  await prisma.media.update({
    where: { id: media.id },
    data: { path: 'https://example.test/normalized.png' },
  });
  expect(await reviews.approvalForPost(orgId, post.id)).toBe(false);
  const changed = await reviews.request(orgId, post.group, userId);
  await reviews.decide(orgId, changed.id, userId, 'APPROVED');
  await prisma.post.update({
    where: { id: post.id },
    data: {
      publishDate: new Date(Date.now() + 172800000),
      approvalVersion: { increment: 1 },
    },
  });
  expect(await reviews.approvalForPost(orgId, post.id, 1)).toBe(false);
});
test('foreign media cannot be approved', async () => {
  const media = await prisma.media.create({
    data: {
      organizationId: otherOrgId,
      name: 'private.png',
      path: 'private',
      status: 'ready',
    },
  });
  const post = await draft(JSON.stringify([{ id: media.id }]));
  await expect(reviews.request(orgId, post.group, userId)).rejects.toThrow(
    'belong to this brand'
  );
});

test('an old worker cannot use a later approval after a media-only change', async () => {
  const media = await prisma.media.create({ data: { organizationId: orgId, name: 'fingerprint.png', path: 'https://example.test/fingerprint.png', status: 'ready' } });
  const post = await draft(JSON.stringify([{ id: media.id }]));
  const original = await approve(post);
  await prisma.media.update({ where: { id: media.id }, data: { alt: 'Newly reviewed description', updatedAt: new Date(Date.now() + 1000) } });
  const next = await reviews.request(orgId, post.group, userId); await reviews.decide(orgId, next.id, userId, 'APPROVED');
  expect(await reviews.approvalForPost(orgId, post.id, 1)).toBe(true);
  expect(await reviews.approvalForPost(orgId, post.id, 1, original.fingerprint)).toBe(false);
  await expect(deliveries.claim(orgId, post.id, 1, 'old-media-worker', 'publish', 'fixture', original.fingerprint)).rejects.toThrow('changed after this workflow');
  const repository = new PostsRepository({model: prisma} as any, null as any, null as any, null as any, null as any, null as any, null as any, reviews);
  expect((await repository.failScheduledVersion(orgId, post.id, 1, 'old-media-worker', 'late failure', original.fingerprint)).count).toBe(0);
  expect((await prisma.post.findUniqueOrThrow({ where: { id: post.id } })).state).toBe('QUEUE');
  expect((await deliveries.claim(orgId, post.id, 1, 'new-media-worker', 'publish', 'fixture', next.fingerprint)).attempt.state).toBe('RUNNING');
});

test('private publishing options and thumbnails require owned ready media', async () => {
  const privatePath = `${process.env.FRONTEND_URL}/api/backend/media/private/${randomUUID()}.png`;
  const foreign = await prisma.media.create({ data: { organizationId: otherOrgId, name: 'foreign-thumb.png', path: privatePath, status: 'ready' } });
  const asset = await prisma.media.create({ data: { organizationId: orgId, name: 'owned.png', path: 'https://example.test/owned.png', status: 'ready' } });
  const post = await draft(JSON.stringify([{ id: asset.id, thumbnail: foreign.path }]));
  await expect(reviews.request(orgId, post.group, userId)).rejects.toThrow('thumbnails');
  await prisma.post.update({ where: { id: post.id }, data: { image: '[]', settings: JSON.stringify({ cover: foreign.path }) } });
  await expect(reviews.request(orgId, post.group, userId)).rejects.toThrow('outside this brand');
  const owned = await prisma.media.create({ data: { organizationId: orgId, name: 'owned-cover.png', path: `${privatePath}-own`, status: 'ready' } });
  await prisma.post.update({ where: { id: post.id }, data: { settings: JSON.stringify({ cover: owned.path }) } });
  await approve(post); expect(await reviews.approvalForPost(orgId, post.id)).toBe(true);
  await prisma.media.update({ where: { id: owned.id }, data: { alt: 'changed', updatedAt: new Date(Date.now() + 1000) } });
  expect(await reviews.approvalForPost(orgId, post.id)).toBe(false);
});

test('an importer cannot replace an existing deterministic row or write after losing its lease', async () => {
  const existing = await draft();
  const claim = await imports.begin(orgId, randomUUID(), 'fixture-csv', 'import-owner');
  const repository = new PostsRepository({model: prisma} as any, null as any, null as any, null as any, null as any, null as any, null as any, reviews);
  const body = { group: '', integration: { id: integrationId }, settings: { __type: 'bluesky' }, value: [{ id: existing.id, content: 'Must not replace staff edit', image: [], delay: 0 }] } as any;
  await repository.createOrUpdatePost('draft', orgId, existing.publishDate.toISOString(), body, [], 'WEB', undefined, false, undefined, { id: claim.record.id, owner: 'import-owner' });
  expect((await prisma.post.findUniqueOrThrow({ where: { id: existing.id } })).content).toBe(existing.content);
  await expect(repository.createOrUpdatePost('draft', orgId, existing.publishDate.toISOString(), body, [], 'WEB', undefined, false, undefined, { id: claim.record.id, owner: 'old-owner' })).rejects.toThrow('ownership');
});
test('concurrent decisions produce only one decision', async () => {
  const post = await draft();
  const review = await reviews.request(orgId, post.group, userId);
  const outcomes = await Promise.allSettled([
    reviews.decide(orgId, review.id, userId, 'APPROVED'),
    reviews.decide(orgId, review.id, userId, 'CHANGES_REQUESTED'),
  ]);
  expect(
    outcomes.filter((result) => result.status === 'fulfilled')
  ).toHaveLength(1);
});
test('claim freezes the group, rejects duplicate attempts, and retains uncertain outcomes', async () => {
  const post = await draft();
  await approve(post);
  const claim = await deliveries.claim(orgId, post.id, 1, 'run-one', 'publish');
  await expect(
    reviews.edit(orgId, [post.group], (tx) =>
      tx.post.update({ where: { id: post.id }, data: { content: 'Changed' } })
    )
  ).rejects.toThrow('Publishing is in progress');
  await expect(
    deliveries.claim(orgId, post.id, 1, 'run-one', 'publish')
  ).rejects.toThrow('may already');
  const independent = await draft();
  await reviews.edit(orgId, [independent.group], (tx) =>
    tx.post.update({
      where: { id: independent.id },
      data: { content: 'Independent edit' },
    })
  );
  await deliveries.finish(claim.attempt.id, 'UNCERTAIN');
  await deliveries.release(orgId, 'run-one');
  await expect(
    deliveries.claim(orgId, post.id, 1, 'run-two', 'publish')
  ).rejects.toThrow('earlier delivery');
});
test('successful persisted delivery is returned and later occurrences can claim after release', async () => {
  const post = await draft();
  await approve(post);
  const claim = await deliveries.claim(orgId, post.id, 1, 'run-ok', 'publish');
  await deliveries.finish(
    claim.attempt.id,
    'SUCCEEDED',
    'test-encrypted-result'
  );
  expect(
    (await deliveries.claim(orgId, post.id, 1, 'run-ok', 'publish')).attempt
      .result
  ).toBe('test-encrypted-result');
  await deliveries.release(orgId, 'run-ok');
  expect(
    (await deliveries.claim(orgId, post.id, 1, 'replacement-run', 'publish'))
      .attempt.result
  ).toBe('test-encrypted-result');
  await deliveries.release(orgId, 'replacement-run');
  expect(
    (
      await deliveries.claim(
        orgId,
        post.id,
        1,
        'next-occurrence',
        'publish',
        'next-month'
      )
    ).attempt.state
  ).toBe('RUNNING');
});
test('a cancellation or obsolete worker payload cannot claim a publish', async () => {
  const post = await draft();
  await approve(post);
  await prisma.post.update({
    where: { id: post.id },
    data: { state: 'DRAFT' },
  });
  await expect(
    deliveries.claim(orgId, post.id, 1, 'cancelled', 'publish')
  ).rejects.toThrow('cancelled or changed');
});
test('a reviewed thread schedules and publishes both root and delayed child', async () => {
  const root = await draft();
  const child = await prisma.post.create({
    data: {
      organizationId: orgId,
      integrationId,
      group: root.group,
      parentPostId: root.id,
      content: 'Reviewed follow-up',
      image: '[]',
      publishDate: root.publishDate,
      state: 'DRAFT',
      delay: 2,
    },
  });
  const review = await reviews.request(orgId, root.group, userId);
  await reviews.decide(orgId, review.id, userId, 'APPROVED');
  const repository = new PostsRepository(
    { model: prisma } as any,
    null as any,
    null as any,
    null as any,
    null as any,
    null as any,
    null as any,
    reviews
  );
  await repository.changeScheduledState(orgId, root.id, 'QUEUE');
  const first = await deliveries.claim(
    orgId,
    root.id,
    1,
    'thread-run',
    'publish'
  );
  await deliveries.finish(first.attempt.id, 'SUCCEEDED', '{}');
  await prisma.post.update({
    where: { id: root.id },
    data: { state: 'PUBLISHED' },
  });
  expect(
    (await deliveries.claim(orgId, child.id, 1, 'thread-run', 'comment'))
      .attempt.state
  ).toBe('RUNNING');
});
test('calendar date edits invalidate the whole reviewed thread even with update action', async () => {
  const root = await draft(); const child = await prisma.post.create({ data: { organizationId: orgId, integrationId, group: root.group, parentPostId: root.id, content: 'Child', image: '[]', publishDate: root.publishDate, state: 'DRAFT' } });
  await approve(root);
  const repository = new PostsRepository({model: prisma} as any, null as any, null as any, null as any, null as any, null as any, null as any, reviews);
  const changed = new Date(Date.now() + 172800000).toISOString();
  await repository.changeDate(orgId, root.id, changed, true, 'update');
  const children = await prisma.post.findMany({ where: { id: { in: [root.id, child.id] } } });
  expect(children.every(post => post.state === 'DRAFT' && post.approvalVersion === 2 && post.publishDate.toISOString() === changed)).toBe(true);
  expect(await reviews.approvalForPost(orgId, root.id)).toBe(false);
});
test('brand timezone and native destination configuration invalidate approval without revealing credentials', async () => {
  const post = await draft(); await approve(post);
  await workspace.updateBrand(orgId, { timezoneName: 'Europe/Paris' });
  expect(await reviews.approvalForPost(orgId, post.id)).toBe(false);
  await workspace.updateBrand(orgId, { timezoneName: 'America/Toronto' });
  await prisma.integration.update({ where: { id: integrationId }, data: { customInstanceDetails: JSON.stringify({ url: 'https://instance.example', password: 'fixture-secret' }) } });
  const snapshot = await reviews.snapshot(orgId, post.group);
  expect(JSON.stringify(snapshot.snapshot)).not.toContain('fixture-secret');
  expect(JSON.stringify(snapshot.snapshot)).not.toContain('customInstanceDetails');
  expect(await reviews.approvalForPost(orgId, post.id)).toBe(false);
});
test('disabled and reviewer memberships cannot use an already-issued OAuth token', async () => {
  const user = await prisma.user.create({ data: { email: `${randomUUID()}@test.invalid`, providerName: 'GENERIC', timezone: 0 } }); userIds.push(user.id);
  const membership = await prisma.userOrganization.create({ data: { organizationId: orgId, userId: user.id, role: 'USER' } });
  const app = await prisma.oAuthApp.create({ data: { organizationId: orgId, name: 'OAuth fixture', clientId: randomUUID(), redirectUrl: 'http://localhost/callback' } });
  const token = randomUUID(); await prisma.oAuthAuthorization.create({ data: { oauthAppId: app.id, organizationId: orgId, userId: user.id, accessToken: token } });
  const repository = new OAuthRepository({model: prisma} as any, {model: prisma} as any, {model: prisma} as any, {model: prisma} as any);
  expect(await repository.findByAccessToken(token)).toBeTruthy();
  await prisma.userOrganization.update({ where: { id: membership.id }, data: { disabled: true } }); expect(await repository.findByAccessToken(token)).toBeNull();
  await prisma.userOrganization.update({ where: { id: membership.id }, data: { disabled: false, role: 'REVIEWER' } }); expect(await repository.findByAccessToken(token)).toBeNull();
});
test('an accepted pending delivery remains frozen if completion cannot be confirmed', async () => {
  const post = await draft();
  await approve(post);
  const first = await deliveries.claim(
    orgId,
    post.id,
    1,
    'pending-old',
    'publish'
  );
  await deliveries.finish(first.attempt.id, 'ACCEPTED_PENDING', '{}');
  // A replacement cannot acquire an active owner lease. Operator recovery must retain pending uncertainty.
  await deliveries.release(orgId, 'pending-old');
  await expect(
    deliveries.claim(orgId, post.id, 1, 'pending-new', 'publish')
  ).rejects.toThrow('earlier delivery');
  await expect(
    reviews.edit(orgId, [post.group], (tx) =>
      tx.post.update({
        where: { id: post.id },
        data: { content: 'Unsafe replacement' },
      })
    )
  ).rejects.toThrow('reconciliation');
});
test('invitation cannot downgrade the agency owner and disabled clients lose brand access', async () => {
  const agency = await prisma.agencyWorkspace.create({
    data: { name: `Test agency ${randomUUID()}` },
  });
  const owner = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
  await expect(
    workspace.grantMembership(
      agency.id,
      orgId,
      owner.email,
      owner.supabaseId!,
      'REVIEWER'
    )
  ).rejects.toThrow('cannot change');
  const invited = await workspace.grantMembership(
    agency.id,
    orgId,
    `${randomUUID()}@test.invalid`,
    randomUUID(),
    'REVIEWER'
  );
  userIds.push(invited.id);
  expect(
    (await workspace.context(invited.id, otherOrgId)).current
  ).toBeUndefined();
  const member = await prisma.userOrganization.findUniqueOrThrow({
    where: {
      userId_organizationId: { userId: invited.id, organizationId: orgId },
    },
  });
  await workspace.updateMember(orgId, userId, member.id, { disabled: true });
  expect((await workspace.context(invited.id, orgId)).current).toBeUndefined();
  await prisma.agencyWorkspace.delete({ where: { id: agency.id } });
});

test('operator-confirmed publication cannot execute the same occurrence again', async () => {
  const post = await draft(); await approve(post);
  const claimed = await deliveries.claim(orgId, post.id, 1, 'reconciled-old', 'publish', 'fixture-occurrence');
  await deliveries.finish(claimed.attempt.id, 'UNCERTAIN');
  await deliveries.reconcile(orgId, claimed.attempt.id, userId, 'PUBLISHED', 'Confirmed in the native network during isolated QA', 'native-fixture', 'https://example.test/native-fixture');
  await expect(deliveries.claim(orgId, post.id, 1, 'reconciled-new', 'publish', 'fixture-occurrence')).rejects.toThrow('reconciled');
  const repository = new PostsRepository({model: prisma} as any, null as any, null as any, null as any, null as any, null as any, null as any, reviews);
  expect((await repository.failScheduledVersion(orgId, post.id, 1, 'reconciled-new', 'late retry')).count).toBe(0);
  expect((await prisma.post.findUniqueOrThrow({ where: { id: post.id } })).state).toBe('PUBLISHED');
});

test('late workflow failures cannot overwrite a cancelled or edited version', async () => {
  const post = await draft(); await approve(post);
  const repository = new PostsRepository({model: prisma} as any, null as any, null as any, null as any, null as any, null as any, null as any, reviews);
  await repository.changeScheduledState(orgId, post.id, 'DRAFT');
  expect((await repository.failScheduledVersion(orgId, post.id, 1, 'old-worker', 'late failure')).count).toBe(0);
  await repository.changeScheduledState(orgId, post.id, 'QUEUE');
  expect((await repository.failScheduledVersion(orgId, post.id, 1, 'old-worker', 'late failure')).count).toBe(0);
  expect((await prisma.post.findUniqueOrThrow({ where: { id: post.id } })).state).toBe('QUEUE');
});

test('expired import leases resume under one owner and fence the old worker', async () => {
  const requestId = randomUUID();
  const first = await imports.begin(orgId, requestId, 'same-csv', 'worker-one');
  await expect(imports.begin(orgId, requestId, 'same-csv', 'worker-two')).rejects.toThrow('running');
  await prisma.brandImport.update({ where: { id: first.record.id }, data: { leaseUntil: new Date(Date.now() - 1000) } });
  const second = await imports.begin(orgId, requestId, 'same-csv', 'worker-two');
  expect(second.record.id).toBe(first.record.id);
  await expect(imports.renew(first.record.id, 'worker-one')).rejects.toThrow('ownership');
  await imports.finish(first.record.id, 'worker-two', 'COMPLETED', [{ row: 2, postId: 'fixture' }]);
  expect((await imports.begin(orgId, requestId, 'same-csv', 'worker-three')).cached).toBe(true);
});
