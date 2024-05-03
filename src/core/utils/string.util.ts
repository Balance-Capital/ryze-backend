export function replaceAll(text: string, key: string, value: any): string {
  if (!text) {
    return null;
  }
  return text.replace(new RegExp(key, 'g'), value);
}
