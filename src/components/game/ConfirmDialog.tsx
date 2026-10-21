import type { ReactNode } from 'react'
import { Button } from '@/components/ui/button'
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'

export interface ConfirmRequest {
  title: ReactNode
  description?: ReactNode
  confirmText?: string
  tone?: 'red' | 'gold' | 'green' | 'blue'
  onConfirm: () => void
}

/** 关键操作的二次确认弹窗：点任一按钮都会先关闭弹窗，确定时再执行 onConfirm */
export function ConfirmDialog({ request, onClose }: { request: ConfirmRequest | null; onClose: () => void }) {
  return (
    <AlertDialog open={!!request}>
      {request && (
        <AlertDialogContent className="panel max-w-xs">
          <AlertDialogHeader>
            <AlertDialogTitle className="font-display text-xl">{request.title}</AlertDialogTitle>
            {request.description && <AlertDialogDescription>{request.description}</AlertDialogDescription>}
          </AlertDialogHeader>
          <AlertDialogFooter className="grid grid-cols-2 gap-2">
            <Button variant="paper" size="lg2" onClick={onClose}>
              取消
            </Button>
            <Button
              variant={request.tone ?? 'red'}
              size="lg2"
              onClick={() => {
                onClose()
                request.onConfirm()
              }}
            >
              {request.confirmText ?? '确定'}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      )}
    </AlertDialog>
  )
}
