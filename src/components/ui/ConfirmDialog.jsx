import Modal from './Modal'
import Button from './Button'
import { typoTitle3Class, typoSubheadClass } from '../../utils/designSystem'

export default function ConfirmDialog({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmLabel = 'Confirm',
  danger = false,
  loading = false,
  overlayClassName = 'z-50',
}) {
  return (
    <Modal isOpen={isOpen} onClose={onClose} glass overlayClassName={overlayClassName}>
      <div className="p-6">
        <h3 className={`${typoTitle3Class} mb-2 text-left`}>{title}</h3>
        <p className={`${typoSubheadClass} mb-6 text-left`}>{message}</p>
        <div className="flex gap-3">
          <Button variant="bordered" fullWidth onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button
            variant={danger ? 'danger' : 'filled'}
            fullWidth
            onClick={onConfirm}
            disabled={loading}
          >
            {loading ? 'Please wait...' : confirmLabel}
          </Button>
        </div>
      </div>
    </Modal>
  )
}
