export async function downloadPhoto(uri: string): Promise<void> {
  const response = await fetch(uri);
  if (!response.ok) throw new Error('Photo could not be read');
  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `MALKA-${Date.now()}.jpg`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}
