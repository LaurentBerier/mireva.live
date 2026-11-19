import { notFound } from 'next/navigation';
import { backendInternalUrl } from '@gitroom/helpers/utils/backend.internal.url';
export const dynamic = 'force-dynamic';
export default async function SharedReport({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const response = await fetch(`${backendInternalUrl()}/agency-public/reports/${encodeURIComponent(token)}`, { cache: 'no-store' });
  if (!response.ok) notFound();
  const report = await response.json();
  return <main className="mx-auto min-h-screen w-full max-w-6xl p-6 py-16"><p className="text-sm font-semibold uppercase tracking-widest text-[#bd9fff]">{report.brand}</p><h1 className="mt-3 text-4xl font-semibold">{report.name}</h1><p className="mt-4 opacity-70">{report.from.slice(0, 10)} – {report.to.slice(0, 10)}</p><a className="mt-6 inline-block rounded-lg bg-[#612BD3] px-5 py-3 text-white" href={`/api/backend/agency-public/reports/${encodeURIComponent(token)}/download`}>Download report</a><div className="mt-10 grid gap-5 md:grid-cols-3">{report.latest.map((metric: any, index: number) => <article key={index} className="rounded-xl border border-[var(--new-border)] p-6"><p className="text-sm opacity-70">{metric.provider} · {metric.metric}</p><p className="my-3 text-3xl font-semibold">{metric.value.toLocaleString()}</p><p className="text-sm opacity-60">{metric.periodStart.slice(0, 10)}</p></article>)}</div>{!report.latest.length && <p className="mt-10">No measurements are available for this period.</p>}</main>;
}
