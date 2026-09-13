grant select, insert, update, delete on public.notification_delivery_settings to authenticated;
grant select, insert, update, delete on public.notification_reminder_rules to authenticated;

grant all on public.notification_delivery_settings to service_role;
grant all on public.notification_reminder_rules to service_role;
grant all on public.notification_reminders_log to service_role;
grant all on public.notification_push_queue to service_role;
