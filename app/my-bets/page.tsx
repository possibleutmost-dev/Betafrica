import { MyBetsPage } from '@/components/site-pages'

export default async function Page({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const { tab } = await searchParams
  return <MyBetsPage tab={tab} />
}
