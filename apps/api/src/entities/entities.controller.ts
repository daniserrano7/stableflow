import { Controller, Get } from "@nestjs/common";
import { EntitiesService } from "./entities.service.js";

@Controller("entities")
export class EntitiesController {
  constructor(private readonly entitiesService: EntitiesService) {}

  @Get()
  listEntities() {
    return this.entitiesService.listEntities();
  }
}
