import React, { useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { PendingConfirmation } from '../types';

interface ConfirmModalProps {
  confirmation: PendingConfirmation | null;
  onCancel: () => void;
}

export const ConfirmModal: React.FC<ConfirmModalProps> = ({ confirmation, onCancel }) => {
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!confirmation) {
    return null;
  }

  const handleConfirmClick = async () => {
    setIsSubmitting(true);
    try {
      await confirmation.onConfirm();
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-[1px] p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-modal-title"
    >
      <div className="bg-white dark:bg-[#181226] border border-[#e8e1ef] dark:border-[#2d2342] rounded-2xl max-w-md w-full p-6 shadow-xl">
        <div className="flex items-start gap-3">
          <div
            className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
              confirmation.variant === 'danger'
                ? 'bg-red-50 dark:bg-red-950/50 text-red-600 dark:text-red-400'
                : 'bg-[#faf3fc] dark:bg-[#241b38] text-[#56249a] dark:text-[#c084fc]'
            }`}
          >
            <AlertTriangle className="w-5 h-5" />
          </div>
          <div className="min-w-0 flex-1">
            <h3
              id="confirm-modal-title"
              className="text-base font-bold text-[#241436] dark:text-slate-100"
            >
              {confirmation.title}
            </h3>
            <p className="text-sm text-[#6c6277] dark:text-slate-300 mt-1.5 leading-relaxed whitespace-pre-line">
              {confirmation.description}
            </p>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2.5 mt-6">
          <button
            type="button"
            disabled={isSubmitting}
            onClick={onCancel}
            className="px-4 py-2 rounded-xl border border-[#d9c9e5] dark:border-[#392b54] bg-white dark:bg-[#211934] text-sm font-semibold text-[#241436] dark:text-slate-200 hover:bg-[#faf3fc] dark:hover:bg-[#2a2042] disabled:opacity-50 whitespace-nowrap shrink-0 cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={isSubmitting}
            onClick={handleConfirmClick}
            className={`px-4 py-2 rounded-xl text-sm font-bold text-white disabled:opacity-60 whitespace-nowrap shrink-0 cursor-pointer ${
              confirmation.variant === 'danger'
                ? 'bg-red-600 hover:bg-red-700'
                : 'bg-gradient-to-r from-[#5c28a1] to-[#9e2c9b] hover:opacity-95'
            }`}
          >
            {isSubmitting ? 'Working…' : confirmation.confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
};
