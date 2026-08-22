import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  isChunkLoadError,
  reloadOnChunkLoadError,
  setupChunkLoadErrorHandler,
  CHUNK_RELOAD_STORAGE_KEY,
  CHUNK_RELOAD_INTERVAL_MS,
} from "../chunk-reload";

describe("chunk-reload", () => {
  const originalSessionStorage = window.sessionStorage;
  let mockStorage: Record<string, string> = {};
  const mockReload = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    mockStorage = {};

    Object.defineProperty(window, "sessionStorage", {
      value: {
        getItem: (key: string) => mockStorage[key] ?? null,
        setItem: (key: string, value: string) => {
          mockStorage[key] = value;
        },
        removeItem: (key: string) => {
          delete mockStorage[key];
        },
        clear: () => {
          mockStorage = {};
        },
      },
      writable: true,
    });

    Object.defineProperty(window, "location", {
      value: {
        ...window.location,
        reload: mockReload,
      },
      writable: true,
    });
  });

  afterEach(() => {
    Object.defineProperty(window, "sessionStorage", {
      value: originalSessionStorage,
      writable: true,
    });
  });

  describe("isChunkLoadError", () => {
    it("deve reconhecer erros de dynamic import do Chrome / Edge", () => {
      const err = new TypeError(
        "Failed to fetch dynamically imported module: https://admin.uaus.com.br/assets/payment-methods-DiDOWw1y.js",
      );
      expect(isChunkLoadError(err)).toBe(true);
    });

    it("deve reconhecer erros de dynamic import do Safari / WebKit", () => {
      const err = new TypeError("Importing a module script failed.");
      expect(isChunkLoadError(err)).toBe(true);
    });

    it("deve reconhecer erros de dynamic import do Firefox", () => {
      const err = new Error("error loading dynamically imported module: https://domain/assets/file.js");
      expect(isChunkLoadError(err)).toBe(true);
    });

    it("deve reconhecer erros de Webpack/Rollup chunk load", () => {
      const err = new Error("Loading chunk 42 failed.");
      expect(isChunkLoadError(err)).toBe(true);
    });

    it("deve reconhecer erros de chunk CSS", () => {
      const err = new Error("Loading CSS chunk assets/style.css failed.");
      expect(isChunkLoadError(err)).toBe(true);
    });

    it("deve retornar false para erros comuns que não são de chunk", () => {
      expect(isChunkLoadError(new Error("Cannot read property of undefined"))).toBe(false);
      expect(isChunkLoadError(new TypeError("Network request failed"))).toBe(false);
      expect(isChunkLoadError(null)).toBe(false);
      expect(isChunkLoadError(undefined)).toBe(false);
    });
  });

  describe("reloadOnChunkLoadError", () => {
    it("deve recarregar a página e gravar timestamp no sessionStorage quando não houver reload recente", () => {
      const result = reloadOnChunkLoadError();

      expect(result).toBe(true);
      expect(mockReload).toHaveBeenCalledTimes(1);
      expect(mockStorage[CHUNK_RELOAD_STORAGE_KEY]).toBeDefined();
    });

    it("não deve recarregar se o erro passado não for de chunk", () => {
      const err = new Error("Erro comum de validação");
      const result = reloadOnChunkLoadError(err);

      expect(result).toBe(false);
      expect(mockReload).not.toHaveBeenCalled();
    });

    it("deve recarregar se o erro passado for de chunk", () => {
      const err = new TypeError("Failed to fetch dynamically imported module");
      const result = reloadOnChunkLoadError(err);

      expect(result).toBe(true);
      expect(mockReload).toHaveBeenCalledTimes(1);
    });

    it("não deve recarregar em loop caso já tenha recarregado nos últimos segundos", () => {
      mockStorage[CHUNK_RELOAD_STORAGE_KEY] = String(Date.now() - 2000); // 2 segundos atrás

      const result = reloadOnChunkLoadError();

      expect(result).toBe(false);
      expect(mockReload).not.toHaveBeenCalled();
    });

    it("deve permitir novo reload se a última tentativa for mais antiga que o intervalo limite", () => {
      mockStorage[CHUNK_RELOAD_STORAGE_KEY] = String(Date.now() - (CHUNK_RELOAD_INTERVAL_MS + 1000));

      const result = reloadOnChunkLoadError();

      expect(result).toBe(true);
      expect(mockReload).toHaveBeenCalledTimes(1);
    });
  });

  describe("setupChunkLoadErrorHandler", () => {
    it("deve escutar o evento vite:preloadError e disparar a recarga prevenindo o default", () => {
      setupChunkLoadErrorHandler();

      const event = new Event("vite:preloadError", { cancelable: true });
      const preventDefaultSpy = vi.spyOn(event, "preventDefault");

      window.dispatchEvent(event);

      expect(preventDefaultSpy).toHaveBeenCalledTimes(1);
      expect(mockReload).toHaveBeenCalledTimes(1);
    });
  });
});
