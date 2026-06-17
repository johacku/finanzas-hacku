'use client'

export default function AlegraInvoicesError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <div className="p-8 text-center">
      <h2 className="text-lg font-bold text-red-600 mb-2">Error al cargar solicitudes</h2>
      <p className="text-sm text-muted-foreground mb-4">{error.message || 'Error desconocido'}</p>
      <button
        onClick={reset}
        className="px-4 py-2 bg-primary text-white rounded-md text-sm"
      >
        Reintentar
      </button>
    </div>
  )
}
