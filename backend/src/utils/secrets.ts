import fs from 'fs';

export interface LoadSecretOptions {
  /** Whether the secret is required (default: true) */
  required?: boolean;
  /** Minimum length validation for security-critical secrets (default: none) */
  minLength?: number;
}

/**
 * Load secret from Docker Secrets or environment variable
 *
 * Attempts to read from /run/secrets/<name> first (production),
 * then falls back to environment variable (development).
 *
 * @param name Secret name (e.g., 'jwt_secret', 'toggl_api_token')
 * @param options Configuration options
 * @returns Secret value or undefined if optional and not found
 * @throws Error if required secret is missing or validation fails
 *
 * @example
 * // Required secret with minimum length
 * const jwtSecret = loadSecret('jwt_secret', { minLength: 32 });
 *
 * @example
 * // Optional API token (may not be configured)
 * const togglToken = loadSecret('toggl_api_token', { required: false });
 */
export function loadSecret(name: string, options: LoadSecretOptions = {}): string | undefined {
  const { required = true, minLength } = options;

  let value: string | undefined;

  try {
    // Try Docker Secrets path first (/run/secrets/<name>)
    value = fs.readFileSync(`/run/secrets/${name}`, 'utf8').trim();
  } catch (err) {
    // Fallback to environment variable for development
    const envName = name.toUpperCase();
    value = process.env[envName];
  }

  // Handle missing secret
  if (!value) {
    if (required) {
      const envName = name.toUpperCase();
      throw new Error(
        `Secret ${name} not found in /run/secrets or environment variable ${envName}`
      );
    }
    return undefined;
  }

  // Validate minimum length if specified
  if (minLength && value.length < minLength) {
    throw new Error(
      `Secret ${name} must be at least ${minLength} characters long (found ${value.length})`
    );
  }

  return value;
}
