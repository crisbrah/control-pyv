-- =====================================================================
-- Archivo 4. Gestión de usuarios desde la app (ejecutar UNA vez en el SQL Editor).
-- La app nunca usa la clave secreta: estas funciones verifican que quien llama sea
-- admin de la unidad antes de leer correos o asignar roles.
-- =====================================================================

-- Lista de miembros de una unidad (admin e ingeniero la pueden ver)
create or replace function public.miembros_unidad(p_unidad uuid)
returns table (user_id uuid, email text, nombre text, rol rol_usuario, activo boolean)
language plpgsql stable security definer set search_path = public, auth as $$
begin
  if not tiene_rol(p_unidad, array['admin','ingeniero']::rol_usuario[]) then
    raise exception 'Sin permiso para ver los usuarios de esta unidad' using errcode = '42501';
  end if;
  return query
    select m.user_id, u.email::text, p.nombre, m.rol, m.activo
    from membresias m join auth.users u on u.id = m.user_id
    left join perfiles p on p.user_id = m.user_id
    where m.unidad_id = p_unidad order by m.rol, u.email;
end $$;

-- Asigna o cambia el rol de un usuario YA registrado (por correo)
create or replace function public.asignar_rol(p_email text, p_unidad uuid, p_rol rol_usuario, p_nombre text default null)
returns text language plpgsql security definer set search_path = public, auth as $$
declare uid uuid;
begin
  if not tiene_rol(p_unidad, array['admin']::rol_usuario[]) then
    raise exception 'Solo el administrador de la unidad puede asignar roles' using errcode = '42501';
  end if;
  select id into uid from auth.users where lower(email) = lower(trim(p_email));
  if uid is null then
    raise exception 'No existe un usuario con el correo %. Debe crear su cuenta primero.', p_email using errcode = 'P0002';
  end if;
  insert into membresias (user_id, unidad_id, rol, activo) values (uid, p_unidad, p_rol, true)
  on conflict (user_id, unidad_id) do update set rol = excluded.rol, activo = true;
  if p_nombre is not null and length(trim(p_nombre)) > 0 then
    insert into perfiles (user_id, nombre) values (uid, trim(p_nombre))
    on conflict (user_id) do update set nombre = excluded.nombre, updated_at = now();
  end if;
  return 'ok';
end $$;

-- Desactiva (no borra) el acceso de un usuario a la unidad
create or replace function public.quitar_acceso(p_user uuid, p_unidad uuid)
returns text language plpgsql security definer set search_path = public as $$
begin
  if not tiene_rol(p_unidad, array['admin']::rol_usuario[]) then
    raise exception 'Solo el administrador de la unidad puede quitar accesos' using errcode = '42501';
  end if;
  if p_user = auth.uid() then raise exception 'No puedes quitarte tu propio acceso de administrador'; end if;
  update membresias set activo = false where user_id = p_user and unidad_id = p_unidad;
  return 'ok';
end $$;

revoke all on function public.miembros_unidad(uuid) from public, anon;
revoke all on function public.asignar_rol(text, uuid, rol_usuario, text) from public, anon;
revoke all on function public.quitar_acceso(uuid, uuid) from public, anon;
grant execute on function public.miembros_unidad(uuid) to authenticated;
grant execute on function public.asignar_rol(text, uuid, rol_usuario, text) to authenticated;
grant execute on function public.quitar_acceso(uuid, uuid) to authenticated;
