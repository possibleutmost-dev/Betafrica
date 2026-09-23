import { LoadCodePage } from '@/components/site-pages'

export default async function Page({ searchParams }: { searchParams: Promise<{ code?: string }> }) {
  const { code } = await searchParams
  return <LoadCodePage initialCode={code ?? ''} />
}
