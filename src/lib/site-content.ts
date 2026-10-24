// Default public texts, used until an admin saves their own in
// /admin/configuracion. Written in the markup of src/lib/rich-text.ts. The
// privacy policy and terms are drafts pending the legal review in PLAN §9.

const methodology = `Cómo construimos cada perfil, qué fuentes aceptamos, qué significa la relevancia en noticias y cómo pedir una corrección.

## Cómo se investiga un perfil {#investigacion}

Los perfiles se investigan con ayuda de inteligencia artificial: un asistente busca y lee fuentes públicas y redacta un borrador estructurado (trayectoria, partidos, leyes, declaraciones y controversias) en el que cada dato indica de qué fuente sale.

**Ningún borrador se publica de forma automática.** Una persona del equipo revisa cada sección, abre las fuentes, corrige o descarta lo que no esté bien respaldado y solo entonces aprueba la publicación. Cada publicación queda registrada con su fecha y una nota de revisión, que se muestra en el perfil como «Última actualización».

Preferimos la exactitud a la exhaustividad: un dato sin fuente suficiente no se suaviza ni se presenta como probable, simplemente no se publica. Por eso algunos perfiles son más breves que otros.

## Reglas de fuentes {#fuentes}

- Todo dato publicado enlaza al menos a una fuente. Las notas numeradas de cada perfil llevan a la lista de fuentes, con medio, fecha y enlace al original.
- Orden de preferencia: fuentes oficiales (Congreso Nacional, Senado, Cámara de Diputados, Junta Central Electoral, Gaceta Oficial, Presidencia y ministerios), luego prensa nacional de referencia y, por último, otras fuentes. Wikipedia puede orientar la búsqueda, pero nunca es la única fuente de un dato.
- Las fechas se publican con la precisión que da la fuente: si solo se conoce el año, se muestra el año. No completamos días ni meses.
- Los fragmentos citados son breves y sirven para ubicar el dato en la fuente; no reproducimos artículos.
- Cuando existe, enlazamos también una copia archivada de la fuente, para que siga disponible si el original desaparece.
- Antes de atribuir una noticia confirmamos la identidad de la persona (cargo, provincia, partido), porque los nombres repetidos son frecuentes.
- Redactamos en español neutral, sin adjetivos de valoración ni suposiciones.

## Controversias {#controversias}

Una controversia solo se publica si la respaldan al menos dos medios de prensa independientes entre sí, o al menos una fuente oficial (por ejemplo, una sentencia, una actuación de la Procuraduría o un informe de la Cámara de Cuentas).

Indicamos siempre su estado legal con precisión (denuncia, en investigación, acusación formal, condena, absolución, archivo, acuerdo o sin acción judicial) y nunca presentamos una acusación como un hecho probado. Si la persona respondió públicamente, incluimos su respuesta.

## Quién aparece {#alcance}

El objetivo es cubrir a todas las personas vivas que ocupan u ocuparon cargos públicos relevantes en la República Dominicana: Presidencia y Vicepresidencia, ministerios, Senado, Cámara de Diputados, Parlacen, alcaldías, dirección de partidos con representación en el Congreso y candidaturas presidenciales. Empezamos por quienes han ocupado esos cargos desde 2016 y después incorporamos periodos anteriores.

Si una persona con perfil fallece, el perfil se conserva como registro, se marca como persona fallecida (con su fuente) y deja de aparecer en el listado principal y en la clasificación semanal. Sigue disponible mediante la búsqueda y su enlace directo.

## Relevancia en noticias {#ranking}

El orden del listado principal refleja la **relevancia en noticias**: cuánto aparece cada persona en la prensa dominicana. **No es una encuesta** ni mide aprobación, popularidad o calidad de su gestión; aparecer mucho en las noticias puede deberse a hechos positivos o negativos.

- Se actualiza una vez por semana, los lunes, con los artículos publicados en los siete días anteriores.
- La señal principal es el número de artículos distintos que mencionan a la persona, buscados con una consulta propia de cada perfil para no confundirla con alguien del mismo nombre. Las visitas al perfil en este sitio cuentan con un peso mucho menor.
- Junto a cada puesto se muestra el cambio respecto a la semana anterior. Quienes tienen muy pocas menciones en una semana conservan su último puesto y se marcan como «sin datos recientes».
- Mientras no exista una clasificación, o para quienes aún no tienen puesto, el orden es alfabético. También puedes ordenar siempre por nombre.

## Correcciones y derecho de réplica {#correcciones}

Cualquier persona, incluidos los propios políticos o sus equipos, puede señalar un error o pedir que se incluya su versión mediante el enlace «Reportar un error / Derecho de réplica» de cada perfil. Ayuda mucho adjuntar una fuente que respalde la corrección.

Cada solicitud la revisa una persona. Si procede, corregimos el perfil o pedimos una nueva investigación del punto señalado; la corrección queda reflejada en el historial de cambios del perfil. Los políticos no pueden editar sus perfiles directamente.

[Enviar una corrección o comentario](/feedback)

## Fotos y datos personales {#datos}

Solo usamos fotos con una licencia clara de reutilización (por ejemplo, Wikimedia Commons o retratos oficiales que lo permitan); si no la hay, el perfil muestra un marcador en su lugar.

Publicamos únicamente información sobre el papel público de cada persona. No incluimos direcciones, datos de contacto privados ni detalles familiares que no sean relevantes en un contexto político y no se hayan publicado antes.

Aplicamos las mismas reglas a todas las personas y partidos, y conservamos un registro de cada cambio publicado.`;

const privacy = `**Texto provisional.** Esta política está pendiente de revisión legal y se actualizará antes del lanzamiento.

## Responsable

Responsable del tratamiento: por definir. Para cualquier consulta sobre tus datos, escríbenos mediante el [formulario de contacto](/feedback).

## Qué datos recogemos

- **Cuenta**: nombre, nombre de usuario, correo electrónico y contraseña (guardada de forma cifrada e irreversible). Si entras con Google, recibimos tu nombre, tu correo y un identificador de tu cuenta de Google.
- **Sesiones**: mientras tienes la sesión iniciada guardamos la dirección IP y el navegador desde los que entraste, para proteger tu cuenta.
- **Comentarios y reportes**: lo que publicas, cuándo lo publicas y los reportes que envías. Un comentario que eliminas deja de mostrarse, pero lo conservamos para atender reclamaciones y moderación.
- **Mensajes de contacto y correcciones**: el mensaje, la fuente que adjuntes y, si lo indicas, un correo para responderte.
- **Visitas**: solo contamos cuántas veces se ve cada perfil al día. No guardamos tu IP, cookies de seguimiento ni identificadores para esto.
- **Prevención de abusos**: para limitar el envío masivo de mensajes guardamos durante dos días una huella cifrada de la dirección IP, que no permite recuperar la dirección original.

## Para qué los usamos

Para gestionar tu cuenta, mostrar tus comentarios con tu nombre de usuario, moderar la comunidad, responder correcciones y proteger el sitio. No vendemos datos ni los usamos para publicidad.

## Con quién los compartimos

Con los proveedores que hacen funcionar el sitio: alojamiento y base de datos, envío de correos (Resend), verificación contra bots (Cloudflare Turnstile) y, si lo eliges, inicio de sesión con Google. Solo reciben lo necesario para prestar su servicio.

## Tus derechos

Conforme a la Ley 172-13 de protección de datos personales puedes pedir acceso, rectificación o eliminación de tus datos, y oponerte a su tratamiento. Escríbenos mediante el [formulario de contacto](/feedback).

## Datos de las personas con perfil

Los perfiles solo contienen información sobre el papel público de cada persona, tomada de fuentes públicas citadas. Ver la [metodología](/metodologia).`;

const terms = `**Texto provisional.** Estas condiciones están pendientes de revisión legal y se actualizarán antes del lanzamiento.

## Uso del sitio

Políticos RD ofrece perfiles informativos de personas con cargos públicos en la República Dominicana. Cada dato enlaza a su fuente; te recomendamos consultarlas. Los perfiles se investigan con ayuda de inteligencia artificial y los revisa una persona antes de publicarse (ver la [metodología](/metodologia)).

## Cuentas

Para comentar necesitas una cuenta con el correo confirmado. Eres responsable de lo que publicas con ella. Podemos suspender cuentas que incumplan estas normas.

## Normas de los comentarios

- Respeta a las demás personas: no se permiten insultos, amenazas, acoso ni discursos de odio.
- No publiques acusaciones sin fuente, datos personales de nadie (direcciones, teléfonos, familiares) ni contenido ilegal.
- No publiques publicidad, enlaces engañosos ni mensajes repetidos.

Los comentarios reportados varias veces se ocultan hasta que los revise una persona. Podemos ocultar o eliminar comentarios que incumplan estas normas.

## Correcciones

Si encuentras un error en un perfil, o eres la persona del perfil y quieres ejercer tu derecho de réplica, usa el enlace «Reportar un error / Derecho de réplica» o el [formulario de contacto](/feedback).

## Cambios

Podemos actualizar estas condiciones; la versión vigente es siempre la publicada en esta página.`;

export const defaultContent = {
  about:
    "Perfiles investigados con ayuda de IA y revisados por personas. Cada dato enlaza a su fuente.",
  methodology,
  privacy,
  terms,
  banner: "",
  maintenance: false,
  maintenanceMessage:
    "Estamos haciendo tareas de mantenimiento. El sitio volverá a estar disponible en breve.",
};
