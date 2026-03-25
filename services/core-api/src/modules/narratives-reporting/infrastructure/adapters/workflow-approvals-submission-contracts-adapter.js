export class WorkflowApprovalsSubmissionContractsAdapter {
  constructor(workflowApprovals) {
    this.workflowApprovals = workflowApprovals;
  }

  async getReviewCycleById(reviewCycleId) {
    return this.workflowApprovals.getReviewCycleById(reviewCycleId);
  }

  async getWorkflowStateForCycleTarget(reviewCycleId, targetType, targetId) {
    return this.workflowApprovals.getWorkflowStateForCycleTarget(reviewCycleId, targetType, targetId);
  }
}
