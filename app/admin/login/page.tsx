import { AdminLoginPage } from '@/components/admin-login-page'

export default async function Page({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams
  return <AdminLoginPage next={next?.startsWith('/admin') ? next : '/admin'} />
}
