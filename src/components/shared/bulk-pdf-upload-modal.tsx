// @ts-nocheck
'use client'

import { useState, useRef, useCallback } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import {
  Loader2,
  AlertCircle,
  FileUp,
  CheckCircle,
  SkipForward,
  Save,
  X,
} from 'lucide-react'
import { processInvoiceWithAI } from '@/actions/invoice-processor.actions'
import { fileToBase64 } from '@/lib/file-utils'
import { SOCIEDADES, MONEDAS, INVOICE_ESTADOS } from '@/lib/constants'
import type { ExtractedInvoiceData } from '@/lib/ai-processor'

type InvoiceType = 'income' | 'expense'

interface BulkPDFUploadModalProps {
  open: boolean
  onClose: () => void
  invoiceType: InvoiceType
  onSaveInvoice: (data: Record<string, unknown>) => Promise<void>
}

type BulkStep = 'upload' | 'processing' | 'review' | 'summary'

interface PDFItem {
  file: File
  status: 'pending' | 'processing' | 'extracted' | 'saved' | 'skipped' | 'error'
  extractedData?: ExtractedInvoiceData
  error?: string
}

interface ReviewFormData {
  sociedad: string
  razon_social_cliente: string
  moneda: string
  monto: number
  fecha_creacion: string
  fecha_vencimiento: string
  tipo_documento: string
  numero_documento: string
  estado: string
}

export function BulkPDFUploadModal({
  open,
  onClose,
  invoiceType,
  onSaveInvoice,
}: BulkPDFUploadModalProps) {
  const [step, setStep] = useState<BulkStep>('upload')
  const [pdfItems, setPdfItems] = useState<PDFItem[]>([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [processing, setProcessing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [reviewForm, setReviewForm] = useState<ReviewFormData>({
    sociedad: '',
    razon_social_cliente: '',
    moneda: 'COP',
    monto: 0,
    fecha_creacion: new Date().toISOString().split('T')[0],
    fecha_vencimiento: '',
    tipo_documento: '',
    numero_documento: '',
    estado: 'Pendiente',
  })
  const fileInputRef = useRef<HTMLInputElement>(null)

  const savedCount = pdfItems.filter((p) => p.status === 'saved').length
  const skippedCount = pdfItems.filter((p) => p.status === 'skipped').length
  const errorCount = pdfItems.filter((p) => p.status === 'error').length

  const handleFilesSelected = useCallback((files: FileList | File[]) => {
    const validFiles = Array.from(files).filter((f) => {
      if (f.type !== 'application/pdf') return false
      if (f.size > 10 * 1024 * 1024) return false
      return true
    })

    if (validFiles.length === 0) {
      setError('No se encontraron archivos PDF válidos (máximo 10MB cada uno)')
      return
    }

    const items: PDFItem[] = validFiles.map((file) => ({
      file,
      status: 'pending',
    }))

    setPdfItems(items)
    setError(null)
  }, [])

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    handleFilesSelected(e.dataTransfer.files)
  }

  const handleStartProcessing = async () => {
    if (pdfItems.length === 0) return
    setCurrentIndex(0)
    await processNextPDF(0)
  }

  const processNextPDF = async (index: number) => {
    if (index >= pdfItems.length) {
      setStep('summary')
      return
    }

    setCurrentIndex(index)
    setStep('processing')
    setProcessing(true)
    setError(null)

    try {
      const item = pdfItems[index]
      setPdfItems((prev) =>
        prev.map((p, i) => (i === index ? { ...p, status: 'processing' } : p))
      )

      const base64 = await fileToBase64(item.file)
      const result = await processInvoiceWithAI(base64, invoiceType)

      if (!result.success) {
        setPdfItems((prev) =>
          prev.map((p, i) =>
            i === index ? { ...p, status: 'error', error: 'No se pudo procesar' } : p
          )
        )
        setError('Error procesando PDF. Puedes omitir este archivo.')
        setStep('review')
        setProcessing(false)
        return
      }

      const extracted = result.extracted_data
      setPdfItems((prev) =>
        prev.map((p, i) =>
          i === index ? { ...p, status: 'extracted', extractedData: extracted } : p
        )
      )

      // Pre-fill review form
      setReviewForm({
        sociedad: '',
        razon_social_cliente: extracted.nombre_cliente_proveedor || '',
        moneda: extracted.moneda || 'COP',
        monto: extracted.monto || 0,
        fecha_creacion: extracted.fecha || new Date().toISOString().split('T')[0],
        fecha_vencimiento: extracted.fecha_vencimiento || '',
        tipo_documento: extracted.tipo_documento || '',
        numero_documento: extracted.numero_documento || '',
        estado: 'Pendiente',
      })

      setStep('review')
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Error desconocido'
      setPdfItems((prev) =>
        prev.map((p, i) =>
          i === index ? { ...p, status: 'error', error: errorMsg } : p
        )
      )
      setError(errorMsg)
      setStep('review')
    } finally {
      setProcessing(false)
    }
  }

  const handleSaveAndNext = async () => {
    setSaving(true)
    setError(null)

    try {
      // Build data object based on invoice type
      const data: Record<string, unknown> =
        invoiceType === 'income'
          ? {
              sociedad: reviewForm.sociedad,
              razon_social_cliente: reviewForm.razon_social_cliente,
              moneda: reviewForm.moneda,
              monto_recurrente: reviewForm.monto,
              monto_no_recurrente: 0,
              monto_creacion_contenido: 0,
              fecha_creacion: reviewForm.fecha_creacion,
              fecha_vencimiento: reviewForm.fecha_vencimiento,
              tipo_documento: reviewForm.tipo_documento,
              numero_documento: reviewForm.numero_documento,
              estado: reviewForm.estado,
              tiene_factoraje: false,
              comision_aliado: false,
              dia_pago_cliente: 0,
            }
          : {
              sociedad: reviewForm.sociedad,
              nombre_proveedor_concepto: reviewForm.razon_social_cliente,
              moneda: reviewForm.moneda,
              monto_sin_impuestos: reviewForm.monto,
              fecha_emision: reviewForm.fecha_creacion,
              fecha_pago_o_cobro: reviewForm.fecha_vencimiento,
              recurrente: false,
            }

      await onSaveInvoice(data)

      setPdfItems((prev) =>
        prev.map((p, i) => (i === currentIndex ? { ...p, status: 'saved' } : p))
      )

      // Process next
      await processNextPDF(currentIndex + 1)
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Error guardando'
      setError(errorMsg)
    } finally {
      setSaving(false)
    }
  }

  const handleSkip = async () => {
    setPdfItems((prev) =>
      prev.map((p, i) => (i === currentIndex ? { ...p, status: 'skipped' } : p))
    )

    await processNextPDF(currentIndex + 1)
  }

  const handleClose = () => {
    setPdfItems([])
    setCurrentIndex(0)
    setStep('upload')
    setError(null)
    setProcessing(false)
    setSaving(false)
    onClose()
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            Carga Masiva de PDFs - {invoiceType === 'income' ? 'Ingresos' : 'Gastos'}
          </DialogTitle>
        </DialogHeader>

        {/* Step 1: Upload */}
        {step === 'upload' && (
          <div className="space-y-4">
            <div
              onDragOver={(e) => { e.preventDefault(); e.stopPropagation() }}
              onDrop={handleDrop}
              className="border-2 border-dashed rounded-lg p-8 text-center cursor-pointer hover:border-gray-400 transition-colors"
              onClick={() => fileInputRef.current?.click()}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept="application/pdf"
                multiple
                onChange={(e) => e.target.files && handleFilesSelected(e.target.files)}
                className="hidden"
              />
              <FileUp className="h-10 w-10 mx-auto text-gray-400 mb-3" />
              <p className="font-semibold text-gray-700">
                Arrastra múltiples PDFs aquí o haz clic para seleccionar
              </p>
              <p className="text-xs text-gray-500 mt-1">
                Máximo 10MB por archivo
              </p>
            </div>

            {pdfItems.length > 0 && (
              <div className="space-y-2">
                <p className="text-sm font-medium">
                  {pdfItems.length} archivo(s) seleccionado(s):
                </p>
                <ul className="text-sm space-y-1 max-h-32 overflow-y-auto">
                  {pdfItems.map((item, i) => (
                    <li key={i} className="flex items-center gap-2 text-gray-600">
                      <CheckCircle className="h-3 w-3 text-green-500" />
                      {item.file.name} ({(item.file.size / 1024 / 1024).toFixed(1)} MB)
                    </li>
                  ))}
                </ul>
                <Button onClick={handleStartProcessing} className="w-full">
                  Procesar {pdfItems.length} PDF(s) con IA
                </Button>
              </div>
            )}

            {error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
          </div>
        )}

        {/* Step 2: Processing */}
        {step === 'processing' && (
          <div className="flex flex-col items-center justify-center py-12 space-y-4">
            <Loader2 className="h-12 w-12 animate-spin text-blue-500" />
            <p className="text-lg font-medium">
              Procesando PDF {currentIndex + 1} de {pdfItems.length}...
            </p>
            <p className="text-sm text-muted-foreground">
              {pdfItems[currentIndex]?.file.name}
            </p>
          </div>
        )}

        {/* Step 3: Review */}
        {step === 'review' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between bg-blue-50 p-3 rounded-lg">
              <p className="text-sm font-medium text-blue-900">
                PDF {currentIndex + 1} de {pdfItems.length}: {pdfItems[currentIndex]?.file.name}
              </p>
              <span className="text-xs bg-blue-200 text-blue-800 px-2 py-1 rounded">
                {savedCount} guardados • {skippedCount} omitidos
              </span>
            </div>

            {error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            {/* Inline review form */}
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Sociedad *</Label>
                  <Select
                    value={reviewForm.sociedad}
                    onValueChange={(val) => setReviewForm((prev) => ({ ...prev, sociedad: val }))}
                  >
                    <SelectTrigger className="h-9">
                      <SelectValue placeholder="Seleccionar" />
                    </SelectTrigger>
                    <SelectContent>
                      {SOCIEDADES.map((s) => (
                        <SelectItem key={s} value={s}>{s}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">
                    {invoiceType === 'income' ? 'Cliente' : 'Proveedor'} *
                  </Label>
                  <Input
                    className="h-9"
                    value={reviewForm.razon_social_cliente}
                    onChange={(e) => setReviewForm((prev) => ({ ...prev, razon_social_cliente: e.target.value }))}
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <Label className="text-xs">Moneda</Label>
                  <Select
                    value={reviewForm.moneda}
                    onValueChange={(val) => setReviewForm((prev) => ({ ...prev, moneda: val }))}
                  >
                    <SelectTrigger className="h-9">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {MONEDAS.map((m) => (
                        <SelectItem key={m} value={m}>{m}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">Monto</Label>
                  <Input
                    className="h-9"
                    type="number"
                    step="0.01"
                    value={reviewForm.monto}
                    onChange={(e) => setReviewForm((prev) => ({ ...prev, monto: parseFloat(e.target.value) || 0 }))}
                  />
                </div>
                {invoiceType === 'income' && (
                  <div>
                    <Label className="text-xs">Estado</Label>
                    <Select
                      value={reviewForm.estado}
                      onValueChange={(val) => setReviewForm((prev) => ({ ...prev, estado: val }))}
                    >
                      <SelectTrigger className="h-9">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {INVOICE_ESTADOS.map((e) => (
                          <SelectItem key={e} value={e}>{e}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Fecha {invoiceType === 'income' ? 'Creación' : 'Emisión'}</Label>
                  <Input
                    className="h-9"
                    type="date"
                    value={reviewForm.fecha_creacion}
                    onChange={(e) => setReviewForm((prev) => ({ ...prev, fecha_creacion: e.target.value }))}
                  />
                </div>
                <div>
                  <Label className="text-xs">Fecha Vencimiento</Label>
                  <Input
                    className="h-9"
                    type="date"
                    value={reviewForm.fecha_vencimiento}
                    onChange={(e) => setReviewForm((prev) => ({ ...prev, fecha_vencimiento: e.target.value }))}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Tipo Documento</Label>
                  <Input
                    className="h-9"
                    value={reviewForm.tipo_documento}
                    onChange={(e) => setReviewForm((prev) => ({ ...prev, tipo_documento: e.target.value }))}
                    placeholder="Factura, Nota, etc."
                  />
                </div>
                <div>
                  <Label className="text-xs">N Documento</Label>
                  <Input
                    className="h-9"
                    value={reviewForm.numero_documento}
                    onChange={(e) => setReviewForm((prev) => ({ ...prev, numero_documento: e.target.value }))}
                  />
                </div>
              </div>
            </div>

            <Separator />

            <div className="flex justify-between gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={handleSkip}
                disabled={saving}
              >
                <SkipForward className="mr-2 h-4 w-4" />
                Omitir
              </Button>
              <Button
                type="button"
                onClick={handleSaveAndNext}
                disabled={saving || !reviewForm.sociedad || !reviewForm.razon_social_cliente}
              >
                {saving ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Save className="mr-2 h-4 w-4" />
                )}
                {currentIndex < pdfItems.length - 1
                  ? 'Guardar y Siguiente'
                  : 'Guardar y Finalizar'}
              </Button>
            </div>
          </div>
        )}

        {/* Step 4: Summary */}
        {step === 'summary' && (
          <div className="space-y-4 py-4">
            <div className="text-center space-y-2">
              <CheckCircle className="h-12 w-12 mx-auto text-green-500" />
              <h3 className="text-lg font-semibold">Carga masiva completada</h3>
            </div>

            <div className="grid grid-cols-3 gap-4 text-center">
              <div className="bg-green-50 p-3 rounded-lg">
                <p className="text-2xl font-bold text-green-700">{savedCount}</p>
                <p className="text-xs text-green-600">Guardadas</p>
              </div>
              <div className="bg-yellow-50 p-3 rounded-lg">
                <p className="text-2xl font-bold text-yellow-700">{skippedCount}</p>
                <p className="text-xs text-yellow-600">Omitidas</p>
              </div>
              <div className="bg-red-50 p-3 rounded-lg">
                <p className="text-2xl font-bold text-red-700">{errorCount}</p>
                <p className="text-xs text-red-600">Errores</p>
              </div>
            </div>

            <Button onClick={handleClose} className="w-full">
              <X className="mr-2 h-4 w-4" />
              Cerrar
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
