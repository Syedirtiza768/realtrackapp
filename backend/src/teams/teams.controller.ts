import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { TeamsService } from './teams.service.js';
import { CreateTeamDto } from './dto/create-team.dto.js';
import { UpdateTeamDto } from './dto/update-team.dto.js';
import { SetTeamMembersDto } from './dto/set-team-members.dto.js';
import { RequirePermissions } from '../rbac/decorators/require-permissions.decorator.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { User } from '../auth/entities/user.entity.js';
import { RbacService } from '../rbac/rbac.service.js';

@ApiTags('Teams')
@Controller('teams')
export class TeamsController {
  constructor(
    private readonly teamsService: TeamsService,
    private readonly rbac: RbacService,
  ) {}

  @Get()
  @RequirePermissions('teams.view')
  @ApiOperation({ summary: 'List teams (all for admins, member teams for others)' })
  async list(@CurrentUser() user: User) {
    const viewAll = await this.rbac.userHasPermission(user.id, 'teams.manage');
    const teams = await this.teamsService.listTeams(viewAll, user.id);
    return { teams };
  }

  @Get(':id/members')
  @RequirePermissions('teams.manage')
  @ApiOperation({ summary: 'List user IDs assigned to a team' })
  async getMembers(@Param('id', ParseUUIDPipe) id: string) {
    const userIds = await this.teamsService.getMemberUserIds(id);
    return { userIds };
  }

  @Post()
  @RequirePermissions('teams.manage')
  @ApiOperation({ summary: 'Create a team' })
  async create(@Body() dto: CreateTeamDto) {
    const team = await this.teamsService.createTeam(dto);
    return { team };
  }

  @Patch(':id')
  @RequirePermissions('teams.manage')
  @ApiOperation({ summary: 'Update a team' })
  async update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateTeamDto) {
    const team = await this.teamsService.updateTeam(id, dto);
    return { team };
  }

  @Put(':id/members')
  @RequirePermissions('teams.manage')
  @ApiOperation({ summary: 'Replace team member assignments' })
  async setMembers(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SetTeamMembersDto,
  ) {
    const userIds = await this.teamsService.setMembers(id, dto);
    return { userIds };
  }
}
