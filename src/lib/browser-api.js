const STORAGE_PREFIX = "novatra-extension-storage";

function getNativeApi() {
  if (typeof globalThis.browser !== "undefined") {
    return globalThis.browser;
  }

  if (typeof globalThis.chrome !== "undefined") {
    return globalThis.chrome;
  }

  return null;
}

const nativeApi = getNativeApi();
const hasExtensionRuntime = Boolean(nativeApi?.runtime?.id);

function getLastError() {
  return nativeApi?.runtime?.lastError;
}

function callbackApiCall(target, method, args = []) {
  return new Promise((resolve, reject) => {
    try {
      target[method](...args, (result) => {
        const error = getLastError();

        if (error) {
          reject(new Error(error.message));
          return;
        }

        resolve(result);
      });
    } catch (error) {
      reject(error);
    }
  });
}

function promiseOrCallbackApiCall(target, method, args = []) {
  if (!target?.[method]) {
    return Promise.resolve(undefined);
  }

  if (typeof globalThis.browser !== "undefined") {
    return Promise.resolve(target[method](...args));
  }

  return callbackApiCall(target, method, args);
}

function readFallbackStorage(areaName) {
  if (typeof localStorage === "undefined") {
    return {};
  }

  try {
    return JSON.parse(
      localStorage.getItem(`${STORAGE_PREFIX}:${areaName}`) || "{}",
    );
  } catch {
    return {};
  }
}

function writeFallbackStorage(areaName, value) {
  if (typeof localStorage === "undefined") {
    return;
  }

  localStorage.setItem(`${STORAGE_PREFIX}:${areaName}`, JSON.stringify(value));
}

function pickStorageValues(values, keys) {
  if (keys === undefined || keys === null) {
    return { ...values };
  }

  if (typeof keys === "string") {
    return keys in values ? { [keys]: values[keys] } : {};
  }

  if (Array.isArray(keys)) {
    return keys.reduce((result, key) => {
      if (key in values) {
        result[key] = values[key];
      }

      return result;
    }, {});
  }

  if (typeof keys === "object") {
    return Object.keys(keys).reduce((result, key) => {
      result[key] = key in values ? values[key] : keys[key];
      return result;
    }, {});
  }

  return {};
}

function createFallbackStorageArea(areaName) {
  return {
    async get(keys) {
      return pickStorageValues(readFallbackStorage(areaName), keys);
    },

    async set(items) {
      writeFallbackStorage(areaName, {
        ...readFallbackStorage(areaName),
        ...items,
      });
    },

    async remove(keys) {
      const values = readFallbackStorage(areaName);
      const keysToRemove = Array.isArray(keys) ? keys : [keys];

      keysToRemove.forEach((key) => {
        delete values[key];
      });

      writeFallbackStorage(areaName, values);
    },

    async clear() {
      writeFallbackStorage(areaName, {});
    },
  };
}

function createNativeStorageArea(area) {
  return {
    get(keys) {
      return promiseOrCallbackApiCall(area, "get", [keys]);
    },

    set(items) {
      return promiseOrCallbackApiCall(area, "set", [items]);
    },

    remove(keys) {
      return promiseOrCallbackApiCall(area, "remove", [keys]);
    },

    clear() {
      return promiseOrCallbackApiCall(area, "clear");
    },
  };
}

function createStorage() {
  if (!hasExtensionRuntime || !nativeApi?.storage) {
    return {
      sync: createFallbackStorageArea("sync"),
      local: createFallbackStorageArea("local"),
      onChanged: {
        addListener() {},
        removeListener() {},
      },
    };
  }

  return {
    sync: createNativeStorageArea(nativeApi.storage.sync),
    local: createNativeStorageArea(nativeApi.storage.local),
    onChanged: nativeApi.storage.onChanged,
  };
}

function sendMessage(message) {
  if (!hasExtensionRuntime || !nativeApi?.runtime?.sendMessage) {
    return Promise.resolve({ status: "Extension runtime unavailable" });
  }

  return promiseOrCallbackApiCall(nativeApi.runtime, "sendMessage", [message]);
}

function createNoopEvent() {
  return {
    addListener() {},
    removeListener() {},
  };
}

function createOnMessageEvent() {
  const event = nativeApi?.runtime?.onMessage;

  if (!event) {
    return createNoopEvent();
  }

  if (typeof globalThis.browser !== "undefined") {
    return event;
  }

  const listeners = new WeakMap();

  return {
    addListener(listener) {
      const wrappedListener = (message, sender, sendResponse) => {
        try {
          const result = listener(message, sender, sendResponse);

          if (result && typeof result.then === "function") {
            result.catch((error) => {
              console.error("Error handling runtime message:", error);
            });
            return true;
          }

          return result;
        } catch (error) {
          console.error("Error handling runtime message:", error);
          throw error;
        }
      };

      listeners.set(listener, wrappedListener);
      event.addListener(wrappedListener);
    },

    removeListener(listener) {
      const wrappedListener = listeners.get(listener);

      if (wrappedListener) {
        event.removeListener(wrappedListener);
        listeners.delete(listener);
      }
    },
  };
}

const browser = {
  storage: createStorage(),
  runtime: {
    id: nativeApi?.runtime?.id,
    sendMessage,
    onInstalled: nativeApi?.runtime?.onInstalled || createNoopEvent(),
    onStartup: nativeApi?.runtime?.onStartup || createNoopEvent(),
    onMessage: createOnMessageEvent(),
  },
};

export default browser;
