"use client"

import { useState, useEffect } from "react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Eye, EyeOff, Check, X } from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"

const STORAGE_KEY = "openai_api_key_secure"

interface OpenAIApiKeyManagerProps {
  onKeyReady?: (key: string) => void
  onKeyCleared?: () => void
  showStatus?: boolean
}

export function OpenAIApiKeyManager({
  onKeyReady,
  onKeyCleared,
  showStatus = true,
}: OpenAIApiKeyManagerProps) {
  const [apiKey, setApiKey] = useState("")
  const [showKey, setShowKey] = useState(false)
  const [isSaved, setIsSaved] = useState(false)
  const [isValid, setIsValid] = useState(false)

  useEffect(() => {
    // Load saved key from localStorage on mount
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved) {
      setApiKey(saved)
      setIsSaved(true)
      setIsValid(saved.startsWith("sk-"))
      onKeyReady?.(saved)
    }
  }, [onKeyReady])

  const handleSave = () => {
    if (!apiKey.startsWith("sk-")) {
      setIsValid(false)
      return
    }

    localStorage.setItem(STORAGE_KEY, apiKey)
    setIsSaved(true)
    setIsValid(true)
    onKeyReady?.(apiKey)
  }

  const handleClear = () => {
    localStorage.removeItem(STORAGE_KEY)
    setApiKey("")
    setIsSaved(false)
    setIsValid(false)
    onKeyCleared?.()
  }

  if (!showStatus) {
    return null
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <label className="text-sm font-semibold">OpenAI API Key</label>
        {isSaved && isValid && (
          <div className="flex items-center gap-1 px-2 py-1 bg-green-100 rounded text-green-800 text-xs">
            <Check className="h-3 w-3" />
            Guardada
          </div>
        )}
      </div>

      <div className="flex gap-2">
        <div className="relative flex-1">
          <Input
            type={showKey ? "text" : "password"}
            placeholder="sk-proj-..."
            value={apiKey}
            onChange={(e) => {
              setApiKey(e.target.value)
              setIsValid(e.target.value.startsWith("sk-"))
            }}
            className="pr-10"
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

        {!isSaved ? (
          <Button
            type="button"
            onClick={handleSave}
            disabled={!isValid}
            className="gap-2"
          >
            <Check className="h-4 w-4" />
            Guardar
          </Button>
        ) : (
          <Button
            type="button"
            variant="destructive"
            onClick={handleClear}
            className="gap-2"
          >
            <X className="h-4 w-4" />
            Limpiar
          </Button>
        )}
      </div>

      {!isValid && apiKey && (
        <Alert variant="destructive" className="py-2">
          <AlertDescription className="text-xs">
            API Key debe comenzar con &quot;sk-&quot;
          </AlertDescription>
        </Alert>
      )}

      {isSaved && (
        <Alert className="py-2 bg-blue-50 border-blue-200">
          <AlertDescription className="text-xs text-blue-800">
            ✓ Tu API Key se usa solo en tu navegador, nunca se envía a nuestros servidores
          </AlertDescription>
        </Alert>
      )}
    </div>
  )
}

/**
 * Hook para obtener la API key guardada
 */
export function useOpenAIApiKey() {
  const [apiKey, setApiKey] = useState<string | null>(null)

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY)
    setApiKey(saved)
  }, [])

  return apiKey
}

/**
 * Hook para limpiar la API key
 */
export function useClearOpenAIApiKey() {
  return () => {
    localStorage.removeItem(STORAGE_KEY)
  }
}
