"use server";

import { revalidatePath, updateTag } from "next/cache";
import { db } from "@/db";
import type { ActionState } from "@/app/admin/investigacion/actions";
import { CACHE_TAGS } from "@/lib/cache-tags";
import { parseRankingSettings, RANKING_SETTINGS_KEY } from "@/lib/popularity/settings";
import { requireRole } from "@/lib/session";
import { saveSetting, SettingsError } from "@/lib/site-settings";

const PATH = "/admin/configuracion";

const text = (form: FormData, key: string) => {
  const value = form.get(key);
  return typeof value === "string" ? value : "";
};
const checked = (form: FormData, key: string) => form.get(key) === "on";
const integer = (form: FormData, key: string) => {
  const value = text(form, key).trim();
  return value === "" ? Number.NaN : Number(value);
};

async function save(key: string, value: unknown, validate?: (value: unknown) => unknown) {
  const { user } = await requireRole(["admin"], PATH);
  try {
    await saveSetting(db, { key, value, actorUserId: user.id, validate });
  } catch (error) {
    if (error instanceof SettingsError) return { error: error.message, issues: error.issues };
    if (validate && error instanceof Error) return { error: error.message };
    throw error;
  }
  // Public pages cache the content and registration settings.
  updateTag(CACHE_TAGS.settings);
  revalidatePath(PATH);
  return null;
}

export async function saveCommentSettingsAction(_: ActionState, form: FormData) {
  return save("comments", {
    enabled: checked(form, "enabled"),
    preModeration: checked(form, "preModeration"),
    autoHideThreshold: integer(form, "autoHideThreshold"),
    editWindowMinutes: integer(form, "editWindowMinutes"),
    blockedTerms: text(form, "blockedTerms")
      .split("\n")
      .map((t) => t.trim())
      .filter(Boolean),
  });
}

export async function saveRegistrationSettingsAction(_: ActionState, form: FormData) {
  return save("registration", {
    enabled: checked(form, "enabled"),
    password: checked(form, "password"),
    google: checked(form, "google"),
  });
}

export async function saveContentSettingsAction(_: ActionState, form: FormData) {
  return save("content", {
    about: text(form, "about"),
    banner: text(form, "banner"),
    maintenance: checked(form, "maintenance"),
    maintenanceMessage: text(form, "maintenanceMessage"),
    methodology: text(form, "methodology"),
    privacy: text(form, "privacy"),
    terms: text(form, "terms"),
  });
}

export async function saveRankingSettingsAction(_: ActionState, form: FormData) {
  let value: unknown;
  try {
    value = JSON.parse(text(form, "ranking"));
  } catch {
    return { error: "El JSON no es válido." };
  }
  // The full object is stored so later default changes don't alter it silently.
  return save(RANKING_SETTINGS_KEY, value, (v) => parseRankingSettings(v));
}
