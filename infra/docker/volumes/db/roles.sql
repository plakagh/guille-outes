\set pgpass `echo "$POSTGRES_PASSWORD"`

alter user authenticator with password :'pgpass';
alter user pgbouncer with password :'pgpass';
alter user supabase_auth_admin with password :'pgpass';
alter user supabase_storage_admin with password :'pgpass';
alter user supabase_replication_admin with password :'pgpass';
