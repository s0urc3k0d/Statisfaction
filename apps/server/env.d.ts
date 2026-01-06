/// <reference types="node" />

declare namespace NodeJS {
  interface ProcessEnv {
    PORT?: string;
    SESSION_SECRET: string;
    BASE_URL: string;
    FRONTEND_URL: string;
    DATABASE_URL: string;
    TWITCH_CLIENT_ID: string;
    TWITCH_CLIENT_SECRET: string;
    TWITCH_REDIRECT_URI: string;
  }
}
