import { MatchDetail } from '@/components/match-board'

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return <MatchDetail id={id} />
}
