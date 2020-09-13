// Worker helpers (not a worker itself)

export function workerOnce<I, O>(importMeta: ImportMeta, fn: (input: I) => Promise<O>) {
    // return () => {
    if ("onmessage" in self) {
        const worker = (self as any) as Worker & typeof self;
        worker.onmessage = async (e: MessageEvent) => {
            const input: I = e.data;
            try {
                worker.postMessage({
                    success: await fn(input),
                });
            } catch (e) {
                worker.postMessage({
                    error: (e as Error).stack,
                });
            }
            worker.close();
        };

        setTimeout(() => {
            worker.postMessage({
                error: "timeout",
            });
            worker.close();
        }, 10000);
    }

    return (input: I) => {
        const w = new Worker(importMeta.url, {
            type: "module",
            deno: true,
        });
        return runWorkerOnce<O>(w, input);
    };
    // };
}

/**
 * Run worker like a function, once it reports anything back it's done.
 *
 * @param worker
 * @param initMessage
 */
function runWorkerOnce<R>(worker: Worker, initMessage: any) {
    return new Promise<R>((resolve, reject) => {
        worker.onmessage = (m) => {
            worker.terminate();
            const data = m.data as { success: R } | { error: any };
            // If success = undefined, then it's considered an error
            if ("success" in data) {
                resolve(data.success);
            } else {
                reject(data.error);
            }
        };
        worker.onerror = (m) => {
            worker.terminate();
            reject(m.type + " " + m.message);
        };
        worker.onmessageerror = (m) => {
            worker.terminate();
            reject("onmessageerror");
        };
        worker.postMessage(initMessage);
    });
}
