/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_WEB_ADMIN_AUTH_ENDPOINT?: string
  readonly VITE_WEB_ADMIN_API_BASE_URL?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
