import { TicketDetail } from '@/components/ticket-detail'

export default async function Page({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params
  return <TicketDetail code={code.toUpperCase()} />
}
