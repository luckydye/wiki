export function useTranslations() {
  return (key: string) => {
    return globalThis._translations[key];
  };
}
