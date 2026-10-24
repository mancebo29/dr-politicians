import type { Email } from "@/lib/email";

const SITE = "Políticos RD";

function escapeHtml(value: string) {
  return value.replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!,
  );
}

function actionEmail(
  to: string,
  subject: string,
  intro: string,
  action: string,
  url: string,
): Email {
  const safeUrl = escapeHtml(url);
  return {
    to,
    subject,
    text: `${intro}\n\n${action}: ${url}\n\nSi no solicitaste esto, ignora este mensaje.\n\n${SITE}`,
    html: `<p>${escapeHtml(intro)}</p><p><a href="${safeUrl}">${escapeHtml(action)}</a></p><p>Si no solicitaste esto, ignora este mensaje.</p><p>${SITE}</p>`,
  };
}

export function verificationEmail(to: string, url: string): Email {
  return actionEmail(
    to,
    `Confirma tu correo en ${SITE}`,
    "Gracias por registrarte. Confirma tu correo para poder comentar en los perfiles.",
    "Confirmar correo",
    url,
  );
}

export function passwordResetEmail(to: string, url: string): Email {
  return actionEmail(
    to,
    `Restablece tu contraseña en ${SITE}`,
    "Recibimos una solicitud para restablecer tu contraseña. El enlace vence en una hora.",
    "Restablecer contraseña",
    url,
  );
}
