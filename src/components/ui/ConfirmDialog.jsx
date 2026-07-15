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
      <div className="p-5">
        <h3 className={`${typoTitle3Class} mb-1.5 text-left`}>{title}</h3>
        <p className={`${typoSubheadClass} mb-5 text-left`}>{message}</p>
        <div className="flex gap-2.5">
          <Button variant="bordered" fullWidth onClick={onClose} disabled={loading} className="!px-3">
            Cancel
          </Button>
          <Button
            variant={danger ? 'danger' : 'filled'}
            fullWidth
            onClick={onConfirm}
            disabled={loading}
            className="!px-3 whitespace-nowrap"
          >
            {loading ? 'Please wait...' : confirmLabel}
          </Button>
        </div>
      </div>
    </Modal>
  )
}
