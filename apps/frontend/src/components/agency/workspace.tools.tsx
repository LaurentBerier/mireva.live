'use client';
import { FormEvent, useState } from 'react';
import { useFetch } from '@gitroom/helpers/utils/custom.fetch';
import { useUser } from '@gitroom/frontend/components/layout/user.context';
import { action, control, Panel, useAgencyResource } from './workspace';

function useToolAction() {
  const fetch = useFetch();
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  async function send(path: string, body: unknown = {}, method = 'POST') {
    setBusy(true);
    setMessage('');
    try {
      const response = await fetch(path, {
        method,
        body: JSON.stringify(body),
      });
      const data = await response.json();
      if (!response.ok)
        throw new Error(
          Array.isArray(data.message)
            ? data.message.join('; ')
            : data.message || 'The action failed'
        );
      window.dispatchEvent(new Event('agency-update'));
      setMessage('Saved');
      return data;
    } catch (error) {
      setMessage((error as Error).message);
      return null;
    } finally {
      setBusy(false);
    }
  }
  return { send, message, busy, setMessage };
}
function Status({ message }: { message: string }) {
  return message ? (
    <p
      role="status"
      className="mb-4 rounded-lg border border-[var(--new-border)] p-3 text-sm"
    >
      {message}
    </p>
  ) : null;
}
function Insights() {
  const [range, setRange] = useState('');
  const { data, error } = useAgencyResource<any>(`/agency/insights${range}`);
  const { send, message, busy } = useToolAction();
  const [analysis, setAnalysis] = useState('');
  return (
    <div className="grid gap-5">
      <Status message={message} />
      <Panel title="Performance over time">
        <form
          className="mb-5 flex flex-wrap items-end gap-3"
          onSubmit={(event) => {
            event.preventDefault();
            const fields = new FormData(event.currentTarget);
            setRange(
              `?from=${fields.get('from')}T00:00:00.000Z&to=${fields.get(
                'to'
              )}T23:59:59.999Z`
            );
          }}
        >
          <label className="text-sm">
            From
            <input
              className={`${control} mt-2 block`}
              type="date"
              name="from"
              required
            />
          </label>
          <label className="text-sm">
            To
            <input
              className={`${control} mt-2 block`}
              type="date"
              name="to"
              required
            />
          </label>
          <button className={action}>Apply dates</button>
          <button
            type="button"
            disabled={busy}
            className={control}
            onClick={() => void send('/agency/insights/sync')}
          >
            Sync profiles
          </button>
        </form>
        {error && <p role="alert">{error.message}</p>}
        {data && !data.metrics.length && (
          <p>
            No measurements collected yet. Connect profiles and synchronize
            analytics.
          </p>
        )}
        <div className="grid gap-4 md:grid-cols-3 xl:grid-cols-4">
          {data?.latest.map((metric: any) => (
            <div
              key={metric.key}
              className="rounded-lg border border-[var(--new-border)] p-4"
            >
              <p className="text-sm opacity-70">
                {metric.provider} · {metric.metric}
              </p>
              <p className="my-2 text-3xl font-semibold">
                {metric.value.toLocaleString()}
              </p>
              <p className="text-sm opacity-60">
                {metric.periodStart.slice(0, 10)}
              </p>
            </div>
          ))}
        </div>
        {data?.unavailable.length > 0 && (
          <p className="mt-5 text-sm opacity-70">
            {data.unavailable.length} connected profiles have no account
            analytics adapter. Their values are unavailable.
          </p>
        )}
      </Panel>
      <div className="grid gap-5 lg:grid-cols-2">
        <Panel title="Best times to post">
          {data?.bestTimesStatus !== 'available' ? (
            <p className="opacity-70">
              Recommendations need at least five published posts and usable
              engagement measurements.
            </p>
          ) : (
            data.bestTimes.slice(0, 10).map((slot: any) => (
              <p
                key={`${slot.provider}${slot.weekday}${slot.hour}`}
                className="border-t border-[var(--new-border)] py-3"
              >
                {slot.provider} · {slot.weekday} {slot.hour}:00 · {slot.posts}{' '}
                posts · {slot.averageEngagement.toFixed(1)} average interactions
              </p>
            ))
          )}
        </Panel>
        <Panel title="Hashtags in your published content">
          {!data?.hashtags.length && <p>No hashtags found in this period.</p>}
          {data?.hashtags.slice(0, 20).map((tag: any) => (
            <div key={tag.tag} className="flex justify-between py-2">
              <span>{tag.tag}</span>
              <span>{tag.count} posts</span>
            </div>
          ))}
        </Panel>
      </div>
      <Panel title="Competitor watchlist">
        <form
          className="mb-5 flex flex-wrap gap-3"
          onSubmit={(event) => {
            event.preventDefault();
            void send(
              '/agency/insights/competitors',
              Object.fromEntries(new FormData(event.currentTarget))
            );
          }}
        >
          <select
            className={control}
            name="provider"
            aria-label="Competitor network"
          >
            {[
              'facebook',
              'instagram',
              'threads',
              'x',
              'bluesky',
              'youtube',
              'twitch',
            ].map((network) => (
              <option key={network}>{network}</option>
            ))}
          </select>
          <input
            className={control}
            name="handle"
            required
            placeholder="Handle or account ID"
            aria-label="Competitor account"
          />
          <button className={action}>Add competitor</button>
        </form>
        {data?.competitors.map((competitor: any) => (
          <div
            key={competitor.id}
            className="border-t border-[var(--new-border)] py-3"
          >
            <p>
              {competitor.provider} · {competitor.handle}
            </p>
            <p className="text-sm opacity-60">
              {competitor.collectedAt
                ? `Updated ${new Date(competitor.collectedAt).toLocaleString()}`
                : 'Public metrics not collected yet'}
              {competitor.error ? ` · ${competitor.error}` : ''}
            </p>
            {competitor.data && (
              <pre className="mt-2 max-h-40 overflow-auto text-sm">
                {JSON.stringify(competitor.data, null, 2)}
              </pre>
            )}
          </div>
        ))}
      </Panel>
      <Panel title="Ask about your results">
        <form
          className="flex flex-col gap-3"
          onSubmit={async (event) => {
            event.preventDefault();
            const fields = new FormData(event.currentTarget);
            const result = await send('/agency/insights/analyze', {
              question: fields.get('question'),
            });
            if (result) setAnalysis(result.analysis);
          }}
        >
          <textarea
            name="question"
            className={control}
            required
            maxLength={2000}
            placeholder="What changed this month, and what should we try next?"
            aria-label="Analysis question"
          />
          <button className={action} disabled={busy || !data?.latest.length}>
            Analyze collected data
          </button>
        </form>
        {analysis && (
          <p className="mt-5 whitespace-pre-wrap leading-7">{analysis}</p>
        )}
      </Panel>
    </div>
  );
}
function Reports({ reviewer }: { reviewer: boolean }) {
  const { data, error } = useAgencyResource<any[]>('/agency/reports');
  const { send, message, busy, setMessage } = useToolAction();
  const { data: media } = useAgencyResource<any[]>(
    reviewer ? null : '/agency/assets'
  );
  const user = useUser();
  const admin = ['ADMIN', 'SUPERADMIN'].includes(user?.role || '');
  const { data: keys } = useAgencyResource<any[]>(
    admin ? '/agency/insights/keys' : null
  );
  return (
    <div className="grid gap-5">
      <Status message={message} />
      {admin && (
        <Panel title="Looker Studio access">
          <p className="mb-4 text-sm opacity-70">
            Create a read-only key for this brand. Copy the key when it appears;
            only its hash is stored.
          </p>
          <button
            className={control}
            onClick={async () => {
              const result = await send('/agency/insights/keys');
              if (result)
                setMessage(`Copy this analytics key: ${result.token}`);
            }}
          >
            Create analytics key
          </button>
          {keys?.map((key) => (
            <div
              key={key.id}
              className="mt-3 flex flex-wrap justify-between gap-3"
            >
              <span className="text-sm">
                Created {new Date(key.createdAt).toLocaleDateString()}
              </span>
              <button
                className={control}
                onClick={() =>
                  void send(`/agency/insights/keys/${key.id}`, {}, 'DELETE')
                }
              >
                Revoke key
              </button>
            </div>
          ))}
        </Panel>
      )}
      {!reviewer && (
        <Panel title="Create a branded report">
          <form
            className="grid gap-4 md:grid-cols-2"
            onSubmit={(event) => {
              event.preventDefault();
              const values = Object.fromEntries(
                new FormData(event.currentTarget)
              );
              void send('/agency/reports', {
                name: values.name,
                from: `${values.from}T00:00:00.000Z`,
                to: `${values.to}T23:59:59.999Z`,
                format: values.format,
                accentColor: String(values.accentColor).replace('#', ''),
                period: values.period,
                ...(values.logoMediaId
                  ? { logoMediaId: values.logoMediaId }
                  : {}),
                recipients: String(values.recipients || '')
                  .split(',')
                  .map((value) => value.trim())
                  .filter(Boolean),
                ...(values.monthlyDay
                  ? { monthlyDay: Number(values.monthlyDay) }
                  : {}),
              });
            }}
          >
            <label className="text-sm">
              Report name
              <input
                name="name"
                required
                maxLength={120}
                className={`${control} mt-2 w-full`}
              />
            </label>
            <label className="text-sm">
              Format
              <select name="format" className={`${control} mt-2 w-full`}>
                <option value="pdf">PDF</option>
                <option value="pptx">PowerPoint</option>
                <option value="csv">CSV measurements</option>
              </select>
            </label>
            <label className="text-sm">
              From
              <input
                type="date"
                name="from"
                required
                className={`${control} mt-2 w-full`}
              />
            </label>
            <label className="text-sm">
              To
              <input
                type="date"
                name="to"
                required
                className={`${control} mt-2 w-full`}
              />
            </label>
            <label className="text-sm">
              Date period
              <select name="period" className={`${control} mt-2 w-full`}>
                <option value="FIXED">Fixed dates above</option>
                <option value="CURRENT_MONTH">Current month</option>
                <option value="PREVIOUS_MONTH">Previous month</option>
                <option value="CURRENT_WEEK">Current week</option>
              </select>
            </label>
            <label className="text-sm">
              Brand accent
              <input
                type="color"
                name="accentColor"
                defaultValue="#612BD3"
                className={`${control} mt-2 w-full`}
              />
            </label>
            <label className="text-sm">
              Brand logo, optional
              <select name="logoMediaId" className={`${control} mt-2 w-full`}>
                <option value="">No logo</option>
                {media
                  ?.filter(
                    (asset) =>
                      /\.(png|jpe?g)$/i.test(asset.name) &&
                      asset.fileSize <= 1024 * 1024
                  )
                  .map((asset) => (
                    <option key={asset.id} value={asset.id}>
                      {asset.originalName || asset.name}
                    </option>
                  ))}
              </select>
            </label>
            <label className="text-sm">
              Monthly email day, optional
              <input
                name="monthlyDay"
                type="number"
                min={1}
                max={28}
                className={`${control} mt-2 w-full`}
              />
            </label>
            <label className="text-sm">
              Email recipients, comma separated
              <input name="recipients" className={`${control} mt-2 w-full`} />
            </label>
            <button className={action} disabled={busy}>
              Save report
            </button>
          </form>
        </Panel>
      )}
      <Panel title="Reports">
        {error && <p role="alert">{error.message}</p>}
        {data?.length === 0 && (
          <p>No reports have been created for this brand.</p>
        )}
        {data?.map((report) => (
          <article
            key={report.id}
            className="flex flex-wrap items-center justify-between gap-4 border-t border-[var(--new-border)] py-4"
          >
            <div>
              <h3 className="font-semibold">{report.name}</h3>
              <p className="text-sm opacity-70">
                {report.from.slice(0, 10)} – {report.to.slice(0, 10)} ·{' '}
                {report.format.toUpperCase()}
              </p>
              {report.monthlyDay && (
                <p className="mt-1 text-sm opacity-70">
                  Monthly delivery on day {report.monthlyDay}
                </p>
              )}
            </div>
            <div className="flex gap-3">
              <a
                className={action}
                href={`/api/backend/agency/reports/${report.id}/download`}
              >
                Download
              </a>
              {!reviewer && (
                <button
                  className={control}
                  onClick={async () => {
                    const result = await send(
                      `/agency/reports/${report.id}/share`
                    );
                    if (result)
                      setMessage(
                        `Share until ${new Date(
                          result.expiresAt
                        ).toLocaleDateString()}: ${result.url}`
                      );
                  }}
                >
                  Create share link
                </button>
              )}
            </div>
          </article>
        ))}
      </Panel>
    </div>
  );
}
function Inbox() {
  const { data, error } = useAgencyResource<any[]>('/agency/engagement/inbox');
  const { data: saved } = useAgencyResource<any[]>(
    '/agency/engagement/saved-replies'
  );
  const { send, message, busy } = useToolAction();
  const [selected, setSelected] = useState('');
  const [text, setText] = useState('');
  const { data: staff } = useAgencyResource<any[]>('/agency/engagement/staff');
  const conversation = data?.find((item) => item.id === selected);
  return (
    <div className="grid gap-5">
      <Status message={message} />
      <div className="flex flex-wrap gap-3">
        <button
          className={action}
          disabled={busy}
          onClick={() => void send('/agency/engagement/sync')}
        >
          Sync inbox
        </button>
      </div>
      <div className="grid gap-5 lg:grid-cols-[320px_1fr]">
        <Panel title="Conversations">
          {error && <p role="alert">{error.message}</p>}
          {data?.length === 0 && (
            <p>
              No conversations collected yet. Connect profiles with engagement
              permissions, then synchronize.
            </p>
          )}
          {data?.map((item) => (
            <button
              key={item.id}
              onClick={() => setSelected(item.id)}
              className={`block w-full border-t border-[var(--new-border)] p-3 text-left ${
                selected === item.id ? 'bg-[#612bd3]/20' : ''
              }`}
            >
              <p className="text-sm text-[#bd9fff]">
                {item.provider} · {item.kind} · {item.status}
              </p>
              <p className="mt-2 line-clamp-2">{item.title}</p>
            </button>
          ))}
        </Panel>
        <Panel title={conversation?.title || 'Select a conversation'}>
          {conversation && (
            <>
              <label className="mb-4 flex flex-wrap items-center gap-3 text-sm">
                Assigned to
                <select
                  className={control}
                  value={conversation.assignedTo || ''}
                  onChange={(event) =>
                    void send(
                      `/agency/engagement/inbox/${conversation.id}`,
                      { assignedTo: event.target.value || null },
                      'PATCH'
                    )
                  }
                >
                  <option value="">Unassigned</option>
                  {staff?.map((member) => (
                    <option key={member.user.id} value={member.user.id}>
                      {member.user.name || member.user.email}
                    </option>
                  ))}
                </select>
              </label>
              <div className="mb-5 max-h-[480px] space-y-4 overflow-auto">
                {[...conversation.messages].reverse().map((item: any) => (
                  <article
                    key={item.id}
                    className={`rounded-lg border border-[var(--new-border)] p-4 ${
                      item.direction === 'OUTBOUND' ? 'ml-8' : 'mr-8'
                    }`}
                  >
                    <p className="text-sm opacity-70">
                      {item.author} ·{' '}
                      {new Date(item.createdAt).toLocaleString()} ·{' '}
                      {item.deliveryStatus}
                    </p>
                    <p className="mt-2 whitespace-pre-wrap">{item.content}</p>
                  </article>
                ))}
              </div>
              <form
                className="flex flex-col gap-3"
                onSubmit={async (event) => {
                  event.preventDefault();
                  const result = await send(
                    `/agency/engagement/inbox/${conversation.id}/reply`,
                    { content: text, requestId: crypto.randomUUID() }
                  );
                  if (result) setText('');
                }}
              >
                <label className="text-sm">
                  Saved reply
                  <select
                    className={`${control} mt-2 w-full`}
                    defaultValue=""
                    onChange={(event) =>
                      setText(
                        saved?.find((item) => item.id === event.target.value)
                          ?.content || ''
                      )
                    }
                  >
                    <option value="">Choose a saved reply</option>
                    {saved?.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.title}
                      </option>
                    ))}
                  </select>
                </label>
                <textarea
                  className={control}
                  required
                  maxLength={5000}
                  value={text}
                  onChange={(event) => setText(event.target.value)}
                  aria-label="Reply text"
                />
                <div className="flex flex-wrap gap-3">
                  <button className={action} disabled={busy}>
                    Send reply
                  </button>
                  <button
                    type="button"
                    className={control}
                    onClick={() =>
                      void send(
                        `/agency/engagement/inbox/${conversation.id}`,
                        {
                          status:
                            conversation.status === 'OPEN'
                              ? 'RESOLVED'
                              : 'OPEN',
                        },
                        'PATCH'
                      )
                    }
                  >
                    {conversation.status === 'OPEN'
                      ? 'Mark resolved'
                      : 'Reopen'}
                  </button>
                </div>
              </form>
            </>
          )}
        </Panel>
      </div>
      <Panel title="Save a reusable reply">
        <form
          className="flex flex-col gap-3"
          onSubmit={(event) => {
            event.preventDefault();
            void send(
              '/agency/engagement/saved-replies',
              Object.fromEntries(new FormData(event.currentTarget))
            );
          }}
        >
          <input
            className={control}
            name="title"
            required
            placeholder="Reply title"
            aria-label="Saved reply title"
          />
          <textarea
            className={control}
            name="content"
            required
            maxLength={5000}
            placeholder="Reply text"
            aria-label="Saved reply text"
          />
          <button className={action}>Save reply</button>
        </form>
      </Panel>
    </div>
  );
}
function Flows() {
  const { data } = useAgencyResource<any[]>('/agency/engagement/flows');
  const { data: connections } = useAgencyResource<any[]>('/agency/connections');
  const { send, message, busy } = useToolAction();
  return (
    <div className="grid gap-5">
      <Status message={message} />
      <Panel title="Create a comment automation">
        <p className="mb-5 text-sm opacity-70">
          Flows start disabled. Each matching incoming comment is handled once;
          private replies require the network’s messaging permissions.
        </p>
        <form
          className="grid gap-3 md:grid-cols-2"
          onSubmit={(event) => {
            event.preventDefault();
            const values = Object.fromEntries(
              new FormData(event.currentTarget)
            );
            void send(
              '/agency/engagement/flows',
              Object.fromEntries(
                Object.entries(values).filter(([, value]) => value !== '')
              )
            );
          }}
        >
          <input
            className={control}
            name="name"
            required
            placeholder="Flow name"
            aria-label="Flow name"
          />
          <select
            className={control}
            name="integrationId"
            required
            aria-label="Flow channel"
          >
            <option value="">Select channel</option>
            {connections?.map((item) => (
              <option value={item.id} key={item.id}>
                {item.name} · {item.providerIdentifier}
              </option>
            ))}
          </select>
          <input
            className={control}
            name="keyword"
            required
            placeholder="Comment keyword"
            aria-label="Keyword"
          />
          <input
            className={control}
            name="postExternalId"
            placeholder="Limit to post ID, optional"
            aria-label="Post ID filter"
          />
          <textarea
            className={control}
            name="publicReply"
            placeholder="Public reply, optional"
            aria-label="Public reply"
          />
          <textarea
            className={control}
            name="directReply"
            placeholder="Private reply, optional"
            aria-label="Direct reply"
          />
          <button className={action} disabled={busy}>
            Create disabled flow
          </button>
        </form>
      </Panel>
      <Panel title="Automation history">
        {data?.length === 0 && <p>No flows created yet.</p>}
        {data?.map((flow) => (
          <article
            key={flow.id}
            className="border-t border-[var(--new-border)] py-4"
          >
            <div className="flex flex-wrap justify-between gap-3">
              <div>
                <h3 className="font-semibold">{flow.name}</h3>
                <p className="mt-1 text-sm opacity-70">
                  Keyword: {flow.keyword} ·{' '}
                  {flow.enabled ? 'Enabled' : 'Disabled'}
                </p>
              </div>
              <button
                className={control}
                onClick={() =>
                  void send(
                    `/agency/engagement/flows/${flow.id}`,
                    { enabled: !flow.enabled },
                    'PATCH'
                  )
                }
              >
                {flow.enabled ? 'Disable' : 'Enable'}
              </button>
            </div>
            {flow.executions.map((execution: any) => (
              <p key={execution.id} className="mt-3 text-sm">
                {new Date(execution.createdAt).toLocaleString()} ·{' '}
                {execution.status}
                {execution.error ? ` · ${execution.error}` : ''}
              </p>
            ))}
          </article>
        ))}
      </Panel>
    </div>
  );
}
type LinkItem = { id: string; label: string; url: string };
function SmartLinks() {
  const { data } = useAgencyResource<any[]>('/agency/growth/links');
  const { send, message } = useToolAction();
  const [editing, setEditing] = useState<any>(null);
  const [links, setLinks] = useState<LinkItem[]>([]);
  return (
    <div className="grid gap-5">
      <Status message={message} />
      <Panel title={editing ? 'Edit link page' : 'Create a link page'}>
        <form
          key={editing?.id || 'new'}
          className="flex flex-col gap-3"
          onSubmit={(event) => {
            event.preventDefault();
            const fields = Object.fromEntries(
              new FormData(event.currentTarget)
            );
            void send('/agency/growth/links', {
              ...(editing ? { id: editing.id } : {}),
              title: fields.title,
              slug: fields.slug,
              description: fields.description,
              theme: fields.theme,
              published: fields.published === 'on',
              links,
            });
          }}
        >
          <input
            name="title"
            defaultValue={editing?.title}
            required
            className={control}
            placeholder="Page title"
            aria-label="Page title"
          />
          <input
            name="slug"
            defaultValue={editing?.slug}
            required
            pattern="[a-z0-9][a-z0-9-]{2,60}"
            className={control}
            placeholder="public-page-slug"
            aria-label="Public page slug"
          />
          <textarea
            name="description"
            defaultValue={editing?.description}
            className={control}
            placeholder="Description"
            aria-label="Page description"
          />
          <select
            className={control}
            name="theme"
            defaultValue={editing?.theme || 'violet'}
            aria-label="Page theme"
          >
            {['violet', 'ocean', 'forest', 'monochrome'].map((theme) => (
              <option key={theme}>{theme}</option>
            ))}
          </select>
          {links.map((link, index) => (
            <div key={link.id} className="flex flex-wrap gap-3">
              <input
                value={link.label}
                required
                className={`${control} flex-1`}
                placeholder="Link label"
                aria-label={`Link ${index + 1} label`}
                onChange={(event) =>
                  setLinks(
                    links.map((item) =>
                      item.id === link.id
                        ? { ...item, label: event.target.value }
                        : item
                    )
                  )
                }
              />
              <input
                value={link.url}
                required
                type="url"
                pattern="https://.*"
                className={`${control} flex-[2]`}
                placeholder="https://example.com"
                aria-label={`Link ${index + 1} URL`}
                onChange={(event) =>
                  setLinks(
                    links.map((item) =>
                      item.id === link.id
                        ? { ...item, url: event.target.value }
                        : item
                    )
                  )
                }
              />
              <button
                type="button"
                className={control}
                onClick={() =>
                  setLinks(links.filter((item) => item.id !== link.id))
                }
              >
                Remove
              </button>
            </div>
          ))}
          <button
            type="button"
            className={control}
            onClick={() =>
              setLinks([
                ...links,
                { id: crypto.randomUUID(), label: '', url: '' },
              ])
            }
          >
            Add link
          </button>
          <label className="flex items-center gap-3">
            <input
              name="published"
              type="checkbox"
              defaultChecked={editing?.published}
            />
            Publish this page
          </label>
          <button className={action}>Save page</button>
        </form>
      </Panel>
      <Panel title="Your link pages">
        {data?.length === 0 && <p>No link pages yet.</p>}
        {data?.map((page) => (
          <article
            key={page.id}
            className="flex flex-wrap items-center justify-between gap-4 border-t border-[var(--new-border)] py-4"
          >
            <div>
              <h3 className="font-semibold">{page.title}</h3>
              <p className="text-sm opacity-70">
                {page._count.clicks} clicks ·{' '}
                {page.published ? 'Published' : 'Draft'}
              </p>
            </div>
            <div className="flex gap-3">
              <button
                className={control}
                onClick={() => {
                  setEditing(page);
                  setLinks(page.links);
                }}
              >
                Edit
              </button>
              {page.published && (
                <a
                  href={`/s/${page.slug}`}
                  className={action}
                  target="_blank"
                  rel="noreferrer"
                >
                  Open page
                </a>
              )}
            </div>
          </article>
        ))}
      </Panel>
    </div>
  );
}
function Websites() {
  const { data } = useAgencyResource<any[]>('/agency/growth/websites');
  const { data: stats } = useAgencyResource<any>(
    '/agency/growth/websites/stats'
  );
  const { send, message } = useToolAction();
  return (
    <div className="grid gap-5">
      <Status message={message} />
      <Panel title="Website activity">
        <div className="grid gap-4 sm:grid-cols-3">
          {[
            ['Page views, 30 days', stats?.views],
            ['Daily visitors, 30 days', stats?.visitors],
            ['Visitors, last 30 minutes', stats?.realtimeVisitors],
          ].map(([label, value]) => (
            <div
              key={String(label)}
              className="rounded-lg border border-[var(--new-border)] p-4"
            >
              <p className="text-sm opacity-70">{label}</p>
              <p className="mt-2 text-3xl font-semibold">{value ?? '—'}</p>
            </div>
          ))}
        </div>
      </Panel>
      <Panel title="Connect a website">
        <form
          className="flex flex-wrap gap-3"
          onSubmit={(event) => {
            event.preventDefault();
            void send(
              '/agency/growth/websites',
              Object.fromEntries(new FormData(event.currentTarget))
            );
          }}
        >
          <input
            className={`${control} flex-1`}
            name="domain"
            required
            placeholder="example.com"
            aria-label="Website hostname"
          />
          <button className={action}>Add website</button>
        </form>
        {data?.map((site) => (
          <article
            className="mt-5 border-t border-[var(--new-border)] pt-4"
            key={site.id}
          >
            <h3 className="font-semibold">{site.domain}</h3>
            <p className="my-2 text-sm opacity-70">
              Add this script to your website. Measurement starts after
              installation.
            </p>
            <pre className="overflow-auto whitespace-pre-wrap break-all rounded-lg bg-black/10 p-4 text-sm">
              {site.snippet}
            </pre>
          </article>
        ))}
      </Panel>
      <Panel title="Top pages">
        {!stats?.pages.length && <p>No website events received yet.</p>}
        {stats?.pages.map((page: any) => (
          <div
            key={page.label}
            className="flex justify-between border-t border-[var(--new-border)] py-3"
          >
            <span>{page.label}</span>
            <span>{page.count}</span>
          </div>
        ))}
      </Panel>
    </div>
  );
}
function Ads() {
  const { data } = useAgencyResource<any[]>('/agency/ads');
  const { send, message, busy } = useToolAction();
  const [accountId, setAccountId] = useState('');
  const user = useUser();
  const admin = ['ADMIN', 'SUPERADMIN'].includes(user?.role || '');
  return (
    <div className="grid gap-5">
      <Status message={message} />
      {admin && (
        <Panel title="Authorize an advertising account">
          <p className="mb-4 text-sm opacity-70">
            Use credentials from your approved developer application. Tokens are
            encrypted on the server and are never returned to this form.
          </p>
          <form
            className="grid gap-3 md:grid-cols-2"
            onSubmit={(event) => {
              event.preventDefault();
              const values = Object.fromEntries(
                new FormData(event.currentTarget)
              );
              void send(
                '/agency/ads',
                Object.fromEntries(
                  Object.entries(values).filter(([, value]) => value !== '')
                )
              );
            }}
          >
            <select
              className={control}
              name="provider"
              aria-label="Advertising network"
            >
              <option value="meta">Meta Ads</option>
              <option value="google">Google Ads</option>
              <option value="tiktok">TikTok Ads</option>
            </select>
            <input
              className={control}
              name="name"
              required
              placeholder="Account name"
              aria-label="Advertising account name"
            />
            <input
              className={control}
              name="externalId"
              required
              placeholder="Advertising account ID"
              aria-label="Advertising account ID"
            />
            <input
              className={control}
              name="token"
              type="password"
              required
              autoComplete="off"
              placeholder="Authorized access token"
              aria-label="Advertising access token"
            />
            <input
              className={control}
              name="loginAccountId"
              placeholder="Google manager customer ID, optional"
              aria-label="Google manager ID"
            />
            <button className={action} disabled={busy}>
              Save account
            </button>
          </form>
        </Panel>
      )}
      <Panel title="Campaign performance">
        {data?.length === 0 && <p>No advertising accounts configured yet.</p>}
        {data?.map((account) => (
          <article
            key={account.id}
            className="border-t border-[var(--new-border)] py-5"
          >
            <div className="flex flex-wrap justify-between gap-4">
              <div>
                <h3 className="font-semibold">
                  {account.name} · {account.provider}
                </h3>
                <p className="mt-1 text-sm opacity-70">
                  {account.collectedAt
                    ? `Collected ${new Date(
                        account.collectedAt
                      ).toLocaleString()}`
                    : 'Not synchronized'}
                  {account.lastError ? ` · ${account.lastError}` : ''}
                </p>
              </div>
              <button
                className={control}
                disabled={busy}
                onClick={() => void send(`/agency/ads/${account.id}/sync`)}
              >
                Sync campaigns
              </button>
            </div>
            {account.snapshots?.campaigns?.map((campaign: any) => (
              <div
                className="mt-4 flex flex-wrap justify-between gap-3 rounded-lg border border-[var(--new-border)] p-4"
                key={campaign.id}
              >
                <span>
                  {campaign.name} · {campaign.status}
                </span>
                {admin && (
                  <button
                    className={control}
                    onClick={() =>
                      void send(
                        `/agency/ads/${account.id}/campaigns/${campaign.id}`,
                        { status: 'PAUSED' },
                        'PATCH'
                      )
                    }
                  >
                    Pause campaign
                  </button>
                )}
              </div>
            ))}
          </article>
        ))}
      </Panel>
      {admin && (
        <Panel title="Create a paused campaign">
          <p className="mb-4 text-sm opacity-70">
            This form creates a traffic campaign. Complete creative, targeting,
            and platform-specific setup before activation. Budgets use the
            account’s currency.
          </p>
          <form
            className="grid gap-3 md:grid-cols-2"
            onSubmit={(event) => {
              event.preventDefault();
              const fields = Object.fromEntries(
                new FormData(event.currentTarget)
              );
              void send(`/agency/ads/${accountId}/campaigns`, {
                name: fields.name,
                dailyBudget: Number(fields.dailyBudget),
                objective: 'TRAFFIC',
                ...(fields.politicalDeclaration
                  ? { politicalDeclaration: fields.politicalDeclaration }
                  : {}),
              });
            }}
          >
            <select
              className={control}
              value={accountId}
              onChange={(event) => setAccountId(event.target.value)}
              required
              aria-label="Campaign account"
            >
              <option value="">Select account</option>
              {data?.map((account) => (
                <option key={account.id} value={account.id}>
                  {account.name}
                </option>
              ))}
            </select>
            <input
              className={control}
              name="name"
              required
              placeholder="Campaign name"
              aria-label="Campaign name"
            />
            <input
              className={control}
              name="dailyBudget"
              type="number"
              step="0.01"
              min="0.01"
              required
              placeholder="Daily budget in account currency"
              aria-label="Daily budget"
            />
            <select
              className={control}
              name="politicalDeclaration"
              aria-label="Google EU political advertising declaration"
            >
              <option value="">Google campaigns: select declaration</option>
              <option value="DOES_NOT_CONTAIN_EU_POLITICAL_ADVERTISING">
                Does not contain EU political advertising
              </option>
              <option value="CONTAINS_EU_POLITICAL_ADVERTISING">
                Contains EU political advertising
              </option>
            </select>
            <button className={action} disabled={busy}>
              Create paused campaign
            </button>
          </form>
        </Panel>
      )}
    </div>
  );
}
function Imports() {
  const { data: connections } = useAgencyResource<any[]>('/agency/connections');
  const { data: history } = useAgencyResource<any[]>('/agency/imports');
  const { send, message, busy } = useToolAction();
  const [csv, setCsv] = useState(
    'channel_id,publish_at,content,media_ids,settings_json,repeat_days\n'
  );
  const [rows, setRows] = useState<any[] | null>(null);
  const [requestId, setRequestId] = useState('');
  const change = (value: string) => {
    setCsv(value);
    setRows(null);
    setRequestId(crypto.randomUUID());
  };
  return (
    <div className="grid gap-5">
      <Status message={message} />
      <Panel title="Import planned posts">
        <p className="mb-4 text-sm opacity-70">
          Upload or paste a CSV with up to 500 rows. Imports create drafts at
          the planned times. Review channel settings in the calendar, request
          client approval, and then schedule the approved versions. Use ISO
          timestamps with a UTC offset to disambiguate daylight-saving changes.
          Separate media IDs with a vertical bar.
        </p>
        <input
          type="file"
          accept=".csv,text/csv"
          aria-label="Choose CSV file"
          className="mb-4"
          onChange={async (event) => {
            const file = event.target.files?.[0];
            if (file && file.size <= 500000) change(await file.text());
          }}
        />
        <textarea
          className={`${control} mb-4 w-full font-mono text-sm`}
          rows={12}
          maxLength={500000}
          value={csv}
          onChange={(event) => change(event.target.value)}
          aria-label="Planned posts CSV"
        />
        <div className="flex flex-wrap gap-3">
          <button
            className={control}
            disabled={busy}
            onClick={async () => {
              const result = await send('/agency/imports/preview', { csv });
              if (result) {
                setRows(result);
                if (!requestId) setRequestId(crypto.randomUUID());
              }
            }}
          >
            Validate CSV
          </button>
          <button
            className={action}
            disabled={
              busy || !rows?.length || rows.some((row) => row.errors.length)
            }
            onClick={() => void send('/agency/imports', { csv, requestId })}
          >
            Import validated drafts
          </button>
        </div>
        {rows && (
          <div className="mt-5 max-h-80 overflow-auto">
            {rows.map((row) => (
              <div
                key={row.row}
                className="border-t border-[var(--new-border)] py-3 text-sm"
              >
                <p>
                  Row {row.row} / {row.channelName || 'Unknown channel'} /{' '}
                  {row.publishAt}
                </p>
                <p className="my-1 truncate opacity-70">{row.content}</p>
                <p
                  className={
                    row.errors.length ? 'text-red-400' : 'text-green-400'
                  }
                >
                  {row.errors.length
                    ? row.errors.join('; ')
                    : 'Ready to import as a draft'}
                </p>
              </div>
            ))}
          </div>
        )}
      </Panel>
      <Panel title="Channel identifiers for this brand">
        {connections?.map((channel) => (
          <p key={channel.id} className="mb-3 break-all text-sm">
            {channel.name} / {channel.providerIdentifier}
            <br />
            <code>{channel.id}</code>
          </p>
        ))}
      </Panel>
      <Panel title="Import history">
        {history?.length === 0 && <p>No imports yet.</p>}
        {history?.map((item) => (
          <p
            key={item.id}
            className="border-t border-[var(--new-border)] py-3 text-sm"
          >
            {new Date(item.createdAt).toLocaleString()} / {item.state} /{' '}
            {item.results.length} drafts saved
          </p>
        ))}
      </Panel>
    </div>
  );
}
function Deliveries() {
  const { data } = useAgencyResource<any[]>('/agency/deliveries');
  const { send, message, busy } = useToolAction();
  const user = useUser();
  const admin = ['ADMIN', 'SUPERADMIN'].includes(user?.role || '');
  return (
    <div className="grid gap-5">
      <Status message={message} />
      <Panel title="Delivery history">
        <p className="mb-5 text-sm opacity-70">
          Uncertain delivery freezes the affected post until its outcome is
          reconciled. Check the native network, cancel any pending provider
          upload, and stop the workflow before recording that nothing was
          published. Reconciliation opens after the activity timeout and safety
          margin.
        </p>
        {data?.length === 0 && <p>No publishing attempts in this brand yet.</p>}
        {data?.map((attempt) => (
          <article
            key={attempt.id}
            className="border-t border-[var(--new-border)] py-5"
          >
            <p className="font-semibold">
              {attempt.operation} / {attempt.state.replaceAll('_', ' ')}
            </p>
            <p className="mt-2 text-sm opacity-60">
              {new Date(attempt.createdAt).toLocaleString()} / Post{' '}
              {attempt.postId}
            </p>
            {admin &&
              ['UNCERTAIN', 'RUNNING', 'ACCEPTED_PENDING'].includes(
                attempt.state
              ) && (
                <form
                  className="mt-4 grid gap-3 md:grid-cols-2"
                  onSubmit={(event) => {
                    event.preventDefault();
                    const values = Object.fromEntries(
                      new FormData(event.currentTarget)
                    );
                    void send(
                      `/agency/deliveries/${attempt.id}/reconcile`,
                      Object.fromEntries(
                        Object.entries(values).filter(
                          ([, value]) => value !== ''
                        )
                      )
                    );
                  }}
                >
                  <select
                    name="outcome"
                    className={control}
                    aria-label="Observed delivery outcome"
                  >
                    <option value="PUBLISHED">
                      Published on the native network
                    </option>
                    <option value="NOT_PUBLISHED">
                      Not published; native pending work cancelled
                    </option>
                  </select>
                  <input
                    name="externalId"
                    className={control}
                    placeholder="Native post ID, if published"
                    aria-label="Native post ID"
                  />
                  <input
                    name="releaseUrl"
                    type="url"
                    className={control}
                    placeholder="Native HTTPS post URL, if published"
                    aria-label="Native post URL"
                  />
                  <textarea
                    name="evidence"
                    minLength={20}
                    maxLength={2000}
                    required
                    className={control}
                    placeholder="Record the native verification and pending cancellation evidence"
                    aria-label="Reconciliation evidence"
                  />
                  <button className={action} disabled={busy}>
                    Record reconciliation
                  </button>
                </form>
              )}
          </article>
        ))}
      </Panel>
    </div>
  );
}
export function AgencyTools({
  section,
  reviewer,
}: {
  section: string;
  reviewer: boolean;
  run: (path: string, body: unknown) => Promise<void>;
}) {
  switch (section) {
    case 'Imports':
      return <Imports />;
    case 'Deliveries':
      return <Deliveries />;
    case 'Insights':
      return <Insights />;
    case 'Reports':
      return <Reports reviewer={reviewer} />;
    case 'Inbox':
      return <Inbox />;
    case 'Flows':
      return <Flows />;
    case 'SmartLinks':
      return <SmartLinks />;
    case 'Websites':
      return <Websites />;
    case 'Ads':
      return <Ads />;
    default:
      return null;
  }
}
