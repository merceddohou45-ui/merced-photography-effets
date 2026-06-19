import React from 'react'

export default function UploadDropzone(){
  return (
    <div className="border-dashed border-2 border-gray-300 p-8 text-center rounded">
      <p className="mb-2">Drag & drop up to 30 photos or videos here</p>
      <input type="file" multiple accept="image/*,video/*" className="hidden" />
      <button className="mt-4 px-4 py-2 bg-black text-white rounded">Select files</button>
    </div>
  )
}
