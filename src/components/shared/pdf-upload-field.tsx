"use client"

import React, { useState, useCallback, useRef } from "react"
import { AlertCircle, FileUp, Loader2, CheckCircle, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@/components/ui/alert"

interface PDFUploadFieldProps {
  onFileSelect?: (file: File) => void
  onProcessingStart?: () => void
  disabled?: boolean
  invoiceType?: "income" | "expense"
}

export function PDFUploadField({
  onFileSelect,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  onProcessingStart,
  disabled = false,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  invoiceType = "income",
}: PDFUploadFieldProps) {
  const [isDragging, setIsDragging] = useState(false)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [error, setError] = useState<string | null>(null)
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [isProcessing, setIsProcessing] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const validateFile = (file: File): boolean => {
    // Check file type
    if (file.type !== "application/pdf") {
      setError("Solo archivos PDF son permitidos")
      return false
    }

    // Check file size (max 10MB)
    const maxSize = 10 * 1024 * 1024
    if (file.size > maxSize) {
      setError("El archivo debe ser menor a 10MB")
      return false
    }

    return true
  }

  const handleFileChange = useCallback(
    (file: File | null) => {
      if (!file) {
        setSelectedFile(null)
        setError(null)
        return
      }

      if (!validateFile(file)) {
        return
      }

      setSelectedFile(file)
      setError(null)
      onFileSelect?.(file)
    },
    [onFileSelect]
  )

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (!disabled) setIsDragging(true)
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)

    if (disabled) return

    const files = e.dataTransfer.files
    if (files.length > 0) {
      handleFileChange(files[0])
    }
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.currentTarget.files
    if (files && files.length > 0) {
      handleFileChange(files[0])
    }
  }

  const handleClick = () => {
    if (!disabled) {
      fileInputRef.current?.click()
    }
  }

  const clearFile = () => {
    handleFileChange(null)
    if (fileInputRef.current) {
      fileInputRef.current.value = ""
    }
  }

  return (
    <div className="space-y-3">
      <div
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        className={`relative border-2 border-dashed rounded-lg p-8 text-center transition-colors cursor-pointer ${
          isDragging
            ? "border-blue-500 bg-blue-50"
            : "border-gray-300 hover:border-gray-400"
        } ${disabled ? "opacity-50 cursor-not-allowed" : ""}`}
        onClick={handleClick}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="application/pdf"
          onChange={handleInputChange}
          disabled={disabled}
          className="hidden"
        />

        {selectedFile ? (
          <div className="space-y-2">
            <div className="flex justify-center gap-2">
              <CheckCircle className="h-8 w-8 text-green-500" />
            </div>
            <p className="font-semibold text-green-700">{selectedFile.name}</p>
            <p className="text-xs text-gray-500">
              {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
            </p>
            {isProcessing && (
              <div className="flex items-center justify-center gap-2 mt-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span className="text-sm text-gray-600">
                  Procesando PDF...
                </span>
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-2">
            <FileUp className="h-8 w-8 mx-auto text-gray-400" />
            <div>
              <p className="font-semibold text-gray-700">
                Arrastra un PDF aquí o haz clic para seleccionar
              </p>
              <p className="text-xs text-gray-500 mt-1">
                Máximo 10MB • Solo archivos PDF
              </p>
            </div>
          </div>
        )}
      </div>

      {selectedFile && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={clearFile}
          disabled={disabled || isProcessing}
          className="w-full"
        >
          <X className="h-4 w-4 mr-2" />
          Limpiar
        </Button>
      )}

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
    </div>
  )
}
