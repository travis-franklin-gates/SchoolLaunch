export default function OnboardingLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen" style={{ background: 'var(--bg-page)' }}>
      <main className="p-4 md:p-8">
        {children}
      </main>
    </div>
  )
}
