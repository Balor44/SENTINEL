// lib/secure-vault.ts


export const SecureVault = {
  /**
   * Encrypts a string (private key or seed phrase) using a user-provided password.
   * Uses native AES-GCM encryption.
   */
  async encrypt(text: string, password: string): Promise<string> {
    const enc = new TextEncoder();
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const iv = crypto.getRandomValues(new Uint8Array(12));
    
    const keyMaterial = await crypto.subtle.importKey("raw", enc.encode(password), { name: "PBKDF2" }, false, ["deriveKey"]);
    const key = await crypto.subtle.deriveKey(
      { name: "PBKDF2", salt, iterations: 100000, hash: "SHA-256" },
      keyMaterial,
      { name: "AES-GCM", length: 256 },
      false,
      ["encrypt"]
    );
    
    const cipher = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, enc.encode(text));
    
    // Pack salt, iv, and ciphertext into a single base64 string
    const bundle = new Uint8Array(salt.length + iv.length + cipher.byteLength);
    bundle.set(salt, 0);
    bundle.set(iv, salt.length);
    bundle.set(new Uint8Array(cipher), salt.length + iv.length);
    
    return btoa(String.fromCharCode(...bundle));
  },


  /**
   * Decrypts a base64 bundle back into the plaintext private key using the password.
   */
  async decrypt(bundleBase64: string, password: string): Promise<string> {
    const bundleStr = atob(bundleBase64);
    const bundle = new Uint8Array(bundleStr.length);
    for (let i = 0; i < bundleStr.length; i++) bundle[i] = bundleStr.charCodeAt(i);
    
    const salt = bundle.slice(0, 16);
    const iv = bundle.slice(16, 28);
    const cipher = bundle.slice(28);
    
    const enc = new TextEncoder();
    const keyMaterial = await crypto.subtle.importKey("raw", enc.encode(password), { name: "PBKDF2" }, false, ["deriveKey"]);
    const key = await crypto.subtle.deriveKey(
      { name: "PBKDF2", salt, iterations: 100000, hash: "SHA-256" },
      keyMaterial,
      { name: "AES-GCM", length: 256 },
      false,
      ["decrypt"]
    );
    
    const plainBuffer = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, cipher);
    return new TextDecoder().decode(plainBuffer);
  }
};


