import Sidebar from '@/components/Sidebar'

export default function AuthenticatedLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen" style={{ background: 'var(--bg-page)' }}>
      <Sidebar />
      <main className="md:ml-60 p-4 md:p-8 pt-16 md:pt-8">
        {children}
      </main>
    </div>
  )
}
