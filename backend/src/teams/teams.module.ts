import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RbacModule } from '../rbac/rbac.module.js';
import { Team } from './entities/team.entity.js';
import { TeamMember } from './entities/team-member.entity.js';
import { TeamsController } from './teams.controller.js';
import { TeamsService } from './teams.service.js';

@Module({
  imports: [TypeOrmModule.forFeature([Team, TeamMember]), RbacModule],
  controllers: [TeamsController],
  providers: [TeamsService],
  exports: [TeamsService, TypeOrmModule],
})
export class TeamsModule {}
