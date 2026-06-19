import Link from 'next/link'

export default function Header() {
  return (
    <header className="border-b py-4 bg-white">
      <div className="container mx-auto px-6 flex items-center justify-between">
        <Link href="/" className="text-xl font-bold">Merced Photography Effects</Link>
        <nav className="flex items-center gap-4">
          <Link href="/dashboard" className="text-sm">Dashboard</Link>
          <Link href="/pricing" className="text-sm">Pricing</Link>
          <Link href="/auth/login" className="px-4 py-2 border rounded">Login</Link>
        </nav>
      </div>
    </header>
  )
}
