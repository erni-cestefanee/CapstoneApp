import React, { useEffect, useMemo, useState } from 'react';
import './styles/AvailableLeaves.css';
import './styles/ActivityLog.css';

import supabase from '../lib/supabaseClient';
import { useAuth } from '../lib/AuthContext';

type LeaveItem = {
  key: string;
  label: string;
  balance: number;
  allotted?: number;
};
const AvailableLeaves: React.FC = () => {
  const { user, loading: authLoading } = useAuth();
  const [items, setItems] = useState<LeaveItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const year = useMemo(() => new Date().getFullYear(), []);

  useEffect(() => {
    if (authLoading) return;
    setLoading(true);
    setError(null);

    let mounted = true;

    const fetchData = async () => {
      try {
        if (!user) {
          if (mounted) setItems([]);
          if (mounted) setLoading(false);
          return;
        }

        // Resolve user id (prefer users.id from your users table, otherwise supabase auth id)
        let userUuid: string | null = null;
        try {
          const email = user.email ?? undefined;
          if (email) {
            const { data: userRec } = await supabase.from('users').select('id').eq('email', email).limit(1).maybeSingle();
            if (userRec && (userRec as any).id) userUuid = (userRec as any).id;
          }
        } catch (e) {
          // ignore
        }
        if (!userUuid) {
          try {
            const { data: userData } = await supabase.auth.getUser();
            if ((userData as any)?.user?.id) userUuid = (userData as any).user.id;
          } catch (e) {
            // ignore
          }
        }

        if (!userUuid) {
          if (mounted) setItems([]);
          if (mounted) setLoading(false);
          return;
        }

        // fetch single-row balances for this user and year
        const { data, error: qErr } = await supabase
          .from('leave_balances')
          .select('id, user_id, holiday_balance, birthday_balance, sick_balance, vacation_balance, parental_balance, year')
          .eq('user_id', userUuid)
          .eq('year', year as any)
          .limit(1)
          .maybeSingle();

        if (qErr) throw qErr;

        if (data) {
          const mapped: LeaveItem[] = [
            { key: 'holiday_balance', label: 'Holiday Leave', balance: data.holiday_balance ?? 0, allotted: 15 },
            { key: 'birthday_balance', label: 'Birthday Leave', balance: data.birthday_balance ?? 0, allotted: 1 },
            { key: 'sick_balance', label: 'Sick Leave', balance: data.sick_balance ?? 0, allotted: 15 },
            { key: 'vacation_balance', label: 'Vacation Leave', balance: data.vacation_balance ?? 0, allotted: 15 },
            { key: 'parental_balance', label: 'Parental Leave', balance: data.parental_balance ?? 0, allotted: 130 },
          ];
          if (mounted) setItems(mapped);
        } else {
          if (mounted) setItems([]);
        }
      } catch (err: any) {
        console.error('Failed to load leave balances', err);
        if (mounted) setError(err.message ?? String(err));
      } finally {
        if (mounted) setLoading(false);
      }
    };

    fetchData();

    // realtime subscription: listen to changes on this user's leave_balances row
    let subscription: any = null;
        (async () => {
      try {
        const email = user?.email ?? undefined;
        if (!email) return;
        const { data: userRec } = await supabase.from('users').select('id').eq('email', email).limit(1).maybeSingle();
        const userUuid = userRec?.id as string | undefined;
        if (!userUuid) return;

        subscription = supabase
          .channel('public:leave_balances')
          .on('postgres_changes', { event: '*', schema: 'public', table: 'leave_balances', filter: `user_id=eq.${userUuid}` }, async () => {
            try {
              const { data } = await supabase
                .from('leave_balances')
                .select('id, user_id, holiday_balance, birthday_balance, sick_balance, vacation_balance, parental_balance, year')
                .eq('user_id', userUuid)
                .eq('year', year as any)
                .limit(1)
                .maybeSingle();
              if (data) {
                const mapped: LeaveItem[] = [
                  { key: 'holiday_balance', label: 'Holiday Leave', balance: data.holiday_balance ?? 0, allotted: 15 },
                  { key: 'birthday_balance', label: 'Birthday Leave', balance: data.birthday_balance ?? 0, allotted: 1 },
                  { key: 'sick_balance', label: 'Sick Leave', balance: data.sick_balance ?? 0, allotted: 15 },
                  { key: 'vacation_balance', label: 'Vacation Leave', balance: data.vacation_balance ?? 0, allotted: 15 },
                  { key: 'parental_balance', label: 'Parental Leave', balance: data.parental_balance ?? 0, allotted: 130 },
                ];
                if (mounted) setItems(mapped);
              }
            } catch (e) {
              console.debug('Realtime refresh failed', e);
            }
          })
          .subscribe();
      } catch (e) {
        console.debug('Could not setup realtime subscription', e);
      }
    })();

    return () => {
      try {
        if (subscription) supabase.removeChannel(subscription);
      } catch (e) {}
      mounted = false;
    };
  }, [user, authLoading, year]);

  const getColorClass = (label: string) => {
    const lower = label.toLowerCase();
    if (lower.includes('holiday')) return 'purple';
    if (lower.includes('birthday')) return 'orange';
    if (lower.includes('sick')) return 'red';
    if (lower.includes('vacation') || lower.includes('annual')) return 'green';
    if (lower.includes('parent')) return 'blue';
    return 'green';
  };

  return (
    <div className="available-leaves card">
      <h3>Available Leaves</h3>
      <p className="muted">Your current leave balance for this year</p>

      {loading ? (
        <p className="muted">Loading...</p>
      ) : error ? (
        <p className="muted">Error loading balances: {error}</p>
      ) : items.length === 0 ? (
        <>
          <p className="muted">No leave balances found for this year.</p>
        </>
      ) : (
        <ul className="leave-list">
          {items.map(item => {
            const cls = getColorClass(item.label);
            return (
              <li key={item.key} className={`leave-item ${cls}`}>
                <div className="label-left">
                  <span className={`dot ${cls}`} /> <span className="leave-label">{item.label}</span>
                </div>
                <span className="balance">{item.balance} / {item.allotted} Days Available</span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
};

export default AvailableLeaves;
