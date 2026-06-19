export default function Home() {
  return (
    <section className="container mx-auto px-6 py-20 text-center">
      <h1 className="text-5xl font-bold mb-6">Merced Photography Effects</h1>
      <p className="text-xl max-w-2xl mx-auto mb-8">AI-powered, cinematic video editing for photographers, videographers and creators. Upload media, choose a style, sync to music, and export professional videos.</p>
      <div className="flex justify-center gap-4">
        <a href="/dashboard" className="px-6 py-3 bg-black text-white rounded-md">Go to Dashboard</a>
        <a href="#features" className="px-6 py-3 border border-black rounded-md">Learn more</a>
      </div>

      <section id="features" className="mt-20 text-left">
        <h2 className="text-3xl font-semibold mb-4">Features</h2>
        <ul className="grid md:grid-cols-2 gap-4">
          <li className="p-4 border rounded">AI Editing engine (planned)</li>
          <li className="p-4 border rounded">Beat synchronization</li>
          <li className="p-4 border rounded">Watermark support</li>
          <li className="p-4 border rounded">Cloud exports (FFmpeg backend)</li>
        </ul>
      </section>
    </section>
  )
}
