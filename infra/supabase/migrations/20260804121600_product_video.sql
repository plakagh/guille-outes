-- Un vídeo por producto, con su propia descripción.
--
-- Una prenda se entiende viéndola moverse y una lámina se entiende viendo cómo
-- la cuelgan: hay piezas que se venden con un vídeo de veinte segundos mejor que
-- con cuatro fotos. Pero la mayoría no tiene ninguno, y ahí la ficha no debe
-- mostrar un hueco vacío: sin `video_url` la zona entera desaparece de la ficha.
--
-- Es una dirección, no un fichero subido: el bucket `media` solo acepta imágenes
-- y como máximo 8 MB, así que el vídeo vive donde ya está publicado (YouTube,
-- Vimeo o un .mp4 propio) y aquí se guarda únicamente el enlace. El storefront
-- decide cómo reproducirlo a partir del dominio.
--
-- La descripción es aparte y también opcional: es el pie del vídeo ("grabado en
-- el taller de Ribeira"), no la descripción del producto, que ya existe y es
-- obligatoria. Va en i18n_text porque la tienda es trilingüe.

alter table public.products
  add column if not exists video_url     text,
  add column if not exists video_caption public.i18n_text;

-- https obligatorio: un vídeo por http rompería la página en un sitio servido
-- por https, y un `javascript:` en un src es un agujero, no un vídeo.
alter table public.products
  drop constraint if exists products_video_url_is_https;

alter table public.products
  add constraint products_video_url_is_https
  check (video_url is null or video_url ~ '^https://[^[:space:]]+$');

comment on column public.products.video_url is
  'Dirección https del vídeo del producto: página de YouTube o Vimeo, o un fichero '
  '.mp4/.webm alojado en cualquier sitio. Null (lo normal) significa que la ficha no '
  'muestra ninguna zona de vídeo.';

comment on column public.products.video_caption is
  'Pie del vídeo, trilingüe y opcional. Null cuando nadie ha escrito ninguno: entonces '
  'se reproduce el vídeo sin texto debajo. No tiene sentido sin video_url, y el panel '
  'de administración lo borra al quitar el enlace.';
