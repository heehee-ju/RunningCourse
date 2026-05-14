export function filterNonemptyImageUrls(urls: string[]): string[] {
  return urls.filter((url) => url.trim().length > 0);
}
