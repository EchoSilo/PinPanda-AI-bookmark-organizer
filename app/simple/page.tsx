'use client';

export default function SimplePage() {
  return (
    <div className="p-8 max-w-4xl mx-auto">
      <h1 className="text-3xl font-bold mb-4">Simple Page</h1>
      <p className="mb-4">
        This is a simple page without Chakra UI to test if the app loads correctly.
      </p>
      <button 
        className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
        onClick={() => alert('Button clicked!')}
      >
        Click Me
      </button>
    </div>
  );
} 