import './styles/MasterEdit.css';

import { useEffect, useState } from 'react';

import { supabase } from '../../lib/supabaseClient';

type UserRow = {
  id: string;
  email?: string | null;
  full_name?: string | null;
  department?: string | null;
  roles?: string[] | null;
  [k: string]: any;
};

type LeaveBalances = {
  holiday_balance?: number | null;
  birthday_balance?: number | null;
  sick_balance?: number | null;
  vacation_balance?: number | null;
  parental_balance?: number | null;
  [k: string]: any;
};

type Props = {
  user: UserRow;
  onClose: () => void;
  onSave?: (updates: any) => Promise<void> | void;
};

export default function MasterEdit({ user, onClose, onSave }: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [role, setRole] = useState((user.roles && user.roles[0]) || user.app_metadata?.role || '');
  const [editedLeaves, setEditedLeaves] = useState<LeaveBalances>({});
  const year = new Date().getFullYear();

  // validation: ensure no leave balance or allotted value is negative
  const hasNegative = Object.values(editedLeaves || {}).some((v) => typeof v === 'number' && v < 0);
  // validation: ensure balances do not exceed allotted values when allotted is present
  const hasExceeded = (() => {
    const pairs: Array<[string, string]> = [
      ['holiday_balance', 'holiday_allotted'],
      ['birthday_balance', 'birthday_allotted'],
      ['sick_balance', 'sick_allotted'],
      ['vacation_balance', 'vacation_allotted'],
      ['parental_balance', 'parental_allotted'],
    ];
    return pairs.some(([bal, all]) => {
      const b = (editedLeaves as any)[bal];
      const a = (editedLeaves as any)[all];
      if (typeof b === 'number' && typeof a === 'number') {
        return b > a;
      }
      return false;
    });
  })();

  type LeaveItem = {
    key: string;
    label: string;
    balance: number;
    allotted?: number | null;
  };

  const items: LeaveItem[] = [
    { key: 'holiday_balance', label: 'Holiday Leave', balance: (editedLeaves.holiday_balance as number) ?? 0, allotted: (editedLeaves as any).holiday_allotted ?? null },
    { key: 'birthday_balance', label: 'Birthday Leave', balance: (editedLeaves.birthday_balance as number) ?? 0, allotted: (editedLeaves as any).birthday_allotted ?? null },
    { key: 'sick_balance', label: 'Sick Leave', balance: (editedLeaves.sick_balance as number) ?? 0, allotted: (editedLeaves as any).sick_allotted ?? null },
    { key: 'vacation_balance', label: 'Vacation Leave', balance: (editedLeaves.vacation_balance as number) ?? 0, allotted: (editedLeaves as any).vacation_allotted ?? null },
    { key: 'parental_balance', label: 'Parental Leave', balance: (editedLeaves.parental_balance as number) ?? 0, allotted: (editedLeaves as any).parental_allotted ?? null },
  ];

  useEffect(() => {
    fetchLeaves();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user.id]);

  async function fetchLeaves() {
    setLoading(true);
    setError(null);
    try {
      // attempt to read from leave_balances table for the current year (balances + allotted)
      const { data, error } = await supabase
        .from('leave_balances')
        .select('holiday_balance,holiday_allotted,birthday_balance,birthday_allotted,sick_balance,sick_allotted,vacation_balance,vacation_allotted,parental_balance,parental_allotted,year')
        .eq('user_id', user.id)
        .eq('year', year as any)
        .single();

      if (error) {
        console.warn('MasterEdit: failed to load leaves', error);
        setEditedLeaves({});
      } else {
  setEditedLeaves(data ?? {});
      }
    } catch (err: any) {
      console.error(err);
      setError(String(err));
    } finally {
      setLoading(false);
    }
  }

  const handleSave = async () => {
    setLoading(true);
    setError(null);
    try {
      const updates: any = { id: user.id };
      if (role) updates.role = role;
      // include leaves that changed
      for (const k of Object.keys(editedLeaves)) {
        updates[k] = (editedLeaves as any)[k];
      }

      if (onSave) {
        await onSave(updates);
      }

      onClose();
    } catch (err: any) {
      console.error('MasterEdit save failed', err);
      setError(err?.message ?? String(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-backdrop masteredit-backdrop" onClick={onClose}>
      <div className="masteredit-modal" onClick={(e) => e.stopPropagation()}>
        <header className="masteredit-header">
          <h3>Employee #{user.id}</h3>
          <div className="masteredit-sub">{user.full_name ?? user.email}</div>
        </header>

        <div className="masteredit-body">
          <section className="masteredit-left">
            <h4>Details</h4>
            <div className="row"><strong>Employee ID:</strong> {user.id}</div>
            <div className="row"><strong>Name:</strong> {user.full_name ?? user.email}</div>
            <div className="row"><strong>Department:</strong> {user.department ?? '—'}</div>
            <div className="row"><strong>Roles:</strong>
              <select value={role} onChange={(e) => setRole(e.target.value)}>
                <option value="">-- select role --</option>
                <option value="admin">admin</option>
                <option value="employee">employee</option>
                <option value="SUL">SUL</option>
                <option value="PL">PL</option>
                <option value="CX">CX</option>
              </select>
            </div>
          </section>

          <section className="masteredit-right">
            <h4>Remaining Leaves</h4>
            {loading ? (
              <p>Loading…</p>
            ) : (
              <>
              <ul className="leaves-preview">
                {items.map(it => (
                  <li key={it.key} className="lp-row">
                    <span className="lp-label">{it.label}</span>
                    <span className="lp-balance">{it.balance} / {it.allotted ?? 'N/A'}</span>
                  </li>
                ))}
              </ul>

              <div className="leaves-grid-compact">
                {items.map(it => {
                  const balKey = it.key; // e.g. 'holiday_balance'
                  const allKey = balKey.replace('_balance', '_allotted');
                  const allottedVal = (editedLeaves as any)[allKey] as number | undefined;
                  return (
                    <div className="lg-row" key={it.key}>
                      <div className="lg-label">{it.label}</div>
                      <div className="lg-inputs">
                        <input
                          type="number"
                          min={0}
                          step={1}
                          max={typeof allottedVal === 'number' ? allottedVal : undefined}
                          value={(editedLeaves as any)[balKey] ?? ''}
                          onChange={(e) => setEditedLeaves({ ...editedLeaves, [balKey]: Number(e.target.value) })}
                          className="lg-balance-input"
                        />
                        <span className="lg-sep">/</span>
                        <input
                          type="number"
                          min={0}
                          step={1}
                          value={(editedLeaves as any)[allKey] ?? ''}
                          onChange={(e) => setEditedLeaves({ ...editedLeaves, [allKey]: Number(e.target.value) })}
                          className="lg-allotted-input"
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
              </>
            )}
            {hasNegative && <div className="error">Values must be non-negative</div>}
            {hasExceeded && <div className="error">Balances cannot exceed allotted values</div>}
            {error && <div className="error">{error}</div>}
          </section>
        </div>

        <footer className="masteredit-footer">
          <button onClick={onClose} className="btn-cancel">Cancel</button>
          <button onClick={handleSave} className="btn-save" disabled={loading || hasNegative || hasExceeded}>{loading ? 'Saving…' : 'Save changes'}</button>
        </footer>
      </div>
    </div>
  );
}
