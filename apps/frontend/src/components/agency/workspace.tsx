'use client';
import { FormEvent, ReactNode, useEffect, useState } from 'react';
import useSWR from 'swr';
import Link from 'next/link';
import { useFetch } from '@gitroom/helpers/utils/custom.fetch';
import { useUser } from '@gitroom/frontend/components/layout/user.context';
import { AgencyTools } from './workspace.tools';
import { browserMediaUrl } from '@gitroom/react/helpers/browser.media.url';
import { setUserTimezone } from '@gitroom/frontend/components/layout/set.timezone';

export function useAgencyResource<T>(path: string | null) {
  const fetch = useFetch();
  const result = useSWR<T>(
    path,
    async (url) => {
      const response = await fetch(url);
      const data = await response.json();
      if (!response.ok)
        throw new Error(data.message || 'Unable to load this section');
      return data;
    },
    { revalidateOnFocus: false }
  );
  useEffect(() => {
    const reload = () => {
      if (path) void result.mutate();
    };
    window.addEventListener('agency-update', reload);
    return () => window.removeEventListener('agency-update', reload);
  }, [path, result.mutate]);
  return result;
}
export function Panel({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-xl border border-[var(--new-border)] bg-[var(--new-bgColorInner)] p-5">
      <h2 className="mb-4 text-lg font-semibold">{title}</h2>
      {children}
    </section>
  );
}
export const control =
  'rounded-lg border border-[var(--new-border)] bg-[var(--new-bgColor)] p-3 text-base';
export const action =
  'rounded-lg bg-[#612bd3] px-4 py-3 text-sm font-semibold text-white disabled:opacity-50';
type Context = {
  current: {
    role: string;
    organization: {
      id: string;
      name: string;
      agencyId: string;
      timezoneName: string;
      approvalRequired: boolean;
    };
  };
  brands: Context['current'][];
  memberships: { agencyId: string; role: string }[];
};
type Review = {
  id: string;
  group: string;
  state: string;
  current: boolean;
  createdAt: string;
  comment?: string;
  snapshot: {
    id: string;
    content: string;
    publishDate: string;
    integrationId: string;
    image?: string;
    integration?: { name: string; providerIdentifier: string };
    assets?: { id: string; path: string; alt?: string; thumbnail?: string }[];
    settings?: string;
    intervalInDays?: number;
    brandTimezone?: string;
    automations?: {
      action: string;
      preview: { name: string; value: string }[];
    }[];
  }[];
};

function Reviews({
  reviewer,
  run,
}: {
  reviewer: boolean;
  run: (path: string, body: unknown) => Promise<void>;
}) {
  const { data: reviews, error } =
    useAgencyResource<Review[]>('/agency/reviews');
  const { data: drafts } = useAgencyResource<any[]>(
    reviewer ? null : '/agency/drafts'
  );
  return (
    <div className="grid gap-5 lg:grid-cols-2">
      {!reviewer && (
        <Panel title="Drafts ready for review">
          <p className="mb-4 text-sm opacity-70">
            Set the publishing date in the calendar, save as a draft, then
            request approval.
          </p>
          {drafts?.length === 0 && (
            <p>
              No drafts yet.{' '}
              <Link className="underline" href="/launches">
                Open the calendar
              </Link>
              .
            </p>
          )}
          {drafts?.map((draft) => (
            <article
              key={draft.id}
              className="border-t border-[var(--new-border)] py-4"
            >
              <p className="text-sm opacity-70">
                {draft.integration.name} /{' '}
                {new Date(draft.publishDate).toLocaleString()}
              </p>
              <p className="my-3 whitespace-pre-wrap">
                {draft.content.replace(/<[^>]*>/g, '')}
              </p>
              <button
                className={action}
                onClick={() =>
                  void run('/agency/reviews', { group: draft.group })
                }
              >
                Request approval
              </button>
            </article>
          ))}
        </Panel>
      )}
      <Panel title="Client reviews">
        {error && <p role="alert">{error.message}</p>}
        {reviews?.length === 0 && <p>No review requests yet.</p>}
        {reviews?.map((review) => (
          <article
            key={review.id}
            className="border-t border-[var(--new-border)] py-4"
          >
            <p className="text-sm font-semibold text-[#bd9fff]">
              {review.current
                ? review.state.replaceAll('_', ' ')
                : 'SUPERSEDED'}
            </p>
            {review.snapshot.map((post) => (
              <div key={post.id} className="my-3">
                <p className="text-sm opacity-70">
                  {post.integration?.name} /{' '}
                  {post.integration?.providerIdentifier} /{' '}
                  {new Date(post.publishDate).toLocaleString(undefined, {
                    timeZone: post.brandTimezone || 'America/Toronto',
                    timeZoneName: 'shortOffset',
                  })}{' '}
                  ({post.brandTimezone || 'America/Toronto'})
                </p>
                <p className="mt-2 whitespace-pre-wrap">
                  {post.content.replace(/<[^>]*>/g, '')}
                </p>
                {post.intervalInDays && (
                  <p className="mt-3 text-sm">
                    Repeats every {post.intervalInDays} day(s) in{' '}
                    {post.brandTimezone}.
                  </p>
                )}
                <ReviewOptions settings={post.settings} />
                {post.automations?.map((automation, index) => (
                  <div
                    key={index}
                    className="my-3 rounded-lg border border-[var(--new-border)] p-3 text-sm"
                  >
                    <p>
                      After publishing:{' '}
                      {automation.action.replace(/([a-z])([A-Z])/g, '$1 $2')}
                    </p>
                    {automation.preview.map((field) => (
                      <p key={field.name} className="mt-2 whitespace-pre-wrap">
                        {field.value}
                      </p>
                    ))}
                  </div>
                ))}
                {(() => {
                  try {
                    return (post.assets || JSON.parse(post.image || '[]')).map(
                      (image: any) =>
                        image.path && (
                          <div key={image.id || image.path} className="my-4">
                            {/\.mp4(?:$|\?)/i.test(image.path) ? (
                              <video
                                src={browserMediaUrl(image.path)}
                                controls
                                preload="metadata"
                                className="max-h-64 max-w-full rounded-lg"
                              />
                            ) : (
                              <img
                                src={browserMediaUrl(image.path)}
                                alt={image.alt || 'Reviewed attachment'}
                                className="max-h-64 max-w-full rounded-lg object-contain"
                              />
                            )}
                            {image.alt && (
                              <p className="mt-2 text-sm opacity-70">
                                Alt text: {image.alt}
                              </p>
                            )}
                            <a
                              key={image.id || image.path}
                              href={browserMediaUrl(image.path)}
                              target="_blank"
                              rel="noreferrer"
                              className="mr-3 text-sm underline"
                            >
                              View attachment
                            </a>
                          </div>
                        )
                    );
                  } catch {
                    return null;
                  }
                })()}
              </div>
            ))}
            {review.comment && (
              <p className="mb-3 text-sm">Feedback: {review.comment}</p>
            )}
            {reviewer && review.current && review.state === 'PENDING' && (
              <ReviewDecision review={review} run={run} />
            )}
            {!reviewer && review.current && review.state === 'APPROVED' && (
              <button
                className={action}
                onClick={() =>
                  void run(`/agency/reviews/${review.id}/schedule`, {})
                }
              >
                Schedule approved post
              </button>
            )}
          </article>
        ))}
      </Panel>
    </div>
  );
}
function ReviewOptions({ settings }: { settings?: string }) {
  let options: Record<string, unknown> = {};
  try {
    options = JSON.parse(settings || '{}');
  } catch {
    return <p>Publishing options are unavailable.</p>;
  }
  const fields = Object.entries(options).filter(
    ([key]) =>
      key !== '__type' &&
      !/password|secret|token|cookie|authorization|api.?key/i.test(key)
  );
  if (!fields.length) return null;
  const display = (value: unknown): string =>
    value === true
      ? 'Enabled'
      : value === false
      ? 'Disabled'
      : value == null
      ? 'Not set'
      : Array.isArray(value)
      ? value.map(display).join(', ')
      : typeof value === 'object'
      ? Object.entries(value)
          .map(([key, item]) => `${key}: ${display(item)}`)
          .join('; ')
      : String(value);
  return (
    <details className="my-3 text-sm">
      <summary className="cursor-pointer">Publishing options</summary>
      <dl className="mt-3 grid gap-2">
        {fields.map(([key, value]) => (
          <div key={key}>
            <dt className="font-semibold capitalize">
              {key.replace(/[_-]+/g, ' ').replace(/([a-z])([A-Z])/g, '$1 $2')}
            </dt>
            <dd className="whitespace-pre-wrap break-words opacity-75">
              {display(value)}
            </dd>
          </div>
        ))}
      </dl>
    </details>
  );
}
function ReviewDecision({
  review,
  run,
}: {
  review: Review;
  run: (path: string, body: unknown) => Promise<void>;
}) {
  const [comment, setComment] = useState('');
  return (
    <div className="flex flex-col gap-3">
      <label className="text-sm">
        Feedback
        <textarea
          className={`${control} mt-2 w-full`}
          value={comment}
          onChange={(event) => setComment(event.target.value)}
          maxLength={5000}
        />
      </label>
      <div className="flex flex-wrap gap-3">
        <button
          className={action}
          onClick={() =>
            void run(`/agency/reviews/${review.id}/decision`, {
              state: 'APPROVED',
              comment,
            })
          }
        >
          Approve this version
        </button>
        <button
          className={control}
          onClick={() =>
            void run(`/agency/reviews/${review.id}/decision`, {
              state: 'CHANGES_REQUESTED',
              comment,
            })
          }
        >
          Request changes
        </button>
      </div>
    </div>
  );
}
function Team({
  run,
}: {
  run: (path: string, body: unknown, method?: string) => Promise<void>;
}) {
  const { data: members, error } = useAgencyResource<any[]>('/agency/members');
  return (
    <Panel title="Staff and client access">
      <p className="mb-4 text-sm opacity-70">Removing administrator access rotates this brand's shared API key. Update any automations using that key. Individual OAuth access is revoked for a removed member.</p>
      <form
        className="mb-6 flex flex-wrap gap-3"
        onSubmit={(event) => {
          event.preventDefault();
          void run(
            '/agency/members',
            Object.fromEntries(new FormData(event.currentTarget))
          );
        }}
      >
        <input
          name="email"
          type="email"
          required
          placeholder="Email address"
          aria-label="Email address"
          className={control}
        />
        <select className={control} name="role" aria-label="Brand role">
          <option value="REVIEWER">Client reviewer</option>
          <option value="USER">Staff editor</option>
          <option value="ADMIN">Brand administrator</option>
        </select>
        <button className={action}>Send invitation</button>
      </form>
      {error && <p role="alert">{error.message}</p>}
      {members?.map((member) => (
        <div
          key={member.id}
          className="flex justify-between border-t border-[var(--new-border)] py-3"
        >
          <span>{member.user.email}</span>
          {member.role === 'SUPERADMIN' ? (
            <span className="text-sm opacity-70">Agency owner</span>
          ) : (
            <div className="flex flex-wrap gap-3">
              <select
                className={control}
                aria-label={`Role for ${member.user.email}`}
                value={member.role}
                onChange={(event) =>
                  void run(
                    `/agency/members/${member.id}`,
                    { role: event.target.value },
                    'PATCH'
                  )
                }
              >
                <option value="REVIEWER">Client reviewer</option>
                <option value="USER">Staff editor</option>
                <option value="ADMIN">Brand administrator</option>
              </select>
              <button
                className={control}
                onClick={() =>
                  void run(
                    `/agency/members/${member.id}`,
                    { disabled: true },
                    'PATCH'
                  )
                }
              >
                Revoke brand access
              </button>
            </div>
          )}
        </div>
      ))}
    </Panel>
  );
}
function Connections() {
  const { data: connections } = useAgencyResource<any[]>('/agency/connections');
  const { data: inventory } = useAgencyResource<any>('/agency/inventory');
  return (
    <div className="grid gap-5">
      <Panel title="Connected profiles">
        {connections?.length === 0 && (
          <p>
            No profiles connected.{' '}
            <Link href="/launches" className="underline">
              Connect a channel from the calendar
            </Link>
            .
          </p>
        )}
        {connections?.map((connection) => (
          <div
            className="flex flex-wrap justify-between gap-2 border-t border-[var(--new-border)] py-3"
            key={connection.id}
          >
            <span>
              {connection.name}{' '}
              <span className="text-sm opacity-70">
                {connection.providerIdentifier}
              </span>
            </span>
            <span className="text-sm">
              {connection.status.replaceAll('_', ' ')}
            </span>
          </div>
        ))}
      </Panel>
      <Panel title="Network inventory">
        <p className="mb-5 text-sm opacity-70">
          Implementation, credentials, platform review, and live verification
          are tracked independently.
        </p>
        <div className="overflow-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr>
                {[
                  'Network',
                  'Adapter',
                  'Credentials',
                  'Platform review',
                  'Live test',
                ].map((label) => (
                  <th className="p-3" key={label}>
                    {label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {inventory?.providers.map((provider: any) => (
                <tr
                  className="border-t border-[var(--new-border)]"
                  key={provider.id}
                >
                  <td className="p-3">{provider.name}</td>
                  <td className="p-3">
                    {provider.registered ? 'Inherited' : 'Inactive'}
                  </td>
                  <td className="p-3">
                    {provider.credentialStatus.replaceAll('_', ' ')}
                  </td>
                  <td className="p-3">
                    {provider.approvalStatus.replaceAll('_', ' ')}
                  </td>
                  <td className="p-3">
                    {provider.liveVerificationStatus.replaceAll('_', ' ')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  );
}
function Operations() {
  const { data, error } = useAgencyResource<any>('/agency/operations');
  return (
    <Panel title="Publishing and synchronization">
      {error && <p role="alert">Operational status is unavailable.</p>}
      {!data && !error && <p>Loading operational status...</p>}
      {data && (
        <>
          <p className="mb-4 text-sm opacity-70">
            {data.publishingEnabled
              ? 'Live delivery enabled'
              : 'Live delivery disabled'}{' '}
            /{' '}
            {data.maintenanceEnabled
              ? 'Automatic synchronization enabled'
              : 'Automatic synchronization pending activation'}
          </p>
          <div className="grid grid-cols-2 gap-4 md:grid-cols-5">
            {[
              ['Failed publishes', data.failedPublishes],
              ['Overdue jobs', data.overdueJobs],
              ['Connections need attention', data.disconnected],
              ['Uncertain deliveries', data.uncertainDeliveries],
              ['Overdue reports', data.overdueReports],
            ].map(([label, count]) => (
              <div
                key={label}
                className="rounded-lg border border-[var(--new-border)] p-4"
              >
                <p className="text-2xl font-semibold">{count}</p>
                <p className="mt-2 text-sm opacity-70">{label}</p>
              </div>
            ))}
          </div>
          {data.synchronizations.slice(0, 5).map((run: any) => (
            <p className="mt-3 text-sm" key={run.id}>
              {run.kind} / {run.status} /{' '}
              {new Date(run.createdAt).toLocaleString()}
            </p>
          ))}
        </>
      )}
    </Panel>
  );
}
export function AgencyWorkspace() {
  const fetch = useFetch();
  const user = useUser();
  const reviewer = user?.role === 'REVIEWER';
  const [tab, setTab] = useState(reviewer ? 'Reviews' : 'Overview');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const {
    data: context,
    error,
    mutate,
  } = useAgencyResource<Context>('/agency/context');
  useEffect(() => {
    if (context?.current.organization.timezoneName) setUserTimezone(context.current.organization.timezoneName);
  }, [context?.current.organization.timezoneName]);
  async function run(path: string, body: unknown, method = 'POST') {
    setBusy(true);
    setMessage('');
    try {
      const response = await fetch(path, {
        method,
        body: JSON.stringify(body),
      });
      const result = await response.json();
      if (!response.ok)
        throw new Error(result.message || 'The action could not be completed');
      setMessage('Saved');
      await mutate();
      window.dispatchEvent(new Event('agency-update'));
    } catch (error) {
      setMessage((error as Error).message);
    } finally {
      setBusy(false);
    }
  }
  if (error)
    return (
      <p role="alert" className="p-8">
        {error.message}
      </p>
    );
  if (!context)
    return (
      <p role="status" className="p-8">
        Loading your workspace...
      </p>
    );
  const org = context.current.organization;
  const admin = ['ADMIN', 'SUPERADMIN'].includes(context.current.role);
  const agencyAdmin = context.memberships.some(
    (member) =>
      member.agencyId === org.agencyId &&
      ['ADMIN', 'SUPERADMIN'].includes(member.role)
  );
  const tabs = reviewer
    ? ['Reviews', 'Reports']
    : [
        'Overview',
        'Reviews',
        'Connections',
        'Imports',
        'Deliveries',
        'Insights',
        'Reports',
        'Inbox',
        'Flows',
        'SmartLinks',
        'Websites',
        'Ads',
        ...(admin ? ['Team'] : []),
      ];
  return (
    <div className="mx-auto w-full max-w-[1600px] p-4 text-base md:p-8">
      <header className="mb-7 flex flex-wrap items-start justify-between gap-5">
        <div>
          <p className="text-sm font-semibold uppercase tracking-widest text-[#bd9fff]">
            Agency workspace
          </p>
          <h1 className="mt-2 text-3xl font-semibold">{org.name}</h1>
          <p className="mt-2 text-sm opacity-70">
            {org.timezoneName} /{' '}
            {org.approvalRequired
              ? 'Client approval required'
              : 'Staff publishing enabled'}
          </p>
        </div>
        <label className="flex flex-col gap-2 text-sm">
          Active brand
          <select
            className={control}
            value={org.id}
            onChange={async (event) => {
              const response = await window.fetch('/api/auth/brand', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: event.target.value }),
              });
              if (response.ok) window.location.reload();
              else setMessage('Unable to switch brand');
            }}
          >
            {context.brands.map((brand) => (
              <option value={brand.organization.id} key={brand.organization.id}>
                {brand.organization.name}
              </option>
            ))}
          </select>
        </label>
      </header>
      <nav aria-label="Agency tools" className="mb-6 flex flex-wrap gap-2">
        {tabs.map((item) => (
          <button
            key={item}
            onClick={() => setTab(item)}
            aria-current={tab === item ? 'page' : undefined}
            className={`rounded-lg px-4 py-3 text-sm ${
              tab === item
                ? 'bg-[#612bd3] text-white'
                : 'border border-[var(--new-border)]'
            }`}
          >
            {item}
          </button>
        ))}
      </nav>
      {message && (
        <p
          role="status"
          className="mb-5 rounded-lg border border-[var(--new-border)] p-4"
        >
          {message}
        </p>
      )}
      <div aria-busy={busy}>
        {tab === 'Overview' && (
          <div className="grid gap-5 lg:grid-cols-2">
            <div className="lg:col-span-2">
              <Operations />
            </div>
            <Panel title="Plan, review, publish">
              <p className="mb-5 opacity-80">
                Create channel-specific content in your calendar. Submit drafts
                for review and schedule the approved version.
              </p>
              <div className="flex flex-wrap gap-3">
                <Link href="/launches" className={action}>
                  Open calendar
                </Link>
                <button className={control} onClick={() => setTab('Reviews')}>
                  Review drafts
                </button>
              </div>
            </Panel>
            <Panel title="Brand settings">
              <form
                className="flex flex-col gap-3"
                onSubmit={(event) => {
                  event.preventDefault();
                  const fields = Object.fromEntries(
                    new FormData(event.currentTarget)
                  );
                  void run(
                    '/agency/brand',
                    {
                      name: fields.name,
                      timezoneName: fields.timezoneName,
                      ...(agencyAdmin
                        ? { approvalRequired: fields.approvalRequired === 'on' }
                        : {}),
                    },
                    'PATCH'
                  );
                }}
              >
                <label className="text-sm">
                  Brand name
                  <input
                    disabled={!admin}
                    name="name"
                    defaultValue={org.name}
                    className={`${control} mt-2 w-full`}
                    required
                  />
                </label>
                <label className="text-sm">
                  Timezone
                  <input
                    disabled={!admin}
                    name="timezoneName"
                    defaultValue={org.timezoneName}
                    className={`${control} mt-2 w-full`}
                    required
                  />
                </label>
                <label className="flex items-center gap-3 text-sm">
                  <input
                    disabled={!agencyAdmin}
                    name="approvalRequired"
                    type="checkbox"
                    defaultChecked={org.approvalRequired}
                  />
                  Require client approval
                </label>
                {admin && (
                  <button className={action}>Save brand settings</button>
                )}
              </form>
            </Panel>
            {context.memberships.some(
              (member) =>
                member.agencyId === org.agencyId &&
                ['ADMIN', 'SUPERADMIN'].includes(member.role)
            ) && (
              <Panel title="Add a brand">
                <form
                  className="flex flex-wrap gap-3"
                  onSubmit={(event) => {
                    event.preventDefault();
                    void run(`/agency/${org.agencyId}/brands`, {
                      ...Object.fromEntries(new FormData(event.currentTarget)),
                      timezoneName: 'America/Toronto',
                    });
                  }}
                >
                  <input
                    className={control}
                    name="name"
                    required
                    maxLength={100}
                    placeholder="New brand name"
                    aria-label="New brand name"
                  />
                  <button className={action}>Create brand</button>
                </form>
              </Panel>
            )}
          </div>
        )}
        {tab === 'Reviews' && <Reviews reviewer={reviewer} run={run} />}
        {tab === 'Team' && admin && <Team run={run} />}
        {tab === 'Connections' && <Connections />}
        {!['Overview', 'Reviews', 'Team', 'Connections'].includes(tab) && (
          <AgencyTools section={tab} reviewer={reviewer} run={run} />
        )}
      </div>
      <footer className="mt-8 text-xs opacity-60">
        <a href="/api/backend/agency-public/source" className="underline">
          Source code and license (AGPL-3.0)
        </a>
      </footer>
    </div>
  );
}
