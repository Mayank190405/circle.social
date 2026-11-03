import { z } from "zod";
export const handleSchema = z
  .string()
  .min(3)
  .max(40)
  .regex(/^[a-z0-9_]+$/);
export const communitySchema = z
  .object({
    slug: z
      .string()
      .min(1)
      .max(60)
      .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
    name: z.string().trim().min(1).max(100),
    description: z.string().max(500).optional(),
  })
  .strict();
export const paginationSchema = z
  .object({
    limit: z.coerce.number().int().min(1).max(100).default(20),
    cursor: z.uuid().optional(),
  })
  .strict();
export const registrationOptionsSchema = z
  .object({ handle: handleSchema })
  .strict();
