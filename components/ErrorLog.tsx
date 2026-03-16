import React from 'react';

interface ErrorLogProps {
  errors: string[];
}

export default function ErrorLog({ errors }: ErrorLogProps) {
  if (errors.length === 0) return null;

  return (
    <div className="mt-6 p-4 bg-red-50 border border-red-200 rounded-lg">
      <h3 className="text-sm font-semibold text-red-800 mb-2">Error Log</h3>
      <ul className="list-disc list-inside space-y-1">
        {errors.map((err, idx) => (
          <li key={idx} className="text-xs text-red-700 font-mono">{err}</li>
        ))}
      </ul>
    </div>
  );
}