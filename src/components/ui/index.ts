/*
 * The small UI primitives. Popover, Kbd, Button and Switch live with the vendored
 * timeline (`src/components/timeline/ui`) and are re-exported from there, not moved, so
 * the vendored copy stays a clean diff against its source.
 */

export {
  Button,
  buttonClasses,
  type ButtonProps,
  type ButtonSize,
  type ButtonStyleOptions,
  type ButtonVariant,
} from '../timeline/ui/Button';
export { Kbd, type KbdProps } from '../timeline/ui/Kbd';
export {
  Popover,
  type PopoverProps,
  type PopoverRenderApi,
} from '../timeline/ui/Popover';
export { focusRing } from '../timeline/ui/styles';
export { Switch, type SwitchProps } from '../timeline/ui/Switch';

export { Pill, type PillProps, type PillTone } from './Pill';
export {
  SegmentedControl,
  type SegmentedControlProps,
  type SegmentedOption,
  type SegmentedSize,
} from './SegmentedControl';
export { Sheet, type SheetProps, type SheetSide } from './Sheet';
export { Tabs, type TabItem, type TabsProps } from './Tabs';
