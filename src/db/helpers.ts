export function dbError<T>(f: () => T) {
    try {
        return {
            result: f(),
        };
    } catch (error) {
        return {
            error: error.toString(),
            stack: error.stack,
        };
    }
}

export const nameof = <T>() => (name: keyof T) => name;
