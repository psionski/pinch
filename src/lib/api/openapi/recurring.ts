import { z } from "zod";
import {
  CreateRecurringSchema,
  UpdateRecurringSchema,
  RecurringResponseSchema,
} from "@/lib/validators/recurring";
import { op, SuccessSchema } from "./helpers";

const Recurring = RecurringResponseSchema.meta({ id: "RecurringTemplate" });

export const recurringPaths = {
  "/api/recurring": {
    post: op({
      id: "createRecurring",
      summary: "Create a recurring transaction template",
      tags: ["Recurring"],
      body: CreateRecurringSchema,
      response: Recurring,
      status: 201,
      errors: [400, 404, 500],
    }),
    get: op({
      id: "listRecurring",
      summary: "List all recurring templates with next occurrence",
      tags: ["Recurring"],
      response: z.array(Recurring),
      errors: [500],
    }),
  },
  "/api/recurring/{id}": {
    get: op({
      id: "getRecurringById",
      summary: "Get a recurring template by ID",
      tags: ["Recurring"],
      pathId: "Recurring template ID",
      response: Recurring,
      errors: [400, 404, 500],
    }),
    patch: op({
      id: "updateRecurring",
      summary: "Update a recurring template",
      tags: ["Recurring"],
      pathId: "Recurring template ID",
      body: UpdateRecurringSchema,
      response: Recurring,
      errors: [400, 404, 500],
    }),
    delete: op({
      id: "deleteRecurring",
      summary: "Delete a recurring template",
      tags: ["Recurring"],
      pathId: "Recurring template ID",
      response: SuccessSchema,
      errors: [404, 500],
    }),
  },
  "/api/recurring/generate": {
    post: op({
      id: "generateRecurring",
      summary: "Generate pending recurring transactions up to today",
      tags: ["Recurring"],
      response: z.object({ created: z.number().int() }),
      errors: [500],
    }),
  },
};
