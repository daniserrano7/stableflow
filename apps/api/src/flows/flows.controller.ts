import { BadRequestException, Controller, Get, Query } from "@nestjs/common";
import { z } from "zod";
import { FlowsService } from "./flows.service.js";

const integerQueryParam = ({ max, min }: { max: number; min: number }) =>
  z
    .string()
    .regex(/^\d+$/, "Expected an integer query parameter")
    .transform(Number)
    .pipe(z.number().int().min(min).max(max))
    .optional();

const topEntityFlowsQuerySchema = z
  .object({
    limit: integerQueryParam({ max: 20, min: 1 }),
    mode: z.enum(["net", "inflow", "outflow"]).optional(),
    windowMinutes: integerQueryParam({ max: 24 * 60, min: 1 }),
  })
  .strict();

const flowGraphQuerySchema = z
  .object({
    windowMinutes: integerQueryParam({ max: 24 * 60, min: 1 }),
  })
  .strict();

@Controller("flows")
export class FlowsController {
  constructor(private readonly flowsService: FlowsService) {}

  @Get("live-graph")
  listFlowGraph(@Query() query: Record<string, unknown>) {
    const parsedQuery = flowGraphQuerySchema.safeParse(query);

    if (!parsedQuery.success) {
      throw new BadRequestException({
        error: "Bad Request",
        message: "Invalid flow graph query parameters",
        issues: parsedQuery.error.issues.map((issue) => ({
          code: issue.code,
          message: issue.message,
          path: issue.path.join("."),
        })),
      });
    }

    return this.flowsService.listFlowGraph({
      windowMinutes: parsedQuery.data.windowMinutes,
    });
  }

  @Get("top-entities")
  listTopEntityFlows(@Query() query: Record<string, unknown>) {
    const parsedQuery = topEntityFlowsQuerySchema.safeParse(query);

    if (!parsedQuery.success) {
      throw new BadRequestException({
        error: "Bad Request",
        message: "Invalid top entity flow query parameters",
        issues: parsedQuery.error.issues.map((issue) => ({
          code: issue.code,
          message: issue.message,
          path: issue.path.join("."),
        })),
      });
    }

    return this.flowsService.listTopEntityFlows({
      limit: parsedQuery.data.limit,
      mode: parsedQuery.data.mode,
      windowMinutes: parsedQuery.data.windowMinutes,
    });
  }
}
