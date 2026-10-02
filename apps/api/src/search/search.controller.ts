import { BadRequestException, Controller, Get, Query } from "@nestjs/common";
import { z } from "zod";
import { SearchService } from "./search.service.js";

const searchQuerySchema = z
  .object({
    limit: z.coerce.number().int().min(1).max(10).default(6),
    q: z.string().trim().min(1).max(128),
  })
  .strict();

@Controller("search")
export class SearchController {
  constructor(private readonly searchService: SearchService) {}

  @Get()
  search(@Query() query: Record<string, unknown>) {
    const parsedQuery = searchQuerySchema.safeParse(query);

    if (!parsedQuery.success) {
      throw new BadRequestException({
        error: "Bad Request",
        issues: parsedQuery.error.issues.map((issue) => ({
          code: issue.code,
          message: issue.message,
          path: issue.path.join("."),
        })),
        message: "Invalid search query parameters",
      });
    }

    return this.searchService.search(parsedQuery.data.q, parsedQuery.data.limit);
  }
}
