import { eq } from "drizzle-orm";
import { z } from "zod";
import type { Database, Executor } from "@/db/client";
import { auditLog, siteSettings } from "@/db/schema";
import { defaultContent } from "./site-content";

// Site configuration edited in /admin/configuracion (PLAN §8.3). Each key is a
// row in site_settings; fields missing from a stored value fall back to the
// defaults below, so adding a field never needs a data migration. The ranking
// settings live in src/lib/popularity/settings.ts.

const commentsSchema = z.object({
  enabled: z.boolean(),
  // New and edited comments wait for a moderator before they are shown.
  preModeration: z.boolean(),
  // Open reports that hide a comment until a moderator reviews it.
  autoHideThreshold: z.number().int().min(1).max(100),
  // Comments containing one of these words or phrases (accent- and
  // case-insensitive) are held for review instead of being rejected.
  blockedTerms: z.array(z.string().trim().min(1).max(100)).max(500),
  editWindowMinutes: z.number().int().min(0).max(1440),
});

const registrationSchema = z.object({
  // New accounts only; existing accounts can always sign in.
  enabled: z.boolean(),
  password: z.boolean(),
  google: z.boolean(),
});

// Long texts use the small markup in src/lib/rich-text.ts.
const contentSchema = z.object({
  about: z.string().trim().max(1000),
  methodology: z.string().trim().min(1).max(50_000),
  privacy: z.string().trim().min(1).max(50_000),
  terms: z.string().trim().min(1).max(50_000),
  banner: z.string().trim().max(500),
  maintenance: z.boolean(),
  maintenanceMessage: z.string().trim().min(1).max(1000),
});

const definitions = {
  comments: {
    schema: commentsSchema,
    defaults: {
      enabled: true,
      preModeration: false,
      autoHideThreshold: 3,
      blockedTerms: [],
      editWindowMinutes: 15,
    } satisfies z.infer<typeof commentsSchema>,
  },
  registration: {
    schema: registrationSchema,
    defaults: { enabled: true, password: true, google: true } satisfies z.infer<
      typeof registrationSchema
    >,
  },
  content: {
    schema: contentSchema,
    defaults: defaultContent satisfies z.infer<typeof contentSchema>,
  },
};

export type SettingKey = keyof typeof definitions;
export type CommentSettings = z.infer<typeof commentsSchema>;
export type RegistrationSettings = z.infer<typeof registrationSchema>;
export type ContentSettings = z.infer<typeof contentSchema>;
type SettingValue = {
  comments: CommentSettings;
  registration: RegistrationSettings;
  content: ContentSettings;
};

export class SettingsError extends Error {
  constructor(
    message: string,
    readonly issues: string[],
  ) {
    super(message);
  }
}

function issuesOf(error: z.ZodError) {
  return error.issues.map((i) => `${i.path.join(".") || "(valor)"}: ${i.message}`);
}

// Stored values may be partial; anything invalid is a bug or a manual edit,
// so it fails loudly rather than silently using defaults.
export function parseSetting<K extends SettingKey>(key: K, value: unknown): SettingValue[K] {
  const { schema, defaults } = definitions[key];
  const stored = schema.partial().safeParse(value ?? {});
  if (!stored.success) {
    throw new Error(`Invalid "${key}" site setting: ${issuesOf(stored.error).join("; ")}`);
  }
  return { ...defaults, ...stored.data } as SettingValue[K];
}

export async function loadSetting<K extends SettingKey>(
  db: Executor,
  key: K,
): Promise<SettingValue[K]> {
  const [row] = await db
    .select({ value: siteSettings.value })
    .from(siteSettings)
    .where(eq(siteSettings.key, key));
  return parseSetting(key, row?.value);
}

// Validates a complete value for `key` (the ranking key passes its own
// validator) and stores it with an audit entry.
export async function saveSetting(
  db: Database,
  input: {
    key: string;
    value: unknown;
    actorUserId: string;
    validate?: (value: unknown) => unknown;
  },
) {
  let value: unknown;
  if (input.validate) {
    value = input.validate(input.value);
  } else {
    const definition = definitions[input.key as SettingKey];
    if (!definition) throw new Error(`Unknown site setting "${input.key}"`);
    const parsed = definition.schema.safeParse(input.value);
    if (!parsed.success) {
      throw new SettingsError("Revisa los valores de la configuración.", issuesOf(parsed.error));
    }
    value = parsed.data;
  }

  await db.transaction(async (tx) => {
    const [before] = await tx
      .select({ value: siteSettings.value })
      .from(siteSettings)
      .where(eq(siteSettings.key, input.key))
      .for("update");
    await tx
      .insert(siteSettings)
      .values({ key: input.key, value, updatedByUserId: input.actorUserId })
      .onConflictDoUpdate({
        target: siteSettings.key,
        set: { value, updatedByUserId: input.actorUserId },
      });
    await tx.insert(auditLog).values({
      actorUserId: input.actorUserId,
      action: "site_setting.update",
      entity: "site_setting",
      entityId: input.key,
      before: before?.value ?? null,
      after: value,
    });
  });
  return value;
}
