import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Metodología",
  description:
    "Cómo se investigan, revisan y corrigen los perfiles de Políticos RD, qué fuentes se aceptan y qué mide la relevancia en noticias.",
  alternates: { canonical: "/metodologia" },
};

// Static draft of the methodology (PLAN §6.3, §9, §10). Phase 5 moves the
// text to site settings so admins can edit it.
export default function MethodologyPage() {
  return (
    <article className="mx-auto w-full max-w-3xl px-4 py-8 sm:py-10">
      <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Metodología</h1>
      <p className="mt-3 text-lg text-muted">
        Cómo construimos cada perfil, qué fuentes aceptamos, qué significa la relevancia en noticias
        y cómo pedir una corrección.
      </p>

      <nav aria-label="En esta página" className="mt-6 rounded-lg border border-border p-4 text-sm">
        <p className="font-medium">En esta página</p>
        <ul className="mt-2 grid gap-1 sm:grid-cols-2">
          {[
            ["investigacion", "Cómo se investiga un perfil"],
            ["fuentes", "Reglas de fuentes"],
            ["controversias", "Controversias"],
            ["alcance", "Quién aparece"],
            ["ranking", "Relevancia en noticias"],
            ["correcciones", "Correcciones y derecho de réplica"],
            ["datos", "Fotos y datos personales"],
          ].map(([id, label]) => (
            <li key={id}>
              <a
                href={`#${id}`}
                className="text-accent underline underline-offset-4 hover:decoration-2"
              >
                {label}
              </a>
            </li>
          ))}
        </ul>
      </nav>

      <Section id="investigacion" title="Cómo se investiga un perfil">
        <p>
          Los perfiles se investigan con ayuda de inteligencia artificial: un asistente busca y lee
          fuentes públicas y redacta un borrador estructurado (trayectoria, partidos, leyes,
          declaraciones y controversias) en el que cada dato indica de qué fuente sale.
        </p>
        <p>
          <strong>Ningún borrador se publica de forma automática.</strong> Una persona del equipo
          revisa cada sección, abre las fuentes, corrige o descarta lo que no esté bien respaldado y
          solo entonces aprueba la publicación. Cada publicación queda registrada con su fecha y una
          nota de revisión, que se muestra en el perfil como «Última actualización».
        </p>
        <p>
          Preferimos la exactitud a la exhaustividad: un dato sin fuente suficiente no se suaviza ni
          se presenta como probable, simplemente no se publica. Por eso algunos perfiles son más
          breves que otros.
        </p>
      </Section>

      <Section id="fuentes" title="Reglas de fuentes">
        <ul className="list-disc space-y-2 pl-5">
          <li>
            Todo dato publicado enlaza al menos a una fuente. Las notas numeradas de cada perfil
            llevan a la lista de fuentes, con medio, fecha y enlace al original.
          </li>
          <li>
            Orden de preferencia: fuentes oficiales (Congreso Nacional, Senado, Cámara de Diputados,
            Junta Central Electoral, Gaceta Oficial, Presidencia y ministerios), luego prensa
            nacional de referencia y, por último, otras fuentes. Wikipedia puede orientar la
            búsqueda, pero nunca es la única fuente de un dato.
          </li>
          <li>
            Las fechas se publican con la precisión que da la fuente: si solo se conoce el año, se
            muestra el año. No completamos días ni meses.
          </li>
          <li>
            Los fragmentos citados son breves y sirven para ubicar el dato en la fuente; no
            reproducimos artículos.
          </li>
          <li>
            Cuando existe, enlazamos también una copia archivada de la fuente, para que siga
            disponible si el original desaparece.
          </li>
          <li>
            Antes de atribuir una noticia confirmamos la identidad de la persona (cargo, provincia,
            partido), porque los nombres repetidos son frecuentes.
          </li>
          <li>Redactamos en español neutral, sin adjetivos de valoración ni suposiciones.</li>
        </ul>
      </Section>

      <Section id="controversias" title="Controversias">
        <p>
          Una controversia solo se publica si la respaldan al menos dos medios de prensa
          independientes entre sí, o al menos una fuente oficial (por ejemplo, una sentencia, una
          actuación de la Procuraduría o un informe de la Cámara de Cuentas).
        </p>
        <p>
          Indicamos siempre su estado legal con precisión (denuncia, en investigación, acusación
          formal, condena, absolución, archivo, acuerdo o sin acción judicial) y nunca presentamos
          una acusación como un hecho probado. Si la persona respondió públicamente, incluimos su
          respuesta.
        </p>
      </Section>

      <Section id="alcance" title="Quién aparece">
        <p>
          El objetivo es cubrir a todas las personas vivas que ocupan u ocuparon cargos públicos
          relevantes en la República Dominicana: Presidencia y Vicepresidencia, ministerios, Senado,
          Cámara de Diputados, Parlacen, alcaldías, dirección de partidos con representación en el
          Congreso y candidaturas presidenciales. Empezamos por quienes han ocupado esos cargos
          desde 2016 y después incorporamos periodos anteriores.
        </p>
        <p>
          Si una persona con perfil fallece, el perfil se conserva como registro, se marca como
          persona fallecida (con su fuente) y deja de aparecer en el listado principal y en la
          clasificación semanal. Sigue disponible mediante la búsqueda y su enlace directo.
        </p>
      </Section>

      <Section id="ranking" title="Relevancia en noticias">
        <p>
          El orden del listado principal refleja la <strong>relevancia en noticias</strong>: cuánto
          aparece cada persona en la prensa dominicana. <strong>No es una encuesta</strong> ni mide
          aprobación, popularidad o calidad de su gestión; aparecer mucho en las noticias puede
          deberse a hechos positivos o negativos.
        </p>
        <ul className="list-disc space-y-2 pl-5">
          <li>
            Se actualiza una vez por semana, los lunes, con los artículos publicados en los siete
            días anteriores.
          </li>
          <li>
            La señal principal es el número de artículos distintos que mencionan a la persona,
            buscados con una consulta propia de cada perfil para no confundirla con alguien del
            mismo nombre. Las visitas al perfil en este sitio cuentan con un peso mucho menor.
          </li>
          <li>
            Junto a cada puesto se muestra el cambio respecto a la semana anterior. Quienes tienen
            muy pocas menciones en una semana conservan su último puesto y se marcan como «sin datos
            recientes».
          </li>
          <li>
            Mientras no exista una clasificación, o para quienes aún no tienen puesto, el orden es
            alfabético. También puedes ordenar siempre por nombre.
          </li>
        </ul>
      </Section>

      <Section id="correcciones" title="Correcciones y derecho de réplica">
        <p>
          Cualquier persona, incluidos los propios políticos o sus equipos, puede señalar un error o
          pedir que se incluya su versión mediante el enlace «Reportar un error / Derecho de
          réplica» de cada perfil. Ayuda mucho adjuntar una fuente que respalde la corrección.
        </p>
        <p>
          Cada solicitud la revisa una persona. Si procede, corregimos el perfil o pedimos una nueva
          investigación del punto señalado; la corrección queda reflejada en el historial de cambios
          del perfil. Los políticos no pueden editar sus perfiles directamente.
        </p>
        <p>
          <Link
            href="/feedback"
            prefetch={false}
            className="text-accent underline underline-offset-4 hover:decoration-2"
          >
            Enviar una corrección o comentario
          </Link>
        </p>
      </Section>

      <Section id="datos" title="Fotos y datos personales">
        <p>
          Solo usamos fotos con una licencia clara de reutilización (por ejemplo, Wikimedia Commons
          o retratos oficiales que lo permitan); si no la hay, el perfil muestra un marcador en su
          lugar.
        </p>
        <p>
          Publicamos únicamente información sobre el papel público de cada persona. No incluimos
          direcciones, datos de contacto privados ni detalles familiares que no sean relevantes en
          un contexto político y no se hayan publicado antes.
        </p>
        <p>
          Aplicamos las mismas reglas a todas las personas y partidos, y conservamos un registro de
          cada cambio publicado.
        </p>
      </Section>
    </article>
  );
}

function Section({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section id={id} aria-labelledby={`${id}-titulo`} className="mt-10 scroll-mt-6">
      <h2 id={`${id}-titulo`} className="text-xl font-semibold">
        {title}
      </h2>
      <div className="mt-3 space-y-3 leading-relaxed">{children}</div>
    </section>
  );
}
