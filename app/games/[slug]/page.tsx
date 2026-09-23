import { notFound } from 'next/navigation'
import { GamePlay } from '@/components/game-play'
import { CASINO_GAMES, findGame } from '@/lib/casino-catalog'

export function generateStaticParams() {
  return CASINO_GAMES.map((game) => ({ slug: game.slug }))
}

export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  if (!findGame(slug)) notFound()
  return <GamePlay slug={slug} />
}
