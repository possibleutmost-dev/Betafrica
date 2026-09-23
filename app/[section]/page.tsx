import { notFound } from 'next/navigation'
import { SectionView } from '@/components/site-pages'
import { SECTIONS } from '@/lib/sections'

export function generateStaticParams() {
  return SECTIONS.map((section) => ({ section }))
}

export default async function Page({ params }: { params: Promise<{ section: string }> }) {
  const { section } = await params
  if (!(SECTIONS as readonly string[]).includes(section)) notFound()
  return <SectionView section={section} />
}
