export class ProgramRepository {
  async save(_program) {
    throw new Error('ProgramRepository.save not implemented');
  }

  async getById(_id) {
    throw new Error('ProgramRepository.getById not implemented');
  }

  async findByFilter(_filter) {
    throw new Error('ProgramRepository.findByFilter not implemented');
  }
}

export class CourseRepository {
  async save(_course) {
    throw new Error('CourseRepository.save not implemented');
  }

  async getById(_id) {
    throw new Error('CourseRepository.getById not implemented');
  }

  async findByFilter(_filter) {
    throw new Error('CourseRepository.findByFilter not implemented');
  }
}

export class LearningOutcomeRepository {
  async save(_learningOutcome) {
    throw new Error('LearningOutcomeRepository.save not implemented');
  }

  async getById(_id) {
    throw new Error('LearningOutcomeRepository.getById not implemented');
  }

  async findByFilter(_filter) {
    throw new Error('LearningOutcomeRepository.findByFilter not implemented');
  }
}

export class CourseOutcomeMapRepository {
  async save(_courseOutcomeMap) {
    throw new Error('CourseOutcomeMapRepository.save not implemented');
  }

  async exists(_courseId, _learningOutcomeId) {
    throw new Error('CourseOutcomeMapRepository.exists not implemented');
  }

  async findByFilter(_filter) {
    throw new Error('CourseOutcomeMapRepository.findByFilter not implemented');
  }
}

export class AssessmentRepository {
  async save(_assessment) {
    throw new Error('AssessmentRepository.save not implemented');
  }

  async getById(_id) {
    throw new Error('AssessmentRepository.getById not implemented');
  }

  async findByFilter(_filter) {
    throw new Error('AssessmentRepository.findByFilter not implemented');
  }
}

export class AssessmentOutcomeLinkRepository {
  async save(_assessmentOutcomeLink) {
    throw new Error('AssessmentOutcomeLinkRepository.save not implemented');
  }

  async exists(_assessmentId, _learningOutcomeId) {
    throw new Error('AssessmentOutcomeLinkRepository.exists not implemented');
  }

  async findByFilter(_filter) {
    throw new Error('AssessmentOutcomeLinkRepository.findByFilter not implemented');
  }
}

export class AssessmentArtifactRepository {
  async save(_assessmentArtifact) {
    throw new Error('AssessmentArtifactRepository.save not implemented');
  }

  async getById(_id) {
    throw new Error('AssessmentArtifactRepository.getById not implemented');
  }

  async findByFilter(_filter) {
    throw new Error('AssessmentArtifactRepository.findByFilter not implemented');
  }
}
