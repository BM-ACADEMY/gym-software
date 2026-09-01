import { X } from 'lucide-react';

const Modal = ({ open, onClose, title, children, footer, maxWidth = 'max-w-lg' }) => {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />

      <div className={`relative w-full ${maxWidth} rounded-2xl bg-white shadow-2xl max-h-[90vh] flex flex-col`}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 flex-shrink-0">
          <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="px-6 py-5 overflow-y-auto">{children}</div>

        {footer && <div className="px-6 py-4 border-t border-gray-100 flex justify-end gap-3 flex-shrink-0">{footer}</div>}
      </div>
    </div>
  );
};

export default Modal;
