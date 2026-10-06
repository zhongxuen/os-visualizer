/**
 * How a lesson's checkpoints are remembered. Each answered checkpoint is one id in
 * `osv:v1`'s `completed` list, next to the lesson's own id, so `/learn` can fill a
 * station's progress ring without the walkthrough being open. The lesson id alone still
 * means "every checkpoint answered", as it did before checkpoints were kept one by one.
 */

/** The `completed` id for one checkpoint of one lesson, e.g. `lesson.scheduling#srtf-5`. */
export function checkpointKey(lessonId: string, checkpointId: string): string {
  return `${lessonId}#${checkpointId}`;
}

/** How many of `checkpointIds` are in `completed`. */
export function checkpointsDone(
  completed: readonly string[],
  lessonId: string,
  checkpointIds: readonly string[],
): number {
  const done = new Set(completed);
  if (done.has(lessonId)) return checkpointIds.length;
  return checkpointIds.filter((id) => done.has(checkpointKey(lessonId, id))).length;
}
