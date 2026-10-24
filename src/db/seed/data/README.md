# Reference seed data

Seeded by `pnpm db:seed` (idempotent upserts keyed by slug). Retrieved 2026-10-24.

| File                  | Contents                                                                   | Source                                                                                                                                                                                      |
| --------------------- | -------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `provinces.json`      | 31 provinces + Distrito Nacional, development region                       | [Provincias de la República Dominicana](https://es.wikipedia.org/wiki/Provincias_de_la_Rep%C3%BAblica_Dominicana) (Wikipedia, citing ONE and gob.do)                                        |
| `municipalities.json` | Municipalities with province and creation date                             | [Municipios de la República Dominicana](https://es.wikipedia.org/wiki/Municipios_de_la_Rep%C3%BAblica_Dominicana) (Wikipedia, citing ONE _División Territorial 2021_ and the creating laws) |
| `parties.ts`          | Major parties with congressional representation                            | Names and acronyms; colors from Wikipedia's [party color data](https://en.wikipedia.org/wiki/Module:Political_party). Founding dates and logos are filled in by research                    |
| `institutions.ts`     | Structural institutions (Presidency, Congress, local government, Parlacen) | Constitution of 2024; ministries are added as research references them                                                                                                                      |

Known gaps to verify against the ONE _División Territorial_ and the Gaceta Oficial:

- Province `createdOn` is not seeded yet.
- **La Victoria** (Ley 15-24) and **La Caleta** (Ley 39-24) were elevated to
  municipalities in 2024. Their effective dates are unverified, so `createdOn`
  is null. That makes 160 entries, versus the "158 (2024)" count in the source.
- Distritos municipales (≈235) are not seeded; they are out of scope until
  district directors are profiled.
