// Use the modern Google AI SDK that supports Live API in the browser

/**
 * Defines the callback functions that can be attached to a Gemini Live session
 * to handle events like receiving messages, opening, closing, or errors.
 */
interface SessionCallbacks {
  onmessage?: (message: any) => void;
  onclose?: (event?: CloseEvent) => void;
  onerror?: (error: any) => void;
  onopen?: () => void;
}

/**
 * Defines the configuration for establishing a Gemini Live session.
 */
interface SessionConfig {
  model?: string;
  config?: any;
  callbacks: SessionCallbacks;
  /**
   * Optional pre-resolved credential. Accepts either a user's BYOK Gemini API
   * key or a server-minted ephemeral token (e.g. from `/api/gemini/live-token`).
   * When omitted, the manager will fetch a fresh ephemeral token via
   * `tokenFetcher` (or, by default, `/api/gemini/live-token`).
   */
  apiKey?: string;
  /**
   * Custom function to fetch an ephemeral Gemini Live auth token. Called when
   * `apiKey` is not provided. Must return a string usable as the `apiKey`
   * field of `GoogleGenAI` (typically `tokens/...`).
   */
  tokenFetcher?: (model: string) => Promise<string>;
}

/**
 * A singleton class to manage the lifecycle of a Gemini Live tutoring session.
 * It ensures that only one connection is active at a time, handles on-demand
 * initialization of the SDK, and provides mechanisms to prevent rapid-reconnection
 * issues, especially during development with hot-reloading.
 */
class GeminiSessionManager {
  private static instance: GeminiSessionManager;
  private session: any | null = null;
  private genAI: any | null = null;
  private currentApiKey: string | null = null;
  private isConnecting: boolean = false;
  private lastConnectionTime: number = 0;

  private constructor() {
    // Private constructor for the singleton pattern.
  }

  /**
   * Gets the singleton instance of the GeminiSessionManager.
   */
  public static getInstance(): GeminiSessionManager {
    if (!GeminiSessionManager.instance) {
      GeminiSessionManager.instance = new GeminiSessionManager();
    }
    return GeminiSessionManager.instance;
  }

  /**
   * Default fetcher: requests a short-lived ephemeral token from our server.
   * Requires the user to be signed in via Firebase Auth.
   * @private
   */
  private async fetchEphemeralToken(model: string): Promise<string> {
    const { getAuth } = await import('firebase/auth');
    const auth = getAuth();
    const user = auth.currentUser;
    if (!user) {
      throw new Error('Not signed in: cannot mint Gemini Live token.');
    }
    const idToken = await user.getIdToken();
    const res = await fetch('/api/gemini/live-token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${idToken}`,
      },
      body: JSON.stringify({ model }),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new Error(`live-token request failed: ${res.status} ${body}`);
    }
    const data = await res.json();
    if (!data?.token) throw new Error('live-token response missing token');
    return data.token as string;
  }

  /**
   * Initializes the Google AI SDK on demand using either a caller-supplied
   * credential (BYOK key or pre-fetched ephemeral token) or a freshly minted
   * ephemeral token from the server.
   * @private
   */
  private async initialize(credential: string) {
    const apiKey = credential;
    if (!apiKey) {
      throw new Error('No Gemini credential supplied to session manager.');
    }

    if (this.genAI && this.currentApiKey === apiKey) return;

    // Re-initialize when switching keys (e.g. BYOK)
    this.genAI = null;
    this.currentApiKey = apiKey;

    try {
      const genaiModule: any = await import('@google/genai');
      const GoogleClientClass =
        genaiModule.GoogleGenAI ||
        genaiModule.GoogleAI ||
        genaiModule.default ||
        genaiModule.GoogleGenerativeAI;
      if (GoogleClientClass) {
        this.genAI = new GoogleClientClass({
          apiKey,
          httpOptions: { apiVersion: 'v1alpha' }
        });
        console.log("Gemini AI SDK (@google/genai) initialized on demand.");
        return;
      }
    } catch (e) {
      console.warn("@google/genai not available or failed to initialize, will try legacy client.");
    }

    const legacyModule: any = await import('@google/generative-ai');
    const LegacyClass = legacyModule.GoogleGenerativeAI || legacyModule.default;
    this.genAI = new LegacyClass(apiKey);
    console.log("Gemini AI legacy SDK (@google/generative-ai) initialized on demand.");
  }

  /**
   * Establishes a connection to the Gemini Live service. If a valid session
   * already exists, it will be returned.
   * @param config - The configuration for the new session.
   * @returns A promise that resolves to the active session object.
   */
  public async connect(config: SessionConfig): Promise<any> {
    const model = config.model || 'gemini-2.5-flash-native-audio-preview-12-2025';
    const credential =
      config.apiKey ||
      (await (config.tokenFetcher || ((m: string) => this.fetchEphemeralToken(m)))(model));
    await this.initialize(credential);

    if (!this.genAI) {
      throw new Error("Gemini AI SDK failed to initialize.");
    }

    const now = Date.now();
    // In development, prevent issues caused by hot-reloading triggering multiple connections.
    if (process.env.NODE_ENV === 'development') {
      if (this.isConnecting) {
        console.warn("Connection attempt ignored: another connection is in progress.");
        return;
      }
      if ((now - this.lastConnectionTime) < 1000) {
        console.warn("Rapid reconnection detected, debouncing...");
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    if (this.isSessionActive()) {
      console.log("Returning existing active Gemini Live session.");
      return this.session;
    }

    this.isConnecting = true;
    this.lastConnectionTime = now;

    try {
      console.log("Creating new Gemini Live tutoring session...");
      const liveApi = (this.genAI as any)?.live;
      if (!liveApi?.connect) {
        throw new Error("Live API not available on client. Ensure @google/genai v1+ is installed and key has Live API access.");
      }
      this.session = await liveApi.connect({
        model,
        // Avoid deprecated generation_config nesting by flattening supported fields
        // Pass through only known top-level fields to prevent 1007 errors
        config: {
          ...config.config,
          generation_config: undefined,
          generationConfig: undefined,
          responseMIMEType: undefined,
        },
        callbacks: {
          ...config.callbacks,
          onclose: (event?: CloseEvent) => {
            console.log("Gemini Live session closed by server.");
            this.session = null;
            this.isConnecting = false;
            config.callbacks.onclose?.(event);
          },
          onerror: (error: any) => {
            try {
              const message = (error && (error.message || error.toString())) || 'Unknown error';
              console.error("Gemini Live session error:", message, error);
            } catch {
              console.error("Gemini Live session error: <unprintable>");
            }
            this.session = null;
            this.isConnecting = false;
            config.callbacks.onerror?.(error);
          }
        },
      });

      console.log("Gemini Live session created successfully.");
      this.isConnecting = false;
      return this.session;
    } catch (error) {
      try {
        const message = (error as any)?.message || (error as any)?.toString?.() || 'Unknown error';
        console.error('Gemini Live connect() failed:', message, error);
      } catch {
        console.error('Gemini Live connect() failed: <unprintable>');
      }
      this.isConnecting = false;
      this.session = null;
      throw error;
    }
  }

  /**
   * Closes the current session and resets the manager's state.
   */
  public close(): void {
    if (this.session) {
      try {
        this.session.close();
      } catch (error) {
        console.error("Error closing session:", error);
      }
      this.session = null;
      this.isConnecting = false;
      console.log("Gemini Live session closed and state reset.");
    }
  }

  /**
   * Retrieves the current session object if it exists.
   * @returns The session object or null.
   */
  public getSession(): any | null {
    return this.session;
  }

  /**
   * Forces the manager to close any active session and reset its internal state.
   * This is primarily a development utility.
   */
  public forceReset(): void {
    this.close();
    this.lastConnectionTime = 0;
    console.log("Gemini session manager force reset completed.");
  }

  /**
   * Checks if a session is currently active and connected.
   * @returns True if the session is active, false otherwise.
   */
  public isSessionActive(): boolean {
    if (!this.session) return false;
    
    try {
      if (this.session.readyState !== undefined) {
        return this.session.readyState === 1; // WebSocket OPEN state
      }
      // Fallback check if readyState is not available.
      return typeof this.session.close === 'function';
    } catch (error) {
      console.error("Error checking session state:", error);
      return false;
    }
  }
}

/**
 * The singleton instance of the GeminiSessionManager, exported for use throughout the application.
 */
export const geminiSessionManager = GeminiSessionManager.getInstance();

// Expose a reset function on the window object in development for easy debugging.
if (process.env.NODE_ENV === 'development' && typeof window !== 'undefined') {
  (window as any).resetGeminiSessions = () => {
    console.log('🔧 DEV: Force resetting all Gemini sessions...');
    geminiSessionManager.forceReset();
    console.log('🔧 DEV: All sessions reset. Reload the page to start fresh.');
  };
  console.log('🔧 DEV: Use window.resetGeminiSessions() to force reset all voice sessions.');
}
