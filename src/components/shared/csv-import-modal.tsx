'use client'

import { useState, useCallback } from 'react'
import Papa from 'papaparse'
import { useDropzone } from 'react-dropzone'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Upload, FileText, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'

interface CsvImportModalProps<T> {
  open: boolean
  onClose: () => void
  onImport: (rows: T[]) => Promise<void>
  transformRow: (raw: Record<string, string>) => T | null
  templateUrl?: string
  entityName: string
}

type ImportState = 'idle' | 'parsed' | 'importing' | 'done' | 'error'

export function CsvImportModal<T>({
  open,
  onClose,
  onImport,
  transformRow,
  entityName,
}: CsvImportModalProps<T>) {
  const [state, setState] = useState<ImportState>('idle')
  const [validRows, setValidRows] = useState<T[]>([])
  const [errorCount, setErrorCount] = useState(0)
  const [progress, setProgress] = useState(0)
  const [fileName, setFileName] = useState('')
  const [errorMessage, setErrorMessage] = useState('')

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const file = acceptedFiles[0]
    if (!file) return
    setFileName(file.name)

    Papa.parse<Record<string, string>>(file, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (h) => h.trim().toLowerCase().replace(/\s+/g, '_'),
      transform: (v) => v.trim(),
      complete: (results) => {
        const valid: T[] = []
        let errors = 0

        results.data.forEach((row) => {
          const transformed = transformRow(row)
          if (transformed) {
            valid.push(transformed)
          } else {
            errors++
          }
        })

        setValidRows(valid)
        setErrorCount(errors)
        setState('parsed')
      },
      error: (err) => {
        setErrorMessage(err.message)
        setState('error')
      },
    })
  }, [transformRow])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'text/csv': ['.csv'], 'application/vnd.ms-excel': ['.csv'] },
    maxFiles: 1,
  })

  async function handleImport() {
    setState('importing')
    setProgress(0)
    try {
      const BATCH_SIZE = 100
      for (let i = 0; i < validRows.length; i += BATCH_SIZE) {
        const batch = validRows.slice(i, i + BATCH_SIZE)
        await onImport(batch)
        setProgress(Math.round(((i + batch.length) / validRows.length) * 100))
      }
      setState('done')
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Error al importar')
      setState('error')
    }
  }

  function handleClose() {
    setState('idle')
    setValidRows([])
    setErrorCount(0)
    setProgress(0)
    setFileName('')
    setErrorMessage('')
    onClose()
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Importar {entityName} desde CSV</DialogTitle>
          <DialogDescription>
            Sube un archivo CSV con los datos de {entityName.toLowerCase()}.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {(state === 'idle' || state === 'parsed') && (
            <div
              {...getRootProps()}
              className={cn(
                'border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors',
                isDragActive
                  ? 'border-slate-500 bg-slate-50'
                  : 'border-slate-200 hover:border-slate-400'
              )}
            >
              <input {...getInputProps()} />
              <Upload className="mx-auto h-8 w-8 text-slate-400 mb-2" />
              <p className="text-sm font-medium text-slate-700">
                {isDragActive ? 'Suelta el archivo aquí' : 'Arrastra o haz clic para subir'}
              </p>
              <p className="text-xs text-slate-500 mt-1">Solo archivos CSV</p>
            </div>
          )}

          {state === 'parsed' && (
            <div className="space-y-3">
              <div className="flex items-center gap-2 p-3 bg-slate-50 rounded-lg">
                <FileText className="h-4 w-4 text-slate-500" />
                <span className="text-sm font-medium text-slate-700">{fileName}</span>
              </div>
              <div className="flex gap-3">
                <Badge variant="default" className="bg-green-100 text-green-800">
                  <CheckCircle2 className="h-3 w-3 mr-1" />
                  {validRows.length} válidas
                </Badge>
                {errorCount > 0 && (
                  <Badge variant="destructive">
                    <AlertCircle className="h-3 w-3 mr-1" />
                    {errorCount} errores
                  </Badge>
                )}
              </div>
            </div>
          )}

          {state === 'importing' && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm text-slate-600">
                <Loader2 className="h-4 w-4 animate-spin" />
                Importando... {progress}%
              </div>
              <Progress value={progress} />
            </div>
          )}

          {state === 'done' && (
            <Alert className="border-green-200 bg-green-50">
              <CheckCircle2 className="h-4 w-4 text-green-600" />
              <AlertDescription className="text-green-800">
                ✅ {validRows.length} registros importados exitosamente.
              </AlertDescription>
            </Alert>
          )}

          {state === 'error' && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{errorMessage || 'Error al procesar el archivo'}</AlertDescription>
            </Alert>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={handleClose}>
              {state === 'done' ? 'Cerrar' : 'Cancelar'}
            </Button>
            {state === 'parsed' && validRows.length > 0 && (
              <Button onClick={handleImport}>
                Importar {validRows.length} registros
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
