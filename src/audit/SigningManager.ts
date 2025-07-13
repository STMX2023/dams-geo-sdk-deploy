// Signing Manager for audit exports
import DamsGeoModule from '../DamsGeoModule';

export class SigningManager {
  private static instance: SigningManager;
  private keyPairGenerated: boolean = false;

  private constructor() {}

  static getInstance(): SigningManager {
    if (!SigningManager.instance) {
      SigningManager.instance = new SigningManager();
    }
    return SigningManager.instance;
  }

  async ensureKeyPair(): Promise<void> {
    if (this.keyPairGenerated) {
      return;
    }

    try {
      const hasKeyPair = await DamsGeoModule.hasSigningKeyPair();
      if (!hasKeyPair) {
        await DamsGeoModule.generateSigningKeyPair();
      }
      this.keyPairGenerated = true;
    } catch (error) {
      console.error('[SigningManager] Failed to ensure key pair:', error);
      throw error;
    }
  }

  async signData(data: string): Promise<string> {
    try {
      await this.ensureKeyPair();
      const signature = await DamsGeoModule.signData(data);
      return signature;
    } catch (error) {
      console.error('[SigningManager] Failed to sign data:', error);
      throw error;
    }
  }

  async verifySignature(data: string, signature: string): Promise<boolean> {
    try {
      const isValid = await DamsGeoModule.verifySignature(data, signature);
      return isValid;
    } catch (error) {
      console.error('[SigningManager] Failed to verify signature:', error);
      return false;
    }
  }

  async getPublicKey(): Promise<string> {
    try {
      await this.ensureKeyPair();
      const publicKey = await DamsGeoModule.getSigningPublicKey();
      return publicKey;
    } catch (error) {
      console.error('[SigningManager] Failed to get public key:', error);
      throw error;
    }
  }

  async deleteKeyPair(): Promise<void> {
    try {
      await DamsGeoModule.deleteSigningKeyPair();
      this.keyPairGenerated = false;
    } catch (error) {
      console.error('[SigningManager] Failed to delete key pair:', error);
      throw error;
    }
  }
}