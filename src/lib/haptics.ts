'use client';

function isIOS(): boolean {
  if (typeof navigator === 'undefined') return false;
  return /iPad|iPhone|iPod/.test(navigator.userAgent);
}

function canVibrate(): boolean {
  if (typeof navigator === 'undefined') return false;
  return 'vibrate' in navigator;
}

async function tap(): Promise<void> {
  if (typeof window === 'undefined') return;

  if (isIOS()) {
    try {
      const { haptic } = await import('ios-haptics');
      haptic();
    } catch {
      // Sin soporte
    }
    return;
  }

  if (canVibrate()) {
    navigator.vibrate(10);
  }
}

async function success(): Promise<void> {
  if (typeof window === 'undefined') return;

  if (isIOS()) {
    try {
      const { haptic } = await import('ios-haptics');
      haptic.confirm();
    } catch {
      // Sin soporte
    }
    return;
  }

  if (canVibrate()) {
    navigator.vibrate([10, 30, 10]);
  }
}

async function warning(): Promise<void> {
  if (typeof window === 'undefined') return;

  if (isIOS()) {
    try {
      const { haptic } = await import('ios-haptics');
      haptic.error();
    } catch {
      // Sin soporte
    }
    return;
  }

  if (canVibrate()) {
    navigator.vibrate([40]);
  }
}

export const haptic = { tap, success, warning };
