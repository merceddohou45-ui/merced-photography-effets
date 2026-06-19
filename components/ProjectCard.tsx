export default function ProjectCard({ title, description }: { title: string, description?: string }){
  return (
    <div className="p-4 border rounded">
      <h3 className="font-semibold">{title}</h3>
      <p className="text-sm text-gray-600">{description}</p>
    </div>
  )
}
