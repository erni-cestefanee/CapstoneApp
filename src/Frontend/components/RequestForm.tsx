// src/Frontend/components/RequestForm.tsx
import React, {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
  type KeyboardEvent,
} from 'react';
import './styles/RequestForm.css';
import './styles/LeaveRequests.css';
import { useMsal } from '@azure/msal-react';
import { type SavedLeaveRequest, type LeaveType } from './types';

const STORAGE_KEY = 'capstone_leave_requests_v1';

function calculateInclusiveDays(fromIso: string, toIso: string) {
  const from = new Date(fromIso);
  const to = new Date(toIso);
  from.setHours(0, 0, 0, 0);
  to.setHours(0, 0, 0, 0);
  const msPerDay = 24 * 60 * 60 * 1000;
  const diff = Math.round((to.getTime() - from.getTime()) / msPerDay) + 1;
  return diff > 0 ? diff : 0;
}

export type RequestFormHandle = {
  loadRequest: (r: SavedLeaveRequest) => void;
  scrollTo: () => void;
};

export type RequestFormProps = {
  onSaved?: (saved: SavedLeaveRequest[]) => void;
  initialUsername?: string;
  onClose?: () => void;
};

const RequestForm = forwardRef<RequestFormHandle, RequestFormProps>((props, ref) => {
  const { accounts } = useMsal();
  const usernameFromMsal = accounts?.[0]?.username ?? accounts?.[0]?.name ?? '';
  const username = props.initialUsername ?? usernameFromMsal ?? 'Me';

  const [type, setType] = useState<LeaveType>('Vacation');
  const [from, setFrom] = useState<string>('');
  const [to, setTo] = useState<string>('');
  const [reason, setReason] = useState<string>('');
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const dialogRef = useRef<HTMLDivElement | null>(null);
  const formRef = useRef<HTMLFormElement | null>(null);

  function validate() {
    const e: Record<string, string> = {};
    if (!from) e.from = 'Start date is required';
    if (!to) e.to = 'End date is required';
    if (from && to) {
      const fromDate = new Date(from);
      const toDate = new Date(to);
      if (toDate < fromDate) e.to = 'End date cannot be before start date';
      const days = calculateInclusiveDays(from, to);
      if (days <= 0) e.to = 'Selected date range must include at least 1 day';
    }
    if (!reason || reason.trim().length < 5) e.reason = 'Please provide a reason (min 5 chars)';
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function handleSubmit(e?: React.FormEvent) {
    if (e) e.preventDefault();
    setMessage(null);

    if (!validate()) {
      setMessage('Please fix form errors and try again.');
      return;
    }

    setSubmitting(true);
    try {
      const days = calculateInclusiveDays(from, to);
      const req: SavedLeaveRequest = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        user: username,
        type,
        from,
        to,
        reason: reason.trim(),
        days,
        submittedAt: new Date().toISOString(),
      };

      // read existing saved from localStorage, prepend new
      const raw = localStorage.getItem(STORAGE_KEY);
      const existing: SavedLeaveRequest[] = raw ? JSON.parse(raw) : [];
      const updated = [req, ...existing];
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));

      setMessage(`Leave request submitted (${days} day${days === 1 ? '' : 's'}).`);
      setFrom('');
      setTo('');
      setReason('');
      setErrors({});

      props.onSaved?.(updated);
    } catch (err) {
      console.error(err);
      setMessage('Failed to submit leave request.');
    } finally {
      setSubmitting(false);
    }
  }

  function handleClearSaved() {
    if (!confirm('Clear all saved leave requests from localStorage?')) return;
    localStorage.removeItem(STORAGE_KEY);
    setMessage('Saved requests cleared.');
    props.onSaved?.([]);
  }

  // Imperative API for parent
  useImperativeHandle(ref, () => ({
    loadRequest: (r: SavedLeaveRequest) => {
      setType(r.type);
      setFrom(r.from);
      setTo(r.to);
      setReason(r.reason);
      setMessage('Loaded selected request into the form for editing.');
      // focus the first focusable
      setTimeout(() => {
        focusFirstElement();
      }, 0);
    },
    scrollTo: () => {
      // scroll dialog into view and focus first element
      if (dialogRef.current) {
        dialogRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
        setTimeout(() => focusFirstElement(), 50);
      }
    },
  }));

  function focusFirstElement() {
    if (!dialogRef.current) return;
    const focusable = getFocusableElements();
    if (focusable.length) {
      (focusable[0] as HTMLElement).focus();
    }
  }

  function getFocusableElements(): Element[] {
    if (!dialogRef.current) return [];
    return Array.from(
      dialogRef.current.querySelectorAll(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      )
    ).filter((el) => !((el as HTMLElement).hasAttribute('disabled')));
  }

  // close helpers
  function closeModal() {
    props.onClose?.();
  }

  function onBackdropMouseDown(e: React.MouseEvent) {
    // clicking backdrop -> close
    if (e.target === e.currentTarget) closeModal();
  }

  function onKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    if (e.key === 'Escape') {
      e.preventDefault();
      closeModal();
      return;
    }
    if (e.key === 'Tab') {
      // basic focus trap
      const focusable = getFocusableElements();
      if (focusable.length === 0) {
        e.preventDefault();
        return;
      }
      const active = document.activeElement;
      const idx = focusable.indexOf(active as Element);
      if (e.shiftKey) {
        // shift+tab
        if (idx === 0 || active === dialogRef.current) {
          (focusable[focusable.length - 1] as HTMLElement).focus();
          e.preventDefault();
        }
      } else {
        // tab
        if (idx === focusable.length - 1) {
          (focusable[0] as HTMLElement).focus();
          e.preventDefault();
        }
      }
    }
  }

  useEffect(() => {
    // when mounted, focus first element
    setTimeout(() => focusFirstElement(), 0);

    // prevent body scroll while modal open
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, []);

  return (
    <div
      className="modal-backdrop"
      onMouseDown={onBackdropMouseDown}
      role="presentation"
      aria-hidden="false"
    >
      <div
        className="modal-dialog"
        role="dialog"
        aria-modal="true"
        ref={dialogRef}
        onKeyDown={onKeyDown}
      >
        <form ref={formRef} className="leave-form panel modal-form" onSubmit={handleSubmit} noValidate>
          <button
            type="button"
            className="close-btn"
            onClick={() => {
              setMessage(null);
              closeModal();
            }}
            aria-label="Close form"
          >
            ✕
          </button>

 

          <div className="row">
            <label htmlFor="type">Type</label>
            <select id="type" value={type} onChange={(ev) => setType(ev.target.value as LeaveType)}>
              <option>Vacation</option>
              <option>Sick</option>
              <option>Personal</option>
              <option>Unpaid</option>
              <option>Holiday</option>
              <option>Maternity</option>
            </select>
          </div>

          <div className="row two-col">
            <div>
              <label htmlFor="from">From</label>
              <input id="from" type="date" value={from} onChange={(ev) => setFrom(ev.target.value)} />
              {errors.from && <div className="error">{errors.from}</div>}
            </div>

            <div>
              <label htmlFor="to">To</label>
              <input id="to" type="date" value={to} onChange={(ev) => setTo(ev.target.value)} />
              {errors.to && <div className="error">{errors.to}</div>}
            </div>
          </div>

          <div className="row">
            <label htmlFor="reason">Reason</label>
            <textarea id="reason" rows={4} value={reason} onChange={(ev) => setReason(ev.target.value)} />
            {errors.reason && <div className="error">{errors.reason}</div>}
          </div>

          <div className="actions form-actions">
            <button type="submit" className="primary" disabled={submitting}>
              {submitting ? 'Submitting...' : 'Apply Leave'}
            </button>
            <button
              type="button"
              className="secondary"
              onClick={() => {
                setFrom('');
                setTo('');
                setReason('');
                setErrors({});
                setMessage(null);
              }}
              disabled={submitting}
            >
              Reset
            </button>
            <button type="button" className="small inline" onClick={handleClearSaved}>
              Clear saved
            </button>
          </div>

          {message && <div className="message">{message}</div>}
        </form>
      </div>
    </div>
  );
});

RequestForm.displayName = 'RequestForm';

export default RequestForm;