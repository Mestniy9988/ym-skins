import fs from 'node:fs';

export function classifyLoopback({ platform, hasSoundDevice, hasPulseServer }) {
  if (platform !== 'linux') return 'not-checked';
  if (!hasSoundDevice && !hasPulseServer) return 'no-device';
  return 'present-untested';
}

export function readLoopback(env = process.env, platform = process.platform) {
  return {
    status: classifyLoopback({
      platform,
      hasSoundDevice: fs.existsSync('/dev/snd'),
      hasPulseServer: Boolean(env.PULSE_SERVER),
    }),
  };
}
