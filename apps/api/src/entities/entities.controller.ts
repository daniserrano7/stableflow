import { BadRequestException, Controller, Get, Param, Query } from "@nestjs/common";
import { z } from "zod";
import { EntitiesService } from "./entities.service.js";

const integerQueryParam = ({ max, min }: { max: number; min: number }) =>
  z
    .string()
    .regex(/^\d+$/, "Expected an integer query parameter")
    .transform(Number)
    .pipe(z.number().int().min(min).max(max))
    .optional();

const entityDetailQuerySchema = z
  .object({
    windowMinutes: integerQueryParam({ max: 24 * 60, min: 1 }),
  })
  .strict();

@Controller("entities")
export class EntitiesController {
  constructor(private readonly entitiesService: EntitiesService) {}

  @Get()
  listEntities() {
    return this.entitiesService.listEntities();
  }

  @Get(":entityId")
  getEntityDetail(@Param("entityId") entityId: string, @Query() query: Record<string, unknown>) {
    const parsedQuery = entityDetailQuerySchema.safeParse(query);

    if (!parsedQuery.success) {
      throw new BadRequestException({
        error: "Bad Request",
        issues: parsedQuery.error.issues.map((issue) => ({
          code: issue.code,
          message: issue.message,
          path: issue.path.join("."),
        })),
        message: "Invalid entity detail query parameters",
      });
    }

    return this.entitiesService.getEntityDetail(entityId, {
      windowMinutes: parsedQuery.data.windowMinutes,
    });
  }
}
