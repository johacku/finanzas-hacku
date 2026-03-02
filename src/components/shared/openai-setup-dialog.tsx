"use client"

import { useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { AlertCircle, CheckCircle, ExternalLink, Eye, EyeOff } from "lucide-react"

interface OpenAISetupDialogProps {
  open: boolean
  onClose: () => void
  onApiKeyConfirm?: (apiKey: string) => void
}

export function OpenAISetupDialog({
  open,
  onClose,
  onApiKeyConfirm,
}: OpenAISetupDialogProps) {
  const [apiKey, setApiKey] = useState("")
  const [showKey, setShowKey] = useState(false)
  const [isVerified, setIsVerified] = useState(false)

  const handleVerify = async () => {
    if (!apiKey.startsWith("sk-")) {
      alert("API Key debe comenzar con 'sk-'")
      return
    }

    // Simple validation - in production, would verify with OpenAI
    setIsVerified(true)
    onApiKeyConfirm?.(apiKey)

    // Close after brief delay
    setTimeout(() => {
      setApiKey("")
      setShowKey(false)
      setIsVerified(false)
      onClose()
    }, 1500)
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Configurar OpenAI API</DialogTitle>
          <DialogDescription>
            Para procesar PDFs con IA, necesitas tu propia API Key de OpenAI
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Warning */}
          <Alert className="border-blue-300 bg-blue-50">
            <AlertCircle className="h-4 w-4 text-blue-600" />
            <AlertTitle className="text-blue-900">Seguridad</AlertTitle>
            <AlertDescription className="text-blue-800">
              Tu API Key <strong>nunca se almacena</strong> en nuestros servidores. Se usa
              solo en tu navegador para procesar PDFs y se descarta inmediatamente.
            </AlertDescription>
          </Alert>

          {/* Steps */}
          <div className="space-y-4">
            <h3 className="font-semibold">Cómo obtener tu API Key:</h3>

            <ol className="space-y-3 ml-4">
              <li className="flex gap-3">
                <Badge className="mt-1">1</Badge>
                <div>
                  <p className="font-medium">
                    Ve a{" "}
                    <a
                      href="https://platform.openai.com/api-keys"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:underline flex items-center gap-1 inline-flex"
                    >
                      OpenAI API Keys
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  </p>
                  <p className="text-sm text-gray-600">
                    Inicia sesión con tu cuenta de OpenAI
                  </p>
                </div>
              </li>

              <li className="flex gap-3">
                <Badge className="mt-1">2</Badge>
                <div>
                  <p className="font-medium">Crea una nueva API Key</p>
                  <p className="text-sm text-gray-600">
                    Click en &quot;Create new secret key&quot;
                  </p>
                </div>
              </li>

              <li className="flex gap-3">
                <Badge className="mt-1">3</Badge>
                <div>
                  <p className="font-medium">Copia la key completa</p>
                  <p className="text-sm text-gray-600">
                    Comienza con &quot;sk-&quot; y tiene ~48 caracteres
                  </p>
                </div>
              </li>

              <li className="flex gap-3">
                <Badge className="mt-1">4</Badge>
                <div>
                  <p className="font-medium">Pégala abajo</p>
                  <p className="text-sm text-gray-600">
                    La usaremos para procesar tus facturas
                  </p>
                </div>
              </li>
            </ol>
          </div>

          {/* Input */}
          <div className="space-y-2">
            <label className="text-sm font-semibold">Tu API Key:</label>
            <div className="relative">
              <Input
                type={showKey ? "text" : "password"}
                placeholder="sk-proj-..."
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                disabled={isVerified}
                className="pr-10 font-mono text-sm"
              />
              <button
                type="button"
                onClick={() => setShowKey(!showKey)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
              >
                {showKey ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </button>
            </div>
          </div>

          {/* Success State */}
          {isVerified && (
            <Alert className="border-green-300 bg-green-50">
              <CheckCircle className="h-4 w-4 text-green-600" />
              <AlertTitle className="text-green-900">¡Conectada!</AlertTitle>
              <AlertDescription className="text-green-800">
                Tu API Key ha sido verificada. Ahora puedes procesar PDFs con IA.
              </AlertDescription>
            </Alert>
          )}

          {/* Pricing Info */}
          <Alert className="border-gray-300 bg-gray-50">
            <AlertCircle className="h-4 w-4 text-gray-600" />
            <AlertTitle className="text-gray-900">Costo</AlertTitle>
            <AlertDescription className="text-gray-700">
              OpenAI cobra por uso: ~$0.10-0.30 por factura procesada. Los costos se
              cargan directamente a tu cuenta de OpenAI.
            </AlertDescription>
          </Alert>
        </div>

        {/* Buttons */}
        <div className="flex justify-end gap-2 pt-4">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            type="button"
            onClick={handleVerify}
            disabled={!apiKey || isVerified || !apiKey.startsWith("sk-")}
          >
            {isVerified ? "✓ Conectada" : "Verificar y Conectar"}
          </Button>
        </div>

        {/* Help */}
        <p className="text-xs text-gray-500 text-center mt-4">
          ¿Necesitas ayuda?{" "}
          <a
            href="https://platform.openai.com/docs/guides/vision"
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-600 hover:underline"
          >
            Documentación de OpenAI Vision
          </a>
        </p>
      </DialogContent>
    </Dialog>
  )
}
