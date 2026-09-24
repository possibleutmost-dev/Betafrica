'use client'

import { useEffect } from 'react'
import { X } from 'lucide-react'
import { BetslipPanel } from '@/components/match-board'
import { useShell } from '@/components/site-shell'
import { useSlip } from '@/lib/store'

/** The betslip as a bottom sheet, for phones where there is no room beside the board. */
export default function BetslipSheet({ onClose }: { onClose: () => void }) {
  const { notify, openAuth } = useShell()
  const legs = useSlip((state) => state.legs)

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => event.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    const overflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = overflow
    }
  }, [onClose])

  return (
    <div className="fixed inset-0 z-50 flex items-end md:hidden" role="dialog" aria-modal="true" aria-label="Bet slip">
      <button className="absolute inset-0 bg-[#0f172a]/55" onClick={onClose} aria-label="Close bet slip" />
      <div className="relative max-h-[85vh] w-full overflow-y-auto rounded-t-3xl bg-[#f3f6f9] p-3 pb-[max(12px,env(safe-area-inset-bottom))]">
        <div className="mx-auto mb-2 h-1.5 w-10 rounded-full bg-[#cbd5e1]" />
        <button onClick={onClose} className="absolute right-4 top-4 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-white text-[#64748b] shadow-sm" aria-label="Close bet slip"><X size={18} /></button>
        <BetslipPanel legs={legs} onNeedAuth={() => { onClose(); openAuth('login') }} onNotice={notify} />
      </div>
    </div>
  )
}
