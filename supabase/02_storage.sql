-- =====================================================================
-- Archivo 2 de 3. Bucket privado de fotos.
-- Ruta obligatoria de cada foto: {unidad_id}/{disparo_id}/{foto_id}.jpg
-- =====================================================================
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('fotos', 'fotos', false, 2097152, array['image/jpeg','image/webp'])
on conflict (id) do nothing;

create policy "fotos_lectura" on storage.objects for select to authenticated
  using (bucket_id = 'fotos' and public.es_miembro(((storage.foldername(name))[1])::uuid));

create policy "fotos_subida" on storage.objects for insert to authenticated
  with check (bucket_id = 'fotos'
    and public.disparo_editable(((storage.foldername(name))[2])::uuid)
    and exists (select 1 from public.disparos d
                where d.id = ((storage.foldername(name))[2])::uuid
                  and d.unidad_id = ((storage.foldername(name))[1])::uuid));
