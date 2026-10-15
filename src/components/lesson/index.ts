export { Checkpoint } from './Checkpoint';
export { LessonContext, useLesson, type LessonContextValue } from './LessonContext';
export { lessonMayLoad, type LessonInputState } from './autoLoad';
export {
  LESSON_PRESET,
  LESSON_PRESET_LABEL,
  presetSelect,
  type PresetOption,
  type PresetSelect,
} from './presetOption';
export { canonicalJson, matchExample } from './examples';
export { LESSON_COMPONENTS } from './lessonComponents';
export { ExampleBar, LessonStep, usePartExample } from './LessonStep';
export { checkpointKey, checkpointsDone } from './progress';
export { findVisual, revealVisual } from './reveal';
export { TryIt, tryItLabel, type TryItTarget } from './TryIt';
export { RealSystems, type RealSource } from './RealSystems';
export type {
  CheckpointOption,
  CheckpointSpec,
  LessonExample,
  LessonMeta,
} from './types';
export { Walkthrough, type WalkthroughProps } from './Walkthrough';
