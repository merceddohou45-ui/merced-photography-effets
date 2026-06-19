export default function DashboardPage() {
  return (
    <section className="container mx-auto px-6 py-12">
      <h1 className="text-3xl font-bold mb-6">Dashboard</h1>
      <p className="mb-6">Your projects and recent activity will appear here. This page is scaffolded — authentication & authorization should be enforced in future steps.</p>

      <div className="grid md:grid-cols-2 gap-4">
        <div className="p-4 border rounded">Projects list (placeholder)</div>
        <div className="p-4 border rounded">Uploads / Processing (placeholder)</div>
      </div>
    </section>
  )
}
