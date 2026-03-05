/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unused-vars */
"use client"

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

interface CashflowBreakdownDialogProps {
  open: boolean
  onClose: () => void
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  cashFlow: any
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  weekInfo: any
  sociedad: string
}

export function CashflowBreakdownDialog({
  open,
  onClose,
  cashFlow,
  weekInfo,
  sociedad,
}: CashflowBreakdownDialogProps) {
  const groupByCategory = (items: any[]) => {
    const grouped: { [key: string]: any[] } = {}
    items.forEach((item) => {
      const category = item.tipo || item.concepto || "Otros"
      if (!grouped[category]) {
        grouped[category] = []
      }
      grouped[category].push(item)
    })
    return grouped
  }

  const incomeByCategory = groupByCategory(cashFlow.invoices_in)
  const expenseByCategory = groupByCategory(cashFlow.invoices_out)

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            Desglose de Flujo de Caja - Semana {weekInfo.weekNumber}
          </DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="ingresos" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="ingresos">
              Ingresos ({cashFlow.invoices_in.length})
            </TabsTrigger>
            <TabsTrigger value="egresos">
              Egresos ({cashFlow.invoices_out.length})
            </TabsTrigger>
          </TabsList>

          {/* INGRESOS */}
          <TabsContent value="ingresos" className="space-y-4">
            {Object.entries(incomeByCategory).map(([category, items]: [string, any[]]) => (
              <div key={category}>
                <h4 className="font-semibold text-sm text-green-900 mb-2">
                  {category}
                </h4>
                <div className="border rounded-lg overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-green-50">
                        <TableHead>Cliente</TableHead>
                        <TableHead>Fecha Pago</TableHead>
                        <TableHead className="text-right">Monto</TableHead>
                        <TableHead className="text-right">USD</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(items as any[]).map((invoice, idx) => (
                        <TableRow key={idx}>
                          <TableCell className="font-mono text-sm">
                            {invoice.razon_social_cliente}
                          </TableCell>
                          <TableCell className="text-sm">
                            {invoice.fecha_pago_proyectada}
                          </TableCell>
                          <TableCell className="text-right font-mono text-sm">
                            ${invoice.monto.toLocaleString("es-ES", {
                              maximumFractionDigits: 2,
                            })}
                          </TableCell>
                          <TableCell className="text-right font-mono text-sm">
                            ${(invoice.monto_usd ?? invoice.monto).toLocaleString("es-ES", {
                              maximumFractionDigits: 2,
                            })}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
                <div className="mt-2 text-right text-sm">
                  <p className="font-semibold text-green-700">
                    Subtotal:{" "}
                    $
                    {(items as any[])
                      .reduce((sum, i) => sum + (i.monto_usd ?? i.monto ?? 0), 0)
                      .toLocaleString("es-ES", { maximumFractionDigits: 0 })}
                  </p>
                </div>
              </div>
            ))}

            {cashFlow.invoices_in.length === 0 && (
              <div className="text-center py-6 text-gray-500">
                No hay ingresos proyectados para esta semana
              </div>
            )}
          </TabsContent>

          {/* EGRESOS */}
          <TabsContent value="egresos" className="space-y-6">
            {Object.entries(expenseByCategory).map(([category, items]: [string, any[]]) => (
              <div key={category}>
                <h4 className="font-semibold text-sm text-red-900 mb-2">
                  {category}
                </h4>
                <div className="border rounded-lg overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-red-50">
                        <TableHead>Proveedor</TableHead>
                        <TableHead>Fecha Pago</TableHead>
                        <TableHead className="text-right">Monto</TableHead>
                        <TableHead className="text-right">USD</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(items as any[]).map((invoice, idx) => (
                        <TableRow key={idx}>
                          <TableCell className="font-mono text-sm">
                            {invoice.nombre_proveedor_concepto}
                          </TableCell>
                          <TableCell className="text-sm">
                            {invoice.fecha_pago_o_cobro}
                          </TableCell>
                          <TableCell className="text-right font-mono text-sm">
                            ${(invoice.monto_presupuestado ?? 0).toLocaleString("es-ES", {
                              maximumFractionDigits: 2,
                            })}
                          </TableCell>
                          <TableCell className="text-right font-mono text-sm">
                            ${(invoice.monto_usd ?? invoice.monto_presupuestado ?? 0).toLocaleString("es-ES", {
                              maximumFractionDigits: 2,
                            })}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
                <div className="mt-2 text-right text-sm">
                  <p className="font-semibold text-red-700">
                    Subtotal:{" "}
                    $
                    {(items as any[])
                      .reduce(
                        (sum, i) =>
                          sum + (i.monto_usd ?? i.monto_presupuestado ?? 0),
                        0
                      )
                      .toLocaleString("es-ES", { maximumFractionDigits: 0 })}
                  </p>
                </div>
              </div>
            ))}

            {/* Nómina */}
            {cashFlow.payroll_total > 0 && (
              <div>
                <h4 className="font-semibold text-sm text-orange-900 mb-2">
                  Nómina
                </h4>
                <div className="bg-orange-50 p-4 rounded-lg">
                  <p className="text-sm">
                    Gasto mensual de salarios:{" "}
                    <span className="font-bold text-orange-700">
                      ${cashFlow.payroll_total.toLocaleString("es-ES", {
                        maximumFractionDigits: 0,
                      })}
                    </span>
                  </p>
                </div>
              </div>
            )}

            {/* Pasivos */}
            {cashFlow.liability_payments_total > 0 && (
              <div>
                <h4 className="font-semibold text-sm text-purple-900 mb-2">
                  Pagos de Pasivos
                </h4>
                <div className="bg-purple-50 p-4 rounded-lg">
                  <p className="text-sm">
                    Total de pagos programados:{" "}
                    <span className="font-bold text-purple-700">
                      ${cashFlow.liability_payments_total.toLocaleString(
                        "es-ES",
                        {
                          maximumFractionDigits: 0,
                        }
                      )}
                    </span>
                  </p>
                </div>
              </div>
            )}

            {cashFlow.invoices_out.length === 0 &&
              cashFlow.payroll_total === 0 &&
              cashFlow.liability_payments_total === 0 && (
                <div className="text-center py-6 text-gray-500">
                  No hay egresos proyectados para esta semana
                </div>
              )}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  )
}
