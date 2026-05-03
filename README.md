# Supabase - Conexión de la Web

Esta carpeta concentra la configuración y la conexión real con Supabase.

## Archivos

- `config.js`: aquí colocas tu URL y tu clave `anon` de Supabase.
- `client.js`: adaptador de conexión y operaciones de sesión/estado.
- `validation.sql`: validación de estructura, RLS, permisos y triggers.

## Paso a paso para vincular

1. Crea tu proyecto en Supabase.
2. En Supabase, abre `SQL Editor` y ejecuta el contenido de `../supabase_schema.sql`.
   - Si ya lo ejecutaste antes, vuelve a ejecutarlo para aplicar refuerzos de seguridad y permisos.
3. En Supabase, ve a `Project Settings` > `API` y copia:
   - `Project URL`
   - `anon public key`
4. Abre `supabase/config.js` y pega esos valores en:
   - `url`
   - `anonKey`
5. Guarda los cambios y recarga la web.
6. (Opcional recomendado) Ejecuta `supabase/validation.sql` y confirma que todo salga en `PASS`.

## Tablas que usa la web

- `nexus_module_records`: registros de todos los formularios CRUD por módulo.
- `nexus_module_sequences`: secuencias autogeneradas por módulo (IDs consecutivos).
- `nexus_user_app_state`: configuración, historial, alertas y estado de usuario.

## Resultado esperado

- Registro e inicio de sesión reales con Supabase Auth.
- Cada creación, edición y eliminación de formulario queda en tablas reales de Supabase.
- Historial, configuración y estado operativo también se guardan en Supabase.
- Si no hay sesión iniciada, no se guardan registros ni actividad.
- Las tablas tienen RLS, políticas por `user_id`, permisos explícitos y actualización automática de `updated_at`.
