/**
 * Synchronous, conservative masking for prompt auditing.
 * Masks sensitive data like API keys, emails, and URLs.
 * Keeps implementation minimal and dependency-free.
 */

export type Redaction = {
  type: 'pii' | 'secret' | 'url' | 'length_truncate';
  placeholder?: string;
};

export type MaskedPrompts = {
  promptSystemMasked: string;
  promptUserMasked: string | Record<string, unknown>;
  redactions: Redaction[];
};

/**
 * Very conservative, synchronous masking. Keep it tiny and dependency-free.
 */
export function maskPrompts(
  system: string,
  user: string | object,
  opts?: { maxChars?: number }
): MaskedPrompts {
  const max = opts?.maxChars ?? 400;
  const redactions: Redaction[] = [];

  const redact = (s: string): string => {
    let out = s;
    let modified = false;

    // Mask API keys / secrets (sk-..., sk_..., etc.)
    if (/sk[_-][A-Za-z0-9]{20,}/.test(out)) {
      out = out.replace(/sk[_-][A-Za-z0-9]{20,}/g, '[SECRET]');
      redactions.push({ type: 'secret', placeholder: '[SECRET]' });
      modified = true;
    }

    // Mask emails
    if (/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/.test(out)) {
      out = out.replace(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g, '[EMAIL]');
      redactions.push({ type: 'pii', placeholder: '[EMAIL]' });
      modified = true;
    }

    // Mask URLs
    if (/\bhttps?:\/\/\S+/gi.test(out)) {
      out = out.replace(/\bhttps?:\/\/\S+/gi, '[URL]');
      redactions.push({ type: 'url', placeholder: '[URL]' });
      modified = true;
    }

    // Truncate long strings
    if (out.length > max) {
      out = out.slice(0, max) + '…';
      redactions.push({ type: 'length_truncate', placeholder: '…' });
    }

    return out;
  };

  const sysMasked = redact(system ?? '');
  const userStr = typeof user === 'string' ? user : JSON.stringify(user);
  const usrMasked = redact(userStr ?? '');

  return {
    promptSystemMasked: sysMasked,
    promptUserMasked: usrMasked,
    redactions: redactions.length > 0 ? redactions : [],
  };
}
