import DamsGeoModule from '../DamsGeoModule';
import { DamsGeoError, DamsGeoErrorCode, ErrorSeverity } from '../errors/DamsGeoError';

export interface EncryptionKeyConfig {
  keyAlias: string;
  requireAuthentication?: boolean;
}

export class EncryptionKeyManager {
  private static instance: EncryptionKeyManager | null = null;
  private keyAlias: string = 'dams-geo-encryption-key';
  private cachedKey: string | null = null;

  private constructor() {}

  static getInstance(): EncryptionKeyManager {
    if (!EncryptionKeyManager.instance) {
      EncryptionKeyManager.instance = new EncryptionKeyManager();
    }
    return EncryptionKeyManager.instance;
  }

  configure(config: EncryptionKeyConfig): void {
    this.keyAlias = config.keyAlias;
  }

  /**
   * Get or generate the encryption key
   * Uses iOS Keychain or Android Keystore for secure storage
   */
  async getEncryptionKey(): Promise<string> {
    if (this.cachedKey) {
      return this.cachedKey;
    }

    try {
      // Try to retrieve existing key from native secure storage
      const existingKey = await DamsGeoModule.getEncryptionKey(this.keyAlias);
      
      if (existingKey) {
        this.cachedKey = existingKey;
        return existingKey;
      }

      // Generate new key if none exists
      const newKey = this.generateKey();
      await DamsGeoModule.storeEncryptionKey(this.keyAlias, newKey);
      this.cachedKey = newKey;
      return newKey;
    } catch (error) {
      console.error('Failed to get encryption key:', error);
      throw new DamsGeoError(
        DamsGeoErrorCode.ENCRYPTION_KEY_ERROR,
        'Failed to retrieve or generate encryption key',
        {
          severity: ErrorSeverity.CRITICAL,
          context: {
            operation: 'getEncryptionKey',
            component: 'EncryptionKeyManager'
          },
          originalError: error instanceof Error ? error : undefined
        }
      );
    }
  }

  /**
   * Generate a cryptographically secure random key
   */
  private generateKey(): string {
    // Check if crypto is available
    if (typeof global.crypto === 'undefined' || !global.crypto.getRandomValues) {
      throw new DamsGeoError(
        DamsGeoErrorCode.ENCRYPTION_FAILED,
        'Cryptographically secure random number generator is not available',
        {
          severity: ErrorSeverity.CRITICAL,
          context: {
            operation: 'generateKey',
            component: 'EncryptionKeyManager'
          },
          userMessage: {
            title: 'Security Error',
            message: 'Unable to generate secure encryption key',
            action: 'Please ensure your device supports secure random number generation'
          }
        }
      );
    }

    // Generate 32 bytes (256 bits) for AES-256
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
    let key = '';
    
    const array = new Uint8Array(32);
    global.crypto.getRandomValues(array);
    array.forEach(byte => {
      key += characters[byte % characters.length];
    });
    
    return key;
  }

  /**
   * Clear the cached key (useful for security purposes)
   */
  clearCache(): void {
    this.cachedKey = null;
  }

  /**
   * Check if encryption is available on the current platform
   */
  async isEncryptionAvailable(): Promise<boolean> {
    try {
      const result = await DamsGeoModule.isEncryptionAvailable();
      return result;
    } catch {
      return false;
    }
  }

  /**
   * Delete the encryption key (use with caution - will make database inaccessible)
   */
  async deleteEncryptionKey(): Promise<void> {
    try {
      await DamsGeoModule.deleteEncryptionKey(this.keyAlias);
      this.cachedKey = null;
    } catch (error) {
      console.error('Failed to delete encryption key:', error);
      throw new DamsGeoError(
        DamsGeoErrorCode.ENCRYPTION_KEY_ERROR,
        'Failed to delete encryption key',
        {
          context: {
            operation: 'deleteEncryptionKey',
            component: 'EncryptionKeyManager'
          },
          originalError: error instanceof Error ? error : undefined
        }
      );
    }
  }

  /**
   * Check if an encryption key exists
   */
  async hasEncryptionKey(): Promise<boolean> {
    try {
      const key = await DamsGeoModule.getEncryptionKey(this.keyAlias);
      return !!key;
    } catch {
      return false;
    }
  }

  /**
   * Rotate the current encryption key – generates new key, stores it, returns the value.
   * Consumers must call DatabaseManager.rotateEncryptionKey(newKey) to re-key DB afterwards.
   */
  async rotateKey(): Promise<string> {
    try {
      const newKey = this.generateKey();
      await DamsGeoModule.storeEncryptionKey(this.keyAlias, newKey);
      this.cachedKey = newKey;
      return newKey;
    } catch (error) {
      console.error('Failed to rotate encryption key:', error);
      throw new DamsGeoError(
        DamsGeoErrorCode.ENCRYPTION_KEY_ERROR,
        'Failed to rotate encryption key',
        {
          context: {
            operation: 'rotateKey',
            component: 'EncryptionKeyManager'
          },
          originalError: error instanceof Error ? error : undefined
        }
      );
    }
  }
}