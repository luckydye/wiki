import { watchEffect, type ComputedRef, type Ref } from "vue";

export function useSync(spaceId: Ref<string | null> | ComputedRef<string | null>, callback: (keys: string[]) => void) {

  const internalCallback = (msg: MessageEvent) => {
    const data = JSON.parse(msg.data);
    callback(data.scope);
  }

  watchEffect(() => {
    if (!spaceId.value) {
      return () => { };
    }

    if (!api.socketHost) {
      throw new Error("provide a socketHost in options");
    }

    api.connectToSocket(api.socketHost, spaceId?.value).then((socket) => {
      socket.addEventListener("message", internalCallback);
    });

    return () => {};
  })
}
