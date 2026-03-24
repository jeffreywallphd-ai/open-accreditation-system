import { Module } from '@nestjs/common';
import { DATABASE_CONNECTION } from '../../infrastructure/persistence/persistence.tokens.js';
import { ORG_REPOSITORY_TOKENS, OrganizationRegistryModule } from '../organization-registry/organization-registry.module.js';
import { CurriculumMappingService } from './application/curriculum-mapping-service.js';
import {
  SqliteAssessmentArtifactRepository,
  SqliteAssessmentOutcomeLinkRepository,
  SqliteAssessmentRepository,
  SqliteCourseOutcomeMapRepository,
  SqliteCourseRepository,
  SqliteLearningOutcomeRepository,
  SqliteProgramRepository,
} from './infrastructure/persistence/sqlite-curriculum-mapping-repositories.js';
import { CurriculumMappingController } from './api/curriculum-mapping.controller.js';

export const CURR_REPOSITORY_TOKENS = {
  programs: Symbol('CURR_PROGRAM_REPOSITORY'),
  courses: Symbol('CURR_COURSE_REPOSITORY'),
  learningOutcomes: Symbol('CURR_LEARNING_OUTCOME_REPOSITORY'),
  courseOutcomeMaps: Symbol('CURR_COURSE_OUTCOME_MAP_REPOSITORY'),
  assessments: Symbol('CURR_ASSESSMENT_REPOSITORY'),
  assessmentOutcomeLinks: Symbol('CURR_ASSESSMENT_OUTCOME_LINK_REPOSITORY'),
  assessmentArtifacts: Symbol('CURR_ASSESSMENT_ARTIFACT_REPOSITORY'),
};

export const CURR_SERVICE = Symbol('CURR_SERVICE');

@Module({
  imports: [OrganizationRegistryModule],
  controllers: [CurriculumMappingController],
  providers: [
    {
      provide: CURR_REPOSITORY_TOKENS.programs,
      inject: [DATABASE_CONNECTION],
      useFactory: (database) => new SqliteProgramRepository(database),
    },
    {
      provide: CURR_REPOSITORY_TOKENS.courses,
      inject: [DATABASE_CONNECTION],
      useFactory: (database) => new SqliteCourseRepository(database),
    },
    {
      provide: CURR_REPOSITORY_TOKENS.learningOutcomes,
      inject: [DATABASE_CONNECTION],
      useFactory: (database) => new SqliteLearningOutcomeRepository(database),
    },
    {
      provide: CURR_REPOSITORY_TOKENS.courseOutcomeMaps,
      inject: [DATABASE_CONNECTION],
      useFactory: (database) => new SqliteCourseOutcomeMapRepository(database),
    },
    {
      provide: CURR_REPOSITORY_TOKENS.assessments,
      inject: [DATABASE_CONNECTION],
      useFactory: (database) => new SqliteAssessmentRepository(database),
    },
    {
      provide: CURR_REPOSITORY_TOKENS.assessmentOutcomeLinks,
      inject: [DATABASE_CONNECTION],
      useFactory: (database) => new SqliteAssessmentOutcomeLinkRepository(database),
    },
    {
      provide: CURR_REPOSITORY_TOKENS.assessmentArtifacts,
      inject: [DATABASE_CONNECTION],
      useFactory: (database) => new SqliteAssessmentArtifactRepository(database),
    },
    {
      provide: CURR_SERVICE,
      inject: [
        CURR_REPOSITORY_TOKENS.programs,
        CURR_REPOSITORY_TOKENS.courses,
        CURR_REPOSITORY_TOKENS.learningOutcomes,
        CURR_REPOSITORY_TOKENS.courseOutcomeMaps,
        CURR_REPOSITORY_TOKENS.assessments,
        CURR_REPOSITORY_TOKENS.assessmentOutcomeLinks,
        CURR_REPOSITORY_TOKENS.assessmentArtifacts,
        ORG_REPOSITORY_TOKENS.institutions,
        ORG_REPOSITORY_TOKENS.organizationUnits,
      ],
      useFactory: (
        programs,
        courses,
        learningOutcomes,
        courseOutcomeMaps,
        assessments,
        assessmentOutcomeLinks,
        assessmentArtifacts,
        institutions,
        organizationUnits,
      ) =>
        new CurriculumMappingService({
          programs,
          courses,
          learningOutcomes,
          courseOutcomeMaps,
          assessments,
          assessmentOutcomeLinks,
          assessmentArtifacts,
          institutions,
          organizationUnits,
        }),
    },
  ],
  exports: [CURR_SERVICE],
})
export class CurriculumMappingModule {}
