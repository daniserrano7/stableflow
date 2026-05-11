import { Controller, Get } from "@nestjs/common";
import { HealthService } from "./health.service.js";

@Controller("health")
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @Get()
  getHealth() {
    return this.healthService.getHealth();
  }

  @Get("readiness")
  getReadiness() {
    return this.healthService.getReadiness();
  }
}
