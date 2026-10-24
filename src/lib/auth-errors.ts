const messages: Record<string, string> = {
  INVALID_EMAIL_OR_PASSWORD: "Correo o contraseña incorrectos.",
  INVALID_USERNAME_OR_PASSWORD: "Usuario o contraseña incorrectos.",
  USER_ALREADY_EXISTS: "Ya existe una cuenta con ese correo.",
  USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL: "Ya existe una cuenta con ese correo.",
  USERNAME_IS_ALREADY_TAKEN: "Ese nombre de usuario ya está en uso.",
  USERNAME_TOO_SHORT: "El nombre de usuario debe tener al menos 3 caracteres.",
  USERNAME_TOO_LONG: "El nombre de usuario puede tener como máximo 30 caracteres.",
  INVALID_USERNAME:
    "El nombre de usuario solo puede tener letras, números, puntos y guiones bajos.",
  INVALID_EMAIL: "El correo no es válido.",
  PASSWORD_TOO_SHORT: "La contraseña debe tener al menos 10 caracteres.",
  PASSWORD_TOO_LONG: "La contraseña es demasiado larga.",
  INVALID_TOKEN: "El enlace no es válido o ya venció. Solicita uno nuevo.",
  BANNED_USER: "Esta cuenta está suspendida.",
  REGISTRATION_CLOSED: "El registro de cuentas nuevas está cerrado en este momento.",
  MISSING_RESPONSE: "Completa la verificación de seguridad.",
  VERIFICATION_FAILED: "No pudimos completar la verificación de seguridad. Inténtalo de nuevo.",
};

export function authErrorMessage(error: { code?: string; status?: number } | null | undefined) {
  if (error?.code && messages[error.code]) return messages[error.code];
  if (error?.status === 429) return "Demasiados intentos. Espera un momento e inténtalo de nuevo.";
  return "Algo salió mal. Inténtalo de nuevo.";
}
