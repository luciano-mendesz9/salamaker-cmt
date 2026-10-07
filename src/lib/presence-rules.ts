export function presenceParticipantDecision(input: {
  isParticipant: boolean;
  studentCreatedAt: Date;
  lessonOpenedAt: Date;
}) {
  if (input.isParticipant) return "EXISTING" as const;
  if (input.studentCreatedAt >= input.lessonOpenedAt) return "ATTACH_LATE" as const;
  return "REJECT" as const;
}
