/** A text field from FormData. `get` can also return a File (file inputs); those are not text. */
export function formText(data: FormData, name: string): string {
  const value = data.get(name);
  return typeof value === 'string' ? value.trim() : '';
}
