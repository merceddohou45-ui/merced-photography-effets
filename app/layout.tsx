import '../../../styles/globals.css'
import { ReactNode } from 'react'
import Header from '../../../components/Header'
import Footer from '../../../components/Footer'

export const metadata = {
  title: 'Merced Photography Effects',
  description: 'AI-powered video editing for photographers and creators.'
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-background text-primary">
        <Header />
        <main className="min-h-screen">{children}</main>
        <Footer />
      </body>
    </html>
  )
}
