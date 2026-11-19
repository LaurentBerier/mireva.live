import { notFound } from 'next/navigation';
import { backendInternalUrl } from '@gitroom/helpers/utils/backend.internal.url';
export const dynamic = 'force-dynamic';
export default async function LinkPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const response = await fetch(`${backendInternalUrl()}/agency-public/links/${encodeURIComponent(slug)}`, { cache: 'no-store' });
  if (!response.ok) notFound();
  const page = await response.json();
  const colors: Record<string, string> = { violet: '#211538', ocean: '#102f43', forest: '#15372e', monochrome: '#151515' };
  return <main className="min-h-screen w-full px-6 py-20 text-center text-white" style={{ background: colors[page.theme] || colors.violet }}><div className="mx-auto max-w-lg"><h1 className="text-4xl font-semibold">{page.title}</h1><p className="mt-5 whitespace-pre-wrap text-base leading-7 opacity-80">{page.description}</p><div className="mt-10 flex flex-col gap-4">{page.links.map((link: any) => <a className="rounded-xl border border-white/20 bg-white/10 px-6 py-4 text-base font-semibold hover:bg-white/20" key={link.id} href={`/api/backend/agency-public/links/${encodeURIComponent(slug)}/${encodeURIComponent(link.id)}`}>{link.label}</a>)}</div></div></main>;
}
