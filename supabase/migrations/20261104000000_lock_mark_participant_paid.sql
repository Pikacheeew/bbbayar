-- Only check-payment (service role) may mark a participant paid, after ShopeePay confirms.
-- Apply together with the ParticipantView change: the old "Simulate payment" button called this as anon.
revoke execute on function public.mark_participant_paid(uuid) from public, anon, authenticated;
grant execute on function public.mark_participant_paid(uuid) to service_role;
