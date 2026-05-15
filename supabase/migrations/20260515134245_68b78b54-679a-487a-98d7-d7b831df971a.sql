
-- Roles enum
create type public.app_role as enum ('super_admin','admin','finance','support','rider','customer');

-- Profiles
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  phone text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.profiles enable row level security;

-- User roles
create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.app_role not null,
  created_at timestamptz not null default now(),
  unique (user_id, role)
);
alter table public.user_roles enable row level security;

create or replace function public.has_role(_user_id uuid, _role public.app_role)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (select 1 from public.user_roles where user_id = _user_id and role = _role)
$$;

create or replace function public.is_admin(_user_id uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (select 1 from public.user_roles where user_id = _user_id and role in ('admin','super_admin'))
$$;

-- Riders
create table public.riders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid unique references auth.users(id) on delete cascade,
  full_name text not null,
  phone text not null,
  vehicle_type text not null check (vehicle_type in ('motorbike','van','lorry')),
  plate_number text not null,
  status text not null default 'offline' check (status in ('offline','online','busy')),
  current_lat double precision,
  current_lng double precision,
  rating numeric(3,2) default 5.0,
  total_deliveries int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.riders enable row level security;

-- Bookings
create table public.bookings (
  id uuid primary key default gen_random_uuid(),
  tracking_number text unique not null,
  customer_id uuid references auth.users(id) on delete set null,
  rider_id uuid references public.riders(id) on delete set null,

  service_type text not null,
  vehicle_type text not null check (vehicle_type in ('motorbike','van','lorry')),
  urgency text not null default 'standard' check (urgency in ('standard','express')),

  pickup_address text not null,
  pickup_lat double precision,
  pickup_lng double precision,
  pickup_contact_name text,
  pickup_contact_phone text,

  dropoff_address text not null,
  dropoff_lat double precision,
  dropoff_lng double precision,
  dropoff_contact_name text,
  dropoff_contact_phone text,

  package_description text,
  package_weight_kg numeric,
  fragile boolean not null default false,
  special_instructions text,

  distance_km numeric not null default 0,
  base_price numeric not null default 0,
  distance_price numeric not null default 0,
  urgency_multiplier numeric not null default 1,
  total_price numeric not null default 0,

  status text not null default 'pending' check (status in ('pending','assigned','picked_up','in_transit','arriving','delivered','cancelled','failed')),
  payment_method text not null default 'mpesa' check (payment_method in ('mpesa','airtel','card','wallet','cod')),
  payment_status text not null default 'pending' check (payment_status in ('pending','paid','failed','refunded')),

  otp text,
  proof_photo_url text,
  delivered_at timestamptz,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.bookings enable row level security;
create index on public.bookings (customer_id);
create index on public.bookings (rider_id);
create index on public.bookings (status);
create index on public.bookings (tracking_number);

-- Booking timeline events
create table public.booking_events (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings(id) on delete cascade,
  status text not null,
  note text,
  rider_lat double precision,
  rider_lng double precision,
  created_at timestamptz not null default now()
);
alter table public.booking_events enable row level security;
create index on public.booking_events (booking_id, created_at);

-- updated_at trigger
create or replace function public.tg_set_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end; $$;

create trigger profiles_updated before update on public.profiles for each row execute function public.tg_set_updated_at();
create trigger riders_updated before update on public.riders for each row execute function public.tg_set_updated_at();
create trigger bookings_updated before update on public.bookings for each row execute function public.tg_set_updated_at();

-- Auto-create profile + customer role on signup
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name, phone)
  values (new.id, new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'phone')
  on conflict (id) do nothing;
  insert into public.user_roles (user_id, role) values (new.id, 'customer')
  on conflict (user_id, role) do nothing;
  return new;
end; $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- RLS Policies

-- profiles
create policy "Profiles: users see own" on public.profiles for select using (auth.uid() = id or public.is_admin(auth.uid()));
create policy "Profiles: users update own" on public.profiles for update using (auth.uid() = id);
create policy "Profiles: users insert own" on public.profiles for insert with check (auth.uid() = id);

-- user_roles
create policy "Roles: users see own" on public.user_roles for select using (auth.uid() = user_id or public.is_admin(auth.uid()));
create policy "Roles: admins manage" on public.user_roles for all using (public.is_admin(auth.uid())) with check (public.is_admin(auth.uid()));

-- riders
create policy "Riders: public read" on public.riders for select using (true);
create policy "Riders: self update" on public.riders for update using (auth.uid() = user_id);
create policy "Riders: admin manage" on public.riders for all using (public.is_admin(auth.uid())) with check (public.is_admin(auth.uid()));

-- bookings
create policy "Bookings: public read by tracking" on public.bookings for select using (true);
create policy "Bookings: customer insert" on public.bookings for insert with check (auth.uid() = customer_id or customer_id is null);
create policy "Bookings: customer update own" on public.bookings for update using (auth.uid() = customer_id);
create policy "Bookings: rider update assigned" on public.bookings for update using (
  exists (select 1 from public.riders r where r.id = bookings.rider_id and r.user_id = auth.uid())
);
create policy "Bookings: admin manage" on public.bookings for all using (public.is_admin(auth.uid())) with check (public.is_admin(auth.uid()));

-- booking_events
create policy "Events: public read" on public.booking_events for select using (true);
create policy "Events: authed insert" on public.booking_events for insert with check (
  auth.uid() is not null
);
create policy "Events: admin manage" on public.booking_events for all using (public.is_admin(auth.uid())) with check (public.is_admin(auth.uid()));
