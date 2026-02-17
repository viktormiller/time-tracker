import { useEffect } from 'react';
import { X } from 'lucide-react';

interface PhotoLightboxProps {
  photoPath: string;
  onClose: () => void;
}

export function PhotoLightbox({ photoPath, onClose }: PhotoLightboxProps) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <button
        onClick={onClose}
        className="absolute top-4 right-4 p-2 bg-black/50 hover:bg-black/70 rounded-full transition"
        type="button"
      >
        <X size={24} className="text-white" />
      </button>
      <img
        src={photoPath}
        alt="Zählerstand Foto"
        className="max-h-[90vh] max-w-[90vw] object-contain rounded-lg"
        onClick={(e) => e.stopPropagation()}
      />
    </div>
  );
}
