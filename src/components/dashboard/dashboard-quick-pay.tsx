// @ts-nocheck
'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { QuickPayModal } from '@/components/shared/quick-pay-modal'
import { DollarSign, TrendingDown } from 'lucide-react'

interface DashboardQuickPayProps {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  unpaidIncome: any[]
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  unpaidExpenses: any[]
}

export function DashboardQuickPay({ unpaidIncome, unpaidExpenses }: DashboardQuickPayProps) {
  const [showIncomeModal, setShowIncomeModal] = useState(false)
  const [showExpenseModal, setShowExpenseModal] = useState(false)

  return (
    <>
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowIncomeModal(true)}
          className="border-green-300 text-green-700 hover:bg-green-50"
        >
          <DollarSign className="h-4 w-4 mr-1" />
          Registrar Cobro
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowExpenseModal(true)}
          className="border-red-300 text-red-700 hover:bg-red-50"
        >
          <TrendingDown className="h-4 w-4 mr-1" />
          Registrar Pago
        </Button>
      </div>

      <QuickPayModal
        type="income"
        invoices={unpaidIncome}
        open={showIncomeModal}
        onClose={() => setShowIncomeModal(false)}
      />
      <QuickPayModal
        type="expense"
        invoices={unpaidExpenses}
        open={showExpenseModal}
        onClose={() => setShowExpenseModal(false)}
      />
    </>
  )
}
