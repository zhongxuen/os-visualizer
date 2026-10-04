import { copyMemory, type ClockScan, type ReplacementPolicy } from './types';

/**
 * Clock (second chance; OSTEP §22.8, OSC10 §10.4.5.2). One use bit per frame. The hand
 * sweeps from where it points: a frame with bit 1 has the bit cleared and is passed over;
 * the first frame with bit 0 is the victim. Each bit passed over is cleared, so a sweep
 * always ends, at the latest back where it started.
 */
export const clock: ReplacementPolicy = {
  id: 'clock',
  chooseVictim(memory) {
    const n = memory.frames.length;
    let current = copyMemory(memory);
    const scans: ClockScan[] = [];
    while (current.useBits[current.hand] === 1) {
      const frame = current.hand;
      current = copyMemory(current);
      current.useBits[frame] = 0;
      current.hand = (frame + 1) % n;
      scans.push({ frame, page: current.frames[frame]!, memory: current });
    }
    const frame = current.hand;
    return {
      frame,
      scans,
      memory: current,
      reason: 'use bit 0 under the hand (Clock)',
      detail:
        scans.length === 0
          ? `The hand points at frame ${frame}, whose use bit is 0: page ${current.frames[frame]} has not been used since the hand last passed it.`
          : `The hand cleared ${scans.length} use ${scans.length === 1 ? 'bit' : 'bits'} on its way and stopped at frame ${frame}, the first with use bit 0.`,
      citation: 'ostep.22.8',
    };
  },
};
